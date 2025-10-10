function toIndex(v) {
  return Number.isInteger(v)
    ? v
    : Number.isInteger(Number(v))
    ? Number(v)
    : NaN;
}

function clampU16(v, fb) {
  return Number.isInteger(v) ? v & 0xffff : fb;
}

function finiteOr(v, fb) {
  return Number.isFinite(v) ? v : fb;
}

function sanitizeFactors(arr) {
  return Array.isArray(arr)
    ? arr.map((x) => (Number.isFinite(Number(x)) ? Number(x) : 1))
    : undefined;
}

module.exports = { toIndex, clampU16, finiteOr, sanitizeFactors };
