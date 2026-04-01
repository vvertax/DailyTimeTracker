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

    const CONFIG = {
        storageKey: "dtt_today_v3",
        historyKey: "dtt_history_v2",
        languageKey: "dtt_language_v1",
        pauseSeconds: 30,
        saveIntervalSeconds: 10,
        tickMs: 1000,
        hidePopupDelayMs: 120,
        popupExitAnimationMs: 160,
        injectRetryMs: 800,
        popupOffsetPx: 10,
        viewportMarginPx: 16,
        maxPopupWidthPx: 520,
        estimatedPopupHeightPx: 540,
        topbarSelectors: [
            ".main-topBar-topbarContent",
            ".Root__top-bar header",
            "[data-testid='topbar']",
            ".main-globalNav-searchSection .main-globalNav-searchContainer"
        ]
    };

    const state = {
        day: loadTodayData(),
        language: loadLanguage(),
        currentSession: null,
        idleStartedAt: null,
        silenceSeconds: 0,
        secondsSinceLastSave: 0,
        lastTickAt: Date.now(),
        popup: {
            node: null,
            isPinned: false,
            hideTimeoutId: null
        },
        ui: {
            widget: null,
            timeNode: null,
            pendingInjectCheck: false
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

    console.log("[DailyTimeTracker] Ready.");

    function getTodayString() {
        const now = new Date();
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    }

    function pad2(value) {
        return String(value).padStart(2, "0");
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

    function readHistory() {
        return safeParse(Spicetify.LocalStorage.get(CONFIG.historyKey), {});
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
        Spicetify.LocalStorage.set(CONFIG.historyKey, JSON.stringify(history));
    }

    function saveTodayData() {
        Spicetify.LocalStorage.set(CONFIG.storageKey, JSON.stringify(state.day));
    }

    function archiveDay(day) {
        if (!day || (day.totalSeconds <= 0 && day.intervals.length === 0)) {
            return;
        }

        const history = readHistory();
        const existing = normalizeHistoryEntry(history[day.date]);

        history[day.date] = {
            totalSeconds: existing.totalSeconds + day.totalSeconds,
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

    function addTrackedSeconds(secondsToAdd) {
        const wholeSeconds = Math.max(0, Math.floor(secondsToAdd));
        if (wholeSeconds <= 0) return;

        state.day.totalSeconds += wholeSeconds;
        state.secondsSinceLastSave += wholeSeconds;
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
        state.secondsSinceLastSave = 0;
        saveTodayData();
    }

    function getLiveUiSeconds() {
        return state.day.totalSeconds;
    }

    function getVisibleIntervals() {
        const intervals = state.day.intervals.slice();

        if (!state.currentSession) {
            return intervals;
        }

        const liveEnd = Date.now() - Math.max(0, state.silenceSeconds - CONFIG.pauseSeconds) * 1000;
        const visibleSession = normalizeInterval({
            start: state.currentSession.start,
            end: liveEnd
        });

        if (visibleSession) {
            intervals.push(visibleSession);
        }

        return intervals;
    }

    function injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
            @font-face {
                font-family: "DTTCircular";
                src: url("https://raw.githubusercontent.com/Holo-Host/holo-communities/refs/heads/master/public/assets/fonts/Circular-Font-Family/lineto-circular-medium.ttf") format("truetype");
                font-weight: 500;
                font-style: normal;
            }

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
                font-family: "DTTCircular", "CircularSp", "Circular Std", "Circular", var(--font-family, sans-serif);
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
                font-family: "DTTCircular", "CircularSp", "Circular Std", "Circular", var(--font-family, sans-serif);
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

            .dtt-intervals-list {
                overflow-y: auto;
                padding-right: 4px;
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
        widget.innerHTML = `<span id="dtt-time">${formatDuration(getLiveUiSeconds())}</span>`;

        state.ui.widget = widget;
        state.ui.timeNode = widget.querySelector("#dtt-time");
    }

    function updateWidgetUI() {
        if (state.ui.widget) {
            state.ui.widget.title = t("widgetTitle");
        }
        if (state.ui.timeNode) {
            state.ui.timeNode.textContent = formatDuration(getLiveUiSeconds());
        }
    }

    function getDailySummaryRows() {
        const history = readHistory();
        const merged = {
            ...history,
            [state.day.date]: {
                totalSeconds: state.day.totalSeconds,
                intervals: []
            }
        };

        return Object.entries(merged)
            .map(([date, entry]) => [date, normalizeHistoryEntry(entry)])
            .filter(([, entry]) => entry.totalSeconds > 0)
            .sort(([a], [b]) => b.localeCompare(a));
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
        return popupNode;
    }

    function buildPopupContent() {
        const root = document.createElement("div");

        const header = document.createElement("div");
        header.className = "dtt-popup-header";

        const title = document.createElement("div");
        title.className = "dtt-popup-title";
        title.textContent = t("popupTitle");

        const headerRight = document.createElement("div");
        headerRight.className = "dtt-popup-header-right";

        const languageSwitcher = document.createElement("div");
        languageSwitcher.className = "dtt-language-switcher";

        const languageOptions = [
            { code: "ru", label: t("languageRu") },
            { code: "en", label: t("languageEn") }
        ];

        for (const option of languageOptions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dtt-language-button${state.language === option.code ? " is-active" : ""}`;
            button.textContent = option.label;
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
        }

        const hint = document.createElement("div");
        hint.className = "dtt-popup-hint";
        hint.textContent = state.popup.isPinned ? t("popupHintPinned") : t("popupHintHover");

        headerRight.append(languageSwitcher, hint);
        header.append(title, headerRight);
        root.appendChild(header);

        const summary = document.createElement("div");
        summary.className = "dtt-popup-summary";

        const dateNode = document.createElement("span");
        dateNode.textContent = state.day.date;

        const totalNode = document.createElement("strong");
        totalNode.textContent = formatDuration(getLiveUiSeconds());

        summary.append(dateNode, totalNode);
        root.appendChild(summary);

        const list = document.createElement("div");
        list.className = "dtt-intervals-list";

        const rows = getDailySummaryRows();

        if (rows.length === 0) {
            const empty = document.createElement("div");
            empty.className = "dtt-empty-state";
            empty.textContent = t("emptyState");
            list.appendChild(empty);
        } else {
            for (const [date, entry] of rows) {
                const item = document.createElement("div");
                item.className = `dtt-interval-item${date === state.day.date ? " is-today" : ""}`;

                const range = document.createElement("span");
                range.className = "dtt-interval-range";
                range.textContent = date === state.day.date
                    ? `${date} (${t("todayLabel")})`
                    : date;

                const duration = document.createElement("span");
                duration.className = "dtt-interval-duration";
                duration.textContent = formatDuration(entry.totalSeconds);

                item.append(range, duration);
                list.appendChild(item);
            }
        }

        root.appendChild(list);
        return root;
    }

    function positionPopup() {
        const popupNode = state.popup.node;
        const widget = state.ui.widget;
        if (!popupNode || !widget) {
            return;
        }

        const widgetRect = widget.getBoundingClientRect();
        const popupWidth = Math.min(CONFIG.maxPopupWidthPx, window.innerWidth - 32);
        let left = widgetRect.left;
        let top = widgetRect.bottom + CONFIG.popupOffsetPx;

        if (left + popupWidth > window.innerWidth - CONFIG.viewportMarginPx) {
            left = window.innerWidth - popupWidth - CONFIG.viewportMarginPx;
        }

        if (left < CONFIG.viewportMarginPx) {
            left = CONFIG.viewportMarginPx;
        }

        if (top + CONFIG.estimatedPopupHeightPx > window.innerHeight - CONFIG.viewportMarginPx) {
            top = Math.max(
                CONFIG.viewportMarginPx,
                widgetRect.top - CONFIG.estimatedPopupHeightPx - CONFIG.popupOffsetPx
            );
        }

        popupNode.style.left = `${left}px`;
        popupNode.style.top = `${top}px`;
    }

    function showPopup() {
        clearPopupHideTimeout();

        const popupNode = ensurePopup();
        popupNode.innerHTML = "";
        popupNode.appendChild(buildPopupContent());
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

        setTimeout(() => {
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
        setTimeout(() => {
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
    }

    function updateTrackingState(now) {
        const elapsedSeconds = Math.max(1, Math.floor((now - state.lastTickAt) / 1000));
        state.lastTickAt = now;

        rolloverDayIfNeeded();

        if (Spicetify.Player.isPlaying()) {
            state.ui.widget?.classList.remove("dtt-paused");
            state.idleStartedAt = null;
            state.silenceSeconds = 0;
            startSession(now);
            addTrackedSeconds(elapsedSeconds);
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
            addTrackedSeconds(elapsedSeconds);
            return;
        }

        state.ui.widget?.classList.add("dtt-paused");
        closeSession(state.idleStartedAt + CONFIG.pauseSeconds * 1000);
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
        saveTodayData();
    }

    function refreshOpenPopupIfNeeded() {
        if (state.popup.node) {
            showPopup();
        }
    }

    function flushTodayIfNeeded() {
        if (state.secondsSinceLastSave >= CONFIG.saveIntervalSeconds) {
            saveTodayData();
            state.secondsSinceLastSave = 0;
        }
    }

    function startTrackingLoop() {
        setInterval(() => {
            updateTrackingState(Date.now());
            updateWidgetUI();
            refreshOpenPopupIfNeeded();
            flushTodayIfNeeded();
        }, CONFIG.tickMs);
    }

    function bindWindowEvents() {
        window.addEventListener("resize", () => {
            if (state.popup.node) {
                positionPopup();
            }
        });

        window.addEventListener("beforeunload", () => {
            clearPopupHideTimeout();

            if (state.currentSession) {
                closeSession(Date.now());
            }

            saveTodayData();
        });
    }
})();
