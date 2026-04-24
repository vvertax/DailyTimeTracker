(function bootDailyTimeTracker() {
    if (!Spicetify?.Player || !Spicetify?.LocalStorage) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    const channelKey = "dtt_channel_v1";
    const cacheBust = Date.now();
    const devChannelCheckTimeoutMs = 12000;
    const devChannelCheckRetryCount = 3;
    const devChannelCheckRetryDelayMs = 1500;
    const releaseUrl = `https://vvertax.site/dtt/ext/main.mjs?v=${cacheBust}`;
    const channels = {
        release: releaseUrl,
        test: `https://vvertax.site/dtt/ext/test/main.mjs?v=${cacheBust}`,
        dev: `https://vvertax.site/dtt/ext/dev/main.mjs?v=${cacheBust}`
    };
    const savedChannel = Spicetify.LocalStorage.get(channelKey);
    const selectedChannel = savedChannel === "test" || savedChannel === "dev" ? savedChannel : "release";

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

    const importRelease = () => import(releaseUrl).catch((error) => {
        console.error("[DailyTimeTracker] Failed to import release runtime.", error);
    });
    const retryBoot = () => setTimeout(bootDailyTimeTracker, 1000);
    const resetToRelease = () => {
        try {
            Spicetify.LocalStorage.set(channelKey, "release");
        } catch (_) {}
    };
    const importChannel = () => {
        import(channels[selectedChannel]).catch((error) => {
            console.error(`[DailyTimeTracker] Failed to import ${selectedChannel} runtime. Falling back to release.`, error);
            if (selectedChannel === "release") {
                return;
            }

            resetToRelease();
            importRelease();
        });
    };

    if (selectedChannel !== "dev") {
        return importChannel();
    }

    if (!Spicetify?.Platform) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    const uid = resolvePlatformUsername();
    if (!uid) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const checkDevChannelAccess = async () => {
        for (let attempt = 1; attempt <= devChannelCheckRetryCount; attempt += 1) {
            const controller = typeof AbortController === "function" ? new AbortController() : null;
            const timeoutId = controller
                ? setTimeout(() => controller.abort(), devChannelCheckTimeoutMs)
                : null;

            try {
                const response = await fetch(
                    `https://vvertax.site/dtt/api/dev_channel.php?uid=${encodeURIComponent(uid)}&t=${cacheBust}&attempt=${attempt}`,
                    { signal: controller?.signal }
                );
                const payload = response.ok ? await response.json() : null;
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }

                if (payload?.allowed === true) {
                    return true;
                }

                if (payload?.allowed === false) {
                    return false;
                }
            } catch (error) {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }
                console.error(
                    `[DailyTimeTracker] Dev channel access check attempt ${attempt}/${devChannelCheckRetryCount} failed.`,
                    error
                );
            }

            if (attempt < devChannelCheckRetryCount) {
                await delay(devChannelCheckRetryDelayMs);
            }
        }

        return null;
    };

    checkDevChannelAccess()
        .then((allowed) => {
            if (allowed === true) {
                return importChannel();
            }

            if (allowed === false) {
                resetToRelease();
                return importRelease();
            }

            console.error("[DailyTimeTracker] Dev channel access check timed out after multiple attempts. Using release for this launch without resetting the saved channel.");
            return importRelease();
        })
        .catch((error) => {
            console.error("[DailyTimeTracker] Unexpected dev channel access check failure. Using release for this launch without resetting the saved channel.", error);
            importRelease();
        });
})();
