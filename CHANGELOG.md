# Changelog

## 2.1.0

- Fixed: a quick Ctrl+Tab sometimes opened the overlay instead of switching to the previous tab
- Fixed: overlay could get stuck open and scroll on its own when the mouse was over it
- Fixed: tab order and thumbnails were lost when Chrome paused the extension
- Fixed: thumbnails often failed to capture
- Faster overlay: smaller thumbnails, no full redraw on every move
- Quick toggle now works on chrome:// pages and inside embedded editors (Google Docs, Gmail compose)
- Permissions: removed activeTab and favicon; added storage and access to all sites

## 2.0.0

- Initial public release: MRU tab switching, quick toggle, visual overlay with screenshots and favicon cards
