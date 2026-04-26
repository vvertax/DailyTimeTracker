// Release channel wrapper entry.
const coreUrl = new URL("./core.mjs", import.meta.url);
coreUrl.search = new URL(import.meta.url).search || `?v=${Date.now()}`;

// Import the neutral runtime module for this channel wrapper.
import(coreUrl.href)
    .then(({ startDailyTimeTracker }) => {
        // Hand off release-specific metadata and endpoints to the shared runtime.
        return startDailyTimeTracker({
            channel: "release",
            version: "2.2.0",
            versionCheckUrl: "https://vvertax.site/dtt/ext/version.json",
            storageOptimizationUrl: "https://vvertax.site/dtt/ext/dtt_optimization.mjs",
            badgeApiBaseUrl: "https://vvertax.site/dtt/api/badge.php",
            devChannelApiBaseUrl: "https://vvertax.site/dtt/api/dev_channel.php"
        });
    })
    .catch((error) => {
        console.error("[DailyTimeTracker] Release startup failed.", error);
    });
