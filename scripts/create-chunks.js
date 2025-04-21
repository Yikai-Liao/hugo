import fsPromises from 'fs/promises';
import standardFs from 'fs';
import path from 'path';

// --- Configuration ---
const configFilePath = path.join('config', 'chunker-config.json');
// Base public directory
const publicBaseDir = 'public';
// Section name (e.g., 'post')
const sectionName = 'post';
// Base name for the input/output files
const contentInputBaseName = 'content';
const finalChunksOutputBaseName = 'final-chunks';
// Define known languages and the default language
const languages = ['en', 'zh']; // Add all your language codes here
const defaultLanguage = 'en'; // Specify your default language code

// Default chunking values
let splitLevel = 2;
let minChunkLength = 50;
let includeHeaderChunk = true;

// Read and parse config file SYNCHRONOUSLY at the start
try {
    console.log(`Reading chunker configuration from: ${configFilePath}`);
    const configContent = standardFs.readFileSync(configFilePath, 'utf-8');
    const config = JSON.parse(configContent);

    // Validate and assign splitLevel
    if (typeof config.splitLevel === 'number' && config.splitLevel > 0) {
        splitLevel = config.splitLevel;
    } else if (config.splitLevel !== undefined) {
        console.warn(`Invalid or missing splitLevel in ${configFilePath}. Using default: ${splitLevel}`);
    }

    // Validate and assign minChunkLength
    if (typeof config.minChunkLength === 'number' && config.minChunkLength >= 0) {
        minChunkLength = config.minChunkLength;
    } else if (config.minChunkLength !== undefined) {
        console.warn(`Invalid or missing minChunkLength in ${configFilePath}. Using default: ${minChunkLength}`);
    }

    console.log(`Using config: splitLevel=${splitLevel}, minChunkLength=${minChunkLength}`);

} catch (error) {
    if (error.code === 'ENOENT') {
        console.warn(`Config file not found at ${configFilePath}. Using default values: splitLevel=${splitLevel}, minChunkLength=${minChunkLength}`);
    } else if (error instanceof SyntaxError) {
        console.error(`Error parsing JSON config file ${configFilePath}:`, error.message);
        console.warn('Continuing with default chunking parameters due to JSON error.');
    } else {
        console.error(`Error reading config file ${configFilePath}:`, error);
        console.warn('Continuing with default chunking parameters due to config error.');
    }
}
// --- End Configuration ---

// --- Chunking and Merging Logic ---
function createChunks(pageData, currentSplitLevel, currentMinChunkLength) {
    const finalChunks = []; // Initialize the array to store all chunks for the page

    // 1. Create Header Chunk if description exists
    if (includeHeaderChunk && pageData.description && pageData.description.trim().length > 0) {
        const headerText = `${pageData.title}\n\n${pageData.description.trim()}`;
        const headerChunkId = `${pageData.id}-chunk-header`;
        finalChunks.push({
            chunk_id: headerChunkId,
            article_title: pageData.title,
            article_url: pageData.url,
            chunk_text: headerText,
            chunk_html_id: headerChunkId, // Link target ID
        });
    }

    // 2. Process Raw Content using index-based slicing
    const content = pageData.rawContent;
    if (!content) return finalChunks;

    // 2.1 Build the regex to find heading lines
    let headingPatternParts = [];
    for (let i = 1; i <= currentSplitLevel; i++) {
        headingPatternParts.push(`^\s*#{${i}}[ \t]+.*`);
    }
    // Use 'g' flag to find all matches, 'm' for multiline
    const headingRegexFinder = new RegExp(headingPatternParts.join('|'), 'gm');
    // console.log(`[DEBUG] Using heading finder regex: ${headingRegexFinder}`); // Comment out debug log

    // 2.2 Find all heading indices
    const headingIndices = [0]; // Start slice from the beginning
    let match;
    while ((match = headingRegexFinder.exec(content)) !== null) {
        // Prevent infinite loops with zero-width matches (though unlikely here)
        if (match.index === headingRegexFinder.lastIndex) {
            headingRegexFinder.lastIndex++;
        }
        // Only add index if it's not 0 (already added)
        if (match.index > 0) {
             headingIndices.push(match.index);
        }
    }
     // Add the end of the content as the final slice point
    // headingIndices.push(content.length); // Add this later if needed after slicing
    // console.log(`[DEBUG] Page "${pageData.title}" (ID: ${pageData.id}): Found heading indices: ${headingIndices.join(', ')}`); // Comment out debug log

    // 2.3 Slice content based on indices
    const slicedChunks = [];
    for (let i = 0; i < headingIndices.length; i++) {
        const start = headingIndices[i];
        const end = (i + 1 < headingIndices.length) ? headingIndices[i + 1] : content.length;
        const rawChunk = content.slice(start, end);
        const trimmedChunk = rawChunk.trim();
        if (trimmedChunk.length > 0) {
            slicedChunks.push(trimmedChunk);
        }
    }
    // console.log(`[DEBUG] Page "${pageData.title}" (ID: ${pageData.id}): Sliced chunks (${slicedChunks.length}):`, JSON.stringify(slicedChunks.map(s => s.substring(0, 50) + '...'), null, 2)); // Comment out debug log

    // 2.4 Simplified Greedy Merging (Operates on cleanly slicedChunks)
    const mergedContentChunksData = [];
    let currentContentChunkText = '';

    for (let i = 0; i < slicedChunks.length; i++) {
        const chunk = slicedChunks[i]; // Already trimmed

        if (currentContentChunkText.length === 0) {
            currentContentChunkText = chunk;
        } else {
            if (currentContentChunkText.length < currentMinChunkLength) {
                currentContentChunkText += `\n\n${chunk}`;
            } else {
                mergedContentChunksData.push({
                    text: currentContentChunkText,
                    page: pageData,
                    // Use the index from the *slicedChunks* array for potential ID generation base
                    originalSliceIndex: i - 1 // Index of the start block in slicedChunks
                });
                currentContentChunkText = chunk;
            }
        }
    }

    // Add the last accumulated content chunk
    if (currentContentChunkText.length > 0) {
        if (currentContentChunkText.length >= currentMinChunkLength || mergedContentChunksData.length === 0) {
            mergedContentChunksData.push({
                text: currentContentChunkText,
                page: pageData,
                originalSliceIndex: Math.max(0, slicedChunks.length - 1)
            });
        } else {
            if (mergedContentChunksData.length > 0) {
                const lastFinalizedChunk = mergedContentChunksData[mergedContentChunksData.length - 1];
                lastFinalizedChunk.text += `\n\n${currentContentChunkText}`;
            } else {
                // Keep the single short chunk
                mergedContentChunksData.push({
                   text: currentContentChunkText,
                   page: pageData,
                   originalSliceIndex: 0
                });
            }
        }
    }

    // 2.5 Generate final chunk structure (IDs based on merge result index)
    mergedContentChunksData.forEach((mergedChunk, mergedIndex) => {
        // Use a combination of page ID and the index in the *merged* array
        // This ensures uniqueness but might not be stable across content changes
        const chunkHtmlId = `${mergedChunk.page.id}-chunk-${mergedIndex}`; // Adjusted ID scheme
        finalChunks.push({
            chunk_id: chunkHtmlId,
            article_title: mergedChunk.page.title,
            article_url: mergedChunk.page.url,
            chunk_text: mergedChunk.text,
            chunk_html_id: chunkHtmlId,
        });
    });

    return finalChunks;
}
// --- End Chunking Logic ---

async function runChunking() {
    console.log('--- Starting Chunking Process ---');
    console.log(`Using effective config: splitLevel=${splitLevel}, minChunkLength=${minChunkLength}`);
    console.log(`Processing languages: ${languages.join(', ')}. Default: ${defaultLanguage}`);

    let filesProcessedCount = 0;

    for (const langCode of languages) {
        // Determine the input path based on language
        let inputDirPath;
        let inputFileName = `${contentInputBaseName}.json`;
        if (langCode === defaultLanguage) {
            inputDirPath = path.join(publicBaseDir, sectionName);
        } else {
            inputDirPath = path.join(publicBaseDir, langCode, sectionName);
        }
        const inputFilePath = path.join(inputDirPath, inputFileName);

        // console.log(`-- Processing Lang: ${langCode}. Checking input: ${inputFilePath} --`); // Comment out verbose log

        let pagesData;
        try {
            const fileContent = await fsPromises.readFile(inputFilePath, 'utf-8');
            pagesData = JSON.parse(fileContent);
            // console.log(`  Successfully read data for ${pagesData.length} pages from ${inputFilePath}.`); // Comment out verbose log
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log(`  Input file not found for lang '${langCode}'. Skipping.`);
            } else {
                console.error(`  Error reading or parsing ${inputFilePath}:`, err);
            }
            continue; // Skip this language if file not found or error
        }

        const languageChunks = [];
        for (const page of pagesData) {
            // Ensure page.lang reflects the current language being processed
            const currentPageLang = page.lang || langCode; // Use file lang if page lang missing
            // console.log(`  Processing page: "${page.title}" (Lang: ${currentPageLang}, ID: ${page.id})`); // Comment out verbose log
            const pageChunks = createChunks(page, splitLevel, minChunkLength);
            languageChunks.push(...pageChunks);
        }

        if (languageChunks.length > 0) {
            // Output file name includes the language code
            const outputFileName = `${finalChunksOutputBaseName}.${langCode}.json`;
            // Place output files directly in the public base dir for simplicity for now
            const outputFilePath = path.join(publicBaseDir, outputFileName);

            try {
                await fsPromises.mkdir(path.dirname(outputFilePath), { recursive: true });
                await fsPromises.writeFile(outputFilePath, JSON.stringify(languageChunks, null, 2));
                // console.log(`  Successfully wrote ${languageChunks.length} chunks for lang '${langCode}' to: ${outputFilePath}`); // Comment out verbose log
                filesProcessedCount++;
            } catch (err) {
                console.error(`  Error writing language-specific chunks to ${outputFilePath}:`, err);
            }
        } else {
            // console.log(`  No chunks generated for lang '${langCode}'.`); // Comment out verbose log
        }
        // console.log(`-- Finished processing lang: ${langCode} --`); // Comment out verbose log
    }

    console.log(`--- Chunking Process Completed (${filesProcessedCount} language files generated) ---`);
}

runChunking(); 