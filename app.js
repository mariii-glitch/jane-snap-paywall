const DEFAULT_CONFIG = Object.freeze({
  displayName: "Jane",
  handle: "@jane.private",
  snap: "jane.onlyvip",
  photos: 10,
  videos: 8,
  price: "CHF 36.-",
  oldPrice: "",
  unlockUrl: "https://buy.stripe.com/8x2dRb0Pz54AgHi6smasg02",
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
const ADMIN_SETTINGS_STORAGE_KEY = "janeAdminSettings";
const ADMIN_PASSWORD = "123s";
const TELEGRAM_WAITLIST_URL = "https://t.me/+df8nvcSFeAM0MDBk";
const CONFIG_API_ENDPOINT = "/api/config";
const CONFIG_API_TIMEOUT_MS = 6000;

const CANONICAL_RENDER_HOST = "jane-snap-vip.onrender.com";

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
const adminCopyHome = document.querySelector("[data-admin-copy-home]");
const adminApplyClean = document.querySelector("[data-admin-apply-clean]");
const adminApplyLive = document.querySelector("[data-admin-apply-live]");
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
  paymentUrl: document.querySelector('[data-admin-input="paymentUrl"]'),
};
const normalizedPath = window.location.pathname.replace(/\/+$/, "");
const isAdminMode =
  new URLSearchParams(window.location.search).get("admin") === "timer" ||
  normalizedPath.endsWith("/admin") ||
  normalizedPath.endsWith("/admin.html");

let toastTimer;
let isLocked = false;
let adminPanelReady = false;
let adminSessionPassword = "";

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
  return isValidPaymentUrl(url);
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

function normalizeSiteSettings(rawSettings) {
  const unlockUrl = typeof rawSettings?.unlockUrl === "string" ? rawSettings.unlockUrl.trim() : "";
  if (!isValidPaymentUrl(unlockUrl)) return null;

  return { unlockUrl };
}

function isValidPaymentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
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

function readStoredAdminSettings() {
  try {
    return normalizeSiteSettings(JSON.parse(window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY)));
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

function storeAdminSettings(settings) {
  try {
    window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
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

function getCurrentSiteSettings() {
  return {
    unlockUrl: CONFIG.unlockUrl,
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

function readAdminFormSettings(overrides = {}) {
  return normalizeSiteSettings({
    unlockUrl: adminInputs.paymentUrl?.value,
    ...overrides,
  });
}

function buildCampaignUrl(rules) {
  const url = new URL(`https://${CANONICAL_RENDER_HOST}/`);
  url.searchParams.set(CAMPAIGN_PARAM, encodeTimerRules(rules));
  return url.toString();
}

function buildCleanPublicUrl() {
  if (window.location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return new URL("index.html", window.location.href).toString();
  }

  return `https://${CANONICAL_RENDER_HOST}/`;
}

function canUseConfigApi() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

async function fetchConfigApi(path = CONFIG_API_ENDPOINT, options = {}) {
  if (!canUseConfigApi()) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONFIG_API_TIMEOUT_MS);

  try {
    const response = await window.fetch(path, {
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;

    return response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readGlobalConfig() {
  const payload = await fetchConfigApi();
  return {
    rules: normalizeTimerRules(payload?.rules || payload),
    settings: normalizeSiteSettings(payload?.settings),
  };
}

async function publishGlobalConfig(rules, settings) {
  const normalizedRules = normalizeTimerRules(rules);
  const normalizedSettings = normalizeSiteSettings(settings);
  if (!normalizedRules || !normalizedSettings) return { saved: false, reason: "invalid" };

  const payload = await fetchConfigApi(CONFIG_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: adminSessionPassword || ADMIN_PASSWORD,
      rules: normalizedRules,
      settings: normalizedSettings,
    }),
  });

  const savedRules = normalizeTimerRules(payload?.rules);
  const savedSettings = normalizeSiteSettings(payload?.settings);
  if (!savedRules || !savedSettings) return { saved: false, reason: payload?.error || "api-unavailable" };

  return { saved: true, rules: savedRules, settings: savedSettings };
}

function setAdminStatus(message) {
  if (adminStatus) {
    adminStatus.textContent = message;
  }
}

function setAdminLinkValue(value) {
  if (adminLinkOutput) {
    adminLinkOutput.value = value;
  }
}

function updateGeneratedLink() {
  const rules = readAdminFormRules() || getCurrentTimerRules();
  setAdminLinkValue(buildCampaignUrl(rules));
}

function updateAdminForm() {
  if (!adminForm) return;

  adminInputs.offerMinutes.value = toMinutes(CONFIG.offerDurationMs);
  adminInputs.lockMinutes.value = toMinutes(CONFIG.lockDurationMs);
  adminInputs.openSlots.value = CONFIG.openSlots;
  adminInputs.totalSlots.value = CONFIG.totalSlots;
  adminInputs.timerEpoch.value = toLocalDateTimeValue(CONFIG.timerEpochMs);
  if (adminInputs.paymentUrl) {
    adminInputs.paymentUrl.value = CONFIG.unlockUrl;
  }
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

function applySiteSettings(settings) {
  const normalizedSettings = normalizeSiteSettings(settings);
  if (!normalizedSettings) return false;

  Object.assign(CONFIG, normalizedSettings);
  updateAdminForm();
  return true;
}

async function applyStoreAndPublishTimerRules(rules, successMessage, failureMessage) {
  const pendingSettings = adminInputs.paymentUrl ? readAdminFormSettings() : getCurrentSiteSettings();
  if (!pendingSettings) {
    setAdminStatus("Bitte gültigen Zahlungslink eintragen.");
    return { applied: false, saved: false, reason: "invalid-payment-link" };
  }

  if (!applyTimerRules(rules)) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return { applied: false, saved: false, reason: "invalid" };
  }

  applySiteSettings(pendingSettings);
  const currentRules = getCurrentTimerRules();
  const currentSettings = getCurrentSiteSettings();
  storeAdminRules(currentRules);
  storeAdminSettings(currentSettings);
  setAdminStatus("Speichere live...");

  const result = await publishGlobalConfig(currentRules, currentSettings);
  if (!result.saved) {
    setAdminStatus(
      failureMessage ||
        "Auf diesem Gerät gespeichert, aber live noch nicht übernommen. Bitte nochmal versuchen."
    );
    return { applied: true, saved: false, reason: result.reason };
  }

  applyTimerRules(result.rules);
  applySiteSettings(result.settings);
  storeAdminRules(result.rules);
  storeAdminSettings(result.settings);
  setAdminStatus(successMessage);
  return { applied: true, saved: true, rules: result.rules, settings: result.settings };
}

async function applyStoreAndPublishAdminConfig(rules, settings, successMessage, failureMessage) {
  if (!applyTimerRules(rules)) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return { applied: false, saved: false, reason: "invalid-rules" };
  }

  if (!applySiteSettings(settings)) {
    setAdminStatus("Bitte gültigen Zahlungslink eintragen.");
    return { applied: false, saved: false, reason: "invalid-payment-link" };
  }

  const currentRules = getCurrentTimerRules();
  const currentSettings = getCurrentSiteSettings();
  storeAdminRules(currentRules);
  storeAdminSettings(currentSettings);
  setAdminStatus("Speichere live...");

  const result = await publishGlobalConfig(currentRules, currentSettings);
  if (!result.saved) {
    setAdminStatus(
      failureMessage ||
        "Auf diesem Gerät gespeichert, aber live noch nicht übernommen. Bitte nochmal versuchen."
    );
    return { applied: true, saved: false, reason: result.reason };
  }

  applyTimerRules(result.rules);
  applySiteSettings(result.settings);
  storeAdminRules(result.rules);
  storeAdminSettings(result.settings);
  setAdminStatus(successMessage);
  return { applied: true, saved: true, rules: result.rules, settings: result.settings };
}

function fallbackCopyText(value) {
  const target = adminLinkOutput || document.createElement("textarea");
  const targetWasDetached = !target.parentNode;

  if (targetWasDetached) {
    target.value = value;
    target.setAttribute("readonly", "");
    target.style.position = "fixed";
    target.style.left = "12px";
    target.style.bottom = "12px";
    target.style.opacity = "0.01";
    document.body.appendChild(target);
  }

  target.value = value;
  target.removeAttribute("readonly");
  target.focus();
  target.select();
  target.setSelectionRange?.(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  target.setAttribute("readonly", "");

  if (targetWasDetached) {
    target.remove();
  }

  return copied;
}

async function copyText(value) {
  setAdminLinkValue(value);

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back to selection-based copy below.
    }
  }

  return fallbackCopyText(value);
}

function openAdminPanel(message = "Timer Admin geöffnet.") {
  if (!adminPanel) return;

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
  event?.preventDefault();

  const password = adminPasswordInput?.value || "";

  if (password.trim().toLowerCase() === ADMIN_PASSWORD.toLowerCase()) {
    adminSessionPassword = ADMIN_PASSWORD;
    openAdminPanel("Admin geöffnet. Du kannst jetzt Status, Timer und Link steuern.");
    return;
  }

  setAdminGateStatus("Falsches Passwort.");
  adminPasswordInput?.select();
}

async function setTimerWindow(active) {
  const rules = readAdminFormRules() || getCurrentTimerRules();
  const timerEpochMs = Date.now() - (active ? 0 : rules.offerDurationMs);
  const nextRules = normalizeTimerRules({ ...rules, timerEpochMs, manualLock: false });

  if (!nextRules) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return;
  }

  await applyStoreAndPublishTimerRules(
    nextRules,
    active
      ? "Live geöffnet. Besucher können jetzt wieder freischalten."
      : "Live kurz geschlossen. Besucher sehen jetzt die Warteliste.",
    active
      ? "Lokal geöffnet, aber live noch nicht übernommen. Bitte nochmal versuchen."
      : "Lokal kurz geschlossen, aber live noch nicht übernommen. Bitte nochmal versuchen."
  );
}

async function setManualLock(enabled) {
  const rules = readAdminFormRules() || getCurrentTimerRules();
  const timerEpochMs = Date.now() - (enabled ? rules.offerDurationMs : 0);
  const nextRules = normalizeTimerRules({ ...rules, timerEpochMs, manualLock: enabled });

  if (!nextRules) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return;
  }

  await applyStoreAndPublishTimerRules(
    nextRules,
    enabled
      ? "Live dauerhaft geschlossen. Besucher sehen jetzt die Warteliste."
      : "Live wieder geöffnet. Besucher können jetzt freischalten.",
    enabled
      ? "Lokal dauerhaft geschlossen, aber live noch nicht übernommen. Bitte nochmal versuchen."
      : "Lokal geöffnet, aber live noch nicht übernommen. Bitte nochmal versuchen."
  );
}

async function applyRulesAndOpenCleanLink() {
  const rules = readAdminFormRules();
  if (!rules) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return;
  }

  const result = await applyStoreAndPublishTimerRules(
    rules,
    "Gespeichert. Die Hauptseite ist aktualisiert.",
    "Nicht live gespeichert. Bitte nochmal versuchen, bevor du den Admin verlässt."
  );
  if (!result.saved) return;

  window.setTimeout(() => {
    window.location.replace(buildCleanPublicUrl());
  }, 220);
}

async function applyRulesDirectlyLive() {
  const nextRules = readAdminFormRules({
    timerEpochMs: Date.now(),
    manualLock: false,
  });

  if (!nextRules) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return;
  }

  const campaignUrl = buildCampaignUrl(nextRules);
  setAdminLinkValue(campaignUrl);

  await applyStoreAndPublishTimerRules(
    nextRules,
    `Live gespeichert: Besucher sehen jetzt ${nextRules.openSlots}/${nextRules.totalSlots} Plätze.`,
    `Lokal gespeichert: ${nextRules.openSlots}/${nextRules.totalSlots}. Live noch nicht übernommen. Bitte nochmal versuchen.`
  );
}

async function copyHomeLinkAndSaveRules() {
  const rules = readAdminFormRules();
  if (!rules) {
    setAdminStatus("Bitte gültige Werte eintragen.");
    return;
  }

  const cleanUrl = buildCleanPublicUrl();
  const copied = await copyText(cleanUrl);
  setAdminStatus(copied ? "Hauptlink kopiert. Speichere live..." : `Hauptlink steht im Feld: ${cleanUrl}`);

  const result = await applyStoreAndPublishTimerRules(
    rules,
    "Hauptlink kopiert und Einstellungen gespeichert.",
    copied
      ? "Hauptlink kopiert. Einstellungen sind lokal gespeichert, aber live noch nicht übernommen."
      : "Hauptlink steht im Feld. Einstellungen sind lokal gespeichert, aber live noch nicht übernommen."
  );
  setAdminStatus(
    result.saved
      ? copied
        ? "Hauptlink kopiert und Einstellungen gespeichert."
        : "Hauptlink steht im Feld und Einstellungen sind gespeichert."
      : copied
        ? "Hauptlink kopiert. Einstellungen gelten aktuell auf deinem Gerät."
        : `Hauptlink steht im Feld. Einstellungen gelten aktuell auf deinem Gerät.`
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
    ctaLabel.textContent = "VIP freischalten";
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

  adminForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rules = readAdminFormRules();
    const settings = readAdminFormSettings();
    if (!rules || !settings) {
      setAdminStatus(!settings ? "Bitte gültigen Zahlungslink eintragen." : "Bitte gültige Werte eintragen.");
      return;
    }

    await applyStoreAndPublishAdminConfig(
      rules,
      settings,
      "Gespeichert. Die Hauptseite ist aktualisiert.",
      "Lokal gespeichert, aber live noch nicht übernommen. Bitte nochmal versuchen."
    );
  });

  adminNow?.addEventListener("click", () => {
    if (adminInputs.timerEpoch) {
      adminInputs.timerEpoch.value = toLocalDateTimeValue(Date.now());
      updateGeneratedLink();
      setAdminStatus("Timer startet ab jetzt. Danach speichern oder Link kopieren.");
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

  adminCopy?.addEventListener("click", async () => {
    const rules = readAdminFormRules();
    if (!rules) {
      setAdminStatus("Bitte gültige Werte eintragen.");
      return;
    }

    const url = buildCampaignUrl(rules);
    const copied = await copyText(url);
    setAdminStatus(
      copied
        ? "Link mit Einstellungen kopiert. Diesen Link kannst du teilen oder shorten."
        : "Link mit Einstellungen steht im Feld. Antippen, markieren und kopieren."
    );
  });

  adminApplyLive?.addEventListener("click", applyRulesDirectlyLive);
  adminCopyHome?.addEventListener("click", copyHomeLinkAndSaveRules);
  adminApplyClean?.addEventListener("click", applyRulesAndOpenCleanLink);

  adminReset?.addEventListener("click", async () => {
    try {
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
      window.localStorage.removeItem(ADMIN_SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore storage failures; reset still works for the current page.
    }

    await applyStoreAndPublishTimerRules(
      DEFAULT_CONFIG,
      "Timer-Regeln live auf Standard zurückgesetzt.",
      "Reset lokal ausgeführt, aber live noch nicht übernommen. Bitte nochmal versuchen."
    );
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

async function initializePage() {
  const campaignRules = readCampaignRules();
  const globalConfig = await readGlobalConfig();
  const initialRules = campaignRules || globalConfig.rules || readStoredAdminRules();
  const initialSettings = globalConfig.settings || readStoredAdminSettings();

  if (initialRules) {
    applyTimerRules(initialRules);
  }

  if (initialSettings) {
    applySiteSettings(initialSettings);
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
}

initializePage();
