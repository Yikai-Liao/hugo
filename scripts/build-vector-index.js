import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// --- Configuration ---
const contentJsonPath = path.join('public', 'post', 'content.json');
const vectorIndexName = 'hugo-semantic-search';
const cloudflareAccountId = 'bc6cfc188d16225a86263c7246b6c75d';
const embeddingModel = '@cf/baai/bge-base-en-v1.5';
const embeddingDimension = 768;
const batchSize = 50; // Reduced batch size for direct API calls, maybe safer
const previewLength = 150;
// --- End Configuration ---

// Helper function to run shell commands
function runCommand(command, options = {}) {
    console.log(`$ ${command}`);
    try {
        return execSync(command, { stdio: 'inherit', ...options });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        throw error;
    }
}

// Function to get embeddings directly from Cloudflare API
async function getEmbeddings(texts, apiKey, accountId) {
    if (!apiKey) {
        throw new Error('Cloudflare API Token (CF_API_TOKEN environment variable) is missing.');
    }
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${embeddingModel}`;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: texts }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Cloudflare API Error (${response.status}): ${errorText}`);
            throw new Error(`Cloudflare API error (${response.status})`);
        }

        const result = await response.json();
        // Validate API response structure
        if (!result.success || !result.result || !Array.isArray(result.result.data) || (result.result.data.length > 0 && !Array.isArray(result.result.data[0]))) {
            console.error("Unexpected Cloudflare AI API response structure:", JSON.stringify(result));
            throw new Error("Unexpected Cloudflare AI API response structure.");
        }
        return result.result.data;
    } catch (error) {
        console.error('Error fetching embeddings from Cloudflare API:', error);
        throw error;
    }
}

// Function to generate a consistent hash ID from the chunk ID
function generateVectorId(chunkId) {
    return crypto.createHash('sha256').update(chunkId).digest('hex');
}

async function main() {
    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
    if (!cfApiToken) {
        console.error('Error: CLOUDFLARE_API_TOKEN environment variable is not set.');
        console.error('Please run the script like: CLOUDFLARE_API_TOKEN="<your_token>" npm run build:index');
        process.exit(1);
    }

    try {
        // 1. Ensure wrangler and hugo are installed
        runCommand('command -v wrangler || npm install -g wrangler');
        runCommand('command -v hugo || (echo "Hugo not found. Please install Hugo." && exit 1)');

        // Set Account ID for subsequent wrangler commands if needed (though less critical now)
        process.env.CLOUDFLARE_ACCOUNT_ID = cloudflareAccountId;
        console.log(`Using Cloudflare Account ID: ${cloudflareAccountId}`);

        // 2. Run Hugo build (No local worker needed anymore)
        console.log('Running hugo build...');
        runCommand('hugo');

        // 3. Read content JSON (contains chunks)
        console.log(`Reading chunk data from ${contentJsonPath}...`);
        let chunks;
        try {
            const fileContent = await fs.readFile(contentJsonPath, 'utf-8');
            chunks = JSON.parse(fileContent);
        } catch (err) {
            console.error(`Error reading or parsing ${contentJsonPath}. Did Hugo build successfully and generate chunks?`, err);
            throw err;
        }

        console.log(`Found ${chunks.length} content chunks to process.`);

        // 4. Prepare Vectorize data from chunks using direct API calls
        const vectors = [];
        let processedCount = 0;

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchChunks = chunks.slice(i, i + batchSize);
            const textsToEmbed = batchChunks.map(c => c.chunk_text || '');

            if (textsToEmbed.length === 0) continue;

            console.log(`Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} via Cloudflare API...`);
            // Pass the API token and account ID to the embedding function
            const embeddings = await getEmbeddings(textsToEmbed, cfApiToken, cloudflareAccountId);

            if (embeddings.length !== batchChunks.length) {
                throw new Error(`Mismatch between number of chunks (${batchChunks.length}) and embeddings received (${embeddings.length}) in batch.`);
            }

            for (let j = 0; j < batchChunks.length; j++) {
                const chunk = batchChunks[j];
                const embedding = embeddings[j];
                const vectorId = generateVectorId(chunk.chunk_id);
                const metadata = {
                    article_title: chunk.article_title || '',
                    article_url: chunk.article_url || '',
                    chunk_text_preview: (chunk.chunk_text || '').substring(0, previewLength),
                    chunk_html_id: chunk.chunk_html_id || ''
                };

                if (!metadata.article_url || !metadata.chunk_html_id) {
                    console.warn(`Skipping chunk due to missing URL or HTML ID: ${JSON.stringify(chunk)}`);
                    continue;
                }

                vectors.push({
                    id: vectorId,
                    values: embedding,
                    metadata: metadata
                });
                processedCount++;
            }
            console.log(`Batch processed. Total chunks processed: ${processedCount}`);
            // Add a small delay between batches to avoid overwhelming the API
            if (chunks.length > batchSize) {
                 await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
            }
        }

        if (vectors.length === 0) {
            console.log("No valid vectors generated to insert. Exiting.");
            return;
        }

        // 5. Insert into Vectorize
        console.log(`Inserting ${vectors.length} vectors into index '${vectorIndexName}'...`);
        const tempDir = './tmp_build';
        await fs.mkdir(tempDir, { recursive: true });
        const tempJsonlPath = path.join(tempDir, 'vectors.jsonl');
        const fileStream = await fs.open(tempJsonlPath, 'w');
        for (const vector of vectors) {
            await fileStream.write(JSON.stringify(vector) + '\n');
        }
        await fileStream.close();

        console.log(`Attempting to create Vectorize index '${vectorIndexName}' if it doesn't exist...`);
        try {
            runCommand(`npx wrangler vectorize create ${vectorIndexName} --dimensions=${embeddingDimension} --metric=cosine`);
            console.log(`Index ${vectorIndexName} created or already exists.`);
        } catch (error) {
            console.warn(`Could not automatically create index (it might already exist or another error occurred): ${error.message}`);
        }

        console.log("Uploading vectors via wrangler...");
        runCommand(`npx wrangler vectorize insert ${vectorIndexName} --file=${tempJsonlPath} --batch-size=${batchSize}`);

        await fs.unlink(tempJsonlPath);
        await fs.rmdir(tempDir);

        console.log('Vector index build process completed successfully!');

    } catch (error) {
        console.error('Build script failed:', error);
        process.exitCode = 1;
    }
    // No finally block needed to kill local worker anymore
}

main();
