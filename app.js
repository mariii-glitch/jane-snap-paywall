const DEFAULT_CONFIG = Object.freeze({
  displayName: "Jane",
  handle: "@jane.private",
  snap: "jane.onlyvip",
  photos: 3,
  videos: 4,
  price: "CHF 8.-",
  oldPrice: "CHF 29.-",
  unlockUrl: "https://buy.stripe.com/dRm28t8i1aoU62E3gaasg03",
  offerDurationMs: 3 * 60 * 1000,
  lockDurationMs: 3 * 60 * 1000,
  timerEpochMs: Date.UTC(2026, 6, 15, 0, 0, 0),
  openSlots: 13,
  totalSlots: 30,
  manualLock: false,
});

const CONFIG = { ...DEFAULT_CONFIG };
const CAMPAIGN_PARAM = "cfg";
const ADMIN_STORAGE_KEY = "janeTimerAdminRules";
const ADMIN_PASSWORD = "123s";
const TELEGRAM_WAITLIST_URL = "https://t.me/+df8nvcSFeAM0MDBk";

const CANONICAL_RENDER_HOST = "jane-snap-private-story.onrender.com";

if (
  window.location.hostname.endsWith(".onrender.com") &&
  window.location.hostname.startsWith("jane-snap-") &&
  window.location.hostname !== CANONICAL_RENDER_HOST
) {
  window.location.replace(`https://${CANONICAL_RENDER_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`);
}

const fields = document.querySelectorAll("[data-field]");
const payTargets = document.querySelectorAll("[data-paylink]");
const toast = document.querySelector("[data-toast]");
const countdown = document.querySelector("[data-countdown]");
const slots = document.querySelector("[data-slots]");
const totalSlots = document.querySelector("[data-total-slots]");
const slotBar = document.querySelector("[data-slot-bar]");
const offerLabel = document.querySelector("[data-offer-label]");
const offerStatus = document.querySelector("[data-offer-status]");
const ctaLabel = document.querySelector("[data-cta-label]");
const waitlist = document.querySelector("[data-waitlist]");
const waitlistLink = document.querySelector("[data-waitlist-link]");
const adminGate = document.querySelector("[data-admin-gate]");
const adminGateForm = document.querySelector("[data-admin-gate-form]");
const adminGateClose = document.querySelector("[data-admin-gate-close]");
const adminGateSubmit = document.querySelector("[data-admin-gate-submit]");
const adminPasswordInput = document.querySelector("[data-admin-password]");
const adminGateStatus = document.querySelector("[data-admin-gate-status]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminForm = document.querySelector("[data-admin-form]");
const adminClose = document.querySelector("[data-admin-close]");
const adminNow = document.querySelector("[data-admin-now]");
const adminUnlockNow = document.querySelector("[data-admin-unlock-now]");
const adminLockNow = document.querySelector("[data-admin-lock-now]");
const adminHoldLock = document.querySelector("[data-admin-hold-lock]");
const adminCopy = document.querySelector("[data-admin-copy]");
const adminReset = document.querySelector("[data-admin-reset]");
const adminLinkOutput = document.querySelector("[data-admin-link]");
const adminStatus = document.querySelector("[data-admin-status]");
const adminModeStatus = document.querySelector("[data-admin-mode-status]");
const adminInputs = {
  offerMinutes: document.querySelector('[data-admin-input="offerMinutes"]'),
  lockMinutes: document.querySelector('[data-admin-input="lockMinutes"]'),
  openSlots: document.querySelector('[data-admin-input="openSlots"]'),
  totalSlots: document.querySelector('[data-admin-input="totalSlots"]'),
  timerEpoch: document.querySelector('[data-admin-input="timerEpoch"]'),
};
const normalizedPath = window.location.pathname.replace(/\/+$/, "");
const isAdminMode =
  new URLSearchParams(window.location.search).get("admin") === "timer" ||
  normalizedPath.endsWith("/admin") ||
  normalizedPath.endsWith("/admin.html");

let toastTimer;
let isLocked = false;
let adminPanelReady = false;

function setText(key, value) {
  fields.forEach((field) => {
    if (field.dataset.field === key) {
      field.textContent = value;
    }
  });
}

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3600);
}

function isConfiguredUnlockUrl(url) {
  return /^https:\/\/buy\.stripe\.com\/.+/i.test(url);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value, min, max) {
  return Math.round(clampNumber(value, min, max));
}

function normalizeTimerRules(rawRules) {
  if (!rawRules || typeof rawRules !== "object") return null;

  const offerDurationMs = clampNumber(Number(rawRules.offerDurationMs), 30 * 1000, 60 * 60 * 1000);
  const lockDurationMs = clampNumber(Number(rawRules.lockDurationMs), 30 * 1000, 60 * 60 * 1000);
  const totalSlots = clampInteger(Number(rawRules.totalSlots), 1, 999);
  const openSlots = clampInteger(Number(rawRules.openSlots), 1, totalSlots);
  const timerEpochMs = Number(rawRules.timerEpochMs);
  const manualLock = rawRules.manualLock === true;

  if (![offerDurationMs, lockDurationMs, totalSlots, openSlots, timerEpochMs].every(Number.isFinite)) {
    return null;
  }

  return {
    offerDurationMs,
    lockDurationMs,
    timerEpochMs,
    openSlots,
    totalSlots,
    manualLock,
  };
}

function encodeTimerRules(rules) {
  return window
    .btoa(JSON.stringify(rules))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeTimerRules(value) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return normalizeTimerRules(JSON.parse(window.atob(padded)));
  } catch {
    return null;
  }
}

function readCampaignRules() {
  const encoded = new URLSearchParams(window.location.search).get(CAMPAIGN_PARAM);
  return encoded ? decodeTimerRules(encoded) : null;
}

function readStoredAdminRules() {
  try {
    return normalizeTimerRules(JSON.parse(window.localStorage.getItem(ADMIN_STORAGE_KEY)));
  } catch {
    return null;
  }
}

function storeAdminRules(rules) {
  try {
    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    return false;
  }

  return true;
}

function getCurrentTimerRules() {
  return {
    offerDurationMs: CONFIG.offerDurationMs,
    lockDurationMs: CONFIG.lockDurationMs,
    timerEpochMs: CONFIG.timerEpochMs,
    openSlots: CONFIG.openSlots,
    totalSlots: CONFIG.totalSlots,
    manualLock: CONFIG.manualLock,
  };
}

function toMinutes(ms) {
  return Number((ms / 60000).toFixed(2));
}

function toLocalDateTimeValue(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readAdminFormRules(overrides = {}) {
  const timerEpoch = new Date(adminInputs.timerEpoch?.value || "").getTime();
  return normalizeTimerRules({
    offerDurationMs: Number(adminInputs.offerMinutes?.value) * 60 * 1000,
    lockDurationMs: Number(adminInputs.lockMinutes?.value) * 60 * 1000,
    timerEpochMs: timerEpoch,
    openSlots: Number(adminInputs.openSlots?.value),
    totalSlots: Number(adminInputs.totalSlots?.value),
    manualLock: CONFIG.manualLock,
    ...overrides,
  });
}

function buildCampaignUrl(rules) {
  const url = new URL(`https://${CANONICAL_RENDER_HOST}/`);
  url.searchParams.set(CAMPAIGN_PARAM, encodeTimerRules(rules));
  return url.toString();
}

function setAdminStatus(message) {
  if (adminStatus) {
    adminStatus.textContent = message;
  }
}

function updateGeneratedLink() {
  if (!adminLinkOutput) return;

  const rules = readAdminFormRules() || getCurrentTimerRules();
  adminLinkOutput.value = buildCampaignUrl(rules);
}

function updateAdminForm() {
  if (!adminForm) return;

  adminInputs.offerMinutes.value = toMinutes(CONFIG.offerDurationMs);
  adminInputs.lockMinutes.value = toMinutes(CONFIG.lockDurationMs);
  adminInputs.openSlots.value = CONFIG.openSlots;
  adminInputs.totalSlots.value = CONFIG.totalSlots;
  adminInputs.timerEpoch.value = toLocalDateTimeValue(CONFIG.timerEpochMs);
  updateAdminModeStatus();
  updateGeneratedLink();
}

function updateAdminModeStatus() {
  if (!adminModeStatus) return;

  adminModeStatus.textContent = CONFIG.manualLock
    ? "Dauerhaft gesperrt: bleibt zu, bis du wieder einschaltest."
    : "Automatik aktiv: Timer öffnet und sperrt im Loop.";
  adminModeStatus.classList.toggle("is-manual-lock", CONFIG.manualLock);
}

function applyTimerRules(rules) {
  const normalizedRules = normalizeTimerRules(rules);
  if (!normalizedRules) return false;

  Object.assign(CONFIG, normalizedRules);
  updateOfferState();
  updateAdminForm();
  return true;
}

function applyAndStoreTimerRules(rules, message) {
  if (!applyTimerRules(rules)) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return false;
  }

  storeAdminRules(getCurrentTimerRules());
  setAdminStatus(message);
  return true;
}

function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(value);
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

function openAdminPanel(message = "Timer Admin geöffnet.") {
  if (!adminPanel) return;

  const storedRules = readStoredAdminRules();
  if (storedRules) {
    applyTimerRules(storedRules);
  }

  adminPanel.hidden = false;
  if (adminGate) {
    adminGate.hidden = true;
  }
  updateAdminForm();
  setAdminStatus(message);
}

function setAdminGateStatus(message) {
  if (adminGateStatus) {
    adminGateStatus.textContent = message;
  }
}

function openAdminGate() {
  if (!adminGate) return;

  adminGate.hidden = false;
  setAdminGateStatus("Passwort eingeben.");

  if (adminPasswordInput) {
    adminPasswordInput.value = "";
    window.setTimeout(() => adminPasswordInput.focus(), 50);
  }
}

function closeAdminGate() {
  if (adminGate) {
    adminGate.hidden = true;
  }
}

function submitAdminPassword(event) {
  event.preventDefault();

  const password = adminPasswordInput?.value || "";

  if (password.trim().toLowerCase() === ADMIN_PASSWORD) {
    openAdminPanel("Admin geöffnet. Du kannst jetzt Status, Timer und Link steuern.");
    return;
  }

  setAdminGateStatus("Falsches Passwort.");
  adminPasswordInput?.select();
}

function setTimerWindow(active) {
  const rules = readAdminFormRules() || getCurrentTimerRules();
  const timerEpochMs = Date.now() - (active ? 0 : rules.offerDurationMs);
  const nextRules = normalizeTimerRules({ ...rules, timerEpochMs, manualLock: false });

  if (!nextRules) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return;
  }

  applyAndStoreTimerRules(
    nextRules,
    active
      ? "Wieder eingeschaltet. Das offene Fenster läuft ab jetzt weiter."
      : "Kurz gesperrt. Das geschlossene Fenster läuft ab jetzt weiter."
  );
}

function setManualLock(enabled) {
  const rules = readAdminFormRules() || getCurrentTimerRules();
  const timerEpochMs = Date.now() - (enabled ? rules.offerDurationMs : 0);
  const nextRules = normalizeTimerRules({ ...rules, timerEpochMs, manualLock: enabled });

  if (!nextRules) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return;
  }

  applyAndStoreTimerRules(
    nextRules,
    enabled
      ? "Dauerhaft gesperrt. Bleibt zu, bis du wieder einschaltest."
      : "Wieder eingeschaltet. Das offene Fenster läuft ab jetzt weiter."
  );
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function getOfferState() {
  if (CONFIG.manualLock) {
    return {
      active: false,
      manualLock: true,
      remaining: 0,
      remainingSlots: 0,
      slotRatio: 0,
    };
  }

  const cycleLength = CONFIG.offerDurationMs + CONFIG.lockDurationMs;
  const elapsed = ((Date.now() - CONFIG.timerEpochMs) % cycleLength + cycleLength) % cycleLength;
  const active = elapsed < CONFIG.offerDurationMs;
  const remaining = active ? CONFIG.offerDurationMs - elapsed : cycleLength - elapsed;
  const slotRatio = active ? remaining / CONFIG.offerDurationMs : 0;
  const remainingSlots = active ? Math.max(1, Math.ceil(CONFIG.openSlots * slotRatio)) : 0;

  return { active, manualLock: false, remaining, remainingSlots, slotRatio };
}

function updateOfferState() {
  const state = getOfferState();
  isLocked = !state.active;

  document.body.classList.toggle("is-offer-locked", isLocked);
  document.body.classList.toggle("is-manual-lock", state.manualLock);
  slots.textContent = state.remainingSlots;
  totalSlots.textContent = CONFIG.totalSlots;
  slotBar.style.width = `${Math.max(0, Math.min(1, state.slotRatio)) * 100}%`;
  if (waitlist) {
    waitlist.hidden = !isLocked;
  }

  if (state.active) {
    offerLabel.textContent = "Angebot aktiv";
    countdown.textContent = formatTime(state.remaining);
    offerStatus.textContent = "Nur jetzt offen";
    ctaLabel.textContent = "Jetzt freischalten";
    return;
  }

  offerLabel.textContent = state.manualLock ? "Geschlossen" : "Zu spät";
  countdown.textContent = state.manualLock ? "Gesperrt" : "Verpasst";
  offerStatus.textContent = state.manualLock ? "Neue Plätze per Telegram" : "Alle Plätze gerade belegt";
  ctaLabel.textContent = state.manualLock ? "Geschlossen" : "Verpasst";
}

function finishBoot() {
  document.body.classList.remove("is-booting");
}

function goToUnlock() {
  if (isLocked) {
    showToast("Gerade geschlossen. Tritt Telegram bei und erfahre neue Plätze zuerst.");
    return;
  }

  if (isConfiguredUnlockUrl(CONFIG.unlockUrl)) {
    window.location.href = CONFIG.unlockUrl;
    return;
  }

  showToast("Unlock-Link noch in app.js eintragen. Danach führt jeder gesperrte Bereich direkt weiter.");
}

function setupAdminPanel() {
  if (!adminPanel || adminPanelReady) return;

  adminPanelReady = true;
  updateAdminForm();

  adminForm?.addEventListener("input", updateGeneratedLink);

  adminForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const rules = readAdminFormRules();
    if (!rules) {
      setAdminStatus("Bitte gültige Werte eintragen.");
      return;
    }

    applyTimerRules(rules);
    storeAdminRules(rules);
    setAdminStatus("Vorschau gespeichert. Der Link unten enthält diese Regeln.");
  });

  adminNow?.addEventListener("click", () => {
    if (adminInputs.timerEpoch) {
      adminInputs.timerEpoch.value = toLocalDateTimeValue(Date.now());
      updateGeneratedLink();
      setAdminStatus("Zyklus startet ab jetzt. Danach Vorschau anwenden oder Link kopieren.");
    }
  });

  adminUnlockNow?.addEventListener("click", () => {
    setManualLock(false);
  });

  adminLockNow?.addEventListener("click", () => {
    setTimerWindow(false);
  });

  adminHoldLock?.addEventListener("click", () => {
    setManualLock(true);
  });

  adminCopy?.addEventListener("click", () => {
    const rules = readAdminFormRules();
    if (!rules) {
      setAdminStatus("Bitte gültige Werte eintragen.");
      return;
    }

    const url = buildCampaignUrl(rules);
    adminLinkOutput.value = url;
    copyText(url).then(() => setAdminStatus("Kampagnenlink kopiert. Diesen Link kannst du teilen oder shorten."));
  });

  adminReset?.addEventListener("click", () => {
    try {
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {
      // Ignore storage failures; reset still works for the current page.
    }

    applyTimerRules(DEFAULT_CONFIG);
    storeAdminRules(DEFAULT_CONFIG);
    setAdminStatus("Timer-Regeln auf Standard zurückgesetzt.");
  });

  adminClose?.addEventListener("click", () => {
    adminPanel.hidden = true;
  });

  adminGateForm?.addEventListener("submit", submitAdminPassword);
  adminGateSubmit?.addEventListener("click", submitAdminPassword);
  adminGateClose?.addEventListener("click", closeAdminGate);
  adminGate?.addEventListener("click", (event) => {
    if (event.target === adminGate) {
      closeAdminGate();
    }
  });

  if (isAdminMode) {
    openAdminGate();
  }
}

const initialRules = readCampaignRules() || readStoredAdminRules();
if (initialRules) {
  applyTimerRules(initialRules);
}

Object.entries(CONFIG).forEach(([key, value]) => setText(key, value));
if (waitlistLink) {
  waitlistLink.href = TELEGRAM_WAITLIST_URL;
}
updateOfferState();
finishBoot();
window.setInterval(updateOfferState, 250);
setupAdminPanel();

payTargets.forEach((target) => {
  target.addEventListener("click", goToUnlock);
});
