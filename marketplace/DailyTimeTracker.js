(function bootDailyTimeTracker() {
    if (!Spicetify?.Player || !Spicetify?.LocalStorage) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    const channelKey = "dtt_channel_v1";
    const cacheBust = Date.now();
    const releaseUrl = `https://vvertax.site/dtt/ext/main.mjs?v=${cacheBust}`;
    const channels = {
        release: releaseUrl,
        test: `https://vvertax.site/dtt/ext/test/main.mjs?v=${cacheBust}`,
        dev: `https://vvertax.site/dtt/ext/dev/main.mjs?v=${cacheBust}`
    };
    const savedChannel = Spicetify.LocalStorage.get(channelKey);
    const selectedChannel = savedChannel === "test" || savedChannel === "dev" ? savedChannel : "release";

    const importRelease = () => import(releaseUrl).catch(() => {});
    const retryBoot = () => setTimeout(bootDailyTimeTracker, 1000);
    const resetToRelease = () => {
        try {
            Spicetify.LocalStorage.set(channelKey, "release");
        } catch (_) {}
    };
    const importChannel = () => {
        import(channels[selectedChannel]).catch(() => {
            if (selectedChannel === "release") {
                return;
            }

            if (selectedChannel === "dev") {
                return retryBoot();
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

    const uid = Spicetify.Platform?.username;
    if (!uid) {
        return setTimeout(bootDailyTimeTracker, 500);
    }

    fetch(`https://vvertax.site/dtt/api/dev_channel.php?uid=${encodeURIComponent(uid)}&t=${cacheBust}`)
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
            if (payload?.allowed) {
                return importChannel();
            }

            resetToRelease();
            return importRelease();
        })
        .catch(() => {
            retryBoot();
        });
})();
