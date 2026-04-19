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

### Daily Goal
> Shipped in [v2.0.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v2.0.0)

- User-defined daily listening goal in Settings.
- Goal progress is visible in the popup.
- `0` disables the goal without removing the setting.

### Keep History Forever
> Shipped in [v2.0.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v2.0.0)

- Added a `Forever` retention option alongside monthly history limits.
- Users can keep all history without automatic pruning.
- The setting stays optional so the default behavior remains lightweight.

### LocalStorage Optimization
> Shipped in [v2.0.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v2.0.0)

- Storage was restructured into separate keys for today, sessions, and compact history.
- Old day session details are no longer kept forever.
- Migration from the older format happens automatically.

### Runtime Refactor
> Shipped in [v2.0.0](https://github.com/vvertax/DailyTimeTracker/releases/tag/v2.0.0)

- The hosted runtime was split into `main.mjs`, `core.mjs`, `dtt_optimization.mjs`, and `version.json`.
- This makes updates easier to maintain and deploy.

### Channel Runtime Isolation
> Shipped in [v2.0.1](https://github.com/vvertax/DailyTimeTracker/releases/tag/v2.0.1)

- `release`, `test`, and `dev` now use clearer channel-specific runtime files.
- Test and Dev are easier to update without touching the main release entry flow.
- Shared infrastructure such as API endpoints and storage optimization can still stay centralized when needed.

### Top Tracks Today
> Shipped in [v2.0.2-test](https://github.com/vvertax/DailyTimeTracker/releases/tag/v2.0.2-test)

- Optional `Top tracks` block under the main daily total in the popup.
- Shows the most played tracks for the current day only.
- Settings allow showing `1`, `2`, or `3` tracks.
- The block is disabled by default.
- Track plays are only counted after at least `20` seconds of real playback to avoid fake skip-to-end counts.

---

## Planned

> No release-focused milestone is locked right now, but the following ideas are considered genuinely useful and likely to stay in scope.

- `Yesterday vs Today`
  - Quick comparison against the previous day to show whether listening time is up or down.
- `Longest Session Today`
  - A compact summary of the single longest session in the current day.
- `Goal Forecast`
  - Estimate whether the current pace will reach the daily goal and how much time is left.
- `Top Artists Today`
  - Artist-level aggregation on top of track-level daily listening data.
- `History Filters`
  - Simple filters such as goal-reached days, long-session days, or days above a chosen total threshold.
- Smaller UI polish and maintenance updates continue between larger feature milestones.

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
