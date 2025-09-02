// server/controllers/reviewController.js
const { extractTextSections } = require("../lib/review/sectioning/sectioning");
const { findCandidates } = require("../lib/review/embeddings/candidates");
const { gradeClauses } = require("../lib/review/grading/gradeClauses");
const { computeRisk } = require("../lib/review/scoring/computeRisk");
const { log, warn, error, truncate } = require("../lib/utils/logger");

async function reviewController(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const docType = req.body?.docType;
    if (!docType)
      return res.status(400).json({ error: "docType is required (e.g., NDA)" });

    const meta = {
      name: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
    };
    log(
      `[review] start | docType=${docType} | file=${meta.name} | mime=${meta.mime} | size=${meta.size}`
    );

    const buffer = req.file.buffer;
    const { sections } = await extractTextSections(buffer, {
      mimetype: meta.mime,
      originalname: meta.name,
    });
    log(
      `[review] sectioning | count=${sections.length} | first="${truncate(
        sections[0]?.heading || sections[0]?.text || ""
      )}"`
    );

    const candidates = await findCandidates(docType, sections);
    const candSummary = Object.entries(candidates)
      .map(([k, v]) => `${k}:${(v || []).length ? v[0].score.toFixed(2) : "0"}`)
      .join(", ");
    log(`[review] candidates | ${candSummary}`);

    const findings = await gradeClauses(docType, candidates, sections);

    const signal = findings.filter(
      (f) => f.state === "PRESENT" || f.state === "WEAK"
    ).length;
    if (signal === 0) {
      warn(`[review] abstain | no relevant clauses for ${docType}`);
      return res.json({
        risk: { score: 0, band: "UNKNOWN" },
        message: `This file doesn't appear to match ${docType} (no relevant clauses detected).`,
        findings,
        sectionsCount: sections.length,
      });
    }

    const risk = computeRisk(docType, findings);
    log(
      `[review] done | risk=${risk.band} ${risk.score} | presentOrWeak=${signal}`
    );

    return res.json({ risk, findings, sectionsCount: sections.length });
  } catch (e) {
    error(`[review] error | ${e?.message || e}`);
    return res.status(500).json({ error: "Review failed" });
  }
}

module.exports = { reviewController };
