Want to read in Russian? Click [here](./README-Rus.md).

# Daily Time Tracker for Spicetify

Tracks how much time you spend listening to Spotify each day and shows a timer in the top bar.

> [!NOTE]
> This codebase was written with the help of ChatGPT.

![Preview](./preview.png)

## Features

- **Top Bar Timer:** Real-time counter in `HH:MM:SS` or `DD:HH:MM:SS`.
- **Smarter Session Tracking:** Sessions rely on listened time instead of raw paused wall-clock time and close more cleanly when playback actually stops.
- **Configurable Pause Threshold:** Choose `15 / 30 / 60 / 120 sec` from Settings.
- **Detailed History:** Hover popup with today's sessions and archived daily totals.
- **Top Tracks Today:** Optional summary block under the daily total showing the most played tracks for the current day. Track plays only count after at least `20` seconds of real listening time.
- **Weekly Summary + Yesterday vs Today:** A dedicated `Week` toggle shows the last 7 days, daily average, best day, a mini bar chart, and a quick compare view against yesterday.
- **Compact / Full Popup Modes:** Compact keeps the popup shorter; Full reveals all sessions, full history, and the weekly toggle.
- **Performance Mode:** Choose `Default` or `Lightweight` to reduce popup and visual-effect overhead on weaker systems.
- **Daily Goal:** Set a listening goal in minutes and track progress directly in the popup.
- **History Retention + Forever:** Keep history for `1` to `6` months or disable automatic pruning with `Forever`.
- **Streak Fire Icon:** A streak counter appears from `2+` consecutive qualifying days.
- **Streak Shields + Keep Streak:** Up to `4` missed days per calendar month can be auto-protected, and an optional manual `Keep streak` toggle preserves the current streak without growth.
- **Long Streak Progression:** Optional extended color progression for long streaks.
- **Release / Test / Dev Channels:** Switch channels from Settings. Release is stable, while Test and Dev are available for earlier changes.
- **Manual Update Check:** Check for updates from Settings and use the version text as a quick update trigger.
- **Export to CSV / JSON:** Download all retained history plus today from Settings.
- **Import from JSON:** Restore or merge a previous JSON export with preview and validation.
- **Clear / Reset Data:** Reset today, clear history, or perform a full wipe with confirmation.
- **Language Switcher:** Toggle between `RU` and `EN` inside the popup.
- **User Badges:** Optional server-side badge shown next to the popup title.
- **Remote Runtime Updates:** The Marketplace loader fetches the main runtime from `https://vvertax.site/dtt/ext/main.mjs` and checks `https://vvertax.site/dtt/ext/version.json` for updates.

## Current UI

- **Top Bar Widget:** Shows the current total for today.
- **Popup Header:** Title, optional user badge, streak icon, mode-aware `Week` toggle, and Settings button.
- **Today View:** Daily total, optional goal progress, optional top tracks, today's sessions, and retained history.
- **Week View:** Weekly summary with average, best day, mini chart, and a `Yesterday vs Today` subview.
- **Settings Panel:** Language, channel, popup mode, performance mode, top tracks toggle, top tracks count, pause threshold, streak shields, `Keep streak`, daily goal, history retention, long streak progression, badge visibility, export, import, destructive reset actions, manual update check, and version text.

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
- `dtt_daily_goal_seconds_v1`
- `dtt_history_retention_months_v1`
- `dtt_history_retention_forever_v1`
- `dtt_popup_mode_v1`
- `dtt_performance_mode_v1`
- `dtt_pause_threshold_seconds_v1`
- `dtt_streak_v1`
- `dtt_streak_control_v1`
- `dtt_long_streak_progression_enabled_v1`
- `dtt_badge_visibility_v1`
- `dtt_session_track_counts_v1`
- `dtt_top_tracks_visible_v1`
- `dtt_top_tracks_display_count_v1`
- `dtt_channel_v1`
- `dtt_test_notice_seen_v1`
- `dtt_version_v1`

## Notes

- History pruning affects the visible retained archive, but streak calculation still uses raw history data.
- Top-track data is day-based and resets when a new day starts.
- Switching channels requires reloading Spotify.
- The remote loader architecture allows faster runtime updates without waiting for Marketplace review.
- The extension depends on Spotify and Spicetify DOM behavior, so Spotify UI changes may require fixes.

## Roadmap

See the [Roadmap](./ROADMAP.md).

## License

See [`LICENSE`](./LICENSE).
