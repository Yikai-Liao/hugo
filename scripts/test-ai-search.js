import fetch from 'node-fetch';
import path from 'path';

// --- Configuration ---
// URL of your deployed worker.
const workerUrl = 'https://hugo-ai-search-worker.lyk-boya.workers.dev';
const searchPath = '/api/ai-search'; // Base path for the worker endpoint
const topK = 5; // Keep consistent? (Worker currently uses 10)

// Define test queries for each language (Reduced)
const testCases = {
  en: [
    'object centric learning',
    '大语言模型',
    'LLM',
    'AI',
    'asdfasdfsag'
  ],
  zh: [
    '对象中心学习是什么？',
    'LLM',
    '人工智能',
    '阿巴'
  ]
};
// --- End Configuration ---

// Remove getSingleEmbedding and queryVectorizeIndexAPI/CLI functions
// as we are calling the worker now

async function runSingleTest(lang, query) {
    console.log(`\n--- Testing [${lang.toUpperCase()}] Query: "${query}" ---`);
    // Construct the URL with the lang query parameter
    const urlWithLang = `${workerUrl}${searchPath}?lang=${lang}`;
    console.log(`Sending POST request to Worker: ${urlWithLang}`);

    try {
        // Call the Worker endpoint
        const response = await fetch(urlWithLang, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query }), // Send query in body
        });

        console.log(`  Status Code: ${response.status}`);

        if (!response.ok) {
            let errorMsg = `Test failed for [${lang}] "${query}" with status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += `\nResponse Body: ${JSON.stringify(errorData, null, 2)}`;
            } catch (e) {
                errorMsg += `\nResponse Body (not JSON): ${await response.text()}`;
             }
            console.error(errorMsg);
            return false; // Indicate failure
        }

        // Parse the JSON response from the Worker
        const results = await response.json();

        console.log(`  Worker Query successful! Received ${results?.length ?? 0} result(s):`);

        if (Array.isArray(results) && results.length > 0) {
             console.log(JSON.stringify(results, null, 2)); // Pretty print results

             console.log("  --- Sample Result --- (From Worker)");
             const firstMatch = results[0];
             // Worker now returns title, preview, anchor_link, score
             console.log(`  Title: ${firstMatch.title}`);
             console.log(`  Preview: ${firstMatch.preview}`);
             console.log(`  Anchor Link: ${firstMatch.anchor_link}`);
             console.log(`  Score: ${firstMatch.score}`);
             console.log("  ---------------------");
        } else if (Array.isArray(results) && results.length === 0) {
             console.log("  (Received an empty result array from Worker)");
        } else {
             console.warn("  (Received non-array response from Worker)");
             console.log("  Raw Worker Response:", JSON.stringify(results, null, 2));
        }
        return true; // Indicate success

    } catch (error) {
        console.error(`\nTest failed for [${lang}] "${query}":`, error.message || error);
        return false; // Indicate failure
    }
}

async function runAllTests() {
    console.log('Starting Worker Tests...'); // Updated title

    let successCount = 0;
    let failureCount = 0;

    for (const lang in testCases) {
        for (const query of testCases[lang]) {
            const success = await runSingleTest(lang, query);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 300)); // Keep delay
        }
    }

    console.log(`\n--- Test Summary ---`);
    console.log(`Total tests run: ${successCount + failureCount}`);
    console.log(`Successful tests: ${successCount}`);
    console.log(`Failed tests: ${failureCount}`);
    console.log('------------------');

    if (failureCount > 0) {
        process.exitCode = 1;
    }
}

runAllTests(); 