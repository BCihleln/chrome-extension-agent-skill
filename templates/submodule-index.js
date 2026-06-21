const SCRIPT_ID = 'example-module-script';

async function onEnable() {
  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (scripts.length === 0) {
      await chrome.scripting.registerContentScripts([{
        id: SCRIPT_ID,
        // Update the matches and js/css paths as needed
        matches: ["*://*.example.com/*"],
        js: ["your-module/main.js"],
        css: ["your-module/styles.css"],
        runAt: "document_idle"
      }]);
      console.log('Example content script registered.');
    }
  } catch (err) {
    console.error('Failed to register example content script:', err);
  }
}

async function onDisable() {
  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (scripts.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
      console.log('Example content script unregistered.');
    }
  } catch (err) {
    console.error('Failed to unregister example content script:', err);
  }
}

export default {
  id: 'exampleModule', // Unique identifier for the module
  onEnable,
  onDisable
};
