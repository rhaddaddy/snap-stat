/* ============ Boot ============ */
window.addEventListener("pagehide", () => { if (dirty) flushState(); if (dirtyWeeks.size) flushWeeks(); if (notifyPrefs().on) saveNotifyState(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "hidden") return; if (dirty) { clearTimeout(saveTimer); flushState(); } if (dirtyWeeks.size) { clearTimeout(weekTimer); flushWeeks(); } });
if (location.hash.slice(1)) route(); else render();
initCaps();
loadCardData();
loadSchedule();
loadHistory();
loadVariantDetails(); loadBorders(); PROMOS.load(); ART.load(); FACES.load(); WEBSHOP.load();
if (NATIVE) whenDataReady(() => setTimeout(pushWidget, 2000));
loadAlbums();
loadPacks();
setupAI();
registerSW().then(() => { if (notifyPrefs().on) setTimeout(() => { saveNotifyState().then(checkNotificationsNow); }, 4000); });
