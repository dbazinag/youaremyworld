/* =========================================================
   The cat room — Lion & Mimi share one cozy room.
   Tap either cat to set its mood; it syncs live (Supabase
   realtime) to the other person. Cats auto-sleep when it's
   night where their person is.
   ========================================================= */

import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";

const MOODS = [
  { key: "cozy",     emoji: "😌",  label: "cozy" },
  { key: "lovey",    emoji: "🥰",  label: "lovey" },
  { key: "happy",    emoji: "😺",  label: "happy" },
  { key: "missing",  emoji: "🥺",  label: "missing you" },
  { key: "sleepy",   emoji: "😴",  label: "sleepy" },
  { key: "grumpy",   emoji: "😾",  label: "grumpy" },
  { key: "stressed", emoji: "😰",  label: "stressed" },
  { key: "hungry",   emoji: "🍽️", label: "hungry" },
  { key: "playful",  emoji: "😼",  label: "playful" },
];

const PEOPLE = CONFIG.people;           // { lion:{name,city,tz}, mimi:{...} }
const state = { lion: null, mimi: null }; // each: { cat, mood, updated_at }

let root = null;
let started = false;
let picking = null;

/* ---------- entry point (called by main.js when entering the app) ---------- */
export async function initRoom() {
  root = document.getElementById("room");
  if (started) { renderAll(); return; }
  started = true;

  root.innerHTML = roomShell();
  wireHandlers();

  const { data, error } = await supabase.from("moods").select("*");
  if (error) {
    root.querySelector(".room-status").textContent =
      "couldn't load the room 😿 — " + error.message;
  } else {
    for (const r of data) state[r.cat] = r;
  }
  renderAll();

  // live updates from the other person
  supabase
    .channel("moods-rt")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "moods" },
        (payload) => {
          if (payload.new && payload.new.cat) {
            state[payload.new.cat] = payload.new;
            renderAll();
          }
        })
    .subscribe();

  // keep the clocks / "x ago" fresh
  setInterval(renderAll, 30000);
}

/* ---------- time helpers ---------- */
function localInfo(tz) {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat("en-GB",
    { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB",
    { timeZone: tz, hour: "2-digit", hour12: false }).format(now)) % 24;
  const night = hour >= 22 || hour < 7;
  return { timeStr, night };
}

function ago(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return "just now";
  if (s < 3600)  return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

/* ---------- render ---------- */
function renderAll() {
  if (!root) return;
  for (const cat of ["lion", "mimi"]) {
    const p = PEOPLE[cat];
    const info = localInfo(p.tz);
    const m = state[cat];
    const moodObj = m ? MOODS.find((x) => x.key === m.mood) : null;
    const asleep = info.night || (m && m.mood === "sleepy");

    const spot = root.querySelector("#spot-" + cat);
    spot.classList.toggle("asleep", !!asleep);
    spot.querySelector(".roomcat").classList.toggle("asleep", !!asleep);

    const bubble = spot.querySelector(".mood-bubble");
    bubble.innerHTML = moodObj
      ? `<span class="m-emoji">${moodObj.emoji}</span><span class="m-label">${moodObj.label}</span>`
      : `<span class="m-label">no mood yet</span>`;

    const sky = info.night ? "🌙" : "☀️";
    const agoTxt = m ? ` · <span class="ago">${ago(m.updated_at)}</span>` : "";
    spot.querySelector(".nameplate").innerHTML =
      `<strong>${p.name}</strong> · ${sky} ${info.timeStr} · ${p.city}${agoTxt}`;
  }
}

/* ---------- mood picker ---------- */
function openPicker(cat) {
  picking = cat;
  const modal = root.querySelector(".mood-modal");
  modal.querySelector(".mood-modal-title").textContent =
    `how is ${PEOPLE[cat].name} feeling?`;
  modal.querySelector(".mood-grid").innerHTML = MOODS.map((m) =>
    `<button class="mood-chip" data-key="${m.key}"><span class="chip-emoji">${m.emoji}</span>${m.label}</button>`
  ).join("");
  modal.hidden = false;
}

function closePicker() {
  picking = null;
  root.querySelector(".mood-modal").hidden = true;
}

async function setMood(cat, key) {
  closePicker();
  const nowIso = new Date().toISOString();
  state[cat] = { ...(state[cat] || { cat }), cat, mood: key, updated_at: nowIso };
  renderAll(); // optimistic

  const { error } = await supabase
    .from("moods")
    .update({ mood: key, updated_at: nowIso })
    .eq("cat", cat);

  if (error) {
    root.querySelector(".room-status").textContent =
      "hmm, that didn't save 😿 — " + error.message;
  }
}

/* ---------- wiring ---------- */
function wireHandlers() {
  root.querySelectorAll(".cat-spot").forEach((spot) => {
    spot.addEventListener("click", () => openPicker(spot.dataset.cat));
  });
  root.querySelector(".mood-cancel").addEventListener("click", closePicker);
  root.querySelector(".mood-modal").addEventListener("click", (e) => {
    if (e.target.classList.contains("mood-modal")) closePicker(); // click backdrop
  });
  root.querySelector(".mood-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".mood-chip");
    if (btn && picking) setMood(picking, btn.dataset.key);
  });
  root.querySelector(".room-signout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
  });
}

/* ---------- markup ---------- */
function roomShell() {
  return `
  <div class="journal room">
    <button class="room-signout" title="sign out">leave 🐾</button>
    <p class="kicker">our little room</p>
    <h2 class="title title--sm">how we're feeling</h2>
    <p class="room-status"></p>
    <div class="room-cats">
      <div class="cat-spot" data-cat="lion" id="spot-lion">
        <span class="zzz-room">z &nbsp;z &nbsp;z</span>
        ${lionSVG()}
        <div class="mood-bubble"></div>
        <div class="nameplate"></div>
        <span class="tap-hint">tap to set mood</span>
      </div>
      <div class="cat-spot" data-cat="mimi" id="spot-mimi">
        <span class="zzz-room">z &nbsp;z &nbsp;z</span>
        ${mimiSVG()}
        <div class="mood-bubble"></div>
        <div class="nameplate"></div>
        <span class="tap-hint">tap to set mood</span>
      </div>
    </div>
  </div>

  <div class="mood-modal" hidden>
    <div class="mood-card">
      <p class="mood-modal-title"></p>
      <div class="mood-grid"></div>
      <button class="mood-cancel">never mind</button>
    </div>
  </div>`;
}

function lionSVG() {
  return `
  <svg class="roomcat" data-cat="lion" viewBox="0 0 130 100" role="img" aria-label="Lion">
    <defs>
      <clipPath id="rmLionBody"><path d="M16 84 q-6 -42 34 -48 q46 -7 66 18 q14 19 -4 36 q-48 16 -96 -6 z"/></clipPath>
      <filter id="rmFurBrown" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="3" seed="11" result="n"/><feComponentTransfer in="n" result="m"><feFuncA type="discrete" tableValues="0 0 0 0 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
      <filter id="rmFurTan" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="3" seed="4" result="n"/><feComponentTransfer in="n" result="m"><feFuncA type="discrete" tableValues="0 0 0 0 0 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
      <filter id="rmFurBeige" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="23" result="n"/><feComponentTransfer in="n" result="m"><feFuncA type="discrete" tableValues="0 0 0 0 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
      <filter id="rmFurWhite" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="31" result="n"/><feComponentTransfer in="n" result="m"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
    </defs>
    <g stroke="#241f1c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M92 82 q30 4 34 -14 q3 -13 -12 -17" fill="#322b27"/>
      <path d="M16 84 q-6 -42 34 -48 q46 -7 66 18 q14 19 -4 36 q-48 16 -96 -6 z" fill="#322b27"/>
      <g clip-path="url(#rmLionBody)" stroke="none">
        <rect x="8" y="20" width="120" height="80" fill="#6e4327" filter="url(#rmFurBrown)"/>
        <rect x="8" y="20" width="120" height="80" fill="#b9794a" filter="url(#rmFurTan)"/>
        <rect x="8" y="20" width="120" height="80" fill="#d6bd95" filter="url(#rmFurBeige)"/>
        <rect x="8" y="20" width="120" height="80" fill="#f4eee2" filter="url(#rmFurWhite)"/>
      </g>
      <path d="M34 47 l-7 -21 l20 12 z" fill="#322b27"/>
      <path d="M54 41 l9 -20 l11 18 z" fill="#322b27"/>
      <g class="eyes-closed" fill="none" stroke="#efe2c8" stroke-width="2.1">
        <path d="M27 65 q6 -3 11 0"/><path d="M44 65 q6 -3 11 0"/><path d="M39 71 q3 2.5 6 0"/>
      </g>
      <g class="eyes-open">
        <ellipse cx="32" cy="64" rx="3" ry="3.6" fill="#efe2c8"/>
        <ellipse cx="49" cy="64" rx="3" ry="3.6" fill="#efe2c8"/>
        <path d="M38 71 q3 3 6 0" fill="none" stroke="#efe2c8" stroke-width="2"/>
      </g>
    </g>
  </svg>`;
}

function mimiSVG() {
  return `
  <svg class="roomcat" data-cat="mimi" viewBox="0 0 130 100" role="img" aria-label="Mimi">
    <g stroke="#9c7536" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M92 82 q30 4 34 -14 q3 -13 -12 -17" fill="#e2ba7e"/>
      <path d="M12 80 q-2 -47 42 -51 q49 -4 64 22 q12 21 -8 37 q-52 14 -98 -8 z" fill="#e2ba7e"/>
      <path d="M34 47 q0 -10 9 -10 q8 0 8 9 z" fill="#e2ba7e"/>
      <path d="M55 44 q0 -10 9 -10 q8 0 8 9 z" fill="#e2ba7e"/>
      <g class="eyes-closed" fill="none" stroke="#6e5228" stroke-width="2.1">
        <path d="M27 62 q6 -3 11 0"/><path d="M44 62 q6 -3 11 0"/><path d="M39 68 q3 2.5 6 0"/>
      </g>
      <g class="eyes-open">
        <ellipse cx="32" cy="61" rx="3" ry="3.6" fill="#5b4422"/>
        <ellipse cx="49" cy="61" rx="3" ry="3.6" fill="#5b4422"/>
        <path d="M38 68 q3 3 6 0" fill="none" stroke="#6e5228" stroke-width="2"/>
      </g>
    </g>
  </svg>`;
}
