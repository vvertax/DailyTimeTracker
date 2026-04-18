import { startDailyTimeTracker } from "./core.mjs";

startDailyTimeTracker({
    channel: "release",
    version: "2.0.0",
    versionCheckUrl: "https://vvertax.site/dtt/ext/version.json",
    storageOptimizationUrl: "https://vvertax.site/dtt/ext/dtt_optimization.mjs"
}).catch(() => {});
