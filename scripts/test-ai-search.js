import fetch from 'node-fetch'; // Use node-fetch for Node.js environment

// --- Configuration ---
// URL of your deployed worker. Update if you have a custom domain.
const workerUrl = 'https://hugo-ai-search-worker.lyk-boya.workers.dev';
// The path configured in your frontend JS (or directly if no routing)
const searchPath = '/api/ai-search'; // Adjust if different
// A sample query to test with
const testQuery = 'object centric learning';
// --- End Configuration ---

async function runTest() {
    console.log(`Sending test query "${testQuery}" to ${workerUrl}${searchPath}...`);

    try {
        const response = await fetch(`${workerUrl}${searchPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: testQuery }),
        });

        console.log(`Status Code: ${response.status}`);

        if (!response.ok) {
            let errorMsg = `Test failed with status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += `\nResponse Body: ${JSON.stringify(errorData, null, 2)}`;
            } catch (e) {
                errorMsg += `\nResponse Body (not JSON): ${await response.text()}`;
             }
            throw new Error(errorMsg);
        }

        const results = await response.json();

        console.log("\nTest successful! Received results:");
        console.log(JSON.stringify(results, null, 2)); // Pretty print the JSON results

        if (Array.isArray(results) && results.length > 0) {
            console.log("\n--- Sample Result --- (Check if structure is correct)");
            console.log(`Title: ${results[0].title}`);
            console.log(`Preview: ${results[0].preview}`);
            console.log(`Anchor Link: ${results[0].anchor_link}`);
            console.log(`Score: ${results[0].score}`);
            console.log("---------------------");
        } else if (Array.isArray(results) && results.length === 0) {
            console.log("\nReceived an empty result array, which might be okay depending on the query.")
        } else {
             console.warn("\nReceived response is not an array.");
        }

    } catch (error) {
        console.error('\nTest script error:', error);
        process.exitCode = 1;
    }
}

runTest(); 