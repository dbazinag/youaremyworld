/* =========================================================
   The shop ✨ — spend 🐟 treats on cat hats + room decor,
   then dress up Mimi & Lion and place decor in the room.
   ========================================================= */

import { CATALOG, getState, buy, equipHat, toggleDecor, onWalletChange } from "./wallet.js";

let root = null;

export function initShop(container) {
  root = container;
  root.innerHTML = shell();
  wire();
  onWalletChange(render);
  render(getState());
}

function render(s) {
  if (!root) return;
  root.querySelector(".treat-balance").textContent = `🐟 ${s.treats} treats`;
  root.querySelector(".shop-hats").innerHTML = CATALOG.hats.map((it) => card(it, s)).join("");
  root.querySelector(".shop-decor").innerHTML = CATALOG.decor.map((it) => card(it, s)).join("");

  const ownedHats = CATALOG.hats.filter((h) => s.owned.has(h.id));
  root.querySelector(".dress-lion").innerHTML = hatPicker("lion", ownedHats, s);
  root.querySelector(".dress-mimi").innerHTML = hatPicker("mimi", ownedHats, s);

  const ownedDecor = CATALOG.decor.filter((d) => s.owned.has(d.id));
  root.querySelector(".place-decor").innerHTML = ownedDecor.length
    ? ownedDecor.map((d) =>
        `<button class="decor-toggle ${s.equipped.decor.includes(d.id) ? "on" : ""}" data-id="${d.id}">${d.emoji} ${d.name}</button>`
      ).join("")
    : `<span class="muted">buy some decor and you can place it here ✨</span>`;
}

function card(it, s) {
  const owned = s.owned.has(it.id);
  const afford = s.treats >= it.price;
  return `<div class="shop-item">
    <span class="shop-emoji">${it.emoji}</span>
    <span class="shop-name">${it.name}</span>
    ${owned
      ? `<span class="shop-owned">owned ✓</span>`
      : `<button class="shop-buy" data-id="${it.id}" ${afford ? "" : "disabled"}>🐟 ${it.price}</button>`}
  </div>`;
}

function hatPicker(cat, ownedHats, s) {
  const cur = s.equipped[cat];
  let html = `<button class="hat-pick ${cur == null ? "on" : ""}" data-cat="${cat}" data-id="">none</button>`;
  html += ownedHats.map((h) =>
    `<button class="hat-pick ${cur === h.id ? "on" : ""}" data-cat="${cat}" data-id="${h.id}" title="${h.name}">${h.emoji}</button>`
  ).join("");
  if (!ownedHats.length) html += `<span class="muted">buy a hat first ✨</span>`;
  return html;
}

function wire() {
  root.addEventListener("click", async (e) => {
    const buyBtn = e.target.closest(".shop-buy");
    if (buyBtn) {
      const r = await buy(buyBtn.dataset.id);
      if (!r.ok && r.reason === "poor") flash("not enough treats yet 🐟");
      return;
    }
    const hat = e.target.closest(".hat-pick");
    if (hat) { equipHat(hat.dataset.cat, hat.dataset.id || null); return; }
    const dec = e.target.closest(".decor-toggle");
    if (dec) { toggleDecor(dec.dataset.id); return; }
  });
}

function flash(t) {
  const el = root.querySelector(".shop-status");
  el.textContent = t;
  setTimeout(() => { if (el.textContent === t) el.textContent = ""; }, 2200);
}

function shell() {
  return `
  <div class="journal shop">
    <p class="kicker">earned by loving on each other</p>
    <h2 class="title title--sm">the treat shop</h2>
    <div class="treat-balance"></div>
    <p class="shop-hint">earn 🐟 by petting the cats, adding memories &amp; places</p>
    <p class="shop-status"></p>

    <h3 class="shop-h">🎀 hats for the cats</h3>
    <div class="shop-grid shop-hats"></div>

    <h3 class="shop-h">🪴 room decor</h3>
    <div class="shop-grid shop-decor"></div>

    <h3 class="shop-h">🐱 dress them up</h3>
    <div class="dress-row"><span class="dress-who">Lion</span><div class="dress-pick dress-lion"></div></div>
    <div class="dress-row"><span class="dress-who">Mimi</span><div class="dress-pick dress-mimi"></div></div>

    <h3 class="shop-h">✨ place in the room</h3>
    <div class="place-decor"></div>
  </div>`;
}
