// server/controllers/draftController.js
const { buildDraftPrompt } = require("../lib/prompts/buildDraftPrompt");
const { draftlyGenerate } = require("../lib/llm/draftly");

async function draftController(req, res) {
  try {
    const body = req.body || {};
    if (!body.docType) {
      return res.status(400).json({ error: "docType is required" });
    }

    // Build the prompt (stub for now)
    const prompt = buildDraftPrompt(body);

    // Call the LLM stub (returns fake contract sections)
    const draft = await draftlyGenerate(prompt);

    // Convert to a Buffer so we can “download” it
    const txt = (draft.sections || [])
      .map((s) => (s.heading ? s.heading + "\n" : "") + s.text)
      .join("\n\n");
    const buffer = Buffer.from(txt, "utf8");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${body.docType}-draft.docx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    return res.send(buffer);
  } catch (err) {
    console.error("[draftController] error:", err);
    res.status(500).json({ error: "Draft generation failed" });
  }
}

module.exports = { draftController };
