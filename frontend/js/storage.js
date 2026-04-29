const Storage = (() => {
  const KEY = "sbim_backup_v1";
  const PROFIT_KEY = "sbim_profit_v1";

  function saveBackup(payload) {
    const doc = {
      savedAt: new Date().toISOString(),
      payload,
    };
    localStorage.setItem(KEY, JSON.stringify(doc));
  }

  function loadBackup() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setProfit(value) {
    localStorage.setItem(PROFIT_KEY, String(Number(value || 0)));
  }

  function getProfit() {
    const v = Number(localStorage.getItem(PROFIT_KEY) || "0");
    return Number.isFinite(v) ? v : 0;
  }

  return { saveBackup, loadBackup, setProfit, getProfit };
})();

