// Arc-Style Tab Switcher - page script (v2.1)
//
// Runs in every page at all times so it already knows whether Ctrl is held
// when the shortcut fires. This removes the race that caused quick taps to
// open the strip instead of toggling tabs.

(() => {
  const MSG_TAG = "__arcTabSwitcher";
  const TEARDOWN_EVT = "__arcTabSwitcherTeardown";
  const HOLD_MS = 300;
  const NAV_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Tab", "Enter", "Escape"]);
  const instanceId = Math.random().toString(36).slice(2);

  const isTop = window.top === window;

  function alive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  function isModifier(key) {
    return key === "Control" || key === "Alt" || key === "Meta";
  }

  function modsHeld(e) {
    return !!(e.ctrlKey || e.altKey || e.metaKey);
  }

  // Remove any older copy of this script (e.g. after an extension update)
  document.dispatchEvent(new CustomEvent(TEARDOWN_EVT, { detail: instanceId }));

  // ════════════════════════════════════════════════════════════
  // Sub-frames: only forward key state to the top page
  // ════════════════════════════════════════════════════════════
  if (!isTop) {
    function forward(e) {
      if (!alive()) return teardownFrame();
      const mod = modsHeld(e);
      const relevant = isModifier(e.key) || (mod && NAV_KEYS.has(e.key));
      if (!relevant) return;
      try {
        window.top.postMessage(
          { [MSG_TAG]: 1, mod, key: e.type === "keydown" && !isModifier(e.key) ? e.key : null, shift: e.shiftKey },
          "*"
        );
      } catch {}
    }
    function teardownFrame(evt) {
      if (evt && evt.detail === instanceId) return;
      window.removeEventListener("keydown", forward, true);
      window.removeEventListener("keyup", forward, true);
      document.removeEventListener(TEARDOWN_EVT, teardownFrame);
    }
    window.addEventListener("keydown", forward, true);
    window.addEventListener("keyup", forward, true);
    document.addEventListener(TEARDOWN_EVT, teardownFrame);
    return;
  }

  // ════════════════════════════════════════════════════════════
  // Top page: tracking + switcher
  // ════════════════════════════════════════════════════════════

  let modHeld = false;     // is Ctrl/Option/Cmd currently down
  let active = false;      // switcher session in progress
  let quickTabId = null;   // previous tab, known before the full list arrives
  let tabs = null;         // full MRU list (arrives a moment later)
  let selected = 1;
  let holdTimer = null;
  let holdElapsed = false;
  let mouseArmed = false;  // hover only selects after a real mouse movement
  let overlay = null;
  let cards = [];
  let labelEl = null;
  let restoreFocusTo = null;

  // ─── Helpers ───

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function domainOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  function emojiFor(url) {
    const d = domainOf(url);
    if (d.includes("github")) return "🐙";
    if (d.includes("youtube")) return "▶️";
    if (d.includes("slack")) return "💬";
    if (d.includes("twitter") || d.includes("x.com")) return "🐦";
    if (d.includes("notion")) return "📝";
    if (d.includes("figma")) return "🎨";
    if (d.includes("linkedin")) return "💼";
    if (d.includes("mail") || d.includes("superhuman")) return "📧";
    if (d.includes("calendar")) return "📅";
    if (d.includes("google")) return "🔍";
    return "🌐";
  }

  function accent(hue) {
    if (hue == null) return "linear-gradient(145deg, rgba(70, 70, 90, 0.5), rgba(40, 40, 55, 0.7))";
    return `linear-gradient(145deg, hsla(${hue}, 55%, 45%, 0.35), hsla(${hue}, 55%, 35%, 0.55))`;
  }

  function icon(tab, emojiCls) {
    const fallback = () => {
      const s = el("span", emojiCls);
      s.textContent = emojiFor(tab.url);
      return s;
    };
    if (!tab.favIconUrl) return fallback();
    const img = el("img");
    img.alt = "";
    img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
    img.src = tab.favIconUrl;
    return img;
  }

  // ─── Overlay ───

  function buildCard(tab, i) {
    const card = el("div", "__arc-switcher-item");
    const wrap = el("div", "__arc-switcher-thumb-wrap");

    if (tab.thumbnail) {
      const img = el("img", "__arc-switcher-thumb");
      img.alt = "";
      img.src = tab.thumbnail;
      wrap.append(img);
      const badge = el("div", "__arc-switcher-favicon-badge");
      badge.append(icon(tab, "__arc-switcher-favicon-badge-emoji"));
      card.append(badge);
    } else {
      const box = el("div", "__arc-switcher-thumb-favicon");
      box.style.background = accent(tab.hue);
      box.append(icon(tab, "__arc-switcher-thumb-favicon-emoji"));
      wrap.append(box);
    }

    if (i === 0) {
      const b = el("div", "__arc-switcher-current-badge");
      b.textContent = "current";
      card.append(b);
    }

    const info = el("div", "__arc-switcher-item-info");
    const title = el("div", "__arc-switcher-item-title");
    title.textContent = tab.title;
    const url = el("div", "__arc-switcher-item-url");
    url.textContent = domainOf(tab.url);
    info.append(title, url);
    card.append(wrap, info);

    card.addEventListener("mouseenter", () => {
      if (!mouseArmed || !active) return;
      selected = i;
      updateSelection(false);
    });
    card.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selected = i;
      commit();
    });
    return card;
  }

  function showOverlay() {
    if (overlay || !tabs || !tabs.length) return;
    if (selected >= tabs.length) selected = selected % tabs.length;

    overlay = el("div");
    overlay.id = "__arc-tab-switcher-overlay";

    const backdrop = el("div", "__arc-switcher-backdrop");
    backdrop.addEventListener("mousedown", (e) => { e.preventDefault(); end(); });

    const panel = el("div", "__arc-switcher-panel");
    panel.tabIndex = -1;
    const list = el("div", "__arc-switcher-list");
    labelEl = el("div", "__arc-switcher-selected-label");

    cards = tabs.map(buildCard);
    list.append(...cards);
    panel.append(list, labelEl);
    overlay.append(backdrop, panel);
    (document.documentElement || document.body).appendChild(overlay);

    // If focus is inside an iframe (Google Docs, Gmail compose, etc.),
    // pull it to this page so arrow keys and the Ctrl release land here
    const ae = document.activeElement;
    if (ae && (ae.tagName === "IFRAME" || ae.tagName === "FRAME")) {
      restoreFocusTo = ae;
      panel.focus({ preventScroll: true });
    }

    updateSelection(true);
  }

  // Only toggles classes; never rebuilds the strip
  function updateSelection(scroll) {
    cards.forEach((c, i) => c.classList.toggle("__arc-switcher-item--selected", i === selected));
    if (labelEl && tabs && tabs[selected]) labelEl.textContent = tabs[selected].title;
    if (scroll && cards[selected]) {
      cards[selected].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    }
  }

  // ─── Session ───

  function start(qid) {
    active = true;
    quickTabId = qid;
    tabs = null;
    selected = 1;
    holdElapsed = false;
    mouseArmed = false;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      holdElapsed = true;
      if (active) showOverlay();
    }, HOLD_MS);
  }

  function forceShow() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    holdElapsed = true;
    showOverlay();
  }

  function move(delta) {
    if (tabs && tabs.length) {
      const n = tabs.length;
      selected = (((selected + delta) % n) + n) % n;
    } else {
      selected = Math.max(0, selected + delta);
    }
    if (overlay) updateSelection(true);
    else forceShow();
  }

  function commit() {
    if (!active) return;
    const target = tabs && tabs[selected] ? tabs[selected].id : quickTabId;
    end(false);
    if (target != null && alive()) {
      chrome.runtime.sendMessage({ type: "SWITCH_TO_TAB", tabId: target }).catch(() => {});
    }
  }

  function end(restoreFocus = true) {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (overlay) { overlay.remove(); overlay = null; }
    if (restoreFocus && restoreFocusTo) {
      try { restoreFocusTo.focus({ preventScroll: true }); } catch {}
    }
    restoreFocusTo = null;
    cards = [];
    labelEl = null;
    tabs = null;
    active = false;
    holdElapsed = false;
    mouseArmed = false;
  }

  // ─── Input handling ───

  function handleNav(key, shift) {
    switch (key) {
      case "ArrowRight":
      case "ArrowDown": move(1); return true;
      case "ArrowLeft":
      case "ArrowUp": move(-1); return true;
      case "Tab": move(shift ? -1 : 1); return true;
      case "Enter": commit(); return true;
      case "Escape": end(); return true;
    }
    return false;
  }

  function onKeyDown(e) {
    if (!alive()) return teardown();
    modHeld = modsHeld(e);
    if (!active || isModifier(e.key)) return;
    if (handleNav(e.key, e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onKeyUp(e) {
    if (!alive()) return teardown();
    modHeld = modsHeld(e);
    if (active && isModifier(e.key) && !modHeld) {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  }

  // Key state forwarded from iframes on this page
  function onFrameMessage(e) {
    const d = e.data;
    if (!d || d[MSG_TAG] !== 1 || e.source === window) return;
    modHeld = !!d.mod;
    if (!active) return;
    if (d.key) handleNav(d.key, !!d.shift);
    else if (!modHeld) commit();
  }

  function onMouseMove(e) {
    if (!active) return;
    // Safety net: if Ctrl was released without us seeing it, close the strip
    if (!modsHeld(e)) { end(); return; }
    if (e.movementX || e.movementY) mouseArmed = true;
  }

  function onBlur() {
    // Focus moving into an iframe on this page also fires blur; ignore that
    setTimeout(() => {
      if (document.hasFocus()) return;
      modHeld = false;
      if (active) end();
    }, 0);
  }

  function onVisibility() {
    if (document.visibilityState === "hidden") {
      modHeld = false;
      if (active) end(false);
    }
  }

  function onMessage(msg, sender, sendResponse) {
    if (!msg) return;
    if (msg.type === "TRIGGER") {
      if (active) {
        move(1); // Tab tapped again while holding Ctrl
        sendResponse({ mode: "advanced" });
      } else if (!modHeld) {
        sendResponse({ mode: "quick" }); // Ctrl already released: instant toggle
      } else {
        start(msg.quickTabId);
        sendResponse({ mode: "needList" });
      }
    } else if (msg.type === "TAB_LIST") {
      if (!active || !Array.isArray(msg.tabs) || msg.tabs.length < 2) return;
      tabs = msg.tabs;
      if (selected >= tabs.length) selected = selected % tabs.length;
      if (holdElapsed) showOverlay();
    }
  }

  function teardown(evt) {
    if (evt && evt.detail === instanceId) return;
    end(false);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("message", onFrameMessage);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener(TEARDOWN_EVT, teardown);
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch {}
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("message", onFrameMessage);
  window.addEventListener("mousemove", onMouseMove, { capture: true, passive: true });
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener(TEARDOWN_EVT, teardown);
  chrome.runtime.onMessage.addListener(onMessage);
})();
