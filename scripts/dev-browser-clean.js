// TeamBrain — full browser reset for local dev. Paste into DevTools Console (F12).

// Unregister all service workers
navigator.serviceWorker.getRegistrations().then((regs) =>
  regs.forEach((reg) => reg.unregister()),
);

// Clear all caches
caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));

// Clear IndexedDB
indexedDB.databases().then((dbs) =>
  dbs.forEach((db) => {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }),
);

// Clear local/session storage
localStorage.clear();
sessionStorage.clear();

// Reload
setTimeout(() => location.reload(), 500);
