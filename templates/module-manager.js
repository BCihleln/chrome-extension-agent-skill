export function setupModules(modules) {
  // Listen for changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.modules) {
      const oldModules = changes.modules.oldValue || {};
      const newModules = changes.modules.newValue || {};
      
      for (const module of modules) {
        const wasEnabled = oldModules[module.id] !== false; // Default to true
        const isEnabled = newModules[module.id] !== false; // Default to true
        
        if (!wasEnabled && isEnabled) {
          if (module.onEnable) module.onEnable();
        } else if (wasEnabled && !isEnabled) {
          if (module.onDisable) module.onDisable();
        }
      }
    }
  });

  // Initial setup
  const init = () => {
    chrome.storage.local.get(['modules'], (result) => {
      const storedModules = result.modules || {};
      for (const module of modules) {
        const isEnabled = storedModules[module.id] !== false;
        if (isEnabled && module.onEnable) {
          module.onEnable();
        } else if (!isEnabled && module.onDisable) {
          module.onDisable();
        }
      }
    });
  };

  chrome.runtime.onInstalled.addListener(init);
  chrome.runtime.onStartup.addListener(init);
}
