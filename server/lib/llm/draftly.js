// server/lib/llm/legalbeagle.js
async function draftlyGenerate(prompt) {
  // For now just stub with fake sections
  return {
    sections: [
      {
        heading: "CONFIDENTIALITY",
        text: "Recipient shall keep Discloser’s Confidential Information confidential.",
      },
      {
        heading: "GOVERNING LAW",
        text: "This Agreement is governed by the laws of Delaware.",
      },
    ],
  };
}

module.exports = { draftlyGenerate };
