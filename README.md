Хотите прочитать на русском? Нажмите [`сюда`](./README-Rus.md).

# Daily Time Tracker for Spicetify

Tracks how much time you spend listening to Spotify each day and shows a timer in the top bar.

> [!NOTE]
> This codebase was written with the help of ChatGPT.

![Preview](./preview.png)

## Features

- **Top Bar Timer:** Real-time counter in format `HH:MM:SS` or `DD:HH:MM:SS`.
- **Smart Tracking:** Auto-pause after 30 seconds of inactivity; continues tracking if playback resumes quickly.
- **Detailed History:** Hover popup with a breakdown of today's sessions and historical daily totals.
- **Collapse / Expand Toggles:** Today Sessions and History sections collapse to a preview when there are 5+ entries; click the toggle to expand fully.
- **Retention Management:** Choose how long to keep your history (from 1 to 6 months) with automatic pruning.
- **Streak Fire Icon:** A fire icon with a day counter appears in the popup header from a 2-day streak onward; color evolves through multiple tiers as your streak grows.
- **Long Streak Progression:** Optional mode that unlocks extra color tiers (Amber 7+, Ice 225+, Crystal Cyan 250+, Aurora Green 275+, Silver 380+) and moves the White MAX tier to 500+.
- **Export to CSV / JSON:** One-click data export from the Settings panel.
- **Clear / Reset Data:** Three destructive actions — Reset today, Clear history, Full wipe — each behind a confirmation dialog.
- **High Performance:** Optimized DOM rendering updates only changed values, ensuring minimal CPU usage.
- **Hot-Reload Support:** Cleanly reinitializes during Spicetify updates without duplicating UI elements.
- **Language Switcher:** Toggle between `RU` and `EN` directly in the UI.
- **Native Look:** Uses Spotify's native fonts and styles for seamless integration.

## Current UI

- **Top Bar Widget:** Shows current day's total. Hover to see details.
- **Popup Sections:**
    - **Today's Summary:** Large green total for the current day.
    - **Today's Sessions:** Breakdown of individual listening intervals; collapses to 1 session when 5+ are present.
    - **History:** Log of previous days' totals; collapses to 3 days when 5+ are present.
    - **Settings Panel (gear icon):**
        - Language switcher (RU / EN).
        - History retention (1–6 months).
        - Carry-over timer toggle (temporarily disabled).
        - Long streak progression toggle with tier preview.
        - Export CSV / JSON buttons.
        - Reset today / Clear history / Full wipe buttons.
- **Streak Fire Icon:** Appears at 2+ day streak in the popup header; color-coded with a pulsing glow at 3+.
- **Interactivity:** Click the timer or popup to "pin" it (keep it visible).

## Installation

### Using the Spicetify Marketplace (recommended)

1. Open Spicetify Marketplace.
2. Search for `Daily Time Tracker` under the **Extensions** tab.
3. Click **Install**.

### Manual Installation

1. Download `DailyTimeTracker.js` from the [Latest Release](https://github.com/vvertax/DailyTimeTracker/releases).
2. Place the file into your Spicetify Extensions folder:
   `%AppData%\spicetify\Extensions` (Windows) or `~/.config/spicetify/Extensions` (Linux/macOS).
3. Run the following commands:
   ```powershell
   spicetify config extensions DailyTimeTracker.js
   spicetify apply

## Behavior

- **Tracking:** If music is playing, tracked time increases in real-time.
- **Grace Period:** If playback stops for less than 30 seconds, counting continues (useful for quick track changes).
- **Auto-Pause:** If playback is paused for 30 seconds or more, the session is closed and counting stops.
- **Data Persistence:** Current progress is saved every 10 seconds and whenever Spotify is closed or reloaded.
- **Auto-Archive:** When a new day starts, the previous day's total is automatically moved to the history.
- **Maintenance:** History older than your selected retention period (1–6 months) is automatically deleted. Streak calculation always reads the full raw archive, so pruning never breaks a long streak.

## Stored data

The extension uses `Spicetify.LocalStorage` to persist your data across sessions:

- `dtt_today_v3`: Stores the current day's total time and a list of all listening sessions.
- `dtt_history_v2`: An object mapping dates to daily totals and interval lists.
- `dtt_language_v1`: Your preferred UI language (EN/RU).
- `dtt_history_retention_months_v1`: Your setting for how long history should be kept.
- `dtt_streak_v1`: Current streak, best streak, and last qualifying date.
- `dtt_long_streak_progression_enabled_v1`: Whether the long streak color progression is active.
- `dtt_carry_over_timer_enabled_v1`: Carry-over timer setting (currently always disabled).
- `dtt_widget_carryover_v1`: Accumulated carry-over seconds for the top bar timer.

## Notes

- **Performance First:** The extension uses a highly optimized rendering engine that only updates the necessary text nodes in the UI, keeping CPU usage near zero even when the popup is open.
- **Native Experience:** We no longer load external fonts; the extension now uses Spotify's native typography for better performance and a consistent look.
- **Reliability:** Includes a cleanup routine to prevent memory leaks or UI glitches when Spicetify is reloaded or updated.
- **Streak Integrity:** Retention pruning removes old history from the UI but never from streak computation — your streak is always calculated against the full raw archive.
- **Disclaimer:** The code is provided as-is. Changes to Spotify's internal structure may require updates to this extension.

## Roadmap

See the [Roadmap](./ROADMAP.md) for planned features and upcoming improvements.

## License

See [`LICENSE`](./LICENSE).
