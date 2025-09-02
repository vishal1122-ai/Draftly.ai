// server/lib/utils/logger.js
const MODE = (process.env.DRAFTLY_LOG || "compact").toLowerCase();

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function shouldPrintCompact(message) {
  // Only keep the most useful lines
  return (
    message.includes("[review] start") ||
    message.includes("[review] done") ||
    message.includes("[review] abstain") ||
    (message.includes("[grade]") &&
      (message.includes("state=") || message.includes("no candidate")))
  );
}

function _print(fn, args) {
  const line = [`[${ts()}]`, ...args].join(" ");
  if (MODE === "off") return;
  if (MODE === "compact") {
    if (shouldPrintCompact(line)) fn(line);
    return;
  }
  // verbose
  fn(line);
}

function log(...args) {
  _print(console.log, args);
}
function warn(...args) {
  _print(console.warn, args);
}
function error(...args) {
  _print(console.error, args);
}

function truncate(s, n = 220) {
  if (s == null) return "";
  const str = String(s);
  return str.length > n ? str.slice(0, n) + "…" : str;
}

module.exports = { log, warn, error, truncate };
