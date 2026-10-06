// Arc-Style Tab Switcher - background service worker (v2.1)
//
// Chrome puts this worker to sleep after ~30s idle, which wipes in-memory
// state. MRU order and thumbnails are therefore persisted in
// chrome.storage.session (memory-only, cleared when Chrome quits).

const MAX_MRU = 50;
const THUMB_WIDTH = 480;

let mru = [];
let thumbs = {};
let mruReady = null;
let thumbsReady = null;

// ─── Persistence ───

function loadMru() {
  if (!mruReady) {
    mruReady = chrome.storage.session
      .get("mru")
      .then((d) => { mru = Array.isArray(d.mru) ? d.mru : []; })
      .catch(() => { mru = []; });
  }
  return mruReady;
}

function loadThumbs() {
  if (!thumbsReady) {
    thumbsReady = chrome.storage.session
      .get(null)
      .then((d) => {
        for (const [k, v] of Object.entries(d)) {
          if (k.startsWith("thumb:")) {
            const id = Number(k.slice(6));
            if (!(id in thumbs)) thumbs[id] = v;
          }
        }
      })
      .catch(() => {});
  }
  return thumbsReady;
}

function saveMru() {
  chrome.storage.session.set({ mru }).catch(() => {});
}

async function touch(tabId) {
  await loadMru();
  mru = [tabId, ...mru.filter((id) => id !== tabId)].slice(0, MAX_MRU);
  saveMru();
}

// ─── Thumbnails ───

let captureTimer = null;

function scheduleCapture(tabId, windowId, delay) {
  clearTimeout(captureTimer);
  captureTimer = setTimeout(() => capture(tabId, windowId), delay);
}

async function capture(tabId, windowId) {
  try {
    const [active] = await chrome.tabs.query({ active: true, windowId });
    if (!active || active.id !== tabId) return;
    const raw = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 60 });
    const small = await shrink(raw);
    thumbs[tabId] = small;
    chrome.storage.session.set({ ["thumb:" + tabId]: small }).catch(() => {});
  } catch {
    // chrome:// pages, rate limits, etc. Fallback card is used instead.
  }
}

// Downscale screenshots so they are fast to store and send
async function shrink(dataUrl) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bmp = await createImageBitmap(blob);
    const w = Math.min(THUMB_WIDTH, bmp.width);
    const h = Math.round(bmp.height * (w / bmp.width));
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    const bytes = new Uint8Array(await out.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return "data:image/jpeg;base64," + btoa(bin);
  } catch {
    return dataUrl;
  }
}

// ─── Tab events ───

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  touch(tabId);
  scheduleCapture(tabId, windowId, 400);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.active) {
    scheduleCapture(tabId, tab.windowId, 600);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await loadMru();
  mru = mru.filter((id) => id !== tabId);
  saveMru();
  delete thumbs[tabId];
  chrome.storage.session.remove("thumb:" + tabId).catch(() => {});
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [t] = await chrome.tabs.query({ active: true, windowId });
    if (t) touch(t.id);
  } catch {}
});

// On install/update, load the listener into tabs that are already open
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (!t.url || !/^(https?|file):/.test(t.url)) continue;
    const target = { tabId: t.id, allFrames: true };
    chrome.scripting.insertCSS({ target, files: ["overlay.css"] }).catch(() => {});
    chrome.scripting.executeScript({ target, files: ["content.js"] }).catch(() => {});
  }
  const actives = await chrome.tabs.query({ active: true });
  for (const t of actives) await touch(t.id);
});

// ─── Helpers ───

function hueFromUrl(url) {
  try {
    const d = new URL(url).hostname.replace(/^www\./, "");
    let h = 0;
    for (let i = 0; i < d.length; i++) h = d.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h) % 360;
  } catch {
    return null;
  }
}

// Tabs in this window, ordered most recently used first
async function orderedTabs(active) {
  await loadMru();
  const all = await chrome.tabs.query({ windowId: active.windowId });
  const byId = new Map(all.map((t) => [t.id, t]));
  byId.delete(active.id);
  const ordered = [active];
  for (const id of mru) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      byId.delete(id);
    }
  }
  for (const t of all) if (byId.has(t.id)) ordered.push(t);
  return ordered;
}

// ─── Shortcut ───

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "switch-tab") return;

  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!active) return;

  const ordered = await orderedTabs(active);
  const prevId = ordered[1] ? ordered[1].id : null;

  // Ask the page whether Ctrl is still held
  let reply = null;
  try {
    reply = await chrome.tabs.sendMessage(active.id, { type: "TRIGGER", quickTabId: prevId }, { frameId: 0 });
  } catch {
    reply = null; // No listener here (chrome:// pages, Web Store): just quick-switch
  }

  if (!reply || reply.mode === "quick") {
    if (prevId != null) chrome.tabs.update(prevId, { active: true });
    return;
  }

  if (reply.mode === "needList") {
    await loadThumbs();
    const tabs = ordered.map((t) => ({
      id: t.id,
      title: t.title || "Untitled",
      url: t.url || "",
      favIconUrl: t.favIconUrl || "",
      thumbnail: thumbs[t.id] || null,
      hue: hueFromUrl(t.url || ""),
    }));
    chrome.tabs.sendMessage(active.id, { type: "TAB_LIST", tabs }, { frameId: 0 }).catch(() => {});
  }
  // mode "advanced": overlay already open, page moved the selection itself
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "SWITCH_TO_TAB" && message.tabId != null) {
    chrome.tabs.update(message.tabId, { active: true }).catch(() => {});
    sendResponse({ ok: true });
  }
});
