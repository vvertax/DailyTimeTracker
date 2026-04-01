# Daily Time Tracker for Spicetify

Tracks how much time you spend listening to Spotify each day and shows a timer in the top bar.

This codebase was written with the help of ChatGPT.

## Features

- Timer in the Spotify top bar
- Format: `HH:MM:SS` or `DD:HH:MM:SS`
- Auto-pause after 30 seconds without playback
- Daily reset at midnight with history archiving
- Daily history popup on hover
- Click to pin or unpin popup
- Language switcher: `RU / ENG`
- Local history storage through `Spicetify.LocalStorage`

## Current UI

- Top bar timer
- Hover popup with daily history in format `YYYY-MM-DD - HH:MM:SS`
- Today row is highlighted
- Click on the timer or popup to pin it

## Files

- [`DailyTimeTracker.js`](./DailyTimeTracker.js): main Spicetify extension

## Installation

### Windows quick method

1. Put `DailyTimeTracker.js` into:
   `%AppData%\spicetify\Extensions`
2. Enable it:

```powershell
spicetify config extensions DailyTimeTracker.js
spicetify apply
```

- If music is playing, tracked time increases
- If playback stops for less than 30 seconds, counting continues
- If playback stops for 30 seconds or more, counting pauses
- When Spotify closes, current progress is saved
- When a new day starts, the previous day is archived automatically

## Stored data

The script uses these `Spicetify.LocalStorage` keys:

- `dtt_today_v3`: current day data
- `dtt_history_v2`: archived daily history
- `dtt_language_v1`: selected UI language

## Notes

- The code is provided as-is
- Spotify or Spicetify DOM changes may require future updates
- External font loading may behave differently depending on the environment

## License

See [`LICENSE`](./LICENSE).
