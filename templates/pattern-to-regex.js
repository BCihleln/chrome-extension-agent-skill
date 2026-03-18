/**
 * pattern-to-regex.js — URL/domain pattern → RegExp converter
 *
 * USE CASE:
 *   User-managed blocklists or allowlists where patterns are entered as plain
 *   text and must be matched against page URLs at runtime. Designed to be
 *   shared via utils.js between content scripts and popup scripts.
 *
 * SUPPORTED PATTERN SYNTAX:
 *   - Plain domain:  "example.com"         → matches hostname == example.com
 *                                             or *.example.com
 *   - Wildcard URL:  "*.example.com/path*" → shell-glob (* = anything)
 *   - Full URL:      "https://foo.com/bar"  → prefix / exact match
 *
 * USAGE — add to utils.js and import in manifest.json before main scripts:
 *
 *   // utils.js
 *   const TableCopyUtils = { patternToRegex, isBlocked };
 *
 *   // manifest.json content_scripts
 *   "js": ["utils.js", "content.js"]
 *
 *   // popup.html
 *   <script src="utils.js"></script>
 *   <script src="popup.js"></script>
 *
 * ISOLATION WARNING:
 *   content.js runs in an isolated world — popup.js cannot call its functions
 *   directly. Always extract shared logic like this into utils.js.
 */

/**
 * Converts a user-entered pattern string to a RegExp.
 * Returns null if the pattern is empty or produces an invalid regex.
 *
 * @param {string} pattern
 * @returns {RegExp|null}
 */
function patternToRegex(pattern) {
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  // Plain domain (no protocol, no path separator, no wildcard)
  // e.g. "example.com" → matches "example.com" or "sub.example.com"
  if (!/[/:*]/.test(trimmed)) {
    const escaped = trimmed.replace(/\./g, "\\.");
    return new RegExp(`(^|\\.)${escaped}($|/)`, "i");
  }

  // Wildcard / glob — escape regex special chars, then restore *→.*
  const regexStr = trimmed
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape special chars
    .replace(/\\\*/g, ".*");               // unescape * → .*
  try {
    return new RegExp(regexStr, "i");
  } catch (_) {
    return null;
  }
}

/**
 * Returns true if the given url/hostname matches any pattern in the list.
 *
 * @param {string[]} blocklist   - Array of pattern strings
 * @param {string}   url         - Full URL (location.href)
 * @param {string}   [hostname]  - Optional hostname (location.hostname)
 * @returns {boolean}
 */
function isBlocked(blocklist, url, hostname) {
  if (!Array.isArray(blocklist) || blocklist.length === 0) return false;
  for (const pattern of blocklist) {
    const re = patternToRegex(pattern);
    if (!re) continue;
    if (re.test(url)) return true;
    if (hostname && re.test(hostname)) return true;
  }
  return false;
}
