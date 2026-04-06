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
- **Retention Management:** Choose how long to keep your history (from 1 to 6 months) with automatic pruning.
- **High Performance:** Optimized DOM rendering updates only changed values, ensuring minimal CPU usage.
- **Hot-Reload Support:** Cleanly reinitializes during Spicetify updates without duplicating UI elements.
- **Language Switcher:** Toggle between `RU` and `EN` directly in the UI.
- **Native Look:** Uses Spotify's native fonts and styles for seamless integration.

## Current UI

- **Top Bar Widget:** Shows current day's total. Hover to see details.
- **Popup Sections:**
    - **Retention Settings:** Gear icon/dropdown to set history storage duration.
    - **Today's Sessions:** Breakdown of individual listening intervals for the current day.
    - **History:** Log of previous days' totals with the today's row highlighted.
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
- **Maintenance:** History older than your selected retention period (1-6 months) is automatically deleted to keep `LocalStorage` clean.

## Stored data

The extension uses `Spicetify.LocalStorage` to persist your data across sessions:

- `dtt_today_v3`: Stores the current day's total time and a list of all listening sessions.
- `dtt_history_v2`: An array of objects representing previous days' totals.
- `dtt_language_v1`: Your preferred UI language (EN/RU).
- `dtt_history_retention_months_v1`: Your setting for how long history should be kept.

## Notes

- **Performance First:** The extension uses a highly optimized rendering engine that only updates the necessary text nodes in the UI, keeping CPU usage near zero even when the popup is open.
- **Native Experience:** We no longer load external fonts; the extension now uses Spotify's native typography for better performance and a consistent look.
- **Reliability:** Includes a cleanup routine to prevent memory leaks or UI glitches when Spicetify is reloaded or updated.
- **Disclaimer:** The code is provided as-is. Changes to Spotify's internal structure may require updates to this extension.

## Roadmap

See the [Roadmap](./ROADMAP.md) for planned features and upcoming improvements.

## License

See [`LICENSE`](./LICENSE).
