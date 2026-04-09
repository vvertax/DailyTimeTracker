(function DailyTimeTracker() {
    if (!Spicetify?.Player) {
        setTimeout(DailyTimeTracker, 500);
        return;
    }
    import("https://vvertax.site/dtt/ext/main.mjs?" + Date.now()).catch(() => {});
})();