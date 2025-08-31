// server/lib/review/embeddings/candidates.js
async function findCandidates(docType, sections) {
  // MVP stub: pretend the first section is a good match for confidentiality
  return {
    confidentiality: [{ sectionIndex: 0, score: 0.9 }],
    exceptions: [],
    returnDestroy: [],
    injunctiveRelief: [],
    governingLaw: [],
  };
}
module.exports = { findCandidates };
