const CONFIG = {
  displayName: "Jane",
  handle: "@jane.private",
  snap: "jane.onlyvip",
  photos: 3,
  videos: 4,
  price: "CHF 8.-",
  oldPrice: "CHF 29.-",
  stripeCheckoutUrl: "https://buy.stripe.com/DEIN-STRIPE-LINK-HIER",
  offerDurationMs: 3 * 60 * 1000,
  lockDurationMs: 3 * 60 * 1000,
  openSlots: 13,
  totalSlots: 30,
};

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

let toastTimer;
const cycleStartedAt = Date.now();
let isLocked = false;

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

function isConfiguredStripeUrl(url) {
  return /^https:\/\/buy\.stripe\.com\/.+/i.test(url) && !url.includes("DEIN-STRIPE-LINK-HIER");
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function getOfferState() {
  const cycleLength = CONFIG.offerDurationMs + CONFIG.lockDurationMs;
  const elapsed = (Date.now() - cycleStartedAt) % cycleLength;
  const active = elapsed < CONFIG.offerDurationMs;
  const remaining = active ? CONFIG.offerDurationMs - elapsed : cycleLength - elapsed;
  const slotRatio = active ? remaining / CONFIG.offerDurationMs : 0;
  const remainingSlots = active ? Math.max(1, Math.ceil(CONFIG.openSlots * slotRatio)) : 0;

  return { active, remaining, remainingSlots, slotRatio };
}

function updateOfferState() {
  const state = getOfferState();
  isLocked = !state.active;

  document.body.classList.toggle("is-offer-locked", isLocked);
  slots.textContent = state.remainingSlots;
  totalSlots.textContent = CONFIG.totalSlots;
  slotBar.style.width = `${Math.max(0, Math.min(1, state.slotRatio)) * 100}%`;

  if (state.active) {
    offerLabel.textContent = "Angebot aktiv";
    countdown.textContent = formatTime(state.remaining);
    offerStatus.textContent = "Aktionsfenster läuft";
    ctaLabel.textContent = "Jetzt freischalten";
    return;
  }

  offerLabel.textContent = "Zu spät";
  countdown.textContent = "Verpasst";
  offerStatus.textContent = "Alle Plätze im aktuellen Fenster belegt";
  ctaLabel.textContent = "Verpasst";
}

function goToCheckout() {
  if (isLocked) {
    showToast("Zu spät. Dieses Fenster ist vorbei und alle Plätze sind belegt.");
    return;
  }

  if (isConfiguredStripeUrl(CONFIG.stripeCheckoutUrl)) {
    window.location.href = CONFIG.stripeCheckoutUrl;
    return;
  }

  showToast("Stripe-Link noch in app.js eintragen. Danach führt jeder gesperrte Bereich direkt zum Checkout.");
}

Object.entries(CONFIG).forEach(([key, value]) => setText(key, value));
updateOfferState();
window.setInterval(updateOfferState, 250);

payTargets.forEach((target) => {
  target.addEventListener("click", goToCheckout);
});
