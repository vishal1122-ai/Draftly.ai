const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extract plain text from buffer, then split into lightweight "sections".
 * Supports: .txt, .docx, .pdf (best-effort).
 */
async function extractTextSections(buf, meta = {}) {
  const text = await extractPlainText(buf, meta);
  const sections = splitIntoSections(text);
  return { sections };
}

async function extractPlainText(buf, meta) {
  const name = (meta.originalname || "").toLowerCase();
  const type = (meta.mimetype || "").toLowerCase();

  // TXT by extension or mimetype
  if (name.endsWith(".txt") || type.includes("text/plain")) {
    return buf.toString("utf8");
  }

  // DOCX
  if (
    name.endsWith(".docx") ||
    type.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  ) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return (result.value || "").trim();
  }

  // PDF
  if (name.endsWith(".pdf") || type.includes("application/pdf")) {
    const result = await pdfParse(buf);
    return (result.text || "").trim();
  }

  // Fallback: assume UTF-8 text
  return buf.toString("utf8");
}

/**
 * Very simple sectioner:
 * - Normalize whitespace
 * - Split on double newlines
 * - Detect headings (ALL CAPS, or numbered like "1.", "1.1", or words ending with ":")
 */
function splitIntoSections(raw) {
  if (!raw) return [];
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  const chunks = normalized
    .split(/\n{2,}/g) // paragraphs
    .map((s) => s.trim())
    .filter(Boolean);

  const sections = [];
  for (let i = 0; i < chunks.length; i++) {
    const para = chunks[i];

    // try to detect a heading line
    const firstLine = para.split("\n")[0].trim();
    const isAllCaps =
      /^[A-Z0-9 ()\-_,.]{3,}$/.test(firstLine) &&
      firstLine === firstLine.toUpperCase();
    const isNumbered = /^(\d+(\.\d+)*)[.)]\s+/.test(firstLine);
    const endsWithColon = /:\s*$/.test(firstLine);

    let heading = undefined;
    let body = para;

    if (isAllCaps || isNumbered || endsWithColon) {
      heading = firstLine.replace(/[:.]\s*$/, "");
      body = para.slice(firstLine.length).trim();
      if (!body) body = firstLine; // if whole para is just the heading, keep it as text
    }

    sections.push({
      index: i,
      heading: heading || undefined,
      text: body,
    });
  }

  // Merge tiny fragments to reduce noise (optional)
  const merged = [];
  for (const s of sections) {
    if (merged.length && s.text.length < 40) {
      merged[merged.length - 1].text +=
        "\n\n" + (s.heading ? s.heading + "\n" : "") + s.text;
    } else {
      merged.push(s);
    }
  }

  return merged;
}

module.exports = { extractTextSections };
