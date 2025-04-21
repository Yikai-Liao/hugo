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
      const body = await request.json();
      const query = body?.query;
      console.log(`[LOG] Received query: "${query}"`); // Log received query

      if (!query) {
        return new Response('Missing query in request body', { status: 400, headers: corsHeaders });
      }

      // 1. Generate embedding for the query using Workers AI
      const model = '@cf/baai/bge-base-en-v1.5'; // Match the model used in build script
      const queryEmbeddingResponse = await env.AI.run(model, { text: [query] });

      if (!queryEmbeddingResponse?.data?.[0]) {
          console.error("Failed to generate query embedding. Response:", JSON.stringify(queryEmbeddingResponse));
          return new Response('Failed to generate query embedding', { status: 500, headers: corsHeaders });
      }
      const queryVector = queryEmbeddingResponse.data[0];
      console.log(`[LOG] Generated query vector (first 5 dims): ${queryVector.slice(0, 5).join(', ')}...`);

      // 2. Query Vectorize index
      const topK = 10; // Number of results to return
      // Attempt to log index name/id - might not be directly available on env binding
      const indexIdentifier = env.VECTORIZE_INDEX.id || env.VECTORIZE_INDEX.name || 'hugo-semantic-search'; 
      console.log(`[LOG] Querying Vectorize index "${indexIdentifier}" with topK=${topK}...`); 
      const vectorMatches = await env.VECTORIZE_INDEX.query(queryVector, {
        topK: topK,
        returnMetadata: true // Request the metadata we stored
      });

      console.log("[LOG] Raw Vectorize Response:", JSON.stringify(vectorMatches, null, 2));

      // 3. Format results according to the new plan
      const results = vectorMatches?.matches?.map(match => {
        const metadata = match.metadata;
        // Add specific debug log for the metadata object itself
        console.log("[DEBUG] Metadata object being checked:", JSON.stringify(metadata)); 
        if (!metadata?.article_url || !metadata?.chunk_html_id) {
          // Skip results with incomplete metadata needed for linking
          console.warn("[WARN] Skipping result due to missing metadata condition. article_url:", metadata?.article_url, "chunk_html_id:", metadata?.chunk_html_id);
          // console.warn("[WARN] Original match object:", JSON.stringify(match)); // Keep this commented unless needed
          return null;
        }
        return {
          title: metadata.article_title || 'Unknown Title',
          // url: metadata.article_url, // Base URL is part of anchor_link
          preview: metadata.chunk_text_preview || '',
          anchor_link: `${metadata.article_url}#${metadata.chunk_html_id}`,
          score: match.score
        };
      }).filter(result => result !== null) || []; // Filter out null results

      console.log(`[LOG] Formatted ${results.length} results.`);

      return new Response(JSON.stringify(results), {
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
