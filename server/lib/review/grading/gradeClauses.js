// server/lib/review/grading/gradeClauses.js
async function gradeClauses(docType, candidates, sections) {
  const out = [];
  if ((candidates.confidentiality || []).length) {
    out.push({
      clauseType: "confidentiality",
      state: "PRESENT",
      confidence: 0.9,
      elements: ["Duty", "Purpose"],
      rationale: "stub",
    });
  } else {
    out.push({
      clauseType: "confidentiality",
      state: "MISSING",
      confidence: 0.9,
      elements: [],
      rationale: "stub",
    });
  }
  ["exceptions", "returnDestroy", "injunctiveRelief", "governingLaw"].forEach(
    (k) => {
      out.push({
        clauseType: k,
        state: "MISSING",
        confidence: 0.8,
        elements: [],
        rationale: "stub",
      });
    }
  );
  return out;
}
module.exports = { gradeClauses };
