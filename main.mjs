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
        longStreakProgressionKey: "dtt_long_streak_progression_enabled_v1",
        widgetCarryoverKey: "dtt_widget_carryover_v1",
        streakKey: "dtt_streak_v1",
        versionKey: "dtt_version_v1",
        versionCheckUrl: "https://vvertax.site/dtt/ext/version.json",
        versionCheckIntervalMs: 300000,
        badgeApiBaseUrl: "https://vvertax.site/dtt/api/badge.php",
        apiHealthCheckIntervalMs: 300000,
        streakThresholdSeconds: 300,
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
        maxImportFileBytes: 1024 * 1024,
        maxImportDays: 3660,
        maxImportIntervalsPerDay: 1000,
        todaySessionsToggleThreshold: 5,
        collapsedTodaySessionsCount: 1,
        historyToggleThreshold: 5,
        collapsedHistoryCount: 3,
        topbarSelectors: [
            ".main-topBar-topbarContent",
            ".Root__top-bar header",
            "[data-testid='topbar']",
            ".main-globalNav-searchSection .main-globalNav-searchContainer"
        ]
    };

    const VERSION = "1.6.2";

    let historyCache = null;

    const state = {
        day: null,
        language: loadLanguage(),
        historyRetentionMonths: loadHistoryRetentionMonths(),
        carryOverTimerEnabled: loadCarryOverTimerEnabled(),
        longStreakProgressionEnabled: loadLongStreakProgressionEnabled(),
        widgetCarryoverSeconds: loadWidgetCarryoverSeconds(),
        streak: loadStreakData(),
        badge: null,
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
            historyToggleNode: null,
            historyExpanded: false,
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
            settingsStreakProgressionTitleNode: null,
            settingsStreakProgressionHintNode: null,
            settingsStreakProgressionInputNode: null,
            settingsStreakProgressionPreviewNode: null,
            exportTitleNode: null,
            exportCsvBtnNode: null,
            exportJsonBtnNode: null,
            importTitleNode: null,
            importHintNode: null,
            importMergeBtnNode: null,
            importReplaceBtnNode: null,
            importFileInputNode: null,
            updateCheckTitleNode: null,
            updateCheckHintNode: null,
            updateCheckBtnNode: null,
            resetDataTitleNode: null,
            resetDataHintNode: null,
            resetTodayBtnNode: null,
            clearHistoryBtnNode: null,
            fullWipeBtnNode: null,
            popupFireNode: null,
            popupStreakCountNode: null,
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
            injectRetryTimeoutId: null,
            updateCheckIntervalId: null,
            apiHealthCheckIntervalId: null,
            _streakTestMode: false,
            _lastTrackUri: null
        }
    };

    state.day = loadTodayData();

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
            languageEn: "EN",
            streakLabel: "Серия",
            streakDays: "дн.",
            streakProgressionLabel: "Длинная прогрессия серии",
            streakProgressionHint: "Добавляет больше цветовых уровней и переносит белый максимум на 500+.",
            streakProgressionTiersLabel: "Активные уровни",
            exportTitle: "Экспорт данных",
            exportCsv: "Скачать CSV",
            exportJson: "Скачать JSON",
            importTitle: "Импорт из JSON",
            importHint: "Восстановить или объединить данные из ранее экспортированного JSON.",
            importMerge: "Мердж",
            importReplace: "Заменить",
            importReadError: "Не удалось прочитать выбранный JSON-файл.",
            importInvalid: "Импорт отклонен: ожидается JSON в формате export (дата -> totalSeconds / intervals).",
            importTooLarge: "Импорт отклонен: файл слишком большой.",
            importTooManyDays: "Импорт отклонен: слишком много дней в файле.",
            importTooManyIntervals: "Импорт отклонен: слишком много интервалов в одном дне.",
            importConfirmMerge: "Импорт JSON с объединением?",
            importConfirmReplace: "Импорт JSON с полной заменой?",
            importPreviewDays: "Дней в файле",
            importPreviewAffected: "Затронуто дней",
            importPreviewConflicts: "Пересечений",
            importPreviewImportedTotal: "Время в файле",
            importPreviewResultTotal: "Итог после импорта",
            importSuccessMerge: "Импорт завершен: данные объединены.",
            importSuccessReplace: "Импорт завершен: данные заменены.",
            updateCheckTitle: "Проверка обновлений",
            updateCheckHint: "Проверить наличие новой версии вручную.",
            updateCheckButton: "Проверить",
            updateCheckCurrent: "У вас уже последняя версия.",
            updateCheckFailed: "Не удалось проверить обновления прямо сейчас.",
            resetDataTitle: "Очистка / Сброс данных",
            resetDataHint: "Действия необратимы. Перед полным сбросом лучше экспортировать данные.",
            resetToday: "Сбросить сегодня",
            clearHistory: "Очистить историю",
            fullWipe: "Полный сброс",
            confirmResetToday: "Сбросить данные за сегодня? История останется нетронутой.",
            confirmClearHistory: "Очистить всю архивную историю? Данные за сегодня останутся.",
            confirmFullWipe: "Полностью удалить все данные Daily Time Tracker и сбросить настройки?",
            updateBadge: "ОБНОВЛЕНИЕ",
            updateTitle: "Доступно обновление Daily Time Tracker",
            updateSubtitle: "Перезагрузите Spotify для применения обновления.",
            updateVersionLabel: "ВЕРСИЯ",
            updateBtnRestart: "Перезапустить",
            updateBtnReleaseNotes: "Что нового",
            apiUnavailableBadge: "API",
            apiUnavailableTitle: "Не удалось подключиться к API Daily Time Tracker",
            apiUnavailableSubtitle: "Скрипт продолжит работать как раньше. Повторная проверка будет выполнена автоматически."
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
            languageEn: "EN",
            streakLabel: "Streak",
            streakDays: "d",
            streakProgressionLabel: "Long streak progression",
            streakProgressionHint: "Adds more color tiers and moves white max tier to 500+.",
            streakProgressionTiersLabel: "Active tiers",
            exportTitle: "Export data",
            exportCsv: "Download CSV",
            exportJson: "Download JSON",
            importTitle: "Import from JSON",
            importHint: "Restore or merge data from a previous JSON export.",
            importMerge: "Merge",
            importReplace: "Replace",
            importReadError: "Could not read the selected JSON file.",
            importInvalid: "Import rejected: expected a JSON export object shaped like date -> totalSeconds / intervals.",
            importTooLarge: "Import rejected: file is too large.",
            importTooManyDays: "Import rejected: too many days in payload.",
            importTooManyIntervals: "Import rejected: too many intervals in a single day.",
            importConfirmMerge: "Import JSON and merge it with current data?",
            importConfirmReplace: "Import JSON and replace current data?",
            importPreviewDays: "Days in file",
            importPreviewAffected: "Affected days",
            importPreviewConflicts: "Conflicts",
            importPreviewImportedTotal: "Time in file",
            importPreviewResultTotal: "Total after import",
            importSuccessMerge: "Import complete: data was merged.",
            importSuccessReplace: "Import complete: data was replaced.",
            updateCheckTitle: "Update check",
            updateCheckHint: "Check for a new version manually.",
            updateCheckButton: "Check now",
            updateCheckCurrent: "You are already using the latest version.",
            updateCheckFailed: "Unable to check for updates right now.",
            resetDataTitle: "Clear / Reset Data",
            resetDataHint: "These actions are irreversible. Export your data before a full wipe.",
            resetToday: "Reset today",
            clearHistory: "Clear history",
            fullWipe: "Full wipe",
            confirmResetToday: "Reset today's data? History will be kept.",
            confirmClearHistory: "Clear all archived history? Today's data will be kept.",
            confirmFullWipe: "Delete all Daily Time Tracker data and reset settings?",
            updateBadge: "UPDATE",
            updateTitle: "Daily Time Tracker update available",
            updateSubtitle: "Restart Spotify to apply the update.",
            updateVersionLabel: "VERSION",
            updateBtnRestart: "Restart",
            updateBtnReleaseNotes: "Release Notes",
            apiUnavailableBadge: "API",
            apiUnavailableTitle: "Unable to connect to the Daily Time Tracker API",
            apiUnavailableSubtitle: "The script will continue working as before. It will retry automatically."
        }
    };

    const SHORT_STREAK_TIERS = [
        { min: 2, outer: "#FF6B1A", inner: "#FFD54F", text: "#FF6B1A", glow: "rgba(255,107,26,0.5)" },
        { min: 14, outer: "#EF4444", inner: "#FCA5A5", text: "#EF4444", glow: "rgba(239,68,68,0.5)" },
        { min: 30, outer: "#EC4899", inner: "#F9A8D4", text: "#EC4899", glow: "rgba(236,72,153,0.5)" },
        { min: 60, outer: "#D946EF", inner: "#F0ABFC", text: "#F0ABFC", glow: "rgba(217,70,239,0.5)" },
        { exact: 67, outer: "#F2C64E", inner: "#F8E08E", text: "#F2C64E", glow: "rgba(242,198,78,0.5)", hidden: true },
        { min: 100, outer: "#A855F7", inner: "#D8B4FE", text: "#A855F7", glow: "rgba(168,85,247,0.5)" },
        { min: 150, outer: "#3B82F6", inner: "#93C5FD", text: "#3B82F6", glow: "rgba(59,130,246,0.5)" },
        { min: 200, outer: "#40E0D0", inner: "#7FFFD4", text: "#40E0D0", glow: "rgba(64,224,208,0.5)" },
        { min: 250, outer: "#FFFFFF", inner: "#E0E0E0", text: "#FFFFFF", glow: "rgba(255,255,255,0.5)" },
        { min: 2000, outer: "#B3F24E", inner: "#DCF8A0", text: "#B3F24E", glow: "rgba(179,242,78,0.55)", hidden: true }
    ];

    const LONG_STREAK_TIERS = [
        { min: 2, outer: "#FF6B1A", inner: "#FFD54F", text: "#FF6B1A", glow: "rgba(255,107,26,0.5)" },
        { min: 7, outer: "#FF9F1C", inner: "#FFD27A", text: "#FF9F1C", glow: "rgba(255,159,28,0.5)" },
        { min: 14, outer: "#EF4444", inner: "#FCA5A5", text: "#EF4444", glow: "rgba(239,68,68,0.5)" },
        { min: 30, outer: "#EC4899", inner: "#F9A8D4", text: "#EC4899", glow: "rgba(236,72,153,0.5)" },
        { min: 60, outer: "#D946EF", inner: "#F0ABFC", text: "#F0ABFC", glow: "rgba(217,70,239,0.5)" },
        { exact: 67, outer: "#F2C64E", inner: "#F8E08E", text: "#F2C64E", glow: "rgba(242,198,78,0.5)", hidden: true },
        { min: 100, outer: "#A855F7", inner: "#D8B4FE", text: "#A855F7", glow: "rgba(168,85,247,0.5)" },
        { min: 150, outer: "#3B82F6", inner: "#93C5FD", text: "#3B82F6", glow: "rgba(59,130,246,0.5)" },
        { min: 200, outer: "#40E0D0", inner: "#7FFFD4", text: "#40E0D0", glow: "rgba(64,224,208,0.5)" },
        { min: 225, outer: "#9DECF9", inner: "#D8F8FF", text: "#9DECF9", glow: "rgba(157,236,249,0.5)" },
        { min: 250, outer: "#67E8F9", inner: "#CFFAFE", text: "#67E8F9", glow: "rgba(103,232,249,0.5)" },
        { min: 275, outer: "#34D399", inner: "#A7F3D0", text: "#34D399", glow: "rgba(52,211,153,0.5)" },
        { min: 300, outer: "#6EE7B7", inner: "#A7F3D0", text: "#6EE7B7", glow: "rgba(110,231,183,0.5)" },
        { min: 380, outer: "#C0C0C0", inner: "#E5E7EB", text: "#C0C0C0", glow: "rgba(192,192,192,0.5)" },
        { min: 500, outer: "#FFFFFF", inner: "#E0E0E0", text: "#FFFFFF", glow: "rgba(255,255,255,0.55)" },
        { min: 2000, outer: "#B3F24E", inner: "#DCF8A0", text: "#B3F24E", glow: "rgba(179,242,78,0.55)", hidden: true }
    ];

    injectStyles();
    createWidget();
    bindWidgetEvents();
    startWidgetInjection();
    startTrackingLoop();
    bindWindowEvents();
    window[GLOBAL_RUNTIME_KEY] = {
        cleanup
    };

    computeStreak();
    fetchBadge();
    syncStoredVersionWithCurrentScript();
    checkForUpdates();
    state.runtime.updateCheckIntervalId = setInterval(checkForUpdates, CONFIG.versionCheckIntervalMs);
    checkApiAvailability();
    state.runtime.apiHealthCheckIntervalId = setInterval(checkApiAvailability, CONFIG.apiHealthCheckIntervalMs);

    // ── TEMP: test streak colors ──
    window.dttSetStreak = function (n) {
        state.runtime._streakTestMode = true;
        state.streak.current = Number(n) || 0;
        updatePopupFireIcon();
        console.log("[DailyTimeTracker] Streak set to", state.streak.current, "| color:", getStreakColor());
    };
    window.dttResetStreak = function () {
        state.runtime._streakTestMode = false;
        computeStreak();
        updatePopupFireIcon();
        console.log("[DailyTimeTracker] Streak reset to real value:", state.streak.current);
    };

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
            const parsedHistory = readRawHistory();
            const { history } = pruneHistoryEntries(parsedHistory);
            historyCache = history;
        }

        return historyCache;
    }

    function readRawHistory() {
        return safeParse(Spicetify.LocalStorage.get(CONFIG.historyKey), {});
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
        Spicetify.LocalStorage.set(CONFIG.carryOverTimerKey, "0");
        return false;
    }

    function loadLongStreakProgressionEnabled() {
        return Spicetify.LocalStorage.get(CONFIG.longStreakProgressionKey) === "1";
    }

    function saveCarryOverTimerEnabled() {
        Spicetify.LocalStorage.set(
            CONFIG.carryOverTimerKey,
            state.carryOverTimerEnabled ? "1" : "0"
        );
    }

    function saveLongStreakProgressionEnabled() {
        Spicetify.LocalStorage.set(
            CONFIG.longStreakProgressionKey,
            state.longStreakProgressionEnabled ? "1" : "0"
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
            return "\u0424\u0443\u043d\u043a\u0446\u0438\u044f \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u0430, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u043d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e.";
        }

        return "This feature is temporarily disabled because it currently does not work correctly.";
    }

    function getCarryOverTimerDisabledTooltip() {
        if (state.language === "ru") {
            return "\u0424\u0443\u043d\u043a\u0446\u0438\u044f \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u0430, \u0442\u0430\u043a \u043a\u0430\u043a \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442.";
        }

        return "Feature temporarily disabled because it does not work right now.";
    }

    function saveHistory(history) {
        historyCache = pruneHistoryEntries(history).history;
        Spicetify.LocalStorage.set(CONFIG.historyKey, JSON.stringify(history || {}));
    }

    function applyHistoryRetentionMonths(nextValue) {
        const normalized = normalizeHistoryRetentionMonths(nextValue);
        if (normalized === state.historyRetentionMonths) {
            return;
        }

        state.historyRetentionMonths = normalized;
        saveHistoryRetentionMonths();
        historyCache = null;
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

    function applyLongStreakProgressionEnabled(nextValue) {
        const normalized = Boolean(nextValue);
        if (normalized === state.longStreakProgressionEnabled) {
            return;
        }

        state.longStreakProgressionEnabled = normalized;
        saveLongStreakProgressionEnabled();
    }

    function loadStreakData() {
        const fallback = { current: 0, best: 0, lastDate: "" };
        return safeParse(Spicetify.LocalStorage.get(CONFIG.streakKey), fallback);
    }

    function saveStreakData() {
        Spicetify.LocalStorage.set(CONFIG.streakKey, JSON.stringify(state.streak));
    }

    function loadStreakThreshold() {
        return CONFIG.streakThresholdSeconds;
    }

    function computeStreak() {
        const history = readRawHistory();
        const today = getTodayString();
        const todayTotal = getComputedDayTotalSeconds();
        const threshold = CONFIG.streakThresholdSeconds;

        const allDays = { ...history };
        allDays[today] = { totalSeconds: todayTotal, intervals: [] };

        let current = 0;
        const dateObj = new Date();

        for (let i = 0; i < 400; i++) {
            const dateStr = formatDateString(dateObj);
            const entry = allDays[dateStr];
            const dayTotal = entry ? Math.max(0, Math.floor(Number(entry.totalSeconds) || 0)) : 0;

            if (i === 0) {
                if (dayTotal >= threshold) {
                    current++;
                }
            } else {
                if (dayTotal >= threshold) {
                    current++;
                } else {
                    break;
                }
            }

            dateObj.setDate(dateObj.getDate() - 1);
        }

        state.streak.current = current;
        if (current > state.streak.best) {
            state.streak.best = current;
        }
        state.streak.lastDate = today;
        saveStreakData();
    }

    async function fetchBadge() {
        try {
            const uid = Spicetify.Platform?.username;
            if (!uid) return;
            const res = await fetch(`${CONFIG.badgeApiBaseUrl}?uid=${encodeURIComponent(uid)}`);
            if (!res.ok) return;
            const badge = await res.json();
            if (badge && typeof badge.label === "string") {
                state.badge = badge;
            }
        } catch (_) {}
    }

    async function fetchApiHealthStatus() {
        try {
            const uid = Spicetify.Platform?.username || "healthcheck";
            const res = await fetch(`${CONFIG.badgeApiBaseUrl}?uid=${encodeURIComponent(uid)}&t=${Date.now()}`);
            return res.ok || res.status === 204;
        } catch (_) {
            return false;
        }
    }

    // ── Update check ─────────────────────────────────────

    function loadStoredVersion() {
        return Spicetify.LocalStorage.get(CONFIG.versionKey) || "";
    }

    function saveStoredVersion(v) {
        Spicetify.LocalStorage.set(CONFIG.versionKey, v);
    }

    function syncStoredVersionWithCurrentScript() {
        if (loadStoredVersion() !== VERSION) {
            saveStoredVersion(VERSION);
        }
    }

    function compareVersions(a, b) {
        const pa = String(a || "").split(".").map(Number);
        const pb = String(b || "").split(".").map(Number);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na > nb) return 1;
            if (na < nb) return -1;
        }
        return 0;
    }

    async function fetchLatestVersion() {
        try {
            const res = await fetch(CONFIG.versionCheckUrl + "?" + Date.now());
            if (!res.ok) return null;
            const data = await res.json();
            if (data && typeof data.version === "string") return data;
            return null;
        } catch (_) {
            return null;
        }
    }

    async function checkForUpdates(options = {}) {
        const manual = Boolean(options.manual);
        const data = await fetchLatestVersion();
        if (!data) {
            if (manual) {
                window.alert(t("updateCheckFailed"));
            }
            return false;
        }
        if (compareVersions(data.version, VERSION) <= 0) {
            syncStoredVersionWithCurrentScript();
            console.log(`[DailyTimeTracker] No updates available. Current version: ${VERSION}.`);
            if (manual) {
                window.alert(t("updateCheckCurrent"));
            }
            return false;
        }
        console.log(`[DailyTimeTracker] Update found! Latest version: ${data.version}. Current version: ${VERSION}.`);
        if (document.getElementById("dtt-update-overlay")) return;
        showUpdateModal(data.version);
        return true;
    }

    function showUpdateModal(latestVersion) {
        hideUpdateModal();
        const changelogUrl = `https://github.com/vvertax/DailyTimeTracker/releases/tag/v${latestVersion}`;

        const overlay = document.createElement("div");
        overlay.id = "dtt-update-overlay";

        const modal = document.createElement("div");
        modal.className = "dtt-update-modal";

        const closeBtn = document.createElement("button");
        closeBtn.className = "dtt-update-close";
        closeBtn.innerHTML = "&#x2715;";
        closeBtn.title = "Close";
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            hideUpdateModal();
        });

        const badge = document.createElement("span");
        badge.className = "dtt-update-badge";
        badge.textContent = t("updateBadge");

        const title = document.createElement("div");
        title.className = "dtt-update-title";
        title.textContent = t("updateTitle");

        const subtitle = document.createElement("div");
        subtitle.className = "dtt-update-subtitle";
        subtitle.textContent = t("updateSubtitle");

        const versionBlock = document.createElement("div");
        versionBlock.className = "dtt-update-version-block";

        const versionLabel = document.createElement("span");
        versionLabel.className = "dtt-update-version-label";
        versionLabel.textContent = t("updateVersionLabel");

        const versionValue = document.createElement("span");
        versionValue.className = "dtt-update-version-value";
        versionValue.textContent = `${VERSION}  →  ${latestVersion}`;

        versionBlock.appendChild(versionLabel);
        versionBlock.appendChild(versionValue);

        const buttons = document.createElement("div");
        buttons.className = "dtt-update-buttons";

        const restartBtn = document.createElement("button");
        restartBtn.className = "dtt-update-btn dtt-update-btn-primary";
        restartBtn.textContent = t("updateBtnRestart");
        restartBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.location.reload();
        });
        buttons.appendChild(restartBtn);

        const changelogBtn = document.createElement("button");
        changelogBtn.className = "dtt-update-btn dtt-update-btn-secondary";
        changelogBtn.textContent = t("updateBtnReleaseNotes");
        changelogBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.open(changelogUrl, "_blank");
        });
        buttons.appendChild(changelogBtn);

        modal.appendChild(closeBtn);
        modal.appendChild(badge);
        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(versionBlock);
        modal.appendChild(buttons);

        overlay.appendChild(modal);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) hideUpdateModal();
        });

        document.body.appendChild(overlay);
    }

    function hideUpdateModal() {
        document.getElementById("dtt-update-overlay")?.remove();
    }

    async function checkApiAvailability() {
        const isAvailable = await fetchApiHealthStatus();

        if (isAvailable) {
            console.log("[DailyTimeTracker] API connection OK.");
            hideApiUnavailableModal();
            return;
        }

        console.log("[DailyTimeTracker] Unable to connect to API. The script will continue working as before.");
        showApiUnavailableModal();
    }

    function showApiUnavailableModal() {
        if (document.getElementById("dtt-api-unavailable-overlay")) {
            return;
        }

        const overlay = document.createElement("div");
        overlay.id = "dtt-api-unavailable-overlay";
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.65);
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
        `;

        const modal = document.createElement("div");
        modal.className = "dtt-update-modal";

        const closeBtn = document.createElement("button");
        closeBtn.className = "dtt-update-close";
        closeBtn.innerHTML = "&#x2715;";
        closeBtn.title = "Close";
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            hideApiUnavailableModal();
        });

        const badge = document.createElement("span");
        badge.className = "dtt-update-badge";
        badge.textContent = t("apiUnavailableBadge");

        const title = document.createElement("div");
        title.className = "dtt-update-title";
        title.textContent = t("apiUnavailableTitle");

        const subtitle = document.createElement("div");
        subtitle.className = "dtt-update-subtitle";
        subtitle.textContent = t("apiUnavailableSubtitle");

        modal.appendChild(closeBtn);
        modal.appendChild(badge);
        modal.appendChild(title);
        modal.appendChild(subtitle);

        overlay.appendChild(modal);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                hideApiUnavailableModal();
            }
        });

        document.body.appendChild(overlay);
    }

    function hideApiUnavailableModal() {
        document.getElementById("dtt-api-unavailable-overlay")?.remove();
    }

    function getActiveStreakTiers() {
        return state.longStreakProgressionEnabled
            ? LONG_STREAK_TIERS
            : SHORT_STREAK_TIERS;
    }

    function getStreakTierPreviewText() {
        return getActiveStreakTiers()
            .filter((tier) => !tier.hidden)
            .map((tier) => `${tier.min}+`)
            .join(" • ");
    }

    function getStreakColor() {
        const s = state.streak.current;
        const tiers = getActiveStreakTiers();

        for (let i = tiers.length - 1; i >= 0; i--) {
            if (typeof tiers[i].exact === "number" && s === tiers[i].exact) {
                return tiers[i];
            }
        }

        for (let i = tiers.length - 1; i >= 0; i--) {
            if (typeof tiers[i].min === "number" && s >= tiers[i].min) {
                return tiers[i];
            }
        }

        return tiers[0];
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
        const intervals = state.day.intervals.map(cloneInterval);
        const liveInterval = getVisibleSessionInterval(now);
        if (liveInterval) {
            intervals.push(liveInterval);
        }
        return {
            date: state.day.date,
            totalSeconds: getComputedDayTotalSeconds(now),
            intervals
        };
    }

    function saveTodayData(now = Date.now()) {
        const snapshot = createPersistedDaySnapshot(now);
        state.lastPersistAt = now;
        Spicetify.LocalStorage.set(CONFIG.storageKey, JSON.stringify(snapshot));
    }

    // ── Export helpers ────────────────────────────────────
    function getExportData() {
        const history = readHistory();
        const todayTotal = getComputedDayTotalSeconds();
        const merged = { ...history };
        merged[state.day.date] = {
            totalSeconds: todayTotal,
            intervals: state.day.intervals.map(cloneInterval)
        };
        return Object.entries(merged)
            .map(([date, entry]) => [date, normalizeHistoryEntry(entry)])
            .filter(([, entry]) => entry.totalSeconds > 0)
            .sort(([a], [b]) => a.localeCompare(b));
    }

    function exportCsv() {
        const rows = getExportData();
        const lines = ["date,seconds,duration"];
        for (const [date, entry] of rows) {
            lines.push(`${date},${entry.totalSeconds},${formatDuration(entry.totalSeconds)}`);
        }
        downloadFile("DailyTimeTracker.csv", lines.join("\n"), "text/csv");
    }

    function exportJson() {
        const rows = getExportData();
        const data = {};
        for (const [date, entry] of rows) {
            data[date] = entry;
        }
        downloadFile("DailyTimeTracker.json", JSON.stringify(data, null, 2), "application/json");
    }

    function getAllStoredDays() {
        const data = {};

        for (const [date, entry] of Object.entries(readHistory())) {
            const normalized = normalizeHistoryEntry(entry);
            if (normalized.totalSeconds > 0 || normalized.intervals.length > 0) {
                data[date] = normalized;
            }
        }

        const todaySnapshot = createPersistedDaySnapshot();
        if (todaySnapshot.totalSeconds > 0 || todaySnapshot.intervals.length > 0) {
            data[todaySnapshot.date] = normalizeHistoryEntry(todaySnapshot);
        }

        return data;
    }

    function dedupeAndSortIntervals(intervals) {
        const seen = new Set();
        const unique = [];

        for (const interval of intervals) {
            const normalized = normalizeInterval(interval);
            if (!normalized) {
                continue;
            }

            const key = `${normalized.start}:${normalized.end}`;
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            unique.push(normalized);
        }

        unique.sort((a, b) => a.start - b.start || a.end - b.end);
        return unique;
    }

    function normalizeImportedDataset(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw new Error("invalid-shape");
        }

        const entries = Object.entries(payload);
        if (entries.length > CONFIG.maxImportDays) {
            throw new Error("too-many-days");
        }

        const normalized = {};
        for (const [date, entry] of entries) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                throw new Error("invalid-shape");
            }

            const day = normalizeHistoryEntry(entry);
            if (day.intervals.length > CONFIG.maxImportIntervalsPerDay) {
                throw new Error("too-many-intervals");
            }

            day.intervals = dedupeAndSortIntervals(day.intervals);
            day.totalSeconds = Math.max(day.totalSeconds, getIntervalsTotalSeconds(day.intervals));

            if (day.totalSeconds <= 0 && day.intervals.length === 0) {
                continue;
            }

            normalized[date] = day;
        }

        return normalized;
    }

    function mergeDayEntries(currentEntry, importedEntry) {
        const current = normalizeHistoryEntry(currentEntry);
        const incoming = normalizeHistoryEntry(importedEntry);
        const intervals = dedupeAndSortIntervals(current.intervals.concat(incoming.intervals));

        return {
            totalSeconds: Math.max(
                current.totalSeconds,
                incoming.totalSeconds,
                getIntervalsTotalSeconds(intervals)
            ),
            intervals
        };
    }

    function getDatasetTotalSeconds(days) {
        return Object.values(days).reduce((total, entry) => {
            return total + Math.max(0, Math.floor(Number(entry?.totalSeconds) || 0));
        }, 0);
    }

    function buildImportPlan(importedDays, mode) {
        const currentDays = getAllStoredDays();
        const resultDays = mode === "replace" ? {} : { ...currentDays };
        let conflicts = 0;

        if (mode === "replace") {
            for (const [date, entry] of Object.entries(importedDays)) {
                resultDays[date] = normalizeHistoryEntry(entry);
            }
        } else {
            for (const [date, entry] of Object.entries(importedDays)) {
                if (resultDays[date]) {
                    conflicts++;
                    resultDays[date] = mergeDayEntries(resultDays[date], entry);
                } else {
                    resultDays[date] = normalizeHistoryEntry(entry);
                }
            }
        }

        return {
            resultDays,
            affectedDays: mode === "replace" ? Object.keys(resultDays).length : Object.keys(importedDays).length,
            conflicts,
            importedTotalSeconds: getDatasetTotalSeconds(importedDays),
            resultTotalSeconds: getDatasetTotalSeconds(resultDays)
        };
    }

    function applyImportedDataset(days) {
        const today = getTodayString();
        const nextToday = days[today]
            ? normalizeDayData({ date: today, ...days[today] }, today)
            : createEmptyDay(today);
        const nextHistory = {};

        for (const [date, entry] of Object.entries(days)) {
            if (date === today) {
                continue;
            }

            nextHistory[date] = normalizeHistoryEntry(entry);
        }

        saveHistory(nextHistory);
        state.runtime._streakTestMode = false;
        state.day = nextToday;
        state.currentSession = null;
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
        resetWidgetCarryover();
        saveTodayData();
        computeStreak();
        updatePopupStaticTextV2();
        syncVisibleUI();
        updatePopupHistoryV2(getDailySummaryRows(getComputedDayTotalSeconds()));
    }

    async function importJsonFile(file, mode) {
        if (!file) {
            return;
        }

        if (file.size > CONFIG.maxImportFileBytes) {
            window.alert(t("importTooLarge"));
            return;
        }

        let payload;
        try {
            payload = JSON.parse(await file.text());
        } catch (_) {
            window.alert(t("importReadError"));
            return;
        }

        let importedDays;
        try {
            importedDays = normalizeImportedDataset(payload);
        } catch (error) {
            if (error?.message === "too-many-days") {
                window.alert(t("importTooManyDays"));
                return;
            }
            if (error?.message === "too-many-intervals") {
                window.alert(t("importTooManyIntervals"));
                return;
            }
            window.alert(t("importInvalid"));
            return;
        }

        const importedCount = Object.keys(importedDays).length;
        if (importedCount === 0) {
            window.alert(t("importInvalid"));
            return;
        }

        const plan = buildImportPlan(importedDays, mode);
        const previewMessage = [
            mode === "replace" ? t("importConfirmReplace") : t("importConfirmMerge"),
            "",
            `${t("importPreviewDays")}: ${importedCount}`,
            `${t("importPreviewAffected")}: ${plan.affectedDays}`,
            `${t("importPreviewConflicts")}: ${plan.conflicts}`,
            `${t("importPreviewImportedTotal")}: ${formatDuration(plan.importedTotalSeconds)}`,
            `${t("importPreviewResultTotal")}: ${formatDuration(plan.resultTotalSeconds)}`
        ].join("\n");

        if (!confirmDestructiveAction(previewMessage)) {
            return;
        }

        applyImportedDataset(plan.resultDays);
        window.alert(mode === "replace" ? t("importSuccessReplace") : t("importSuccessMerge"));
    }

    function openImportPicker(mode) {
        const input = state.popup.importFileInputNode;
        if (!input) {
            return;
        }

        input.value = "";
        input.dataset.importMode = mode;
        input.click();
    }

    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function confirmDestructiveAction(message) {
        return window.confirm(message);
    }

    function clearStoredValue(key) {
        Spicetify.LocalStorage.set(key, "");
    }

    function resetRuntimeAfterDataChange(now = Date.now(), options = {}) {
        const keepCurrentSession = Boolean(options.keepCurrentSession);

        state.runtime._streakTestMode = false;
        state.day = createEmptyDay(getTodayString());
        state.currentSession = keepCurrentSession && Spicetify.Player.isPlaying()
            ? { start: now, end: null }
            : null;
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
        resetWidgetCarryover();
        saveTodayData(now);
        computeStreak();
        syncVisibleUI(now);
        updatePopupHistoryV2(getDailySummaryRows(getComputedDayTotalSeconds(now)));
    }

    function resetTodayData() {
        resetRuntimeAfterDataChange(Date.now(), { keepCurrentSession: true });
    }

    function clearHistoryData() {
        saveHistory({});
        computeStreak();
        syncVisibleUI();
        updatePopupHistoryV2(getDailySummaryRows(getComputedDayTotalSeconds()));
    }

    function fullWipeData() {
        const now = Date.now();

        saveHistory({});
        clearStoredValue(CONFIG.historyKey);
        clearStoredValue(CONFIG.languageKey);
        clearStoredValue(CONFIG.retentionKey);
        clearStoredValue(CONFIG.carryOverTimerKey);
        clearStoredValue(CONFIG.longStreakProgressionKey);
        clearStoredValue(CONFIG.widgetCarryoverKey);
        clearStoredValue(CONFIG.streakKey);

        state.language = "ru";
        state.historyRetentionMonths = CONFIG.historyRetentionMonths;
        state.carryOverTimerEnabled = false;
        state.longStreakProgressionEnabled = false;
        state.widgetCarryoverSeconds = 0;
        state.streak = { current: 0, best: 0, lastDate: "" };

        resetRuntimeAfterDataChange(now, { keepCurrentSession: true });
        updatePopupStaticTextV2();
    }

    function archiveDay(day) {
        if (!day) {
            return;
        }

        const totalSeconds = getStoredDayTotalSeconds(day);
        if (totalSeconds <= 0 && day.intervals.length === 0) {
            return;
        }

        const history = readRawHistory();
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

        computeStreak();

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

            /* ── Fire icon (popup) ─────────────────────────────── */
            .dtt-fire-wrap {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                flex-shrink: 0;
            }

            .dtt-fire-wrap[hidden] {
                display: none;
            }

            .dtt-fire-icon {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                line-height: 0;
            }

            .dtt-fire-icon svg {
                width: 100%;
                height: 100%;
                display: block;
            }

            .dtt-fire-icon.dtt-fire-glow {
                filter: drop-shadow(0 0 4px var(--dtt-fire-glow, rgba(255,107,26,0.5)));
                animation: dtt-fire-pulse 1.8s ease-in-out infinite;
            }

            @keyframes dtt-fire-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.12); }
            }

            .dtt-streak-count {
                font-size: 13px;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                line-height: 1;
                transition: color 0.3s ease;
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
                min-height: 0;
                overflow-y: auto;
                overscroll-behavior: contain;
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

            .dtt-settings-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .dtt-settings-actions.is-soft {
                gap: 10px;
            }

            .dtt-settings-action-button {
                min-width: 92px;
                justify-content: center;
            }

            .dtt-settings-danger-button {
                border: 1px solid rgba(239, 68, 68, 0.25);
                border-radius: 999px;
                background: rgba(239, 68, 68, 0.1);
                color: #fca5a5;
                padding: 6px 11px;
                font: inherit;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.02em;
                cursor: pointer;
                transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
            }

            .dtt-settings-danger-button:hover {
                background: rgba(239, 68, 68, 0.18);
                border-color: rgba(248, 113, 113, 0.4);
                color: #fecaca;
            }

            /* ── Retention value display ─────────────────────── */
            .dtt-retention-suffix {
                font-size: 13px;
                font-weight: 500;
                color: #555;
                white-space: nowrap;
            }

            /* ── Badge pill ──────────────────────────────────── */
            .dtt-badge-pill {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 22px;
                padding: 2px 9px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                border: 1px solid transparent;
                line-height: 1;
                flex-shrink: 0;
                position: relative;
                overflow: hidden;
                white-space: nowrap;
                isolation: isolate;
            }

            .dtt-badge-pill.is-rainbow {
                color: #fff !important;
                border-color: rgba(255, 255, 255, 0.22) !important;
                background: rgba(255, 255, 255, 0.04);
                box-shadow:
                    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
                    0 0 12px rgba(255, 255, 255, 0.06);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.32);
            }

            .dtt-badge-pill.is-rainbow::before {
                content: "";
                position: absolute;
                inset: -50% 0;
                z-index: -1;
                background:
                    linear-gradient(
                        180deg,
                        #ff004d 0%,
                        #ff7a00 14.285%,
                        #ffd400 28.57%,
                        #38d66b 42.855%,
                        #00c2ff 57.14%,
                        #4f46e5 71.425%,
                        #c026d3 85.71%,
                        #ff004d 100%
                    );
                background-size: 100% 50%;
                background-repeat: repeat-y;
                animation: dtt-rainbow-badge-flow 3.6s linear infinite;
                will-change: transform;
            }

            @keyframes dtt-rainbow-badge-flow {
                from {
                    transform: translateY(0);
                }
                to {
                    transform: translateY(-50%);
                }
            }

            .dtt-badge-pill[hidden] {
                display: none;
            }

            /* ── Update modal ────────────────────────────── */
            #dtt-update-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                background: rgba(0, 0, 0, 0.65);
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
            }

            .dtt-update-modal {
                position: relative;
                background: #1a1a1a;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 32px 36px;
                max-width: 400px;
                width: calc(100vw - 48px);
                text-align: center;
                box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
                font-family: "Spotify Mix", "SpotifyMixUI", var(--font-family, sans-serif);
            }

            .dtt-update-close {
                position: absolute;
                top: 14px;
                right: 14px;
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.5);
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                line-height: 1;
                border-radius: 4px;
                transition: color 0.15s ease, background 0.15s ease;
            }

            .dtt-update-close:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.1);
            }

            .dtt-update-badge {
                display: inline-block;
                padding: 4px 14px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: #1ed760;
                border: 1px solid rgba(30, 215, 96, 0.4);
                background: rgba(30, 215, 96, 0.1);
                margin-bottom: 16px;
            }

            .dtt-update-title {
                font-size: 17px;
                font-weight: 700;
                color: #fff;
                margin-bottom: 8px;
                line-height: 1.3;
            }

            .dtt-update-subtitle {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.55);
                margin-bottom: 20px;
                line-height: 1.5;
            }

            .dtt-update-version-block {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                padding: 14px 20px;
                margin-bottom: 22px;
            }

            .dtt-update-version-label {
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.4);
            }

            .dtt-update-version-value {
                font-size: 18px;
                font-weight: 700;
                color: #fff;
                letter-spacing: 0.03em;
            }

            .dtt-update-buttons {
                display: flex;
                gap: 10px;
            }

            .dtt-update-btn {
                flex: 1;
                padding: 12px 16px;
                border-radius: 999px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                border: none;
                transition: transform 0.12s ease, opacity 0.15s ease;
                font-family: inherit;
            }

            .dtt-update-btn:hover {
                transform: scale(1.03);
            }

            .dtt-update-btn:active {
                transform: scale(0.97);
            }

            .dtt-update-btn-primary {
                background: #fff;
                color: #000;
            }

            .dtt-update-btn-secondary {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
            }

            .dtt-update-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.14);
            }
        `;
        document.head.appendChild(style);
    }

    function createFireSvg(colors) {
        const c = colors || getStreakColor();
        return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 23C7.58 23 4 19.42 4 15C4 11.83 5.67 9.17 6.84 7.84C7.12 7.52 7.62 7.66 7.71 8.07C8.08 9.74 8.97 12.01 11.03 13.27C11.03 12.03 11.14 10.15 12.14 8.41C13.28 6.41 15.17 5.08 16.04 4.51C16.34 4.32 16.73 4.52 16.75 4.88C16.85 6.52 17.17 9.66 18.53 11.56C19.47 12.87 20 14.19 20 15C20 19.42 16.42 23 12 23Z" fill="${c.outer}"/><path d="M12.5 22C10.29 22 8.5 20.21 8.5 18C8.5 16.42 9.42 15.17 9.96 14.55C10.13 14.35 10.43 14.42 10.5 14.68C10.65 15.22 11.07 16.01 11.95 16.42C11.98 15.85 12.13 14.98 12.69 14.21C13.16 13.57 13.72 13.16 14.01 12.97C14.18 12.86 14.39 12.98 14.39 13.18C14.42 13.86 14.55 15.17 15.11 15.95C15.47 16.44 15.5 17.5 15.5 18C15.5 20.21 14.71 22 12.5 22Z" fill="${c.inner}"/></svg>`;
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

    function updatePopupFireIcon() {
        const fireNode = state.popup.popupFireNode;
        const countNode = state.popup.popupStreakCountNode;
        const wrap = fireNode?.closest(".dtt-fire-wrap");
        if (!wrap) return;

        const s = state.streak.current;
        if (s < 2) {
            wrap.hidden = true;
            return;
        }

        wrap.hidden = false;
        const colors = getStreakColor();
        fireNode.innerHTML = createFireSvg(colors);
        fireNode.classList.toggle("dtt-fire-glow", s >= 3);
        fireNode.style.setProperty("--dtt-fire-glow", colors.glow);
        countNode.textContent = String(s);
        countNode.style.color = colors.text;
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

    function getDisplayedHistoryRows(dailySummaryRows) {
        if (state.popup.historyExpanded) {
            return dailySummaryRows;
        }

        return dailySummaryRows.slice(0, CONFIG.collapsedHistoryCount);
    }

    function updateTodaySessionsToggle(todayIntervalRows) {
        const toggleNode = state.popup.todaySessionsToggleNode;
        if (!toggleNode) {
            return;
        }

        const shouldShowToggle = todayIntervalRows.length >= CONFIG.todaySessionsToggleThreshold;
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

    function updateHistoryToggle(dailySummaryRows) {
        const toggleNode = state.popup.historyToggleNode;
        if (!toggleNode) {
            return;
        }

        const shouldShowToggle = dailySummaryRows.length >= CONFIG.historyToggleThreshold;
        toggleNode.hidden = !shouldShowToggle;

        if (!shouldShowToggle) {
            state.popup.historyExpanded = false;
        }

        toggleNode.classList.toggle("is-expanded", state.popup.historyExpanded);
        toggleNode.setAttribute(
            "aria-label",
            state.popup.historyExpanded ? "Hide extra days" : "Show all days"
        );
        toggleNode.title = state.popup.historyExpanded ? "Hide extra days" : "Show all days";
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

        const fireWrap = document.createElement("span");
        fireWrap.className = "dtt-fire-wrap";
        fireWrap.hidden = true;
        const fireIconEl = document.createElement("span");
        fireIconEl.className = "dtt-fire-icon";
        fireIconEl.innerHTML = createFireSvg();
        const fireCount = document.createElement("span");
        fireCount.className = "dtt-streak-count";
        fireCount.textContent = "";
        fireWrap.append(fireIconEl, fireCount);

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

        headerRight.append(fireWrap, hint, gearBtn);

        const titleWrap = document.createElement("div");
        titleWrap.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";
        const badgePill = document.createElement("span");
        badgePill.className = "dtt-badge-pill";
        if (state.badge) {
            badgePill.textContent = state.badge.label;
            if (state.badge.effect === "rainbow") {
                badgePill.classList.add("is-rainbow");
            } else {
                badgePill.style.color = state.badge.color;
                badgePill.style.background = state.badge.bg;
                badgePill.style.borderColor = state.badge.color + "40";
            }
        } else {
            badgePill.hidden = true;
        }
        titleWrap.append(title, badgePill);
        header.append(titleWrap, headerRight);
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
        const historyHeading = document.createElement("div");
        historyHeading.className = "dtt-popup-section-heading";
        const historyTitle = document.createElement("div");
        historyTitle.className = "dtt-popup-section-title";
        historyTitle.textContent = t("historyTitle");
        const historyToggle = document.createElement("button");
        historyToggle.type = "button";
        historyToggle.className = "dtt-today-sessions-toggle";
        historyToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>`;
        historyToggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.popup.historyExpanded = !state.popup.historyExpanded;
            updatePopupHistoryV2();
        });
        const historyList = document.createElement("div");
        historyList.className = "dtt-intervals-list";
        historyHeading.append(historyTitle, historyToggle);
        historySection.append(historyHeading, historyList);
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
        const streakProgressionRow = document.createElement("div");
        streakProgressionRow.className = "dtt-settings-row";
        const streakProgressionTitle = document.createElement("div");
        streakProgressionTitle.className = "dtt-settings-row-label";
        streakProgressionTitle.textContent = t("streakProgressionLabel");
        const streakProgressionContent = document.createElement("div");
        streakProgressionContent.className = "dtt-settings-row-content is-between";
        const streakProgressionHint = document.createElement("div");
        streakProgressionHint.className = "dtt-settings-row-hint";
        streakProgressionHint.textContent = t("streakProgressionHint");
        const streakProgressionInput = document.createElement("input");
        streakProgressionInput.type = "checkbox";
        streakProgressionInput.className = "dtt-settings-checkbox";
        streakProgressionInput.checked = state.longStreakProgressionEnabled;
        streakProgressionInput.addEventListener("click", (event) => event.stopPropagation());
        streakProgressionInput.addEventListener("change", (event) => {
            event.stopPropagation();
            applyLongStreakProgressionEnabled(event.target.checked);
            updatePopupStaticTextV2();
            updatePopupFireIcon();
            syncVisibleUI();
        });
        streakProgressionContent.append(streakProgressionHint, streakProgressionInput);

        const streakProgressionPreview = document.createElement("div");
        streakProgressionPreview.className = "dtt-settings-row-hint";
        streakProgressionPreview.textContent = `${t("streakProgressionTiersLabel")}: ${getStreakTierPreviewText()}`;

        streakProgressionRow.append(streakProgressionTitle, streakProgressionContent, streakProgressionPreview);
        settingsPanel.appendChild(streakProgressionRow);

        const carryOverRow = document.createElement("div");
        carryOverRow.className = "dtt-settings-row";
        const carryOverTitle = document.createElement("div");
        carryOverTitle.className = "dtt-settings-row-label";
        carryOverTitle.textContent = getCarryOverTimerLabel();
        const carryOverContent = document.createElement("div");
        carryOverContent.className = "dtt-settings-row-content is-between";
        carryOverContent.title = getCarryOverTimerDisabledTooltip();
        const carryOverHint = document.createElement("div");
        carryOverHint.className = "dtt-settings-row-hint";
        carryOverHint.textContent = getCarryOverTimerHint();
        carryOverHint.title = getCarryOverTimerDisabledTooltip();
        const carryOverInput = document.createElement("input");
        carryOverInput.type = "checkbox";
        carryOverInput.className = "dtt-settings-checkbox";
        carryOverInput.checked = false;
        carryOverInput.title = getCarryOverTimerDisabledTooltip();
        carryOverInput.setAttribute("aria-disabled", "true");
        carryOverInput.style.opacity = "0.55";
        carryOverInput.style.cursor = "not-allowed";
        carryOverInput.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            carryOverInput.checked = false;
        });
        carryOverInput.addEventListener("change", (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.target.checked = false;
        });

        carryOverContent.append(carryOverHint, carryOverInput);
        carryOverRow.append(carryOverTitle, carryOverContent);
        settingsPanel.appendChild(carryOverRow);

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

        const exportRow = document.createElement("div");
        exportRow.className = "dtt-settings-row";
        const exportTitle = document.createElement("div");
        exportTitle.className = "dtt-settings-row-label";
        exportTitle.textContent = t("exportTitle");
        const exportContent = document.createElement("div");
        exportContent.className = "dtt-settings-row-content";
        exportContent.style.cssText = "display:flex;gap:8px;";

        const csvBtn = document.createElement("button");
        csvBtn.type = "button";
        csvBtn.className = "dtt-language-button";
        csvBtn.textContent = t("exportCsv");
        csvBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            exportCsv();
        });

        const jsonBtn = document.createElement("button");
        jsonBtn.type = "button";
        jsonBtn.className = "dtt-language-button";
        jsonBtn.textContent = t("exportJson");
        jsonBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            exportJson();
        });

        exportContent.append(csvBtn, jsonBtn);
        exportRow.append(exportTitle, exportContent);
        settingsPanel.appendChild(exportRow);

        const importRow = document.createElement("div");
        importRow.className = "dtt-settings-row";
        const importTitle = document.createElement("div");
        importTitle.className = "dtt-settings-row-label";
        importTitle.textContent = t("importTitle");
        const importHint = document.createElement("div");
        importHint.className = "dtt-settings-row-hint";
        importHint.textContent = t("importHint");
        const importActions = document.createElement("div");
        importActions.className = "dtt-settings-actions";

        const importMergeBtn = document.createElement("button");
        importMergeBtn.type = "button";
        importMergeBtn.className = "dtt-language-button";
        importMergeBtn.textContent = t("importMerge");
        importMergeBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openImportPicker("merge");
        });

        const importReplaceBtn = document.createElement("button");
        importReplaceBtn.type = "button";
        importReplaceBtn.className = "dtt-language-button";
        importReplaceBtn.textContent = t("importReplace");
        importReplaceBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openImportPicker("replace");
        });

        const importFileInput = document.createElement("input");
        importFileInput.type = "file";
        importFileInput.accept = "application/json,.json";
        importFileInput.style.display = "none";
        importFileInput.addEventListener("click", (event) => event.stopPropagation());
        importFileInput.addEventListener("change", async (event) => {
            event.stopPropagation();
            const file = event.target.files?.[0];
            const mode = event.target.dataset.importMode === "replace" ? "replace" : "merge";
            await importJsonFile(file, mode);
            event.target.value = "";
        });

        importActions.append(importMergeBtn, importReplaceBtn);
        importRow.append(importTitle, importHint, importActions, importFileInput);
        settingsPanel.appendChild(importRow);

        const updateRow = document.createElement("div");
        updateRow.className = "dtt-settings-row";
        const updateTitle = document.createElement("div");
        updateTitle.className = "dtt-settings-row-label";
        updateTitle.textContent = t("updateCheckTitle");
        const updateHint = document.createElement("div");
        updateHint.className = "dtt-settings-row-hint";
        updateHint.textContent = t("updateCheckHint");
        const updateActions = document.createElement("div");
        updateActions.className = "dtt-settings-actions is-soft";

        const updateCheckBtn = document.createElement("button");
        updateCheckBtn.type = "button";
        updateCheckBtn.className = "dtt-language-button dtt-settings-action-button";
        updateCheckBtn.textContent = t("updateCheckButton");
        updateCheckBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await checkForUpdates({ manual: true });
        });

        updateActions.append(updateCheckBtn);
        updateRow.append(updateTitle, updateHint, updateActions);
        settingsPanel.appendChild(updateRow);

        // Export row
        const resetRow = document.createElement("div");
        resetRow.className = "dtt-settings-row";
        const resetTitle = document.createElement("div");
        resetTitle.className = "dtt-settings-row-label";
        resetTitle.textContent = t("resetDataTitle");
        const resetHint = document.createElement("div");
        resetHint.className = "dtt-settings-row-hint";
        resetHint.textContent = t("resetDataHint");
        const resetActions = document.createElement("div");
        resetActions.className = "dtt-settings-actions";

        const resetTodayBtn = document.createElement("button");
        resetTodayBtn.type = "button";
        resetTodayBtn.className = "dtt-settings-danger-button";
        resetTodayBtn.textContent = t("resetToday");
        resetTodayBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!confirmDestructiveAction(t("confirmResetToday"))) {
                return;
            }
            resetTodayData();
        });

        const clearHistoryBtn = document.createElement("button");
        clearHistoryBtn.type = "button";
        clearHistoryBtn.className = "dtt-settings-danger-button";
        clearHistoryBtn.textContent = t("clearHistory");
        clearHistoryBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!confirmDestructiveAction(t("confirmClearHistory"))) {
                return;
            }
            clearHistoryData();
        });

        const fullWipeBtn = document.createElement("button");
        fullWipeBtn.type = "button";
        fullWipeBtn.className = "dtt-settings-danger-button";
        fullWipeBtn.textContent = t("fullWipe");
        fullWipeBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!confirmDestructiveAction(t("confirmFullWipe"))) {
                return;
            }
            fullWipeData();
        });

        resetActions.append(resetTodayBtn, clearHistoryBtn, fullWipeBtn);
        resetRow.append(resetTitle, resetHint, resetActions);
        settingsPanel.appendChild(resetRow);

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
        state.popup.historyToggleNode = historyToggle;
        state.popup.retentionLabelNode = retTitle;
        state.popup.retentionSuffixNode = retSuffix;
        state.popup.settingsGearNode = gearBtn;
        state.popup.settingsPanelNode = settingsPanel;
        state.popup.settingsLangTitleNode = langTitle;
        state.popup.settingsRetentionTitleNode = retTitle;
        state.popup.settingsCarryOverTitleNode = carryOverTitle;
        state.popup.settingsCarryOverHintNode = carryOverHint;
        state.popup.settingsCarryOverInputNode = carryOverInput;
        state.popup.settingsStreakProgressionTitleNode = streakProgressionTitle;
        state.popup.settingsStreakProgressionHintNode = streakProgressionHint;
        state.popup.settingsStreakProgressionInputNode = streakProgressionInput;
        state.popup.settingsStreakProgressionPreviewNode = streakProgressionPreview;
        state.popup.updateCheckTitleNode = updateTitle;
        state.popup.updateCheckHintNode = updateHint;
        state.popup.updateCheckBtnNode = updateCheckBtn;
        state.popup.exportTitleNode = exportTitle;
        state.popup.exportCsvBtnNode = csvBtn;
        state.popup.exportJsonBtnNode = jsonBtn;
        state.popup.importTitleNode = importTitle;
        state.popup.importHintNode = importHint;
        state.popup.importMergeBtnNode = importMergeBtn;
        state.popup.importReplaceBtnNode = importReplaceBtn;
        state.popup.importFileInputNode = importFileInput;
        state.popup.resetDataTitleNode = resetTitle;
        state.popup.resetDataHintNode = resetHint;
        state.popup.resetTodayBtnNode = resetTodayBtn;
        state.popup.clearHistoryBtnNode = clearHistoryBtn;
        state.popup.fullWipeBtnNode = fullWipeBtn;
        state.popup.popupFireNode = fireIconEl;
        state.popup.popupStreakCountNode = fireCount;
        state.popup.lastHistorySignature = "";
        state.popup.lastHeight = 0;
        state.popup.lastLanguage = state.language;
        state.popup.settingsOpen = false;

        updatePopupStaticTextV2();
        updatePopupDynamicContentV2();
        updatePopupHistoryV2();
        updatePopupFireIcon();
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
            state.popup.settingsCarryOverTitleNode.title = getCarryOverTimerDisabledTooltip();
        }
        if (state.popup.settingsCarryOverHintNode) {
            state.popup.settingsCarryOverHintNode.textContent = getCarryOverTimerHint();
            state.popup.settingsCarryOverHintNode.title = getCarryOverTimerDisabledTooltip();
        }
        if (state.popup.settingsCarryOverInputNode) {
            state.popup.settingsCarryOverInputNode.checked = false;
            state.popup.settingsCarryOverInputNode.title = getCarryOverTimerDisabledTooltip();
        }
        if (state.popup.settingsStreakProgressionTitleNode) {
            state.popup.settingsStreakProgressionTitleNode.textContent = t("streakProgressionLabel");
        }
        if (state.popup.settingsStreakProgressionHintNode) {
            state.popup.settingsStreakProgressionHintNode.textContent = t("streakProgressionHint");
        }
        if (state.popup.settingsStreakProgressionInputNode) {
            state.popup.settingsStreakProgressionInputNode.checked = state.longStreakProgressionEnabled;
        }
        if (state.popup.settingsStreakProgressionPreviewNode) {
            state.popup.settingsStreakProgressionPreviewNode.textContent = `${t("streakProgressionTiersLabel")}: ${getStreakTierPreviewText()}`;
        }
        if (state.popup.updateCheckTitleNode) {
            state.popup.updateCheckTitleNode.textContent = t("updateCheckTitle");
        }
        if (state.popup.updateCheckHintNode) {
            state.popup.updateCheckHintNode.textContent = t("updateCheckHint");
        }
        if (state.popup.updateCheckBtnNode) {
            state.popup.updateCheckBtnNode.textContent = t("updateCheckButton");
        }
        if (state.popup.retentionSuffixNode) {
            state.popup.retentionSuffixNode.textContent = getMonthsPlural(state.historyRetentionMonths);
        }
        if (state.popup.exportTitleNode) {
            state.popup.exportTitleNode.textContent = t("exportTitle");
        }
        if (state.popup.exportCsvBtnNode) {
            state.popup.exportCsvBtnNode.textContent = t("exportCsv");
        }
        if (state.popup.exportJsonBtnNode) {
            state.popup.exportJsonBtnNode.textContent = t("exportJson");
        }
        if (state.popup.importTitleNode) {
            state.popup.importTitleNode.textContent = t("importTitle");
        }
        if (state.popup.importHintNode) {
            state.popup.importHintNode.textContent = t("importHint");
        }
        if (state.popup.importMergeBtnNode) {
            state.popup.importMergeBtnNode.textContent = t("importMerge");
        }
        if (state.popup.importReplaceBtnNode) {
            state.popup.importReplaceBtnNode.textContent = t("importReplace");
        }
        if (state.popup.resetDataTitleNode) {
            state.popup.resetDataTitleNode.textContent = t("resetDataTitle");
        }
        if (state.popup.resetDataHintNode) {
            state.popup.resetDataHintNode.textContent = t("resetDataHint");
        }
        if (state.popup.resetTodayBtnNode) {
            state.popup.resetTodayBtnNode.textContent = t("resetToday");
        }
        if (state.popup.clearHistoryBtnNode) {
            state.popup.clearHistoryBtnNode.textContent = t("clearHistory");
        }
        if (state.popup.fullWipeBtnNode) {
            state.popup.fullWipeBtnNode.textContent = t("fullWipe");
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

        const historySignature = `${state.language}|${createHistorySignature(dailySummaryRows)}|${state.popup.historyExpanded ? "1" : "0"}`;
        if (historySignature === state.popup.lastHistorySignature) {
            return;
        }

        updateHistoryToggle(dailySummaryRows);

        renderRows(
            state.popup.historyListNode,
            getDisplayedHistoryRows(dailySummaryRows).map(([date, entry]) => ({
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
        state.popup.historyToggleNode = null;
        state.popup.historyExpanded = false;
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
        state.popup.settingsStreakProgressionTitleNode = null;
        state.popup.settingsStreakProgressionHintNode = null;
        state.popup.settingsStreakProgressionInputNode = null;
        state.popup.settingsStreakProgressionPreviewNode = null;
        state.popup.updateCheckTitleNode = null;
        state.popup.updateCheckHintNode = null;
        state.popup.updateCheckBtnNode = null;
        state.popup.exportTitleNode = null;
        state.popup.exportCsvBtnNode = null;
        state.popup.exportJsonBtnNode = null;
        state.popup.importTitleNode = null;
        state.popup.importHintNode = null;
        state.popup.importMergeBtnNode = null;
        state.popup.importReplaceBtnNode = null;
        state.popup.importFileInputNode = null;
        state.popup.resetDataTitleNode = null;
        state.popup.resetDataHintNode = null;
        state.popup.resetTodayBtnNode = null;
        state.popup.clearHistoryBtnNode = null;
        state.popup.fullWipeBtnNode = null;
        state.popup.popupFireNode = null;
        state.popup.popupStreakCountNode = null;

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

    function checkTrackChange() {
        try {
            const uri = Spicetify.Player.data?.item?.uri || null;
            if (uri && state.runtime._lastTrackUri && uri !== state.runtime._lastTrackUri) {
                saveTodayData();
                if (!state.runtime._streakTestMode) {
                    computeStreak();
                    updatePopupFireIcon();
                }
            }
            state.runtime._lastTrackUri = uri;
        } catch (_) {}
    }

    function updateTrackingState(now) {
        state.lastTickAt = now;

        rolloverDayIfNeeded();
        checkTrackChange();

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
        if (!state.runtime._streakTestMode) {
            computeStreak();
            updatePopupFireIcon();
        }

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
        if (state.runtime.updateCheckIntervalId !== null) {
            clearInterval(state.runtime.updateCheckIntervalId);
            state.runtime.updateCheckIntervalId = null;
        }
        if (state.runtime.apiHealthCheckIntervalId !== null) {
            clearInterval(state.runtime.apiHealthCheckIntervalId);
            state.runtime.apiHealthCheckIntervalId = null;
        }
        hideUpdateModal();
        hideApiUnavailableModal();
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
        state.popup.historyToggleNode = null;
        state.popup.historyExpanded = false;
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
        state.popup.settingsStreakProgressionTitleNode = null;
        state.popup.settingsStreakProgressionHintNode = null;
        state.popup.settingsStreakProgressionInputNode = null;
        state.popup.settingsStreakProgressionPreviewNode = null;
        state.popup.updateCheckTitleNode = null;
        state.popup.updateCheckHintNode = null;
        state.popup.updateCheckBtnNode = null;
        state.popup.exportTitleNode = null;
        state.popup.exportCsvBtnNode = null;
        state.popup.exportJsonBtnNode = null;
        state.popup.importTitleNode = null;
        state.popup.importHintNode = null;
        state.popup.importMergeBtnNode = null;
        state.popup.importReplaceBtnNode = null;
        state.popup.importFileInputNode = null;
        state.popup.resetDataTitleNode = null;
        state.popup.resetDataHintNode = null;
        state.popup.resetTodayBtnNode = null;
        state.popup.clearHistoryBtnNode = null;
        state.popup.fullWipeBtnNode = null;
        state.popup.popupFireNode = null;
        state.popup.popupStreakCountNode = null;
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

console.log("[DailyTimeTracker] Ready.");
