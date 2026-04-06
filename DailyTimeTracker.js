// ==============================================================
// Daily Time Tracker - Spicetify Extension
// Tracks Spotify listening time by day and shows a hover breakdown.
// ==============================================================

(function DailyTimeTracker() {
    if (
        !Spicetify ||
        !Spicetify.Player ||
        !Spicetify.LocalStorage ||
        !Spicetify.Platform
    ) {
        setTimeout(DailyTimeTracker, 500);
        return;
    }

    const GLOBAL_RUNTIME_KEY = "__dtt_runtime_v1";
    window[GLOBAL_RUNTIME_KEY]?.cleanup?.();

    const CONFIG = {
        storageKey: "dtt_today_v3",
        historyKey: "dtt_history_v2",
        languageKey: "dtt_language_v1",
        retentionKey: "dtt_history_retention_months_v1",
        carryOverTimerKey: "dtt_carry_over_timer_enabled_v1",
        widgetCarryoverKey: "dtt_widget_carryover_v1",
        historyRetentionMonths: 1,
        maxHistoryRetentionMonths: 6,
        pauseSeconds: 30,
        saveIntervalSeconds: 10,
        tickMs: 1000,
        hidePopupDelayMs: 120,
        popupExitAnimationMs: 160,
        injectRetryMs: 800,
        popupOffsetPx: 10,
        viewportMarginPx: 16,
        maxPopupWidthPx: 520,
        todaySessionsToggleThreshold: 5,
        collapsedTodaySessionsCount: 1,
        topbarSelectors: [
            ".main-topBar-topbarContent",
            ".Root__top-bar header",
            "[data-testid='topbar']",
            ".main-globalNav-searchSection .main-globalNav-searchContainer"
        ]
    };

    let historyCache = null;

    const state = {
        day: loadTodayData(),
        language: loadLanguage(),
        historyRetentionMonths: loadHistoryRetentionMonths(),
        carryOverTimerEnabled: loadCarryOverTimerEnabled(),
        widgetCarryoverSeconds: loadWidgetCarryoverSeconds(),
        currentSession: null,
        idleStartedAt: null,
        silenceSeconds: 0,
        lastTickAt: Date.now(),
        lastPersistAt: Date.now(),
        popup: {
            node: null,
            isPinned: false,
            hideTimeoutId: null,
            removeTimeoutId: null,
            hintNode: null,
            titleNode: null,
            summaryDateNode: null,
            summaryTotalNode: null,
            sessionsTitleNode: null,
            intervalsListNode: null,
            todaySessionsToggleNode: null,
            todaySessionsExpanded: false,
            historyTitleNode: null,
            historyListNode: null,
            lastHistorySignature: "",
            lastLanguage: null,
            languageButtons: [],
            retentionLabelNode: null,
            retentionSuffixNode: null,
            settingsOpen: false,
            settingsGearNode: null,
            settingsBackNode: null,
            settingsPanelNode: null,
            settingsLangTitleNode: null,
            settingsRetentionTitleNode: null,
            settingsCarryOverTitleNode: null,
            settingsCarryOverHintNode: null,
            settingsCarryOverInputNode: null,
            lastHeight: 0
        },
        ui: {
            widget: null,
            timeNode: null,
            pendingInjectCheck: false,
            resizeHandler: null,
            beforeUnloadHandler: null,
            visibilityHandler: null
        },
        runtime: {
            intervalId: null,
            injectObserver: null,
            injectRetryTimeoutId: null
        }
    };

    const I18N = {
        ru: {
            widgetTitle: "Нажмите, чтобы закрепить статистику",
            popupTitle: "Статистика по дням",
            popupHintPinned: "Закреплено. Нажмите, чтобы открепить.",
            popupHintHover: "Предпросмотр. Нажмите, чтобы закрепить.",
            todayLabel: "сегодня",
            emptyState: "Пока нет данных по дням.",
            sessionsTodayTitle: "Сессии сегодня",
            historyTitle: "История",
            retentionLabel: "Хранить историю",
            retentionSuffix: "месяц(ев)",
            settingsTitle: "Настройки",
            settingsBack: "Назад",
            languageLabel: "Язык",
            languageRu: "RU",
            languageEn: "ENG"
        },
        en: {
            widgetTitle: "Click to pin statistics",
            popupTitle: "Daily History",
            popupHintPinned: "Pinned. Click to unpin.",
            popupHintHover: "Hover preview. Click to pin.",
            todayLabel: "today",
            emptyState: "No daily history yet.",
            sessionsTodayTitle: "Today Sessions",
            historyTitle: "History",
            retentionLabel: "Keep history for",
            retentionSuffix: "months",
            settingsTitle: "Settings",
            settingsBack: "Back",
            languageLabel: "Language",
            languageRu: "RU",
            languageEn: "ENG"
        }
    };

    injectStyles();
    createWidget();
    bindWidgetEvents();
    startWidgetInjection();
    startTrackingLoop();
    bindWindowEvents();
    window[GLOBAL_RUNTIME_KEY] = {
        cleanup
    };

    console.log("[DailyTimeTracker] Ready.");

    if (!state.currentSession && !Spicetify.Player.isPlaying() && state.widgetCarryoverSeconds > 0) {
        resetWidgetCarryover();
    }

    function pad2(value) {
        return String(value).padStart(2, "0");
    }

    function formatDateString(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    function getTodayString() {
        return formatDateString(new Date());
    }

    function getHistoryCutoffString() {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - state.historyRetentionMonths);
        return formatDateString(cutoff);
    }

    function normalizeHistoryRetentionMonths(value) {
        const normalized = Math.floor(Number(value) || CONFIG.historyRetentionMonths);
        return Math.min(CONFIG.maxHistoryRetentionMonths, Math.max(1, normalized));
    }

    function getMonthsPlural(n) {
        if (state.language === "ru") {
            const mod10 = n % 10;
            const mod100 = n % 100;
            if (mod100 >= 11 && mod100 <= 19) return "месяцев";
            if (mod10 === 1) return "месяц";
            if (mod10 >= 2 && mod10 <= 4) return "месяца";
            return "месяцев";
        }
        return n === 1 ? "month" : "months";
    }

    function formatDuration(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const days = Math.floor(safeSeconds / 86400);
        const hours = Math.floor((safeSeconds % 86400) / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;
        const time = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

        return days > 0 ? `${pad2(days)}:${time}` : time;
    }

    function formatClockTime(timestamp) {
        const date = new Date(timestamp);
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
    }

    function safeParse(value, fallback) {
        if (!value) return fallback;

        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function getIntervalDurationSeconds(interval) {
        return Math.max(0, Math.floor((interval.end - interval.start) / 1000));
    }

    function getIntervalsTotalSeconds(intervals) {
        return intervals.reduce((total, interval) => total + getIntervalDurationSeconds(interval), 0);
    }

    function normalizeInterval(interval) {
        if (!interval || typeof interval.start !== "number" || typeof interval.end !== "number") {
            return null;
        }

        if (interval.end <= interval.start) {
            return null;
        }

        return {
            start: interval.start,
            end: interval.end
        };
    }

    function cloneInterval(interval) {
        return {
            start: interval.start,
            end: interval.end
        };
    }

    function createEmptyDay(date) {
        return {
            date,
            totalSeconds: 0,
            intervals: []
        };
    }

    function normalizeDayData(data, fallbackDate) {
        return {
            date: typeof data?.date === "string" ? data.date : fallbackDate,
            totalSeconds: Math.max(0, Math.floor(Number(data?.totalSeconds) || 0)),
            intervals: Array.isArray(data?.intervals)
                ? data.intervals.map(normalizeInterval).filter(Boolean)
                : []
        };
    }

    function normalizeHistoryEntry(entry) {
        if (typeof entry === "number") {
            return {
                totalSeconds: Math.max(0, Math.floor(entry)),
                intervals: []
            };
        }

        return {
            totalSeconds: Math.max(0, Math.floor(Number(entry?.totalSeconds) || 0)),
            intervals: Array.isArray(entry?.intervals)
                ? entry.intervals.map(normalizeInterval).filter(Boolean)
                : []
        };
    }

    function pruneHistoryEntries(history) {
        const cutoffString = getHistoryCutoffString();
        let changed = false;
        const prunedHistory = {};

        for (const [date, entry] of Object.entries(history || {})) {
            if (date < cutoffString) {
                changed = true;
                continue;
            }

            prunedHistory[date] = entry;
        }

        return {
            history: prunedHistory,
            changed
        };
    }

    function loadHistoryData() {
        if (historyCache === null) {
            const parsedHistory = safeParse(Spicetify.LocalStorage.get(CONFIG.historyKey), {});
            const { history, changed } = pruneHistoryEntries(parsedHistory);
            historyCache = history;

            if (changed) {
                Spicetify.LocalStorage.set(CONFIG.historyKey, JSON.stringify(historyCache));
            }
        }

        return historyCache;
    }

    function readHistory() {
        return loadHistoryData();
    }

    function loadHistoryRetentionMonths() {
        return normalizeHistoryRetentionMonths(
            Spicetify.LocalStorage.get(CONFIG.retentionKey)
        );
    }

    function loadCarryOverTimerEnabled() {
        return Spicetify.LocalStorage.get(CONFIG.carryOverTimerKey) === "1";
    }

    function saveCarryOverTimerEnabled() {
        Spicetify.LocalStorage.set(
            CONFIG.carryOverTimerKey,
            state.carryOverTimerEnabled ? "1" : "0"
        );
    }

    function loadWidgetCarryoverSeconds() {
        return Math.max(0, Math.floor(Number(Spicetify.LocalStorage.get(CONFIG.widgetCarryoverKey)) || 0));
    }

    function saveWidgetCarryoverSeconds() {
        Spicetify.LocalStorage.set(CONFIG.widgetCarryoverKey, String(state.widgetCarryoverSeconds));
    }

    function saveHistoryRetentionMonths() {
        Spicetify.LocalStorage.set(CONFIG.retentionKey, String(state.historyRetentionMonths));
    }

    function loadLanguage() {
        const saved = Spicetify.LocalStorage.get(CONFIG.languageKey);
        return saved === "en" ? "en" : "ru";
    }

    function saveLanguage() {
        Spicetify.LocalStorage.set(CONFIG.languageKey, state.language);
    }

    function t(key) {
        return I18N[state.language][key];
    }

    function getCarryOverTimerLabel() {
        if (state.language === "ru") {
            return "\u041d\u0435 \u0441\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0442\u044c \u0432\u0435\u0440\u0445\u043d\u0438\u0439 \u0442\u0430\u0439\u043c\u0435\u0440 \u043f\u043e\u0441\u043b\u0435 00:00";
        }

        return "Keep top timer running after 00:00";
    }

    function getCarryOverTimerHint() {
        if (state.language === "ru") {
            return "\u0412 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u0434\u043d\u0435\u0439 \u0441\u0431\u0440\u043e\u0441 \u043e\u0441\u0442\u0430\u0435\u0442\u0441\u044f \u043e\u0431\u044b\u0447\u043d\u044b\u043c.";
        }

        return "Daily history still resets normally at midnight.";
    }

    function saveHistory(history) {
        historyCache = pruneHistoryEntries(history).history;
        Spicetify.LocalStorage.set(CONFIG.historyKey, JSON.stringify(historyCache));
    }

    function applyHistoryRetentionMonths(nextValue) {
        const normalized = normalizeHistoryRetentionMonths(nextValue);
        if (normalized === state.historyRetentionMonths) {
            return;
        }

        state.historyRetentionMonths = normalized;
        saveHistoryRetentionMonths();
        saveHistory(readHistory());
    }

    function applyCarryOverTimerEnabled(nextValue) {
        const normalized = Boolean(nextValue);
        if (normalized === state.carryOverTimerEnabled) {
            return;
        }

        state.carryOverTimerEnabled = normalized;
        saveCarryOverTimerEnabled();

        if (!normalized) {
            resetWidgetCarryover();
        }
    }

    function resetWidgetCarryover() {
        if (state.widgetCarryoverSeconds === 0) {
            return;
        }

        state.widgetCarryoverSeconds = 0;
        saveWidgetCarryoverSeconds();
    }

    function addWidgetCarryover(secondsToAdd) {
        const normalized = Math.max(0, Math.floor(Number(secondsToAdd) || 0));
        if (normalized <= 0) {
            return;
        }

        state.widgetCarryoverSeconds += normalized;
        saveWidgetCarryoverSeconds();
    }

    function getStoredDayTotalSeconds(day) {
        const storedTotal = Math.max(0, Math.floor(Number(day?.totalSeconds) || 0));
        const intervalsTotal = getIntervalsTotalSeconds(Array.isArray(day?.intervals) ? day.intervals : []);
        return Math.max(storedTotal, intervalsTotal);
    }

    function getVisibleSessionInterval(now = Date.now()) {
        if (!state.currentSession) {
            return null;
        }

        const liveEnd = state.idleStartedAt === null
            ? now
            : Math.min(now, state.idleStartedAt + CONFIG.pauseSeconds * 1000);

        return normalizeInterval({
            start: state.currentSession.start,
            end: liveEnd
        });
    }

    function getComputedDayTotalSeconds(now = Date.now()) {
        const intervalsTotal = getIntervalsTotalSeconds(state.day.intervals);
        const visibleSession = getVisibleSessionInterval(now);
        return intervalsTotal + (visibleSession ? getIntervalDurationSeconds(visibleSession) : 0);
    }

    function getWidgetTotalSeconds(now = Date.now()) {
        const dayTotalSeconds = getComputedDayTotalSeconds(now);
        return state.carryOverTimerEnabled
            ? state.widgetCarryoverSeconds + dayTotalSeconds
            : dayTotalSeconds;
    }

    function createPersistedDaySnapshot(now = Date.now()) {
        return {
            date: state.day.date,
            totalSeconds: getComputedDayTotalSeconds(now),
            intervals: state.day.intervals.map(cloneInterval)
        };
    }

    function saveTodayData(now = Date.now()) {
        const snapshot = createPersistedDaySnapshot(now);
        state.lastPersistAt = now;
        Spicetify.LocalStorage.set(CONFIG.storageKey, JSON.stringify(snapshot));
    }

    function archiveDay(day) {
        if (!day) {
            return;
        }

        const totalSeconds = getStoredDayTotalSeconds(day);
        if (totalSeconds <= 0 && day.intervals.length === 0) {
            return;
        }

        const history = readHistory();
        const existing = normalizeHistoryEntry(history[day.date]);

        history[day.date] = {
            totalSeconds: existing.totalSeconds + totalSeconds,
            intervals: existing.intervals.concat(day.intervals.map(cloneInterval))
        };

        saveHistory(history);
    }

    function loadTodayData() {
        const today = getTodayString();
        const saved = safeParse(Spicetify.LocalStorage.get(CONFIG.storageKey), null);
        const normalized = normalizeDayData(saved, today);

        if (normalized.date !== today) {
            archiveDay(normalized);
            const freshDay = createEmptyDay(today);
            Spicetify.LocalStorage.set(CONFIG.storageKey, JSON.stringify(freshDay));
            return freshDay;
        }

        return normalized;
    }

    function getMidnightTimestamp(dateString) {
        return new Date(`${dateString}T23:59:59.999`).getTime() + 1;
    }

    function clampIntervalEnd(interval, maxEnd) {
        const end = Math.min(interval.end, maxEnd);
        if (end <= interval.start) {
            return null;
        }

        return {
            start: interval.start,
            end
        };
    }

    function startSession(startAt) {
        if (!state.currentSession) {
            state.currentSession = { start: startAt, end: null };
        }
    }

    function closeSession(endAt) {
        if (!state.currentSession) return;

        const interval = normalizeInterval({
            start: state.currentSession.start,
            end: endAt
        });

        if (interval) {
            state.day.intervals.push(interval);
        }

        state.currentSession = null;
        resetWidgetCarryover();
    }

    function rolloverDayIfNeeded() {
        const today = getTodayString();
        if (today === state.day.date) {
            return;
        }

        let nextSessionStart = null;
        if (state.currentSession) {
            const midnight = getMidnightTimestamp(state.day.date);
            const cappedSession = clampIntervalEnd(
                { start: state.currentSession.start, end: midnight },
                midnight
            );

            if (cappedSession) {
                state.day.intervals.push(cappedSession);
                if (state.carryOverTimerEnabled) {
                    addWidgetCarryover(getIntervalsTotalSeconds(state.day.intervals));
                    nextSessionStart = midnight;
                }
            }
        }

        archiveDay(state.day);
        state.day = createEmptyDay(today);
        state.currentSession = nextSessionStart ? { start: nextSessionStart, end: null } : null;
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
        if (!nextSessionStart) {
            resetWidgetCarryover();
        }
        saveTodayData();
    }

    function getVisibleIntervals(now = Date.now()) {
        const intervals = state.day.intervals.slice();
        const visibleSession = getVisibleSessionInterval(now);

        if (visibleSession) {
            intervals.push(visibleSession);
        }

        return intervals;
    }

    function injectStyles() {
        document.getElementById("dtt-styles")?.remove();
        const style = document.createElement("style");
        style.id = "dtt-styles";
        style.textContent = `
            /* ── Widget pill ─────────────────────────────────── */
            #dtt-widget {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                margin: 0 10px;
                padding: 5px 13px 5px 10px;
                background: rgba(255, 255, 255, 0.06);
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                position: relative;
                z-index: 99;
                transition: background 0.18s ease, border-color 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
                user-select: none;
                flex-shrink: 0;
                pointer-events: auto;
                -webkit-app-region: no-drag;
                app-region: no-drag;
                font-family: "Spotify Mix", "SpotifyMixUI", var(--font-family, sans-serif);
            }

            #dtt-widget::before {
                content: "";
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #1ed760;
                flex-shrink: 0;
                box-shadow: 0 0 6px #1ed760;
                transition: opacity 0.3s ease, box-shadow 0.3s ease;
            }

            #dtt-widget.dtt-paused::before {
                background: #555;
                box-shadow: none;
            }

            #dtt-widget:hover {
                background: rgba(255, 255, 255, 0.11);
                border-color: rgba(255, 255, 255, 0.18);
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
                transform: translateY(-1px);
            }

            #dtt-widget:active {
                transform: scale(0.97) translateY(0);
                box-shadow: none;
            }

            /* ── Timer text ──────────────────────────────────── */
            #dtt-time {
                min-width: 72px;
                text-align: center;
                white-space: nowrap;
                pointer-events: none;
                font-size: 12.5px;
                font-weight: 700;
                letter-spacing: 0.03em;
                color: var(--spice-text, #fff);
                font-variant-numeric: tabular-nums;
                font-family: inherit;
                transition: opacity 0.25s ease;
            }

            #dtt-widget.dtt-paused #dtt-time {
                opacity: 0.38;
            }

            /* ── Popup container ─────────────────────────────── */
            #dtt-hover-popup {
                position: fixed;
                z-index: 10000;
                width: min(${CONFIG.maxPopupWidthPx}px, calc(100vw - 32px));
                max-height: min(70vh, 720px);
                display: flex;
                flex-direction: column;
                gap: 0;
                padding: 0;
                overflow: hidden;
                border-radius: 16px;
                background: #111111;
                color: #fff;
                font-family: "Spotify Mix", "SpotifyMixUI", var(--font-family, sans-serif);
                box-shadow:
                    0 0 0 1px rgba(255, 255, 255, 0.07),
                    0 8px 24px rgba(0, 0, 0, 0.5),
                    0 32px 64px rgba(0, 0, 0, 0.55);
                opacity: 0;
                transform: translateY(-6px) scale(0.97);
                transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: auto;
                -webkit-app-region: no-drag;
                app-region: no-drag;
            }

            #dtt-hover-popup.dtt-visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            #dtt-hover-popup.dtt-pinned {
                box-shadow:
                    0 0 0 1px rgba(30, 215, 96, 0.3),
                    0 8px 24px rgba(0, 0, 0, 0.5),
                    0 32px 64px rgba(0, 0, 0, 0.55);
            }

            /* ── Header block ────────────────────────────────── */
            .dtt-popup-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                padding: 16px 18px 14px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }

            .dtt-popup-title {
                font-size: 15px;
                font-weight: 700;
                letter-spacing: -0.01em;
                color: #fff;
                padding-top: 2px;
            }

            .dtt-popup-header-right {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 7px;
            }

            /* ── Language switcher ───────────────────────────── */
            .dtt-language-switcher {
                display: inline-flex;
                align-items: center;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.09);
                overflow: hidden;
                gap: 1px;
                padding: 2px;
            }

            .dtt-language-button {
                border: 0;
                background: transparent;
                color: #737373;
                padding: 3px 9px;
                font: inherit;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.04em;
                cursor: pointer;
                border-radius: 999px;
                transition: background 0.15s ease, color 0.15s ease;
            }

            .dtt-language-button:hover {
                color: #e0e0e0;
                background: rgba(255, 255, 255, 0.07);
            }

            .dtt-language-button.is-active {
                background: #1ed760;
                color: #000;
            }

            /* ── Hint line ───────────────────────────────────── */
            .dtt-popup-hint {
                color: #555;
                font-size: 11px;
                text-align: right;
                letter-spacing: 0.01em;
            }

            /* ── Retention control ───────────────────────────── */
            .dtt-retention-control {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                color: #555;
                font-size: 11px;
            }

            .dtt-retention-input {
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.05);
                color: #ccc;
                padding: 3px 8px;
                font: inherit;
                font-size: 11px;
                cursor: pointer;
                width: 56px;
                text-align: center;
                transition: border-color 0.15s ease, background 0.15s ease;
            }

            .dtt-retention-input:focus {
                outline: none;
                border-color: rgba(30, 215, 96, 0.4);
                background: rgba(30, 215, 96, 0.05);
                color: #fff;
            }

            /* ── Summary card ────────────────────────────────── */
            .dtt-popup-summary {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                padding: 20px 18px 18px;
                background: linear-gradient(160deg, rgba(30, 215, 96, 0.09) 0%, rgba(30, 215, 96, 0.04) 100%);
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }

            .dtt-popup-summary span {
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                color: rgba(30, 215, 96, 0.6);
            }

            .dtt-popup-summary strong {
                font-size: 36px;
                font-weight: 800;
                letter-spacing: -0.03em;
                color: #1ed760;
                font-variant-numeric: tabular-nums;
                line-height: 1;
            }

            /* ── Sections wrapper (scrollable body) ──────────── */
            .dtt-popup-section {
                display: flex;
                flex-direction: column;
                gap: 0;
                min-height: 0;
                padding: 14px 18px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .dtt-popup-section:last-child {
                border-bottom: 0;
            }

            /* ── Section headers ─────────────────────────────── */
            .dtt-popup-section-title {
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: #484848;
                margin-bottom: 8px;
            }

            .dtt-popup-section-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 8px;
            }

            .dtt-popup-section-heading .dtt-popup-section-title {
                margin-bottom: 0;
            }

            /* ── Sessions list ───────────────────────────────── */
            .dtt-intervals-list {
                overflow-y: auto;
                min-height: 0;
            }

            .dtt-today-intervals-list {
                max-height: min(32vh, 360px);
            }

            .dtt-intervals-list::-webkit-scrollbar {
                width: 3px;
            }

            .dtt-intervals-list::-webkit-scrollbar-track {
                background: transparent;
            }

            .dtt-intervals-list::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.12);
                border-radius: 999px;
            }

            /* ── Toggle button ───────────────────────────────── */
            .dtt-today-sessions-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                align-self: flex-start;
                width: 24px;
                height: 24px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.05);
                color: #666;
                cursor: pointer;
                transition: background 0.15s ease, color 0.15s ease;
                flex-shrink: 0;
            }

            .dtt-today-sessions-toggle:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ccc;
            }

            .dtt-today-sessions-toggle.is-expanded svg {
                transform: rotate(180deg);
            }

            .dtt-today-sessions-toggle svg {
                width: 13px;
                height: 13px;
                transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            }

            /* ── Row items ───────────────────────────────────── */
            .dtt-interval-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.045);
                transition: opacity 0.15s ease;
            }

            .dtt-interval-item:last-child {
                border-bottom: 0;
            }

            .dtt-interval-item:hover {
                opacity: 0.85;
            }

            .dtt-interval-range {
                color: #c0c0c0;
                font-size: 13px;
                font-weight: 500;
            }

            .dtt-interval-duration {
                color: #606060;
                font-size: 13px;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
                font-weight: 600;
            }

            .dtt-interval-item.is-today .dtt-interval-range {
                color: #e8e8e8;
            }

            .dtt-interval-item.is-today .dtt-interval-duration {
                color: #1ed760;
            }

            /* ── Empty state ─────────────────────────────────── */
            .dtt-empty-state {
                color: #3a3a3a;
                padding: 10px 0 6px;
                font-size: 13px;
                font-style: italic;
            }

            /* ── Settings gear button ────────────────────────── */
            .dtt-settings-gear {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.05);
                color: #555;
                cursor: pointer;
                flex-shrink: 0;
                transition: background 0.15s ease, color 0.15s ease, transform 0.2s ease;
            }

            .dtt-settings-gear:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ccc;
                transform: rotate(40deg);
            }

            .dtt-settings-gear svg {
                width: 13px;
                height: 13px;
            }

            /* ── Settings back button ────────────────────────── */
            .dtt-settings-back {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                border: none;
                background: none;
                color: #666;
                font: inherit;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                padding: 2px 0;
                transition: color 0.15s ease;
            }

            .dtt-settings-back:hover {
                color: #ccc;
            }

            .dtt-settings-back svg {
                width: 12px;
                height: 12px;
            }

            /* ── Settings panel ──────────────────────────────── */
            .dtt-popup-main {
                display: flex;
                flex-direction: column;
                transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .dtt-popup-settings {
                display: none;
                flex-direction: column;
                gap: 0;
                animation: dtt-settings-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
            }

            @keyframes dtt-settings-in {
                from { opacity: 0; transform: translateX(10px); }
                to   { opacity: 1; transform: translateX(0); }
            }

            #dtt-hover-popup.dtt-settings-open .dtt-popup-main {
                display: none;
            }

            #dtt-hover-popup.dtt-settings-open .dtt-popup-settings {
                display: flex;
            }

            /* ── Settings rows ───────────────────────────────── */
            .dtt-settings-row {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 14px 18px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .dtt-settings-row:last-child {
                border-bottom: 0;
            }

            .dtt-settings-row-label {
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: #484848;
            }

            .dtt-settings-row-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .dtt-settings-row-content.is-between {
                align-items: flex-start;
                justify-content: space-between;
            }

            .dtt-settings-row-hint {
                color: #6b6b6b;
                font-size: 12px;
                line-height: 1.35;
                flex: 1;
            }

            .dtt-settings-checkbox {
                width: 16px;
                height: 16px;
                margin-top: 1px;
                accent-color: #1ed760;
                cursor: pointer;
                flex-shrink: 0;
            }

            /* ── Retention value display ─────────────────────── */
            .dtt-retention-suffix {
                font-size: 13px;
                font-weight: 500;
                color: #555;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }

    function createWidget() {
        const widget = document.createElement("div");
        widget.id = "dtt-widget";
        widget.title = t("widgetTitle");
        widget.innerHTML = `<span id="dtt-time">${formatDuration(getWidgetTotalSeconds())}</span>`;

        state.ui.widget = widget;
        state.ui.timeNode = widget.querySelector("#dtt-time");
    }

    function updateWidgetUI(totalSeconds = getWidgetTotalSeconds()) {
        if (state.ui.widget) {
            state.ui.widget.title = t("widgetTitle");
        }
        if (state.ui.timeNode) {
            state.ui.timeNode.textContent = formatDuration(totalSeconds);
        }
    }

    function isUiUpdateSuspended() {
        return document.hidden || document.visibilityState === "hidden";
    }

    function setWidgetPausedState(isPaused, force = false) {
        if (!state.ui.widget || (!force && isUiUpdateSuspended())) {
            return;
        }

        state.ui.widget.classList.toggle("dtt-paused", isPaused);
    }

    function shouldWidgetBePaused() {
        if (Spicetify.Player.isPlaying()) {
            return false;
        }

        if (!state.currentSession) {
            return true;
        }

        return state.silenceSeconds >= CONFIG.pauseSeconds;
    }

    function getDailySummaryRows(todayTotalSeconds = getComputedDayTotalSeconds()) {
        const merged = {
            ...readHistory(),
            [state.day.date]: {
                totalSeconds: todayTotalSeconds,
                intervals: []
            }
        };

        return Object.entries(merged)
            .map(([date, entry]) => [date, normalizeHistoryEntry(entry)])
            .filter(([, entry]) => entry.totalSeconds > 0)
            .sort(([a], [b]) => b.localeCompare(a));
    }

    function getTodayIntervalRows(now = Date.now()) {
        return getVisibleIntervals(now)
            .slice()
            .sort((a, b) => b.start - a.start)
            .map((interval) => ({
                key: `${interval.start}-${interval.end}`,
                label: `${formatClockTime(interval.start)} - ${formatClockTime(interval.end)}`,
                duration: formatDuration(getIntervalDurationSeconds(interval))
            }));
    }

    function getDisplayedTodayIntervalRows(todayIntervalRows) {
        if (state.popup.todaySessionsExpanded) {
            return todayIntervalRows;
        }

        return todayIntervalRows.slice(0, CONFIG.collapsedTodaySessionsCount);
    }

    function updateTodaySessionsToggle(todayIntervalRows) {
        const toggleNode = state.popup.todaySessionsToggleNode;
        if (!toggleNode) {
            return;
        }

        const shouldShowToggle = todayIntervalRows.length > CONFIG.todaySessionsToggleThreshold;
        toggleNode.hidden = !shouldShowToggle;

        if (!shouldShowToggle) {
            state.popup.todaySessionsExpanded = false;
        }

        toggleNode.classList.toggle("is-expanded", state.popup.todaySessionsExpanded);
        toggleNode.setAttribute(
            "aria-label",
            state.popup.todaySessionsExpanded ? "Hide extra sessions" : "Show all sessions"
        );
        toggleNode.title = state.popup.todaySessionsExpanded ? "Hide extra sessions" : "Show all sessions";
    }

    function clearPopupHideTimeout() {
        if (state.popup.hideTimeoutId !== null) {
            clearTimeout(state.popup.hideTimeoutId);
            state.popup.hideTimeoutId = null;
        }
    }

    function ensurePopup() {
        if (state.popup.node) {
            return state.popup.node;
        }

        if (state.popup.removeTimeoutId !== null) {
            clearTimeout(state.popup.removeTimeoutId);
            state.popup.removeTimeoutId = null;
        }

        document.getElementById("dtt-hover-popup")?.remove();

        const popupNode = document.createElement("div");
        popupNode.id = "dtt-hover-popup";
        popupNode.addEventListener("mouseenter", clearPopupHideTimeout);
        popupNode.addEventListener("mouseleave", () => {
            if (!state.popup.isPinned) {
                schedulePopupHide();
            }
        });
        popupNode.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePopupPinnedState();
        });

        document.body.appendChild(popupNode);
        state.popup.node = popupNode;
        buildPopupContent(popupNode);
        return popupNode;
    }

    function buildPopupContent(root) {
        root.innerHTML = "";

        // ── Header (always visible) ──────────────────────────
        const header = document.createElement("div");
        header.className = "dtt-popup-header";

        const title = document.createElement("div");
        title.className = "dtt-popup-title";
        title.textContent = t("popupTitle");

        const headerRight = document.createElement("div");
        headerRight.style.cssText = "display:flex;align-items:center;gap:8px;";

        const hint = document.createElement("div");
        hint.className = "dtt-popup-hint";

        const gearBtn = document.createElement("button");
        gearBtn.type = "button";
        gearBtn.className = "dtt-settings-gear";
        gearBtn.title = t("settingsTitle");
        gearBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>`;
        gearBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openSettings();
        });

        headerRight.append(hint, gearBtn);
        header.append(title, headerRight);
        root.appendChild(header);

        // ── Main content panel ───────────────────────────────
        const mainPanel = document.createElement("div");
        mainPanel.className = "dtt-popup-main";

        const summary = document.createElement("div");
        summary.className = "dtt-popup-summary";
        const dateNode = document.createElement("span");
        const totalNode = document.createElement("strong");
        summary.append(dateNode, totalNode);
        mainPanel.appendChild(summary);

        const intervalsSection = document.createElement("div");
        intervalsSection.className = "dtt-popup-section";
        const intervalsHeading = document.createElement("div");
        intervalsHeading.className = "dtt-popup-section-heading";
        const intervalsTitle = document.createElement("div");
        intervalsTitle.className = "dtt-popup-section-title";
        intervalsTitle.textContent = t("sessionsTodayTitle");
        const intervalsList = document.createElement("div");
        intervalsList.className = "dtt-intervals-list dtt-today-intervals-list";
        const todaySessionsToggle = document.createElement("button");
        todaySessionsToggle.type = "button";
        todaySessionsToggle.className = "dtt-today-sessions-toggle";
        todaySessionsToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>`;
        todaySessionsToggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.popup.todaySessionsExpanded = !state.popup.todaySessionsExpanded;
            updatePopupDynamicContentV2();
        });
        intervalsHeading.append(intervalsTitle, todaySessionsToggle);
        intervalsSection.append(intervalsHeading, intervalsList);
        mainPanel.appendChild(intervalsSection);

        const historySection = document.createElement("div");
        historySection.className = "dtt-popup-section";
        const historyTitle = document.createElement("div");
        historyTitle.className = "dtt-popup-section-title";
        historyTitle.textContent = t("historyTitle");
        const historyList = document.createElement("div");
        historyList.className = "dtt-intervals-list";
        historySection.append(historyTitle, historyList);
        mainPanel.appendChild(historySection);

        root.appendChild(mainPanel);

        // ── Settings panel ───────────────────────────────────
        const settingsPanel = document.createElement("div");
        settingsPanel.className = "dtt-popup-settings";

        // Language row
        const langRow = document.createElement("div");
        langRow.className = "dtt-settings-row";
        const langTitle = document.createElement("div");
        langTitle.className = "dtt-settings-row-label";
        langTitle.textContent = t("languageLabel");
        const langContent = document.createElement("div");
        langContent.className = "dtt-settings-row-content";

        const languageSwitcher = document.createElement("div");
        languageSwitcher.className = "dtt-language-switcher";
        state.popup.languageButtons = [];
        const languageOptions = [
            { code: "ru", label: t("languageRu") },
            { code: "en", label: t("languageEn") }
        ];
        for (const option of languageOptions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dtt-language-button${state.language === option.code ? " is-active" : ""}`;
            button.textContent = option.label;
            button.dataset.lang = option.code;
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (state.language === option.code) return;
                state.language = option.code;
                saveLanguage();
                updateWidgetUI();
                updatePopupStaticTextV2();
            });
            languageSwitcher.appendChild(button);
            state.popup.languageButtons.push(button);
        }
        langContent.appendChild(languageSwitcher);
        langRow.append(langTitle, langContent);
        settingsPanel.appendChild(langRow);

        // Retention row
        const retRow = document.createElement("div");
        retRow.className = "dtt-settings-row";
        const retTitle = document.createElement("div");
        retTitle.className = "dtt-settings-row-label";
        retTitle.textContent = t("retentionLabel");
        const retContent = document.createElement("div");
        retContent.className = "dtt-settings-row-content";

        const retentionInput = document.createElement("input");
        retentionInput.type = "number";
        retentionInput.min = "1";
        retentionInput.max = String(CONFIG.maxHistoryRetentionMonths);
        retentionInput.step = "1";
        retentionInput.value = String(state.historyRetentionMonths);
        retentionInput.className = "dtt-retention-input";
        retentionInput.title = `1–${CONFIG.maxHistoryRetentionMonths}`;
        retentionInput.addEventListener("click", (event) => event.stopPropagation());
        retentionInput.addEventListener("change", (event) => {
            event.stopPropagation();
            applyHistoryRetentionMonths(event.target.value);
            event.target.value = String(state.historyRetentionMonths);
            if (state.popup.retentionSuffixNode) {
                state.popup.retentionSuffixNode.textContent = getMonthsPlural(state.historyRetentionMonths);
            }
            updatePopupStaticTextV2();
            updatePopupDynamicContentV2();
            updatePopupHistoryV2(getDailySummaryRows(getComputedDayTotalSeconds()));
        });

        const retSuffix = document.createElement("span");
        retSuffix.className = "dtt-retention-suffix";
        retSuffix.textContent = getMonthsPlural(state.historyRetentionMonths);

        retContent.append(retentionInput, retSuffix);
        retRow.append(retTitle, retContent);
        settingsPanel.appendChild(retRow);

        const carryOverRow = document.createElement("div");
        carryOverRow.className = "dtt-settings-row";
        const carryOverTitle = document.createElement("div");
        carryOverTitle.className = "dtt-settings-row-label";
        carryOverTitle.textContent = getCarryOverTimerLabel();
        const carryOverContent = document.createElement("div");
        carryOverContent.className = "dtt-settings-row-content is-between";
        const carryOverHint = document.createElement("div");
        carryOverHint.className = "dtt-settings-row-hint";
        carryOverHint.textContent = getCarryOverTimerHint();
        const carryOverInput = document.createElement("input");
        carryOverInput.type = "checkbox";
        carryOverInput.className = "dtt-settings-checkbox";
        carryOverInput.checked = state.carryOverTimerEnabled;
        carryOverInput.addEventListener("click", (event) => event.stopPropagation());
        carryOverInput.addEventListener("change", (event) => {
            event.stopPropagation();
            applyCarryOverTimerEnabled(event.target.checked);
            updatePopupStaticTextV2();
            syncVisibleUI();
        });

        carryOverContent.append(carryOverHint, carryOverInput);
        carryOverRow.append(carryOverTitle, carryOverContent);
        settingsPanel.appendChild(carryOverRow);

        root.appendChild(settingsPanel);

        // ── Save node refs ───────────────────────────────────
        state.popup.titleNode = title;
        state.popup.hintNode = hint;
        state.popup.summaryDateNode = dateNode;
        state.popup.summaryTotalNode = totalNode;
        state.popup.sessionsTitleNode = intervalsTitle;
        state.popup.intervalsListNode = intervalsList;
        state.popup.todaySessionsToggleNode = todaySessionsToggle;
        state.popup.historyTitleNode = historyTitle;
        state.popup.historyListNode = historyList;
        state.popup.retentionLabelNode = retTitle;
        state.popup.retentionSuffixNode = retSuffix;
        state.popup.settingsGearNode = gearBtn;
        state.popup.settingsPanelNode = settingsPanel;
        state.popup.settingsLangTitleNode = langTitle;
        state.popup.settingsRetentionTitleNode = retTitle;
        state.popup.settingsCarryOverTitleNode = carryOverTitle;
        state.popup.settingsCarryOverHintNode = carryOverHint;
        state.popup.settingsCarryOverInputNode = carryOverInput;
        state.popup.lastHistorySignature = "";
        state.popup.lastHeight = 0;
        state.popup.lastLanguage = state.language;
        state.popup.settingsOpen = false;

        updatePopupStaticTextV2();
        updatePopupDynamicContentV2();
        updatePopupHistoryV2();
    }

    function openSettings() {
        if (!state.popup.node) return;
        state.popup.settingsOpen = true;
        state.popup.node.classList.add("dtt-settings-open");
        if (state.popup.titleNode) state.popup.titleNode.textContent = t("settingsTitle");
        if (state.popup.settingsGearNode) {
            state.popup.settingsGearNode.style.display = "none";
        }
        // Show back button if not already created
        if (!state.popup.settingsBackNode) {
            const backBtn = document.createElement("button");
            backBtn.type = "button";
            backBtn.className = "dtt-settings-back";
            backBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
            </svg>${t("settingsBack")}`;
            backBtn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                closeSettings();
            });
            // Insert back button into header right
            const headerRight = state.popup.settingsGearNode?.parentElement;
            if (headerRight) headerRight.insertBefore(backBtn, state.popup.settingsGearNode);
            state.popup.settingsBackNode = backBtn;
        } else {
            state.popup.settingsBackNode.style.display = "";
        }
        positionPopup();
    }

    function closeSettings() {
        if (!state.popup.node) return;
        state.popup.settingsOpen = false;
        state.popup.node.classList.remove("dtt-settings-open");
        if (state.popup.titleNode) state.popup.titleNode.textContent = t("popupTitle");
        if (state.popup.settingsGearNode) state.popup.settingsGearNode.style.display = "";
        if (state.popup.settingsBackNode) state.popup.settingsBackNode.style.display = "none";
        positionPopup();
    }

    function renderRows(listNode, rows) {
        listNode.innerHTML = "";

        if (rows.length === 0) {
            const empty = document.createElement("div");
            empty.className = "dtt-empty-state";
            empty.textContent = t("emptyState");
            listNode.appendChild(empty);
            return;
        }

        for (const row of rows) {
            const item = document.createElement("div");
            item.className = `dtt-interval-item${row.isToday ? " is-today" : ""}`;
            if (row.key) {
                item.dataset.key = row.key;
            }

            const range = document.createElement("span");
            range.className = "dtt-interval-range";
            range.textContent = row.label;

            const duration = document.createElement("span");
            duration.className = "dtt-interval-duration";
            duration.textContent = row.duration;

            item.append(range, duration);
            listNode.appendChild(item);
        }
    }

    function createHistorySignature(rows) {
        return rows
            .map(([date, entry]) => `${date}:${entry.totalSeconds}`)
            .join("|");
    }

    function updatePopupStaticTextV2() {
        if (!state.popup.node) {
            return;
        }

        if (state.popup.titleNode) {
            state.popup.titleNode.textContent = state.popup.settingsOpen
                ? t("settingsTitle")
                : t("popupTitle");
        }
        if (state.popup.hintNode) {
            state.popup.hintNode.textContent = state.popup.isPinned ? t("popupHintPinned") : t("popupHintHover");
        }
        if (state.popup.sessionsTitleNode) {
            state.popup.sessionsTitleNode.textContent = t("sessionsTodayTitle");
        }
        if (state.popup.historyTitleNode) {
            state.popup.historyTitleNode.textContent = t("historyTitle");
        }
        if (state.popup.settingsLangTitleNode) {
            state.popup.settingsLangTitleNode.textContent = t("languageLabel");
        }
        if (state.popup.settingsRetentionTitleNode) {
            state.popup.settingsRetentionTitleNode.textContent = t("retentionLabel");
        }
        if (state.popup.settingsCarryOverTitleNode) {
            state.popup.settingsCarryOverTitleNode.textContent = getCarryOverTimerLabel();
        }
        if (state.popup.settingsCarryOverHintNode) {
            state.popup.settingsCarryOverHintNode.textContent = getCarryOverTimerHint();
        }
        if (state.popup.settingsCarryOverInputNode) {
            state.popup.settingsCarryOverInputNode.checked = state.carryOverTimerEnabled;
        }
        if (state.popup.retentionSuffixNode) {
            state.popup.retentionSuffixNode.textContent = getMonthsPlural(state.historyRetentionMonths);
        }
        if (state.popup.settingsGearNode) {
            state.popup.settingsGearNode.title = t("settingsTitle");
        }
        if (state.popup.settingsBackNode) {
            state.popup.settingsBackNode.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px">
                <polyline points="15 18 9 12 15 6"/>
            </svg>${t("settingsBack")}`;
        }
        for (const button of state.popup.languageButtons ?? []) {
            button.classList.toggle("is-active", button.dataset.lang === state.language);
        }
        state.popup.lastLanguage = state.language;
    }

    function updatePopupDynamicContentV2(options = {}) {
        if (!state.popup.node) {
            return;
        }

        const now = options.now ?? Date.now();
        const totalSeconds = options.totalSeconds ?? getComputedDayTotalSeconds(now);
        const todayIntervalRows = options.todayIntervalRows ?? getTodayIntervalRows(now);

        if (state.popup.hintNode) {
            state.popup.hintNode.textContent = state.popup.isPinned ? t("popupHintPinned") : t("popupHintHover");
        }
        if (state.popup.summaryDateNode) {
            state.popup.summaryDateNode.textContent = state.day.date;
        }
        if (state.popup.summaryTotalNode) {
            state.popup.summaryTotalNode.textContent = formatDuration(totalSeconds);
        }
        if (state.popup.intervalsListNode) {
            renderRows(
                state.popup.intervalsListNode,
                getDisplayedTodayIntervalRows(todayIntervalRows).map((row) => ({
                    ...row,
                    isToday: true
                }))
            );
        }
        updateTodaySessionsToggle(todayIntervalRows);
    }

    function updatePopupHistoryV2(dailySummaryRows = getDailySummaryRows()) {
        if (!state.popup.node || !state.popup.historyListNode) {
            return;
        }

        const historySignature = `${state.language}|${createHistorySignature(dailySummaryRows)}`;
        if (historySignature === state.popup.lastHistorySignature) {
            return;
        }

        renderRows(
            state.popup.historyListNode,
            dailySummaryRows.map(([date, entry]) => ({
                key: date,
                label: date === state.day.date ? `${date} (${t("todayLabel")})` : date,
                duration: formatDuration(entry.totalSeconds),
                isToday: date === state.day.date
            }))
        );

        state.popup.lastHistorySignature = historySignature;
    }

    function positionPopup() {
        const popupNode = state.popup.node;
        const widget = state.ui.widget;
        if (!popupNode || !widget) {
            return;
        }

        const widgetRect = widget.getBoundingClientRect();
        const popupRect = popupNode.getBoundingClientRect();
        const popupWidth = popupRect.width || Math.min(CONFIG.maxPopupWidthPx, window.innerWidth - 32);
        const popupHeight = popupRect.height || 0;
        let left = widgetRect.left;
        let top = widgetRect.bottom + CONFIG.popupOffsetPx;

        if (left + popupWidth > window.innerWidth - CONFIG.viewportMarginPx) {
            left = window.innerWidth - popupWidth - CONFIG.viewportMarginPx;
        }

        if (left < CONFIG.viewportMarginPx) {
            left = CONFIG.viewportMarginPx;
        }

        if (top + popupHeight > window.innerHeight - CONFIG.viewportMarginPx) {
            top = Math.max(
                CONFIG.viewportMarginPx,
                widgetRect.top - popupHeight - CONFIG.popupOffsetPx
            );
        }

        popupNode.style.left = `${left}px`;
        popupNode.style.top = `${top}px`;
    }

    function showPopup() {
        clearPopupHideTimeout();

        const popupNode = ensurePopup();
        updatePopupStaticTextV2();
        updatePopupDynamicContentV2();
        updatePopupHistoryV2();
        popupNode.classList.toggle("dtt-pinned", state.popup.isPinned);
        positionPopup();

        requestAnimationFrame(() => {
            if (state.popup.node === popupNode) {
                popupNode.classList.add("dtt-visible");
            }
        });
    }

    function hidePopup(force = false) {
        clearPopupHideTimeout();

        const popupNode = state.popup.node;
        if (!popupNode) {
            return;
        }

        if (!force && state.popup.isPinned) {
            return;
        }

        popupNode.classList.remove("dtt-visible");
        state.popup.node = null;
        state.popup.titleNode = null;
        state.popup.hintNode = null;
        state.popup.summaryDateNode = null;
        state.popup.summaryTotalNode = null;
        state.popup.sessionsTitleNode = null;
        state.popup.intervalsListNode = null;
        state.popup.todaySessionsToggleNode = null;
        state.popup.todaySessionsExpanded = false;
        state.popup.historyTitleNode = null;
        state.popup.historyListNode = null;
        state.popup.lastHistorySignature = "";
        state.popup.lastHeight = 0;
        state.popup.lastLanguage = null;
        state.popup.languageButtons = [];
        state.popup.retentionLabelNode = null;
        state.popup.retentionSuffixNode = null;
        state.popup.settingsOpen = false;
        state.popup.settingsGearNode = null;
        state.popup.settingsBackNode = null;
        state.popup.settingsPanelNode = null;
        state.popup.settingsLangTitleNode = null;
        state.popup.settingsRetentionTitleNode = null;
        state.popup.settingsCarryOverTitleNode = null;
        state.popup.settingsCarryOverHintNode = null;
        state.popup.settingsCarryOverInputNode = null;

        state.popup.removeTimeoutId = setTimeout(() => {
            state.popup.removeTimeoutId = null;
            popupNode.remove();
        }, CONFIG.popupExitAnimationMs);
    }

    function schedulePopupHide() {
        clearPopupHideTimeout();
        state.popup.hideTimeoutId = setTimeout(() => {
            const widgetHovered = state.ui.widget?.matches(":hover");
            const popupHovered = state.popup.node?.matches(":hover");

            if (!widgetHovered && !popupHovered) {
                hidePopup();
            }
        }, CONFIG.hidePopupDelayMs);
    }

    function togglePopupPinnedState() {
        state.popup.isPinned = !state.popup.isPinned;

        if (state.popup.isPinned) {
            showPopup();
            return;
        }

        const widgetHovered = state.ui.widget?.matches(":hover");
        const popupHovered = state.popup.node?.matches(":hover");

        if (!widgetHovered && !popupHovered) {
            hidePopup(true);
        } else {
            showPopup();
        }
    }

    function bindWidgetEvents() {
        const widget = state.ui.widget;
        if (!widget) return;

        widget.addEventListener("mouseenter", showPopup);
        widget.addEventListener("mouseleave", () => {
            if (!state.popup.isPinned) {
                schedulePopupHide();
            }
        });
        widget.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePopupPinnedState();
        });
    }

    function findTopbarContainer() {
        for (const selector of CONFIG.topbarSelectors) {
            const container = document.querySelector(selector);
            if (!container) {
                continue;
            }

            const searchInput =
                container.querySelector("[data-testid='search-input']") ||
                container.querySelector("input[type='text']");

            if (searchInput) {
                const searchWrapper =
                    searchInput.closest(".x-searchInput-searchInputContainer") ||
                    searchInput.closest("[class*='searchBar']") ||
                    searchInput.parentElement;

                if (searchWrapper?.parentElement) {
                    return {
                        type: "before-search",
                        parent: searchWrapper.parentElement,
                        anchor: searchWrapper
                    };
                }
            }

            return {
                type: "prepend",
                parent: container
            };
        }

        return null;
    }

    function injectWidget() {
        if (document.getElementById("dtt-widget")) {
            return true;
        }

        const target = findTopbarContainer();
        if (!target) {
            return false;
        }

        if (target.type === "before-search") {
            target.parent.insertBefore(state.ui.widget, target.anchor);
            return true;
        }

        if (target.parent.firstChild) {
            target.parent.insertBefore(state.ui.widget, target.parent.firstChild);
        } else {
            target.parent.appendChild(state.ui.widget);
        }

        return true;
    }

    function scheduleInjectRetry() {
        if (state.runtime.injectRetryTimeoutId !== null) {
            clearTimeout(state.runtime.injectRetryTimeoutId);
        }

        state.runtime.injectRetryTimeoutId = setTimeout(() => {
            state.runtime.injectRetryTimeoutId = null;
            if (!document.getElementById("dtt-widget")) {
                injectWidget();
            }
        }, CONFIG.injectRetryMs);
    }

    function startWidgetInjection() {
        if (!injectWidget()) {
            scheduleInjectRetry();
        }

        const observer = new MutationObserver(() => {
            if (document.getElementById("dtt-widget") || state.ui.pendingInjectCheck) {
                return;
            }

            state.ui.pendingInjectCheck = true;
            requestAnimationFrame(() => {
                state.ui.pendingInjectCheck = false;

                if (!document.getElementById("dtt-widget") && !injectWidget()) {
                    scheduleInjectRetry();
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        state.runtime.injectObserver = observer;
    }

    function updateTrackingState(now) {
        state.lastTickAt = now;

        rolloverDayIfNeeded();

        if (Spicetify.Player.isPlaying()) {
            setWidgetPausedState(false);
            state.idleStartedAt = null;
            state.silenceSeconds = 0;
            startSession(now);
            return;
        }

        if (!state.currentSession) {
            setWidgetPausedState(true);
            return;
        }

        if (state.idleStartedAt === null) {
            state.idleStartedAt = now;
        }

        state.silenceSeconds = Math.floor((now - state.idleStartedAt) / 1000);

        if (state.silenceSeconds < CONFIG.pauseSeconds) {
            setWidgetPausedState(false);
            return;
        }

        setWidgetPausedState(true);
        closeSession(state.idleStartedAt + CONFIG.pauseSeconds * 1000);
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
        saveTodayData(now);
    }

    function flushTodayIfNeeded() {
        const now = Date.now();
        if (now - state.lastPersistAt >= CONFIG.saveIntervalSeconds * 1000) {
            saveTodayData(now);
        }
    }

    function syncVisibleUI(now = Date.now()) {
        if (isUiUpdateSuspended()) {
            return;
        }

        const totalSeconds = getComputedDayTotalSeconds(now);
        updateWidgetUI(
            state.carryOverTimerEnabled
                ? state.widgetCarryoverSeconds + totalSeconds
                : totalSeconds
        );
        setWidgetPausedState(shouldWidgetBePaused(), true);

        if (state.popup.node) {
            const dailySummaryRows = getDailySummaryRows(totalSeconds);
            if (state.popup.lastLanguage !== state.language) {
                updatePopupStaticTextV2();
            }
            updatePopupDynamicContentV2({
                now,
                totalSeconds,
                todayIntervalRows: getTodayIntervalRows(now)
            });
            updatePopupHistoryV2(dailySummaryRows);
            const popupHeight = state.popup.node.offsetHeight;
            if (popupHeight !== state.popup.lastHeight) {
                state.popup.lastHeight = popupHeight;
                positionPopup();
            }
        }
    }

    function startTrackingLoop() {
        state.runtime.intervalId = setInterval(() => {
            const now = Date.now();
            updateTrackingState(now);
            if (!isUiUpdateSuspended()) {
                syncVisibleUI(now);
            }
            flushTodayIfNeeded();
        }, CONFIG.tickMs);
    }

    function bindWindowEvents() {
        state.ui.resizeHandler = () => {
            if (state.popup.node) {
                positionPopup();
            }
        };

        state.ui.beforeUnloadHandler = () => {
            clearPopupHideTimeout();

            if (state.currentSession) {
                closeSession(Date.now());
            }

            saveTodayData();
        };

        state.ui.visibilityHandler = () => {
            if (!isUiUpdateSuspended()) {
                syncVisibleUI();
            }
        };

        window.addEventListener("resize", state.ui.resizeHandler);
        window.addEventListener("beforeunload", state.ui.beforeUnloadHandler);
        document.addEventListener("visibilitychange", state.ui.visibilityHandler);
    }

    function cleanup() {
        clearPopupHideTimeout();
        if (state.runtime.intervalId !== null) {
            clearInterval(state.runtime.intervalId);
            state.runtime.intervalId = null;
        }
        state.runtime.injectObserver?.disconnect?.();
        state.runtime.injectObserver = null;
        if (state.runtime.injectRetryTimeoutId !== null) {
            clearTimeout(state.runtime.injectRetryTimeoutId);
            state.runtime.injectRetryTimeoutId = null;
        }
        if (state.popup.removeTimeoutId !== null) {
            clearTimeout(state.popup.removeTimeoutId);
            state.popup.removeTimeoutId = null;
        }
        state.popup.node = null;
        state.popup.hintNode = null;
        state.popup.titleNode = null;
        state.popup.summaryDateNode = null;
        state.popup.summaryTotalNode = null;
        state.popup.sessionsTitleNode = null;
        state.popup.intervalsListNode = null;
        state.popup.todaySessionsToggleNode = null;
        state.popup.todaySessionsExpanded = false;
        state.popup.historyTitleNode = null;
        state.popup.historyListNode = null;
        state.popup.lastHistorySignature = "";
        state.popup.lastHeight = 0;
        state.popup.lastLanguage = null;
        state.popup.retentionLabelNode = null;
        state.popup.retentionSuffixNode = null;
        state.popup.settingsOpen = false;
        state.popup.settingsGearNode = null;
        state.popup.settingsBackNode = null;
        state.popup.settingsPanelNode = null;
        state.popup.settingsLangTitleNode = null;
        state.popup.settingsRetentionTitleNode = null;
        state.popup.settingsCarryOverTitleNode = null;
        state.popup.settingsCarryOverHintNode = null;
        state.popup.settingsCarryOverInputNode = null;
        if (state.ui.resizeHandler) {
            window.removeEventListener("resize", state.ui.resizeHandler);
            state.ui.resizeHandler = null;
        }
        if (state.ui.beforeUnloadHandler) {
            window.removeEventListener("beforeunload", state.ui.beforeUnloadHandler);
            state.ui.beforeUnloadHandler = null;
        }
        if (state.ui.visibilityHandler) {
            document.removeEventListener("visibilitychange", state.ui.visibilityHandler);
            state.ui.visibilityHandler = null;
        }
        state.popup.node?.remove();
        state.ui.widget?.remove();
        document.getElementById("dtt-styles")?.remove();
    }
})();
