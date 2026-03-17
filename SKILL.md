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

---

## Phase 4 — Implementation

All reusable code patterns are in `templates/`. **Load only what you need** by copying the relevant file into the implementation. Do not load all templates at once.

| 需要的功能 | 載入的模板檔案 |
|---|---|
| `manifest.json` 初始結構 | `templates/manifest.json` |
| Panel 顯示/隱藏（無 flicker） | `templates/panel-toggle.css` + `templates/panel-toggle.js` |
| Popup → content script 通訊 | `templates/safe-send-message.js` |
| 圖片失效偵測 | `templates/check-image-broken.js` |
| 多層表頭欄位索引解析 | `templates/detect-column-indices.js` |
| 程式化生成 icon PNG | `templates/generate-icons.py` |

### Key decisions embedded in templates (summary)

- **Panel toggle**: Use `visibility + opacity` class toggle, never `display: none ↔ block` (causes layout flicker after drag positioning).
- **sendMessage**: Always use `safeSendMessage` — bare `chrome.tabs.sendMessage` throws when content script isn't injected yet.
- **Image broken check**: Use `getAttribute('src')` not `img.src`; verify `Content-Type` not just HTTP status.
- **Column indices**: Always resolve dynamically with fallback values; never hardcode.
- **Icons**: If no assets provided, run `generate-icons.py` to produce valid placeholder PNGs.

---

## Phase 5 — Packaging

Package as a zip for the user to load unpacked:

```bash
cd /path/to/extension-folder
zip -r extension-name.zip . --exclude "*.DS_Store" --exclude "__MACOSX/*"
```

Copy to `/mnt/user-data/outputs/` and call `present_files`.

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
