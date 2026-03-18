// lib/clusterer.js
// Clusters tabs into topics using URL analysis, title TF-IDF, and parent chains

const clusterer = (() => {
  const STOP_WORDS = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
    "be", "has", "had", "have", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "can", "not", "no", "so", "if",
    "how", "what", "when", "where", "who", "which", "why", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such",
    "than", "too", "very", "just", "about", "above", "after", "again",
    "also", "any", "because", "been", "before", "being", "between",
    "into", "its", "new", "now", "only", "out", "own", "same", "then",
    "there", "these", "through", "under", "up", "us", "we", "you",
    "your", "my", "me", "i", "he", "she", "they", "them", "his", "her",
    // Web-specific stop words
    "http", "https", "www", "com", "org", "net", "html", "htm", "php",
    "page", "home", "index", "search", "result", "results", "view",
    "google", "youtube", "reddit", "wikipedia", "amazon", "facebook",
  ]);

  function tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  }

  function extractUrlTokens(url) {
    try {
      const u = new URL(url);
      const domain = u.hostname.replace("www.", "").split(".")[0];
      const pathTokens = u.pathname
        .split(/[/\-_]/)
        .filter((s) => s.length > 2)
        .map((s) => s.toLowerCase());
      const queryTokens = [...u.searchParams.values()]
        .flatMap((v) => v.split(/\s+/))
        .filter((s) => s.length > 2)
        .map((s) => s.toLowerCase());
      return [domain, ...pathTokens, ...queryTokens].filter((t) => !STOP_WORDS.has(t));
    } catch {
      return [];
    }
  }

  function getTabTokens(tabData) {
    const titleTokens = tokenize(tabData.title);
    const urlTokens = extractUrlTokens(tabData.url);
    // Title tokens weighted more (appear twice)
    return [...titleTokens, ...titleTokens, ...urlTokens];
  }

  function buildTfIdf(allTabTokens) {
    const docCount = Object.keys(allTabTokens).length;
    if (docCount === 0) return {};

    // Document frequency: how many tabs contain each token
    const df = {};
    for (const tokens of Object.values(allTabTokens)) {
      const unique = new Set(tokens);
      for (const t of unique) {
        df[t] = (df[t] || 0) + 1;
      }
    }

    // TF-IDF vectors per tab
    const vectors = {};
    for (const [tabId, tokens] of Object.entries(allTabTokens)) {
      const tf = {};
      for (const t of tokens) {
        tf[t] = (tf[t] || 0) + 1;
      }
      const vec = {};
      for (const [term, count] of Object.entries(tf)) {
        vec[term] = count * Math.log(docCount / (df[term] || 1));
      }
      vectors[tabId] = vec;
    }
    return vectors;
  }

  function cosineSimilarity(vecA, vecB) {
    const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dot = 0, magA = 0, magB = 0;
    for (const t of allTerms) {
      const a = vecA[t] || 0;
      const b = vecB[t] || 0;
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  function clusterTabs(allTabData, parentChainFn, threshold = 0.25) {
    const tabIds = Object.keys(allTabData).map(Number);
    if (tabIds.length === 0) return [];

    // Skip internal pages
    const validTabs = tabIds.filter((id) => {
      const url = allTabData[id]?.url || "";
      return url.startsWith("http");
    });

    if (validTabs.length === 0) return [];

    // Build token sets
    const allTokens = {};
    for (const id of validTabs) {
      allTokens[id] = getTabTokens(allTabData[id]);
    }

    // Build TF-IDF vectors
    const vectors = buildTfIdf(allTokens);

    // Build similarity matrix with parent chain boost
    const similarities = {};
    for (let i = 0; i < validTabs.length; i++) {
      for (let j = i + 1; j < validTabs.length; j++) {
        const a = validTabs[i], b = validTabs[j];
        let sim = cosineSimilarity(vectors[a] || {}, vectors[b] || {});

        // Boost similarity for parent-child relationships
        if (parentChainFn) {
          const chainA = parentChainFn(a);
          const chainB = parentChainFn(b);
          const shareParent = chainA.some((id) => chainB.includes(id));
          if (shareParent) sim = Math.min(1, sim + 0.3);
        }

        const key = `${a}-${b}`;
        similarities[key] = sim;
      }
    }

    // Agglomerative clustering (average linkage)
    let clusters = validTabs.map((id) => [id]);

    let merging = true;
    while (merging) {
      merging = false;
      let bestSim = threshold;
      let bestI = -1, bestJ = -1;

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          let totalSim = 0, count = 0;
          for (const a of clusters[i]) {
            for (const b of clusters[j]) {
              const key = a < b ? `${a}-${b}` : `${b}-${a}`;
              totalSim += similarities[key] || 0;
              count++;
            }
          }
          const avgSim = count > 0 ? totalSim / count : 0;
          if (avgSim > bestSim) {
            bestSim = avgSim;
            bestI = i;
            bestJ = j;
          }
        }
      }

      if (bestI !== -1) {
        clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]];
        clusters.splice(bestJ, 1);
        merging = true;
      }
    }

    // Name each cluster from top TF-IDF terms
    return clusters.map((tabIds) => {
      const merged = {};
      for (const id of tabIds) {
        for (const [term, score] of Object.entries(vectors[id] || {})) {
          merged[term] = (merged[term] || 0) + score;
        }
      }
      const topTerms = Object.entries(merged)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([term]) => term);
      const name = topTerms.length > 0
        ? topTerms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" / ")
        : "Uncategorized";
      return { name, tabIds };
    });
  }

  return { clusterTabs, tokenize, extractUrlTokens, cosineSimilarity };
})();
