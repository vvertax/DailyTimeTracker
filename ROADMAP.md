Want to read in Russian? Click [here](./ROADMAP-Rus.md).

# Daily Time Tracker - Roadmap

> A living document for shipped milestones, active plans, and intentionally dropped ideas.

---

## Shipped

### Streak (Fire Icon)
> Shipped in [v1.3.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.3.0)

- Fire icon in the popup header with a streak counter.
- Color tiers by streak length.
- Resets after a missed full day.
- Uses a 5-minute minimum threshold.

### Export to CSV / JSON
> Shipped in [v1.3.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.3.0)

- CSV export for spreadsheet use.
- JSON export for backup and restore workflows.

### Clear / Reset Data
> Shipped in [v1.3.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.3.0)

- Reset today.
- Clear history.
- Full wipe.

### Import from JSON
> Shipped in [v1.6.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.6.0)

- Merge and replace modes.
- Validation and preview before apply.

### Weekly Summary
> Shipped in [v1.7.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.7.0)

- Dedicated `Week` toggle in the popup header.
- Total listening time for the last 7 days.
- Daily average.
- Most active day.
- Mini 7-day bar chart.

### Compact / Full Popup Modes
> Shipped in [v1.7.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.7.0)

- Compact mode keeps the popup shorter for everyday use.
- Full mode shows all sessions, full history, and the weekly view toggle.
- Popup mode can be changed from Settings.

### Configurable Pause Threshold
> Shipped in [v1.7.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.7.0)

- Users can choose how long playback may stay paused before a session is closed.
- Available presets: `15 / 30 / 60 / 120 sec`.
- The setting is available from Settings and applies to active tracking behavior.

### Streak Shields + Keep Streak
> Shipped in [v1.7.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v1.7.0)

- Up to `4 shields` are available per calendar month.
- A missed day can consume one shield instead of resetting the streak.
- Shields preserve the current streak but do not increase it.
- Optional `Keep streak` mode preserves the current streak without growth while enabled.

---

## Planned

> The next release-focused milestone is `v2.0.0`.

### Daily Goal
> Planned for the release version.

- User-defined daily goal such as `30m`, `1h`, or a custom value.
- Goal progress visible in the widget and popup.
- Test builds are only a pre-release channel for validating the same feature before it lands in Release.

### Keep History Forever
> Planned for the release version.

- Add a `Forever` retention option alongside the monthly presets.
- Show a warning before enabling it because long-term storage usage can grow significantly.
- Keep the default behavior lightweight while allowing power users to keep everything.
- Test builds are only a pre-release channel for validating the same feature before it lands in Release.

## Cancelled

The following ideas were reviewed and intentionally dropped because they were judged to add little practical value for this project.

### Week-over-Week Comparison
> Cancelled - judged not useful enough to keep in scope.

### Weekday Breakdown
> Cancelled - judged not useful enough to keep in scope.

### Listening Pace Indicator
> Cancelled - judged not useful enough to keep in scope.

### Listening Heatmap by Hour
> Cancelled - judged not useful enough to keep in scope.

### Timezone-Aware Day Boundary
> Cancelled - judged not useful enough to keep in scope.

---

## Out of Scope

| Idea | Why deferred |
|---|---|
| Cloud sync | Requires auth infrastructure; LocalStorage is enough for single-device use. |
| Per-track analytics | The available playback APIs are not reliable enough for archival track analytics. |
| Multi-window sync | LocalStorage is not a reliable cross-instance sync channel here. |
| Heavy charting libraries | Too much weight for a lightweight extension. |
