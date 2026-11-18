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
  const downloadBtn = document.getElementById("downloadBtn");
  const modeSelect = document.getElementById("modeSelect");
  const aboutBtn = document.getElementById("aboutBtn");
  const aboutDialog = document.getElementById("aboutDialog");
  const aboutBody = document.getElementById("aboutBody");
  const closeAboutBtn = document.getElementById("closeAboutBtn");

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
      const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
      const rule = line.match(/^\s*(-{3,}|\*{3,})\s*$/);
      const equation = line.match(/^\s*`([^`]+)`\s*$/);
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*(\d+)[.)]\s+(.*
