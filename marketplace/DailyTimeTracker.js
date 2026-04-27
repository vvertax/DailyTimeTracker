(function bootDailyTimeTracker() {
    const LOG_PREFIX = "[DailyTimeTracker]";

    // Bootstrap / dependencies
    if (!Spicetify?.Player || !Spicetify?.LocalStorage) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    const CHANNEL_KEY = "dtt_channel_v1";
    const cacheBust = Date.now();
    const devChannelCheckTimeoutMs = 12000;
    const devChannelCheckRetryCount = 3;
    const devChannelCheckRetryDelayMs = 1500;
    const apiBaseUrl = "https://vvertax.site/dtt/api";
    const runtimeBaseUrl = "https://vvertax.site/dtt/ext";
    const runtimeSearch = `?v=${cacheBust}`;

    const channelConfigs = {
        release: {
            name: "release",
            runtimeUrl: `${runtimeBaseUrl}/main.mjs${runtimeSearch}`
        },
        test: {
            name: "test",
            runtimeUrl: `${runtimeBaseUrl}/test/main.mjs${runtimeSearch}`
        },
        dev: {
            name: "dev",
            runtimeUrl: `${runtimeBaseUrl}/dev/main.mjs${runtimeSearch}`
        }
    };

    const isKnownChannel = (value) => value === "test" || value === "dev" || value === "release";
    const getSavedChannel = () => {
        const savedChannel = Spicetify.LocalStorage.get(CHANNEL_KEY);
        return isKnownChannel(savedChannel) ? savedChannel : "release";
    };
    const saveChannel = (channel) => {
        try {
            Spicetify.LocalStorage.set(CHANNEL_KEY, isKnownChannel(channel) ? channel : "release");
        } catch (_) {}
    };

    const selectedChannel = getSavedChannel();
    const selectedChannelConfig = channelConfigs[selectedChannel];
    const releaseChannelConfig = channelConfigs.release;

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Channel selection
    const resolvePlatformUsername = () => {
        const candidates = [
            Spicetify.Platform?.username,
            Spicetify.Platform?.Session?.username,
            Spicetify.Platform?.Session?.user?.username,
            Spicetify.Platform?.Session?.entity?.username,
            Spicetify.Platform?.PlatformData?.username,
            Spicetify.Platform?.PlatformData?.user?.username,
            Spicetify.Platform?.PlatformData?.clientUsername,
            Spicetify.Platform?.PlatformData?.client_username,
            Spicetify.Platform?.SessionInfo?.username,
            Spicetify.Platform?.SessionInfo?.user?.username
        ];

        for (const value of candidates) {
            if (typeof value === "string" && value.trim()) {
                return value.trim();
            }
        }

        return "";
    };

    const importRuntime = async (channelConfig) => {
        try {
            await import(channelConfig.runtimeUrl);
            return true;
        } catch (error) {
            console.error(`${LOG_PREFIX} ${channelConfig.name} runtime import failed.`, error);
            return false;
        }
    };

    // Runtime import and fallback
    const importReleaseRuntime = async () => importRuntime(releaseChannelConfig);
    const importSelectedRuntimeWithFallback = async () => {
        const imported = await importRuntime(selectedChannelConfig);
        if (imported || selectedChannel === "release") {
            return;
        }

        // Test/dev runtime import failure is considered unsafe for the saved channel.
        saveChannel("release");
        console.error(`${LOG_PREFIX} ${selectedChannel} runtime import failed. Falling back to release and resetting the saved channel.`);
        await importReleaseRuntime();
    };

    if (selectedChannel !== "dev") {
        void importSelectedRuntimeWithFallback();
        return;
    }

    // Dev channel gate
    if (!Spicetify?.Platform) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    const uid = resolvePlatformUsername();
    if (!uid) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    const fetchDevChannelAccess = async (attempt) => {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeoutId = controller
            ? setTimeout(() => controller.abort(), devChannelCheckTimeoutMs)
            : null;

        try {
            const response = await fetch(
                `${apiBaseUrl}/dev_channel.php?uid=${encodeURIComponent(uid)}&t=${cacheBust}&attempt=${attempt}`,
                { signal: controller?.signal }
            );
            return response.ok ? await response.json() : null;
        } finally {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        }
    };

    const resolveDevChannelAccess = async () => {
        for (let attempt = 1; attempt <= devChannelCheckRetryCount; attempt += 1) {
            try {
                const payload = await fetchDevChannelAccess(attempt);
                if (payload?.allowed === true) {
                    return { status: "allowed" };
                }

                if (payload?.allowed === false) {
                    return { status: "denied" };
                }
            } catch (error) {
                console.error(
                    `${LOG_PREFIX} dev channel access check attempt ${attempt}/${devChannelCheckRetryCount} failed.`,
                    error
                );
            }

            if (attempt < devChannelCheckRetryCount) {
                await delay(devChannelCheckRetryDelayMs);
            }
        }

        return { status: "temporary_failure" };
    };

    void resolveDevChannelAccess()
        .then(async ({ status }) => {
            if (status === "allowed") {
                await importSelectedRuntimeWithFallback();
                return;
            }

            if (status === "denied") {
                // Saved channel is reset only when the API explicitly denies dev access.
                saveChannel("release");
                console.error(`${LOG_PREFIX} dev channel access denied. Falling back to release and resetting the saved channel.`);
                await importReleaseRuntime();
                return;
            }

            console.error(`${LOG_PREFIX} dev channel access timed out or failed temporarily. Using release for this launch without resetting the saved channel.`);
            await importReleaseRuntime();
        })
        .catch(async (error) => {
            console.error(`${LOG_PREFIX} unexpected dev channel gate failure. Using release for this launch without resetting the saved channel.`, error);
            await importReleaseRuntime();
        });
})();
