// TeamBrain — paste into DevTools Console (F12) on http://localhost:3010
// Unregisters service workers, clears caches, reloads.

(async () => {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      await reg.unregister();
      console.log("Unregistered SW:", reg.scope);
    }
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    for (const key of keys) {
      await caches.delete(key);
      console.log("Deleted cache:", key);
    }
  }
  console.log("Done — reloading…");
  location.reload();
})();
