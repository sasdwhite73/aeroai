// =====================================================
//  This file makes the chatbot work.
//  You do not need to edit it. Edit config.js instead.
// =====================================================

(function () {
  "use strict";

  const KEY_NAME = "aeroai_gemini_api_key";
  const VECTOR_CACHE_NAME = "aeroai_note_vectors";
  const MAX_NOTE_CHARS = 1500;   // longer notes are split into parts
  const BATCH_SIZE = 50;         // max notes per embedding request
  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

  // ----- Grab page elements -----
  const messagesEl = document.getElementById("messages");
  const startersEl = document.getElementById("starters");
  const formEl = document.getElementById("chatForm");
  const inputEl = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const newChatBtn = document.getElementById("newChatBtn");
  const keyBtn = document.getElementById("keyBtn");
  const keyDialog = document.getElementById("keyDialog");
  const keyForm = document.getElementById("keyForm");
  const keyInput = document.getElementById("keyInput");
  const rememberBox = document.getElementById("rememberBox");
  const keyStatus = document.getElementById("keyStatus");
  const clearKeyBtn = document.getElementById("clearKeyBtn");
  const cancelKeyBtn = document.getElementById("cancelKeyBtn");
  const statusEl = document.getElementById("knowledgeStatus");

  let history = [];     // the conversation sent to Gemini (plain questions, no notes)
  let isWaiting = false;

  // Knowledge state
  let notes = [];            // [{ title, text, titleWords, wordCounts }]
  let vectors = null;        // array of embedding vectors (same order as notes), or null
  let loadCounter = 0;       // used to ignore results from an older load
  let loadPromise = Promise.resolve();

  // ----- Apply settings from config.js -----
  document.title = CONFIG.botName;
  document.getElementById("botName").textContent = CONFIG.botName;
  document.getElementById("botEmoji").textContent = CONFIG.botEmoji;
  document.getElementById("botTagline").textContent = CONFIG.tagline;
  document.documentElement.style.setProperty("--accent", CONFIG.themeColor);
  inputEl.placeholder = "Message " + CONFIG.botName + "…";

  // ----- Safe storage helpers (wrapped in try/catch) -----
  function getKey() {
    try {
      const s = sessionStorage.getItem(KEY_NAME);
      if (s) return s;
    } catch (e) { /* storage blocked */ }
    try {
      const l = localStorage.getItem(KEY_NAME);
      if (l) return l;
    } catch (e) { /* storage blocked */ }
    return "";
  }

  function saveKey(key, remember) {
    try { sessionStorage.setItem(KEY_NAME, key); } catch (e) { /* ignore */ }
    try {
      if (remember) localStorage.setItem(KEY_NAME, key);
      else localStorage.removeItem(KEY_NAME);
    } catch (e) { /* ignore */ }
  }

  function removeKey() {
    try { sessionStorage.removeItem(KEY_NAME); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(KEY_NAME); } catch (e) { /* ignore */ }
  }

  function keyIsRemembered() {
    try { return !!localStorage.getItem(KEY_NAME); } catch (e) { return false; }
  }

  // ----- Safe text formatting: escape HTML first, then add bold/lists -----
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inlineFormat(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function formatText(raw) {
    const lines = escapeHtml(raw).split("\n");
    let html = "";
    let listType = null;

    function closeList() {
      if (listType) { html += "</" + listType + ">"; listType = null; }
    }

    for (const line of lines) {
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet) {
        if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
        html += "<li>" + inlineFormat(bullet[1]) + "</li>";
      } else if (numbered) {
        if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; }
        html += "<li>" + inlineFormat(numbered[1]) + "</li>";
      } else {
        closeList();
        if (line.trim() !== "") html += "<p>" + inlineFormat(line) + "</p>";
      }
    }
    closeList();
    return html;
  }

  // ----- Chat bubbles -----
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addBubble(kind, text, sourceInfo) {
    const div = document.createElement("div");
    div.className = "bubble " + kind;
    if (kind === "user") div.textContent = text;       // plain text, always safe
    else div.innerHTML = formatText(text);             // escaped first, then formatted
    if (kind === "bot" && sourceInfo) div.appendChild(buildSources(sourceInfo));
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addThinking() {
    const div = document.createElement("div");
    div.className = "bubble bot thinking";
    div.setAttribute("aria-label", CONFIG.botName + " is thinking");
    div.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  // ----- "Sources" section under a reply (built with textContent, so it is safe) -----
  function buildSources(info) {
    const details = document.createElement("details");
    details.className = "sources";

    const summary = document.createElement("summary");
    summary.textContent = "Sources (" + info.results.length + ")";
    details.appendChild(summary);

    if (info.results.length === 0) {
      const none = document.createElement("p");
      none.className = "none";
      none.textContent = "No matching notes were found for this question.";
      details.appendChild(none);
      return details;
    }

    info.results.forEach(function (r, i) {
      const item = document.createElement("div");
      item.className = "source-item";

      const title = document.createElement("div");
      title.className = "source-title";
      title.textContent = "[" + (i + 1) + "] " + r.note.title;
      item.appendChild(title);

      const score = document.createElement("div");
      score.className = "source-score";
      score.textContent =
        (info.method === "meaning" ? "Meaning score: " : "Keyword score: ") + r.score.toFixed(2);
      item.appendChild(score);

      const snippet = document.createElement("p");
      snippet.className = "source-snippet";
      const t = r.note.text.replace(/\s+/g, " ").trim();
      snippet.textContent = t.length > 200 ? t.slice(0, 200) + "…" : t;
      item.appendChild(snippet);

      details.appendChild(item);
    });
    return details;
  }

  // ----- Status line under the header -----
  function setStatus(text, isWarning) {
    if (!CONFIG.useKnowledge) { statusEl.hidden = true; return; }
    statusEl.hidden = false;
    statusEl.textContent = text;
    statusEl.className = "knowledge-status" + (isWarning ? " warn" : "");
  }

  function readyStatus(method) {
    setStatus(
      "📚 " + notes.length + " note" + (notes.length === 1 ? "" : "s") + " loaded · " +
      (method === "meaning" ? "meaning search" : "keyword search")
    );
  }

  // ----- Starter buttons -----
  function showStarters() {
    startersEl.innerHTML = "";
    CONFIG.starterQuestions.forEach(function (q) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "starter-btn";
      btn.textContent = q;
      btn.addEventListener("click", function () { sendMessage(q); });
      startersEl.appendChild(btn);
    });
  }

  // ----- Start / restart a chat -----
  function startChat() {
    history = [];
    messagesEl.innerHTML = "";
    addBubble("bot", CONFIG.welcomeMessage);
    showStarters();
    inputEl.value = "";
    autoResize();
    inputEl.focus();
  }

  // ----- Friendly error messages -----
  function friendlyError(status) {
    if (status === 400 || status === 403) {
      return "Your API key doesn't seem to work. Click the “🔑 API key” button and check that you pasted it correctly.";
    }
    if (status === 404) {
      return "The AI model name wasn't found. Open config.js and check the “model” line.";
    }
    if (status === 429) {
      return "Too many requests right now (rate limit). Please wait a minute and try again.";
    }
    if (status >= 500) {
      return "Google's AI servers are having problems. Please try again in a little while.";
    }
    return "Something went wrong (error " + status + "). Please try again.";
  }

  // =====================================================
  //  KNOWLEDGE: reading notes
  // =====================================================

  // Split one long piece of text into pieces of at most MAX_NOTE_CHARS,
  // cutting at blank lines (and at spaces only if one paragraph is huge).
  function splitIntoParts(body) {
    if (body.length <= MAX_NOTE_CHARS) return [body];

    const paragraphs = body.split(/\n\s*\n/);
    const parts = [];
    let current = "";

    function pushCurrent() {
      if (current.trim()) parts.push(current.trim());
      current = "";
    }

    paragraphs.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      // A single paragraph that is too long: cut it at spaces
      while (p.length > MAX_NOTE_CHARS) {
        pushCurrent();
        let cut = p.lastIndexOf(" ", MAX_NOTE_CHARS);
        if (cut < MAX_NOTE_CHARS / 2) cut = MAX_NOTE_CHARS;
        parts.push(p.slice(0, cut).trim());
        p = p.slice(cut).trim();
      }
      if (!p) return;
      if (current && (current.length + p.length + 2) > MAX_NOTE_CHARS) pushCurrent();
      current += (current ? "\n\n" : "") + p;
    });
    pushCurrent();
    return parts;
  }

  // Turn the text of knowledge.md into a list of notes.
  // Everything above the first "## " line is ignored.
  function parseNotes(raw) {
    const lines = raw.replace(/\r\n?/g, "\n").split("\n");
    const found = [];
    let current = null;

    lines.forEach(function (line) {
      const m = line.match(/^##\s+(.+?)\s*$/);   // "## Title" (but not "### Title")
      if (m) {
        current = { title: m[1], lines: [] };
        found.push(current);
      } else if (current) {
        current.lines.push(line);
      }
    });

    const result = [];
    found.forEach(function (n) {
      const body = n.lines.join("\n").trim();
      if (!body) return;                          // skip empty notes
      const parts = splitIntoParts(body);
      parts.forEach(function (partText, i) {
        result.push({
          title: parts.length > 1 ? n.title + " (part " + (i + 1) + ")" : n.title,
          text: partText
        });
      });
    });
    return result;
  }

  // ----- Keyword search helpers -----
  const STOP_WORDS = new Set((
    "a an and are as at be but by can do does for from how i if in into is it its me my of on or " +
    "so than that the their them then there these they this to us was we what when where which who " +
    "why will with would you your about after also any been being both did get has have had just " +
    "more most not only other our out over should some such too very"
  ).split(" "));

  function tokenize(text) {
    const words = (text.toLowerCase().match(/[a-z0-9]+/g) || []);
    return words
      .filter(function (w) { return !STOP_WORDS.has(w); })
      .map(function (w) { return (w.length > 3 && w.endsWith("s")) ? w.slice(0, -1) : w; });
  }

  function prepareKeywordData(list) {
    list.forEach(function (n) {
      n.titleWords = new Set(tokenize(n.title));
      n.wordCounts = {};
      tokenize(n.text).forEach(function (w) {
        n.wordCounts[w] = (n.wordCounts[w] || 0) + 1;
      });
    });
  }

  function topK() {
    return Math.max(1, parseInt(CONFIG.topK, 10) || 3);
  }

  function keywordSearch(question) {
    const terms = Array.from(new Set(tokenize(question)));
    if (terms.length === 0) return [];

    const scored = notes.map(function (n) {
      let points = 0;
      terms.forEach(function (t) {
        if (n.titleWords.has(t)) points += 3;
        if (n.wordCounts[t]) points += Math.min(n.wordCounts[t], 3);
      });
      return { note: n, score: Math.min(1, points / (terms.length * 6)) };
    });

    return scored
      .filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, topK());
  }

  // =====================================================
  //  KNOWLEDGE: embeddings (search by meaning)
  // =====================================================

  // A short "fingerprint" of the file, so we only re-embed when it changes.
  function fingerprint(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16) + "-" + text.length;
  }

  // Send texts to Gemini and get one vector back for each (max 50 per request).
  async function embedTexts(texts, apiKey) {
    const url = API_BASE + encodeURIComponent(CONFIG.embeddingModel) + ":batchEmbedContents";
    const all = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          requests: batch.map(function (t) {
            return {
              model: "models/" + CONFIG.embeddingModel,
              content: { parts: [{ text: t }] }
            };
          })
        })
      });

      if (!response.ok) {
        const err = new Error("HTTP error");
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      if (!data.embeddings || data.embeddings.length !== batch.length) {
        throw new Error("Unexpected embedding response");
      }
      data.embeddings.forEach(function (e) {
        // Rounding keeps the saved copy smaller; search quality is unaffected.
        all.push(e.values.map(function (v) { return Number(v.toFixed(6)); }));
      });
    }
    return all;
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function readVectorCache(fp) {
    try {
      const saved = JSON.parse(localStorage.getItem(VECTOR_CACHE_NAME) || "null");
      if (saved && saved.fingerprint === fp && Array.isArray(saved.vectors)) return saved.vectors;
    } catch (e) { /* ignore */ }
    return null;
  }

  function writeVectorCache(fp, vecs) {
    try {
      localStorage.setItem(VECTOR_CACHE_NAME, JSON.stringify({ fingerprint: fp, vectors: vecs }));
    } catch (e) { /* storage full or blocked: we just re-embed next time */ }
  }

  function embeddingProblem(err) {
    if (err && err.status === 400 || err && err.status === 403) return "API key problem";
    if (err && err.status === 404) return "embedding model not found, check embeddingModel in config.js";
    if (err && err.status === 429) return "rate limit";
    if (err && err.status) return "error " + err.status;
    return "couldn't reach the embedding service";
  }

  // ----- Load knowledge.md (and build embeddings if needed) -----
  async function loadKnowledge() {
    if (!CONFIG.useKnowledge) { statusEl.hidden = true; return; }

    const myId = ++loadCounter;
    notes = [];
    vectors = null;
    setStatus("📚 Loading notes…");

    let raw;
    try {
      const response = await fetch(CONFIG.knowledgeFile, { cache: "no-cache" });
      if (!response.ok) throw new Error("not found");
      raw = await response.text();
    } catch (e) {
      if (myId !== loadCounter) return;
      setStatus("📚 Couldn't find " + CONFIG.knowledgeFile + ". Make sure it is in the same folder as index.html. Answering without notes.", true);
      return;
    }
    if (myId !== loadCounter) return;

    const parsed = parseNotes(raw);
    if (parsed.length === 0) {
      setStatus("📚 " + CONFIG.knowledgeFile + " has no notes. Start each note with a line like “## Note title”. Answering without notes.", true);
      return;
    }
    prepareKeywordData(parsed);
    notes = parsed;

    if (CONFIG.searchMethod !== "meaning") {
      readyStatus("keywords");
      return;
    }

    const apiKey = getKey();
    if (!apiKey) {
      setStatus("📚 " + notes.length + " notes loaded · add your API key to turn on meaning search (using keywords for now)", true);
      return;
    }

    setStatus("📚 " + notes.length + " notes loaded · building meaning search…");
    try {
      const fp = fingerprint(raw + "|" + CONFIG.embeddingModel);
      let vecs = readVectorCache(fp);
      if (!vecs || vecs.length !== notes.length) {
        const texts = notes.map(function (n) {
          return "title: " + n.title + " | text: " + n.text;
        });
        vecs = await embedTexts(texts, apiKey);
        writeVectorCache(fp, vecs);
      }
      if (myId !== loadCounter) return;
      vectors = vecs;
      readyStatus("meaning");
    } catch (err) {
      if (myId !== loadCounter) return;
      vectors = null;
      setStatus("📚 " + notes.length + " notes loaded · keyword search (meaning search failed: " + embeddingProblem(err) + ")", true);
    }
  }

  function startLoadingKnowledge() {
    loadPromise = loadKnowledge().catch(function () { /* handled inside */ });
  }

  // ----- Find the best notes for a question -----
  async function retrieveNotes(question, apiKey) {
    await loadPromise;                       // wait if notes are still loading
    if (!CONFIG.useKnowledge || notes.length === 0) return null;   // knowledge not active

    if (CONFIG.searchMethod === "meaning" && vectors) {
      try {
        const q = await embedTexts(["task: search result | query: " + question], apiKey);
        const scored = notes.map(function (n, i) {
          return { note: n, score: cosine(q[0], vectors[i]) };
        });
        scored.sort(function (a, b) { return b.score - a.score; });
        readyStatus("meaning");
        return { method: "meaning", results: scored.slice(0, topK()) };
      } catch (err) {
        setStatus("📚 " + notes.length + " notes loaded · keyword search (meaning search failed: " + embeddingProblem(err) + ")", true);
      }
    }
    return { method: "keywords", results: keywordSearch(question) };
  }

  // Build the message that goes to Gemini: numbered notes + the question.
  function buildPrompt(question, results) {
    let block = "NOTES from my knowledge file:\n\n";
    if (results.length === 0) {
      block += "(No matching notes were found.)\n\n";
    } else {
      results.forEach(function (r, i) {
        block += "[" + (i + 1) + "] " + r.note.title + "\n" + r.note.text + "\n\n";
      });
    }
    return block + "QUESTION: " + question;
  }

  // ----- Talk to Gemini -----
  async function askGemini(apiKey, retrieved) {
    const url =
      API_BASE +
      encodeURIComponent(CONFIG.model) +
      ":generateContent";

    let system = CONFIG.systemInstructions;
    let contents = history;

    if (retrieved) {
      system += "\n\n" + CONFIG.knowledgeRules;
      // Keep earlier turns as plain questions; only the newest one gets the notes.
      const last = history[history.length - 1];
      contents = history.slice(0, -1).concat([
        { role: "user", parts: [{ text: buildPrompt(last.parts[0].text, retrieved.results) }] }
      ]);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: contents
      })
    });

    if (!response.ok) {
      const err = new Error("HTTP error");
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const parts = (candidate && candidate.content && candidate.content.parts) || [];

    const text = parts
      .filter(function (p) { return !p.thought && typeof p.text === "string"; })
      .map(function (p) { return p.text; })
      .join("");

    if (!text) {
      if (data.promptFeedback && data.promptFeedback.blockReason) {
        return "I can't answer that one. Try rephrasing your question.";
      }
      return "I didn't get an answer back. Please try asking again.";
    }
    return text;
  }

  // ----- Send a message -----
  async function sendMessage(text) {
    text = (text || "").trim();
    if (!text || isWaiting) return;

    const apiKey = getKey();
    if (!apiKey) {
      inputEl.value = text;
      openKeyDialog("Please add your API key first, then press Send again.");
      return;
    }

    isWaiting = true;
    sendBtn.disabled = true;
    startersEl.innerHTML = "";
    addBubble("user", text);
    inputEl.value = "";
    autoResize();
    history.push({ role: "user", parts: [{ text: text }] });

    const thinking = addThinking();

    try {
      const retrieved = await retrieveNotes(text, apiKey);
      const reply = await askGemini(apiKey, retrieved);
      thinking.remove();
      addBubble("bot", reply, retrieved);
      history.push({ role: "model", parts: [{ text: reply }] });
    } catch (err) {
      thinking.remove();
      history.pop(); // remove the failed question so you can try again
      if (err && err.status) {
        addBubble("error", friendlyError(err.status));
      } else {
        addBubble("error", "Can't reach the internet. Check your connection and try again.");
      }
    } finally {
      isWaiting = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ----- Text box behavior -----
  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + "px";
  }

  inputEl.addEventListener("input", autoResize);

  inputEl.addEventListener("keydown", function (e) {
    // Enter sends, Shift+Enter makes a new line
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    sendMessage(inputEl.value);
  });

  newChatBtn.addEventListener("click", startChat);

  // ----- API key pop-up -----
  function openKeyDialog(message) {
    keyInput.value = "";
    rememberBox.checked = keyIsRemembered();
    if (message) keyStatus.textContent = message;
    else keyStatus.textContent = getKey() ? "A key is saved. Paste a new one to replace it." : "No key saved yet.";
    keyDialog.showModal();
    keyInput.focus();
  }

  keyBtn.addEventListener("click", function () { openKeyDialog(); });
  cancelKeyBtn.addEventListener("click", function () { keyDialog.close(); });

  clearKeyBtn.addEventListener("click", function () {
    removeKey();
    keyInput.value = "";
    rememberBox.checked = false;
    keyStatus.textContent = "Key removed.";
  });

  keyForm.addEventListener("submit", function () {
    const key = keyInput.value.trim();
    if (key) {
      saveKey(key, rememberBox.checked);
      startLoadingKnowledge();   // a new key: (re)build the meaning search
    } else if (getKey()) {
      // No new key pasted: just update the "remember" choice for the saved key
      saveKey(getKey(), rememberBox.checked);
    }
    // the dialog closes automatically after submit
  });

  // ----- Download the chat as a text file -----
  const downloadBtn = document.getElementById("downloadBtn");

  function downloadChat() {
    if (history.length === 0) {
      addBubble("error", "There's nothing to download yet. Ask " + CONFIG.botName + " a question first!");
      return;
    }

    const now = new Date();
    let text =
      CONFIG.botName + " conversation\n" +
      "Saved: " + now.toLocaleString() + "\n" +
      "=".repeat(40) + "\n\n";

    history.forEach(function (turn) {
      const who = turn.role === "user" ? "You" : CONFIG.botName;
      text += who + ":\n" + turn.parts[0].text + "\n\n" + "-".repeat(40) + "\n\n";
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = CONFIG.botName + "-chat-" + now.toLocaleDateString("en-CA") + ".txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  downloadBtn.addEventListener("click", downloadChat);

  // ----- Go! -----
  startChat();
  startLoadingKnowledge();
})();
