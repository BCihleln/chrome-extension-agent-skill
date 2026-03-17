---
name: chrome-extension
description: Build Chrome browser extensions (Manifest V3) from scratch or extend existing ones. Use this skill whenever the user asks to create a Chrome plugin, browser extension, content script, popup UI, or background service worker — or wants to add new detection/automation features to an existing extension. Covers the full lifecycle: requirements clarification → file architecture → implementation → packaging as a downloadable zip.
---

# Chrome Extension Skill

Build production-ready Chrome extensions (Manifest V3). This skill covers requirements gathering, architecture decisions, implementation, common pitfalls, and final packaging.

---

## Phase 1 — Requirements Clarification

Before writing any code, surface these decisions. Not all are always needed — skip ones obviously answered by the user's request.

### Clarify with the user (ask as grouped choices, not one-by-one)

**Scope & trigger**
- Which pages should the extension run on? (specific domains / all pages / manual trigger only)
- Should it activate automatically on page load, or only when the user clicks?

**Output / results presentation**
- How should results be shown? Common options:
  - Floating panel injected into the page
  - Popup (the toolbar icon click)
  - Both (panel on page + popup as remote control)

**Detection logic** — for content-scanning extensions specifically
- What exactly counts as a "problem"? Nail down the precise rule before coding.
- Are there edge cases the user is aware of? (e.g. empty fields, redirected URLs, non-standard server responses)

**Architecture preference**
- Separate CSS file vs inline styles in JS? (Separate is cleaner for maintainable projects; inline is fine for small utilities)

Collect all answers before moving to Phase 2. Present options as clickable choices where possible.

---

## Phase 2 — Pre-implementation: Read the Source

If the user provides an existing page (MHTML, HTML, screenshot), **always read it before writing any code**.

For table-based admin pages (common in game backends, CMS tools, etc.):
1. Parse the actual HTML to find column indices — never hardcode indices without verifying
2. Account for `colspan` and `rowspan` in headers (multi-level headers are common)
3. Note the real `src` attribute values for images (use `getAttribute('src')`, not `img.src` — the latter auto-resolves relative paths and empty strings to the page URL)

For any page:
- Note the URL pattern to set `matches` in manifest `content_scripts` correctly
- Identify the DOM selectors that will be needed

---

## Phase 3 — Architecture

### Standard file layout (Manifest V3)

```
extension-name/
├── manifest.json        # Extension config and permissions
├── content.js           # Injected into target pages
├── content.css          # Page-level styles (if separate CSS requested)
├── popup.html           # Toolbar popup UI
├── popup.js             # Popup logic
├── background.js        # Service worker (only if needed)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

Only include `background.js` if the extension needs persistent state across tabs or alarm-based scheduling. Most content-scanning extensions don't need it.

### When to use a separate CSS file

Use a separate `content.css` (declared in manifest `content_scripts.css`) when:
- The injected UI is substantial (floating panels, complex overlays)
- The user explicitly asked for separated concerns
- Styles are likely to be tweaked independently from logic

Use inline styles (CSS injected via `<style>` tag in JS) when:
- The extension is a small utility
- Portability matters (single-file content scripts are easier to share)

---

## Phase 4 — Implementation Patterns

### manifest.json essentials

```json
{
  "manifest_version": 3,
  "name": "Extension Name",
  "version": "1.0.0",
  "permissions": ["activeTab", "scripting"],
  "host_permissions": ["*://*.target-domain.com/*"],
  "content_scripts": [{
    "matches": ["*://*.target-domain.com/specific/path/*"],
    "js": ["content.js"],
    "css": ["content.css"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png" }
  }
}
```

### Panel show/hide — avoid the flicker trap

**Never** toggle panels with `display: none ↔ flex/block`. When `display: none` is removed, the browser resets layout for one frame before inline `left/top` from drag positioning can re-apply — causing visible jump/flicker.

**Use visibility + opacity instead:**

```css
#my-panel {
  /* normal visible state */
  transition: opacity 0.15s ease, visibility 0.15s ease;
}
#my-panel.panel-hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
```

```javascript
// Show
panel.classList.remove('panel-hidden');
// Hide
panel.classList.add('panel-hidden');
// Toggle
panel.classList.toggle('panel-hidden');
```

### Popup → content script messaging — handle connection errors

`chrome.tabs.sendMessage` throws `"Could not establish connection. Receiving end does not exist."` when the content script hasn't been injected yet (fresh tab, extension just installed, or navigated-to page that doesn't match `content_scripts.matches`). Always wrap with a fallback:

```javascript
async function safeSendMessage(tab, action) {
  try {
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch (err) {
    if (err?.message?.includes('Receiving end does not exist')) {
      // Inject the content script and retry once
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await new Promise(r => setTimeout(r, 100)); // wait for listener to mount
      await chrome.tabs.sendMessage(tab.id, { action });
    } else {
      console.warn('[Extension] sendMessage failed:', err?.message);
    }
  }
}
```

### Image broken detection — the correct approach

The simple `naturalWidth === 0` check is insufficient. Servers often return HTTP 200 with an HTML error page for invalid image paths. Use this three-step approach:

```javascript
async function checkImageBroken(img) {
  // 1. Use getAttribute, NOT img.src
  //    img.src auto-resolves empty string to the current page URL → false negative
  const rawAttr = img.getAttribute('src');
  if (!rawAttr || rawAttr.trim() === '') return true;
  if (rawAttr.startsWith('data:')) return !(img.complete && img.naturalWidth > 0);

  // 2. Fast path: already loaded and decoded
  if (img.complete && img.naturalWidth > 0) return false;

  // 3. Fetch to verify — check Content-Type, not just status code
  try {
    let res = await fetch(img.src, { method: 'HEAD', cache: 'no-store' });
    // Some servers return 405 for HEAD; fall back to GET with Range
    if (res.status === 405 || res.status === 501) {
      res = await fetch(img.src, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store',
      });
    }
    if (!res.ok && res.status !== 206) return true;
    // Server may return 200 + HTML error page — verify it's actually an image
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !ct.toLowerCase().split(';')[0].trim().startsWith('image/')) return true;
    return !(img.complete && img.naturalWidth > 0);
  } catch {
    return true; // Network error = broken
  }
}
```

### Multi-level table header parsing

For tables with `colspan`/`rowspan` in headers, never assume column indices. Use a grid-mapping approach:

```javascript
function detectColumnIndices(table, targetHeaders) {
  const result = {};
  const grid = [];
  const headerRows = Array.from(table.querySelectorAll('thead tr, tr:has(th)')).slice(0, 3);

  headerRows.forEach((tr, rowIdx) => {
    if (!grid[rowIdx]) grid[rowIdx] = [];
    let colIdx = 0;
    Array.from(tr.children).forEach(cell => {
      while (grid[rowIdx][colIdx]) colIdx++;
      const colspan = parseInt(cell.getAttribute('colspan') || '1');
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
      const text = cell.textContent.trim();
      for (let r = 0; r < rowspan; r++) {
        if (!grid[rowIdx + r]) grid[rowIdx + r] = [];
        for (let c = 0; c < colspan; c++) grid[rowIdx + r][colIdx + c] = text;
      }
      if (targetHeaders.includes(text)) result[text] = colIdx;
      colIdx += colspan;
    });
  });
  return result;
}
```

Always provide fallback index values (`colIndices['ColumnName'] ?? KNOWN_FALLBACK`) in case the page structure changes.

### Generating icons programmatically

When no icon assets are available, generate minimal valid PNGs with Python:

```python
import struct, zlib

def make_solid_png(size, rgb):
    r, g, b = rgb
    raw = b''
    for _ in range(size):
        row = bytes([r, g, b, 255] * size)
        raw += b'\x00' + row
    compressed = zlib.compress(raw)
    def chunk(name, data):
        crc = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>II', size, size) + bytes([8, 6, 0, 0, 0]))
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

for size in [16, 48, 128]:
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(make_solid_png(size, (49, 130, 206)))  # blue
```

---

## Phase 5 — Packaging

Package as a zip for the user to load unpacked:

```bash
cd /path/to/extension-folder
zip -r extension-name.zip . --exclude "*.DS_Store" --exclude "__MACOSX/*"
```

Then copy to `/mnt/user-data/outputs/` and call `present_files`.

### Installation instructions to include with delivery

> 1. 下載 zip 並解壓縮
> 2. Chrome 網址列輸入 `chrome://extensions`
> 3. 右上角開啟「**開發人員模式**」
> 4. 點擊「**載入未封裝項目**」→ 選擇解壓後的資料夾

---

## Common Pitfalls Checklist

Before delivering, verify:

- [ ] `img.getAttribute('src')` used (not `img.src`) for broken image detection
- [ ] Panel visibility uses class toggle (not `display: none`)
- [ ] `safeSendMessage` used in popup (not bare `chrome.tabs.sendMessage`)
- [ ] Table column indices resolved dynamically with fallbacks
- [ ] `host_permissions` in manifest covers the target domain
- [ ] `run_at: document_idle` set so DOM is ready when script runs
- [ ] Icons exist (even as programmatically generated placeholders)
- [ ] `cache: 'no-store'` on fetch calls to avoid stale 200 responses for broken images
