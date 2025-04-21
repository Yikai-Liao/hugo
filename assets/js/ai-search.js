document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('ai-search-form');
  const searchInput = document.getElementById('ai-search-input');
  const keywordResultsContainer = document.getElementById('keyword-search-results');
  const aiResultsContainer = document.getElementById('ai-search-results');
  const loadingIndicator = document.getElementById('ai-search-loading');
  const errorContainer = document.getElementById('ai-search-error');
  const keywordResultTitle = document.querySelector('#keyword-search-results')?.previousElementSibling; // Assumes H2 precedes UL
  const aiResultTitle = document.querySelector('#ai-search-results')?.previousElementSibling;      // Assumes H2 precedes UL

  // const aiWorkerUrl = '/api/ai-search'; // Original relative path
  const aiWorkerUrl = 'https://hugo-ai-search-worker.lyk-boya.workers.dev/api/ai-search'; // Use absolute URL

  // --- Keyword Search Specific --- 
  let keywordData = null; // Cache for keyword search data
  let keywordDataPromise = null; // To prevent multiple fetches
  const keywordJsonURL = searchForm?.dataset.json || 'index.json'; // Get URL from form or default
  const parser = new DOMParser();
  // --- End Keyword Search Specific ---

  if (!searchForm || !searchInput || !aiResultsContainer || !loadingIndicator || !errorContainer) {
    console.error('Core Search UI elements not found.');
    return;
  }
  if (!keywordResultsContainer) {
    console.warn('Keyword results container (#keyword-search-results) not found.');
  }
  if (!keywordJsonURL) {
      console.warn('Keyword search data URL (data-json attribute on form) not found.');
  }

  // --- Helper Functions (adapted from theme) ---
  const tagsToReplace = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '…': '&hellip;'
  };
  function replaceTag(tag) { return tagsToReplace[tag] || tag; }
  function escapeHTML(str) { return str.replace(/[&<>"']/g, replaceTag); }
  function escapeRegExp(string) { return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); }

  /** Processes search matches for preview generation (adapted from theme) */
  function processMatches(str, matches, ellipsis = true, charLimit = 140, offset = 20) {
      matches.sort((a, b) => a.start - b.start);
      let i = 0, lastIndex = 0, charCount = 0;
      const resultArray = [];
      while (i < matches.length) {
          const item = matches[i];
          if (ellipsis && item.start - offset > lastIndex) {
              resultArray.push(`${escapeHTML(str.substring(lastIndex, lastIndex + offset))} [...] `);
              resultArray.push(`${escapeHTML(str.substring(item.start - offset, item.start))}`);
              charCount += offset * 2;
          } else {
              resultArray.push(escapeHTML(str.substring(lastIndex, item.start)));
              charCount += item.start - lastIndex;
          }
          let j = i + 1, end = item.end;
          while (j < matches.length && matches[j].start <= end) {
              end = Math.max(matches[j].end, end);
              ++j;
          }
          resultArray.push(`<mark>${escapeHTML(str.substring(item.start, end))}</mark>`);
          charCount += end - item.start;
          i = j;
          lastIndex = end;
          if (ellipsis && charCount > charLimit) break;
      }
      if (lastIndex < str.length) {
          let end = str.length;
          if (ellipsis) end = Math.min(end, lastIndex + offset);
          resultArray.push(`${escapeHTML(str.substring(lastIndex, end))}`);
          if (ellipsis && end != str.length) {
              resultArray.push(` [...]`);
          }
      }
      return resultArray.join('');
  }
  // --- End Helper Functions ---

  /** Fetches and prepares keyword search data */
  async function getKeywordData() {
      if (keywordData) return keywordData;
      if (!keywordJsonURL) throw new Error("Keyword search data URL not configured.");

      // Use a promise to handle concurrent calls while fetching
      if (!keywordDataPromise) { 
          keywordDataPromise = fetch(keywordJsonURL)
              .then(res => {
                  if (!res.ok) throw new Error(`Failed to fetch keyword data: ${res.statusText}`);
                  return res.json();
              })
              .then(data => {
                  // Pre-process content: remove HTML tags
                  keywordData = data.map(item => ({
                      ...item,
                      plainContent: parser.parseFromString(item.content || '', 'text/html').body.innerText
                  }));
                  return keywordData;
              })
              .catch(err => {
                  keywordDataPromise = null; // Reset promise on error
                  console.error("Error fetching or processing keyword data:", err);
                  throw err; // Re-throw for caller handling
              });
      }
      return keywordDataPromise;
  }

  /** Performs keyword search (adapted from theme) */
  async function searchKeywords(queryTerms) {
      try {
          const data = await getKeywordData();
          const results = [];
          const uniqueTerms = queryTerms.filter(term => term.trim() !== '');
          if (uniqueTerms.length === 0) return results;

          const regex = new RegExp(uniqueTerms.map(escapeRegExp).join('|'), 'gi');

          for (const item of data) {
              const titleMatches = [];
              const contentMatches = [];
              let currentMatch;

              // Find matches in title
              while ((currentMatch = regex.exec(item.title)) !== null) {
                  titleMatches.push({ start: currentMatch.index, end: currentMatch.index + currentMatch[0].length });
                  // Prevent infinite loops with zero-width matches
                  if (currentMatch.index === regex.lastIndex) { regex.lastIndex++; }
              }
              regex.lastIndex = 0; // Reset regex state

              // Find matches in plain content
              while ((currentMatch = regex.exec(item.plainContent)) !== null) {
                  contentMatches.push({ start: currentMatch.index, end: currentMatch.index + currentMatch[0].length });
                  if (currentMatch.index === regex.lastIndex) { regex.lastIndex++; }
              }
              regex.lastIndex = 0;

              const totalMatchCount = titleMatches.length + contentMatches.length;
              if (totalMatchCount > 0) {
                  let processedTitle = item.title;
                  if (titleMatches.length > 0) {
                     processedTitle = processMatches(item.title, titleMatches, false);
                  }

                  let preview = '';
                  if (contentMatches.length > 0) {
                      preview = processMatches(item.plainContent, contentMatches);
                  } else {
                      preview = escapeHTML(item.plainContent.substring(0, 140));
                  }

                  results.push({
                      ...item,
                      title: processedTitle, // Title with highlights
                      preview: preview, // Content preview with highlights
                      matchCount: totalMatchCount
                  });
              }
          }

          // Sort results by match count
          return results.sort((a, b) => b.matchCount - a.matchCount);
      } catch (err) {
          console.error("Error during keyword search:", err);
          return []; // Return empty results on error
      }
  }

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();

    // Clear previous states
    if (keywordResultsContainer) keywordResultsContainer.innerHTML = '';
    if (keywordResultTitle) keywordResultTitle.textContent = ''; // Clear title
    aiResultsContainer.innerHTML = '';
    if (aiResultTitle) aiResultTitle.textContent = ''; // Clear title
    errorContainer.textContent = '';
    errorContainer.style.display = 'none';
    loadingIndicator.style.display = 'none';

    if (!query) {
      return;
    }

    const queryTerms = query.split(/\s+/); // Split query into terms for keyword search

    // --- 1. Execute Keyword Search (Client-side) ---
    if (keywordResultsContainer && keywordJsonURL) { // Only run if container and URL exist
        console.log("Executing keyword search...");
        const startTime = performance.now();
        searchKeywords(queryTerms)
            .then(keywordResults => {
                const endTime = performance.now();
                console.log(`Keyword search completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
                displayKeywordResults(keywordResults);
            })
            .catch(err => {
                // Error already logged in searchKeywords
                displayKeywordResults([]); // Display empty state on error
            });
    }
    // ---

    // --- 2. Execute AI Semantic Search (Server-side via Worker) ---
    console.log("Initiating AI semantic search...");
    if (aiResultTitle) aiResultTitle.textContent = '智能匹配结果'; // Set title early
    loadingIndicator.style.display = 'block';
    aiResultsContainer.innerHTML = '';

    fetch(aiWorkerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query }),
    })
    .then(async response => {
        if (!response.ok) {
            let errorMsg = `AI Search failed (${response.status})`;
            try {
                const errorData = await response.json();
                errorMsg += `: ${errorData.error || errorData.details || 'Unknown worker error'}`;
            } catch (e) { /* Ignore */ }
            throw new Error(errorMsg);
        }
        return response.json();
    })
    .then(aiResults => {
        console.log("AI search completed.");
        displayAiResults(aiResults);
    })
    .catch(error => {
        console.error('AI Search fetch error:', error);
        errorContainer.textContent = `AI Search Error: ${error.message}.`;
        errorContainer.style.display = 'block';
        aiResultsContainer.innerHTML = '';
    })
    .finally(() => {
        loadingIndicator.style.display = 'none';
    });
    // ---
  });

  // --- Result Display Functions ---
  function displayKeywordResults(results) {
    if (!keywordResultsContainer) return;
    if (keywordResultTitle) keywordResultTitle.textContent = `关键词匹配结果 (${results.length})`;

    if (!results || results.length === 0) {
      keywordResultsContainer.innerHTML = '<li>无关键词匹配结果。</li>';
      return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach(result => {
      const li = document.createElement('li');
      li.className = 'keyword-result-item article-list--compact__item'; // Use theme class

      const a = document.createElement('a');
      a.href = result.permalink;
      a.className = 'article-list--compact__link'; // Use theme class
      
      // Create title element and set innerHTML to allow <mark>
      const titleSpan = document.createElement('span');
      titleSpan.className = 'article-list--compact__title';
      titleSpan.innerHTML = result.title; // Title already has <mark>
      a.appendChild(titleSpan);

      // Create preview element and set innerHTML
      const p = document.createElement('p');
      p.className = 'article-list--compact__summary'; // Use theme class
      p.innerHTML = result.preview; // Preview already has <mark> and [...] 

      li.appendChild(a);
      li.appendChild(p);
      fragment.appendChild(li);
    });
    keywordResultsContainer.appendChild(fragment);
  }

  function displayAiResults(results) {
    if (aiResultTitle) aiResultTitle.textContent = `智能匹配结果 (${results.length})`;
    
    if (!results || results.length === 0) {
      aiResultsContainer.innerHTML = '<li>无相关段落。</li>';
      return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach(result => {
      const li = document.createElement('li');
      li.className = 'ai-result-item article-list--compact__item'; // Use similar theme class

      const a = document.createElement('a');
      a.href = result.anchor_link;
      a.className = 'article-list--compact__link';
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'article-list--compact__title';
      titleSpan.textContent = result.title;
      a.appendChild(titleSpan);

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'ai-result-score'; // Keep specific class for score
      scoreSpan.textContent = ` (相关度: ${result.score.toFixed(3)})`;
      a.appendChild(scoreSpan);

      const p = document.createElement('p');
      p.className = 'article-list--compact__summary';
      p.textContent = result.preview ? `...${escapeHTML(result.preview)}...` : ''; // Escape preview

      li.appendChild(a);
      li.appendChild(p);
      fragment.appendChild(li);
    });
    aiResultsContainer.appendChild(fragment);
  }
  // ---
});
