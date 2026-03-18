---
name: chrome-extension
description: Build Chrome browser extensions (Manifest V3) from scratch or extend existing ones. Use this skill whenever the user asks to create a Chrome plugin, browser extension, content script, popup UI, or background service worker — or wants to add new detection/automation features to an existing extension.
---

# Chrome Extension Skill

Build production-ready Chrome extensions (Manifest V3). This skill covers requirements gathering, architecture decisions, implementation, common pitfalls, and final packaging.

---

## Phase 1 — Requirements Clarification

Before writing any code, you **must clarify requirements with user** by using `ask_user_input` tool. 

Below are the requirements that must clarify. If one is obviously answered by the user's request, feel free to skip. You can extend any question as you want.

1. **Scope** (multi_select)  
Where should the extension run on? (specific domains / all pages / local files)

2. **Trigger** (single_select)  
Should it activate automatically on page load, or only when the user clicks?

3. **Output / results presentation** (single_select)  
How should results be shown? Common options:  
  - Floating panel injected into the page
  - Popup (the toolbar icon click)
  - Both (panel on page + popup as remote control)

4. **Detection logic** (single_select) — for content-scanning extensions specifically  
- What exactly counts as a "problem"? Nail down the precise rule before coding.
- Are there edge cases the user is aware of? (e.g. empty fields, redirected URLs, non-standard server responses)

5. **Architecture preference** (single_select)
- Separate CSS file vs inline styles in JS?

You must collect all answers via `ask_user_input` tool before moving to Phase 2. **Do not to make assumptions.**

---

## Phase 2 — Pre-implementation: Read the Source

If the user provides an existing page (MHTML, HTML, screenshot), **always read it before writing any code**.

For table-based admin pages (common in game backends, CMS tools, etc.):
1. Parse the actual HTML to find column indices — never hardcode indices without verifying
2. Account for `colspan` and `rowspan` (use template → `detect-column-indices.js`)
3. Note real `src` attribute values (use `getAttribute('src')`, not `img.src`)

For any page:
- Note the URL pattern to set `matches` in manifest `content_scripts` correctly
- Identify the DOM selectors that will be needed

---

## Phase 3 — Architecture

### Standard file layout (Manifest V3)

```
extension-name/
├── manifest.json        # Extension config and permissions
├── utils.js             # Shared utility functions (Optional, add when 2+ modules share logic)
├── content.js           # Injected into target pages
├── content.css          # Page-level styles (required)
├── popup.html           # Toolbar popup UI (Optional, Needed if popup required)
├── popup.js             # Popup logic (Optional, Needed if popup required)
├── background.js        # Service worker (Optional, Needed if user required)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

Only include `background.js` if the extension needs persistent state across tabs or alarm-based scheduling. Most content-scanning extensions don't need it.

### Shared utilities — utils.js

**content.js and popup.js run in completely separate JS environments** — popup cannot call functions defined in content.js, and vice versa. If any function is needed by 2 or more modules, extract it into `utils.js`.

**Before implementing any helper function**, check `templates/` for an existing one (e.g. `pattern-to-regex.js`).

When adding `utils.js`:
- In `manifest.json`, list it **before** the main script: `"js": ["utils.js", "content.js"]`
- In `popup.html`, load it **before** popup.js: `<script src="utils.js"></script>`
- Expose shared functions on a named namespace object (e.g. `const MyExtUtils = { fn1, fn2 }`) to avoid global collisions

---

## Phase 4 — Implementation

All reusable code patterns are in `templates/`. **Load only what you need** by copying the relevant file into the implementation. **Do not load all templates at once.**

| Required Function | Templates Path |
|---|---|
| `manifest.json` 初始結構 | `templates/manifest.json` |
| Panel 顯示/隱藏（無 flicker） | `templates/panel-toggle.css` + `templates/panel-toggle.js` |
| Popup → content script 通訊 | `templates/safe-send-message.js` |
| 圖片失效偵測 | `templates/check-image-broken.js` |
| 多層表頭欄位索引解析 | `templates/detect-column-indices.js` |
| 程式化生成 icon PNG | `templates/generate-icons.py` |
| URL/domain pattern → RegExp（blocklist / allowlist 用） | `templates/pattern-to-regex.js` |

### Key decisions embedded in templates (summary)

- **Panel toggle**: Use `visibility + opacity` class toggle, never `display: none ↔ block` (causes layout flicker after drag positioning).
- **sendMessage**: Always use `safeSendMessage` — bare `chrome.tabs.sendMessage` throws when content script isn't injected yet.
- **Image broken check**: Use `getAttribute('src')` not `img.src`; verify `Content-Type` not just HTTP status.
- **Column indices**: Always resolve dynamically with fallback values; never hardcode.
- **Icons**: If no assets provided, run `generate-icons.py` to produce valid placeholder PNGs.

---

## Phase 5 — Packaging

Package as a zip for the user to load unpacked:

1. Copy `references/installation-guide.md` to the extension-folder, and rename it as README.md
2. Run script below
```bash
cd /path/to/extension-folder
zip -r extension-name.zip . --exclude "*.DS_Store" --exclude "__MACOSX/*"
```
3. Copy to `/mnt/user-data/outputs/` and call `present_files`.

---

## Small additions to existing extensions

For feature additions or bug fixes on an **existing** extension that are **≤ 50 lines and touch ≤ 4 files**, apply these defaults unless the user explicitly asks for file output:

**Principle**: Minimise unintended AI-introduced changes and keep diffs easy to review — prefer instructing the user over autonomously rewriting files.

**Default behaviour — text-only guidance:**
1. State which file(s) to edit and exactly where (function name / line context)
2. Provide the replacement snippet
3. Explain *why* the change is needed (so the user can verify intent)
4. Do **not** output the full modified file unless asked

**Override**: If the user says "just do it", "update the file", "output the zip", etc., switch to full file output as normal.

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
