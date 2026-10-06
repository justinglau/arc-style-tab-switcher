# Arc-Style Tab Switcher for Chrome

Bring Arc tab toggling to Chrome: a keyboard-driven, most-recently-used (MRU) tab switcher with a visual overlay showing tab previews.

Chrome's built-in Ctrl+Tab cycles tabs left-to-right by position. This extension switches tabs by **recency**, so the tab you were just on is always one keystroke away.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/arc-style-tab-switcher/bdfjigibgpkjgmpmgccdkkmigbdcpacl)

---

## How It Works

**Quick switch:** Tap `Ctrl+Tab` and release. Instantly jumps to your previous tab. Tap again to jump back, just like Alt+Tab between two windows.

**Browse your tabs:** Hold `Ctrl+Tab` for a moment and a visual overlay appears showing your open tabs in MRU order. Each tab shows a screenshot preview (or a styled favicon card), the page title, and the domain.

**Navigate and select:** While holding Ctrl, use arrow keys (← → ↑ ↓) or keep tapping Tab to move through the list. Release Ctrl to switch to the highlighted tab. Press Escape to cancel.

---

## Features

- **MRU tab ordering:** Tabs sorted by most recently used, not by position
- **Quick toggle:** A fast Ctrl+Tab instantly switches between your two most recent tabs, including on `chrome://` pages
- **Visual overlay:** Horizontal card strip with tab screenshots, favicons, titles, and URLs
- **Hybrid previews:** Real page screenshots when available, styled favicon cards with unique colors as fallback
- **Keyboard navigation:** Arrow keys, Tab/Shift+Tab, Enter, Escape
- **Mouse support:** Move the mouse to highlight, click to switch
- **Works in web editors:** Handles focus inside embedded editors such as Google Docs and Gmail compose
- **Lightweight:** No external dependencies, no data collection, everything stays local

---

## Installation

### From the Chrome Web Store

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/arc-style-tab-switcher/bdfjigibgpkjgmpmgccdkkmigbdcpacl). The default shortcut is `Alt+T` (Option+T on Mac).

### From source

1. Download this repo (green **Code** button → **Download ZIP**) and unzip it somewhere permanent, such as Documents. Chrome runs the extension from this folder, so don't delete or move it afterward.
2. Open Chrome → go to `chrome://extensions/`
3. Turn on **Developer mode** (toggle in top right)
4. If you have the Web Store version installed, turn it off
5. Click **Load unpacked** → select the folder that contains `manifest.json`
6. Accept the permission prompt
7. Go to `chrome://extensions/shortcuts` and confirm the shortcut is `Alt+T` (Option+T on Mac)

### Set up Ctrl+Tab (recommended)

Chrome reserves `Ctrl+Tab` and won't let extensions use it. To get the real Ctrl+Tab experience, add a lightweight OS-level key remap that only applies to Chrome.

#### macOS (Karabiner-Elements)

1. Install [Karabiner-Elements](https://karabiner-elements.pqrs.org/)
2. Grant Input Monitoring permission in System Settings → Privacy & Security
3. Open Terminal and run:
   ```bash
   mkdir -p ~/.config/karabiner/assets/complex_modifications
   ```
4. Create the remap config:
   ```bash
   cat > ~/.config/karabiner/assets/complex_modifications/arc-tab-switcher.json << 'EOF'
   {
     "title": "Arc Tab Switcher",
     "rules": [
       {
         "description": "Remap Ctrl+Tab to Alt+T (for Arc Tab Switcher in Chrome)",
         "manipulators": [
           {
             "type": "basic",
             "from": {
               "key_code": "tab",
               "modifiers": { "mandatory": ["control"] }
             },
             "to": [
               {
                 "key_code": "t",
                 "modifiers": ["option"]
               }
             ],
             "conditions": [
               {
                 "type": "frontmost_application_if",
                 "bundle_identifiers": ["^com\\.google\\.Chrome$"]
               }
             ]
           }
         ]
       },
       {
         "description": "Remap Ctrl+Arrows to Alt+Arrows in Chrome (for tab switcher navigation)",
         "manipulators": [
           {
             "type": "basic",
             "from": { "key_code": "up_arrow", "modifiers": { "mandatory": ["control"] } },
             "to": [{ "key_code": "up_arrow", "modifiers": ["option"] }],
             "conditions": [{ "type": "frontmost_application_if", "bundle_identifiers": ["^com\\.google\\.Chrome$"] }]
           },
           {
             "type": "basic",
             "from": { "key_code": "down_arrow", "modifiers": { "mandatory": ["control"] } },
             "to": [{ "key_code": "down_arrow", "modifiers": ["option"] }],
             "conditions": [{ "type": "frontmost_application_if", "bundle_identifiers": ["^com\\.google\\.Chrome$"] }]
           },
           {
             "type": "basic",
             "from": { "key_code": "left_arrow", "modifiers": { "mandatory": ["control"] } },
             "to": [{ "key_code": "left_arrow", "modifiers": ["option"] }],
             "conditions": [{ "type": "frontmost_application_if", "bundle_identifiers": ["^com\\.google\\.Chrome$"] }]
           },
           {
             "type": "basic",
             "from": { "key_code": "right_arrow", "modifiers": { "mandatory": ["control"] } },
             "to": [{ "key_code": "right_arrow", "modifiers": ["option"] }],
             "conditions": [{ "type": "frontmost_application_if", "bundle_identifiers": ["^com\\.google\\.Chrome$"] }]
           }
         ]
       }
     ]
   }
   EOF
   ```
5. Open Karabiner-Elements → Complex Modifications → Add predefined rule → enable both rules

#### Windows (AutoHotkey)

1. Install [AutoHotkey v2](https://www.autohotkey.com/)
2. Create `arc-tab-switcher.ahk`:
   ```ahk
   #Requires AutoHotkey v2.0
   #HotIf WinActive("ahk_exe chrome.exe")
   ^Tab::!t
   ^Up::!Up
   ^Down::!Down
   ^Left::!Left
   ^Right::!Right
   #HotIf
   ```
3. Run the script (optionally add it to startup)

---

## Usage

| Action | Result |
|---|---|
| Quick `Ctrl+Tab` release | Instant switch to previous tab |
| Hold `Ctrl+Tab`, release Tab | Overlay appears with tab previews |
| Arrow keys (while holding Ctrl) | Navigate through tabs |
| Tab / Shift+Tab (while holding Ctrl) | Move forward / backward |
| Release Ctrl | Switch to highlighted tab |
| Escape | Cancel and close overlay |
| Click a tab card | Switch to that tab |

---

## How Thumbnails Work

The extension captures a small screenshot each time you switch to a tab. Thumbnails build up as you browse. Tabs you haven't visited since starting Chrome show a styled favicon card with a unique color based on the domain until you visit them.

Screenshots can't be captured for `chrome://` internal pages, which always show the favicon card.

---

## Privacy

This extension collects **zero data**. Everything stays local in your browser's memory:

- Tab titles, URLs, and favicons are read to display the overlay
- Screenshots are captured locally for thumbnail previews
- Tab activation order is tracked for MRU sorting
- **Nothing is ever transmitted, written to disk, or shared with anyone.** All data is cleared when Chrome quits.

See the full [Privacy Policy](https://www.notion.so/Privacy-Policy-Arc-Style-Tab-Switcher-30318e68c3e58096ae27f5f418afc3cd?source=copy_link).

---

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read tab titles, URLs, and favicons, and switch the active tab |
| `scripting` | Load the switcher into tabs that were already open when the extension was installed or updated |
| `storage` | Keep tab order and thumbnails in memory while Chrome briefly pauses the extension (cleared when Chrome quits) |
| Access to all sites | Run a small listener on each page so a quick Ctrl+Tab is detected reliably, display the overlay, and capture thumbnail screenshots |

---

## Known Limitations

- The overlay can't appear on `chrome://` pages or the Chrome Web Store (quick toggle still works there)
- Thumbnails only exist for tabs visited since Chrome was started
- Requires Karabiner (Mac) or AutoHotkey (Windows) for the actual `Ctrl+Tab` binding

---

## License

MIT. Do whatever you want with it.
