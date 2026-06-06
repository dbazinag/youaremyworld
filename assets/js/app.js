/* =========================================================
   App shell — cozy tab nav between our pages (room, timeline).
   Each view is lazily initialised the first time it's opened,
   then just shown/hidden so its state (and realtime) persists.
   ========================================================= */

import { initRoom } from "./room.js";
import { initTimeline } from "./timeline.js";
import { initMap } from "./map.js";
import { initShop } from "./shop.js";
import { initWallet } from "./wallet.js";
import { initDoodles } from "./doodles.js";
import { initStats } from "./stats.js";

const VIEWS = [
  { key: "room",     label: "our room 🛋️",     init: initRoom },
  { key: "stats",    label: "us 📊",           init: initStats },
  { key: "timeline", label: "our timeline 📖", init: initTimeline },
  { key: "map",      label: "our map 🗺️",      init: initMap },
  { key: "doodles",  label: "doodles ✏️",      init: initDoodles },
  { key: "shop",     label: "shop ✨",         init: initShop, nav: false }, // reached from the room
];

let built = false;
const state = {};

export function initApp() {
  if (built) return;
  built = true;

  initWallet(); // shared treats/unlocks, loaded once

  const nav = document.getElementById("app-nav");
  const content = document.getElementById("app-content");

  nav.innerHTML = VIEWS.filter((v) => v.nav !== false).map((v) =>
    `<button class="app-tab" data-view="${v.key}">${v.label}</button>`
  ).join("");

  // let views navigate to one another (e.g. room -> shop -> room)
  document.addEventListener("app:navigate", (e) => showView(e.detail));

  for (const v of VIEWS) {
    const el = document.createElement("div");
    el.className = "app-view";
    el.style.display = "none";
    content.appendChild(el);
    state[v.key] = { el, init: v.init, done: false };
  }

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".app-tab");
    if (btn) showView(btn.dataset.view);
  });

  showView("room");
}

function showView(key) {
  for (const k in state) state[k].el.style.display = (k === key) ? "block" : "none";
  document.querySelectorAll(".app-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === key));

  const v = state[key];
  if (!v.done) { v.init(v.el); v.done = true; }
}
