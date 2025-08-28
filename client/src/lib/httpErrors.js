// client/src/lib/httpErrors.js

export function isHTTPError(err, code) {
  const msg = (err && err.message) || String(err || "");
  return msg.includes(`HTTP ${code}`);
}
