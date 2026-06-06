/* =========================================================
   The unlock flow 🔐 — three little games, each revealing a
   hint word, building to the password. Then a password box
   that signs into the shared Supabase account.
   (The password itself is NOT in this code — only the hints.)
   ========================================================= */

import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";

const HINTS = ["your cat's name", "and", "my cat's name"];

let root = null, onSolved = null, step = 0, gameCleanup = null;

export function initUnlock(container, solved) {
  root = container;
  onSolved = solved;
  step = 0;
  render();
}

function render() {
  if (gameCleanup) { gameCleanup(); gameCleanup = null; }

  root.innerHTML = `
  <div class="journal journal--small unlock">
    <p class="kicker">just between us two</p>
    <h2 class="title title--sm">${step < 3 ? "three little games 🔐" : "you did it! 🤍"}</h2>
    <div class="unlock-locks">${[0, 1, 2].map((i) => `<span class="ulock">${i < step ? "🔓" : "🔒"}</span>`).join("")}</div>
    <div class="unlock-hints">${HINTS.slice(0, step).map((h, i) =>
      `<span class="hint-chip"><b>${i + 1}.</b> ${h}</span>`).join("")}</div>
    <div class="game-area"></div>
  </div>`;

  const area = root.querySelector(".game-area");
  if (step >= 3) return showPassword(area);
  [memoryGame, catchGame, tapGame][step](area, win);
}

function win() {
  step++;
  render();
}

/* ---------- password ---------- */
function showPassword(area) {
  area.innerHTML = `
    <p class="unlock-solved">the magic word is…</p>
    <p class="unlock-riddle">${HINTS.join(" &nbsp;+&nbsp; ")}</p>
    <form class="gate-form">
      <input class="gate-input" type="password" autocomplete="off" placeholder="our magic word" aria-label="password" />
      <button class="btn" type="submit">unlock 🤍</button>
    </form>
    <p class="gate-error" hidden>hmm, not quite. try again 🐾</p>`;

  const form = area.querySelector(".gate-form");
  const input = area.querySelector(".gate-input");
  const error = area.querySelector(".gate-error");
  const btn = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    btn.disabled = true; btn.textContent = "unlocking…";
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: CONFIG.supabase.sharedEmail,
      password: input.value.trim(),
    });
    btn.disabled = false; btn.textContent = "unlock 🤍";
    if (authError) { error.hidden = false; input.select(); }
    else onSolved();
  });
}

/* ---------- game 1: memory match ---------- */
function memoryGame(area, done) {
  const faces = ["🐱", "🐟", "🎀", "⭐", "🌙", "💗"];
  const deck = shuffle([...faces, ...faces]);
  let first = null, lock = false, matched = 0;

  area.innerHTML = `<p class="game-tip">match the pairs 🐾</p>
    <div class="mem-grid">${deck.map((f) =>
      `<button class="mem-card"><span class="mem-back">🐾</span><span class="mem-face">${f}</span></button>`
    ).join("")}</div>`;

  area.querySelectorAll(".mem-card").forEach((card, i) => {
    card.dataset.f = deck[i];
    card.addEventListener("click", () => {
      if (lock || card.classList.contains("flipped") || card.classList.contains("done")) return;
      card.classList.add("flipped");
      if (!first) { first = card; return; }
      if (first.dataset.f === card.dataset.f) {
        first.classList.add("done"); card.classList.add("done");
        matched += 2; first = null;
        if (matched === deck.length) setTimeout(done, 450);
      } else {
        lock = true;
        const a = first, b = card; first = null;
        setTimeout(() => { a.classList.remove("flipped"); b.classList.remove("flipped"); lock = false; }, 750);
      }
    });
  });
}

/* ---------- game 2: catch the treats ---------- */
function catchGame(area, done) {
  const need = 8;
  let score = 0, bx = 50, items = [];

  area.innerHTML = `<p class="game-tip">catch 8 treats — move your mouse / finger 🐟</p>
    <div class="catch-area">
      <div class="catch-score">0 / ${need}</div>
      <div class="basket">🧺</div>
    </div>`;

  const field = area.querySelector(".catch-area");
  const basket = area.querySelector(".basket");
  const scoreEl = area.querySelector(".catch-score");
  basket.style.left = bx + "%";

  field.addEventListener("pointermove", (e) => {
    const r = field.getBoundingClientRect();
    bx = Math.min(92, Math.max(8, (e.clientX - r.left) / r.width * 100));
    basket.style.left = bx + "%";
  });

  const spawn = setInterval(() => {
    const el = document.createElement("span");
    el.className = "falling";
    el.textContent = Math.random() < 0.82 ? "🐟" : "💗";
    const x = 8 + Math.random() * 84;
    el.style.left = x + "%"; el.style.top = "-8%";
    field.appendChild(el);
    items.push({ el, y: -8, x });
  }, 850);

  const loop = setInterval(() => {
    items.forEach((it) => {
      it.y += 3.2; it.el.style.top = it.y + "%";
      if (!it.caught && it.y >= 82 && it.y <= 92 && Math.abs(it.x - bx) < 11) {
        it.caught = true; it.el.remove();
        score++; scoreEl.textContent = `${score} / ${need}`;
        if (score >= need) { cleanup(); setTimeout(done, 350); }
      } else if (it.y > 104) { it.el.remove(); it.dead = true; }
    });
    items = items.filter((it) => !it.caught && !it.dead);
  }, 55);

  function cleanup() { clearInterval(spawn); clearInterval(loop); }
  gameCleanup = cleanup;
}

/* ---------- game 3: tap the cat ---------- */
function tapGame(area, done) {
  const need = 8;
  let score = 0;

  area.innerHTML = `<p class="game-tip">tap the cat when it peeks out 🐱</p>
    <div class="tap-score">0 / ${need}</div>
    <div class="tap-grid">${Array.from({ length: 9 }).map(() =>
      `<button class="tap-hole"><span class="tap-cat">🐱</span></button>`).join("")}</div>`;

  const holes = [...area.querySelectorAll(".tap-hole")];
  const scoreEl = area.querySelector(".tap-score");

  const show = setInterval(() => {
    holes.forEach((h) => h.classList.remove("up"));
    holes[Math.floor(Math.random() * holes.length)].classList.add("up");
  }, 820);

  holes.forEach((h) => h.addEventListener("click", () => {
    if (!h.classList.contains("up")) return;
    h.classList.remove("up");
    score++; scoreEl.textContent = `${score} / ${need}`;
    if (score >= need) { clearInterval(show); setTimeout(done, 300); }
  }));

  gameCleanup = () => clearInterval(show);
}

/* ---------- helpers ---------- */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
