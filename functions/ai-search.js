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

    try {
      // Get language from query parameter (default to 'en')
      const url = new URL(request.url);
      const lang = url.searchParams.get('lang') || 'en'; // Default to English
      console.log(`[LOG] Detected language: ${lang}`);

      const body = await request.json();
      const query = body?.query;
      console.log(`[LOG] Received query: "${query}"`); // Log received query

      if (!query) {
        return new Response('Missing query in request body', { status: 400, headers: corsHeaders });
      }

      // 1. Generate embedding (model is multilingual)
      const model = '@cf/baai/bge-m3';
      const queryEmbeddingResponse = await env.AI.run(model, { text: [query] });

      if (!queryEmbeddingResponse?.data?.[0]) {
          console.error("Failed to generate query embedding. Response:", JSON.stringify(queryEmbeddingResponse));
          return new Response('Failed to generate query embedding', { status: 500, headers: corsHeaders });
      }
      const queryVector = queryEmbeddingResponse.data[0];
      // console.log(`[LOG] Generated query vector (first 5 dims): ...`);

      // 2. Select the appropriate Vectorize index based on lang
      let vectorIndexBinding;
      let indexIdentifier;
      switch (lang.toLowerCase()) {
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
         console.error(`[ERROR] No Vectorize binding found for language: ${lang}`);
         return new Response(JSON.stringify({ error: `Unsupported language: ${lang}` }), {
           status: 400,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
      }

      // 3. Query the selected Vectorize index - Fetch more results for aggregation
      const queryTopK = 20; // Reduced queryTopK to meet Vectorize limit with metadata
      const displayTopK = 10; // Display top 10 unique articles
      // Read score threshold from environment, with a default fallback
      const scoreThreshold = parseFloat(env.SCORE_THRESHOLD || '0.5');
      console.log(`[LOG] Using score threshold: ${scoreThreshold}`);

      console.log(`[LOG] Querying index "${indexIdentifier}" for lang '${lang}' with queryTopK=${queryTopK}...`);
      const vectorMatches = await vectorIndexBinding.query(queryVector, {
        topK: queryTopK,
        returnMetadata: true
      });
      console.log(`[LOG] Raw Vectorize Response for ${lang}: Received ${vectorMatches?.matches?.length ?? 0} matches.`);

      // 4. Filter results by score threshold BEFORE aggregation
      let filteredMatches = [];
      if (vectorMatches?.matches) {
        filteredMatches = vectorMatches.matches.filter(match => match.score >= scoreThreshold);
        console.log(`[LOG] Matches after score threshold filter: ${filteredMatches.length}`);
      }

      // 5. Aggregate filtered results by article, keeping the best score match for each
      const bestMatchPerArticle = new Map(); // Map<article_url, best_match_object>

      if (filteredMatches) {
        for (const match of filteredMatches) {
          const metadata = match.metadata;
          if (!metadata?.article_url || !metadata?.chunk_html_id) {
            console.warn(`[WARN] Skipping match due to missing metadata: ${JSON.stringify(metadata)}`);
            continue; // Skip incomplete matches
          }
          const articleUrl = metadata.article_url;

          if (!bestMatchPerArticle.has(articleUrl) || match.score > bestMatchPerArticle.get(articleUrl).score) {
            // If article not seen yet, or current match has higher score, update/set the best match
            bestMatchPerArticle.set(articleUrl, match);
          }
        }
      }

      // 6. Sort the best matches by score (descending)
      const sortedBestMatches = Array.from(bestMatchPerArticle.values())
                                     .sort((a, b) => b.score - a.score);

      // 7. Take the top N unique articles and format the result
      const finalResults = sortedBestMatches.slice(0, displayTopK).map(bestMatch => {
        const metadata = bestMatch.metadata; // Already checked metadata exists
        return {
            title: metadata.article_title || 'Unknown Title',
            preview: metadata.chunk_text_preview || '',
            anchor_link: `${metadata.article_url}#${metadata.chunk_html_id}`,
            score: bestMatch.score, // Score of the best matching chunk
            lang: metadata.lang || lang // Include lang
        };
      });

      console.log(`[LOG] Aggregated to ${finalResults.length} unique articles for lang '${lang}'.`);

      return new Response(JSON.stringify(finalResults), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('[ERROR] AI Search Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: 'Search failed', details: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
