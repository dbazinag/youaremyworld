/* =========================================================
   you are my world — flow + countdown
   (Phase 1: front-end skeleton. Supabase auth/data come next.)
   ========================================================= */

import { CONFIG } from "./config.js";
import { supabase } from "./supabase.js";
import { initRoom } from "./room.js";

/* show the app screen and spin up the room */
function enterApp() {
  show("app");
  initRoom();
}

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

/* ---------- the real shared login (Supabase) ----------
   You both sign into ONE shared account. The "magic word" is that account's
   password; only people who know it get an authenticated session, and the
   data is locked to authenticated users via row-level security. */
async function enterPrivate() {
  const { data } = await supabase.auth.getSession();
  if (data.session) enterApp(); else show("gate");   // already logged in? skip the gate
}

function wireGate() {
  const form  = $("#gate-form");
  const input = $("#gate-input");
  const error = $("#gate-error");
  const btn   = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    btn.disabled = true;
    btn.textContent = "unlocking…";

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: CONFIG.supabase.sharedEmail,
      password: input.value,
    });

    btn.disabled = false;
    btn.textContent = "unlock";

    if (authError) {
      error.hidden = false;
      input.select();
    } else {
      enterApp();
    }
  });
}

/* ---------- boot ---------- */
// "open our world" (after the countdown) and the discreet always-there link
$("#enter-btn").addEventListener("click", enterPrivate);
$("#peek-link").addEventListener("click", (e) => { e.preventDefault(); enterPrivate(); });
wireGate();

if (target - Date.now() <= 0) {
  show("congrats");
} else {
  show("countdown");
  startCountdown();
}
