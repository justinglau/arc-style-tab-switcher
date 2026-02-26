// MRU tab history stack
let mruStack = [];
const MAX_STACK_SIZE = 20;

// Thumbnail cache: tabId -> dataUrl
let thumbnailCache = {};

// Generate a consistent color from a domain string (no fetching needed)
function colorFromDomain(url) {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 55%, 45%)`;
  } catch {
    return null;
  }
}

// Capture thumbnail of the current visible tab
async function captureCurrentTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id) {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 40 });
      thumbnailCache[activeTab.id] = dataUrl;
    }
  } catch (e) {
    // Can't capture chrome:// pages etc — silently ignore
  }
}

// Capture on every tab switch
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId } = activeInfo;
  mruStack = mruStack.filter(id => id !== tabId);
  mruStack.unshift(tabId);
  if (mruStack.length > MAX_STACK_SIZE) {
    mruStack = mruStack.slice(0, MAX_STACK_SIZE);
  }
  setTimeout(() => captureCurrentTab(), 350);
});

// Capture on page load complete
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) {
        setTimeout(() => captureCurrentTab(), 500);
      }
    });
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  mruStack = mruStack.filter(id => id !== tabId);
  delete thumbnailCache[tabId];
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id) {
    mruStack = mruStack.filter(id => id !== tab.id);
    mruStack.unshift(tab.id);
  }
});

// Handle the keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "switch-tab") return;

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;

    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const allTabIds = new Set(allTabs.map(t => t.id));

    mruStack = mruStack.filter(id => allTabIds.has(id));

    if (mruStack[0] !== activeTab.id) {
      mruStack = mruStack.filter(id => id !== activeTab.id);
      mruStack.unshift(activeTab.id);
    }

    for (const tab of allTabs) {
      if (!mruStack.includes(tab.id)) mruStack.push(tab.id);
    }

    if (mruStack.length <= 1) return;

    // Check if overlay already showing
    let overlayShowing = false;
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { type: "PING_OVERLAY" });
      overlayShowing = response && response.showing;
    } catch { overlayShowing = false; }

    if (overlayShowing) {
      await chrome.tabs.sendMessage(activeTab.id, { type: "ADVANCE_SELECTION" });
      return;
    }

    // Build tab list
    const tabMap = new Map(allTabs.map(t => [t.id, t]));
    const mruTabs = mruStack
      .filter(id => tabMap.has(id))
      .map(id => {
        const t = tabMap.get(id);
        return {
          id: t.id,
          title: t.title || "Untitled",
          url: t.url || "",
          favIconUrl: t.favIconUrl || "",
          thumbnail: thumbnailCache[t.id] || null,
          accentColor: colorFromDomain(t.url || ""),
        };
      });

    // Inject
    await chrome.scripting.insertCSS({ target: { tabId: activeTab.id }, files: ["overlay.css"] });
    await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ["content.js"] });

    await chrome.tabs.sendMessage(activeTab.id, {
      type: "SHOW_SWITCHER",
      tabs: mruTabs,
      currentTabId: activeTab.id,
      quickSwitchTabId: mruTabs.length > 1 ? mruTabs[1].id : null,
    });
  } catch (err) {
    console.error("Tab switcher error:", err);
  }
});

// Listen for tab switch requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SWITCH_TO_TAB") {
    chrome.tabs.update(message.tabId, { active: true });
    sendResponse({ ok: true });
  }
});
