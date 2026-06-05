/* =========================================================
   you are my world — flow + countdown
   (Phase 1: front-end skeleton. Supabase auth/data come next.)
   ========================================================= */

import { CONFIG } from "./config.js";

/* ---------- tiny helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const screens = {
  countdown: $("#screen-countdown"),
  congrats:  $("#screen-congrats"),
  gate:      $("#screen-gate"),
  app:       $("#screen-app"),
};

function show(name) {
  for (const el of Object.values(screens)) el.classList.remove("is-active");
  screens[name].classList.add("is-active");
}

/* ---------- the countdown ---------- */
// Target instant: June 18, 2026, 6:00 PM Eastern (Barrie). In June that's EDT (UTC-4).
// Defined in config.js so it's a one-line change.
const target = new Date(CONFIG.reunionISO).getTime();

const out = {
  days:  $("[data-days]"),
  hours: $("[data-hours]"),
  mins:  $("[data-mins]"),
  secs:  $("[data-secs]"),
};

let ticker = null;

function pad(n) { return String(n).padStart(2, "0"); }

function tick() {
  const diff = target - Date.now();

  if (diff <= 0) {
    clearInterval(ticker);
    show("congrats");
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  out.days.textContent  = d;
  out.hours.textContent = pad(h);
  out.mins.textContent  = pad(m);
  out.secs.textContent  = pad(s);
}

function startCountdown() {
  tick();
  ticker = setInterval(tick, 1000);
}

/* ---------- gate (TEMPORARY placeholder) ----------
   This is NOT real security yet — it's a stand-in so the flow is walkable.
   Real protection arrives with Supabase auth (the shared login). Don't put
   anything truly private behind this until then. */
function wireGate() {
  const form  = $("#gate-form");
  const input = $("#gate-input");
  const error = $("#gate-error");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim().toLowerCase() === CONFIG.placeholderPassword) {
      show("app");
    } else {
      error.hidden = false;
      input.select();
    }
  });
}

/* ---------- boot ---------- */
$("#enter-btn").addEventListener("click", () => show("gate"));
wireGate();

if (target - Date.now() <= 0) {
  show("congrats");
} else {
  show("countdown");
  startCountdown();
}
