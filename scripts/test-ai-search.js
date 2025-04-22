import fetch from 'node-fetch';
import path from 'path';

// --- Configuration ---
// URL of your deployed worker.
// MAKE SURE THIS IS YOUR CORRECT WORKER URL AFTER DEPLOYMENT
const workerUrl = 'https://hugo-ai-search-worker.lyk-boya.workers.dev';
const searchPath = '/api/ai-search'; // Base path for the worker endpoint

// Define test queries for each language (Can add more diverse cases)
const testCases = {
  en: [
    // 'object centric learning',
    // 'scaling laws for llms',
    // 'feature distillation',
    // 'autoregressive editing',
    // 'nonexistent topic xyz',
    // '大语言模型', // Test cross-lingual query
    // '采样' // <<< ADDED: Specific cross-lingual test case
    'random', // <<< ADDED: Specific test for "random"
    'randomly' // <<< ADDED: Specific test for "randomly"
  ],
  zh: [
    // '对象中心学习是什么？',
    // '自回归模型编辑图像',
    // '特征蒸馏方法',
    // 'LLM scaling laws', // Test cross-lingual query
    // '一个不存在的主题啊',
  ]
};
// --- End Configuration ---

async function runSingleTest(lang, query) {
    console.log(`\n--- Testing [${lang.toUpperCase()}] Query: \"${query}\" ---`);
    // Construct the URL with the lang query parameter
    const urlWithLang = `${workerUrl}${searchPath}?lang=${lang}`;
    console.log(`Sending POST request to Worker: ${urlWithLang}`);

    try {
        const startTime = Date.now();
        // Call the Worker endpoint
        const response = await fetch(urlWithLang, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query }), // Send query in body
        });
        const duration = Date.now() - startTime;

        console.log(`  Status Code: ${response.status} (${duration}ms)`);

        let responseBodyText;
        try {
            responseBodyText = await response.text(); // Read body once
        } catch (e) {
             console.error(`  Error reading response body: ${e.message}`);
             return false; // Indicate failure
        }

        if (!response.ok) {
            let errorMsg = `Test failed for [${lang}] \"${query}\" with status: ${response.status}`;
            try {
                const errorData = JSON.parse(responseBodyText);
                errorMsg += `\nResponse Body: ${JSON.stringify(errorData, null, 2)}`;
            } catch (e) {
                errorMsg += `\nResponse Body (Text): ${responseBodyText}`;
            }
            console.error(errorMsg);
            return false; // Indicate failure
        }

        // Parse the JSON response from the Worker
        let results;
        try {
            results = JSON.parse(responseBodyText);
        } catch (e) {
            console.error(`  Failed to parse JSON response: ${e.message}`);
            console.error(`  Raw Response Body: ${responseBodyText}`);
            return false; // Indicate failure
        }

        console.log(`  Worker Query successful! Received ${results?.length ?? 0} result(s):`);

        if (Array.isArray(results) && results.length > 0) {
            // Print brief summary of results
            results.forEach((r, index) => {
                console.log(`    ${index + 1}. Score: ${r.score?.toFixed(4)}, Lang: ${r.lang}, Title: ${r.title}, URL: ${r.url}`);
            });

            console.log("  --- Sample Result Detail --- (From Reranked Worker Response)");
            const firstMatch = results[0];
            // Updated fields: title, url, score, lang
            console.log(`  Title: ${firstMatch.title}`);
            console.log(`  URL: ${firstMatch.url}`);
            console.log(`  Score: ${firstMatch.score}`);
            console.log(`  Lang: ${firstMatch.lang}`);
            console.log("  ---------------------------");
        } else if (Array.isArray(results) && results.length === 0) {
            console.log("  (Received an empty result array from Worker - This might be expected for irrelevant queries)");
        } else {
            console.warn("  (Received non-array or unexpected response format from Worker)");
            console.log("  Raw Worker Response Body:", responseBodyText);
        }
        return true; // Indicate success

    } catch (error) {
        console.error(`\nTest failed for [${lang}] \"${query}\":`, error.message || error);
        if (error.cause) {
             console.error(`  Cause: ${error.cause}`);
        }
        return false; // Indicate failure
    }
}

async function runAllTests() {
    console.log(`Starting AI Search Worker Tests (Target: ${workerUrl}${searchPath})...`);

    let successCount = 0;
    let failureCount = 0;
    const totalTests = Object.values(testCases).reduce((sum, arr) => sum + arr.length, 0);

    for (const lang in testCases) {
        for (const query of testCases[lang]) {
            const success = await runSingleTest(lang, query);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }
            // Add a small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`\n--- Test Summary ---`);
    console.log(`Total tests run: ${totalTests}`);
    console.log(`Successful tests: ${successCount}`);
    console.log(`Failed tests: ${failureCount}`);
    console.log('------------------');

    if (failureCount > 0) {
        console.error("\nSome tests failed!");
        process.exitCode = 1;
    } else {
        console.log("\nAll tests passed!");
    }
}

runAllTests(); 