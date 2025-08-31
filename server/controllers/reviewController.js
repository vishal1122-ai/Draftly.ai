// server/controllers/reviewController.js
const { extractTextSections } = require("../lib/review/sectioning/sectioning");
const { findCandidates } = require("../lib/review/embeddings/candidates");
const { gradeClauses } = require("../lib/review/grading/gradeClauses");
const { computeRisk } = require("../lib/review/scoring/computeRisk");

async function reviewController(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const docType = req.body?.docType || "NDA";
    const buffer = req.file.buffer;
    const meta = {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    };

    const { sections } = await extractTextSections(buffer, meta);
    const candidates = await findCandidates(docType, sections);
    const findings = await gradeClauses(docType, candidates, sections);
    const risk = computeRisk(docType, findings);

    return res.json({ risk, findings, sectionsCount: sections.length });
  } catch (e) {
    console.error("[reviewController] error", e);
    return res.status(500).json({ error: "Review failed" });
  }
}

module.exports = { reviewController };
