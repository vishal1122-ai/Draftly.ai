// server/lib/review/grading/gradeClauses.js
const { gradeClause } = require("../../llm/openai");
const { log, warn, error, truncate } = require("../../utils/logger");

const ndaChecklists = {
  confidentiality: {
    requiredElements: [
      "Duty to keep information confidential",
      "Use limited to the stated purpose",
      "Internal sharing limited to need-to-know (optional)",
    ],
  },
  exceptions: {
    requiredElements: [
      "Public information",
      "Prior knowledge",
      "Independently developed (optional)",
      "Required by law",
    ],
  },
  returnDestroy: {
    requiredElements: [
      "Return or destroy upon request or termination",
      "Include copies/backups handling (optional)",
      "Certification of destruction (optional)",
    ],
  },
  injunctiveRelief: {
    requiredElements: [
      "Irreparable harm acknowledgement",
      "Right to equitable/injunctive relief",
      "Without posting bond (optional)",
    ],
  },
  governingLaw: { requiredElements: ["Identifies governing jurisdiction"] },
};
const CLAUSE_TYPES = [
  "confidentiality",
  "exceptions",
  "returnDestroy",
  "injunctiveRelief",
  "governingLaw",
];

// Replace your mapToState with this deterministic version
function mapToStateByElements(checklist, llm) {
  const required = checklist.requiredElements || [];
  const core = required.filter((e) => !/\(optional\)/i.test(e));
  const map = llm.elements_map || {};

  let coreTrue = 0;
  for (const e of core) {
    if (map[e] === true) coreTrue++;
  }

  if (core.length === 0)
    return {
      state: "PRESENT",
      confidence: Math.max(0.7, llm.confidence || 0.7),
    };
  if (coreTrue === core.length)
    return {
      state: "PRESENT",
      confidence: Math.max(0.7, llm.confidence || 0.7),
    };
  if (coreTrue >= 1)
    return { state: "WEAK", confidence: Math.max(0.6, llm.confidence || 0.6) };
  return { state: "MISSING", confidence: llm.confidence || 0.5 };
}

async function gradeClauses(docType, candidates, sections) {
  const checklists = ndaChecklists;
  const results = [];

  for (const clauseType of CLAUSE_TYPES) {
    const cand = (candidates[clauseType] || [])[0];

    if (!cand) {
      log(`[grade] ${clauseType}: no candidate ≥ threshold`);
      results.push({
        clauseType,
        state: "MISSING",
        confidence: 0.8,
        elements: [],
        rationale: "No candidate above threshold",
      });
      continue;
    }

    const text = (sections[cand.sectionIndex]?.text || "").slice(0, 4000);
    log(
      `[grade] ${clauseType}: section #${
        cand.sectionIndex
      } score=${cand.score?.toFixed?.(2)} | snippet="${truncate(text)}"`
    );

    try {
      const llm = await gradeClause({
        clauseType,
        text,
        checklist: checklists[clauseType] || { requiredElements: [] },
      });

      const mapped = mapToStateByElements(
        checklists[clauseType] || { requiredElements: [] },
        llm
      );
      log(
        `[grade] ${clauseType}: state=${
          mapped.state
        } conf=${mapped.confidence.toFixed(2)} present=${
          llm.elements_present.length
        }`
      );

      results.push({
        clauseType,
        state: mapped.state,
        confidence: mapped.confidence,
        elements: llm.elements_present || [],
        rationale: llm.rationale || `section#${cand.sectionIndex}`,
        snippet: truncate(text),
        sectionIndex: cand.sectionIndex,
      });
    } catch (e) {
      error(`[grade] ${clauseType}: LLM exception ${e?.message || e}`);
      results.push({
        clauseType,
        state: "WEAK",
        confidence: 0.6,
        elements: [],
        rationale: "LLM grading failed; heuristic candidate found",
        snippet: truncate(text),
        sectionIndex: cand.sectionIndex,
      });
    }
  }

  return results;
}

module.exports = { gradeClauses };
