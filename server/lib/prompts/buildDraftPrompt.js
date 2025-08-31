// server/lib/prompts/buildDraftPrompt.js
function buildDraftPrompt(input) {
  return {
    system:
      "You are a contracts generator. Use only provided clause keys. Enforce numbering and defined terms. No markdown.",
    user: JSON.stringify(input),
  };
}

module.exports = { buildDraftPrompt };
