// server/lib/llm/openai.js
const OpenAI = require("openai");
const { log, warn, error, truncate } = require("../utils/logger");

// Lazy init so .env is loaded first
let _client, _mode, _base;
function getClient() {
  if (_client) return _client;

  const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
  if (useOpenRouter) {
    _mode = "OpenRouter";
    _base = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    _client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: _base,
      defaultHeaders: {
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": "Draftly (dev)",
      },
    });
  } else {
    _mode = "OpenAI";
    _base = "https://api.openai.com/v1";
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  log(`[llm] client initialized | mode=${_mode} base=${_base}`);
  return _client;
}

async function chatJSON(client, model, messages) {
  try {
    log(`[llm] chat start | model=${model} | msgs=${messages.length}`);
    const sizes = messages.map((m) =>
      m.content ? String(m.content).length : 0
    );
    log(`[llm] msg sizes=${sizes.join(",")}`);
    const r = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages,
    });
    const raw = r.choices?.[0]?.message?.content || "";
    log(
      `[llm] chat ok (strict) | raw.len=${raw.length} | preview=${truncate(
        raw
      )}`
    );
    return raw;
  } catch (e) {
    warn(
      `[llm] strict JSON failed, retrying without response_format | ${
        e?.message || e
      }`
    );
    const r = await client.chat.completions.create({
      model,
      temperature: 0,
      messages,
      max_tokens: 800,
    });
    const raw = r.choices?.[0]?.message?.content || "";
    log(
      `[llm] chat ok (loose) | raw.len=${raw.length} | preview=${truncate(raw)}`
    );
    return raw;
  }
}

/**
 * Grade a candidate section against a clause checklist.
 * Returns: { is_match, elements_present[], elements_missing[], confidence, rationale }
 */
async function gradeClause({ clauseType, text, checklist }) {
  const client = getClient();
  const model =
    process.env.LLM_MODEL ||
    (process.env.OPENROUTER_API_KEY ? "openai/gpt-4o-mini" : "gpt-4o-mini");

  const requiredElements = checklist?.requiredElements || [];

  const system = [
    "You are a precise contract clause grader.",
    "Return JSON ONLY with this exact shape:",
    "{",
    '  "elements": { "<element 1>": true|false, "<element 2>": true|false, ... },',
    '  "present_count": <number>,',
    '  "confidence": <number 0..1>,',
    '  "rationale": "<short reason>"',
    "}",
    "Keys in `elements` MUST exactly match the provided requiredElements (no extras, no renaming).",
    "Mark an element true only if it is clearly supported by the candidateText.",
  ].join(" ");

  const user = {
    clauseType,
    requiredElements,
    candidateText: text,
  };

  try {
    const raw = await chatJSON(client, model, [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ]);

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/);
      json = m ? JSON.parse(m[0]) : {};
    }

    // Prefer strict object map: elements: { name: boolean }
    let elementsMap = {};
    if (
      json &&
      typeof json.elements === "object" &&
      !Array.isArray(json.elements)
    ) {
      elementsMap = json.elements;
    } else {
      // Back-compat: accept arrays if a model returns present/missing lists
      const present =
        (Array.isArray(json.elements_present) ? json.elements_present : null) ??
        (Array.isArray(json.present_elements) ? json.present_elements : []);
      const missing =
        (Array.isArray(json.elements_missing) ? json.elements_missing : null) ??
        (Array.isArray(json.missing_elements) ? json.missing_elements : []);
      for (const e of requiredElements)
        elementsMap[e] = present.includes(e)
          ? true
          : missing.includes(e)
          ? false
          : false;
    }

    // Build present/missing arrays from the map (deterministic)
    const elements_present = Object.keys(elementsMap).filter(
      (k) => elementsMap[k] === true
    );
    const elements_missing = Object.keys(elementsMap).filter(
      (k) => elementsMap[k] === false
    );

    const confidence =
      typeof json.confidence === "number" ? json.confidence : 0.8;
    const rationale =
      typeof json.rationale === "string" ? json.rationale : "graded";

    log(
      `[llm] elements graded | clause=${clauseType} | present=${elements_present.length}/${requiredElements.length}`
    );

    return {
      elements_map: elementsMap,
      elements_present,
      elements_missing,
      confidence,
      rationale,
    };
  } catch (e) {
    error(`[llm] grade error | clause=${clauseType} | ${e?.message || e}`);
    // Conservative fallback
    const elementsMap = {};
    for (const e of requiredElements) elementsMap[e] = false;
    return {
      elements_map: elementsMap,
      elements_present: [],
      elements_missing: requiredElements,
      confidence: 0.2,
      rationale: "llm_error",
    };
  }
}

module.exports = { gradeClause };
