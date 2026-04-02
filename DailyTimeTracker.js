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
            retentionLabelNode: null
        },
        ui: {
            widget: null,
            timeNode: null,
            pendingInjectCheck: false,
            resizeHandler: null,
            beforeUnloadHandler: null
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
            retentionLabel: "Сохранять историю",
            retentionSuffix: "месяц(ев)",
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
            retentionLabel: "Keep history",
            retentionSuffix: "months",
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
    }

    function rolloverDayIfNeeded() {
        const today = getTodayString();
        if (today === state.day.date) {
            return;
        }

        if (state.currentSession) {
            const midnight = getMidnightTimestamp(state.day.date);
            const cappedSession = clampIntervalEnd(
                { start: state.currentSession.start, end: midnight },
                midnight
            );

            if (cappedSession) {
                state.day.intervals.push(cappedSession);
            }

            state.currentSession = null;
        }

        archiveDay(state.day);
        state.day = createEmptyDay(today);
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
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
            #dtt-widget {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin: 0 12px;
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 20px;
                border: 1px solid transparent;
                cursor: pointer;
                position: relative;
                z-index: 99;
                transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
                user-select: none;
                flex-shrink: 0;
                pointer-events: auto;
                -webkit-app-region: no-drag;
                app-region: no-drag;
                font-family: "CircularSp", "Circular Std", "Circular", var(--font-family, sans-serif);
            }

            #dtt-widget:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.2);
                transform: scale(1.05);
            }

            #dtt-widget:active {
                transform: scale(0.97);
            }

            #dtt-time {
                min-width: 74px;
                text-align: center;
                white-space: nowrap;
                pointer-events: none;
                font-size: 13px;
                font-weight: 700;
                color: var(--spice-text, #fff);
                font-family: inherit;
            }

            #dtt-widget.dtt-paused #dtt-time {
                opacity: 0.45;
            }

            #dtt-hover-popup {
                position: fixed;
                z-index: 10000;
                width: min(${CONFIG.maxPopupWidthPx}px, calc(100vw - 32px));
                max-height: min(70vh, 720px);
                display: flex;
                flex-direction: column;
                gap: 18px;
                padding: 18px 20px;
                border-radius: 14px;
                background: #181818;
                color: #fff;
                font-family: "CircularSp", "Circular Std", "Circular", var(--font-family, sans-serif);
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
                border: 1px solid rgba(255, 255, 255, 0.08);
                opacity: 0;
                transform: translateY(-4px) scale(0.98);
                transition: opacity 0.16s ease, transform 0.16s ease;
                pointer-events: auto;
                -webkit-app-region: no-drag;
                app-region: no-drag;
            }

            #dtt-hover-popup.dtt-visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            #dtt-hover-popup.dtt-pinned {
                border-color: rgba(29, 185, 84, 0.45);
            }

            .dtt-popup-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
            }

            .dtt-popup-title {
                font-size: 18px;
                font-weight: 800;
                letter-spacing: -0.02em;
                font-family: "CircularSp", "Circular Std", "Arial", sans-serif;
            }

            .dtt-popup-header-right {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 8px;
            }

            .dtt-language-switcher {
                display: inline-flex;
                align-items: center;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.07);
                border: 1px solid rgba(255, 255, 255, 0.08);
                overflow: hidden;
            }

            .dtt-language-button {
                border: 0;
                background: transparent;
                color: #b3b3b3;
                padding: 6px 10px;
                font: inherit;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.15s ease, color 0.15s ease;
            }

            .dtt-language-button:hover {
                color: #fff;
            }

            .dtt-language-button.is-active {
                background: rgba(29, 185, 84, 0.18);
                color: #1ed760;
            }

            .dtt-popup-hint {
                color: #b3b3b3;
                font-size: 12px;
                text-align: right;
            }

            .dtt-retention-control {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: #b3b3b3;
                font-size: 12px;
            }

            .dtt-retention-input {
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.07);
                color: #fff;
                padding: 4px 10px;
                font: inherit;
                cursor: pointer;
                width: 72px;
            }

            .dtt-popup-summary {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                gap: 12px;
                padding: 12px 14px;
                border-radius: 10px;
                background: rgba(29, 185, 84, 0.12);
                color: #1ed760;
                font-weight: 700;
            }

            .dtt-popup-summary strong {
                font-size: 22px;
                font-weight: 800;
            }

            .dtt-popup-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .dtt-popup-section-title {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #b3b3b3;
            }

            .dtt-popup-section-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .dtt-intervals-list {
                overflow-y: auto;
                padding-right: 4px;
            }

            .dtt-today-sessions-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                align-self: flex-start;
                width: 32px;
                height: 32px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.07);
                color: #b3b3b3;
                cursor: pointer;
                transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
            }

            .dtt-today-sessions-toggle:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
            }

            .dtt-today-sessions-toggle.is-expanded svg {
                transform: rotate(180deg);
            }

            .dtt-today-sessions-toggle svg {
                width: 16px;
                height: 16px;
                transition: transform 0.15s ease;
            }

            .dtt-intervals-list::-webkit-scrollbar {
                width: 6px;
            }

            .dtt-intervals-list::-webkit-scrollbar-thumb {
                background: #444;
                border-radius: 999px;
            }

            .dtt-interval-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                padding: 12px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }

            .dtt-interval-item:last-child {
                border-bottom: 0;
            }

            .dtt-interval-range {
                color: #fff;
                font-size: 14px;
            }

            .dtt-interval-duration {
                color: #b3b3b3;
                font-size: 14px;
                white-space: nowrap;
            }

            .dtt-interval-item.is-today .dtt-interval-range,
            .dtt-interval-item.is-today .dtt-interval-duration {
                color: #1ed760;
            }

            .dtt-empty-state {
                color: #b3b3b3;
                padding: 12px 0 4px;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    function createWidget() {
        const widget = document.createElement("div");
        widget.id = "dtt-widget";
        widget.title = t("widgetTitle");
        widget.innerHTML = `<span id="dtt-time">${formatDuration(getComputedDayTotalSeconds())}</span>`;

        state.ui.widget = widget;
        state.ui.timeNode = widget.querySelector("#dtt-time");
    }

    function updateWidgetUI(totalSeconds = getComputedDayTotalSeconds()) {
        if (state.ui.widget) {
            state.ui.widget.title = t("widgetTitle");
        }
        if (state.ui.timeNode) {
            state.ui.timeNode.textContent = formatDuration(totalSeconds);
        }
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

        const header = document.createElement("div");
        header.className = "dtt-popup-header";

        const title = document.createElement("div");
        title.className = "dtt-popup-title";
        title.textContent = t("popupTitle");

        const headerRight = document.createElement("div");
        headerRight.className = "dtt-popup-header-right";

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

                if (state.language === option.code) {
                    return;
                }

                state.language = option.code;
                saveLanguage();
                updateWidgetUI();
                showPopup();
            });
            languageSwitcher.appendChild(button);
            state.popup.languageButtons.push(button);
        }

        const hint = document.createElement("div");
        hint.className = "dtt-popup-hint";

        const retentionControl = document.createElement("label");
        retentionControl.className = "dtt-retention-control";

        const retentionLabel = document.createElement("span");
        retentionLabel.textContent = `${t("retentionLabel")}:`;

        const retentionInput = document.createElement("input");
        retentionInput.type = "number";
        retentionInput.min = "1";
        retentionInput.max = String(CONFIG.maxHistoryRetentionMonths);
        retentionInput.step = "1";
        retentionInput.value = String(state.historyRetentionMonths);
        retentionInput.className = "dtt-retention-input";
        retentionInput.title = `1-${CONFIG.maxHistoryRetentionMonths} ${t("retentionSuffix")}`;

        retentionInput.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        retentionInput.addEventListener("change", (event) => {
            event.stopPropagation();
            applyHistoryRetentionMonths(event.target.value);
            event.target.value = String(state.historyRetentionMonths);
            updatePopupStaticTextV2();
            updatePopupDynamicContentV2();
            updatePopupHistoryV2(getDailySummaryRows(getComputedDayTotalSeconds()));
        });

        retentionControl.append(retentionLabel, retentionInput);

        headerRight.append(languageSwitcher, retentionControl, hint);
        header.append(title, headerRight);
        root.appendChild(header);

        const summary = document.createElement("div");
        summary.className = "dtt-popup-summary";

        const dateNode = document.createElement("span");
        const totalNode = document.createElement("strong");

        summary.append(dateNode, totalNode);
        root.appendChild(summary);

        const intervalsSection = document.createElement("div");
        intervalsSection.className = "dtt-popup-section";

        const intervalsHeading = document.createElement("div");
        intervalsHeading.className = "dtt-popup-section-heading";

        const intervalsTitle = document.createElement("div");
        intervalsTitle.className = "dtt-popup-section-title";
        intervalsTitle.textContent = t("sessionsTodayTitle");

        const intervalsList = document.createElement("div");
        intervalsList.className = "dtt-intervals-list";

        const todaySessionsToggle = document.createElement("button");
        todaySessionsToggle.type = "button";
        todaySessionsToggle.className = "dtt-today-sessions-toggle";
        todaySessionsToggle.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
        `;
        todaySessionsToggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.popup.todaySessionsExpanded = !state.popup.todaySessionsExpanded;
            updatePopupDynamicContentV2();
        });

        intervalsHeading.append(intervalsTitle, todaySessionsToggle);
        intervalsSection.append(intervalsHeading, intervalsList);
        root.appendChild(intervalsSection);

        const historySection = document.createElement("div");
        historySection.className = "dtt-popup-section";

        const historyTitle = document.createElement("div");
        historyTitle.className = "dtt-popup-section-title";
        historyTitle.textContent = t("historyTitle");

        const historyList = document.createElement("div");
        historyList.className = "dtt-intervals-list";

        historySection.append(historyTitle, historyList);
        root.appendChild(historySection);

        state.popup.titleNode = title;
        state.popup.hintNode = hint;
        state.popup.summaryDateNode = dateNode;
        state.popup.summaryTotalNode = totalNode;
        state.popup.sessionsTitleNode = intervalsTitle;
        state.popup.intervalsListNode = intervalsList;
        state.popup.todaySessionsToggleNode = todaySessionsToggle;
        state.popup.historyTitleNode = historyTitle;
        state.popup.historyListNode = historyList;
        state.popup.retentionLabelNode = retentionLabel;
        state.popup.lastHistorySignature = "";
        state.popup.lastLanguage = state.language;
        updatePopupStaticTextV2();
        updatePopupDynamicContentV2();
        updatePopupHistoryV2();
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

    function updatePopupContent(options = {}) {
        if (!state.popup.node) {
            return;
        }

        const now = options.now ?? Date.now();
        const totalSeconds = options.totalSeconds ?? getComputedDayTotalSeconds(now);
        const todayIntervalRows = options.todayIntervalRows ?? getTodayIntervalRows(now);
        const dailySummaryRows = options.dailySummaryRows ?? getDailySummaryRows(totalSeconds);
        if (state.popup.titleNode) {
            state.popup.titleNode.textContent = t("popupTitle");
        }
        if (state.popup.hintNode) {
            state.popup.hintNode.textContent = state.popup.isPinned ? t("popupHintPinned") : t("popupHintHover");
        }
        if (state.popup.summaryDateNode) {
            state.popup.summaryDateNode.textContent = state.day.date;
        }
        if (state.popup.summaryTotalNode) {
            state.popup.summaryTotalNode.textContent = formatDuration(totalSeconds);
        }
        if (state.popup.sessionsTitleNode) {
            state.popup.sessionsTitleNode.textContent = state.language === "ru" ? "Сессии сегодня" : "Today sessions";
        }
        if (state.popup.historyTitleNode) {
            state.popup.historyTitleNode.textContent = state.language === "ru" ? "История" : "History";
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
        if (state.popup.historyListNode) {
            renderRows(
                state.popup.historyListNode,
                dailySummaryRows.map(([date, entry]) => ({
                    key: date,
                    label: date === state.day.date ? `${date} (${t("todayLabel")})` : date,
                    duration: formatDuration(entry.totalSeconds),
                    isToday: date === state.day.date
                }))
            );
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
            state.popup.titleNode.textContent = t("popupTitle");
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
        if (state.popup.retentionLabelNode) {
            state.popup.retentionLabelNode.textContent = `${t("retentionLabel")}:`;
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
        state.popup.lastLanguage = null;
        state.popup.languageButtons = [];

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
            state.ui.widget?.classList.remove("dtt-paused");
            state.idleStartedAt = null;
            state.silenceSeconds = 0;
            startSession(now);
            return;
        }

        if (!state.currentSession) {
            state.ui.widget?.classList.add("dtt-paused");
            return;
        }

        if (state.idleStartedAt === null) {
            state.idleStartedAt = now;
        }

        state.silenceSeconds = Math.floor((now - state.idleStartedAt) / 1000);

        if (state.silenceSeconds < CONFIG.pauseSeconds) {
            state.ui.widget?.classList.remove("dtt-paused");
            return;
        }

        state.ui.widget?.classList.add("dtt-paused");
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

    function startTrackingLoop() {
        state.runtime.intervalId = setInterval(() => {
            const now = Date.now();
            updateTrackingState(now);
            const totalSeconds = getComputedDayTotalSeconds(now);
            updateWidgetUI(totalSeconds);
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

        window.addEventListener("resize", state.ui.resizeHandler);
        window.addEventListener("beforeunload", state.ui.beforeUnloadHandler);
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
        state.popup.lastLanguage = null;
        if (state.ui.resizeHandler) {
            window.removeEventListener("resize", state.ui.resizeHandler);
            state.ui.resizeHandler = null;
        }
        if (state.ui.beforeUnloadHandler) {
            window.removeEventListener("beforeunload", state.ui.beforeUnloadHandler);
            state.ui.beforeUnloadHandler = null;
        }
        state.popup.node?.remove();
        state.ui.widget?.remove();
        document.getElementById("dtt-styles")?.remove();
    }
})();
