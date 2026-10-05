// =====================================================
//  This file makes the chatbot work.
//  You do not need to edit it. Edit config.js instead.
// =====================================================

(function () {
  "use strict";

  const KEY_NAME = "aeroai_gemini_api_key";

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

  let history = [];     // the conversation sent to Gemini
  let isWaiting = false;

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

  function addBubble(kind, text) {
    const div = document.createElement("div");
    div.className = "bubble " + kind;
    if (kind === "user") div.textContent = text;       // plain text, always safe
    else div.innerHTML = formatText(text);             // escaped first, then formatted
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

  // ----- Talk to Gemini -----
  async function askGemini(apiKey) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(CONFIG.model) +
      ":generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CONFIG.systemInstructions }] },
        contents: history
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
      const reply = await askGemini(apiKey);
      thinking.remove();
      addBubble("bot", reply);
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
    } else if (getKey()) {
      // No new key pasted: just update the "remember" choice for the saved key
      saveKey(getKey(), rememberBox.checked);
    }
    // the dialog closes automatically after submit
  });

  // ----- Go! -----
  startChat();
})();
