# Arc-Style Tab Switcher for Chrome

Bring Arc tab toggling to Chrome — a keyboard-driven, most-recently-used (MRU) tab switcher with a visual overlay showing tab previews.

Chrome's built-in Ctrl+Tab cycles tabs left-to-right by position. This extension switches tabs by **recency** — the tab you were just on is always one keystroke away.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/arc-style-tab-switcher/bdfjigibgpkjgmpmgccdkkmigbdcpacl)
---

## How It Works

**Quick switch** — Tap `Ctrl+Tab` and release. Instantly jumps to your previous tab. Tap again to jump back. Just like Alt+Tab between two windows.

**Browse your tabs** — Hold `Ctrl+Tab` for a moment and a visual overlay appears showing all your open tabs in MRU order. Each tab shows a screenshot preview (or a styled favicon card), the page title, and the domain.

**Navigate and select** — While holding Ctrl, use arrow keys (← → ↑ ↓) or keep tapping Tab to move through the list. Release Ctrl to switch to the highlighted tab. Press Escape to cancel.

---

## Features

- **MRU tab ordering** — Tabs sorted by most recently used, not by position
- **Quick toggle** — Fast Ctrl+Tab instantly switches between your two most recent tabs
- **Visual overlay** — Horizontal card strip with tab screenshots, favicons, titles, and URLs
- **Hybrid previews** — Real page screenshots when available, styled favicon cards with unique colors as fallback
- **Keyboard navigation** — Arrow keys, Tab/Shift+Tab, Enter, Escape
- **Mouse support** — Hover to highlight, click to switch
- **Lightweight** — No external dependencies, no data collection, everything stays local

---

## Installation

### From source

1. Clone this repo or download the ZIP
   ```bash
   git clone https://github.com/YOUR_USERNAME/arc-tab-switcher.git
   ```
2. Open Chrome → go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** → select the `arc-tab-switcher` folder
5. Done! The default shortcut is `Alt+T`

### Set up Ctrl+Tab (recommended)

Chrome reserves `Ctrl+Tab` and won't let extensions use it. To get the real Ctrl+Tab experience, you need a lightweight OS-level key remap that only applies to Chrome.

#### macOS (Karabiner-Elements)

1. Install [Karabiner-Elements](https://karabiner-elements.pqrs.org/)
2. Grant Input Monitoring permissions in System Settings → Privacy & Security
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
5. Open Karabiner-Elements → Complex Modifications → Add predefined rule → Enable both rules

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
3. Run the script (optionally add to startup)

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

The extension captures a screenshot each time you switch to a tab. Thumbnails build up as you browse — tabs you haven't visited since installing will show a styled favicon card with a unique color based on the domain until you visit them.

Screenshots cannot be captured for `chrome://` internal pages, which will always show the favicon fallback.

---

## Privacy

This extension collects **zero data**. Everything stays local in your browser's memory:

- Tab titles, URLs, and favicons are read to display the overlay
- Screenshots are captured locally for thumbnail previews
- Tab activation order is tracked for MRU sorting
- **Nothing is ever transmitted, stored on disk, or shared with anyone**

See the full [Privacy Policy](https://www.notion.so/Privacy-Policy-Arc-Style-Tab-Switcher-30318e68c3e58096ae27f5f418afc3cd?source=copy_link).

---

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read tab metadata and switch active tabs |
| `activeTab` | Inject overlay UI into the current tab |
| `scripting` | Programmatically inject overlay code and styles |
| `favicon` | Display website favicons in the overlay |

---

## Known Limitations

- Cannot inject the overlay on `chrome://` pages (extensions, settings, new tab page)
- Thumbnails only exist for tabs visited after installation
- Requires Karabiner (Mac) or AutoHotkey (Windows) for the actual `Ctrl+Tab` binding

---

## License

MIT — do whatever you want with it.
