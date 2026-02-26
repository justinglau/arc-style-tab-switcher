(() => {
  if (window.__arcTabSwitcherInjected) return;
  window.__arcTabSwitcherInjected = true;

  let overlay = null;
  let selectedIndex = 1;
  let tabList = [];
  let overlayVisible = false;
  let showOverlayTimer = null;
  const HOLD_THRESHOLD = 300; // ms — overlay appears after this

  // ─── Helpers ───

  function getDomainFromUrl(url) {
    try { return new URL(url).hostname.replace("www.", ""); }
    catch { return ""; }
  }

  function truncate(str, len) {
    return str.length <= len ? str : str.slice(0, len) + "…";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function getEmojiForDomain(url) {
    const d = getDomainFromUrl(url);
    if (d.includes("github")) return "🐙";
    if (d.includes("google") && !d.includes("mail") && !d.includes("calendar")) return "🔍";
    if (d.includes("youtube")) return "▶️";
    if (d.includes("slack")) return "💬";
    if (d.includes("twitter") || d.includes("x.com")) return "🐦";
    if (d.includes("reddit")) return "🤖";
    if (d.includes("stackoverflow")) return "📚";
    if (d.includes("notion")) return "📝";
    if (d.includes("figma")) return "🎨";
    if (d.includes("linkedin")) return "💼";
    if (d.includes("mail") || d.includes("superhuman")) return "📧";
    if (d.includes("calendar")) return "📅";
    if (d.includes("espn")) return "🏈";
    if (d.includes("claude") || d.includes("anthropic")) return "🤖";
    return "🌐";
  }

  function accentBackground(color) {
    if (!color) return "linear-gradient(145deg, rgba(70, 70, 90, 0.5), rgba(40, 40, 55, 0.7))";
    // Color is now HSL string like "hsl(200, 55%, 45%)"
    // Create a gradient using it at different opacities
    return `linear-gradient(145deg, ${color.replace(")", ", 0.35)")}, ${color.replace(")", ", 0.55)")})`.replace("hsl(", "hsla(").replace("hsl(", "hsla(");
  }

  // ─── Overlay Creation ───

  function createOverlay() {
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "__arc-tab-switcher-overlay";
    overlay.innerHTML = `
      <div class="__arc-switcher-backdrop"></div>
      <div class="__arc-switcher-panel">
        <div class="__arc-switcher-list"></div>
        <div class="__arc-switcher-selected-label"></div>
      </div>
    `;

    document.documentElement.appendChild(overlay);
    overlayVisible = true;
    renderList();

    overlay.querySelector(".__arc-switcher-backdrop")
      .addEventListener("click", () => removeOverlay());
  }

  function renderList() {
    if (!overlay) return;
    const listEl = overlay.querySelector(".__arc-switcher-list");
    const labelEl = overlay.querySelector(".__arc-switcher-selected-label");
    listEl.innerHTML = "";

    tabList.forEach((tab, i) => {
      const item = document.createElement("div");
      item.className = "__arc-switcher-item" +
        (i === selectedIndex ? " __arc-switcher-item--selected" : "");

      const domain = getDomainFromUrl(tab.url);
      let thumbContent;
      let faviconBadge = "";

      if (tab.thumbnail) {
        thumbContent = `<img class="__arc-switcher-thumb" src="${tab.thumbnail}" />`;
        if (tab.favIconUrl) {
          faviconBadge = `<div class="__arc-switcher-favicon-badge"><img src="${escapeHtml(tab.favIconUrl)}" onerror="this.parentElement.innerHTML='<span class=\\'__arc-switcher-favicon-badge-emoji\\'>${getEmojiForDomain(tab.url)}</span>'" /></div>`;
        } else {
          faviconBadge = `<div class="__arc-switcher-favicon-badge"><span class="__arc-switcher-favicon-badge-emoji">${getEmojiForDomain(tab.url)}</span></div>`;
        }
      } else {
        const bg = accentBackground(tab.accentColor);
        if (tab.favIconUrl) {
          thumbContent = `<div class="__arc-switcher-thumb-favicon" style="background: ${bg}"><img src="${escapeHtml(tab.favIconUrl)}" onerror="this.outerHTML='<span class=\\'__arc-switcher-thumb-favicon-emoji\\'>${getEmojiForDomain(tab.url)}</span>'" /></div>`;
        } else {
          thumbContent = `<div class="__arc-switcher-thumb-favicon" style="background: ${bg}"><span class="__arc-switcher-thumb-favicon-emoji">${getEmojiForDomain(tab.url)}</span></div>`;
        }
      }

      const currentBadge = i === 0 ? `<div class="__arc-switcher-current-badge">current</div>` : "";

      item.innerHTML = `
        ${faviconBadge}
        ${currentBadge}
        <div class="__arc-switcher-thumb-wrap">
          ${thumbContent}
        </div>
        <div class="__arc-switcher-item-info">
          <div class="__arc-switcher-item-title">${escapeHtml(truncate(tab.title, 45))}</div>
          <div class="__arc-switcher-item-url">${escapeHtml(domain)}</div>
        </div>
      `;

      item.addEventListener("click", () => switchToTab(tabList[i].id));
      item.addEventListener("mouseenter", () => { selectedIndex = i; renderList(); });
      listEl.appendChild(item);
    });

    if (tabList[selectedIndex]) {
      labelEl.textContent = tabList[selectedIndex].title;
    }

    const selected = listEl.querySelector(".__arc-switcher-item--selected");
    if (selected) {
      selected.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }

  // ─── Core Logic ───
  //
  // 1. Command fires → start listening, start timer (300ms)
  // 2. If ALL modifiers release BEFORE timer → quick switch (instant, no overlay)
  // 3. If timer fires while modifier still held → show overlay
  // 4. Once overlay is visible, arrow keys / Tab navigate
  // 5. Releasing all modifiers → switch to selected tab

  function startSwitcher(tabs, currentTabId, qsTabId) {
    tabList = tabs;
    selectedIndex = tabs.length > 1 ? 1 : 0;

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);

    // Start timer — if modifier still held after threshold, show overlay
    showOverlayTimer = setTimeout(() => {
      showOverlayTimer = null;
      // Only show if we haven't already cleaned up (quick switch)
      if (tabList.length > 0 && !overlayVisible) {
        createOverlay();
      }
    }, HOLD_THRESHOLD);
  }

  function advanceSelection() {
    selectedIndex = (selectedIndex + 1) % tabList.length;
    // User tapped Tab again — they want the overlay, show it immediately
    if (!overlayVisible) {
      clearTimeout(showOverlayTimer);
      showOverlayTimer = null;
      createOverlay();
    } else {
      renderList();
    }
  }

  function switchToTab(tabId) {
    chrome.runtime.sendMessage({ type: "SWITCH_TO_TAB", tabId }, () => {
      removeOverlay();
    });
  }

  function removeOverlay() {
    if (showOverlayTimer) {
      clearTimeout(showOverlayTimer);
      showOverlayTimer = null;
    }
    if (overlay) { overlay.remove(); overlay = null; }
    overlayVisible = false;
    tabList = [];
    document.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("keyup", handleKeyUp, true);
    window.__arcTabSwitcherInjected = false;
  }

  // ─── Keyboard Handling ───

  function isModifierKey(key) {
    return key === "Control" || key === "Alt" || key === "Meta";
  }

  function handleKeyDown(e) {
    if (!tabList.length) return;
    const key = e.key;
    if (isModifierKey(key)) return;

    e.stopPropagation();
    e.preventDefault();

    switch (key) {
      case "ArrowRight":
      case "ArrowDown":
        selectedIndex = (selectedIndex + 1) % tabList.length;
        if (!overlayVisible) {
          clearTimeout(showOverlayTimer);
          showOverlayTimer = null;
          createOverlay();
        } else {
          renderList();
        }
        break;

      case "ArrowLeft":
      case "ArrowUp":
        selectedIndex = (selectedIndex - 1 + tabList.length) % tabList.length;
        if (!overlayVisible) {
          clearTimeout(showOverlayTimer);
          showOverlayTimer = null;
          createOverlay();
        } else {
          renderList();
        }
        break;

      case "Tab":
        if (e.shiftKey) {
          selectedIndex = (selectedIndex - 1 + tabList.length) % tabList.length;
        } else {
          selectedIndex = (selectedIndex + 1) % tabList.length;
        }
        if (!overlayVisible) {
          clearTimeout(showOverlayTimer);
          showOverlayTimer = null;
          createOverlay();
        } else {
          renderList();
        }
        break;

      case "Enter":
        switchToTab(tabList[selectedIndex].id);
        break;

      case "Escape":
        removeOverlay();
        break;
    }
  }

  function handleKeyUp(e) {
    if (!tabList.length) return;
    if (!isModifierKey(e.key)) return;

    const anyModifierStillHeld = e.ctrlKey || e.altKey || e.metaKey;
    if (anyModifierStillHeld) return;

    // ALL modifiers released
    e.stopPropagation();
    e.preventDefault();

    // If timer is still pending, this is a quick release → instant switch
    if (showOverlayTimer) {
      clearTimeout(showOverlayTimer);
      showOverlayTimer = null;
    }

    // Switch to selected tab (index 1 = previous tab for quick switch)
    if (tabList.length > 0 && tabList[selectedIndex]) {
      switchToTab(tabList[selectedIndex].id);
    } else {
      removeOverlay();
    }
  }

  // ─── Message Listener ───

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SHOW_SWITCHER") {
      startSwitcher(message.tabs, message.currentTabId, message.quickSwitchTabId);
      sendResponse({ ok: true });
    } else if (message.type === "PING_OVERLAY") {
      sendResponse({ showing: overlayVisible || tabList.length > 0 });
    } else if (message.type === "ADVANCE_SELECTION") {
      advanceSelection();
      sendResponse({ ok: true });
    }
  });
})();
