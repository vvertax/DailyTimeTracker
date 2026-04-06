Хотите прочитать на русском? Нажмите [`сюда`](./ROADMAP-Rus.md).

# 🗺️ Daily Time Tracker — Roadmap

> A living document outlining planned features and improvements.
> Items are grouped into phases and roughly ordered by priority within each phase.

---

## Phase 1 — Core Utilities

### ✅ Streak (Fire Icon)
> Shipped in [v1.3.0-PreRelease](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.3.0-PreRelease)

- **Fire icon** in the popup header with a color-coded streak counter.
- **Streak visible** from 2+ consecutive days.
- **Streak counter** displayed next to the fire icon (e.g. `🔥 5`).
- **Pulsing glow** animation for streaks of 3+ days.
- **Streak resets** if you miss a full day of listening (0 seconds).
- Minimum threshold to count a day: **5 min** of listening.
- Streak data persisted in LocalStorage.

Color tiers by streak length:

| Days | Color | Hex |
|------|-------|-----|
| 2+ | 🟠 Orange | `#FF6B1A` |
| 30+ | 🔴 Red | `#EF4444` |
| 90+ | 🩷 Pink | `#EC4899` |
| 100+ | 🟣 Purple | `#9333EA` |
| 150+ | 🔵 Blue | `#3B82F6` |
| 200+ | 🩵 Turquoise | `#40E0D0` |
| 250+ | ⚪ White | `#FFFFFF` |

### ✅ Export to CSV / JSON
> Shipped in [v1.3.0-PreRelease](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.3.0-PreRelease)

One-click download of your listening data from the Settings panel.

- **CSV** — date, total seconds, formatted duration — ready for Excel / Google Sheets.
- **JSON** — full dump including per-day intervals — for developers or backup.
- Export scope: all retained history + today.

### 🗑️ Clear / Reset Data
A destructive action behind a confirmation dialog in Settings.

- **Reset today** — wipe current day, keep history.
- **Clear history** — remove archived days, keep today.
- **Full wipe** — factory reset all stored data.

---

## Phase 2 — Analytics & Insights

### 📊 Weekly Summary
A new toggle in the popup: **Today** / **Week**.

- Total listening time for the last 7 days.
- Daily average.
- Most active day of the week.
- Mini bar-chart or inline sparkline showing each day's total.

###  Weekday Breakdown
Aggregate stats by day of the week across the entire retained history.

- Average per weekday (Mon–Sun).
- Weekday vs. weekend comparison.
- Highlighted "most active weekday."

---

## Phase 3 — Advanced Features

### 🕐 Listening Heatmap by Hour
A 24-column heatmap (0:00–23:00) showing peak listening hours.

- Data source: existing interval timestamps.
- Scope: last 7 days or full retention period (toggle).
- Rendered as a compact SVG bar chart inside the popup.

### 📥 Import from JSON
Restore or merge previously exported data.

- Drag-and-drop or file picker in Settings.
- Merge strategy: combine intervals, take the higher total for overlapping days.
- Validation: reject malformed or suspiciously large payloads.

### 🔔 Goal Notifications
Lightweight in-app alerts (not OS-level).

- "Daily goal reached 🎉" — toast when the target is hit.
- "X-hour marathon" — optional nudge after prolonged listening.
- "New streak record!" — celebrate when the best streak is beaten.
- All notifications can be toggled individually in Settings.

### 🎛️ Compact / Full Popup Modes
Two popup layouts to keep the UI clean as features grow.

**Compact (default):**
- Today's total + fire icon progress.
- Last 1–2 sessions.
- Abbreviated history (3 days).

**Full (toggle):**
- All sessions.
- Weekly summary + streaks.
- Full history list.
- Settings access.

---

## Out of Scope (for now)

| Idea | Why deferred |
|---|---|
| Cloud sync | Requires auth infrastructure; LocalStorage is sufficient for single-device use. |
| Per-track analytics | Spicetify Player API exposes play/pause state but not reliable track metadata for archival. |
| Multi-window sync | LocalStorage doesn't broadcast across Spotify instances reliably. |
| Heavy charting libraries | Bundle size and runtime cost don't justify the value for a lightweight extension. |

---

## Contributing

Have an idea? Open an [issue](https://github.com/vvertax/DailyTimeTracker/issues) or submit a PR.
Feature requests are welcome — just keep in mind the "lightweight & native" philosophy of the project.
