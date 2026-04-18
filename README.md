Want to read in Russian? Click [here](./README-Rus.md).

# Daily Time Tracker for Spicetify

Tracks how much time you spend listening to Spotify each day and shows a timer in the top bar.

> [!NOTE]
> This codebase was written with the help of ChatGPT.

![Preview](./preview.png)

## Features

- **Top Bar Timer:** Real-time counter in `HH:MM:SS` or `DD:HH:MM:SS`.
- **Smart Tracking:** Playback pauses are tolerated for a configurable threshold before a session is closed.
- **Configurable Pause Threshold:** Choose `15 / 30 / 60 / 120 sec` from Settings.
- **Detailed History:** Hover popup with today's sessions and archived daily totals.
- **Weekly Summary:** A dedicated `Week` toggle shows the last 7 days, daily average, best day, and a mini bar chart.
- **Compact / Full Popup Modes:** Compact keeps the popup shorter; Full reveals all sessions, full history, and the weekly toggle.
- **Collapsible Lists:** Today Sessions and History collapse automatically in Compact mode.
- **History Retention:** Keep history for 1 to 6 months with automatic pruning in the visible archive.
- **Streak Fire Icon:** A streak counter appears from 2+ consecutive qualifying days.
- **Streak Shields + Keep Streak:** Up to `8` missed days per calendar month can be auto-protected, and an optional manual `Keep streak` toggle preserves the current streak without growth.
- **Long Streak Progression:** Optional extended color progression for long streaks.
- **Export to CSV / JSON:** Download all retained history plus today from Settings.
- **Import from JSON:** Restore or merge a previous JSON export with preview and validation.
- **Clear / Reset Data:** Reset today, clear history, or full wipe with confirmation.
- **Language Switcher:** Toggle between `RU` and `EN` inside the popup.
- **User Badges:** Optional server-side badge shown next to the popup title.
- **Remote Runtime Updates:** The Marketplace loader fetches the main runtime from `https://vvertax.site/dtt/ext/main.mjs` and checks `https://vvertax.site/dtt/ext/version.json` for updates.

## Current UI

- **Top Bar Widget:** Shows the current total for today.
- **Popup Header:** Title, optional user badge, streak icon, mode-aware `Week` toggle, and Settings button.
- **Popup Sections:** Compact mode shows a shorter Today view, while Full mode exposes full session/history lists and the Weekly Summary view.
- **Settings Panel:** Language, popup mode, pause threshold, streak shields, `Keep streak`, history retention, long streak progression, export, import, destructive reset actions, and version text.

## Installation

### Using Spicetify Marketplace

1. Open Spicetify Marketplace.
2. Search for `Daily Time Tracker` in **Extensions**.
3. Click **Install**.

### Manual Installation

1. Download `DailyTimeTracker.js` [here](marketplace/DailyTimeTracker.js).
2. Place it into your Spicetify Extensions folder:
   `%AppData%\spicetify\Extensions` on Windows or `~/.config/spicetify/Extensions` on Linux/macOS.
3. Run:

```powershell
spicetify config extensions DailyTimeTracker.js
spicetify apply
```

## Stored Data

The extension uses `Spicetify.LocalStorage`:

- `dtt_today_v3`
- `dtt_sessions_v1`
- `dtt_history_v2`
- `dtt_language_v1`
- `dtt_history_retention_months_v1`
- `dtt_popup_mode_v1`
- `dtt_pause_threshold_seconds_v1`
- `dtt_streak_v1`
- `dtt_streak_control_v1`
- `dtt_long_streak_progression_enabled_v1`
- `dtt_version_v1`

## Notes

- History pruning affects the visible retained archive, but streak calculation still uses raw history data.
- The remote loader architecture allows faster runtime updates without waiting for Marketplace review.
- The extension depends on Spotify and Spicetify DOM behavior, so Spotify UI changes may require fixes.

## Roadmap

See the [Roadmap](./ROADMAP.md).

## License

See [`LICENSE`](./LICENSE).
