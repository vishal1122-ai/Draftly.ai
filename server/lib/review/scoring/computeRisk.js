// server/lib/review/scoring/computeRisk.js
function computeRisk(docType, findings = []) {
  let score = 60;
  let presentOrWeak = 0;

  for (const f of findings) {
    if (f.confidence < 0.6) continue;
    if (f.state === "PRESENT") {
      score += 8;
      presentOrWeak++;
    } else if (f.state === "WEAK") {
      score += 4;
      presentOrWeak++;
    } else if (f.state === "MISSING") {
      score -= 12;
    }
  }

  const clamped = Math.max(0, Math.min(100, score));
  const band =
    clamped >= 75 && presentOrWeak >= 4
      ? "LOW"
      : clamped >= 50
      ? "MED"
      : "HIGH";
  return { score: clamped, band };
}
module.exports = { computeRisk };
