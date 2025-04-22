import fsPromises from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
// NOTE: @cloudflare/sdk is primarily for Workers.
// For Node.js, direct API calls or AWS SDK v3 compatible clients are needed for R2.
// We will use fetch() for R2 interactions in this script.
// REMOVED: import { R2Client } from '@cloudflare/sdk';

// --- Configuration ---
// Base directory where language-specific articles.json files are located
const articlesInputDir = path.join('public');
const articlesFileName = 'articles.json'; // Hugo output filename
const defaultLanguage = 'en'; // Your default language
const languages = ['en', 'zh']; // Explicitly list languages to process

// Base name for the Vectorize index (language code will be appended)
const baseVectorIndexName = 'hugo-semantic-search';
// R2 Bucket Configuration
const r2BucketName = 'hugo-blog-content'; // Your R2 bucket name

// Cloudflare Credentials (ensure these are set as environment variables)
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'bc6cfc188d16225a86263c7246b6c75d'; // Use env var first
const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;

// Embedding Configuration
const embeddingModel = '@cf/baai/bge-m3';
const embeddingDimension = 1024; // Dimension for bge-m3
const batchSize = 20; // Reduced batch size for potentially larger payloads

// Script Behavior
const DRY_RUN = process.env.DRY_RUN === 'true';
// --- End Configuration ---

// --- Helper Functions ---

// Initialize Cloudflare R2 Client
let r2; // Initialize lazily after checking credentials
function getR2Client() {
    if (!r2) {
        if (!cfApiToken) {
            throw new Error('Cloudflare API Token (CLOUDFLARE_API_TOKEN or CF_API_TOKEN environment variable) is missing.');
        }
        if (!cloudflareAccountId) {
            throw new Error('Cloudflare Account ID (CLOUDFLARE_ACCOUNT_ID environment variable) is missing.');
        }
        // NOTE: Check @cloudflare/sdk documentation for the correct way to instantiate
        // This is a placeholder based on common patterns. The actual SDK might differ.
        // It might require wrangler context or direct API calls if not running in a Worker.
        // For a Node.js script, you might need to use the AWS SDK v3 compatible client with CF credentials.
        // Let's assume direct fetch for now for simplicity, as @cloudflare/sdk might be Worker-centric
        // --- USING FETCH INSTEAD OF SDK for Node.js context ---
        console.log('R2 SDK likely Worker-only. Using direct fetch API for R2 uploads.');
        r2 = { // Mock R2 client using fetch
            putObject: async ({ Bucket, Key, Body }) => {
                const url = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/r2/buckets/${Bucket}/objects/${encodeURIComponent(Key)}`;
                console.log(`  R2 PUT: ${url} (${Body.length} bytes)`);
                const response = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${cfApiToken}`,
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                    body: Body,
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`  R2 Upload Error (${response.status}) for ${Key}: ${errorText}`);
                    throw new Error(`R2 upload failed for ${Key} with status ${response.status}`);
                }
                console.log(`  Successfully uploaded to R2: ${Key}`);
                // Return structure might need adjustment based on actual API response if needed
                return { ETag: response.headers.get('etag') };
            }
        };
    }
    return r2;
}

// Upload content to R2
async function uploadToR2(bucketName, key, content) {
    try {
        const client = getR2Client(); // Get or initialize the client/fetch wrapper
        await client.putObject({
            Bucket: bucketName,
            Key: key,
            Body: content
        });
        return true;
    } catch (error) {
        console.error(`  Failed to upload ${key} to R2: ${error.message}`);
        return false;
    }
}


// Run shell commands
function runCommand(command, options = {}) {
    console.log(`$ ${command}`);
    try {
        return execSync(command, { stdio: 'inherit', ...options });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        throw error;
    }
}

// Get embeddings from Cloudflare AI API
async function getEmbeddings(texts) {
    if (!cfApiToken) {
        throw new Error('Cloudflare API Token (CLOUDFLARE_API_TOKEN or CF_API_TOKEN environment variable) is missing.');
    }
    if (!cloudflareAccountId) {
        throw new Error('Cloudflare Account ID (CLOUDFLARE_ACCOUNT_ID environment variable) is missing.');
    }
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/${embeddingModel}`;
    console.log(`  Calling Cloudflare AI API for embeddings: ${apiUrl} (Batch size: ${texts.length})`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cfApiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: texts }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`  Cloudflare AI API Error (${response.status}): ${errorText}`);
            console.error('  Request Body Sent (First 50 chars):', JSON.stringify({ text: texts.map(t => (t || '').substring(0, 50) + '...') }));
            throw new Error(`Cloudflare AI API error (${response.status})`);
        }

        const result = await response.json();

        if (!result.success || !result.result || !Array.isArray(result.result.data)) {
             console.error("  Unexpected Cloudflare AI API response structure:", JSON.stringify(result));
             throw new Error("Unexpected Cloudflare AI API response structure.");
        }
         if (result.result.data.length > 0 && !Array.isArray(result.result.data[0])) {
            console.error("  Expected embedding data to be an array of arrays:", JSON.stringify(result.result.data));
            throw new Error("Unexpected embedding data format in API response.");
        }
        if (result.result.data.length !== texts.length) {
            console.error(`  Embedding count mismatch: Expected ${texts.length}, Got ${result.result.data.length}`);
            throw new Error(`Embedding count mismatch in API response.`);
        }

        console.log(`  Received ${result.result.data.length} embeddings from API.`);
        return result.result.data;

    } catch (error) {
        console.error('  Error fetching embeddings from Cloudflare AI API:', error);
        throw error; // Re-throw to be caught by the caller
    }
}

// Generate a consistent vector ID from a unique string (e.g., lang/slug)
function generateVectorId(uniqueKey) {
    return crypto.createHash('sha256').update(uniqueKey).digest('hex');
}

// --- Main Processing Logic ---

async function processLanguageIndex(langCode, articleFilePath) {
    console.log(`--- Processing Language: ${langCode} (File: ${articleFilePath}) ---`);
    const languageSpecificIndexName = `${baseVectorIndexName}-${langCode}`;
    console.log(`Target Vectorize Index: ${languageSpecificIndexName}`);
    console.log(`Target R2 Bucket: ${r2BucketName}`);

    // Credentials checked during R2/Embedding calls

    let languageArticles;
    try {
        const fileContent = await fsPromises.readFile(articleFilePath, 'utf-8');
        languageArticles = JSON.parse(fileContent);
        console.log(`  Read ${languageArticles.length} articles for ${langCode}.`);
    } catch (err) {
        console.error(`  Error reading or parsing ${articleFilePath}:`, err);
        return false; // Indicate failure/skip
    }

    if (languageArticles.length === 0) {
        console.log(`  No articles found for ${langCode}. Skipping index processing.`);
        return true; // Indicate success (nothing to do)
    }

    const vectors = [];
    let processedCount = 0;
    let uploadedToR2Count = 0;
    let failedR2UploadCount = 0;

    for (let i = 0; i < languageArticles.length; i += batchSize) {
        const batchArticles = languageArticles.slice(i, i + batchSize);
        const textsToEmbed = batchArticles.map(a => a.rawContent || ''); // Get raw content for embedding
        if (textsToEmbed.length === 0) continue;

        console.log(` Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(languageArticles.length / batchSize)} (Size: ${batchArticles.length})...`);

        // 1. Generate embeddings for the batch
        let embeddings;
        try {
            embeddings = await getEmbeddings(textsToEmbed);
            if (!Array.isArray(embeddings) || embeddings.length !== batchArticles.length) {
                 throw new Error(`Embedding count mismatch or invalid format returned for batch.`);
            }
        } catch (error) {
            console.error(`  Error getting embeddings for batch for lang ${langCode}. Skipping batch:`, error.message);
            // Decide if you want to stop processing this language or continue
            continue; // Skip this batch on embedding error
        }

        // 2. Upload content to R2 and prepare vectors for successful uploads/embeddings
        for (let j = 0; j < batchArticles.length; j++) {
            const article = batchArticles[j];
            const embedding = embeddings[j];

            // Basic validation
            if (!article || !article.lang || !article.slug || !article.url || !article.title || typeof article.rawContent !== 'string') {
                console.warn(`[WARN Lang:${langCode}] Skipping invalid article data at index ${i + j}:`, article ? article.id || article.slug : 'undefined');
                continue;
            }
             if (!Array.isArray(embedding) || embedding.length !== embeddingDimension) {
                 console.warn(`[WARN Lang:${langCode}] Skipping article ${article.slug} due to invalid embedding at batch index ${j}.`);
                 continue;
            }

            // --- MODIFICATION START: Comment out R2 Upload ---
            /*
            // Upload content to R2 (only if not dry run)
            const r2Key = `${article.lang}/${article.slug}`;
            let uploaded = false;
            if (!DRY_RUN) {
                uploaded = await uploadToR2(r2BucketName, r2Key, article.rawContent);
                if (uploaded) {
                    uploadedToR2Count++;
                } else {
                    failedR2UploadCount++;
                    console.warn(`[WARN Lang:${langCode}] Skipping vector preparation for ${article.slug} due to R2 upload failure.`);
                    continue; // Skip vector prep if R2 upload failed
                }
            } else {
                // Simulate success for dry run to prepare vectors
                uploaded = true;
                 console.log(`  DRY RUN: Skipping R2 upload for ${r2Key}`);
            }
            */
            // --- MODIFICATION END ---

            // Prepare vector (Now always proceeds as R2 upload is skipped)
            const r2Key = `${article.lang}/${article.slug}`; // Still need the key for ID generation
            const vectorId = generateVectorId(r2Key);
            const metadata = {
                article_title: article.title || '',
                article_url: article.url || '',
                lang: article.lang || '',
                slug: article.slug || ''
                // No preview needed, no chunk ID
            };
            vectors.push({ id: vectorId, values: embedding, metadata: metadata });
            processedCount++;
        } // End loop through batch articles

        console.log(`  Batch processed. ${processedCount} valid vectors prepared for ${langCode} so far.`);
        if (languageArticles.length > batchSize) {
             await new Promise(resolve => setTimeout(resolve, 500)); // Keep delay between batches
        }

    } // End loop through batches

    console.log(`--- R2 Upload Summary for ${langCode} ---`);
    console.log(`  Successfully uploaded: ${uploadedToR2Count}`);
    console.log(`  Failed uploads: ${failedR2UploadCount}`);
    console.log(`------------------------------------`);


    if (vectors.length === 0) {
        console.log(`  No valid vectors generated for ${langCode}. Skipping Vectorize insertion.`);
        return true; // Indicate success (nothing to insert)
    }

    // Insert into language-specific Vectorize index
    console.log(`  Prepared ${vectors.length} vectors for index '${languageSpecificIndexName}'.`);

    const tempDir = './tmp_build';
    await fsPromises.mkdir(tempDir, { recursive: true });
    const outputJsonlPath = path.join(tempDir, `vectors.${langCode}.jsonl`);

    try {
        // Write vectors to temp file
        const fileHandle = await fsPromises.open(outputJsonlPath, 'w');
        for (const vector of vectors) {
            await fileHandle.write(JSON.stringify(vector) + '\n');
        }
        await fileHandle.close();
        console.log(`  Prepared vectors for ${langCode} written to ${outputJsonlPath}`);

        if (DRY_RUN) {
            console.log(`  DRY RUN: Skipping Vectorize operations for index ${languageSpecificIndexName}.`);
             // Optionally keep the dry run file, or delete it
             // await fsPromises.unlink(outputJsonlPath);
        } else {
            // Actual insertion
            console.log(`  Attempting to create Vectorize index '${languageSpecificIndexName}' if it doesn't exist...`);
            try {
                // Ensure wrangler uses the correct account ID
                process.env.CLOUDFLARE_ACCOUNT_ID = cloudflareAccountId;
                runCommand(`npx wrangler vectorize create ${languageSpecificIndexName} --dimensions=${embeddingDimension} --metric=cosine`);
                console.log(`  Index ${languageSpecificIndexName} created or already exists.`);
            } catch (error) {
                // Check if error message indicates index already exists
                 if (error.message && error.message.includes('already exists')) {
                     console.warn(`  Index ${languageSpecificIndexName} already exists.`);
                 } else if (error.message && error.message.includes('Authentication error')) {
                     console.error(`  Authentication error during index creation. Check CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.`);
                     throw error; // Stop if auth fails
                 } else {
                     console.warn(`  Could not automatically create index ${languageSpecificIndexName} (might already exist or other error): ${error.message}`);
                 }
            }

            console.log(`  Uploading vectors to ${languageSpecificIndexName}...`);
            runCommand(`npx wrangler vectorize insert ${languageSpecificIndexName} --file=${outputJsonlPath} --batch-size=${batchSize}`); // Use wrangler's batching

            await fsPromises.unlink(outputJsonlPath); // Delete temp file after successful upload
        }
    } catch (err) {
        console.error(`  Error during file writing or wrangler execution for ${languageSpecificIndexName}:`, err);
         // Clean up temp file if it exists on error
         try { await fsPromises.unlink(outputJsonlPath); } catch { /* ignore */ }
        return false; // Indicate failure
    } finally {
         // Clean up temp directory if possible (might fail if other languages are processing)
         try { await fsPromises.rmdir(tempDir); } catch { /* ignore */ }
    }

    console.log(`--- Finished Processing Language: ${langCode} ---`);
    return true; // Indicate success
}

async function main() {
    console.log('--- Starting Vector Index Build Process (Whole Article & R2) ---');
    if (DRY_RUN) {
        console.log('*** DRY RUN MODE ENABLED *** No data will be inserted into R2 or Vectorize.');
    }

    // Check essential credentials early
    if (!cfApiToken) {
         console.error('Error: CLOUDFLARE_API_TOKEN or CF_API_TOKEN environment variable is not set.');
         process.exit(1);
    }
     if (!cloudflareAccountId) {
         console.error('Error: CLOUDFLARE_ACCOUNT_ID environment variable is not set.');
         process.exit(1);
    }
    console.log(`Using Cloudflare Account ID: ${cloudflareAccountId}`);
    console.log(`Target R2 Bucket: ${r2BucketName}`);

    let successCount = 0;
    let failureCount = 0;

    // Define languages to process inside main using the global config variables
    const languagesToProcess = [defaultLanguage, ...languages.filter(l => l !== defaultLanguage)];

    try {
        // Process each defined language using languagesToProcess
        for (const langCode of languagesToProcess) {
            let articleFilePath;
            if (langCode === defaultLanguage) {
                // Path for default language (e.g., public/articles.json)
                articleFilePath = path.join(articlesInputDir, articlesFileName);
            } else {
                // Path for other languages (e.g., public/zh/articles.json)
                articleFilePath = path.join(articlesInputDir, langCode, articlesFileName);
            }

            console.log(`\nProcessing Language: '${langCode}'`);
            console.log(`Looking for article file at: ${articleFilePath}`);

            // Check if file exists before processing
             try {
                 await fsPromises.access(articleFilePath); // Check readability
                 console.log(`  Found article file.`);
                 const success = await processLanguageIndex(langCode, articleFilePath);
                 if (success) {
                     successCount++;
                 } else {
                     console.error(`  Processing failed for language '${langCode}'.`);
                     failureCount++;
                 }
             } catch (error) {
                 if (error.code === 'ENOENT') {
                     console.warn(`  Article file not found for language '${langCode}'. Skipping.`);
                     // Count as skipped, contributing to failure count
                     failureCount++;
                 } else {
                     console.error(`  Error accessing article file for ${langCode} (${articleFilePath}):`, error);
                     failureCount++;
                 }
             }
        } // End language loop

    } catch (error) {
        console.error('Main build script encountered an unexpected error:', error);
        failureCount++; // Consider this a general failure
    }

    console.log('\n--- Overall Build Process Summary ---');
    console.log(`Languages processed successfully: ${successCount}`);
    console.log(`Languages failed/skipped: ${failureCount}`);
    console.log('-------------------------------------');
    if (failureCount > 0) {
         process.exitCode = 1; // Indicate failure in exit code
         console.error('Build process completed with errors.');
    } else {
         console.log('Build process completed successfully!');
    }
}

main();
