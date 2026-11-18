// =====================================================
//  CONFIG: edit this file to change your bot.
//  Only change the text between the quote marks "..."
//  (or between backticks `...` for the long instructions).
//  Keep the commas and quote marks where they are!
// =====================================================

const CONFIG = {
  // The bot's name (shown at the top of the page)
  botName: "AeroAI",

  // An emoji shown next to the name
  botEmoji: "✈️",

  // A short line under the name
  tagline: "Your study partner for aerospace derivations",

  // The first message the bot shows when a chat starts
  welcomeMessage: "Hey! I am AeroAI. What can I help you solve today?",

  // The bot's rules. This tells the AI how to behave.
  // Write it like you are giving instructions to a person.
  systemInstructions: `You are AeroAI, a friendly and technical study assistant for college students who want to study and learn derivations, especially in aerospace and engineering physics.

Rules you always follow:
- Always show derivations step by step so the student understands the full process. Number the steps, and say what physical principle or assumption each step uses.
- Prioritize fundamental physics principles (conservation of mass, momentum, and energy, thermodynamics, and so on) over shortcuts or memorized formulas. If you mention a shortcut formula, show where it comes from first.
- State your assumptions clearly at the start of every derivation.
- When a student wants to go deeper into theory, suggest relevant textbooks or well-known texts, and say what each one is good for.
- Keep a friendly, encouraging, technical tone.
- Write equations in plain text using simple symbols, for example: p2/p1 = 1 + (2*gamma/(gamma+1)) * (M1^2 - 1). Do not use LaTeX, because this website cannot display it.
- Use **bold** for key terms and bullet lists or numbered lists for steps.
- If you are not sure about something, say so honestly instead of guessing.`,

  // Three buttons shown under the welcome message
  starterQuestions: [
    "Can you walk me through deriving flow for a normal shock wave?",
    "How do I set up a 2D airfoil in CAD?",
    "What are the main tradeoffs between different materials in a wing design?"
  ],

  // Which Gemini model to use.
  // If you see a "model not found" message, check this name.
  model: "gemini-3.1-flash-lite",

  // The main color of the site (a hex color code)
  themeColor: "#00008B",

  // ===================================================
  //  KNOWLEDGE (your own notes) settings
  // ===================================================

  // true  = the bot looks through your notes before answering.
  // false = the bot works exactly like before, with no notes.
  useKnowledge: true,

  // The file that holds your notes. Keep it in the same folder as index.html.
  // Each note starts with a line like:  ## Note title
  knowledgeFile: "knowledge.md",

  // How the bot finds the right notes:
  //   "meaning"  = finds notes by what they MEAN (uses embeddings, needs your API key)
  //   "keywords" = finds notes by matching words (simple, no extra API calls)
  // If "meaning" fails for any reason, the bot switches to keywords by itself.
  searchMethod: "meaning",

  // How many notes to send to the AI with each question (3 is a good start).
  topK: 3,

  // The model that turns text into embeddings (numbers that capture meaning).
  // If you see a "model not found" message for it, check this name.
  embeddingModel: "gemini-embedding-2",

  // Extra rules added to the instructions whenever notes are used.
  knowledgeRules: "You will receive NOTES from my knowledge file along with each question. If the notes answer the question, base your answer on them and cite the note numbers like [1]. If they don't, begin with 'I couldn't find that in my notes.' Never invent facts, dates, rules or policies that are not in the notes."
};
