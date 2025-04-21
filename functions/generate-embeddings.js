export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Expected POST', { status: 405 });
    }
    try {
      const body = await request.json();
      if (!body || !body.texts || !Array.isArray(body.texts)) {
        return new Response('Invalid request body. Expected { texts: ["string1", ...] }', { status: 400 });
      }

      const model = '@cf/baai/bge-base-en-v1.5'; // Or choose another suitable model
      const embeddings = await env.AI.run(model, { text: body.texts });

      return new Response(JSON.stringify(embeddings), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Embedding generation error:', error);
      return new Response(`Error generating embeddings: ${error.message}`, { status: 500 });
    }
  },
}; 