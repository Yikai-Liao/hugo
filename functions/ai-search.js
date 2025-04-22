export default {
  async fetch(request, env) {
    // Allow CORS for local development and potentially production
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Adjust for production if needed
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Expected POST', { status: 405, headers: corsHeaders });
    }

    // --- Constants ---
    const EMBEDDING_MODEL = '@cf/baai/bge-m3';
    const RERANKER_MODEL = '@cf/baai/bge-reranker-base'; // English-focused Reranker
    const VECTORIZE_TOP_K = 20;
    const FINAL_TOP_N = 10;
    const RERANKER_SCORE_THRESHOLD = 0.1; // Threshold for EN-EN reranked results
    const VECTORIZE_SCORE_THRESHOLD = 0.46; // Adjusted threshold for Vectorize scores
    const MAX_CONTEXT_LENGTH = 2000;

    // Unique identifier for this request for easier log tracking
    const requestId = crypto.randomUUID();
    const logPrefix = `[${requestId}]`;

    try {
      // Get target language from query parameter
      const url = new URL(request.url);
      const targetLang = url.searchParams.get('lang') || 'en';
      // console.log(`${logPrefix} Target language: ${targetLang}`); // Already logged

      const body = await request.json();
      const query = body?.query;
      console.log(`${logPrefix} Received query: "${query}" for target lang: ${targetLang}`);

      if (!query) {
        console.log(`${logPrefix} [ERROR] Missing query.`);
        return new Response(JSON.stringify({ error: 'Missing query in request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Simple Query Language Detection (Heuristic) ---
      const isLikelyChineseQuery = /\p{Script=Han}/u.test(query);
      const detectedQueryLang = isLikelyChineseQuery ? 'zh' : 'en';
      console.log(`${logPrefix} Detected query lang (heuristic): ${detectedQueryLang}`);

      // --- Determine Search Path --- 
      const useRerankerPath = (detectedQueryLang === 'en' && targetLang === 'en');
      console.log(`${logPrefix} Using Reranker Path (EN-EN only): ${useRerankerPath}`);

      // --- Stage 1: Retrieval from Vectorize (Always performed) ---
      console.log(`${logPrefix} Stage 1: Retrieving candidates from Vectorize...`);

      // 1a. Generate Query Embedding
      let queryVector;
      try {
        const queryEmbeddingResponse = await env.AI.run(EMBEDDING_MODEL, { text: [query] });
        if (!queryEmbeddingResponse?.data?.[0]) {
            console.error(`${logPrefix} [ERROR] Failed to generate query embedding. AI Response:`, JSON.stringify(queryEmbeddingResponse));
            throw new Error('Failed to generate query embedding');
        }
        queryVector = queryEmbeddingResponse.data[0];
        console.log(`${logPrefix} Query embedding generated.`);
      } catch (e) {
         console.error(`${logPrefix} [ERROR] Error generating query embedding:`, e);
         return new Response(JSON.stringify({ error: 'Failed to process query embedding', details: e.message }), {
           status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
      }

      // 1b. Select Vectorize Index
      let vectorIndexBinding;
      let indexIdentifier;
      switch (targetLang.toLowerCase()) {
        case 'zh':
          vectorIndexBinding = env.VECTORIZE_INDEX_ZH;
          indexIdentifier = 'hugo-semantic-search-zh';
          break;
        case 'en':
        default:
          vectorIndexBinding = env.VECTORIZE_INDEX_EN;
          indexIdentifier = 'hugo-semantic-search-en';
          break;
      }

      if (!vectorIndexBinding) {
         console.error(`${logPrefix} [ERROR] No Vectorize binding found for language: ${targetLang}. Check wrangler.toml and bindings.`);
         return new Response(JSON.stringify({ error: `Configuration error: Unsupported language or binding missing: ${targetLang}` }), {
           status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
      }
      console.log(`${logPrefix} Using Vectorize index: ${indexIdentifier}`);

      // 1c. Query Vectorize Index
      let vectorMatches;
      try {
        vectorMatches = await vectorIndexBinding.query(queryVector, {
          topK: VECTORIZE_TOP_K,
          returnMetadata: true // We need slug and lang from metadata
        });
        // DEBUG LOG: Log raw Vectorize response
        console.log(`${logPrefix} Raw Vectorize Response (${vectorMatches?.matches?.length ?? 0} matches):`, JSON.stringify(vectorMatches, null, 2));
      } catch(e) {
        console.error(`${logPrefix} [ERROR] Error querying Vectorize index ${indexIdentifier}:`, e);
         return new Response(JSON.stringify({ error: 'Failed to query search index', details: e.message }), {
           status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
      }

      // 1d. Process Vectorize Results -> Initial Candidates
      const initialCandidates = (vectorMatches?.matches || [])
        .map(match => ({ // Keep score from vectorize!
          score: match.score,
          id: match.id,
          lang: match.metadata?.lang,
          slug: match.metadata?.slug,
          title: match.metadata?.article_title || 'Unknown Title',
          url: match.metadata?.article_url
        }))
        .filter(candidate => candidate.lang && candidate.slug);

      // DEBUG LOG: Log filtered initial candidates with Vectorize scores
      console.log(`${logPrefix} Filtered to ${initialCandidates.length} initial candidates from Vectorize:`, JSON.stringify(initialCandidates.map(c => ({ score: c.score, title: c.title, url: c.url })), null, 2));

      // --- Conditional Stage 2 or Direct Filtering --- 
      let finalResults;

      // --- MODIFICATION START: Always bypass reranker path ---
      // if (useRerankerPath) {
      if (false) { // Forcefully disable reranking path
          // --- Stage 2: Fetch Content from R2 and Rerank (EN-EN Path) ---
          console.log(`\n${logPrefix} Stage 2 (EN-EN): SKIPPED - Reranker disabled.`);
          // ... (Keep the original reranking code block here, but it won't be executed)
          // ... (Original code fetching from R2 and calling reranker) ...
          // 2a. Fetch rawContent from R2
          console.log(`${logPrefix} Fetching content for ${initialCandidates.length} candidates from R2 bucket: ${env.R2_BUCKET ? 'Bound' : 'NOT BOUND!'}`);
          if (!env.R2_BUCKET) {
              console.error(`${logPrefix} [ERROR] R2 Bucket not bound. Check wrangler.toml [[r2_buckets]] configuration.`);
              return new Response(JSON.stringify({ error: 'Configuration error: R2 bucket not bound' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
          }

          const r2KeysToFetch = initialCandidates.map(candidate => `${candidate.lang}/${candidate.slug}`);
          console.log(`${logPrefix} R2 keys to fetch:`, JSON.stringify(r2KeysToFetch)); // DEBUG LOG

          const r2FetchPromises = initialCandidates.map(candidate => {
            const r2Key = `${candidate.lang}/${candidate.slug}`;
            return env.R2_BUCKET.get(r2Key)
              .then(r2Object => {
                if (r2Object === null) {
                  console.warn(`${logPrefix} [WARN] R2 object not found for key: ${r2Key}`);
                  return { ...candidate, rawContent: null, r2Status: 'not_found' };
                }
                // console.log(`${logPrefix} R2 object found for key: ${r2Key}, fetching text...`); // Can be noisy
                return r2Object.text().then(text => ({ ...candidate, rawContent: text, r2Status: 'fetched' }));
              })
              .catch(err => {
                console.error(`${logPrefix} [ERROR] Failed to fetch or read R2 object for key ${r2Key}:`, err);
                return { ...candidate, rawContent: null, r2Status: 'error' };
              });
          });

          const candidatesWithContentResults = await Promise.allSettled(r2FetchPromises);

          // Filter for candidates where R2 fetch was successful and content is not empty
          const candidatesForReranking = candidatesWithContentResults
             .filter(result => result.status === 'fulfilled' && result.value.r2Status === 'fetched' && result.value.rawContent && result.value.rawContent.trim() !== '')
             .map(result => result.value); // Get the actual candidate object

          // DEBUG LOG: Log candidates ready for reranking
           console.log(`${logPrefix} Candidates ready for reranking (${candidatesForReranking.length}):`, JSON.stringify(candidatesForReranking.map(c => ({ slug: c.slug, title: c.title, url: c.url })), null, 2));

          if (candidatesForReranking.length === 0) {
              console.log(`${logPrefix} No candidates remaining after fetching R2 content for EN-EN reranking. Returning empty results.`);
              finalResults = [];
          } else {
              // 2b. Prepare input for Reranker model
              const rerankerInput = {
                  query: query,
                  contexts: candidatesForReranking.map(c => ({ text: (c.rawContent || '').substring(0, MAX_CONTEXT_LENGTH) }))
              };
              console.log(`${logPrefix} Reranker Input: Query="${rerankerInput.query}", Context Count=${rerankerInput.contexts.length}, Max Context Length=${MAX_CONTEXT_LENGTH}`);

              // 2c. Call Reranker Model & Parse Response
              let scoreMap = new Map();
              let rerankerResponseRaw = null; // Define outside try block
              try {
                  console.log(`${logPrefix} Calling reranker model ${RERANKER_MODEL}...`);
                  rerankerResponseRaw = await env.AI.run(RERANKER_MODEL, rerankerInput);
                  // DEBUG LOG: Log raw reranker response
                  console.log(`${logPrefix} Raw Reranker Response:`, JSON.stringify(rerankerResponseRaw, null, 2));

                  // --- PARSE RERANKER RESPONSE --- 
                  // Expected structure: { response: [{id: number, score: number}, ...] }
                  if (!rerankerResponseRaw?.response || !Array.isArray(rerankerResponseRaw.response)) {
                        console.error(`${logPrefix} [ERROR] Unexpected reranker response structure. Expected { response: [...] }. Got:`, JSON.stringify(rerankerResponseRaw));
                        throw new Error('Unexpected response structure from reranker model');
                  }

                  // Populate scoreMap using the id (original index) and score
                  for (const item of rerankerResponseRaw.response) {
                      if (typeof item.id === 'number' && typeof item.score === 'number') {
                          scoreMap.set(item.id, item.score);
                      } else {
                          console.warn(`${logPrefix} [WARN] Invalid item in reranker response:`, JSON.stringify(item));
                      }
                  }

                  // Log score count and potential issues
                  if (scoreMap.size !== rerankerInput.contexts.length) {
                       console.warn(`${logPrefix} [WARN] Reranker returned a different number of scores (${scoreMap.size}) than documents sent (${rerankerInput.contexts.length}).`);
                  }
                  // --- END PARSE RERANKER RESPONSE ---

                  console.log(`${logPrefix} Reranker call successful. Received ${scoreMap.size} valid scores.`);

              } catch (e) {
                  console.error(`${logPrefix} [ERROR] Error calling or parsing reranker model ${RERANKER_MODEL}:`, e);
                  // Include raw response in error details if available
                  const details = e.message + (rerankerResponseRaw ? ` | Raw Response: ${JSON.stringify(rerankerResponseRaw)}` : '');
                  return new Response(JSON.stringify({ error: 'Failed to rerank search results', details: details }), {
                    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  });
              }

              // 2d. Combine Reranker Scores
              const rerankedCandidates = candidatesForReranking.map((candidate, index) => ({
                  ...candidate,
                  rerank_score: scoreMap.get(index) ?? 0
              }));

              // 2e. Sort by Reranker Score
              rerankedCandidates.sort((a, b) => b.rerank_score - a.rerank_score);
              console.log(`${logPrefix} Reranked & Sorted Candidates (${rerankedCandidates.length}):`, JSON.stringify(rerankedCandidates.map(c => ({ score: c.rerank_score, title: c.title, url: c.url })), null, 2));

              // 2f. Filter by Reranker Score Threshold
              const filteredCandidates = rerankedCandidates.filter(
                  candidate => candidate.rerank_score >= RERANKER_SCORE_THRESHOLD
              );
              console.log(`${logPrefix} Filtered by reranker threshold ${RERANKER_SCORE_THRESHOLD} (${filteredCandidates.length} candidates remain):`, JSON.stringify(filteredCandidates.map(c => ({ score: c.rerank_score, title: c.title, url: c.url })), null, 2));
              
              // Format final results using rerank_score
              finalResults = filteredCandidates.slice(0, FINAL_TOP_N).map(c => ({
                  title: c.title,
                  url: c.url,
                  lang: c.lang,
                  score: c.rerank_score // Use rerank_score
              }));
          }
      } else {
          // --- Path for Non-EN-EN queries OR Reranker Disabled ---
          console.log(`\n${logPrefix} Skipping Stage 2 Reranking.`);
          console.log(`${logPrefix} Applying Vectorize score threshold ${VECTORIZE_SCORE_THRESHOLD}...`);

          // Sort initial candidates by Vectorize score (descending)
          initialCandidates.sort((a, b) => b.score - a.score);

          // Filter by Vectorize score threshold
          const filteredCandidates = initialCandidates.filter(
              candidate => candidate.score >= VECTORIZE_SCORE_THRESHOLD
          );
          console.log(`${logPrefix} Filtered by Vectorize threshold ${VECTORIZE_SCORE_THRESHOLD} (${filteredCandidates.length} candidates remain):`, JSON.stringify(filteredCandidates.map(c => ({ score: c.score, title: c.title, url: c.url })), null, 2));

          // Format final results using Vectorize score
          finalResults = filteredCandidates.slice(0, FINAL_TOP_N).map(c => ({
              title: c.title,
              url: c.url,
              lang: c.lang,
              score: c.score // Use Vectorize score
          }));
      }
      // --- MODIFICATION END ---

      console.log(`${logPrefix} Returning top ${finalResults.length} results.`);

      // --- Return final results ---
      return new Response(JSON.stringify(finalResults), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error(`${logPrefix} [ERROR] Unhandled error in AI Search Worker:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: 'Search failed due to an internal error', details: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// Helper to generate random ID for logging (if needed outside the fetch handler)
const crypto = {
    randomUUID: () => globalThis.crypto.randomUUID()
};
