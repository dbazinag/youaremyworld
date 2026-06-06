/* =========================================================
   The cat room — Lion & Mimi share one cozy room.
   Tap either cat to set its mood; the cat's FACE changes,
   it syncs live (Supabase realtime) to the other person,
   and cats auto-sleep when it's night where their person is.
   Each cat's window shows their city's real sky (day/night).
   ========================================================= */

import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";
import { onWalletChange, getState, earn, itemById, setDecorPos } from "./wallet.js";

const MOODS = [
  { key: "cozy",     emoji: "😌",  label: "cozy" },
  { key: "lovey",    emoji: "🥰",  label: "lovey" },
  { key: "happy",    emoji: "😺",  label: "happy" },
  { key: "missing",  emoji: "🥺",  label: "missing you" },
  { key: "sad",      emoji: "😢",  label: "sad" },
  { key: "sleepy",   emoji: "😴",  label: "sleepy" },
  { key: "grumpy",   emoji: "😾",  label: "grumpy" },
  { key: "stressed", emoji: "😰",  label: "stressed" },
  { key: "hungry",   emoji: "🍽️", label: "hungry" },
  { key: "playful",  emoji: "😼",  label: "playful" },
];

const PEOPLE = CONFIG.people;             // { lion:{name,city,tz}, mimi:{...} }
const state  = { lion: null, mimi: null }; // each: { cat, mood, updated_at }

// face geometry per cat (eye line / mouth line / stroke colour)
const FACE = {
  lion: { ey: 64, my: 72, sc: "#efe2c8" },
  mimi: { ey: 61, my: 69, sc: "#6e5228" },
};
const EX1 = 32, EX2 = 49, MX = 40;        // left eye / right eye / mouth centre x

let root = null;
let picking = null;

/* ---------- entry point (called once by the app shell) ---------- */
export async function initRoom(container) {
  root = container;
  root.innerHTML = roomShell();
  wireHandlers();
  onWalletChange(applyCosmetics);
  applyCosmetics(getState());

  const { data, error } = await supabase.from("moods").select("*");
  if (error) {
    root.querySelector(".room-status").textContent =
      "couldn't load the room 😿 — " + error.message;
  } else {
    for (const r of data) state[r.cat] = r;
  }
  renderAll();

  supabase
    .channel("moods-rt")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "moods" },
        (payload) => {
          if (payload.new && payload.new.cat) {
            const c = payload.new.cat;
            const localPets = (state[c] && state[c].pets) || 0;
            // pets only ever increase — don't let a lagging echo roll it back
            state[c] = { ...payload.new, pets: Math.max(payload.new.pets || 0, localPets) };
            renderAll();
          }
        })
    .subscribe();

  setInterval(renderAll, 30000); // keep clocks / "x ago" fresh
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
    const faceMood = m ? m.mood : "cozy"; // mood always shows, even at night

    const spot = root.querySelector("#spot-" + cat);
    spot.classList.toggle("night", info.night); // night only adds the Z's
    spot.querySelector(".cat-face").innerHTML = moodFace(cat, faceMood);

    const win = spot.querySelector(".window");
    win.classList.toggle("night", info.night);

    spot.querySelector(".mood-bubble").innerHTML = moodObj
      ? `<span class="m-emoji">${moodObj.emoji}</span><span class="m-label">${moodObj.label}</span>`
      : `<span class="m-label">no mood yet</span>`;

    const sky = info.night ? "🌙" : "☀️";
    const agoTxt = m ? ` · <span class="ago">${ago(m.updated_at)}</span>` : "";
    spot.querySelector(".nameplate").innerHTML =
      `<strong>${p.name}</strong> · ${sky}&nbsp;${info.timeStr} · ${p.city}${agoTxt}`;

    const pets = (m && m.pets) || 0;
    spot.querySelector(".pet-count").textContent = pets ? `🤍 petted ${pets}×` : "";
  }
}

/* ---------- the expressive face ---------- */
function moodFace(cat, mood) {
  const { ey, my, sc } = FACE[cat];
  const line = (d, w = 2.1) => `<path d="${d}" fill="none" stroke="${sc}" stroke-width="${w}" stroke-linecap="round"/>`;
  const dot  = (x, rx = 2.9, ry = 3.5) => `<ellipse cx="${x}" cy="${ey}" rx="${rx}" ry="${ry}" fill="${sc}"/>`;
  const smile = line(`M${MX - 3} ${my} q3 2.6 6 0`, 2);
  const heart = (x) => `<path transform="translate(${x - 5},${ey - 5})" d="M5 9 Q0 4.4 0 2.5 Q0 0 2.5 0 Q5 0 5 2.3 Q5 0 7.5 0 Q10 0 10 2.5 Q10 4.4 5 9 Z" fill="#d4756a"/>`;

  switch (mood) {
    case "cozy":
      return line(`M${EX1 - 5} ${ey} q5 -3 10 0`) + line(`M${EX2 - 5} ${ey} q5 -3 10 0`) + smile;
    case "sleepy":
      return line(`M${EX1 - 5} ${ey} q5 3 10 0`) + line(`M${EX2 - 5} ${ey} q5 3 10 0`)
           + `<ellipse cx="${MX}" cy="${my}" rx="2.6" ry="2" fill="${sc}"/>`
           + `<path d="M${MX + 1} ${my + 1} q2 7 0 9 q-3 -2 0 -9 z" fill="#bcdcef"/>`;
    case "happy":
      return dot(EX1) + dot(EX2)
           + `<path d="M${MX - 5} ${my - 1} q5 7 10 0 z" fill="#c46079"/>`
           + `<ellipse cx="${EX1 - 6}" cy="${my - 3}" rx="3.4" ry="2.2" fill="#e3a692" opacity="0.6"/>`
           + `<ellipse cx="${EX2 + 6}" cy="${my - 3}" rx="3.4" ry="2.2" fill="#e3a692" opacity="0.6"/>`;
    case "lovey":
      return heart(EX1) + heart(EX2) + smile
           + `<path d="M62 30 q-3 -4 -6 -1 q-3 3 6 7 q9 -4 6 -7 q-3 -3 -6 1 z" fill="#e3a692" opacity="0.9"/>`
           + `<path d="M74 20 q-2 -3 -4.5 -0.8 q-2 2 4.5 5 q6.5 -3 4.5 -5 q-2.2 -2.2 -4.5 0.8 z" fill="#e3a692" opacity="0.75"/>`;
    case "missing":
      return dot(EX1, 3.6, 4.4) + `<circle cx="${EX1 + 1.2}" cy="${ey - 1.6}" r="1.1" fill="#fff"/>`
           + dot(EX2, 3.6, 4.4) + `<circle cx="${EX2 + 1.2}" cy="${ey - 1.6}" r="1.1" fill="#fff"/>`
           + line(`M${MX - 3} ${my} q1.5 2 3 0 q1.5 -2 3 0`, 2)
           + `<path d="M${EX1 - 3} ${ey + 4} q-2 5 0 6 q2 -1 0 -6 z" fill="#8fc0e0"/>`;
    case "sad":
      return line(`M${EX1 - 5} ${ey - 2} q5 4 10 -1`) + line(`M${EX2 - 5} ${ey - 2} q5 4 10 -1`)
           + line(`M${MX - 4} ${my + 1} q4 -3 8 0`, 2)
           + `<path d="M${EX1 - 2} ${ey + 4} q-2 5 0 6 q2 -1 0 -6 z" fill="#8fc0e0"/>`;
    case "grumpy":
      return line(`M${EX1 - 5} ${ey - 3} L${EX1 + 5} ${ey + 1}`, 2.4)
           + line(`M${EX2 - 5} ${ey + 1} L${EX2 + 5} ${ey - 3}`, 2.4)
           + line(`M${MX - 3} ${my} L${MX + 3} ${my}`, 2);
    case "stressed":
      return `<ellipse cx="${EX1}" cy="${ey}" rx="2.8" ry="3.6" fill="none" stroke="${sc}" stroke-width="2"/>`
           + `<ellipse cx="${EX2}" cy="${ey}" rx="2.8" ry="3.6" fill="none" stroke="${sc}" stroke-width="2"/>`
           + `<ellipse cx="${MX}" cy="${my}" rx="2.4" ry="1.8" fill="${sc}"/>`
           + `<path d="M57 ${ey - 7} q-3 5 0 7 q3 -2 0 -7 z" fill="#8fc0e0"/>`;
    case "hungry":
      return dot(EX1) + dot(EX2)
           + line(`M${MX - 4} ${my} q4 4 8 0`, 2)
           + `<path d="M${MX - 3} ${my + 1} q3 7 6 0 z" fill="#d4756a"/>`
           + `<g stroke="#6f5c45" stroke-width="1.6" fill="none" stroke-linecap="round">
                <path d="M58 85 v10 M61 85 v10 M64 85 v10 M61 95 v4"/>
                <path d="M76 90 v9"/>
              </g>
              <path d="M74 85 q4 1 4 5 l-4 0 z" fill="#6f5c45"/>`;
    case "playful":
      return dot(EX1) + line(`M${EX2 - 5} ${ey} q5 -3 10 0`)
           + line(`M${MX - 4} ${my} q5 3 9 -1`, 2);
    default:
      return line(`M${EX1 - 5} ${ey} q5 -3 10 0`) + line(`M${EX2 - 5} ${ey} q5 -3 10 0`) + smile;
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

/* ---------- pet the cat 🐾 ---------- */
function petCat(cat) {
  const spot = root.querySelector("#spot-" + cat);
  const wrap = spot.querySelector(".cat-wrap");

  wrap.classList.remove("petting");
  void wrap.offsetWidth;          // restart the animation
  wrap.classList.add("petting");

  for (let i = 0; i < 3; i++) {
    const h = document.createElement("span");
    h.className = "pet-heart";
    h.textContent = "♥";
    h.style.left = 38 + Math.random() * 40 + "%";
    h.style.animationDelay = i * 0.12 + "s";
    wrap.appendChild(h);
    setTimeout(() => h.remove(), 1300);
  }
  const purr = document.createElement("span");
  purr.className = "purr";
  purr.textContent = "purr~";
  wrap.appendChild(purr);
  setTimeout(() => purr.remove(), 1000);

  bumpPets(cat);
  if (Math.random() < 0.05) earn(1);   // a pet has a 5% chance of a treat 🐟
}

/* paint on the cosmetics bought in the shop */
function applyCosmetics(s) {
  if (!root) return;
  const bal = root.querySelector(".treat-balance-room");
  if (bal) bal.textContent = `🐟 ${s.treats}`;

  for (const cat of ["lion", "mimi"]) {
    const hatEl = root.querySelector("#spot-" + cat + " .cat-hat");
    if (!hatEl) continue;
    const it = s.equipped[cat] ? itemById(s.equipped[cat]) : null;
    hatEl.innerHTML = it ? it.svg : "";
  }

  const extras = root.querySelector(".room-extras");
  if (extras && !dragging) {     // don't rebuild mid-drag
    const pos = s.equipped.decorPos || {};
    extras.innerHTML = (s.equipped.decor || [])
      .filter((id) => s.owned.has(id))
      .map((id) => {
        const it = itemById(id);
        if (!it) return "";
        const p = pos[id];
        const style = p
          ? `left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);height:${it.h}px`
          : `${it.def};height:${it.h}px`;
        return `<span class="room-extra" data-id="${id}" style="${style}">${it.svg}</span>`;
      }).join("");
  }
}

/* ---------- drag decor around the room ---------- */
let drag = null, dragging = false;
function onExtraDown(e) {
  const el = e.target.closest(".room-extra");
  if (!el) return;
  e.preventDefault();
  const scene = root.querySelector(".room-scene");
  drag = { el, id: el.dataset.id, rect: scene.getBoundingClientRect(), x: null, y: null, moved: false };
  dragging = true;
  el.classList.add("dragging");
  try { el.setPointerCapture(e.pointerId); } catch (_) {}
  window.addEventListener("pointermove", onExtraMove);
  window.addEventListener("pointerup", onExtraUp, { once: true });
}
function onExtraMove(e) {
  if (!drag) return;
  drag.moved = true;
  drag.x = Math.min(96, Math.max(3, (e.clientX - drag.rect.left) / drag.rect.width * 100));
  drag.y = Math.min(93, Math.max(4, (e.clientY - drag.rect.top) / drag.rect.height * 100));
  drag.el.style.cssText += `;left:${drag.x}%;top:${drag.y}%;right:auto;bottom:auto;transform:translate(-50%,-50%)`;
}
function onExtraUp() {
  window.removeEventListener("pointermove", onExtraMove);
  const d = drag; drag = null; dragging = false;
  if (!d) return;
  d.el.classList.remove("dragging");
  if (d.moved && d.x != null) setDecorPos(d.id, +d.x.toFixed(1), +d.y.toFixed(1));
}

const petTimer = {};
function bumpPets(cat) {
  const next = ((state[cat] && state[cat].pets) || 0) + 1;
  state[cat] = { ...(state[cat] || { cat }), cat, pets: next };
  const el = root.querySelector("#spot-" + cat + " .pet-count");
  if (el) el.textContent = `🤍 petted ${next}×`;
  clearTimeout(petTimer[cat]);      // coalesce rapid pets into one write
  petTimer[cat] = setTimeout(() => {
    supabase.from("moods").update({ pets: state[cat].pets }).eq("cat", cat);
  }, 500);
}

/* ---------- wiring ---------- */
function wireHandlers() {
  root.querySelectorAll(".nook").forEach((nook) => {
    const cat = nook.dataset.cat;
    nook.querySelector(".cat-wrap").addEventListener("click", () => petCat(cat));
    nook.querySelector(".mood-bubble").addEventListener("click", () => openPicker(cat));
  });
  root.querySelector(".mood-cancel").addEventListener("click", closePicker);
  root.querySelector(".mood-modal").addEventListener("click", (e) => {
    if (e.target.classList.contains("mood-modal")) closePicker();
  });
  root.querySelector(".mood-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".mood-chip");
    if (btn && picking) setMood(picking, btn.dataset.key);
  });
  root.querySelector(".room-signout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
  });
  root.querySelector(".room-extras").addEventListener("pointerdown", onExtraDown);
}

/* ---------- markup ---------- */
function roomShell() {
  return `
  <div class="journal room">
    <button class="room-signout" title="sign out">leave 🐾</button>
    <p class="kicker">our little room</p>
    <h2 class="title title--sm">how we're feeling</h2>
    <p class="room-status"></p>

    <div class="room-scene">
      <div class="treat-balance-room" title="treats"></div>
      <div class="room-extras" aria-hidden="true"></div>
      <span class="deco-garland" aria-hidden="true"></span>
      <span class="deco-frame" aria-hidden="true">♡</span>
      <span class="deco-plant" aria-hidden="true"></span>
      <span class="deco deco-shelf" aria-hidden="true"><svg viewBox="0 0 64 46" width="100%" height="100%"><rect x="2" y="32" width="60" height="5" rx="1.5" fill="#b98a5c"/><rect x="9" y="12" width="7" height="20" fill="#c8785b"/><rect x="17" y="8" width="7" height="24" fill="#8a9a7b"/><rect x="25" y="14" width="7" height="18" fill="#e0b878"/><g transform="rotate(9 39 22)"><rect x="35" y="11" width="7" height="21" fill="#a85c41"/></g><rect x="49" y="26" width="9" height="6" fill="#c8785b"/><ellipse cx="53.5" cy="24" rx="7" ry="7" fill="#8a9a7b"/></svg></span>
      <span class="deco deco-clock" aria-hidden="true"><svg viewBox="0 0 30 30" width="100%" height="100%"><circle cx="15" cy="15" r="13" fill="#fffaf0" stroke="#b98a5c" stroke-width="2"/><path d="M15 15 V7 M15 15 l5 3" stroke="#5a4632" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg></span>
      <div class="room-rug" aria-hidden="true"></div>

      <div class="room-nooks">
        ${nook("lion", "terra")}
        ${nook("mimi", "sage")}
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

function nook(cat, cushion) {
  return `
  <div class="nook" data-cat="${cat}" id="spot-${cat}">
    <div class="window"><div class="sky"></div></div>
    <div class="cat-wrap">
      <span class="zzz-room">z &nbsp;z &nbsp;z</span>
      <span class="cat-hat" aria-hidden="true"></span>
      <div class="cushion cushion--${cushion}"></div>
      ${catSVG(cat)}
    </div>
    <div class="mood-bubble" title="tap to change mood"></div>
    <div class="nameplate"></div>
    <div class="pet-count"></div>
    <span class="tap-hint">tap me to pet 🐾 · tap my mood to change it</span>
  </div>`;
}

function catSVG(cat) {
  if (cat === "lion") {
    return `
    <svg class="roomcat" viewBox="0 0 130 100" role="img" aria-label="Lion">
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
      </g>
      <g class="cat-face"></g>
    </svg>`;
  }
  return `
  <svg class="roomcat" viewBox="0 0 130 100" role="img" aria-label="Mimi">
    <g stroke="#9c7536" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M92 82 q30 4 34 -14 q3 -13 -12 -17" fill="#e2ba7e"/>
      <path d="M12 80 q-2 -47 42 -51 q49 -4 64 22 q12 21 -8 37 q-52 14 -98 -8 z" fill="#e2ba7e"/>
      <path d="M34 47 q0 -10 9 -10 q8 0 8 9 z" fill="#e2ba7e"/>
      <path d="M55 44 q0 -10 9 -10 q8 0 8 9 z" fill="#e2ba7e"/>
    </g>
    <g class="cat-face"></g>
  </svg>`;
}
