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

function mapToState(clauseType, checklist, llm) {
  const required = checklist.requiredElements || [];
  const core = required.filter((e) => !/\(optional\)/i.test(e));
  const presentLower = (llm.elements_present || []).map((s) => s.toLowerCase());
  let coreHits = 0;
  for (const e of core) {
    if (
      presentLower.some((x) =>
        x.includes(
          e
            .toLowerCase()
            .replace(/\(optional\)/i, "")
            .trim()
        )
      )
    ) {
      coreHits++;
    }
  }
  if (!llm.is_match)
    return { state: "MISSING", confidence: llm.confidence || 0.5 };
  if (coreHits >= Math.max(1, core.length - 0)) {
    return { state: "PRESENT", confidence: Math.max(0.7, llm.confidence) };
  }
  return { state: "WEAK", confidence: Math.max(0.6, llm.confidence) };
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

      const mapped = mapToState(
        clauseType,
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
        rationale:
          llm.rationale ||
          `Matched section #${cand.sectionIndex} (score=${cand.score?.toFixed?.(
            2
          )})`,
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
