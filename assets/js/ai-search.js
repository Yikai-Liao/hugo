document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('ai-search-form');
  const searchInput = document.getElementById('ai-search-input');
  const unifiedResultsContainer = document.getElementById('search-results');
  const loadingIndicator = document.getElementById('ai-search-loading');
  const errorContainer = document.getElementById('ai-search-error');

  // const aiWorkerUrl = '/api/ai-search'; // Original relative path
  const aiWorkerUrl = 'https://hugo-ai-search-worker.lyk-boya.workers.dev/api/ai-search'; // Use absolute URL

  // --- Keyword Search Specific --- 
  let keywordData = null; // Cache for keyword search data
  let keywordDataPromise = null; // To prevent multiple fetches
  const keywordJsonURL = searchForm?.dataset.json || 'index.json'; // Get URL from form or default
  const parser = new DOMParser();
  // --- End Keyword Search Specific ---

  if (!searchForm || !searchInput || !unifiedResultsContainer || !loadingIndicator || !errorContainer) {
    console.error('Core Search UI elements not found.');
    return;
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
                  return res.text(); // Get raw text to handle NDJSON
              })
              .then(data => {
                  try {
                      let allObjects = [];
                      if (data.trim().startsWith('[')) {
                          // JSON array
                          allObjects = JSON.parse(data);
                      } else {
                          // NDJSON
                          const lines = data.split('\n').filter(line => line.trim().length > 0);
                          allObjects = lines.map(line => {
                              try { return JSON.parse(line); } catch (e) { return null; }
                          });
                      }
                      const parsedData = allObjects.filter(item => item && typeof item.title === 'string' && typeof item.content === 'string');
                      keywordData = parsedData;
                  } catch (parseError) {
                      console.error("Error parsing keyword data string:", parseError, "\nRaw data string:", data);
                      throw new Error("Failed to parse keyword data.");
                  }
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

          console.log("[DEBUG] Starting keyword search loop with terms:", uniqueTerms, "and regex:", regex); // DEBUG
          for (const item of data) {
              // DEBUG: Log the types of title and content for the first few items BEFORE the check
              if (item && typeof item === 'object' && item !== null) { // Basic check to avoid errors on non-objects
                  if (data.indexOf(item) < 5) { // Log only for first 5 items
                      console.log(`[DEBUG] Item ${data.indexOf(item)} types: typeof title = ${typeof item.title}, typeof content = ${typeof item.content}`);
                  }
              } else if (data.indexOf(item) < 5) {
                   console.log(`[DEBUG] Item ${data.indexOf(item)} is not a valid object:`, item);
              }

              // Only process items that actually have both title and content properties
              if (item && typeof item.title === 'string' && typeof item.content === 'string') {
                  // Log the item being processed (optional, can be removed later)
                  console.log(`[DEBUG] Processing item: Title = "${item.title.substring(0, 50)}...", Content = "${item.content.substring(0, 100)}..."`);
                  
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
                  while ((currentMatch = regex.exec(item.content)) !== null) {
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
                          preview = processMatches(item.content, contentMatches);
                      } else {
                          preview = escapeHTML(item.content.substring(0, 140));
                      }

                      results.push({
                          ...item,
                          title: processedTitle, // Title with highlights (already has content)
                          preview: preview, // Content preview with highlights
                          matchCount: totalMatchCount
                      });
                  } else {
                      // Log skipped items (optional)
                      // console.log("[DEBUG] Skipping item without title/content strings:", item);
                  }
              }
          }

          // Sort results by match count
          console.log(`Keyword search found ${results.length} matches. First match:`, results.length > 0 ? results[0] : 'None'); // DEBUG: Log results
          return results.sort((a, b) => b.matchCount - a.matchCount);
      } catch (err) {
          console.error("Error during keyword search:", err);
          return []; // Return empty results on error
      }
  }

  // --- 融合检索逻辑 ---
  let aiResultsGlobal = null;
  let keywordResultsGlobal = null;
  let aiDone = false;
  let keywordDone = false;

  // 统一获取结果 key（优先 permalink，否则 anchor_link，取 path，去除锚点、参数、末尾斜杠）
  function getResultKey(item) {
    const link = item.permalink || item.anchor_link || item.url || '';
    let path = link;
    try {
      if (link.startsWith('http')) {
        path = new URL(link).pathname;
      } else if (link.startsWith('//')) {
        path = new URL('http:' + link).pathname;
      } else if (link.startsWith('/')) {
        path = link;
      }
    } catch (e) {
      path = link;
    }
    // 去除 baseURL 前缀
    const base = document.querySelector('base')?.href || '/';
    const basePath = new URL(base, window.location.origin).pathname.replace(/\/$/, '');
    if (basePath !== '' && path.startsWith(basePath)) {
      path = path.slice(basePath.length);
      if (!path.startsWith('/')) path = '/' + path;
    }
    // 去除锚点、参数、末尾斜杠
    return path.replace(/[#?].*$/, '').replace(/\/$/, '');
  }

  // Function to merge AI and Keyword results, remove duplicates, and display
  function mergeAndDisplayResults() {
      if (!aiDone || !keywordDone) {
          // console.log("Waiting for both searches to complete..."); // DEBUG
          return; // Wait for both searches to finish
      }

      console.log("[Merge Debug] Entering mergeAndDisplayResults.");
      console.log("[Merge Debug] AI Done:", aiDone, "Keyword Done:", keywordDone);
      console.log("[Merge Debug] Raw AI Results:", JSON.stringify(aiResultsGlobal));
      console.log("[Merge Debug] Raw Keyword Results:", JSON.stringify(keywordResultsGlobal));

      loadingIndicator.style.display = 'none';
      errorContainer.style.display = 'none';
      unifiedResultsContainer.innerHTML = '';

      let combinedResults = [];
      const seenKeys = new Set();
      const resultsMap = new Map(); // Use a map to easily update items

      console.log("[Merge Debug] Processing AI results...");
      if (Array.isArray(aiResultsGlobal)) {
          aiResultsGlobal.forEach((item, index) => {
              const key = getResultKey(item);
              console.log(`[Merge Debug] AI Item ${index}: Key='${key}', Seen=${seenKeys.has(key)}`);
              if (!seenKeys.has(key)) {
                  const aiItem = { ...item, type: 'ai' };
                  combinedResults.push(aiItem); // Preserve AI order
                  seenKeys.add(key);
                  resultsMap.set(key, aiItem); // Store for potential update
              } else {
                  console.log(`[Merge Debug] Duplicate key found and skipped (AI pass): ${key}`);
              }
          });
      }

      console.log("[Merge Debug] Processing Keyword results...");
      if (Array.isArray(keywordResultsGlobal)) {
          keywordResultsGlobal.forEach((item, index) => {
              const key = getResultKey(item);
              console.log(`[Merge Debug] Keyword Item ${index}: Key='${key}', Seen=${seenKeys.has(key)}`);
              if (seenKeys.has(key)) {
                  // Already exists (from AI), check if keyword version has highlighted preview/title
                  const existingItem = resultsMap.get(key);
                  const hasHighlightPreview = item.preview && item.preview.includes('<mark>');
                  const hasHighlightTitle = item.title && item.title.includes('<mark>');

                  if (existingItem && (hasHighlightPreview || hasHighlightTitle) ) {
                      console.log(`[Merge Debug] Updating item for key ${key} with highlighted keyword content.`);
                      if (hasHighlightPreview) {
                          existingItem.preview = item.preview; // Update preview
                      }
                      if (hasHighlightTitle) {
                         existingItem.title = item.title; // Update title
                      }
                      // Keep original AI score if needed, or decide which score to keep.
                      // For simplicity, let's mark its type as keyword because we prioritized its content.
                      existingItem.type = 'keyword'; 
                  } else {
                      console.log(`[Merge Debug] Duplicate key ${key} found, but keyword version has no highlights. Keeping AI version.`);
                  }
              } else {
                  // New item only found in keyword search
                  console.log(`[Merge Debug] Adding keyword-only item for key ${key}.`);
                  const keywordItem = { ...item, type: 'keyword' };
                  combinedResults.push(keywordItem); // Append to the end
                  seenKeys.add(key);
                  // Optionally add to map if needed later: resultsMap.set(key, keywordItem);
              }
          });
      }

      console.log(`[Merge Debug] Final combined results count: ${combinedResults.length}`);
      console.log("[Merge Debug] Combined Results (before display):", JSON.stringify(combinedResults));

      displayUnifiedResults(combinedResults);
  }

  function displayUnifiedResults(results) {
    if (!unifiedResultsContainer) return;
    unifiedResultsContainer.innerHTML = '';
    if (!results || results.length === 0) {
      unifiedResultsContainer.innerHTML = '<li>无相关结果。</li>';
      return;
    }
    const fragment = document.createDocumentFragment();
    results.forEach(result => {
      const li = document.createElement('li');
      li.className = 'search-result-item article-list--compact__item';

      const a = document.createElement('a');
      const base = document.querySelector('base')?.href || '/';
      let href = result.permalink || result.anchor_link || result.url; // Use url as fallback
      if (href && !href.startsWith('http')) {
        href = base.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href);
      }
      a.href = href || '#'; // Add fallback href
      a.className = 'article-list--compact__link';

      // 标题
      const titleSpan = document.createElement('span');
      titleSpan.className = 'article-list--compact__title';

      // Use result title directly first
      let displayTitle = result.title || "Untitled";
      let useTitleHTML = false;

      // Check type for highlighting
      if (result.type === 'keyword' && displayTitle.includes('<mark>')) {
          useTitleHTML = true;
      }

      if (useTitleHTML) {
         titleSpan.innerHTML = displayTitle;
      } else {
         titleSpan.textContent = displayTitle;
      }

      // Add AI brain icon if it's an AI result
      if (result.type === 'ai') {
        const brainIcon = document.createElement('img');
        brainIcon.className = 'ai-brain-icon';
        brainIcon.alt = 'AI';
        brainIcon.src = base.replace(/\/$/, '') + '/icons/brain.svg';
        titleSpan.prepend(brainIcon); // Prepend icon to title span
      }
      a.appendChild(titleSpan); // Add title to link

      // 摘要/预览 (Add inside the link)
      const p = document.createElement('p');
      p.className = 'article-list--compact__summary';
      let previewText = '';
      let usePreviewHTML = false;

      if (result.type === 'keyword' && result.preview) {
        // Keyword search provides a pre-generated preview with highlights
        previewText = result.preview;
        if (previewText.includes('<mark>')) {
            usePreviewHTML = true;
        }
      } else if (result.type === 'ai') {
        // AI search: find content from local keywordData
        const key = getResultKey(result);
        const localData = keywordData?.find(item => getResultKey(item) === key);
        if (localData && localData.content) {
          // Generate preview from local content
          const fullContent = localData.content;
          previewText = fullContent.substring(0, 140); // Extract first 140 chars
          if (fullContent.length > 140) {
            previewText += '...'; // Add ellipsis if content was longer
          }
        } else {
          console.warn(`[Display Preview] Could not find local content for AI result key: ${key}`);
          previewText = '...'; // Fallback if local content not found
        }
      } else if (result.preview) { // Fallback for other types (should not happen often)
        previewText = result.preview;
      }
      // Note: We don't use result.content directly anymore unless it's from localData for AI results

      // Set the preview text (using innerHTML only if needed for keyword marks)
      if (usePreviewHTML) {
        p.innerHTML = previewText;
      } else {
        p.textContent = previewText;
      }

      // Only append paragraph if it has content
      if (previewText) {
        a.appendChild(p); // Append preview paragraph inside the link
      }

      li.appendChild(a); // Add the complete link (with title and preview) to the list item
      fragment.appendChild(li);
    });
    unifiedResultsContainer.appendChild(fragment);
  }

  // --- 重写表单提交逻辑 ---
  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    // 清空状态
    unifiedResultsContainer.innerHTML = '';
    errorContainer.textContent = '';
    errorContainer.style.display = 'none';
    loadingIndicator.style.display = 'none';
    aiResultsGlobal = null;
    keywordResultsGlobal = null;
    aiDone = false;
    keywordDone = false;
    if (!query) return;
    const queryTerms = query.split(/\s+/);
    // 规则检索
    (async () => {
      try {
        const keywordResults = await searchKeywords(queryTerms);
        keywordResultsGlobal = keywordResults;
        keywordDone = true;
        if (aiDone) {
          mergeAndDisplayResults();
        } else {
          displayUnifiedResults(keywordResults);
        }
      } catch (err) {
        keywordResultsGlobal = [];
        keywordDone = true;
        if (aiDone) {
          mergeAndDisplayResults();
        }
      }
    })();
    // AI 检索
    (async () => {
      try {
        loadingIndicator.style.display = 'block';
        const currentLang = document.documentElement.lang || 'en';
        const urlWithLang = `${aiWorkerUrl}?lang=${currentLang}`;
        const response = await fetch(urlWithLang, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query }),
        });
        if (!response.ok) {
          let errorMsg = `AI Search failed (${response.status})`;
          try {
            const errorData = await response.json();
            errorMsg += `: ${errorData.error || errorData.details || 'Unknown worker error'}`;
          } catch (e) { /* Ignore */ }
          throw new Error(errorMsg);
        }
        const aiResults = await response.json();
        aiResultsGlobal = aiResults;
        aiDone = true;
        loadingIndicator.style.display = 'none';
        if (keywordDone) {
          mergeAndDisplayResults();
        } else {
          displayUnifiedResults(aiResults);
        }
      } catch (error) {
        aiResultsGlobal = [];
        aiDone = true;
        loadingIndicator.style.display = 'none';
        errorContainer.textContent = `AI Search Error: ${error.message}.`;
        errorContainer.style.display = 'block';
        if (keywordDone) {
          mergeAndDisplayResults();
        }
      }
    })();
  });
});