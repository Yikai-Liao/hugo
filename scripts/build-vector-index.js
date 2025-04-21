import fsPromises from 'fs/promises';
import standardFs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// --- Configuration ---
// Directory where language-specific chunk files are located
const finalChunksInputDir = path.join('public');
// Base name for the Vectorize index (language code will be appended)
const baseVectorIndexName = 'hugo-semantic-search';
// Regex to match final chunk files and capture language code
const chunkFilePattern = /^final-chunks\.([a-zA-Z\-]+)\.json$/;

const cloudflareAccountId = 'bc6cfc188d16225a86263c7246b6c75d';
const embeddingModel = '@cf/baai/bge-m3';
const embeddingDimension = 1024;
const batchSize = 50;
const previewLength = 150;
const DRY_RUN = process.env.DRY_RUN === 'true';
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
    console.log(`Calling Cloudflare AI API: ${apiUrl}`); // Log API endpoint
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: texts }), // Send texts directly
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Cloudflare API Error (${response.status}): ${errorText}`);
            // Log the request body for debugging (be careful with sensitive data if any)
            console.error('Request Body Sent:', JSON.stringify({ text: texts.map(t => t.substring(0, 50) + '...') })); // Log truncated texts
            throw new Error(`Cloudflare API error (${response.status})`);
        }

        const result = await response.json();
        // console.log('Cloudflare API Raw Response:', JSON.stringify(result, null, 2)); // Verbose logging if needed

        // Validate API response structure
        if (!result.success || !result.result || !Array.isArray(result.result.data)) {
             console.error("Unexpected Cloudflare AI API response structure:", JSON.stringify(result));
             throw new Error("Unexpected Cloudflare AI API response structure.");
        }
         // Check if the inner data is also an array (it should be array of arrays)
         if (result.result.data.length > 0 && !Array.isArray(result.result.data[0])) {
            console.error("Expected embedding data to be an array of arrays:", JSON.stringify(result.result.data));
            throw new Error("Unexpected embedding data format in API response.");
        }

        console.log(`Received ${result.result.data.length} embeddings from API.`);
        return result.result.data; // This should be the array of embedding vectors

    } catch (error) {
        console.error('Error fetching embeddings from Cloudflare API:', error);
        throw error;
    }
}

// Function to generate a consistent hash ID from the chunk ID
function generateVectorId(chunkId) {
    return crypto.createHash('sha256').update(chunkId).digest('hex');
}

async function processLanguageIndex(langCode, chunkFilePath) {
    console.log(`--- Processing Language: ${langCode} (File: ${chunkFilePath}) ---`);
    const languageSpecificIndexName = `${baseVectorIndexName}-${langCode}`;
    console.log(`Target Vectorize Index: ${languageSpecificIndexName}`);

    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
    if (!cfApiToken) {
        console.error(`Error: CLOUDFLARE_API_TOKEN missing for language ${langCode}. Skipping.`);
        return false; // Indicate failure/skip
    }

    let languageChunks;
    try {
        const fileContent = await fsPromises.readFile(chunkFilePath, 'utf-8');
        languageChunks = JSON.parse(fileContent);
        console.log(`  Read ${languageChunks.length} chunks for ${langCode}.`);
    } catch (err) {
        console.error(`  Error reading or parsing ${chunkFilePath}:`, err);
        return false; // Indicate failure/skip
    }

    if (languageChunks.length === 0) {
        console.log(`  No chunks found for ${langCode}. Skipping index processing.`);
        return true; // Indicate success (nothing to do)
    }

    // Prepare vectors for this language
    const vectors = [];
    let processedCount = 0;
    // Batch processing logic remains largely the same, just operates on languageChunks
    for (let i = 0; i < languageChunks.length; i += batchSize) {
        const batchChunks = languageChunks.slice(i, i + batchSize);
        const textsToEmbed = batchChunks.map(c => c.chunk_text || '');
        if (textsToEmbed.length === 0) continue;

        console.log(`  Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(languageChunks.length / batchSize)}...`);
        try {
            const embeddings = await getEmbeddings(textsToEmbed, cfApiToken, cloudflareAccountId);
            if (!Array.isArray(embeddings) || embeddings.length !== batchChunks.length) {
                throw new Error(`Embedding count mismatch or invalid format for batch.`);
            }

            for (let j = 0; j < batchChunks.length; j++) {
                const chunk = batchChunks[j];
                const embedding = embeddings[j];
                // Add validation similar to before
                if (!chunk || !chunk.chunk_id || !Array.isArray(embedding) || embedding.length !== embeddingDimension || !chunk.article_url || !chunk.chunk_html_id) {
                     console.warn(`[WARN Lang:${langCode}] Skipping invalid chunk/vector data at batch index ${j}:`, chunk ? chunk.chunk_id : 'undefined');
                     continue;
                }
                const vectorId = generateVectorId(chunk.chunk_id);
                const metadata = {
                    article_title: chunk.article_title || '',
                    article_url: chunk.article_url || '',
                    chunk_text_preview: (chunk.chunk_text || '').substring(0, previewLength),
                    chunk_html_id: chunk.chunk_html_id || ''
                };
                vectors.push({ id: vectorId, values: embedding, metadata: metadata });
                processedCount++;
            }
        } catch (error) {
            console.error(`  Error getting embeddings for batch for lang ${langCode}:`, error);
            // Decide if you want to stop processing this language or continue
            return false; // Stop processing this language on embedding error
        }
        console.log(`  Batch processed. ${processedCount} valid vectors prepared for ${langCode}.`);
        if (languageChunks.length > batchSize) {
             await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (vectors.length === 0) {
        console.log(`  No valid vectors generated for ${langCode}. Skipping insertion.`);
        return true; // Indicate success
    }

    // Insert into language-specific Vectorize index
    console.log(`  Prepared ${vectors.length} vectors for index '${languageSpecificIndexName}'.`);
    if (DRY_RUN) {
        console.log(`  DRY RUN: Skipping Vectorize operations for index ${languageSpecificIndexName}.`);
        // ... optional: write to language-specific dry run file ...
        const tempDir = './tmp_build';
        await fsPromises.mkdir(tempDir, { recursive: true });
        const dryRunOutputPath = path.join(tempDir, `dry_run_vectors.${langCode}.jsonl`);
         try {
             const fileHandle = await fsPromises.open(dryRunOutputPath, 'w');
             for (const vector of vectors) {
                 await fileHandle.write(JSON.stringify(vector) + '\n');
             }
             await fileHandle.close();
             console.log(`  DRY RUN: Prepared vectors for ${langCode} written to ${dryRunOutputPath}`);
         } catch (writeError) {
             console.error(`  DRY RUN: Error writing vectors for ${langCode} to ${dryRunOutputPath}:`, writeError);
         }
    } else {
        // Actual insertion
        const tempDir = './tmp_build';
        await fsPromises.mkdir(tempDir, { recursive: true });
        const tempJsonlPath = path.join(tempDir, `vectors.${langCode}.jsonl`);
        try {
            const fileHandle = await fsPromises.open(tempJsonlPath, 'w');
            for (const vector of vectors) {
                await fileHandle.write(JSON.stringify(vector) + '\n');
            }
            await fileHandle.close();

            console.log(`  Attempting to create index '${languageSpecificIndexName}' if it doesn't exist...`);
            try {
                runCommand(`npx wrangler vectorize create ${languageSpecificIndexName} --dimensions=${embeddingDimension} --metric=cosine`);
                console.log(`  Index ${languageSpecificIndexName} created or already exists.`);
            } catch (error) {
                console.warn(`  Could not automatically create index ${languageSpecificIndexName} (might already exist): ${error.message}`);
            }

            console.log(`  Uploading vectors to ${languageSpecificIndexName}...`);
            runCommand(`npx wrangler vectorize insert ${languageSpecificIndexName} --file=${tempJsonlPath} --batch-size=${batchSize}`);

            await fsPromises.unlink(tempJsonlPath); // Delete temp file
        } catch (err) {
            console.error(`  Error during file writing or wrangler execution for ${languageSpecificIndexName}:`, err);
             // Clean up temp file if it exists on error
             try { await fsPromises.unlink(tempJsonlPath); } catch { /* ignore */ }
            return false; // Indicate failure
        }
        // Clean up temp directory if possible (might fail if other languages are processing)
        try { await fsPromises.rmdir(tempDir); } catch { /* ignore */ }
    }
    console.log(`--- Finished Processing Language: ${langCode} ---`);
    return true; // Indicate success
}

async function main() {
    console.log('--- Starting Vector Index Build Process (Multi-Lingual) ---');
    if (DRY_RUN) {
        console.log('*** DRY RUN MODE ENABLED *** No data will be inserted into Vectorize.');
    }

    // Ensure CLOUDFLARE_ACCOUNT_ID is set for wrangler commands
    if (!process.env.CLOUDFLARE_API_TOKEN) {
         console.error('Error: CLOUDFLARE_API_TOKEN environment variable is not set.');
         process.exit(1);
    }
    process.env.CLOUDFLARE_ACCOUNT_ID = cloudflareAccountId;
    console.log(`Using Cloudflare Account ID: ${cloudflareAccountId}`);

    let successCount = 0;
    let failureCount = 0;

    try {
        // 1. Find all language-specific chunk files
        console.log(`Looking for final chunk files in: ${finalChunksInputDir} matching ${chunkFilePattern}`);
        const filesInDir = await fsPromises.readdir(finalChunksInputDir);
        const chunkFiles = filesInDir.filter(file => chunkFilePattern.test(file));

        if (chunkFiles.length === 0) {
            console.warn(`No final chunk files found in ${finalChunksInputDir}. Nothing to index.`);
            return;
        }

        console.log(`Found chunk files: ${chunkFiles.join(', ')}`);

        // 2. Process each language file
        for (const chunkFile of chunkFiles) {
            const match = chunkFile.match(chunkFilePattern);
            const langCode = match[1]; // Group 1 captured the language code
            if (!langCode) {
                console.warn(`Could not extract language code from filename: ${chunkFile}. Skipping.`);
                continue;
            }
            const chunkFilePath = path.join(finalChunksInputDir, chunkFile);
            const success = await processLanguageIndex(langCode, chunkFilePath);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
        }

    } catch (error) {
        console.error('Main build script failed unexpectedly:', error);
        failureCount++; // Consider this a failure
    }

    console.log('--- Vector Index Build Process Summary ---');
    console.log(`Languages processed successfully: ${successCount}`);
    console.log(`Languages failed/skipped: ${failureCount}`);
    if (failureCount > 0) {
         process.exitCode = 1; // Indicate failure in exit code
         console.error('Build process completed with errors.');
    } else {
         console.log('Build process completed successfully!');
    }
}

main();
