// ==============================================================
// Daily Time Tracker - Spicetify Extension
// Tracks Spotify listening time by day and shows a hover breakdown.
// ==============================================================

export async function startDailyTimeTracker(runtimeOverrides = {}) {
    const normalizedRuntimeChannel = runtimeOverrides.channel === "test" || runtimeOverrides.channel === "dev"
        ? runtimeOverrides.channel
        : "release";
    const runtimeConfig = {
        channel: normalizedRuntimeChannel,
        version: typeof runtimeOverrides.version === "string" ? runtimeOverrides.version : "2.0.1",
        versionCheckUrl: typeof runtimeOverrides.versionCheckUrl === "string"
            ? runtimeOverrides.versionCheckUrl
            : "https://vvertax.site/dtt/ext/version.json",
        storageOptimizationUrl: typeof runtimeOverrides.storageOptimizationUrl === "string"
            ? runtimeOverrides.storageOptimizationUrl
            : "https://vvertax.site/dtt/ext/dtt_optimization.mjs",
        badgeApiBaseUrl: typeof runtimeOverrides.badgeApiBaseUrl === "string"
            ? runtimeOverrides.badgeApiBaseUrl
            : "https://vvertax.site/dtt/api/badge.php",
        devChannelApiBaseUrl: typeof runtimeOverrides.devChannelApiBaseUrl === "string"
            ? runtimeOverrides.devChannelApiBaseUrl
            : "https://vvertax.site/dtt/api/dev_channel.php",
        channelKey: "dtt_channel_v1",
        testNoticeSeenKey: "dtt_test_notice_seen_v1"
    };

    async function DailyTimeTracker() {
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
        sessionsKey: "dtt_sessions_v1",
        languageKey: "dtt_language_v1",
        dailyGoalKey: "dtt_daily_goal_seconds_v1",
        retentionKey: "dtt_history_retention_months_v1",
        retentionForeverKey: "dtt_history_retention_forever_v1",
        popupModeKey: "dtt_popup_mode_v1",
        performanceModeKey: "dtt_performance_mode_v1",
        pauseThresholdKey: "dtt_pause_threshold_seconds_v1",
        longStreakProgressionKey: "dtt_long_streak_progression_enabled_v1",
        streakKey: "dtt_streak_v1",
        streakControlKey: "dtt_streak_control_v1",
        badgeVisibilityKey: "dtt_badge_visibility_v1",
        sessionTrackCountsKey: "dtt_session_track_counts_v1",
        topTracksVisibleKey: "dtt_top_tracks_visible_v1",
        topTracksDisplayCountKey: "dtt_top_tracks_display_count_v1",
        channelKey: runtimeConfig.channelKey,
        testNoticeSeenKey: runtimeConfig.testNoticeSeenKey,
        versionKey: "dtt_version_v1",
        storageOptimizationUrl: runtimeConfig.storageOptimizationUrl,
        versionCheckUrl: runtimeConfig.versionCheckUrl,
        versionCheckIntervalMs: 300000,
        badgeApiBaseUrl: runtimeConfig.badgeApiBaseUrl,
        devChannelApiBaseUrl: runtimeConfig.devChannelApiBaseUrl,
        apiHealthCheckIntervalMs: 300000,
        devChannelRetryMs: 800,
        minTrackCountListenMs: 20000,
        streakThresholdSeconds: 300,
        streakShieldsPerMonth: 4,
        historyRetentionMonths: 1,
        maxHistoryRetentionMonths: 6,
        defaultPauseSeconds: 30,
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

    const CHANNEL = runtimeConfig.channel;
    const VERSION = runtimeConfig.version;

    let historyCache = null;

    await runStorageOptimization();

    const state = {
        day: null,
        language: loadLanguage(),
        historyRetentionMonths: loadHistoryRetentionMonths(),
        historyRetentionForever: loadHistoryRetentionForever(),
        popupMode: loadPopupMode(),
        performanceMode: loadPerformanceMode(),
        pauseSeconds: loadPauseSeconds(),
        dailyGoalSeconds: loadDailyGoalSeconds(),
        longStreakProgressionEnabled: loadLongStreakProgressionEnabled(),
        streak: loadStreakData(),
        streakControl: loadStreakControlData(),
        badgeVisible: loadBadgeVisibility(),
        topTracksVisible: loadTopTracksVisible(),
        topTracksDisplayCount: loadTopTracksDisplayCount(),
        badge: null,
        devChannelAvailable: false,
        sessionTrackData: null,
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
            viewMode: "today",
            weeklyDetailMode: "summary",
            viewToggleNode: null,
            hintNode: null,
            titleNode: null,
            badgeNode: null,
            summaryDateNode: null,
            summaryTotalNode: null,
            summaryGoalWrapNode: null,
            summaryGoalLabelNode: null,
            summaryGoalValueNode: null,
            summaryGoalProgressNode: null,
            summaryTopTracksWrapNode: null,
            summaryTopTracksListNode: null,
            intervalsSectionNode: null,
            sessionsTitleNode: null,
            intervalsListNode: null,
            todaySessionsToggleNode: null,
            todaySessionsExpanded: false,
            historySectionNode: null,
            historyTitleNode: null,
            historyListNode: null,
            historyToggleNode: null,
            historyExpanded: false,
            weeklySectionNode: null,
            weeklySectionTitleNode: null,
            weeklyDetailSwitchNode: null,
            weeklyAverageLabelNode: null,
            weeklyAverageValueNode: null,
            weeklyBestDayLabelNode: null,
            weeklyBestDayValueNode: null,
            weeklyBarsNode: null,
            weeklyCompareNode: null,
            weeklyCompareTodayLabelNode: null,
            weeklyCompareTodayValueNode: null,
            weeklyCompareYesterdayLabelNode: null,
            weeklyCompareYesterdayValueNode: null,
            weeklyCompareDeltaLabelNode: null,
            weeklyCompareDeltaValueNode: null,
            lastHistorySignature: "",
            lastIntervalsSignature: "",
            lastTopTracksSignature: "",
            lastWeeklySignature: "",
            lastSummarySignature: "",
            lastLanguage: null,
            weeklyBarNodes: [],
            languageButtons: [],
            retentionLabelNode: null,
            retentionSuffixNode: null,
            settingsOpen: false,
            settingsGearNode: null,
            settingsBackNode: null,
            settingsPanelNode: null,
            settingsLangTitleNode: null,
            settingsGoalTitleNode: null,
            settingsGoalHintNode: null,
            settingsGoalInputNode: null,
            settingsGoalUnitNode: null,
            settingsPopupModeTitleNode: null,
            settingsPopupModeHintNode: null,
            settingsPopupModeButtons: [],
            settingsPerformanceModeTitleNode: null,
            settingsPerformanceModeHintNode: null,
            settingsPerformanceModeButtons: [],
            settingsChannelTitleNode: null,
            settingsChannelHintNode: null,
            settingsChannelButtons: [],
            settingsPauseThresholdTitleNode: null,
            settingsPauseThresholdHintNode: null,
            settingsPauseThresholdButtons: [],
            settingsStreakShieldsTitleNode: null,
            settingsStreakShieldsHintNode: null,
            settingsKeepStreakTitleNode: null,
            settingsKeepStreakHintNode: null,
            settingsKeepStreakInputNode: null,
            settingsKeepStreakPreviewNode: null,
            settingsRetentionTitleNode: null,
            settingsRetentionInputNode: null,
            settingsRetentionForeverTitleNode: null,
            settingsRetentionForeverHintNode: null,
            settingsRetentionForeverInputNode: null,
            settingsStreakProgressionTitleNode: null,
            settingsStreakProgressionHintNode: null,
            settingsStreakProgressionInputNode: null,
            settingsStreakProgressionPreviewNode: null,
            settingsBadgeRowNode: null,
            settingsBadgeTitleNode: null,
            settingsBadgeHintNode: null,
            settingsBadgeInputNode: null,
            settingsTopTracksTitleNode: null,
            settingsTopTracksHintNode: null,
            settingsTopTracksInputNode: null,
            settingsTopTracksCountRowNode: null,
            settingsTopTracksCountTitleNode: null,
            settingsTopTracksCountButtons: [],
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
            settingsVersionNode: null,
            popupFireNode: null,
            popupStreakCountNode: null,
            lastHeight: 0
        },
        ui: {
            widget: null,
            timeNode: null,
            goalNode: null,
            pendingInjectCheck: false,
            resizeHandler: null,
            beforeUnloadHandler: null,
            visibilityHandler: null,
            lastWidgetSignature: "",
            injectObserverTimeoutId: null
        },
        runtime: {
            intervalId: null,
            injectObserver: null,
            injectRetryTimeoutId: null,
            devChannelRetryTimeoutId: null,
            updateCheckIntervalId: null,
            apiHealthCheckIntervalId: null,
            _streakTestMode: false,
            _lastTrackUri: null,
            _lastTrackProgressMs: null,
            _activeTrackInfo: null,
            _activeTrackKey: "",
            _activeTrackListenedMs: 0,
            _activeTrackQualified: false,
            _activeTrackFinalized: false,
            _lastStreakThresholdMet: false,
            popupPositionFrameId: null
        }
    };

    state.day = loadTodayData();
    state.sessionTrackData = loadTodaySessionTrackData(state.day.date);
    state.runtime._lastStreakThresholdMet = getComputedDayTotalSeconds() >= loadStreakThreshold();

    const I18N = {
        ru: {
            widgetTitle: "РќР°Р¶РјРёС‚Рµ, С‡С‚РѕР±С‹ Р·Р°РєСЂРµРїРёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ",
            popupTitle: "РЎС‚Р°С‚РёСЃС‚РёРєР° РїРѕ РґРЅСЏРј",
            popupHintPinned: "Р—Р°РєСЂРµРїР»РµРЅРѕ. РќР°Р¶РјРёС‚Рµ, С‡С‚РѕР±С‹ РѕС‚РєСЂРµРїРёС‚СЊ.",
            popupHintHover: "РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ. РќР°Р¶РјРёС‚Рµ, С‡С‚РѕР±С‹ Р·Р°РєСЂРµРїРёС‚СЊ.",
            todayLabel: "СЃРµРіРѕРґРЅСЏ",
            emptyState: "РџРѕРєР° РЅРµС‚ РґР°РЅРЅС‹С… РїРѕ РґРЅСЏРј.",
            sessionsTodayTitle: "РЎРµСЃСЃРёРё СЃРµРіРѕРґРЅСЏ",
            topTracksEmpty: "РџРѕРєР° РЅРµС‚ РїСЂРѕСЃР»СѓС€РёРІР°РЅРёР№.",
            topTracksToggleLabel: "РўРѕРї С‚СЂРµРєРѕРІ",
            topTracksToggleHint: "РџРѕРєР°Р·С‹РІР°С‚СЊ Р±Р»РѕРє СЃ СЃР°РјС‹РјРё С‡Р°СЃС‚Рѕ РїСЂРѕРёРіСЂР°РЅРЅС‹РјРё С‚СЂРµРєР°РјРё Р·Р° С‚РµРєСѓС‰РёР№ РґРµРЅСЊ.",
            topTracksCountLabel: "РџРѕРєР°Р·С‹РІР°С‚СЊ С‚СЂРµРєРѕРІ",
            topTracksCountHint: "РЎРєРѕР»СЊРєРѕ С‚СЂРµРєРѕРІ РїРѕРєР°Р·С‹РІР°С‚СЊ РІ Р±Р»РѕРєРµ СЃРІРѕРґРєРё.",
            topTracksPlayCount: "РїСЂРѕСЃР».",
            historyTitle: "РСЃС‚РѕСЂРёСЏ",
            dailyGoalLabel: "Daily Goal",
            dailyGoalHint: "Goal in minutes. `0` disables the goal.",
            dailyGoalUnit: "min",
            dailyGoalProgress: "Р¦РµР»СЊ",
            dailyGoalComplete: "Р¦РµР»СЊ РІС‹РїРѕР»РЅРµРЅР°",
            retentionLabel: "РҐСЂР°РЅРёС‚СЊ РёСЃС‚РѕСЂРёСЋ",
            retentionSuffix: "РјРµСЃСЏС†(РµРІ)",
            retentionForeverLabel: "РҐСЂР°РЅРёС‚СЊ РёСЃС‚РѕСЂРёСЋ РІСЃРµРіРґР°",
            retentionForeverHint: "РћС‚РєР»СЋС‡Р°РµС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєСѓСЋ РѕС‡РёСЃС‚РєСѓ Р°СЂС…РёРІР°.",
            retentionForeverValue: "Р’СЃРµРіРґР°",
            retentionForeverWarning: "Р’РєР»СЋС‡РёС‚СЊ СЂРµР¶РёРј Forever? РСЃС‚РѕСЂРёСЏ РїРµСЂРµСЃС‚Р°РЅРµС‚ РѕС‡РёС‰Р°С‚СЊСЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Рё СЃРѕ РІСЂРµРјРµРЅРµРј РјРѕР¶РµС‚ Р·Р°РјРµС‚РЅРѕ СѓРІРµР»РёС‡РёС‚СЊ РѕР±СЉРµРј LocalStorage.",
            toggleOn: "Р’РљР›",
            toggleOff: "Р’Р«РљР›",
            settingsTitle: "РќР°СЃС‚СЂРѕР№РєРё",
            settingsBack: "РќР°Р·Р°Рґ",
            languageLabel: "РЇР·С‹Рє",
            popupModeLabel: "Р РµР¶РёРј popup",
            popupModeHint: "Compact РґРµР»Р°РµС‚ popup РєРѕСЂРѕС‡Рµ, Full РїРѕРєР°Р·С‹РІР°РµС‚ РІСЃРµ СЃРµСЃСЃРёРё, РІСЃСЋ РёСЃС‚РѕСЂРёСЋ Рё weekly view.",
            popupModeCompact: "Compact",
            popupModeFull: "Full",
            performanceModeLabel: "Р РµР¶РёРј РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё",
            performanceModeHint: "РћР±Р»РµРіС‡Р°РµС‚ popup Рё РІРёР·СѓР°Р»СЊРЅС‹Рµ СЌС„С„РµРєС‚С‹ РЅР° СЃР»Р°Р±С‹С… CPU/GPU.",
            performanceModeDefault: "РћР±С‹С‡РЅС‹Р№",
            performanceModeLightweight: "Р›РµРіРєРёР№",
            pauseThresholdLabel: "РџРѕСЂРѕРі РїР°СѓР·С‹",
            pauseThresholdHint: "Р§РµСЂРµР· СЃРєРѕР»СЊРєРѕ СЃРµРєСѓРЅРґ РїР°СѓР·С‹ С‚РµРєСѓС‰Р°СЏ СЃРµСЃСЃРёСЏ СЃС‡РёС‚Р°РµС‚СЃСЏ Р·Р°РІРµСЂС€РµРЅРЅРѕР№.",
            streakShieldsLabel: "Р©РёС‚С‹ СЃРµСЂРёРё",
            streakShieldsHint: "Р”Рѕ 4 РїСЂРѕРїСѓС‰РµРЅРЅС‹С… РґРЅРµР№ РІ РєР°Р»РµРЅРґР°СЂРЅРѕРј РјРµСЃСЏС†Рµ Р·Р°С‰РёС‰Р°СЋС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Р±РµР· СЂРѕСЃС‚Р° СЃРµСЂРёРё.",
            streakShieldsRemaining: "РћСЃС‚Р°Р»РѕСЃСЊ С‰РёС‚РѕРІ РІ СЌС‚РѕРј РјРµСЃСЏС†Рµ",
            keepStreakLabel: "Keep streak",
            keepStreakHint: "РЎРѕС…СЂР°РЅСЏРµС‚ С‚РµРєСѓС‰СѓСЋ СЃРµСЂРёСЋ Р±РµР· СЂРѕСЃС‚Р°, РїРѕРєР° СЂРµР¶РёРј РІРєР»СЋС‡РµРЅ.",
            keepStreakProtectedToday: "РЎРµРіРѕРґРЅСЏ СЃРµСЂРёСЏ Р·Р°С‰РёС‰РµРЅР° РІСЂСѓС‡РЅСѓСЋ",
            languageRu: "RU",
            languageEn: "EN",
            streakLabel: "РЎРµСЂРёСЏ",
            streakDays: "РґРЅ.",
            streakProgressionLabel: "Р”Р»РёРЅРЅР°СЏ РїСЂРѕРіСЂРµСЃСЃРёСЏ СЃРµСЂРёРё",
            streakProgressionHint: "Р”РѕР±Р°РІР»СЏРµС‚ Р±РѕР»СЊС€Рµ С†РІРµС‚РѕРІС‹С… СѓСЂРѕРІРЅРµР№ Рё РїРµСЂРµРЅРѕСЃРёС‚ Р±РµР»С‹Р№ РјР°РєСЃРёРјСѓРј РЅР° 500+.",
            streakProgressionTiersLabel: "РђРєС‚РёРІРЅС‹Рµ СѓСЂРѕРІРЅРё",
            badgeVisibilityLabel: "Р‘РµР№РґР¶РёРє",
            badgeVisibilityHint: "РџРѕРєР°Р·С‹РІР°С‚СЊ Р±РµР№РґР¶РёРє РІ Р·Р°РіРѕР»РѕРІРєРµ popup.",
            exportTitle: "Р­РєСЃРїРѕСЂС‚ РґР°РЅРЅС‹С…",
            exportCsv: "РЎРєР°С‡Р°С‚СЊ CSV",
            exportJson: "РЎРєР°С‡Р°С‚СЊ JSON",
            importTitle: "РРјРїРѕСЂС‚ РёР· JSON",
            importHint: "Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РёР»Рё РѕР±СЉРµРґРёРЅРёС‚СЊ РґР°РЅРЅС‹Рµ РёР· СЂР°РЅРµРµ СЌРєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅРЅРѕРіРѕ JSON.",
            importMerge: "РњРµСЂРґР¶",
            importReplace: "Р—Р°РјРµРЅРёС‚СЊ",
            importReadError: "РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ РІС‹Р±СЂР°РЅРЅС‹Р№ JSON-С„Р°Р№Р».",
            importInvalid: "РРјРїРѕСЂС‚ РѕС‚РєР»РѕРЅРµРЅ: РѕР¶РёРґР°РµС‚СЃСЏ JSON РІ С„РѕСЂРјР°С‚Рµ export (РґР°С‚Р° -> totalSeconds / intervals).",
            importTooLarge: "РРјРїРѕСЂС‚ РѕС‚РєР»РѕРЅРµРЅ: С„Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№.",
            importTooManyDays: "РРјРїРѕСЂС‚ РѕС‚РєР»РѕРЅРµРЅ: СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ РґРЅРµР№ РІ С„Р°Р№Р»Рµ.",
            importTooManyIntervals: "РРјРїРѕСЂС‚ РѕС‚РєР»РѕРЅРµРЅ: СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ РёРЅС‚РµСЂРІР°Р»РѕРІ РІ РѕРґРЅРѕРј РґРЅРµ.",
            importConfirmMerge: "РРјРїРѕСЂС‚ JSON СЃ РѕР±СЉРµРґРёРЅРµРЅРёРµРј?",
            importConfirmReplace: "РРјРїРѕСЂС‚ JSON СЃ РїРѕР»РЅРѕР№ Р·Р°РјРµРЅРѕР№?",
            importPreviewDays: "Р”РЅРµР№ РІ С„Р°Р№Р»Рµ",
            importPreviewAffected: "Р—Р°С‚СЂРѕРЅСѓС‚Рѕ РґРЅРµР№",
            importPreviewConflicts: "РџРµСЂРµСЃРµС‡РµРЅРёР№",
            importPreviewImportedTotal: "Р’СЂРµРјСЏ РІ С„Р°Р№Р»Рµ",
            importPreviewResultTotal: "РС‚РѕРі РїРѕСЃР»Рµ РёРјРїРѕСЂС‚Р°",
            importSuccessMerge: "РРјРїРѕСЂС‚ Р·Р°РІРµСЂС€РµРЅ: РґР°РЅРЅС‹Рµ РѕР±СЉРµРґРёРЅРµРЅС‹.",
            importSuccessReplace: "РРјРїРѕСЂС‚ Р·Р°РІРµСЂС€РµРЅ: РґР°РЅРЅС‹Рµ Р·Р°РјРµРЅРµРЅС‹.",
            updateCheckTitle: "РџСЂРѕРІРµСЂРєР° РѕР±РЅРѕРІР»РµРЅРёР№",
            updateCheckHint: "РџСЂРѕРІРµСЂРёС‚СЊ РЅР°Р»РёС‡РёРµ РЅРѕРІРѕР№ РІРµСЂСЃРёРё РІСЂСѓС‡РЅСѓСЋ.",
            updateCheckButton: "РџСЂРѕРІРµСЂРёС‚СЊ",
            updateCheckCurrent: "РЈ РІР°СЃ СѓР¶Рµ РїРѕСЃР»РµРґРЅСЏСЏ РІРµСЂСЃРёСЏ.",
            updateCheckFailed: "РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕРІРµСЂРёС‚СЊ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂСЏРјРѕ СЃРµР№С‡Р°СЃ.",
            resetDataTitle: "РћС‡РёСЃС‚РєР° / РЎР±СЂРѕСЃ РґР°РЅРЅС‹С…",
            resetDataHint: "Р”РµР№СЃС‚РІРёСЏ РЅРµРѕР±СЂР°С‚РёРјС‹. РџРµСЂРµРґ РїРѕР»РЅС‹Рј СЃР±СЂРѕСЃРѕРј Р»СѓС‡С€Рµ СЌРєСЃРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ РґР°РЅРЅС‹Рµ.",
            resetToday: "РЎР±СЂРѕСЃРёС‚СЊ СЃРµРіРѕРґРЅСЏ",
            clearHistory: "РћС‡РёСЃС‚РёС‚СЊ РёСЃС‚РѕСЂРёСЋ",
            fullWipe: "РџРѕР»РЅС‹Р№ СЃР±СЂРѕСЃ",
            weeklyToggle: "РќРµРґРµР»СЏ",
            weeklyToggleTitle: "РџРѕРєР°Р·Р°С‚СЊ РЅРµРґРµР»СЊРЅСѓСЋ СЃРІРѕРґРєСѓ",
            weeklyRangeLabel: "РџРѕСЃР»РµРґРЅРёРµ 7 РґРЅРµР№",
            weeklySummaryTitle: "РќРµРґРµР»СЊРЅР°СЏ СЃРІРѕРґРєР°",
            weeklyAverageLabel: "РЎСЂРµРґРЅРµРµ РІ РґРµРЅСЊ",
            weeklyBestDayLabel: "РЎР°РјС‹Р№ Р°РєС‚РёРІРЅС‹Р№ РґРµРЅСЊ",
            weeklyBestDayEmpty: "РќРµС‚ РґР°РЅРЅС‹С…",
            yesterdayVsTodayTitle: "Yesterday vs Today",
            yesterdayVsTodaySwitchTitle: "РџРµСЂРµРєР»СЋС‡РёС‚СЊ weekly section",
            comparisonTodayLabel: "РЎРµРіРѕРґРЅСЏ",
            comparisonYesterdayLabel: "Р’С‡РµСЂР°",
            comparisonDeltaLabel: "Р Р°Р·РЅРёС†Р°",
            comparisonNoYesterday: "Р’С‡РµСЂР° РґР°РЅРЅС‹С… РЅРµС‚",
            confirmResetToday: "РЎР±СЂРѕСЃРёС‚СЊ РґР°РЅРЅС‹Рµ Р·Р° СЃРµРіРѕРґРЅСЏ? РСЃС‚РѕСЂРёСЏ РѕСЃС‚Р°РЅРµС‚СЃСЏ РЅРµС‚СЂРѕРЅСѓС‚РѕР№.",
            confirmClearHistory: "РћС‡РёСЃС‚РёС‚СЊ РІСЃСЋ Р°СЂС…РёРІРЅСѓСЋ РёСЃС‚РѕСЂРёСЋ? Р”Р°РЅРЅС‹Рµ Р·Р° СЃРµРіРѕРґРЅСЏ РѕСЃС‚Р°РЅСѓС‚СЃСЏ.",
            confirmFullWipe: "РџРѕР»РЅРѕСЃС‚СЊСЋ СѓРґР°Р»РёС‚СЊ РІСЃРµ РґР°РЅРЅС‹Рµ Daily Time Tracker Рё СЃР±СЂРѕСЃРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё?",
            updateBadge: "РћР‘РќРћР’Р›Р•РќРР•",
            updateTitle: "Р”РѕСЃС‚СѓРїРЅРѕ РѕР±РЅРѕРІР»РµРЅРёРµ Daily Time Tracker",
            updateSubtitle: "РџРµСЂРµР·Р°РіСЂСѓР·РёС‚Рµ Spotify РґР»СЏ РїСЂРёРјРµРЅРµРЅРёСЏ РѕР±РЅРѕРІР»РµРЅРёСЏ.",
            updateVersionLabel: "Р’Р•Р РЎРРЇ",
            updateBtnRestart: "РџРµСЂРµР·Р°РїСѓСЃС‚РёС‚СЊ",
            updateBtnReleaseNotes: "Р§С‚Рѕ РЅРѕРІРѕРіРѕ",
            apiUnavailableBadge: "API",
            apiUnavailableTitle: "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ Рє API Daily Time Tracker",
            apiUnavailableSubtitle: "РЎРєСЂРёРїС‚ РїСЂРѕРґРѕР»Р¶РёС‚ СЂР°Р±РѕС‚Р°С‚СЊ РєР°Рє СЂР°РЅСЊС€Рµ. РџРѕРІС‚РѕСЂРЅР°СЏ РїСЂРѕРІРµСЂРєР° Р±СѓРґРµС‚ РІС‹РїРѕР»РЅРµРЅР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё."
        },
        en: {
            widgetTitle: "Click to pin statistics",
            popupTitle: "Daily History",
            popupHintPinned: "Pinned. Click to unpin.",
            popupHintHover: "Hover preview. Click to pin.",
            todayLabel: "today",
            emptyState: "No daily history yet.",
            sessionsTodayTitle: "Today Sessions",
            topTracksEmpty: "No track plays yet.",
            topTracksToggleLabel: "Top tracks",
            topTracksToggleHint: "Show the block with the most played tracks for the current day.",
            topTracksCountLabel: "Show tracks",
            topTracksCountHint: "How many top tracks to show in the summary.",
            topTracksPlayCount: "plays",
            historyTitle: "History",
            dailyGoalLabel: "Daily goal",
            dailyGoalHint: "Goal in minutes. `0` disables the goal.",
            dailyGoalUnit: "min",
            dailyGoalProgress: "Goal",
            dailyGoalComplete: "Goal completed",
            retentionLabel: "Keep history for",
            retentionSuffix: "months",
            retentionForeverLabel: "Keep history forever",
            retentionForeverHint: "Disables automatic archive pruning.",
            retentionForeverValue: "Forever",
            retentionForeverWarning: "Enable Forever mode? History will stop pruning automatically and may use much more LocalStorage over time.",
            toggleOn: "ON",
            toggleOff: "OFF",
            settingsTitle: "Settings",
            settingsBack: "Back",
            languageLabel: "Language",
            popupModeLabel: "Popup mode",
            popupModeHint: "Compact keeps the popup shorter. Full shows all sessions, full history, and the weekly view toggle.",
            popupModeCompact: "Compact",
            popupModeFull: "Full",
            performanceModeLabel: "Performance mode",
            performanceModeHint: "Reduces popup and visual effect cost on weaker CPU/GPU systems.",
            performanceModeDefault: "Default",
            performanceModeLightweight: "Lightweight",
            pauseThresholdLabel: "Pause threshold",
            pauseThresholdHint: "How many paused seconds are allowed before the current session is closed.",
            streakShieldsLabel: "Streak shields",
            streakShieldsHint: "Up to 4 missed days per calendar month are protected automatically without growing the streak.",
            streakShieldsRemaining: "Shields left this month",
            keepStreakLabel: "Keep streak",
            keepStreakHint: "Preserves the current streak without growth while enabled.",
            keepStreakProtectedToday: "The streak is manually protected today",
            languageRu: "RU",
            languageEn: "EN",
            streakLabel: "Streak",
            streakDays: "d",
            streakProgressionLabel: "Long streak progression",
            streakProgressionHint: "Adds more color tiers and moves white max tier to 500+.",
            streakProgressionTiersLabel: "Active tiers",
            badgeVisibilityLabel: "Badge",
            badgeVisibilityHint: "Show the badge in the popup header.",
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
            weeklyToggle: "Week",
            weeklyToggleTitle: "Show weekly summary",
            weeklyRangeLabel: "Last 7 days",
            weeklySummaryTitle: "Weekly Summary",
            weeklyAverageLabel: "Daily average",
            weeklyBestDayLabel: "Most active day",
            weeklyBestDayEmpty: "No data",
            yesterdayVsTodayTitle: "Yesterday vs Today",
            yesterdayVsTodaySwitchTitle: "Switch weekly section",
            comparisonTodayLabel: "Today",
            comparisonYesterdayLabel: "Yesterday",
            comparisonDeltaLabel: "Difference",
            comparisonNoYesterday: "No data yesterday",
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
    fetchDevChannelAccess();
    maybeShowTestChannelWarning();
    syncStoredVersionWithCurrentScript();
    checkForUpdates();
    state.runtime.updateCheckIntervalId = setInterval(checkForUpdates, CONFIG.versionCheckIntervalMs);
    checkApiAvailability();
    state.runtime.apiHealthCheckIntervalId = setInterval(checkApiAvailability, CONFIG.apiHealthCheckIntervalMs);

    // РІвЂќР‚РІвЂќР‚ TEMP: test streak colors РІвЂќР‚РІвЂќР‚
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
        if (state.historyRetentionForever) {
            return "";
        }
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - state.historyRetentionMonths);
        return formatDateString(cutoff);
    }

    function normalizeHistoryRetentionMonths(value) {
        const normalized = Math.floor(Number(value) || CONFIG.historyRetentionMonths);
        return Math.min(CONFIG.maxHistoryRetentionMonths, Math.max(1, normalized));
    }

    function normalizeDailyGoalSeconds(value) {
        const normalized = Math.floor(Number(value) || 0);
        if (normalized <= 0) {
            return 0;
        }

        return Math.min(24 * 60 * 60, normalized);
    }

    function getMonthsPlural(n) {
        if (state.language === "ru") {
            const mod10 = n % 10;
            const mod100 = n % 100;
            if (mod100 >= 11 && mod100 <= 19) return "РјРµСЃСЏС†РµРІ";
            if (mod10 === 1) return "РјРµСЃСЏС†";
            if (mod10 >= 2 && mod10 <= 4) return "РјРµСЃСЏС†Р°";
            return "РјРµСЃСЏС†РµРІ";
        }
        return n === 1 ? "month" : "months";
    }

    function getRetentionDisplayText() {
        return state.historyRetentionForever
            ? t("retentionForeverValue")
            : getMonthsPlural(state.historyRetentionMonths);
    }

    function getDailyGoalProgress(totalSeconds = getComputedDayTotalSeconds()) {
        const targetSeconds = normalizeDailyGoalSeconds(state.dailyGoalSeconds);
        if (targetSeconds <= 0) {
            return {
                enabled: false,
                targetSeconds: 0,
                totalSeconds,
                ratio: 0,
                percentage: 0,
                remainingSeconds: 0,
                complete: false
            };
        }

        const ratio = totalSeconds / targetSeconds;
        const percentage = Math.max(0, Math.min(999, Math.floor(ratio * 100)));
        return {
            enabled: true,
            targetSeconds,
            totalSeconds,
            ratio,
            percentage,
            remainingSeconds: Math.max(0, targetSeconds - totalSeconds),
            complete: totalSeconds >= targetSeconds
        };
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

    function parseLocalDateString(dateString) {
        return new Date(`${dateString}T12:00:00`);
    }

    function shiftDateString(dateString, dayOffset) {
        const date = parseLocalDateString(dateString);
        date.setDate(date.getDate() + dayOffset);
        return formatDateString(date);
    }

    function formatWeekdayLabel(dateString) {
        return new Intl.DateTimeFormat(state.language === "ru" ? "ru-RU" : "en-US", {
            weekday: "short"
        }).format(parseLocalDateString(dateString));
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
        const listenedMs = Number(interval?.listenedMs);
        if (Number.isFinite(listenedMs) && listenedMs >= 0) {
            return Math.max(0, Math.floor(listenedMs / 1000));
        }

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

        const normalized = {
            start: interval.start,
            end: interval.end
        };
        const listenedMs = Math.max(0, Math.floor(Number(interval.listenedMs)));
        if (Number.isFinite(listenedMs)) {
            normalized.listenedMs = listenedMs;
        }

        return normalized;
    }

    function cloneInterval(interval) {
        const cloned = {
            start: interval.start,
            end: interval.end
        };

        if (Number.isFinite(interval?.listenedMs)) {
            cloned.listenedMs = interval.listenedMs;
        }

        return cloned;
    }

    function getDayStartTimestamp(dateString) {
        return new Date(`${dateString}T00:00:00`).getTime();
    }

    function normalizeTimestampForDate(value, dateString) {
        const numericValue = Math.floor(Number(value) || 0);
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return numericValue;
        }

        if (numericValue >= 100000000000) {
            return numericValue;
        }

        if (!dateString) {
            return numericValue * 1000;
        }

        const dayStart = getDayStartTimestamp(dateString);

        if (numericValue < 172800) {
            return dayStart + numericValue * 1000;
        }

        if (numericValue < 172800000) {
            return dayStart + numericValue;
        }

        return numericValue * 1000;
    }

    function normalizeIntervalForDate(interval, dateString) {
        if (!interval || typeof interval.start !== "number" || typeof interval.end !== "number") {
            return null;
        }

        const start = normalizeTimestampForDate(interval.start, dateString);
        const end = normalizeTimestampForDate(interval.end, dateString);

        if (end <= start) {
            return null;
        }

        return {
            start,
            end
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
        const date = typeof data?.date === "string" ? data.date : fallbackDate;
        return {
            date,
            totalSeconds: Math.max(0, Math.floor(Number(data?.totalSeconds) || 0)),
            intervals: Array.isArray(data?.intervals)
                ? data.intervals.map((interval) => normalizeIntervalForDate(interval, date)).filter(Boolean)
                : []
        };
    }

    function normalizeStoredSessionInterval(interval, dateString) {
        if (Array.isArray(interval) && interval.length >= 2) {
            const start = normalizeTimestampForDate(interval[0], dateString);
            const end = normalizeTimestampForDate(interval[1], dateString);
            if (end <= start) {
                return null;
            }

            const normalized = {
                start,
                end
            };
            const listenedSeconds = Math.max(0, Math.floor(Number(interval[2])));
            if (Number.isFinite(listenedSeconds)) {
                normalized.listenedMs = listenedSeconds * 1000;
            }

            return normalized;
        }

        return normalizeIntervalForDate(interval, dateString);
    }

    function serializeStoredSessionInterval(interval) {
        const normalized = normalizeInterval(interval);
        if (!normalized) {
            return null;
        }

        const startSeconds = Math.floor(normalized.start / 1000);
        const endSeconds = Math.max(startSeconds + 1, Math.ceil(normalized.end / 1000));
        const listenedSeconds = getIntervalDurationSeconds(normalized);
        return [startSeconds, endSeconds, listenedSeconds];
    }

    function normalizeSessionsData(data, fallbackDate) {
        const date = typeof data?.date === "string" ? data.date : fallbackDate;
        return {
            date,
            intervals: Array.isArray(data?.intervals)
                ? data.intervals.map((interval) => normalizeStoredSessionInterval(interval, date)).filter(Boolean)
                : []
        };
    }

    function createEmptySessionTrackData(date) {
        return {
            date,
            sessions: []
        };
    }

    function normalizeSessionTrackPlay(play) {
        const uri = typeof play?.uri === "string" ? play.uri : "";
        const name = typeof play?.name === "string" ? play.name.trim() : "";
        const artist = typeof play?.artist === "string" ? play.artist.trim() : "";
        const plays = Math.max(1, Math.floor(Number(play?.plays) || 0));

        if (!uri && !name) {
            return null;
        }

        return {
            uri,
            name,
            artist,
            plays
        };
    }

    function cloneSessionTrackPlay(play) {
        return {
            uri: play.uri,
            name: play.name,
            artist: play.artist,
            plays: play.plays
        };
    }

    function normalizeSessionTrackSummary(entry) {
        if (!entry || typeof entry.start !== "number" || typeof entry.end !== "number") {
            return null;
        }

        if (entry.end <= entry.start) {
            return null;
        }

        return {
            start: entry.start,
            end: entry.end,
            tracks: Array.isArray(entry?.tracks)
                ? entry.tracks.map(normalizeSessionTrackPlay).filter(Boolean)
                : []
        };
    }

    function cloneSessionTrackSummary(entry) {
        return {
            start: entry.start,
            end: entry.end,
            tracks: entry.tracks.map(cloneSessionTrackPlay)
        };
    }

    function normalizeSessionTrackData(data, fallbackDate) {
        return {
            date: typeof data?.date === "string" ? data.date : fallbackDate,
            sessions: Array.isArray(data?.sessions)
                ? data.sessions.map(normalizeSessionTrackSummary).filter(Boolean)
                : []
        };
    }

    function createLiveSession(startAt) {
        return {
            start: startAt,
            listenedMs: 0,
            lastResumedAt: startAt,
            tracks: [],
            lastCountedTrackKey: ""
        };
    }

    function getLiveSessionListenedMs(now = Date.now()) {
        if (!state.currentSession) {
            return 0;
        }

        const listenedMs = Math.max(0, Math.floor(Number(state.currentSession.listenedMs) || 0));
        if (typeof state.currentSession.lastResumedAt !== "number") {
            return listenedMs;
        }

        return listenedMs + Math.max(0, now - state.currentSession.lastResumedAt);
    }

    function pauseCurrentSession(now) {
        if (!state.currentSession || typeof state.currentSession.lastResumedAt !== "number") {
            return;
        }

        state.currentSession.listenedMs = getLiveSessionListenedMs(now);
        state.currentSession.lastResumedAt = null;
    }

    function resumeCurrentSession(now) {
        if (!state.currentSession) {
            return;
        }

        if (typeof state.currentSession.lastResumedAt !== "number") {
            state.currentSession.lastResumedAt = now;
        }
    }

    function buildIntervalFromCurrentSession(endAt, now = endAt) {
        if (!state.currentSession) {
            return null;
        }

        return normalizeInterval({
            start: state.currentSession.start,
            end: endAt,
            listenedMs: getLiveSessionListenedMs(now)
        });
    }

    function getCurrentTrackInfo() {
        const item = Spicetify.Player.data?.item;
        const uri = typeof item?.uri === "string" ? item.uri : "";
        const name = typeof item?.name === "string" ? item.name.trim() : "";
        const artist = Array.isArray(item?.artists)
            ? item.artists
                .map((entry) => typeof entry?.name === "string" ? entry.name.trim() : "")
                .filter(Boolean)
                .join(", ")
            : "";

        if (!uri && !name) {
            return null;
        }

        return {
            uri,
            name,
            artist
        };
    }

    function getCurrentTrackProgressMs() {
        const player = Spicetify.Player;
        const candidateValues = [
            typeof player?.getProgress === "function" ? player.getProgress() : null,
            typeof player?.getProgressMs === "function" ? player.getProgressMs() : null,
            player?.data?.progressMs,
            player?.data?.positionAsOfTimestamp,
            player?.progressMs
        ];

        for (const value of candidateValues) {
            const normalized = Number(value);
            if (Number.isFinite(normalized) && normalized >= 0) {
                return normalized;
            }
        }

        return null;
    }

    function getTrackSessionKey(trackInfo) {
        if (!trackInfo) {
            return "";
        }

        return trackInfo.uri || `${trackInfo.artist}|${trackInfo.name}`;
    }

    function resetActiveTrackRuntime() {
        state.runtime._lastTrackUri = null;
        state.runtime._lastTrackProgressMs = null;
        state.runtime._activeTrackInfo = null;
        state.runtime._activeTrackKey = "";
        state.runtime._activeTrackListenedMs = 0;
        state.runtime._activeTrackQualified = false;
        state.runtime._activeTrackFinalized = false;
    }

    function primeActiveTrackCycle(trackInfo = getCurrentTrackInfo(), progressMs = getCurrentTrackProgressMs()) {
        state.runtime._activeTrackInfo = trackInfo;
        state.runtime._activeTrackKey = getTrackSessionKey(trackInfo);
        state.runtime._activeTrackListenedMs = 0;
        state.runtime._activeTrackQualified = false;
        state.runtime._activeTrackFinalized = false;
        state.runtime._lastTrackUri = trackInfo?.uri || null;
        state.runtime._lastTrackProgressMs = Number.isFinite(progressMs) ? progressMs : null;
    }

    function accumulateActiveTrackListen(progressMs) {
        if (!state.currentSession || !state.runtime._activeTrackKey || !Spicetify.Player.isPlaying()) {
            return;
        }

        const lastProgressMs = state.runtime._lastTrackProgressMs;
        if (!Number.isFinite(progressMs) || !Number.isFinite(lastProgressMs)) {
            return;
        }

        const deltaMs = progressMs - lastProgressMs;
        if (deltaMs <= 0 || deltaMs > CONFIG.tickMs * 3) {
            return;
        }

        state.runtime._activeTrackListenedMs += deltaMs;
        if (state.runtime._activeTrackListenedMs >= CONFIG.minTrackCountListenMs) {
            state.runtime._activeTrackQualified = true;
        }
    }

    function addTrackPlayToSession(session, trackInfo) {
        if (!session || !trackInfo) {
            return;
        }

        const existing = session.tracks.find((entry) => {
            if (trackInfo.uri && entry.uri) {
                return entry.uri === trackInfo.uri;
            }

            return entry.name === trackInfo.name && entry.artist === trackInfo.artist;
        });

        if (existing) {
            existing.plays += 1;
            if (!existing.name && trackInfo.name) {
                existing.name = trackInfo.name;
            }
            if (!existing.artist && trackInfo.artist) {
                existing.artist = trackInfo.artist;
            }
            return;
        }

        session.tracks.push({
            uri: trackInfo.uri,
            name: trackInfo.name,
            artist: trackInfo.artist,
            plays: 1
        });
    }

    function finalizeActiveTrackPlayInSession() {
        if (!state.currentSession || !state.runtime._activeTrackQualified || state.runtime._activeTrackFinalized) {
            return;
        }

        const trackInfo = state.runtime._activeTrackInfo;
        if (!trackInfo) {
            return;
        }

        const trackKey = state.runtime._activeTrackKey || getTrackSessionKey(trackInfo);
        if (!trackKey) {
            return;
        }

        addTrackPlayToSession(state.currentSession, trackInfo);
        state.currentSession.lastCountedTrackKey = trackKey;
        state.runtime._activeTrackFinalized = true;
    }

    function createPersistedSessionTrackSnapshot(now = Date.now()) {
        const sessions = state.sessionTrackData.sessions.map(cloneSessionTrackSummary);
        const liveInterval = getVisibleSessionInterval(now);

        if (liveInterval && state.currentSession) {
            sessions.push({
                start: liveInterval.start,
                end: liveInterval.end,
                tracks: state.currentSession.tracks.map(cloneSessionTrackPlay)
            });
        }

        return {
            date: state.day.date,
            sessions
        };
    }

    function saveSessionTrackData(now = Date.now()) {
        const snapshot = createPersistedSessionTrackSnapshot(now);
        Spicetify.LocalStorage.set(
            CONFIG.sessionTrackCountsKey,
            JSON.stringify(snapshot)
        );
    }

    function loadTodaySessionTrackData(date = getTodayString()) {
        const saved = safeParse(Spicetify.LocalStorage.get(CONFIG.sessionTrackCountsKey), null);
        const normalized = normalizeSessionTrackData(saved, date);

        if (normalized.date !== date) {
            const empty = createEmptySessionTrackData(date);
            Spicetify.LocalStorage.set(CONFIG.sessionTrackCountsKey, JSON.stringify(empty));
            return empty;
        }

        if (!saved || normalized.date !== saved?.date || normalized.sessions.length !== (Array.isArray(saved?.sessions) ? saved.sessions.length : 0)) {
            Spicetify.LocalStorage.set(CONFIG.sessionTrackCountsKey, JSON.stringify(normalized));
        }

        return normalized;
    }

    function normalizeHistoryEntry(entry) {
        if (typeof entry === "number") {
            return {
                totalSeconds: Math.max(0, Math.floor(entry)),
                intervals: []
            };
        }

        const intervals = Array.isArray(entry?.intervals)
            ? entry.intervals.map(normalizeInterval).filter(Boolean)
            : [];
        const intervalsTotal = getIntervalsTotalSeconds(intervals);

        return {
            totalSeconds: Math.max(
                Math.max(0, Math.floor(Number(entry?.totalSeconds) || 0)),
                intervalsTotal
            ),
            intervals
        };
    }

    function pruneHistoryEntries(history) {
        const cutoffString = getHistoryCutoffString();
        let changed = false;
        const prunedHistory = {};

        for (const [date, entry] of Object.entries(history || {})) {
            if (cutoffString && date < cutoffString) {
                changed = true;
                continue;
            }

            const normalized = normalizeHistoryEntry(entry);
            if (typeof entry !== "number" || normalized.intervals.length > 0) {
                changed = true;
            }
            prunedHistory[date] = normalized.totalSeconds;
        }

        return {
            history: prunedHistory,
            changed
        };
    }

    function loadHistoryData() {
        if (historyCache === null) {
            const parsedHistory = readRawHistory();
            const { history, changed } = pruneHistoryEntries(parsedHistory);
            historyCache = history;
            if (changed) {
                Spicetify.LocalStorage.set(CONFIG.historyKey, JSON.stringify(history));
            }
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

    function loadHistoryRetentionForever() {
        return Spicetify.LocalStorage.get(CONFIG.retentionForeverKey) === "1";
    }

    function loadPopupMode() {
        return Spicetify.LocalStorage.get(CONFIG.popupModeKey) === "full" ? "full" : "compact";
    }

    function loadPerformanceMode() {
        return Spicetify.LocalStorage.get(CONFIG.performanceModeKey) === "lightweight"
            ? "lightweight"
            : "default";
    }

    function normalizePauseSeconds(value) {
        const normalized = Math.floor(Number(value) || CONFIG.defaultPauseSeconds);
        return [15, 30, 60, 120].includes(normalized) ? normalized : CONFIG.defaultPauseSeconds;
    }

    function loadPauseSeconds() {
        return normalizePauseSeconds(Spicetify.LocalStorage.get(CONFIG.pauseThresholdKey));
    }

    function loadDailyGoalSeconds() {
        return normalizeDailyGoalSeconds(Spicetify.LocalStorage.get(CONFIG.dailyGoalKey));
    }

    function loadTopTracksVisible() {
        return Spicetify.LocalStorage.get(CONFIG.topTracksVisibleKey) === "1";
    }

    function normalizeTopTracksDisplayCount(value) {
        const normalized = Math.floor(Number(value) || 1);
        return [1, 2, 3].includes(normalized) ? normalized : 1;
    }

    function loadTopTracksDisplayCount() {
        return normalizeTopTracksDisplayCount(Spicetify.LocalStorage.get(CONFIG.topTracksDisplayCountKey));
    }

    function normalizeKeepPeriod(period) {
        if (!period || typeof period.start !== "string" || !period.start) {
            return null;
        }

        const start = period.start;
        const end = typeof period.end === "string" ? period.end : "";
        return {
            start,
            end: end && end >= start ? end : ""
        };
    }

    function normalizeStreakControlData(data) {
        const keepPeriods = Array.isArray(data?.keepPeriods)
            ? data.keepPeriods.map(normalizeKeepPeriod).filter(Boolean)
            : [];

        return {
            keepStreakEnabled: Boolean(data?.keepStreakEnabled),
            keepPeriods,
            keepFrozenCurrent: Math.max(0, Math.floor(Number(data?.keepFrozenCurrent) || 0))
        };
    }

    function normalizeStreakData(data) {
        const current = Math.max(0, Math.floor(Number(data?.current) || 0));
        const best = Math.max(current, Math.floor(Number(data?.best) || 0));
        const lastDate = typeof data?.lastDate === "string" ? data.lastDate : "";
        const shieldsUsedByMonth = {};

        if (data?.shieldsUsedByMonth && typeof data.shieldsUsedByMonth === "object") {
            for (const [monthKey, value] of Object.entries(data.shieldsUsedByMonth)) {
                if (!/^\d{4}-\d{2}$/.test(monthKey)) {
                    continue;
                }
                shieldsUsedByMonth[monthKey] = Math.max(0, Math.floor(Number(value) || 0));
            }
        }

        const currentMonthKey = getTodayString().slice(0, 7);
        const storedCurrentMonth = Math.max(0, Math.floor(Number(data?.shieldsUsedCurrentMonth) || 0));

        return {
            current,
            best,
            lastDate,
            shieldsUsedByMonth,
            shieldsUsedCurrentMonth: shieldsUsedByMonth[currentMonthKey] ?? storedCurrentMonth,
            keepProtectedToday: Boolean(data?.keepProtectedToday)
        };
    }

    function loadStreakControlData() {
        return normalizeStreakControlData(
            safeParse(Spicetify.LocalStorage.get(CONFIG.streakControlKey), null)
        );
    }

    function loadLongStreakProgressionEnabled() {
        return Spicetify.LocalStorage.get(CONFIG.longStreakProgressionKey) === "1";
    }

    function saveLongStreakProgressionEnabled() {
        Spicetify.LocalStorage.set(
            CONFIG.longStreakProgressionKey,
            state.longStreakProgressionEnabled ? "1" : "0"
        );
    }

    function saveHistoryRetentionMonths() {
        Spicetify.LocalStorage.set(CONFIG.retentionKey, String(state.historyRetentionMonths));
    }

    function saveHistoryRetentionForever() {
        Spicetify.LocalStorage.set(CONFIG.retentionForeverKey, state.historyRetentionForever ? "1" : "0");
    }

    function savePopupMode() {
        Spicetify.LocalStorage.set(CONFIG.popupModeKey, state.popupMode);
    }

    function savePerformanceMode() {
        Spicetify.LocalStorage.set(CONFIG.performanceModeKey, state.performanceMode);
    }

    function savePauseSeconds() {
        Spicetify.LocalStorage.set(CONFIG.pauseThresholdKey, String(state.pauseSeconds));
    }

    function saveDailyGoalSeconds() {
        Spicetify.LocalStorage.set(CONFIG.dailyGoalKey, String(state.dailyGoalSeconds));
    }

    function saveTopTracksVisible() {
        Spicetify.LocalStorage.set(CONFIG.topTracksVisibleKey, state.topTracksVisible ? "1" : "0");
    }

    function saveTopTracksDisplayCount() {
        Spicetify.LocalStorage.set(CONFIG.topTracksDisplayCountKey, String(state.topTracksDisplayCount));
    }

    function saveStreakControlData() {
        Spicetify.LocalStorage.set(CONFIG.streakControlKey, JSON.stringify(state.streakControl));
    }

    function loadBadgeVisibility() {
        return Spicetify.LocalStorage.get(CONFIG.badgeVisibilityKey) !== "0";
    }

    function saveBadgeVisibility() {
        Spicetify.LocalStorage.set(CONFIG.badgeVisibilityKey, state.badgeVisible ? "1" : "0");
    }

    function getSelectedChannel() {
        const savedChannel = Spicetify.LocalStorage.get(CONFIG.channelKey);
        return savedChannel === "test" || savedChannel === "dev" ? savedChannel : "release";
    }

    function saveSelectedChannel(channel) {
        const normalizedChannel = channel === "test" || channel === "dev" ? channel : "release";
        Spicetify.LocalStorage.set(CONFIG.channelKey, normalizedChannel);
    }

    function hasSeenTestChannelNotice() {
        return Spicetify.LocalStorage.get(CONFIG.testNoticeSeenKey) === CHANNEL;
    }

    function markTestChannelNoticeSeen() {
        Spicetify.LocalStorage.set(CONFIG.testNoticeSeenKey, CHANNEL);
    }

    function clearTestChannelNoticeSeen() {
        Spicetify.LocalStorage.set(CONFIG.testNoticeSeenKey, "");
    }

    function getChannelUiText() {
        if (state.language === "en") {
            return {
                title: "Channel",
                hint: "Release is stable. Test and Dev may contain bugs. Reload Spotify after switching.",
                release: "Release",
                test: "Test",
                dev: "Dev",
                confirmRelease: "Switch to the Release channel and reload Spotify now?",
                confirmTest: "Switch to the Test channel and reload Spotify now?",
                confirmDev: "Switch to the Dev channel and reload Spotify now?"
            };
        }

        return {
            title: "\u0412\u0435\u0440\u0441\u0438\u044f",
            hint: "\u0052\u0065\u006c\u0065\u0061\u0073\u0065 \u043f\u043e\u0441\u0442\u0430\u0431\u0438\u043b\u044c\u043d\u0435\u0435. Test \u0438 Dev \u043c\u043e\u0433\u0443\u0442 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0431\u0430\u0433\u0438. \u041f\u043e\u0441\u043b\u0435 \u043f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f \u043d\u0443\u0436\u043d\u0430 \u043f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0430 Spotify.",
            release: "Release",
            test: "Test",
            dev: "Dev",
            confirmRelease: "\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0438\u0442\u044c\u0441\u044f \u043d\u0430 Release \u0438 \u0441\u0440\u0430\u0437\u0443 \u043f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c Spotify?",
            confirmTest: "\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0438\u0442\u044c\u0441\u044f \u043d\u0430 Test \u0438 \u0441\u0440\u0430\u0437\u0443 \u043f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c Spotify?",
            confirmDev: "\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0438\u0442\u044c\u0441\u044f \u043d\u0430 Dev \u0438 \u0441\u0440\u0430\u0437\u0443 \u043f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c Spotify?"
        };
    }

    function getTestChannelWarningText() {
        const channelName = CHANNEL === "dev" ? "Dev" : "Test";
        const isDev = CHANNEL === "dev";
        if (state.language === "en") {
            return {
                badge: `${channelName.toUpperCase()} VERSION`,
                title: `You are using the ${channelName.toLowerCase()} version`,
                subtitle: "This build may contain bugs, unfinished changes, or unstable behavior. Use it only if you are ready to test new features.",
                button: "Continue",
                badgeColor: isDev ? "#ef4444" : "#f59e0b",
                badgeBorder: isDev ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)",
                badgeBackground: isDev ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)"
            };
        }

        return {
            badge: `${channelName.toUpperCase()} \u0412\u0415\u0420\u0421\u0418\u042f`,
            title: `\u0412\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0435 ${channelName} \u0432\u0435\u0440\u0441\u0438\u044e`,
            subtitle: "\u0412 \u044d\u0442\u043e\u0439 \u0441\u0431\u043e\u0440\u043a\u0435 \u043c\u043e\u0433\u0443\u0442 \u0431\u044b\u0442\u044c \u0431\u0430\u0433\u0438, \u043d\u0435\u0434\u043e\u0434\u0435\u043b\u0430\u043d\u043d\u044b\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0438\u043b\u0438 \u043d\u0435\u0441\u0442\u0430\u0431\u0438\u043b\u044c\u043d\u043e\u0435 \u043f\u043e\u0432\u0435\u0434\u0435\u043d\u0438\u0435. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0435\u0435, \u0435\u0441\u043b\u0438 \u0433\u043e\u0442\u043e\u0432\u044b \u0442\u0435\u0441\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043d\u043e\u0432\u044b\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438.",
            button: "\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c",
            badgeColor: isDev ? "#ef4444" : "#f59e0b",
            badgeBorder: isDev ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)",
            badgeBackground: isDev ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)"
        };
    }

    function applyChannelSelection(nextChannel) {
        const normalizedChannel = nextChannel === "test" || nextChannel === "dev" ? nextChannel : "release";
        if (normalizedChannel === CHANNEL) {
            return;
        }

        const text = getChannelUiText();
        const confirmed = window.confirm(
            normalizedChannel === "test"
                ? text.confirmTest
                : normalizedChannel === "dev"
                    ? text.confirmDev
                    : text.confirmRelease
        );
        if (!confirmed) {
            return;
        }

        saveSelectedChannel(normalizedChannel);
        if (normalizedChannel !== "release") {
            clearTestChannelNoticeSeen();
        }

        window.location.reload();
    }

    function maybeShowTestChannelWarning() {
        if (CHANNEL === "release" || hasSeenTestChannelNotice()) {
            return;
        }

        showTestChannelWarningModal();
    }

    function showTestChannelWarningModal() {
        if (document.getElementById("dtt-test-warning-overlay")) {
            return;
        }

        const text = getTestChannelWarningText();
        const overlay = document.createElement("div");
        overlay.id = "dtt-test-warning-overlay";
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10001;
            background: rgba(0, 0, 0, 0.72);
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
        `;

        const modal = document.createElement("div");
        modal.className = "dtt-update-modal";
        modal.style.cssText = `
            position: relative;
            background: #1a1a1a;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 32px 36px;
            max-width: 420px;
            width: calc(100vw - 48px);
            text-align: center;
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
            font-family: "Spotify Mix", "SpotifyMixUI", var(--font-family, sans-serif);
            color: #fff;
        `;

        const closeAndRemember = () => {
            markTestChannelNoticeSeen();
            hideTestChannelWarningModal();
        };

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "dtt-update-close";
        closeBtn.innerHTML = "&#x2715;";
        closeBtn.title = "Close";
        closeBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeAndRemember();
        });

        const badge = document.createElement("span");
        badge.className = "dtt-update-badge";
        badge.textContent = text.badge;
        badge.style.cssText = `
            display: inline-block;
            padding: 4px 14px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: ${text.badgeColor};
            border: 1px solid ${text.badgeBorder};
            background: ${text.badgeBackground};
            margin-bottom: 16px;
        `;

        const title = document.createElement("div");
        title.className = "dtt-update-title";
        title.textContent = text.title;
        title.style.cssText = `
            font-size: 17px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 8px;
            line-height: 1.3;
        `;

        const subtitle = document.createElement("div");
        subtitle.className = "dtt-update-subtitle";
        subtitle.textContent = text.subtitle;
        subtitle.style.cssText = `
            font-size: 13px;
            color: rgba(255, 255, 255, 0.58);
            line-height: 1.5;
            margin-bottom: 20px;
        `;

        const actionBtn = document.createElement("button");
        actionBtn.type = "button";
        actionBtn.textContent = text.button;
        actionBtn.style.cssText = `
            min-width: 140px;
            height: 38px;
            padding: 0 16px;
            border: 0;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            color: #121212;
            background: #1ed760;
        `;
        actionBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeAndRemember();
        });

        modal.append(closeBtn, badge, title, subtitle, actionBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function hideTestChannelWarningModal() {
        document.getElementById("dtt-test-warning-overlay")?.remove();
    }

    function loadLanguage() {
        const saved = Spicetify.LocalStorage.get(CONFIG.languageKey);
        return saved === "en" ? "en" : "ru";
    }

    function saveLanguage() {
        Spicetify.LocalStorage.set(CONFIG.languageKey, state.language);
    }

    function t(key) {
        return I18N[state.language][key] ?? I18N.en[key] ?? key;
    }

    function isFullPopupMode() {
        return state.popupMode === "full";
    }

    function saveHistory(history) {
        const { history: prunedHistory } = pruneHistoryEntries(history);
        historyCache = prunedHistory;
        Spicetify.LocalStorage.set(CONFIG.historyKey, JSON.stringify(prunedHistory));
    }

    function applyHistoryRetentionMonths(nextValue) {
        const normalized = normalizeHistoryRetentionMonths(nextValue);
        if (normalized === state.historyRetentionMonths) {
            return;
        }

        state.historyRetentionMonths = normalized;
        saveHistoryRetentionMonths();
        saveHistory(readRawHistory());
    }

    function applyHistoryRetentionForever(nextValue) {
        const normalized = Boolean(nextValue);
        if (normalized === state.historyRetentionForever) {
            return;
        }

        if (normalized && !confirmDestructiveAction(t("retentionForeverWarning"))) {
            return;
        }

        state.historyRetentionForever = normalized;
        saveHistoryRetentionForever();
        saveHistory(readRawHistory());
    }

    function applyPopupMode(nextMode) {
        const normalized = nextMode === "full" ? "full" : "compact";
        if (normalized === state.popupMode) {
            return;
        }

        state.popupMode = normalized;
        savePopupMode();

        if (!isFullPopupMode()) {
            state.popup.viewMode = "today";
            state.popup.todaySessionsExpanded = false;
            state.popup.historyExpanded = false;
        }
    }

    function applyPerformanceMode(nextMode) {
        const normalized = nextMode === "lightweight" ? "lightweight" : "default";
        if (normalized === state.performanceMode) {
            return;
        }

        state.performanceMode = normalized;
        savePerformanceMode();
        syncPerformanceModeClass();
        state.popup.lastSummarySignature = "";
        state.popup.lastTopTracksSignature = "";
        state.popup.lastIntervalsSignature = "";
        state.popup.lastWeeklySignature = "";
        state.popup.lastHistorySignature = "";
        state.ui.lastWidgetSignature = "";
        if (state.popup.node) {
            updatePopupStaticTextV2();
        }
        syncVisibleUI();
        schedulePopupPosition(true);
    }

    function applyPauseSeconds(nextValue) {
        const normalized = normalizePauseSeconds(nextValue);
        if (normalized === state.pauseSeconds) {
            return;
        }

        state.pauseSeconds = normalized;
        savePauseSeconds();

        const now = Date.now();
        updateTrackingState(now);
        syncVisibleUI(now);
    }

    function applyDailyGoalSeconds(nextValue) {
        const normalized = normalizeDailyGoalSeconds(nextValue);
        if (normalized === state.dailyGoalSeconds) {
            return;
        }

        state.dailyGoalSeconds = normalized;
        saveDailyGoalSeconds();
        syncVisibleUI();
    }

    function applyKeepStreakEnabled(nextValue) {
        const normalized = Boolean(nextValue);
        if (normalized === state.streakControl.keepStreakEnabled) {
            return;
        }

        const today = getTodayString();
        const nextControl = normalizeStreakControlData(state.streakControl);

        if (normalized) {
            nextControl.keepPeriods.push({ start: today, end: "" });
            nextControl.keepFrozenCurrent = state.streak.current;
        } else {
            for (let i = nextControl.keepPeriods.length - 1; i >= 0; i--) {
                if (!nextControl.keepPeriods[i].end) {
                    const endDate = shiftDateString(today, -1);
                    if (endDate < nextControl.keepPeriods[i].start) {
                        nextControl.keepPeriods.splice(i, 1);
                    } else {
                        nextControl.keepPeriods[i].end = endDate;
                    }
                    break;
                }
            }
            nextControl.keepFrozenCurrent = 0;
        }

        nextControl.keepStreakEnabled = normalized;
        state.streakControl = nextControl;
        saveStreakControlData();
        computeStreak();
        syncVisibleUI();
    }

    function applyLongStreakProgressionEnabled(nextValue) {
        const normalized = Boolean(nextValue);
        if (normalized === state.longStreakProgressionEnabled) {
            return;
        }

        state.longStreakProgressionEnabled = normalized;
        saveLongStreakProgressionEnabled();
    }

    function applyBadgeVisibility(nextValue) {
        const normalized = Boolean(nextValue);
        if (normalized === state.badgeVisible) {
            return;
        }

        state.badgeVisible = normalized;
        saveBadgeVisibility();
        updatePopupStaticTextV2();
    }

    function loadStreakData() {
        return normalizeStreakData(
            safeParse(Spicetify.LocalStorage.get(CONFIG.streakKey), null)
        );
    }

    function saveStreakData() {
        Spicetify.LocalStorage.set(CONFIG.streakKey, JSON.stringify(state.streak));
    }

    function isDateProtectedByKeep(dateString) {
        return state.streakControl.keepPeriods.some((period) => {
            const end = period.end || "9999-12-31";
            return dateString >= period.start && dateString <= end;
        });
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
        const shieldsUsedByMonth = {};
        const dateObj = new Date();

        for (let i = 0; i < 400; i++) {
            const dateStr = formatDateString(dateObj);
            const entry = allDays[dateStr];
            const dayTotal = normalizeHistoryEntry(entry).totalSeconds;
            const monthKey = dateStr.slice(0, 7);
            const isKeepProtected = isDateProtectedByKeep(dateStr);
            const isToday = dateStr === today;

            if (isKeepProtected) {
                dateObj.setDate(dateObj.getDate() - 1);
                continue;
            }

            if (dayTotal >= threshold) {
                current++;
                dateObj.setDate(dateObj.getDate() - 1);
                continue;
            }

            // The current day is still in progress, so it must not spend a shield
            // until the date actually rolls over and the missed day becomes final.
            if (isToday) {
                dateObj.setDate(dateObj.getDate() - 1);
                continue;
            }

            const usedThisMonth = shieldsUsedByMonth[monthKey] || 0;
            if (usedThisMonth < CONFIG.streakShieldsPerMonth) {
                shieldsUsedByMonth[monthKey] = usedThisMonth + 1;
                dateObj.setDate(dateObj.getDate() - 1);
                continue;
            }

            break;
        }

        const currentMonthKey = today.slice(0, 7);
        if (state.streakControl.keepStreakEnabled && isDateProtectedByKeep(today)) {
            current = Math.max(current, state.streakControl.keepFrozenCurrent || 0);
        }
        state.streak.current = current;
        state.streak.shieldsUsedByMonth = shieldsUsedByMonth;
        state.streak.shieldsUsedCurrentMonth = shieldsUsedByMonth[currentMonthKey] || 0;
        state.streak.keepProtectedToday = isDateProtectedByKeep(today);
        if (current > state.streak.best) {
            state.streak.best = current;
        }
        state.streak.lastDate = today;
        saveStreakData();
    }

    function getRemainingStreakShieldsText() {
        const remaining = Math.max(0, CONFIG.streakShieldsPerMonth - (state.streak.shieldsUsedCurrentMonth || 0));
        return `${remaining}/${CONFIG.streakShieldsPerMonth}`;
    }

    function formatSignedDuration(totalSeconds) {
        const normalized = Math.max(0, Math.floor(Math.abs(Number(totalSeconds) || 0)));
        const prefix = totalSeconds > 0 ? "+" : totalSeconds < 0 ? "-" : "";
        return `${prefix}${formatDuration(normalized)}`;
    }

    function setSettingsToggleButtonState(button, isActive) {
        if (!button) {
            return;
        }

        button.classList.toggle("is-active", Boolean(isActive));
        button.setAttribute("aria-pressed", String(Boolean(isActive)));
        const text = isActive ? (t("toggleOn") || "ON") : (t("toggleOff") || "OFF");
        button.textContent = "";
        button.setAttribute("aria-label", text);
        button.title = text;
    }

    function setRetentionForeverButtonState(button, isActive) {
        if (!button) {
            return;
        }

        button.classList.toggle("is-active", Boolean(isActive));
        button.setAttribute("aria-pressed", String(Boolean(isActive)));
        button.textContent = t("retentionForeverValue");
    }

    function isStreakAwaitingRefresh(now = Date.now()) {
        if (state.runtime._streakTestMode || state.streak.current < 2) {
            return false;
        }

        if (state.streak.keepProtectedToday) {
            return true;
        }

        return getComputedDayTotalSeconds(now) < loadStreakThreshold();
    }

    function updateStreakProtectionUi() {
        if (state.popup.settingsStreakShieldsTitleNode) {
            state.popup.settingsStreakShieldsTitleNode.textContent = t("streakShieldsLabel");
        }
        if (state.popup.settingsStreakShieldsHintNode) {
            state.popup.settingsStreakShieldsHintNode.textContent = `${t("streakShieldsHint")} ${t("streakShieldsRemaining")}: ${getRemainingStreakShieldsText()}.`;
        }
        if (state.popup.settingsKeepStreakTitleNode) {
            state.popup.settingsKeepStreakTitleNode.textContent = t("keepStreakLabel");
        }
        if (state.popup.settingsKeepStreakHintNode) {
            const suffix = state.streak.keepProtectedToday ? ` ${t("keepStreakProtectedToday")}.` : "";
            state.popup.settingsKeepStreakHintNode.textContent = `${t("keepStreakHint")}${suffix}`;
        }
        if (state.popup.settingsKeepStreakInputNode) {
            setSettingsToggleButtonState(
                state.popup.settingsKeepStreakInputNode,
                state.streakControl.keepStreakEnabled
            );
        }
        if (state.popup.settingsKeepStreakPreviewNode) {
            state.popup.settingsKeepStreakPreviewNode.textContent = "";
            state.popup.settingsKeepStreakPreviewNode.hidden = true;
        }
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
                if (state.popup.node) {
                    updatePopupStaticTextV2();
                }
            }
        } catch (_) {}
    }

    async function fetchDevChannelAccess() {
        try {
            const uid = Spicetify.Platform?.username;
            if (!uid) {
                if (state.runtime.devChannelRetryTimeoutId === null) {
                    state.runtime.devChannelRetryTimeoutId = setTimeout(() => {
                        state.runtime.devChannelRetryTimeoutId = null;
                        fetchDevChannelAccess();
                    }, CONFIG.devChannelRetryMs);
                }
                return;
            }

            const res = await fetch(`${CONFIG.devChannelApiBaseUrl}?uid=${encodeURIComponent(uid)}&t=${Date.now()}`);
            if (!res.ok) {
                state.devChannelAvailable = false;
                return;
            }

            const payload = await res.json();
            state.devChannelAvailable = Boolean(payload?.allowed);
            if (state.popup.node) {
                updatePopupStaticTextV2();
            }
        } catch (_) {
            state.devChannelAvailable = false;
        }
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

    // РІвЂќР‚РІвЂќР‚ Update check РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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
        const tokenizeVersion = (value) => {
            return String(value || "")
                .toLowerCase()
                .match(/[a-z]+|\d+/g) || [];
        };

        const pa = tokenizeVersion(a);
        const pb = tokenizeVersion(b);
        const len = Math.max(pa.length, pb.length);

        for (let i = 0; i < len; i++) {
            const left = pa[i];
            const right = pb[i];

            if (left === undefined && right === undefined) {
                return 0;
            }
            if (left === undefined) {
                return -1;
            }
            if (right === undefined) {
                return 1;
            }

            const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
            const rightNumber = /^\d+$/.test(right) ? Number(right) : null;

            if (leftNumber !== null && rightNumber !== null) {
                if (leftNumber > rightNumber) return 1;
                if (leftNumber < rightNumber) return -1;
                continue;
            }

            if (leftNumber !== null) return 1;
            if (rightNumber !== null) return -1;

            if (left > right) return 1;
            if (left < right) return -1;
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
        const anchorEl = options.anchorEl instanceof Element ? options.anchorEl : null;
        const data = await fetchLatestVersion();
        if (!data) {
            if (manual) {
                showUpdateStatusToast(t("updateCheckFailed"), { tone: "error", anchorEl });
            }
            return false;
        }
        if (compareVersions(data.version, VERSION) <= 0) {
            syncStoredVersionWithCurrentScript();
            console.log(`[DailyTimeTracker] No updates available. Current version: ${VERSION}.`);
            if (manual) {
                showUpdateStatusToast(t("updateCheckCurrent"), { anchorEl });
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
        versionValue.textContent = `${VERSION} -> ${latestVersion}`;

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

    function showUpdateStatusToast(message, options = {}) {
        hideUpdateStatusToast();

        const tone = options.tone === "error" ? "error" : "success";
        const anchorEl = options.anchorEl instanceof Element ? options.anchorEl : null;
        const toast = document.createElement("div");
        toast.id = "dtt-update-status-toast";
        toast.className = `dtt-update-status-toast is-${tone}`;

        const text = document.createElement("div");
        text.className = "dtt-update-status-toast-text";
        text.textContent = message;

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "dtt-update-status-toast-close";
        closeBtn.innerHTML = "&#x2715;";
        closeBtn.title = "Close";
        closeBtn.addEventListener("click", () => {
            hideUpdateStatusToast();
        });

        toast.append(text, closeBtn);
        if (anchorEl) {
            toast.classList.add("is-anchored");
        }
        toast.style.visibility = "hidden";
        document.body.appendChild(toast);

        const toastRect = toast.getBoundingClientRect();
        if (anchorEl) {
            const anchorRect = anchorEl.getBoundingClientRect();
            const gap = 10;
            const viewportMargin = 12;
            let left = anchorRect.left + (anchorRect.width / 2) - (toastRect.width / 2);
            let top = anchorRect.top - toastRect.height - gap;

            if (top < viewportMargin) {
                top = anchorRect.bottom + gap;
            }

            left = Math.max(
                viewportMargin,
                Math.min(left, window.innerWidth - toastRect.width - viewportMargin)
            );
            top = Math.max(
                viewportMargin,
                Math.min(top, window.innerHeight - toastRect.height - viewportMargin)
            );

            toast.style.left = `${left}px`;
            toast.style.top = `${top}px`;
            toast.style.transformOrigin = "top center";
        }

        requestAnimationFrame(() => {
            toast.style.visibility = "";
            toast.classList.add("is-visible");
        });

        const timeoutId = setTimeout(() => {
            hideUpdateStatusToast();
        }, 2600);

        toast.dataset.timeoutId = String(timeoutId);
    }

    function hideUpdateStatusToast() {
        const toast = document.getElementById("dtt-update-status-toast");
        if (!toast) {
            return;
        }

        const timeoutId = Number(toast.dataset.timeoutId || 0);
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        toast.classList.remove("is-visible");
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 180);
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
            .join(" вЂў ");
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
            : state.idleStartedAt;

        return buildIntervalFromCurrentSession(liveEnd, now);
    }

    function getComputedDayTotalSeconds(now = Date.now()) {
        const intervalsTotal = getIntervalsTotalSeconds(state.day.intervals);
        const visibleSession = getVisibleSessionInterval(now);
        return intervalsTotal + (visibleSession ? getIntervalDurationSeconds(visibleSession) : 0);
    }

    function getWidgetTotalSeconds(now = Date.now()) {
        return getComputedDayTotalSeconds(now);
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
        Spicetify.LocalStorage.set(
            CONFIG.storageKey,
            JSON.stringify({
                date: snapshot.date,
                totalSeconds: snapshot.totalSeconds
            })
        );
        Spicetify.LocalStorage.set(
            CONFIG.sessionsKey,
            JSON.stringify({
                date: snapshot.date,
                intervals: snapshot.intervals
                    .map(serializeStoredSessionInterval)
                    .filter(Boolean)
            })
        );
        saveSessionTrackData(now);
    }

    // РІвЂќР‚РІвЂќР‚ Export helpers РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
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
        state.sessionTrackData = createEmptySessionTrackData(nextToday.date);
        state.currentSession = null;
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
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
        state.sessionTrackData = createEmptySessionTrackData(state.day.date);
        state.currentSession = keepCurrentSession && Spicetify.Player.isPlaying()
            ? createLiveSession(now)
            : null;
        resetActiveTrackRuntime();
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
        if (state.currentSession) {
            primeActiveTrackCycle();
        }
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
        clearStoredValue(CONFIG.dailyGoalKey);
        clearStoredValue(CONFIG.historyKey);
        clearStoredValue(CONFIG.sessionsKey);
        clearStoredValue(CONFIG.languageKey);
        clearStoredValue(CONFIG.retentionKey);
        clearStoredValue(CONFIG.retentionForeverKey);
        clearStoredValue(CONFIG.popupModeKey);
        clearStoredValue(CONFIG.performanceModeKey);
        clearStoredValue(CONFIG.pauseThresholdKey);
        clearStoredValue(CONFIG.longStreakProgressionKey);
        clearStoredValue(CONFIG.badgeVisibilityKey);
        clearStoredValue(CONFIG.sessionTrackCountsKey);
        clearStoredValue(CONFIG.topTracksVisibleKey);
        clearStoredValue(CONFIG.topTracksDisplayCountKey);
        clearStoredValue(CONFIG.streakKey);
        clearStoredValue(CONFIG.streakControlKey);
        clearStoredValue(CONFIG.channelKey);
        clearStoredValue(CONFIG.testNoticeSeenKey);

        state.language = "ru";
        state.dailyGoalSeconds = 0;
        state.historyRetentionMonths = CONFIG.historyRetentionMonths;
        state.historyRetentionForever = false;
        state.popupMode = "compact";
        state.performanceMode = "default";
        state.pauseSeconds = CONFIG.defaultPauseSeconds;
        state.longStreakProgressionEnabled = false;
        state.badgeVisible = true;
        state.topTracksVisible = false;
        state.topTracksDisplayCount = 1;
        state.streak = normalizeStreakData(null);
        state.streakControl = normalizeStreakControlData(null);

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

        history[day.date] = existing.totalSeconds + totalSeconds;

        saveHistory(history);
    }

    function loadTodayData() {
        const today = getTodayString();
        const saved = safeParse(Spicetify.LocalStorage.get(CONFIG.storageKey), null);
        const savedSessions = safeParse(Spicetify.LocalStorage.get(CONFIG.sessionsKey), null);
        const normalizedDay = normalizeDayData(saved, today);
        const normalizedSessions = normalizeSessionsData(savedSessions, today);
        const intervals = normalizedSessions.date === normalizedDay.date && normalizedSessions.intervals.length
            ? normalizedSessions.intervals
            : normalizedDay.intervals;
        const normalized = {
            date: normalizedDay.date,
            totalSeconds: Math.max(normalizedDay.totalSeconds, getIntervalsTotalSeconds(intervals)),
            intervals
        };

        if (normalized.date !== today) {
            archiveDay(normalized);
            const freshDay = createEmptyDay(today);
            Spicetify.LocalStorage.set(
                CONFIG.storageKey,
                JSON.stringify({
                    date: freshDay.date,
                    totalSeconds: freshDay.totalSeconds
                })
            );
            Spicetify.LocalStorage.set(
                CONFIG.sessionsKey,
                JSON.stringify({
                    date: freshDay.date,
                    intervals: []
                })
            );
            Spicetify.LocalStorage.set(
                CONFIG.sessionTrackCountsKey,
                JSON.stringify(createEmptySessionTrackData(today))
            );
            return freshDay;
        }

        if (normalizedSessions.date !== today || normalizedDay.intervals.length > 0) {
            Spicetify.LocalStorage.set(
                CONFIG.storageKey,
                JSON.stringify({
                    date: normalized.date,
                    totalSeconds: normalized.totalSeconds
                })
            );
            Spicetify.LocalStorage.set(
                CONFIG.sessionsKey,
                JSON.stringify({
                    date: normalized.date,
                    intervals: normalized.intervals
                        .map(serializeStoredSessionInterval)
                        .filter(Boolean)
                })
            );
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
            state.currentSession = createLiveSession(startAt);
            primeActiveTrackCycle();
            return;
        }

        resumeCurrentSession(startAt);
    }

    function closeSession(endAt) {
        if (!state.currentSession) return;
        pauseCurrentSession(endAt);
        finalizeActiveTrackPlayInSession();

        const interval = buildIntervalFromCurrentSession(endAt);

        if (interval) {
            state.day.intervals.push(interval);
            state.sessionTrackData.sessions.push({
                start: interval.start,
                end: interval.end,
                tracks: state.currentSession.tracks.map(cloneSessionTrackPlay)
            });
        }

        state.currentSession = null;
        resetActiveTrackRuntime();
    }

    function rolloverDayIfNeeded() {
        const today = getTodayString();
        if (today === state.day.date) {
            return;
        }

        computeStreak();

        const wasSessionActive = Boolean(state.currentSession && typeof state.currentSession.lastResumedAt === "number");
        if (state.currentSession) {
            finalizeActiveTrackPlayInSession();
            const midnight = getMidnightTimestamp(state.day.date);
            pauseCurrentSession(Math.min(Date.now(), midnight));
            const cappedSession = buildIntervalFromCurrentSession(
                state.idleStartedAt === null ? midnight : Math.min(state.idleStartedAt, midnight)
            );

            if (cappedSession) {
                state.day.intervals.push(cappedSession);
                state.sessionTrackData.sessions.push({
                    start: cappedSession.start,
                    end: cappedSession.end,
                    tracks: state.currentSession.tracks.map(cloneSessionTrackPlay)
                });
            }
        }

        archiveDay(state.day);
        state.day = createEmptyDay(today);
        state.sessionTrackData = createEmptySessionTrackData(today);
        state.currentSession = wasSessionActive ? createLiveSession(getMidnightTimestamp(state.day.date)) : null;
        resetActiveTrackRuntime();
        state.idleStartedAt = null;
        state.silenceSeconds = 0;
        if (state.currentSession) {
            primeActiveTrackCycle();
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
            /* РІвЂќР‚РІвЂќР‚ Widget pill РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            /* РІвЂќР‚РІвЂќР‚ Fire icon (popup) РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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
                transition: filter 0.3s ease, opacity 0.3s ease;
            }

            .dtt-fire-icon svg {
                width: 100%;
                height: 100%;
                display: block;
            }

            .dtt-fire-icon.is-stale {
                filter: grayscale(1) saturate(0) brightness(0.7);
                opacity: 0.82;
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

            /* РІвЂќР‚РІвЂќР‚ Timer text РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            #dtt-goal {
                display: inline-flex;
                align-items: center;
                padding: 2px 7px;
                border-radius: 999px;
                background: rgba(30, 215, 96, 0.12);
                color: rgba(30, 215, 96, 0.92);
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.04em;
                line-height: 1;
                white-space: nowrap;
            }

            #dtt-goal[hidden] {
                display: none;
            }

            #dtt-goal.is-complete {
                background: rgba(30, 215, 96, 0.2);
                color: #1ed760;
            }

            /* РІвЂќР‚РІвЂќР‚ Popup container РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            #dtt-hover-popup.dtt-popup-mode-compact {
                width: min(430px, calc(100vw - 32px));
                max-height: min(62vh, 640px);
            }

            #dtt-hover-popup.dtt-popup-mode-full {
                width: min(540px, calc(100vw - 32px));
                max-height: min(76vh, 780px);
            }

            /* РІвЂќР‚РІвЂќР‚ Header block РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-popup-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                padding: 16px 18px 14px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-header {
                gap: 10px;
                padding: 13px 15px 11px;
            }

            .dtt-popup-title {
                font-size: 15px;
                font-weight: 700;
                letter-spacing: -0.01em;
                color: #fff;
                padding-top: 2px;
                min-width: 0;
                line-height: 1.2;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-title {
                font-size: 14px;
            }

            .dtt-popup-title-wrap {
                display: flex;
                align-items: center;
                align-content: flex-start;
                gap: 8px;
                min-width: 0;
                flex: 1 1 auto;
                flex-wrap: wrap;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-title-wrap {
                gap: 6px;
                align-items: flex-start;
            }

            .dtt-popup-header-right {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 7px;
                flex-shrink: 0;
            }

            /* РІвЂќР‚РІвЂќР‚ Language switcher РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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
                border: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(255, 255, 255, 0.03);
                color: #737373;
                padding: 3px 9px;
                font: inherit;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.04em;
                cursor: pointer;
                border-radius: 999px;
                transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
            }

            .dtt-language-switcher .dtt-language-button {
                border: 0;
                background: transparent;
                box-shadow: none;
            }

            .dtt-language-switcher .dtt-language-button:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .dtt-language-switcher .dtt-language-button.is-active {
                background: #1ed760;
            }

            .dtt-language-button:hover {
                color: #e0e0e0;
                background: rgba(255, 255, 255, 0.07);
                border-color: rgba(255, 255, 255, 0.24);
            }

            .dtt-language-button.is-active {
                background: #1ed760;
                border-color: rgba(30, 215, 96, 0.7);
                color: #000;
            }

            .dtt-settings-pill-button {
                border-color: rgba(255, 255, 255, 0.2);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
            }

            .dtt-settings-pill-button:hover {
                border-color: rgba(255, 255, 255, 0.32);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
            }

            .dtt-settings-pill-button.is-active {
                box-shadow: 0 0 0 1px rgba(30, 215, 96, 0.16);
            }

            .dtt-popup-mode-hint {
                color: #6b6b6b;
                font-size: 12px;
                line-height: 1.35;
                margin-top: 10px;
            }

            /* РІвЂќР‚РІвЂќР‚ Hint line РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-popup-hint {
                color: #555;
                font-size: 11px;
                text-align: right;
                letter-spacing: 0.01em;
                max-width: 110px;
            }

            .dtt-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-header-actions {
                gap: 6px;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-hint {
                display: none;
            }

            .dtt-view-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 58px;
                height: 26px;
                padding: 0 10px;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.05);
                color: #777;
                font: inherit;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.04em;
                cursor: pointer;
                transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
            }

            .dtt-view-toggle:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #e0e0e0;
            }

            .dtt-view-toggle.is-active {
                background: rgba(30, 215, 96, 0.16);
                border-color: rgba(30, 215, 96, 0.32);
                color: #1ed760;
            }

            /* РІвЂќР‚РІвЂќР‚ Retention control РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            /* РІвЂќР‚РІвЂќР‚ Summary card РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-popup-summary {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                padding: 20px 18px 18px;
                background: linear-gradient(160deg, rgba(30, 215, 96, 0.09) 0%, rgba(30, 215, 96, 0.04) 100%);
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-summary {
                gap: 3px;
                padding: 16px 15px 14px;
            }

            .dtt-popup-summary span {
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                color: rgba(30, 215, 96, 0.6);
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-summary span {
                font-size: 10px;
            }

            .dtt-popup-summary strong {
                font-size: 36px;
                font-weight: 800;
                letter-spacing: -0.03em;
                color: #1ed760;
                font-variant-numeric: tabular-nums;
                line-height: 1;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-summary strong {
                font-size: 31px;
            }

            .dtt-goal-summary {
                width: min(100%, 320px);
                display: flex;
                flex-direction: column;
                gap: 7px;
                margin-top: 10px;
            }

            .dtt-goal-summary[hidden] {
                display: none;
            }

            .dtt-goal-summary-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                width: 100%;
            }

            .dtt-goal-summary-label {
                font-size: 11px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.72);
                letter-spacing: 0.03em;
            }

            .dtt-goal-summary-value {
                font-size: 12px;
                font-weight: 700;
                color: #fff;
                font-variant-numeric: tabular-nums;
            }

            .dtt-goal-progress {
                width: 100%;
                height: 7px;
                overflow: hidden;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.08);
            }

            .dtt-goal-progress-bar {
                width: 0%;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #1ed760 0%, #47f58e 100%);
                transition: width 0.18s ease;
            }

            .dtt-top-tracks-summary {
                width: min(100%, 320px);
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-top: 10px;
            }

            .dtt-top-tracks-summary[hidden] {
                display: none;
            }

            .dtt-top-tracks-list {
                width: 100%;
            }

            .dtt-top-tracks-list .dtt-interval-item {
                padding: 6px 0;
            }

            .dtt-top-tracks-list .dtt-interval-range {
                font-size: 11px;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-top-tracks-list .dtt-interval-range {
                font-size: 10px;
            }

            /* РІвЂќР‚РІвЂќР‚ Sections wrapper (scrollable body) РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-popup-section {
                display: flex;
                flex-direction: column;
                flex: 0 0 auto;
                gap: 0;
                min-height: 0;
                padding: 14px 18px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-section {
                padding: 11px 15px;
            }

            .dtt-popup-section:last-child {
                border-bottom: 0;
            }

            .dtt-weekly-section[hidden],
            .dtt-popup-section[hidden] {
                display: none;
            }

            /* РІвЂќР‚РІвЂќР‚ Section headers РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-popup-section-title {
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: #484848;
                margin-bottom: 8px;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-section-title {
                font-size: 10px;
                margin-bottom: 6px;
            }

            .dtt-popup-section-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 8px;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-section-heading {
                gap: 10px;
                margin-bottom: 6px;
            }

            .dtt-popup-section-heading .dtt-popup-section-title {
                margin-bottom: 0;
            }

            .dtt-history-section {
                flex: 1 1 auto;
                min-height: 0;
            }

            /* РІвЂќР‚РІвЂќР‚ Sessions list РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-intervals-list {
                overflow-y: auto;
                min-height: 0;
            }

            .dtt-history-list {
                flex: 1 1 auto;
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

            /* РІвЂќР‚РІвЂќР‚ Toggle button РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            /* РІвЂќР‚РІвЂќР‚ Row items РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-interval-item {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.045);
                transition: opacity 0.15s ease;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-interval-item {
                gap: 12px;
                padding: 7px 0;
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

            .dtt-interval-main {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 3px;
                flex: 1;
            }

            .dtt-interval-details {
                color: #7e7e7e;
                font-size: 11px;
                line-height: 1.35;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-interval-range {
                font-size: 12px;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-interval-details {
                font-size: 10px;
            }

            .dtt-interval-duration {
                color: #606060;
                font-size: 13px;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
                font-weight: 600;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-interval-duration {
                font-size: 12px;
            }

            .dtt-interval-item.is-today .dtt-interval-range {
                color: #e8e8e8;
            }

            .dtt-interval-item.is-today .dtt-interval-duration {
                color: #1ed760;
            }

            /* РІвЂќР‚РІвЂќР‚ Empty state РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-empty-state {
                color: #3a3a3a;
                padding: 10px 0 6px;
                font-size: 13px;
                font-style: italic;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-empty-state {
                padding: 8px 0 5px;
                font-size: 12px;
            }

            .dtt-weekly-stats {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 12px;
            }

            .dtt-weekly-stats[hidden],
            .dtt-weekly-bars[hidden] {
                display: none !important;
            }

            .dtt-weekly-detail-toggle {
                margin-left: auto;
            }

            .dtt-weekly-detail-toggle svg {
                width: 14px;
                height: 14px;
            }

            .dtt-weekly-stats.dtt-weekly-compare {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-weekly-stats {
                gap: 8px;
                margin-bottom: 10px;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-weekly-stats.dtt-weekly-compare {
                grid-template-columns: 1fr;
            }

            .dtt-weekly-stat {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 12px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.05);
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-weekly-stat {
                gap: 5px;
                padding: 10px;
            }

            .dtt-weekly-stat-label {
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #5c5c5c;
            }

            .dtt-weekly-stat-value {
                font-size: 14px;
                font-weight: 700;
                line-height: 1.25;
                color: #f2f2f2;
                font-variant-numeric: tabular-nums;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-weekly-stat-value {
                font-size: 13px;
            }

            .dtt-weekly-bars {
                display: grid;
                grid-template-columns: repeat(7, minmax(0, 1fr));
                gap: 8px;
                align-items: end;
                min-height: 112px;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-weekly-bars {
                gap: 6px;
                min-height: 96px;
            }

            .dtt-weekly-bar-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            .dtt-weekly-bar-track {
                width: 100%;
                height: 72px;
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.05);
                overflow: hidden;
                display: flex;
                align-items: flex-end;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-weekly-bar-track {
                height: 60px;
            }

            .dtt-weekly-bar-fill {
                width: 100%;
                min-height: 4px;
                border-radius: 12px;
                background: linear-gradient(180deg, #52f08f 0%, #1ed760 100%);
            }

            .dtt-weekly-bar-label {
                font-size: 11px;
                font-weight: 700;
                color: #727272;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-weekly-bar-label {
                font-size: 10px;
            }

            /* РІвЂќР‚РІвЂќР‚ Settings gear button РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            .dtt-week-toggle:hover {
                transform: none;
            }

            .dtt-week-toggle.is-active {
                background: rgba(30, 215, 96, 0.16);
                border-color: rgba(30, 215, 96, 0.32);
                color: #1ed760;
            }

            .dtt-week-toggle svg {
                width: 14px;
                height: 14px;
            }

            /* РІвЂќР‚РІвЂќР‚ Settings back button РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            /* РІвЂќР‚РІвЂќР‚ Settings panel РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-popup-main {
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
                min-height: 0;
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

            /* РІвЂќР‚РІвЂќР‚ Settings rows РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-settings-row {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 14px 18px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .dtt-settings-row[hidden] {
                display: none;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-settings-row {
                gap: 8px;
                padding: 11px 15px;
            }

            .dtt-settings-row:last-child {
                border-bottom: 0;
            }

            .dtt-settings-version {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                padding: 14px 18px 18px;
                border: 0;
                background: transparent;
                color: #575757;
                font-size: 12px;
                text-align: center;
                border-top: 1px solid rgba(255, 255, 255, 0.04);
                cursor: pointer;
                transition: color 0.15s ease;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-settings-version {
                padding: 11px 15px 14px;
                font-size: 11px;
            }

            .dtt-settings-version:hover {
                color: #bdbdbd;
            }

            .dtt-settings-version:active {
                color: #ffffff;
            }

            .dtt-settings-version:focus-visible {
                outline: none;
                color: #ffffff;
            }

            .dtt-settings-row-label {
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: #484848;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-settings-row-label {
                font-size: 10px;
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

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-settings-row-hint,
            #dtt-hover-popup.dtt-popup-mode-compact .dtt-popup-mode-hint {
                font-size: 11px;
            }

            .dtt-settings-checkbox {
                width: 16px;
                height: 16px;
                margin-top: 1px;
                accent-color: #1ed760;
                cursor: pointer;
                flex-shrink: 0;
            }

            .dtt-settings-toggle-button {
                position: relative;
                width: 34px;
                min-width: 34px;
                height: 20px;
                padding: 0;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.34);
                background: rgba(255, 255, 255, 0.1);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 6px 14px rgba(0, 0, 0, 0.18);
                justify-content: center;
                letter-spacing: 0;
                color: transparent;
                align-self: center;
                flex-shrink: 0;
                transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
            }

            .dtt-settings-toggle-button::before {
                content: "";
                position: absolute;
                top: 2px;
                left: 2px;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: linear-gradient(180deg, #ffffff 0%, #f3f3f3 100%);
                border: 1px solid rgba(0, 0, 0, 0.08);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22), 0 4px 10px rgba(0, 0, 0, 0.16);
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .dtt-settings-toggle-button:hover {
                background: rgba(255, 255, 255, 0.14);
                border-color: rgba(255, 255, 255, 0.48);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 6px 14px rgba(0, 0, 0, 0.18);
                color: transparent;
            }

            .dtt-settings-toggle-button.is-active {
                background: #32d73a;
                border-color: rgba(30, 215, 96, 0.8);
                box-shadow: 0 0 0 1px rgba(30, 215, 96, 0.16), 0 6px 14px rgba(0, 0, 0, 0.18);
                color: transparent;
            }

            .dtt-settings-toggle-button.is-active::before {
                transform: translateX(14px);
            }

            .dtt-settings-toggle-button:focus-visible {
                outline: 2px solid rgba(255, 255, 255, 0.32);
                outline-offset: 2px;
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

            /* РІвЂќР‚РІвЂќР‚ Retention value display РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
            .dtt-retention-suffix {
                font-size: 13px;
                font-weight: 500;
                color: #555;
                white-space: nowrap;
            }

            /* РІвЂќР‚РІвЂќР‚ Badge pill РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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
                max-width: 100%;
            }

            #dtt-hover-popup.dtt-popup-mode-compact .dtt-badge-pill {
                order: 2;
                max-width: 100%;
                font-size: 9px;
                padding: 2px 8px;
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

            /* РІвЂќР‚РІвЂќР‚ Update modal РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */
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

            .dtt-update-status-toast {
                position: fixed;
                top: 18px;
                left: 50%;
                z-index: 10020;
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: min(360px, calc(100vw - 24px));
                max-width: min(420px, calc(100vw - 24px));
                padding: 14px 16px;
                border-radius: 14px;
                background: rgba(17, 17, 17, 0.96);
                backdrop-filter: blur(12px);
                box-shadow:
                    0 0 0 1px rgba(255, 255, 255, 0.06),
                    0 16px 36px rgba(0, 0, 0, 0.42);
                transform: translate(-50%, 10px);
                transform-origin: top center;
                opacity: 0;
                transition: opacity 0.18s ease, transform 0.18s ease;
            }

            .dtt-update-status-toast.is-visible {
                opacity: 1;
                transform: translate(-50%, 0);
            }

            .dtt-update-status-toast.is-anchored {
                transform: translateY(10px);
            }

            .dtt-update-status-toast.is-anchored.is-visible {
                transform: translateY(0);
            }

            .dtt-update-status-toast.is-success {
                border: 1px solid rgba(30, 215, 96, 0.18);
            }

            .dtt-update-status-toast.is-error {
                border: 1px solid rgba(239, 68, 68, 0.2);
            }

            .dtt-update-status-toast-text {
                flex: 1;
                color: #f3f3f3;
                font-size: 13px;
                font-weight: 600;
                line-height: 1.35;
                text-align: left;
            }

            .dtt-update-status-toast-close {
                border: 0;
                background: transparent;
                color: #7f7f7f;
                font-size: 13px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                transition: color 0.15s ease;
            }

            .dtt-update-status-toast-close:hover {
                color: #ffffff;
            }

            #dtt-widget.dtt-performance-lightweight,
            #dtt-hover-popup.dtt-performance-lightweight {
                backdrop-filter: none !important;
            }

            #dtt-hover-popup.dtt-performance-lightweight,
            #dtt-hover-popup.dtt-performance-lightweight * {
                animation-duration: 0.01ms !important;
                transition-duration: 0.01ms !important;
            }

            #dtt-hover-popup.dtt-performance-lightweight .dtt-fire-glow,
            #dtt-hover-popup.dtt-performance-lightweight .is-rainbow {
                filter: none !important;
                box-shadow: none !important;
                text-shadow: none !important;
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
        widget.innerHTML = `<span id="dtt-time">${formatDuration(getWidgetTotalSeconds())}</span><span id="dtt-goal" hidden></span>`;

        state.ui.widget = widget;
        state.ui.timeNode = widget.querySelector("#dtt-time");
        state.ui.goalNode = widget.querySelector("#dtt-goal");
        syncPerformanceModeClass();
    }

    function updateWidgetUI(totalSeconds = getWidgetTotalSeconds()) {
        const goal = getDailyGoalProgress(totalSeconds);
        const widgetSignature = [
            state.language,
            totalSeconds,
            goal.enabled ? 1 : 0,
            goal.percentage,
            goal.complete ? 1 : 0,
            state.performanceMode
        ].join("|");

        if (widgetSignature === state.ui.lastWidgetSignature) {
            return;
        }

        if (state.ui.widget) {
            state.ui.widget.title = t("widgetTitle");
        }
        if (state.ui.timeNode) {
            state.ui.timeNode.textContent = formatDuration(totalSeconds);
        }
        if (state.ui.goalNode) {
            state.ui.goalNode.hidden = !goal.enabled;
            state.ui.goalNode.textContent = `${Math.max(0, Math.min(999, goal.percentage))}%`;
            state.ui.goalNode.classList.toggle("is-complete", goal.complete);
        }
        syncPerformanceModeClass();
        state.ui.lastWidgetSignature = widgetSignature;
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
        const isStale = isStreakAwaitingRefresh();
        fireNode.innerHTML = createFireSvg(colors);
        fireNode.classList.toggle("is-stale", isStale);
        fireNode.classList.toggle("dtt-fire-glow", !isStale && s >= 3 && !isLightweightMode());
        fireNode.style.setProperty("--dtt-fire-glow", colors.glow);
        countNode.textContent = String(s);
        countNode.style.color = isStale ? "rgba(191, 191, 191, 0.96)" : colors.text;
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

        return state.silenceSeconds >= state.pauseSeconds;
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

    function getWeeklySummaryData(todayTotalSeconds = getComputedDayTotalSeconds()) {
        const merged = {
            ...readHistory(),
            [state.day.date]: {
                totalSeconds: todayTotalSeconds,
                intervals: []
            }
        };

        const days = [];
        for (let offset = 6; offset >= 0; offset--) {
            const date = shiftDateString(state.day.date, -offset);
            const entry = normalizeHistoryEntry(merged[date]);
            days.push({
                date,
                label: formatWeekdayLabel(date),
                totalSeconds: entry.totalSeconds
            });
        }

        const totalSeconds = days.reduce((sum, day) => sum + day.totalSeconds, 0);
        const averageSeconds = Math.floor(totalSeconds / days.length);
        let bestDay = null;

        for (const day of days) {
            if (!bestDay || day.totalSeconds > bestDay.totalSeconds) {
                bestDay = day;
            }
        }

        if (!bestDay || bestDay.totalSeconds <= 0) {
            bestDay = null;
        }

        return {
            days,
            totalSeconds,
            averageSeconds,
            bestDay,
            maxSeconds: Math.max(1, ...days.map((day) => day.totalSeconds))
        };
    }

    function getYesterdayVsTodayData(todayTotalSeconds = getComputedDayTotalSeconds()) {
        const yesterdayDate = shiftDateString(state.day.date, -1);
        const yesterdayEntry = normalizeHistoryEntry(readHistory()[yesterdayDate]);
        const yesterdaySeconds = yesterdayEntry.totalSeconds;
        const deltaSeconds = todayTotalSeconds - yesterdaySeconds;

        return {
            todaySeconds: todayTotalSeconds,
            yesterdaySeconds,
            deltaSeconds
        };
    }

    function getTodayTopTrackRows() {
        const mergedTracks = new Map();
        const allSessions = state.sessionTrackData.sessions.slice();

        if (state.currentSession?.tracks?.length) {
            allSessions.push({
                tracks: state.currentSession.tracks.map(cloneSessionTrackPlay)
            });
        }

        for (const session of allSessions) {
            for (const track of session.tracks || []) {
                const key = track.uri || `${track.artist}|${track.name}`;
                if (!key) {
                    continue;
                }

                const existing = mergedTracks.get(key);
                if (existing) {
                    existing.plays += Math.max(1, track.plays);
                    if (!existing.name && track.name) {
                        existing.name = track.name;
                    }
                    if (!existing.artist && track.artist) {
                        existing.artist = track.artist;
                    }
                    continue;
                }

                mergedTracks.set(key, {
                    uri: track.uri,
                    name: track.name,
                    artist: track.artist,
                    plays: Math.max(1, track.plays)
                });
            }
        }

        return Array.from(mergedTracks.values())
            .sort((a, b) => b.plays - a.plays || (a.name || "").localeCompare(b.name || ""))
            .slice(0, state.topTracksDisplayCount)
            .map((track, index) => ({
                key: track.uri || `${track.artist}-${track.name}-${index}`,
                label: track.artist ? `${track.name || "Track"} - ${track.artist}` : (track.name || "Track"),
                duration: `${track.plays} ${t("topTracksPlayCount")}`
            }));
    }

    function getTodayIntervalRows(now = Date.now()) {
        const rows = state.day.intervals.map((interval) => ({
            key: `${interval.start}-${interval.end}`,
            label: `${formatClockTime(interval.start)} - ${formatClockTime(interval.end)}`,
            duration: formatDuration(getIntervalDurationSeconds(interval))
        }));
        const liveInterval = getVisibleSessionInterval(now);

        if (liveInterval && state.currentSession) {
            rows.push({
                key: `${liveInterval.start}-${liveInterval.end}`,
                label: `${formatClockTime(liveInterval.start)} - ${formatClockTime(liveInterval.end)}`,
                duration: formatDuration(getIntervalDurationSeconds(liveInterval))
            });
        }

        return rows.sort((a, b) => {
            const leftStart = Number(a.key?.split("-")[0] || 0);
            const rightStart = Number(b.key?.split("-")[0] || 0);
            return rightStart - leftStart;
        });
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

        // РІвЂќР‚РІвЂќР‚ Header (always visible) РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
        const header = document.createElement("div");
        header.className = "dtt-popup-header";

        const title = document.createElement("div");
        title.className = "dtt-popup-title";
        title.textContent = t("popupTitle");

        const headerRight = document.createElement("div");
        headerRight.className = "dtt-header-actions";

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
        hint.style.display = "none";

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

        const weeklyToggleBtn = document.createElement("button");
        weeklyToggleBtn.type = "button";
        weeklyToggleBtn.className = "dtt-settings-gear dtt-week-toggle";
        weeklyToggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H13C16.7712 2 18.6569 2 19.8284 3.17157C21 4.34315 21 6.22876 21 10V14C21 17.7712 21 19.6569 19.8284 20.8284C18.6569 22 16.7712 22 13 22H11C7.22876 22 5.34315 22 4.17157 20.8284C3 19.6569 3 17.7712 3 14V10Z"/>
            <path d="M8 10H16"/>
            <path d="M8 14H13"/>
        </svg>`;
        weeklyToggleBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.popup.viewMode = state.popup.viewMode === "week" ? "today" : "week";
            updatePopupStaticTextV2();
            updatePopupDynamicContentV2();
            updatePopupHistoryV2();
            schedulePopupPosition(true);
        });

        headerRight.append(fireWrap, hint, weeklyToggleBtn, gearBtn);

        const titleWrap = document.createElement("div");
        titleWrap.className = "dtt-popup-title-wrap";
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

        // РІвЂќР‚РІвЂќР‚ Main content panel РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
        const mainPanel = document.createElement("div");
        mainPanel.className = "dtt-popup-main";

        const summary = document.createElement("div");
        summary.className = "dtt-popup-summary";
        const dateNode = document.createElement("span");
        const totalNode = document.createElement("strong");
        const goalWrap = document.createElement("div");
        goalWrap.className = "dtt-goal-summary";
        goalWrap.hidden = true;
        const goalHead = document.createElement("div");
        goalHead.className = "dtt-goal-summary-head";
        const goalLabel = document.createElement("span");
        goalLabel.className = "dtt-goal-summary-label";
        const goalValue = document.createElement("span");
        goalValue.className = "dtt-goal-summary-value";
        const goalProgress = document.createElement("div");
        goalProgress.className = "dtt-goal-progress";
        const goalProgressBar = document.createElement("div");
        goalProgressBar.className = "dtt-goal-progress-bar";
        goalProgress.appendChild(goalProgressBar);
        goalHead.append(goalLabel, goalValue);
        goalWrap.append(goalHead, goalProgress);
        const topTracksWrap = document.createElement("div");
        topTracksWrap.className = "dtt-top-tracks-summary";
        topTracksWrap.hidden = true;
        const topTracksList = document.createElement("div");
        topTracksList.className = "dtt-top-tracks-list";
        topTracksWrap.appendChild(topTracksList);
        summary.append(dateNode, totalNode, goalWrap, topTracksWrap);

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
        historySection.className = "dtt-popup-section dtt-history-section";
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
        historyList.className = "dtt-intervals-list dtt-history-list";
        historyHeading.append(historyTitle, historyToggle);
        historySection.append(historyHeading, historyList);
        mainPanel.appendChild(historySection);

        const weeklySection = document.createElement("div");
        weeklySection.className = "dtt-popup-section dtt-weekly-section";
        weeklySection.hidden = true;
        const weeklyHeading = document.createElement("div");
        weeklyHeading.className = "dtt-popup-section-heading";
        const weeklyHeadingTitle = document.createElement("div");
        weeklyHeadingTitle.className = "dtt-popup-section-title";
        const weeklyDetailSwitch = document.createElement("button");
        weeklyDetailSwitch.type = "button";
        weeklyDetailSwitch.className = "dtt-today-sessions-toggle dtt-weekly-detail-toggle";
        weeklyDetailSwitch.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 7H17V16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>`;
        weeklyDetailSwitch.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.popup.weeklyDetailMode = state.popup.weeklyDetailMode === "summary" ? "compare" : "summary";
            state.popup.lastWeeklySignature = "";
            updatePopupStaticTextV2();
            updatePopupDynamicContentV2();
            schedulePopupPosition(true);
        });
        weeklyHeading.append(weeklyHeadingTitle, weeklyDetailSwitch);
        const weeklyStats = document.createElement("div");
        weeklyStats.className = "dtt-weekly-stats";
        const weeklyAverageCard = document.createElement("div");
        weeklyAverageCard.className = "dtt-weekly-stat";
        const weeklyAverageLabel = document.createElement("div");
        weeklyAverageLabel.className = "dtt-weekly-stat-label";
        const weeklyAverageValue = document.createElement("div");
        weeklyAverageValue.className = "dtt-weekly-stat-value";
        weeklyAverageCard.append(weeklyAverageLabel, weeklyAverageValue);
        const weeklyBestDayCard = document.createElement("div");
        weeklyBestDayCard.className = "dtt-weekly-stat";
        const weeklyBestDayLabel = document.createElement("div");
        weeklyBestDayLabel.className = "dtt-weekly-stat-label";
        const weeklyBestDayValue = document.createElement("div");
        weeklyBestDayValue.className = "dtt-weekly-stat-value";
        weeklyBestDayCard.append(weeklyBestDayLabel, weeklyBestDayValue);
        weeklyStats.append(weeklyAverageCard, weeklyBestDayCard);
        const weeklyBars = document.createElement("div");
        weeklyBars.className = "dtt-weekly-bars";
        const weeklyCompare = document.createElement("div");
        weeklyCompare.className = "dtt-weekly-stats dtt-weekly-compare";
        weeklyCompare.hidden = true;
        const weeklyCompareTodayCard = document.createElement("div");
        weeklyCompareTodayCard.className = "dtt-weekly-stat";
        const weeklyCompareTodayLabel = document.createElement("div");
        weeklyCompareTodayLabel.className = "dtt-weekly-stat-label";
        const weeklyCompareTodayValue = document.createElement("div");
        weeklyCompareTodayValue.className = "dtt-weekly-stat-value";
        weeklyCompareTodayCard.append(weeklyCompareTodayLabel, weeklyCompareTodayValue);
        const weeklyCompareYesterdayCard = document.createElement("div");
        weeklyCompareYesterdayCard.className = "dtt-weekly-stat";
        const weeklyCompareYesterdayLabel = document.createElement("div");
        weeklyCompareYesterdayLabel.className = "dtt-weekly-stat-label";
        const weeklyCompareYesterdayValue = document.createElement("div");
        weeklyCompareYesterdayValue.className = "dtt-weekly-stat-value";
        weeklyCompareYesterdayCard.append(weeklyCompareYesterdayLabel, weeklyCompareYesterdayValue);
        const weeklyCompareDeltaCard = document.createElement("div");
        weeklyCompareDeltaCard.className = "dtt-weekly-stat";
        const weeklyCompareDeltaLabel = document.createElement("div");
        weeklyCompareDeltaLabel.className = "dtt-weekly-stat-label";
        const weeklyCompareDeltaValue = document.createElement("div");
        weeklyCompareDeltaValue.className = "dtt-weekly-stat-value";
        weeklyCompareDeltaCard.append(weeklyCompareDeltaLabel, weeklyCompareDeltaValue);
        weeklyCompare.append(weeklyCompareTodayCard, weeklyCompareYesterdayCard, weeklyCompareDeltaCard);
        weeklySection.append(weeklyHeading, weeklyStats, weeklyCompare, weeklyBars);
        mainPanel.appendChild(weeklySection);

        root.appendChild(mainPanel);

        // РІвЂќР‚РІвЂќР‚ Settings panel РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
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

        const goalRow = document.createElement("div");
        goalRow.className = "dtt-settings-row";
        const goalTitle = document.createElement("div");
        goalTitle.className = "dtt-settings-row-label";
        const goalContent = document.createElement("div");
        goalContent.className = "dtt-settings-row-content";
        const goalControl = document.createElement("div");
        goalControl.className = "dtt-retention-control";
        const goalInput = document.createElement("input");
        goalInput.type = "number";
        goalInput.min = "0";
        goalInput.max = "1440";
        goalInput.step = "5";
        goalInput.value = String(Math.floor(state.dailyGoalSeconds / 60));
        goalInput.className = "dtt-retention-input";
        goalInput.addEventListener("click", (event) => event.stopPropagation());
        goalInput.addEventListener("change", (event) => {
            event.stopPropagation();
            const nextMinutes = Math.max(0, Math.floor(Number(event.target.value) || 0));
            applyDailyGoalSeconds(nextMinutes * 60);
            event.target.value = String(Math.floor(state.dailyGoalSeconds / 60));
            updatePopupStaticTextV2();
            updatePopupDynamicContentV2();
        });
        const goalUnit = document.createElement("span");
        goalUnit.className = "dtt-retention-suffix";
        goalUnit.textContent = t("dailyGoalUnit");
        goalControl.append(goalInput, goalUnit);
        const goalHint = document.createElement("div");
        goalHint.className = "dtt-popup-mode-hint";
        goalContent.append(goalControl);
        goalRow.append(goalTitle, goalContent, goalHint);
        settingsPanel.appendChild(goalRow);

        const channelRow = document.createElement("div");
        channelRow.className = "dtt-settings-row";
        const channelTitle = document.createElement("div");
        channelTitle.className = "dtt-settings-row-label";
        const channelContent = document.createElement("div");
        channelContent.className = "dtt-settings-row-content";
        const channelSwitcher = document.createElement("div");
        channelSwitcher.className = "dtt-language-switcher";
        const channelHint = document.createElement("div");
        channelHint.className = "dtt-popup-mode-hint";
        state.popup.settingsChannelButtons = [];
        const channelOptions = [
            { value: "release", label: "Release" },
            { value: "test", label: "Test" },
            { value: "dev", label: "Dev" }
        ];
        for (const option of channelOptions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dtt-language-button${CHANNEL === option.value ? " is-active" : ""}`;
            button.textContent = option.label;
            button.dataset.channel = option.value;
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                applyChannelSelection(option.value);
            });
            channelSwitcher.appendChild(button);
            state.popup.settingsChannelButtons.push(button);
        }
        channelContent.appendChild(channelSwitcher);
        channelRow.append(channelTitle, channelContent, channelHint);
        settingsPanel.appendChild(channelRow);

        const badgeRow = document.createElement("div");
        badgeRow.className = "dtt-settings-row";
        badgeRow.hidden = !state.badge;
        const badgeTitle = document.createElement("div");
        badgeTitle.className = "dtt-settings-row-label";
        badgeTitle.textContent = t("badgeVisibilityLabel");
        const badgeContent = document.createElement("div");
        badgeContent.className = "dtt-settings-row-content is-between";
        const badgeHint = document.createElement("div");
        badgeHint.className = "dtt-settings-row-hint";
        badgeHint.textContent = t("badgeVisibilityHint");
        const badgeInput = document.createElement("button");
        badgeInput.type = "button";
        badgeInput.className = "dtt-language-button dtt-settings-toggle-button";
        setSettingsToggleButtonState(badgeInput, state.badgeVisible);
        badgeInput.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            applyBadgeVisibility(!state.badgeVisible);
            setSettingsToggleButtonState(badgeInput, state.badgeVisible);
        });
        badgeContent.append(badgeHint, badgeInput);
        badgeRow.append(badgeTitle, badgeContent);
        settingsPanel.appendChild(badgeRow);

        const topTracksRow = document.createElement("div");
        topTracksRow.className = "dtt-settings-row";
        const topTracksTitleNode = document.createElement("div");
        topTracksTitleNode.className = "dtt-settings-row-label";
        const topTracksContent = document.createElement("div");
        topTracksContent.className = "dtt-settings-row-content is-between";
        const topTracksHint = document.createElement("div");
        topTracksHint.className = "dtt-settings-row-hint";
        topTracksHint.textContent = t("topTracksToggleHint");
        const topTracksInput = document.createElement("button");
        topTracksInput.type = "button";
        topTracksInput.className = "dtt-language-button dtt-settings-toggle-button";
        setSettingsToggleButtonState(topTracksInput, state.topTracksVisible);
        topTracksInput.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.topTracksVisible = !state.topTracksVisible;
            saveTopTracksVisible();
            updatePopupStaticTextV2();
            updatePopupDynamicContentV2();
        });
        topTracksContent.append(topTracksHint, topTracksInput);
        topTracksRow.append(topTracksTitleNode, topTracksContent);
        settingsPanel.appendChild(topTracksRow);

        const topTracksCountRow = document.createElement("div");
        topTracksCountRow.className = "dtt-settings-row";
        topTracksCountRow.hidden = !state.topTracksVisible;
        const topTracksCountTitle = document.createElement("div");
        topTracksCountTitle.className = "dtt-settings-row-label";
        const topTracksCountContent = document.createElement("div");
        topTracksCountContent.className = "dtt-settings-row-content";
        const topTracksCountHint = document.createElement("div");
        topTracksCountHint.className = "dtt-settings-row-hint";
        topTracksCountHint.textContent = t("topTracksCountHint");
        const topTracksCountSwitcher = document.createElement("div");
        topTracksCountSwitcher.className = "dtt-language-switcher";
        state.popup.settingsTopTracksCountButtons = [];
        for (const count of [1, 2, 3]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dtt-language-button${state.topTracksDisplayCount === count ? " is-active" : ""}`;
            button.dataset.topTracksCount = String(count);
            button.textContent = String(count);
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (state.topTracksDisplayCount === count) {
                    return;
                }
                state.topTracksDisplayCount = count;
                saveTopTracksDisplayCount();
                updatePopupStaticTextV2();
                updatePopupDynamicContentV2();
            });
            topTracksCountSwitcher.appendChild(button);
            state.popup.settingsTopTracksCountButtons.push(button);
        }
        topTracksCountContent.append(topTracksCountHint, topTracksCountSwitcher);
        topTracksCountRow.append(topTracksCountTitle, topTracksCountContent);
        settingsPanel.appendChild(topTracksCountRow);

        const popupModeRow = document.createElement("div");
        popupModeRow.className = "dtt-settings-row";
        const popupModeTitle = document.createElement("div");
        popupModeTitle.className = "dtt-settings-row-label";
        popupModeTitle.textContent = t("popupModeLabel");
        const popupModeContent = document.createElement("div");
        popupModeContent.className = "dtt-settings-row-content";
        const popupModeSwitcher = document.createElement("div");
        popupModeSwitcher.className = "dtt-language-switcher";
        state.popup.settingsPopupModeButtons = [];
        const popupModeOptions = [
            { mode: "compact", label: t("popupModeCompact") },
            { mode: "full", label: t("popupModeFull") }
        ];
        for (const option of popupModeOptions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dtt-language-button${state.popupMode === option.mode ? " is-active" : ""}`;
            button.textContent = option.label;
            button.dataset.popupMode = option.mode;
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (state.popupMode === option.mode) return;
                applyPopupMode(option.mode);
                updatePopupStaticTextV2();
                updatePopupDynamicContentV2();
                updatePopupHistoryV2();
                schedulePopupPosition(true);
            });
            popupModeSwitcher.appendChild(button);
            state.popup.settingsPopupModeButtons.push(button);
        }
        const popupModeHint = document.createElement("div");
        popupModeHint.className = "dtt-popup-mode-hint";
        popupModeHint.textContent = t("popupModeHint");
        popupModeContent.appendChild(popupModeSwitcher);
        popupModeRow.append(popupModeTitle, popupModeContent, popupModeHint);
        settingsPanel.appendChild(popupModeRow);

        const performanceModeRow = document.createElement("div");
        performanceModeRow.className = "dtt-settings-row";
        const performanceModeTitle = document.createElement("div");
        performanceModeTitle.className = "dtt-settings-row-label";
        performanceModeTitle.textContent = t("performanceModeLabel");
        const performanceModeContent = document.createElement("div");
        performanceModeContent.className = "dtt-settings-row-content";
        const performanceModeSwitcher = document.createElement("div");
        performanceModeSwitcher.className = "dtt-language-switcher";
        state.popup.settingsPerformanceModeButtons = [];
        const performanceModeOptions = [
            { mode: "default", label: t("performanceModeDefault") },
            { mode: "lightweight", label: t("performanceModeLightweight") }
        ];
        for (const option of performanceModeOptions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dtt-language-button${state.performanceMode === option.mode ? " is-active" : ""}`;
            button.textContent = option.label;
            button.dataset.performanceMode = option.mode;
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (state.performanceMode === option.mode) return;
                applyPerformanceMode(option.mode);
            });
            performanceModeSwitcher.appendChild(button);
            state.popup.settingsPerformanceModeButtons.push(button);
        }
        const performanceModeHint = document.createElement("div");
        performanceModeHint.className = "dtt-popup-mode-hint";
        performanceModeHint.textContent = t("performanceModeHint");
        performanceModeContent.appendChild(performanceModeSwitcher);
        performanceModeRow.append(performanceModeTitle, performanceModeContent, performanceModeHint);
        settingsPanel.appendChild(performanceModeRow);

        const pauseThresholdRow = document.createElement("div");
        pauseThresholdRow.className = "dtt-settings-row";
        const pauseThresholdTitle = document.createElement("div");
        pauseThresholdTitle.className = "dtt-settings-row-label";
        pauseThresholdTitle.textContent = t("pauseThresholdLabel");
        const pauseThresholdContent = document.createElement("div");
        pauseThresholdContent.className = "dtt-settings-row-content";
        const pauseThresholdSwitcher = document.createElement("div");
        pauseThresholdSwitcher.className = "dtt-language-switcher";
        state.popup.settingsPauseThresholdButtons = [];
        const pauseThresholdOptions = [15, 30, 60, 120];
        for (const seconds of pauseThresholdOptions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dtt-language-button${state.pauseSeconds === seconds ? " is-active" : ""}`;
            button.textContent = `${seconds}s`;
            button.dataset.pauseSeconds = String(seconds);
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (state.pauseSeconds === seconds) return;
                applyPauseSeconds(seconds);
                updatePopupStaticTextV2();
                updatePopupDynamicContentV2();
                updatePopupHistoryV2();
                schedulePopupPosition(true);
            });
            pauseThresholdSwitcher.appendChild(button);
            state.popup.settingsPauseThresholdButtons.push(button);
        }
        const pauseThresholdHint = document.createElement("div");
        pauseThresholdHint.className = "dtt-popup-mode-hint";
        pauseThresholdHint.textContent = t("pauseThresholdHint");
        pauseThresholdContent.appendChild(pauseThresholdSwitcher);
        pauseThresholdRow.append(pauseThresholdTitle, pauseThresholdContent, pauseThresholdHint);
        settingsPanel.appendChild(pauseThresholdRow);

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
        const streakProgressionInput = document.createElement("button");
        streakProgressionInput.type = "button";
        streakProgressionInput.className = "dtt-language-button dtt-settings-toggle-button";
        setSettingsToggleButtonState(streakProgressionInput, state.longStreakProgressionEnabled);
        streakProgressionInput.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            applyLongStreakProgressionEnabled(!state.longStreakProgressionEnabled);
            setSettingsToggleButtonState(streakProgressionInput, state.longStreakProgressionEnabled);
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

        const streakShieldsRow = document.createElement("div");
        streakShieldsRow.className = "dtt-settings-row";
        const streakShieldsTitle = document.createElement("div");
        streakShieldsTitle.className = "dtt-settings-row-label";
        streakShieldsTitle.textContent = t("streakShieldsLabel");
        const streakShieldsHint = document.createElement("div");
        streakShieldsHint.className = "dtt-settings-row-hint";
        streakShieldsRow.append(streakShieldsTitle, streakShieldsHint);
        settingsPanel.appendChild(streakShieldsRow);

        const keepStreakRow = document.createElement("div");
        keepStreakRow.className = "dtt-settings-row";
        const keepStreakTitle = document.createElement("div");
        keepStreakTitle.className = "dtt-settings-row-label";
        keepStreakTitle.textContent = t("keepStreakLabel");
        const keepStreakContent = document.createElement("div");
        keepStreakContent.className = "dtt-settings-row-content is-between";
        const keepStreakHint = document.createElement("div");
        keepStreakHint.className = "dtt-settings-row-hint";
        const keepStreakInput = document.createElement("button");
        keepStreakInput.type = "button";
        keepStreakInput.className = "dtt-language-button dtt-settings-toggle-button";
        setSettingsToggleButtonState(keepStreakInput, state.streakControl.keepStreakEnabled);
        keepStreakInput.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            applyKeepStreakEnabled(!state.streakControl.keepStreakEnabled);
            setSettingsToggleButtonState(keepStreakInput, state.streakControl.keepStreakEnabled);
            updatePopupStaticTextV2();
            updatePopupDynamicContentV2();
            updatePopupHistoryV2();
            updatePopupFireIcon();
            schedulePopupPosition(true);
        });
        keepStreakContent.append(keepStreakHint, keepStreakInput);
        const keepStreakPreview = document.createElement("div");
        keepStreakPreview.className = "dtt-settings-row-hint";
        keepStreakRow.append(keepStreakTitle, keepStreakContent, keepStreakPreview);
        settingsPanel.appendChild(keepStreakRow);

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
        retentionInput.title = `1РІР‚вЂњ${CONFIG.maxHistoryRetentionMonths}`;
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

        const retentionForeverInput = document.createElement("button");
        retentionForeverInput.type = "button";
        retentionForeverInput.className = "dtt-language-button dtt-settings-pill-button";
        setRetentionForeverButtonState(retentionForeverInput, state.historyRetentionForever);
        retentionForeverInput.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const previousValue = state.historyRetentionForever;
            applyHistoryRetentionForever(!state.historyRetentionForever);
            setRetentionForeverButtonState(retentionForeverInput, state.historyRetentionForever);
            if (previousValue !== state.historyRetentionForever) {
                updatePopupStaticTextV2();
                updatePopupDynamicContentV2();
                updatePopupHistoryV2(getDailySummaryRows(getComputedDayTotalSeconds()));
            }
        });

        retContent.append(retentionInput, retSuffix, retentionForeverInput);
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
            await checkForUpdates({ manual: true, anchorEl: event.currentTarget });
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

        const versionText = document.createElement("button");
        versionText.type = "button";
        versionText.className = "dtt-settings-version";
        versionText.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await checkForUpdates({ manual: true, anchorEl: event.currentTarget });
        });
        settingsPanel.appendChild(versionText);

        root.appendChild(settingsPanel);

        // РІвЂќР‚РІвЂќР‚ Save node refs РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
        state.popup.titleNode = title;
        state.popup.badgeNode = badgePill;
        state.popup.viewToggleNode = weeklyToggleBtn;
        state.popup.hintNode = hint;
        state.popup.summaryDateNode = dateNode;
        state.popup.summaryTotalNode = totalNode;
        state.popup.summaryGoalWrapNode = goalWrap;
        state.popup.summaryGoalLabelNode = goalLabel;
        state.popup.summaryGoalValueNode = goalValue;
        state.popup.summaryGoalProgressNode = goalProgressBar;
        state.popup.summaryTopTracksWrapNode = topTracksWrap;
        state.popup.summaryTopTracksListNode = topTracksList;
        state.popup.intervalsSectionNode = intervalsSection;
        state.popup.sessionsTitleNode = intervalsTitle;
        state.popup.intervalsListNode = intervalsList;
        state.popup.todaySessionsToggleNode = todaySessionsToggle;
        state.popup.historySectionNode = historySection;
        state.popup.historyTitleNode = historyTitle;
        state.popup.historyListNode = historyList;
        state.popup.historyToggleNode = historyToggle;
        state.popup.weeklySectionNode = weeklySection;
        state.popup.weeklySectionTitleNode = weeklyHeadingTitle;
        state.popup.weeklyDetailSwitchNode = weeklyDetailSwitch;
        state.popup.weeklyAverageLabelNode = weeklyAverageLabel;
        state.popup.weeklyAverageValueNode = weeklyAverageValue;
        state.popup.weeklyBestDayLabelNode = weeklyBestDayLabel;
        state.popup.weeklyBestDayValueNode = weeklyBestDayValue;
        state.popup.weeklyBarsNode = weeklyBars;
        state.popup.weeklyCompareNode = weeklyCompare;
        state.popup.weeklyCompareTodayLabelNode = weeklyCompareTodayLabel;
        state.popup.weeklyCompareTodayValueNode = weeklyCompareTodayValue;
        state.popup.weeklyCompareYesterdayLabelNode = weeklyCompareYesterdayLabel;
        state.popup.weeklyCompareYesterdayValueNode = weeklyCompareYesterdayValue;
        state.popup.weeklyCompareDeltaLabelNode = weeklyCompareDeltaLabel;
        state.popup.weeklyCompareDeltaValueNode = weeklyCompareDeltaValue;
        state.popup.retentionLabelNode = retTitle;
        state.popup.retentionSuffixNode = retSuffix;
        state.popup.settingsGearNode = gearBtn;
        state.popup.settingsPanelNode = settingsPanel;
        state.popup.settingsLangTitleNode = langTitle;
        state.popup.settingsGoalTitleNode = goalTitle;
        state.popup.settingsGoalHintNode = goalHint;
        state.popup.settingsGoalInputNode = goalInput;
        state.popup.settingsGoalUnitNode = goalUnit;
        state.popup.settingsChannelTitleNode = channelTitle;
        state.popup.settingsChannelHintNode = channelHint;
        state.popup.settingsBadgeRowNode = badgeRow;
        state.popup.settingsBadgeTitleNode = badgeTitle;
        state.popup.settingsBadgeHintNode = badgeHint;
        state.popup.settingsBadgeInputNode = badgeInput;
        state.popup.settingsTopTracksTitleNode = topTracksTitleNode;
        state.popup.settingsTopTracksHintNode = topTracksHint;
        state.popup.settingsTopTracksInputNode = topTracksInput;
        state.popup.settingsTopTracksCountRowNode = topTracksCountRow;
        state.popup.settingsTopTracksCountTitleNode = topTracksCountTitle;
        state.popup.settingsPopupModeTitleNode = popupModeTitle;
        state.popup.settingsPopupModeHintNode = popupModeHint;
        state.popup.settingsPerformanceModeTitleNode = performanceModeTitle;
        state.popup.settingsPerformanceModeHintNode = performanceModeHint;
        state.popup.settingsPauseThresholdTitleNode = pauseThresholdTitle;
        state.popup.settingsPauseThresholdHintNode = pauseThresholdHint;
        state.popup.settingsRetentionTitleNode = retTitle;
        state.popup.settingsRetentionInputNode = retentionInput;
        state.popup.settingsRetentionForeverInputNode = retentionForeverInput;
        state.popup.settingsStreakShieldsTitleNode = streakShieldsTitle;
        state.popup.settingsStreakShieldsHintNode = streakShieldsHint;
        state.popup.settingsKeepStreakTitleNode = keepStreakTitle;
        state.popup.settingsKeepStreakHintNode = keepStreakHint;
        state.popup.settingsKeepStreakInputNode = keepStreakInput;
        state.popup.settingsKeepStreakPreviewNode = keepStreakPreview;
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
        state.popup.settingsVersionNode = versionText;
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
        updateStreakProtectionUi();
    }

    function openSettings() {
        if (!state.popup.node) return;
        state.popup.settingsOpen = true;
        state.popup.node.classList.add("dtt-settings-open");
        if (state.popup.titleNode) state.popup.titleNode.textContent = t("settingsTitle");
        if (state.popup.settingsGearNode) {
            state.popup.settingsGearNode.style.display = "none";
        }
        if (state.popup.viewToggleNode) {
            state.popup.viewToggleNode.style.display = "none";
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
        updatePopupStaticTextV2();
        schedulePopupPosition(true);
    }

    function closeSettings() {
        if (!state.popup.node) return;
        state.popup.settingsOpen = false;
        state.popup.node.classList.remove("dtt-settings-open");
        if (state.popup.titleNode) state.popup.titleNode.textContent = t("popupTitle");
        if (state.popup.settingsGearNode) state.popup.settingsGearNode.style.display = "";
        if (state.popup.viewToggleNode) state.popup.viewToggleNode.style.display = "";
        if (state.popup.settingsBackNode) state.popup.settingsBackNode.style.display = "none";
        updatePopupStaticTextV2();
        schedulePopupPosition(true);
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

            const main = document.createElement("div");
            main.className = "dtt-interval-main";

            const range = document.createElement("span");
            range.className = "dtt-interval-range";
            range.textContent = row.label;

            main.appendChild(range);

            if (row.details) {
                const details = document.createElement("span");
                details.className = "dtt-interval-details";
                details.textContent = row.details;
                main.appendChild(details);
            }

            const duration = document.createElement("span");
            duration.className = "dtt-interval-duration";
            duration.textContent = row.duration;

            item.append(main, duration);
            listNode.appendChild(item);
        }
    }

    function createHistorySignature(rows) {
        return rows
            .map(([date, entry]) => `${date}:${entry.totalSeconds}`)
            .join("|");
    }

    function createRowsSignature(rows) {
        return rows
            .map((row) => `${row.key || ""}:${row.label || ""}:${row.duration || ""}:${row.details || ""}:${row.isToday ? "1" : "0"}`)
            .join("|");
    }

    function createWeeklySummarySignature(summary) {
        const bestDayKey = summary.bestDay ? `${summary.bestDay.date}:${summary.bestDay.totalSeconds}` : "none";
        return [
            summary.totalSeconds,
            summary.averageSeconds,
            summary.maxSeconds,
            bestDayKey,
            ...summary.days.map((day) => `${day.date}:${day.totalSeconds}`)
        ].join("|");
    }

    function isLightweightMode() {
        return state.performanceMode === "lightweight";
    }

    function syncPopupModeClass() {
        if (!state.popup.node) {
            return;
        }

        state.popup.node.classList.toggle("dtt-popup-mode-compact", !isFullPopupMode());
        state.popup.node.classList.toggle("dtt-popup-mode-full", isFullPopupMode());
    }

    function syncPerformanceModeClass() {
        state.ui.widget?.classList.toggle("dtt-performance-lightweight", isLightweightMode());
        state.popup.node?.classList.toggle("dtt-performance-lightweight", isLightweightMode());
    }

    function schedulePopupPosition(force = false) {
        if (!state.popup.node) {
            return;
        }

        if (!force && state.runtime.popupPositionFrameId !== null) {
            return;
        }

        if (state.runtime.popupPositionFrameId !== null) {
            cancelAnimationFrame(state.runtime.popupPositionFrameId);
        }

        state.runtime.popupPositionFrameId = requestAnimationFrame(() => {
            state.runtime.popupPositionFrameId = null;
            positionPopup();
        });
    }

    function renderWeeklyBars(weeklySummary) {
        if (!state.popup.weeklyBarsNode) {
            return false;
        }

        let didMutate = false;
        if (state.popup.weeklyBarNodes.length !== weeklySummary.days.length) {
            state.popup.weeklyBarNodes = [];
            state.popup.weeklyBarsNode.innerHTML = "";
            const fragment = document.createDocumentFragment();

            for (const day of weeklySummary.days) {
                const barItem = document.createElement("div");
                barItem.className = "dtt-weekly-bar-item";
                const track = document.createElement("div");
                track.className = "dtt-weekly-bar-track";
                const fill = document.createElement("div");
                fill.className = "dtt-weekly-bar-fill";
                const label = document.createElement("div");
                label.className = "dtt-weekly-bar-label";

                track.appendChild(fill);
                barItem.append(track, label);
                fragment.appendChild(barItem);
                state.popup.weeklyBarNodes.push({ barItem, fill, label });
            }

            state.popup.weeklyBarsNode.appendChild(fragment);
            didMutate = true;
        }

        weeklySummary.days.forEach((day, index) => {
            const nodeSet = state.popup.weeklyBarNodes[index];
            if (!nodeSet) {
                return;
            }

            const heightPercent = day.totalSeconds <= 0
                ? 0
                : Math.max(6, Math.round((day.totalSeconds / weeklySummary.maxSeconds) * 100));
            const title = `${day.date}: ${formatDuration(day.totalSeconds)}`;
            const height = `${heightPercent}%`;

            if (nodeSet.barItem.title !== title) {
                nodeSet.barItem.title = title;
            }
            if (nodeSet.label.textContent !== day.label) {
                nodeSet.label.textContent = day.label;
            }
            if (nodeSet.fill.style.height !== height) {
                nodeSet.fill.style.height = height;
            }
        });

        return didMutate;
    }

    function updatePopupStaticTextV2() {
        if (!state.popup.node) {
            return;
        }

        syncPopupModeClass();

        const isWeekMode = state.popup.viewMode === "week";

        if (state.popup.titleNode) {
            state.popup.titleNode.textContent = state.popup.settingsOpen
                ? t("settingsTitle")
                : t("popupTitle");
        }
        if (state.popup.badgeNode) {
            state.popup.badgeNode.hidden = state.popup.settingsOpen || !state.badge || !state.badgeVisible;
            if (state.badge) {
                state.popup.badgeNode.textContent = state.badge.label;
                if (state.badge.effect === "rainbow") {
                    state.popup.badgeNode.classList.add("is-rainbow");
                    state.popup.badgeNode.style.color = "";
                    state.popup.badgeNode.style.background = "";
                    state.popup.badgeNode.style.borderColor = "";
                } else {
                    state.popup.badgeNode.classList.remove("is-rainbow");
                    state.popup.badgeNode.style.color = state.badge.color;
                    state.popup.badgeNode.style.background = state.badge.bg;
                    state.popup.badgeNode.style.borderColor = state.badge.color + "40";
                }
            }
        }
        if (state.popup.viewToggleNode) {
            state.popup.viewToggleNode.title = t("weeklyToggleTitle");
            state.popup.viewToggleNode.setAttribute("aria-label", t("weeklyToggleTitle"));
            state.popup.viewToggleNode.classList.toggle("is-active", isWeekMode);
        }
        if (state.popup.hintNode) {
            state.popup.hintNode.textContent = "";
        }
        if (state.popup.sessionsTitleNode) {
            state.popup.sessionsTitleNode.textContent = t("sessionsTodayTitle");
        }
        if (state.popup.historyTitleNode) {
            state.popup.historyTitleNode.textContent = t("historyTitle");
        }
        if (state.popup.weeklySectionTitleNode) {
            state.popup.weeklySectionTitleNode.textContent = state.popup.weeklyDetailMode === "compare"
                ? t("yesterdayVsTodayTitle")
                : t("weeklySummaryTitle");
        }
        if (state.popup.weeklyDetailSwitchNode) {
            const nextLabel = state.popup.weeklyDetailMode === "compare"
                ? t("weeklySummaryTitle")
                : t("yesterdayVsTodayTitle");
            state.popup.weeklyDetailSwitchNode.title = `${t("yesterdayVsTodaySwitchTitle")}: ${nextLabel}`;
            state.popup.weeklyDetailSwitchNode.setAttribute("aria-label", `${t("yesterdayVsTodaySwitchTitle")}: ${nextLabel}`);
        }
        if (state.popup.weeklyAverageLabelNode) {
            state.popup.weeklyAverageLabelNode.textContent = t("weeklyAverageLabel");
        }
        if (state.popup.weeklyBestDayLabelNode) {
            state.popup.weeklyBestDayLabelNode.textContent = t("weeklyBestDayLabel");
        }
        if (state.popup.weeklyCompareTodayLabelNode) {
            state.popup.weeklyCompareTodayLabelNode.textContent = t("comparisonTodayLabel");
        }
        if (state.popup.weeklyCompareYesterdayLabelNode) {
            state.popup.weeklyCompareYesterdayLabelNode.textContent = t("comparisonYesterdayLabel");
        }
        if (state.popup.weeklyCompareDeltaLabelNode) {
            state.popup.weeklyCompareDeltaLabelNode.textContent = t("comparisonDeltaLabel");
        }
        if (state.popup.settingsLangTitleNode) {
            state.popup.settingsLangTitleNode.textContent = t("languageLabel");
        }
        if (state.popup.settingsGoalTitleNode) {
            state.popup.settingsGoalTitleNode.textContent = t("dailyGoalLabel");
        }
        if (state.popup.settingsGoalHintNode) {
            state.popup.settingsGoalHintNode.textContent = t("dailyGoalHint");
        }
        if (state.popup.settingsGoalInputNode) {
            state.popup.settingsGoalInputNode.value = String(Math.floor(state.dailyGoalSeconds / 60));
        }
        if (state.popup.settingsGoalUnitNode) {
            state.popup.settingsGoalUnitNode.textContent = t("dailyGoalUnit");
        }
        if (state.popup.settingsBadgeRowNode) {
            state.popup.settingsBadgeRowNode.hidden = !state.badge;
        }
        if (state.popup.settingsBadgeTitleNode) {
            state.popup.settingsBadgeTitleNode.textContent = t("badgeVisibilityLabel");
        }
        if (state.popup.settingsBadgeHintNode) {
            state.popup.settingsBadgeHintNode.textContent = t("badgeVisibilityHint");
        }
        if (state.popup.settingsBadgeInputNode) {
            setSettingsToggleButtonState(state.popup.settingsBadgeInputNode, state.badgeVisible);
        }
        if (state.popup.settingsTopTracksTitleNode) {
            state.popup.settingsTopTracksTitleNode.textContent = t("topTracksToggleLabel");
        }
        if (state.popup.settingsTopTracksHintNode) {
            state.popup.settingsTopTracksHintNode.textContent = t("topTracksToggleHint");
        }
        if (state.popup.settingsTopTracksInputNode) {
            setSettingsToggleButtonState(state.popup.settingsTopTracksInputNode, state.topTracksVisible);
        }
        if (state.popup.settingsTopTracksCountRowNode) {
            state.popup.settingsTopTracksCountRowNode.hidden = !state.topTracksVisible;
        }
        if (state.popup.settingsTopTracksCountTitleNode) {
            state.popup.settingsTopTracksCountTitleNode.textContent = t("topTracksCountLabel");
        }
        if (state.popup.settingsChannelTitleNode) {
            state.popup.settingsChannelTitleNode.textContent = getChannelUiText().title;
        }
        if (state.popup.settingsChannelHintNode) {
            state.popup.settingsChannelHintNode.textContent = getChannelUiText().hint;
        }
        if (state.popup.settingsPopupModeTitleNode) {
            state.popup.settingsPopupModeTitleNode.textContent = t("popupModeLabel");
        }
        if (state.popup.settingsPopupModeHintNode) {
            state.popup.settingsPopupModeHintNode.textContent = t("popupModeHint");
        }
        if (state.popup.settingsPerformanceModeTitleNode) {
            state.popup.settingsPerformanceModeTitleNode.textContent = t("performanceModeLabel");
        }
        if (state.popup.settingsPerformanceModeHintNode) {
            state.popup.settingsPerformanceModeHintNode.textContent = t("performanceModeHint");
        }
        if (state.popup.settingsPauseThresholdTitleNode) {
            state.popup.settingsPauseThresholdTitleNode.textContent = t("pauseThresholdLabel");
        }
        if (state.popup.settingsPauseThresholdHintNode) {
            state.popup.settingsPauseThresholdHintNode.textContent = t("pauseThresholdHint");
        }
        updateStreakProtectionUi();
        if (state.popup.settingsRetentionTitleNode) {
            state.popup.settingsRetentionTitleNode.textContent = t("retentionLabel");
        }
        if (state.popup.settingsRetentionInputNode) {
            state.popup.settingsRetentionInputNode.disabled = state.historyRetentionForever;
            state.popup.settingsRetentionInputNode.value = String(state.historyRetentionMonths);
        }
        if (state.popup.settingsRetentionForeverInputNode) {
            setRetentionForeverButtonState(
                state.popup.settingsRetentionForeverInputNode,
                state.historyRetentionForever
            );
        }
        if (state.popup.settingsStreakProgressionTitleNode) {
            state.popup.settingsStreakProgressionTitleNode.textContent = t("streakProgressionLabel");
        }
        if (state.popup.settingsStreakProgressionHintNode) {
            state.popup.settingsStreakProgressionHintNode.textContent = t("streakProgressionHint");
        }
        if (state.popup.settingsStreakProgressionInputNode) {
            setSettingsToggleButtonState(
                state.popup.settingsStreakProgressionInputNode,
                state.longStreakProgressionEnabled
            );
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
        if (state.popup.settingsVersionNode) {
            const channelText = CHANNEL === "test" ? "Test" : CHANNEL === "dev" ? "Dev" : "Release";
            state.popup.settingsVersionNode.textContent = `Version: ${VERSION} (${channelText})`;
            state.popup.settingsVersionNode.title = t("updateCheckButton");
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
        for (const button of state.popup.settingsPopupModeButtons ?? []) {
            button.classList.toggle("is-active", button.dataset.popupMode === state.popupMode);
            button.textContent = button.dataset.popupMode === "full" ? t("popupModeFull") : t("popupModeCompact");
        }
        for (const button of state.popup.settingsPerformanceModeButtons ?? []) {
            button.classList.toggle("is-active", button.dataset.performanceMode === state.performanceMode);
            button.textContent = button.dataset.performanceMode === "lightweight"
                ? t("performanceModeLightweight")
                : t("performanceModeDefault");
        }
        for (const button of state.popup.settingsChannelButtons ?? []) {
            button.hidden = button.dataset.channel === "dev" && !state.devChannelAvailable;
            button.classList.toggle("is-active", button.dataset.channel === CHANNEL);
            button.textContent = button.dataset.channel === "test"
                ? getChannelUiText().test
                : button.dataset.channel === "dev"
                    ? getChannelUiText().dev
                    : getChannelUiText().release;
        }
        for (const button of state.popup.settingsPauseThresholdButtons ?? []) {
            button.classList.toggle("is-active", Number(button.dataset.pauseSeconds) === state.pauseSeconds);
        }
        for (const button of state.popup.settingsTopTracksCountButtons ?? []) {
            button.classList.toggle("is-active", Number(button.dataset.topTracksCount) === state.topTracksDisplayCount);
        }
        if (state.popup.viewToggleNode) {
            state.popup.viewToggleNode.hidden = !isFullPopupMode();
        }
        state.popup.lastLanguage = state.language;
        syncPerformanceModeClass();
    }

    function updatePopupDynamicContentV2(options = {}) {
        if (!state.popup.node) {
            return false;
        }

        const now = options.now ?? Date.now();
        const totalSeconds = options.totalSeconds ?? getComputedDayTotalSeconds(now);
        const todayIntervalRows = options.todayIntervalRows ?? getTodayIntervalRows(now);
        const isWeekMode = state.popup.viewMode === "week";
        const weeklySummary = isWeekMode ? getWeeklySummaryData(totalSeconds) : null;
        const weeklyComparison = isWeekMode ? getYesterdayVsTodayData(totalSeconds) : null;
        const isWeeklyCompareMode = isWeekMode && state.popup.weeklyDetailMode === "compare";
        const goal = getDailyGoalProgress(totalSeconds);
        let didMutateLayout = false;

        if (state.popup.hintNode) {
            state.popup.hintNode.textContent = "";
        }

        const summarySignature = [
            state.language,
            state.performanceMode,
            isWeekMode ? "week" : "today",
            isWeekMode ? weeklySummary.totalSeconds : totalSeconds,
            goal.enabled ? "1" : "0",
            goal.complete ? "1" : "0",
            goal.percentage,
            goal.targetSeconds
        ].join("|");
        if (summarySignature !== state.popup.lastSummarySignature) {
            if (state.popup.summaryDateNode) {
                state.popup.summaryDateNode.textContent = isWeekMode ? t("weeklyRangeLabel") : state.day.date;
            }
            if (state.popup.summaryTotalNode) {
                state.popup.summaryTotalNode.textContent = formatDuration(isWeekMode ? weeklySummary.totalSeconds : totalSeconds);
            }
            if (state.popup.summaryGoalWrapNode) {
                const nextHidden = isWeekMode || !goal.enabled;
                if (state.popup.summaryGoalWrapNode.hidden !== nextHidden) {
                    state.popup.summaryGoalWrapNode.hidden = nextHidden;
                    didMutateLayout = true;
                }
                if (goal.enabled) {
                    if (state.popup.summaryGoalLabelNode) {
                        state.popup.summaryGoalLabelNode.textContent = goal.complete
                            ? t("dailyGoalComplete")
                            : t("dailyGoalProgress");
                    }
                    if (state.popup.summaryGoalValueNode) {
                        state.popup.summaryGoalValueNode.textContent = `${formatDuration(totalSeconds)} / ${formatDuration(goal.targetSeconds)}`;
                    }
                    if (state.popup.summaryGoalProgressNode) {
                        state.popup.summaryGoalProgressNode.style.width = `${Math.max(0, Math.min(100, goal.ratio * 100))}%`;
                    }
                }
            }
            state.popup.lastSummarySignature = summarySignature;
        }

        if (state.popup.summaryTopTracksWrapNode && state.popup.summaryTopTracksListNode) {
            const topTrackRows = getTodayTopTrackRows();
            const nextHidden = isWeekMode || !state.topTracksVisible;
            if (state.popup.summaryTopTracksWrapNode.hidden !== nextHidden) {
                state.popup.summaryTopTracksWrapNode.hidden = nextHidden;
                didMutateLayout = true;
            }
            const renderedTopTrackRows = topTrackRows.length > 0
                ? topTrackRows
                : [{
                    key: "empty-top-tracks",
                    label: t("topTracksEmpty"),
                    duration: ""
                }];
            const topTracksSignature = `${nextHidden ? "1" : "0"}|${createRowsSignature(renderedTopTrackRows)}`;
            if (topTracksSignature !== state.popup.lastTopTracksSignature) {
                renderRows(state.popup.summaryTopTracksListNode, renderedTopTrackRows);
                state.popup.lastTopTracksSignature = topTracksSignature;
                didMutateLayout = true;
            }
        }

        if (state.popup.intervalsSectionNode && state.popup.intervalsSectionNode.hidden !== isWeekMode) {
            state.popup.intervalsSectionNode.hidden = isWeekMode;
            didMutateLayout = true;
        }
        if (state.popup.intervalsListNode) {
            const displayedIntervalRows = getDisplayedTodayIntervalRows(todayIntervalRows).map((row) => ({
                ...row,
                isToday: true
            }));
            const intervalsSignature = `${isWeekMode ? "1" : "0"}|${state.popup.todaySessionsExpanded ? "1" : "0"}|${createRowsSignature(displayedIntervalRows)}`;
            if (intervalsSignature !== state.popup.lastIntervalsSignature) {
                renderRows(state.popup.intervalsListNode, displayedIntervalRows);
                state.popup.lastIntervalsSignature = intervalsSignature;
                didMutateLayout = true;
            }
        }
        if (state.popup.historySectionNode && state.popup.historySectionNode.hidden !== isWeekMode) {
            state.popup.historySectionNode.hidden = isWeekMode;
            didMutateLayout = true;
        }
        if (state.popup.weeklySectionNode && state.popup.weeklySectionNode.hidden !== !isWeekMode) {
            state.popup.weeklySectionNode.hidden = !isWeekMode;
            didMutateLayout = true;
        }
        if (state.popup.weeklyCompareNode && state.popup.weeklyCompareNode.hidden !== !isWeeklyCompareMode) {
            state.popup.weeklyCompareNode.hidden = !isWeeklyCompareMode;
            didMutateLayout = true;
        }
        if (state.popup.weeklyBarsNode && state.popup.weeklyBarsNode.hidden !== isWeeklyCompareMode) {
            state.popup.weeklyBarsNode.hidden = isWeeklyCompareMode;
            didMutateLayout = true;
        }

        if (weeklySummary && weeklyComparison) {
            const weeklySignature = isWeeklyCompareMode
                ? [
                    "compare",
                    state.language,
                    weeklyComparison.todaySeconds,
                    weeklyComparison.yesterdaySeconds,
                    weeklyComparison.deltaSeconds
                ].join("|")
                : `summary|${state.language}|${createWeeklySummarySignature(weeklySummary)}`;
            if (weeklySignature !== state.popup.lastWeeklySignature) {
                if (isWeeklyCompareMode) {
                    if (state.popup.weeklyCompareTodayValueNode) {
                        state.popup.weeklyCompareTodayValueNode.textContent = formatDuration(weeklyComparison.todaySeconds);
                    }
                    if (state.popup.weeklyCompareYesterdayValueNode) {
                        state.popup.weeklyCompareYesterdayValueNode.textContent = weeklyComparison.yesterdaySeconds > 0
                            ? formatDuration(weeklyComparison.yesterdaySeconds)
                            : t("comparisonNoYesterday");
                    }
                    if (state.popup.weeklyCompareDeltaValueNode) {
                        state.popup.weeklyCompareDeltaValueNode.textContent = formatSignedDuration(weeklyComparison.deltaSeconds);
                    }
                } else {
                    if (state.popup.weeklyAverageValueNode) {
                        state.popup.weeklyAverageValueNode.textContent = formatDuration(weeklySummary.averageSeconds);
                    }
                    if (state.popup.weeklyBestDayValueNode) {
                        state.popup.weeklyBestDayValueNode.textContent = weeklySummary.bestDay
                            ? `${weeklySummary.bestDay.label} вЂў ${formatDuration(weeklySummary.bestDay.totalSeconds)}`
                            : t("weeklyBestDayEmpty");
                    }
                    didMutateLayout = renderWeeklyBars(weeklySummary) || didMutateLayout;
                }
                state.popup.lastWeeklySignature = weeklySignature;
            }
        }

        updateTodaySessionsToggle(todayIntervalRows);
        return didMutateLayout;
    }

    function updatePopupHistoryV2(dailySummaryRows = getDailySummaryRows()) {
        if (!state.popup.node || !state.popup.historyListNode) {
            return false;
        }

        const historySignature = `${state.language}|${state.popupMode}|${createHistorySignature(dailySummaryRows)}|${state.popup.historyExpanded ? "1" : "0"}`;
        if (historySignature === state.popup.lastHistorySignature) {
            return false;
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
        return true;
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
        syncPerformanceModeClass();
        schedulePopupPosition(true);

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

        hideUpdateStatusToast();
        popupNode.classList.remove("dtt-visible");
        state.popup.node = null;
        state.popup.viewToggleNode = null;
        state.popup.weeklyDetailMode = "summary";
        state.popup.titleNode = null;
        state.popup.badgeNode = null;
        state.popup.hintNode = null;
        state.popup.summaryDateNode = null;
        state.popup.summaryTotalNode = null;
        state.popup.summaryGoalWrapNode = null;
        state.popup.summaryGoalLabelNode = null;
        state.popup.summaryGoalValueNode = null;
        state.popup.summaryGoalProgressNode = null;
        state.popup.summaryTopTracksWrapNode = null;
        state.popup.summaryTopTracksListNode = null;
        state.popup.intervalsSectionNode = null;
        state.popup.sessionsTitleNode = null;
        state.popup.intervalsListNode = null;
        state.popup.todaySessionsToggleNode = null;
        state.popup.todaySessionsExpanded = false;
        state.popup.historySectionNode = null;
        state.popup.historyTitleNode = null;
        state.popup.historyListNode = null;
        state.popup.historyToggleNode = null;
        state.popup.historyExpanded = false;
        state.popup.weeklySectionNode = null;
        state.popup.weeklySectionTitleNode = null;
        state.popup.weeklyDetailSwitchNode = null;
        state.popup.weeklyAverageLabelNode = null;
        state.popup.weeklyAverageValueNode = null;
        state.popup.weeklyBestDayLabelNode = null;
        state.popup.weeklyBestDayValueNode = null;
        state.popup.weeklyBarsNode = null;
        state.popup.weeklyCompareNode = null;
        state.popup.weeklyCompareTodayLabelNode = null;
        state.popup.weeklyCompareTodayValueNode = null;
        state.popup.weeklyCompareYesterdayLabelNode = null;
        state.popup.weeklyCompareYesterdayValueNode = null;
        state.popup.weeklyCompareDeltaLabelNode = null;
        state.popup.weeklyCompareDeltaValueNode = null;
        state.popup.lastHistorySignature = "";
        state.popup.lastIntervalsSignature = "";
        state.popup.lastTopTracksSignature = "";
        state.popup.lastWeeklySignature = "";
        state.popup.lastSummarySignature = "";
        state.popup.lastHeight = 0;
        state.popup.lastLanguage = null;
        state.popup.weeklyBarNodes = [];
        state.popup.languageButtons = [];
        state.popup.retentionLabelNode = null;
        state.popup.retentionSuffixNode = null;
        state.popup.settingsOpen = false;
        state.popup.settingsGearNode = null;
        state.popup.settingsBackNode = null;
        state.popup.settingsPanelNode = null;
        state.popup.settingsLangTitleNode = null;
        state.popup.settingsGoalTitleNode = null;
        state.popup.settingsGoalHintNode = null;
        state.popup.settingsGoalInputNode = null;
        state.popup.settingsGoalUnitNode = null;
        state.popup.settingsPopupModeTitleNode = null;
        state.popup.settingsPopupModeHintNode = null;
        state.popup.settingsPopupModeButtons = [];
        state.popup.settingsPerformanceModeTitleNode = null;
        state.popup.settingsPerformanceModeHintNode = null;
        state.popup.settingsPerformanceModeButtons = [];
        state.popup.settingsChannelTitleNode = null;
        state.popup.settingsChannelHintNode = null;
        state.popup.settingsChannelButtons = [];
        state.popup.settingsPauseThresholdTitleNode = null;
        state.popup.settingsPauseThresholdHintNode = null;
        state.popup.settingsPauseThresholdButtons = [];
        state.popup.settingsStreakShieldsTitleNode = null;
        state.popup.settingsStreakShieldsHintNode = null;
        state.popup.settingsKeepStreakTitleNode = null;
        state.popup.settingsKeepStreakHintNode = null;
        state.popup.settingsKeepStreakInputNode = null;
        state.popup.settingsKeepStreakPreviewNode = null;
        state.popup.settingsRetentionTitleNode = null;
        state.popup.settingsRetentionInputNode = null;
        state.popup.settingsRetentionForeverTitleNode = null;
        state.popup.settingsRetentionForeverHintNode = null;
        state.popup.settingsRetentionForeverInputNode = null;
        state.popup.settingsStreakProgressionTitleNode = null;
        state.popup.settingsStreakProgressionHintNode = null;
        state.popup.settingsStreakProgressionInputNode = null;
        state.popup.settingsStreakProgressionPreviewNode = null;
        state.popup.settingsBadgeRowNode = null;
        state.popup.settingsBadgeTitleNode = null;
        state.popup.settingsBadgeHintNode = null;
        state.popup.settingsBadgeInputNode = null;
        state.popup.settingsTopTracksTitleNode = null;
        state.popup.settingsTopTracksHintNode = null;
        state.popup.settingsTopTracksInputNode = null;
        state.popup.settingsTopTracksCountRowNode = null;
        state.popup.settingsTopTracksCountTitleNode = null;
        state.popup.settingsTopTracksCountButtons = [];
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
        state.popup.settingsVersionNode = null;
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
            if (state.ui.injectObserverTimeoutId !== null) {
                clearTimeout(state.ui.injectObserverTimeoutId);
            }
            state.ui.injectObserverTimeoutId = setTimeout(() => {
                state.ui.injectObserverTimeoutId = null;
                state.ui.pendingInjectCheck = false;

                if (!document.getElementById("dtt-widget") && !injectWidget()) {
                    scheduleInjectRetry();
                }
            }, isLightweightMode() ? 220 : 120);
        });

        observer.observe(document.body, { childList: true, subtree: true });
        state.runtime.injectObserver = observer;
    }

    function checkTrackChange() {
        try {
            const trackInfo = getCurrentTrackInfo();
            const uri = trackInfo?.uri || null;
            const progressMs = getCurrentTrackProgressMs();
            const lastUri = state.runtime._lastTrackUri;
            const lastProgressMs = state.runtime._lastTrackProgressMs;
            const sameTrackRestarted = Boolean(
                uri &&
                lastUri &&
                uri === lastUri &&
                Number.isFinite(progressMs) &&
                Number.isFinite(lastProgressMs) &&
                progressMs + 1500 < lastProgressMs
            );

            if (uri && lastUri && uri === lastUri && !sameTrackRestarted) {
                accumulateActiveTrackListen(progressMs);
            }

            if (uri && state.runtime._lastTrackUri && uri !== state.runtime._lastTrackUri) {
                if (state.currentSession) {
                    finalizeActiveTrackPlayInSession();
                    primeActiveTrackCycle(trackInfo, progressMs);
                }
                saveTodayData();
                if (!state.runtime._streakTestMode) {
                    computeStreak();
                    updatePopupFireIcon();
                }
            }
            if (sameTrackRestarted && state.currentSession) {
                finalizeActiveTrackPlayInSession();
                primeActiveTrackCycle(trackInfo, progressMs);
                saveTodayData();
            }
            if (!state.currentSession && uri) {
                state.runtime._lastTrackUri = uri;
                state.runtime._lastTrackProgressMs = progressMs;
                return;
            }
            state.runtime._lastTrackUri = uri;
            state.runtime._lastTrackProgressMs = progressMs;
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
            pauseCurrentSession(now);
            saveTodayData(now);
        }

        state.silenceSeconds = Math.floor((now - state.idleStartedAt) / 1000);

        if (state.silenceSeconds < state.pauseSeconds) {
            setWidgetPausedState(true);
            return;
        }

        setWidgetPausedState(true);
        closeSession(state.idleStartedAt);
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
        updateWidgetUI(totalSeconds);
        setWidgetPausedState(shouldWidgetBePaused(), true);
        if (!state.runtime._streakTestMode) {
            const thresholdMet = totalSeconds >= loadStreakThreshold();
            if (thresholdMet !== state.runtime._lastStreakThresholdMet) {
                state.runtime._lastStreakThresholdMet = thresholdMet;
                computeStreak();
            }
            if (state.popup.node) {
                updatePopupFireIcon();
            }
        }

        if (state.popup.node) {
            const dailySummaryRows = getDailySummaryRows(totalSeconds);
            if (state.popup.lastLanguage !== state.language) {
                updatePopupStaticTextV2();
            }
            const popupChanged = updatePopupDynamicContentV2({
                now,
                totalSeconds,
                todayIntervalRows: getTodayIntervalRows(now)
            });
            const historyChanged = updatePopupHistoryV2(dailySummaryRows);
            if (popupChanged || historyChanged) {
                schedulePopupPosition();
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
            schedulePopupPosition(true);
        }
        };

        state.ui.beforeUnloadHandler = () => {
            clearPopupHideTimeout();

            if (state.currentSession) {
                closeSession(state.idleStartedAt ?? Date.now());
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
        hideUpdateStatusToast();
        hideApiUnavailableModal();
        hideTestChannelWarningModal();
        hideStorageOptimizationModal();
        if (state.runtime.popupPositionFrameId !== null) {
            cancelAnimationFrame(state.runtime.popupPositionFrameId);
            state.runtime.popupPositionFrameId = null;
        }
        state.runtime.injectObserver?.disconnect?.();
        state.runtime.injectObserver = null;
        if (state.ui.injectObserverTimeoutId !== null) {
            clearTimeout(state.ui.injectObserverTimeoutId);
            state.ui.injectObserverTimeoutId = null;
        }
        if (state.runtime.injectRetryTimeoutId !== null) {
            clearTimeout(state.runtime.injectRetryTimeoutId);
            state.runtime.injectRetryTimeoutId = null;
        }
        if (state.runtime.devChannelRetryTimeoutId !== null) {
            clearTimeout(state.runtime.devChannelRetryTimeoutId);
            state.runtime.devChannelRetryTimeoutId = null;
        }
        if (state.popup.removeTimeoutId !== null) {
            clearTimeout(state.popup.removeTimeoutId);
            state.popup.removeTimeoutId = null;
        }
        state.popup.node = null;
        state.popup.hintNode = null;
        state.popup.titleNode = null;
        state.popup.badgeNode = null;
        state.popup.viewToggleNode = null;
        state.popup.summaryDateNode = null;
        state.popup.summaryTotalNode = null;
        state.popup.summaryGoalWrapNode = null;
        state.popup.summaryGoalLabelNode = null;
        state.popup.summaryGoalValueNode = null;
        state.popup.summaryGoalProgressNode = null;
        state.popup.summaryTopTracksWrapNode = null;
        state.popup.summaryTopTracksListNode = null;
        state.popup.intervalsSectionNode = null;
        state.popup.sessionsTitleNode = null;
        state.popup.intervalsListNode = null;
        state.popup.todaySessionsToggleNode = null;
        state.popup.todaySessionsExpanded = false;
        state.popup.historySectionNode = null;
        state.popup.historyTitleNode = null;
        state.popup.historyListNode = null;
        state.popup.historyToggleNode = null;
        state.popup.historyExpanded = false;
        state.popup.weeklySectionNode = null;
        state.popup.weeklySectionTitleNode = null;
        state.popup.weeklyDetailSwitchNode = null;
        state.popup.weeklyAverageLabelNode = null;
        state.popup.weeklyAverageValueNode = null;
        state.popup.weeklyBestDayLabelNode = null;
        state.popup.weeklyBestDayValueNode = null;
        state.popup.weeklyBarsNode = null;
        state.popup.weeklyCompareNode = null;
        state.popup.weeklyCompareTodayLabelNode = null;
        state.popup.weeklyCompareTodayValueNode = null;
        state.popup.weeklyCompareYesterdayLabelNode = null;
        state.popup.weeklyCompareYesterdayValueNode = null;
        state.popup.weeklyCompareDeltaLabelNode = null;
        state.popup.weeklyCompareDeltaValueNode = null;
        state.popup.lastHistorySignature = "";
        state.popup.lastIntervalsSignature = "";
        state.popup.lastTopTracksSignature = "";
        state.popup.lastWeeklySignature = "";
        state.popup.lastSummarySignature = "";
        state.popup.lastHeight = 0;
        state.popup.lastLanguage = null;
        state.popup.weeklyDetailMode = "summary";
        state.popup.weeklyBarNodes = [];
        state.popup.retentionLabelNode = null;
        state.popup.retentionSuffixNode = null;
        state.popup.settingsOpen = false;
        state.popup.settingsGearNode = null;
        state.popup.settingsBackNode = null;
        state.popup.settingsPanelNode = null;
        state.popup.settingsLangTitleNode = null;
        state.popup.settingsGoalTitleNode = null;
        state.popup.settingsGoalHintNode = null;
        state.popup.settingsGoalInputNode = null;
        state.popup.settingsGoalUnitNode = null;
        state.popup.settingsPopupModeTitleNode = null;
        state.popup.settingsPopupModeHintNode = null;
        state.popup.settingsPopupModeButtons = [];
        state.popup.settingsPerformanceModeTitleNode = null;
        state.popup.settingsPerformanceModeHintNode = null;
        state.popup.settingsPerformanceModeButtons = [];
        state.popup.settingsChannelTitleNode = null;
        state.popup.settingsChannelHintNode = null;
        state.popup.settingsChannelButtons = [];
        state.popup.settingsPauseThresholdTitleNode = null;
        state.popup.settingsPauseThresholdHintNode = null;
        state.popup.settingsPauseThresholdButtons = [];
        state.popup.settingsStreakShieldsTitleNode = null;
        state.popup.settingsStreakShieldsHintNode = null;
        state.popup.settingsKeepStreakTitleNode = null;
        state.popup.settingsKeepStreakHintNode = null;
        state.popup.settingsKeepStreakInputNode = null;
        state.popup.settingsKeepStreakPreviewNode = null;
        state.popup.settingsRetentionTitleNode = null;
        state.popup.settingsRetentionInputNode = null;
        state.popup.settingsRetentionForeverTitleNode = null;
        state.popup.settingsRetentionForeverHintNode = null;
        state.popup.settingsRetentionForeverInputNode = null;
        state.popup.settingsStreakProgressionTitleNode = null;
        state.popup.settingsStreakProgressionHintNode = null;
        state.popup.settingsStreakProgressionInputNode = null;
        state.popup.settingsStreakProgressionPreviewNode = null;
        state.popup.settingsBadgeRowNode = null;
        state.popup.settingsBadgeTitleNode = null;
        state.popup.settingsBadgeHintNode = null;
        state.popup.settingsBadgeInputNode = null;
        state.popup.settingsTopTracksTitleNode = null;
        state.popup.settingsTopTracksHintNode = null;
        state.popup.settingsTopTracksInputNode = null;
        state.popup.settingsTopTracksCountRowNode = null;
        state.popup.settingsTopTracksCountTitleNode = null;
        state.popup.settingsTopTracksCountButtons = [];
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
        state.popup.settingsVersionNode = null;
        state.popup.popupFireNode = null;
        state.popup.popupStreakCountNode = null;
        state.ui.goalNode = null;
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

    async function runStorageOptimization() {
        let optimizationOverlayShownAt = 0;
        try {
            const optimizationUrl = new URL(CONFIG.storageOptimizationUrl);
            optimizationUrl.search = `?v=${encodeURIComponent(VERSION)}`;

            const optimizationModule = await Promise.race([
                import(optimizationUrl.href),
                delay(4000).then(() => null)
            ]);
            if (!optimizationModule) {
                console.warn("[DailyTimeTracker] Storage optimization module load timed out. Continuing without optimization.");
                return;
            }
            const optimizationStatus = optimizationModule?.getDttStorageOptimizationStatus?.({
                localStorage: Spicetify.LocalStorage,
                keys: {
                    storageKey: CONFIG.storageKey,
                    historyKey: CONFIG.historyKey,
                    sessionsKey: CONFIG.sessionsKey,
                    retentionKey: CONFIG.retentionKey,
                    retentionForeverKey: CONFIG.retentionForeverKey
                },
                todayString: getTodayString(),
                defaultRetentionMonths: CONFIG.historyRetentionMonths,
                maxHistoryRetentionMonths: CONFIG.maxHistoryRetentionMonths
            });

            if (optimizationStatus?.needed) {
                showStorageOptimizationModal();
                optimizationOverlayShownAt = Date.now();
                await waitForNextPaint();
            }

            optimizationModule?.optimizeDttStorage?.({
                localStorage: Spicetify.LocalStorage,
                keys: {
                    storageKey: CONFIG.storageKey,
                    historyKey: CONFIG.historyKey,
                    sessionsKey: CONFIG.sessionsKey,
                    retentionKey: CONFIG.retentionKey,
                    retentionForeverKey: CONFIG.retentionForeverKey
                },
                todayString: getTodayString(),
                defaultRetentionMonths: CONFIG.historyRetentionMonths,
                maxHistoryRetentionMonths: CONFIG.maxHistoryRetentionMonths
            });
        } catch (error) {
            console.error("[DailyTimeTracker] Storage optimization failed.", error);
        }
        finally {
            if (optimizationOverlayShownAt) {
                const visibleMs = Date.now() - optimizationOverlayShownAt;
                if (visibleMs < 700) {
                    await delay(700 - visibleMs);
                }
                hideStorageOptimizationModal();
            }
        }
    }

    function getStorageOptimizationModalText() {
        return loadLanguage() === "en"
            ? {
                badge: "OPTIMIZATION",
                title: "Optimizing local data",
                subtitle: "A one-time storage upgrade is running. Today sessions are being separated and old history sessions are being removed."
            }
            : {
                badge: "Р С›Р СџР СћР ВР СљР ВР вЂ”Р С’Р В¦Р ВР Р‡",
                title: "Р ВР Т‘Р ВµРЎвЂљ Р С•Р С—РЎвЂљР С‘Р СР С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦",
                subtitle: "Р вЂ™РЎвЂ№Р С—Р С•Р В»Р Р…РЎРЏР ВµРЎвЂљРЎРѓРЎРЏ Р С•Р Т‘Р Р…Р С•РЎР‚Р В°Р В·Р С•Р Р†Р С•Р Вµ Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ РЎвЂ¦РЎР‚Р В°Р Р…Р С‘Р В»Р С‘РЎвЂ°Р В°. Р РЋР ВµРЎРѓРЎРѓР С‘Р С‘ Р В·Р В° РЎРѓР ВµР С–Р С•Р Т‘Р Р…РЎРЏ Р Р†РЎвЂ№Р Р…Р С•РЎРѓРЎРЏРЎвЂљРЎРѓРЎРЏ Р Р† Р С•РЎвЂљР Т‘Р ВµР В»РЎРЉР Р…РЎвЂ№Р в„– Р С”Р В»РЎР‹РЎвЂЎ, Р В° РЎРѓРЎвЂљР В°РЎР‚РЎвЂ№Р Вµ РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘ РЎС“Р Т‘Р В°Р В»РЎРЏРЎР‹РЎвЂљРЎРѓРЎРЏ Р С‘Р В· Р С‘РЎРѓРЎвЂљР С•РЎР‚Р С‘Р С‘."
            };
    }

    function showStorageOptimizationModal() {
        if (document.getElementById("dtt-storage-optimization-overlay")) {
            return;
        }

        const text = getStorageOptimizationModalText();
        const overlay = document.createElement("div");
        overlay.id = "dtt-storage-optimization-overlay";
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
        modal.style.cssText = `
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
            color: #fff;
        `;

        const badge = document.createElement("span");
        badge.className = "dtt-update-badge";
        badge.textContent = text.badge;
        badge.style.cssText = `
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
        `;

        const title = document.createElement("div");
        title.className = "dtt-update-title";
        title.textContent = text.title;
        title.style.cssText = `
            font-size: 17px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 8px;
            line-height: 1.3;
        `;

        const subtitle = document.createElement("div");
        subtitle.className = "dtt-update-subtitle";
        subtitle.textContent = text.subtitle;
        subtitle.style.cssText = `
            font-size: 13px;
            color: rgba(255, 255, 255, 0.55);
            line-height: 1.5;
        `;

        modal.append(badge, title, subtitle);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function hideStorageOptimizationModal() {
        document.getElementById("dtt-storage-optimization-overlay")?.remove();
    }

    function delay(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    function waitForNextPaint() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }
    }

    try {
        await DailyTimeTracker();
        console.log(`[DailyTimeTracker] Ready. Channel: ${runtimeConfig.channel}.`);
    } catch (error) {
        console.error(`[DailyTimeTracker] Bootstrap failed. Channel: ${runtimeConfig.channel}.`, error);
        throw error;
    }
}

