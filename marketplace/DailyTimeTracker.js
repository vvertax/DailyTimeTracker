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

    // Self-contained update-style modal. The hosted runtime (and its CSS) failed
    // to load here, so every style is inlined to mirror the in-app update modal.
    const diagnoseLoadFailure = async (url, importError) => {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
        try {
            const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller?.signal });
            if (timeoutId !== null) clearTimeout(timeoutId);
            if (!response.ok) {
                return `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
            }
            // Server is reachable, so the failure came from the import/parse step itself.
            return (importError && importError.message) || `HTTP ${response.status}`;
        } catch (fetchError) {
            if (timeoutId !== null) clearTimeout(timeoutId);
            if (fetchError && fetchError.name === "AbortError") return "ERR_TIMED_OUT";
            return (fetchError && fetchError.message) || (importError && importError.message) || "Network error";
        }
    };

    const showLoadError = async (url, importError) => {
        if (document.getElementById("dtt-load-error-overlay")) return;

        const reason = await diagnoseLoadFailure(url, importError);
        if (document.getElementById("dtt-load-error-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "dtt-load-error-overlay";
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100000;
            background: rgba(0, 0, 0, 0.65);
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
        `;

        const modal = document.createElement("div");
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
            font-family: "Spotify Mix", "SpotifyMixUI", sans-serif;
            color: #fff;
        `;

        const close = () => overlay.remove();

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.innerHTML = "&#x2715;";
        closeBtn.title = "Close";
        closeBtn.style.cssText = `
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
        `;
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            close();
        });

        const badge = document.createElement("span");
        badge.textContent = "ERROR";
        badge.style.cssText = `
            display: inline-block;
            padding: 4px 14px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #ff5a5f;
            border: 1px solid rgba(255, 90, 95, 0.45);
            background: rgba(255, 90, 95, 0.12);
            margin-bottom: 16px;
        `;

        const title = document.createElement("div");
        title.textContent = "Daily Time Tracker failed to load";
        title.style.cssText = `
            font-size: 17px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 8px;
            line-height: 1.3;
        `;

        const subtitle = document.createElement("div");
        subtitle.textContent = "The hosted runtime could not be loaded. Check your internet connection and reload Spotify — the script will try again on the next launch.";
        subtitle.style.cssText = `
            font-size: 13px;
            color: rgba(255, 255, 255, 0.55);
            margin-bottom: 20px;
            line-height: 1.5;
        `;

        const reasonBlock = document.createElement("div");
        reasonBlock.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            background: rgba(255, 90, 95, 0.08);
            border: 1px solid rgba(255, 90, 95, 0.25);
            border-radius: 10px;
            padding: 14px 20px;
            margin-bottom: 22px;
        `;

        const reasonLabel = document.createElement("span");
        reasonLabel.textContent = "REASON";
        reasonLabel.style.cssText = `
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.4);
        `;

        const reasonValue = document.createElement("span");
        reasonValue.textContent = reason;
        reasonValue.style.cssText = `
            font-size: 16px;
            font-weight: 700;
            color: #ff5a5f;
            letter-spacing: 0.03em;
            font-family: "SF Mono", "Roboto Mono", Menlo, Consolas, monospace;
            word-break: break-word;
        `;

        reasonBlock.append(reasonLabel, reasonValue);

        const buttons = document.createElement("div");
        buttons.style.cssText = "display: flex; gap: 10px;";

        const reloadBtn = document.createElement("button");
        reloadBtn.type = "button";
        reloadBtn.textContent = "Reload";
        reloadBtn.style.cssText = `
            flex: 1;
            padding: 12px 16px;
            border-radius: 999px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            background: #fff;
            color: #000;
            font-family: inherit;
        `;
        reloadBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.location.reload();
        });

        const dismissBtn = document.createElement("button");
        dismissBtn.type = "button";
        dismissBtn.textContent = "Close";
        dismissBtn.style.cssText = `
            flex: 1;
            padding: 12px 16px;
            border-radius: 999px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            font-family: inherit;
        `;
        dismissBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            close();
        });

        buttons.append(reloadBtn, dismissBtn);
        modal.append(closeBtn, badge, title, subtitle, reasonBlock, buttons);
        overlay.appendChild(modal);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close();
        });

        document.body.appendChild(overlay);
    };

    // Returns null on success, or the thrown error on failure.
    const importRuntime = async (channelConfig) => {
        try {
            await import(channelConfig.runtimeUrl);
            return null;
        } catch (error) {
            console.error(`${LOG_PREFIX} ${channelConfig.name} runtime import failed.`, error);
            return error || new Error("Unknown import error");
        }
    };

    // Runtime import and fallback
    const importReleaseRuntime = async () => {
        const error = await importRuntime(releaseChannelConfig);
        if (error) showLoadError(releaseChannelConfig.runtimeUrl, error);
        return !error;
    };
    const importSelectedRuntimeWithFallback = async () => {
        const error = await importRuntime(selectedChannelConfig);
        if (!error) return;

        if (selectedChannel === "release") {
            showLoadError(selectedChannelConfig.runtimeUrl, error);
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
