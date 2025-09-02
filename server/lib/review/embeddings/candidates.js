// server/lib/review/embeddings/candidates.js
/**
 * Heuristic candidate finder for NDA clauses.
 * Scores each section by heading + keyword hits and returns top matches.
 * (We’ll add embeddings later; this gets you useful signal now.)
 */

const CLAUSE_TYPES = [
  "confidentiality",
  "exceptions",
  "returnDestroy",
  "injunctiveRelief",
  "governingLaw",
];

const PATTERNS = {
  confidentiality: {
    heading: [/confidential/i, /non[-\s]?disclosure/i],
    mustAny: [/confidential/i, /non[-\s]?disclosure/i],
    should: [
      /use.*solely|purpose/i,
      /third[-\s]?part(y|ies)/i,
      /discloser|recipient/i,
    ],
  },
  exceptions: {
    heading: [/exception/i, /exclusion/i],
    mustAny: [
      /public/i,
      /already\s+known|prior\s+knowledge/i,
      /required\s+by\s+law|legal/i,
    ],
    should: [/independent(ly)?\s+develop(ed)?/i],
  },
  returnDestroy: {
    heading: [/return/i, /destroy/i, /return\s+and\s+destr(oy|uction)/i],
    mustAny: [/return/i, /destroy/i],
    should: [
      /upon\s+(request|termination)/i,
      /copies|materials|documents/i,
      /certif(y|ication)/i,
    ],
  },
  injunctiveRelief: {
    heading: [/injunctive/i, /equitable/i, /specific\s+performance/i],
    mustAny: [/irreparable\s+harm/i, /injunctive|equitable/i],
    should: [/without\s+posting\s+bond/i],
  },
  governingLaw: {
    heading: [
      /governing\s+law/i,
      /choice\s+of\s+law/i,
      /applicable\s+law/i,
      /jurisdiction/i,
    ],
    mustAny: [/law/i, /jurisdiction/i, /state\s+of|laws\s+of/i],
    should: [],
  },
};

const HEADING_BONUS = 2.0;
const MUST_HIT = 2.0; // each "mustAny" regex hit
const SHOULD_HIT = 0.5; // each "should" regex hit
const MIN_SCORE = 2.2; // threshold to consider a candidate (tune as needed)
const TOP_K = 1; // keep top 1 per clause for now

function scoreSectionForClause(text, heading, clausePattern) {
  let score = 0;

  // heading bonus
  if (heading) {
    for (const hx of clausePattern.heading) {
      if (hx.test(heading)) {
        score += HEADING_BONUS;
        break;
      }
    }
  }

  // mustAny: count distinct hits (cap at 2 for diminishing returns)
  let mustHits = 0;
  for (const rx of clausePattern.mustAny) {
    if (rx.test(text)) mustHits++;
  }
  score += MUST_HIT * Math.min(2, mustHits);

  // should: small boosters
  let shouldHits = 0;
  for (const rx of clausePattern.should) {
    if (rx.test(text)) shouldHits++;
  }
  score += SHOULD_HIT * shouldHits;

  return score;
}

function normalize(s) {
  return (s || "").toString().replace(/\r\n/g, "\n");
}

async function findCandidates(docType, sections) {
  // For now we only tune NDA; other docTypes can reuse until we add their patterns.
  const out = Object.fromEntries(CLAUSE_TYPES.map((k) => [k, []]));

  const arr = Array.isArray(sections) ? sections : [];
  for (let i = 0; i < arr.length; i++) {
    const sec = arr[i];
    const text = normalize(sec.text);
    const heading = normalize(sec.heading || "");

    for (const clauseType of CLAUSE_TYPES) {
      const pattern = PATTERNS[clauseType];
      const score = scoreSectionForClause(text, heading, pattern);
      if (score >= MIN_SCORE) {
        out[clauseType].push({
          sectionIndex: i,
          score,
          heading,
          snippet: text.slice(0, 280), // small preview
        });
      }
    }
  }

  // Keep top K per clause
  for (const clauseType of CLAUSE_TYPES) {
    out[clauseType].sort((a, b) => b.score - a.score);
    out[clauseType] = out[clauseType].slice(0, TOP_K);
  }

  return out;
}

module.exports = { findCandidates };
