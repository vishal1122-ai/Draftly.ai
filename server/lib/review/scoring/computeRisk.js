// server/lib/review/scoring/computeRisk.js
function computeRisk(docType, findings) {
  let score = 50;
  for (const f of findings) {
    if (f.confidence < 0.6) continue;
    if (f.state === "PRESENT") score += 10;
    if (f.state === "WEAK") score += 5;
    if (f.state === "MISSING") score -= 10;
  }
  const normalized = Math.max(0, Math.min(100, score));
  const band = normalized >= 70 ? "LOW" : normalized >= 40 ? "MED" : "HIGH";
  return { score: normalized, band };
}
module.exports = { computeRisk };
