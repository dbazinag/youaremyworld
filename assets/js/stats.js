/* =========================================================
   Us, in numbers 📊 — a live "time in love" counter plus a
   little dashboard of everything we've built together.
   Pulls counts from Supabase; treats live from the wallet.
   ========================================================= */

import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";
import { onWalletChange, getState } from "./wallet.js";

const HOMES = { lion: { lat: 46.519, lon: 6.632 }, mimi: { lat: 44.389, lon: -79.690 } };
const MOOD_EMOJI = {
  cozy: "😌", lovey: "🥰", happy: "😺", missing: "🥺", sad: "😢",
  sleepy: "😴", grumpy: "😾", stressed: "😰", hungry: "🍽️", playful: "😼",
};

let root = null, ticker = null;
const since = () => new Date(CONFIG.togetherSince + "T00:00:00");
const reunion = () => new Date(CONFIG.reunionISO);

export async function initStats(container) {
  root = container;
  root.innerHTML = shell();

  setStat("distance", haversine(HOMES.lion, HOMES.mimi).toLocaleString() + " km");
  tick();
  clearInterval(ticker);
  ticker = setInterval(tick, 1000);

  onWalletChange((s) => setStat("treats", s.treats));
  setStat("treats", getState().treats);

  await loadCounts();
}

/* ---------- live ---------- */
function tick() {
  const now = Date.now();
  const ms = now - since().getTime();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  set("[data-d]", d.toLocaleString());
  set("[data-h]", pad(h));
  set("[data-m]", pad(m));
  set("[data-s]", pad(s));

  root.querySelector(".love-caption").innerHTML = `<strong>${cal()}</strong> in love 🤍`;

  // days together + reunion
  setStat("together", d.toLocaleString());
  const rMs = reunion().getTime() - now;
  setStat("reunion", rMs <= 0 ? "together! 🎉" : Math.ceil(rMs / 86400000));

  // milestones
  const nextHundred = (Math.floor(d / 100) + 1) * 100;
  const toAnniv = daysToAnniversary();
  root.querySelector(".milestone-line").innerHTML =
    `🎉 ${nextHundred - d} days to your <strong>${nextHundred}th</strong> day together` +
    ` &nbsp;·&nbsp; 💞 anniversary in <strong>${toAnniv}</strong> days`;
}

function cal() {
  const a = since(), b = new Date();
  let y = b.getFullYear() - a.getFullYear();
  let mo = b.getMonth() - a.getMonth();
  let da = b.getDate() - a.getDate();
  if (da < 0) { mo--; da += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
  if (mo < 0) { y--; mo += 12; }
  const part = (n, w) => n ? `${n} ${w}${n === 1 ? "" : "s"}` : "";
  return [part(y, "year"), part(mo, "month"), part(da, "day")].filter(Boolean).join(", ") || "today";
}

function daysToAnniversary() {
  const now = new Date();
  const a = since();
  let next = new Date(now.getFullYear(), a.getMonth(), a.getDate());
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < midnight) next = new Date(now.getFullYear() + 1, a.getMonth(), a.getDate());
  return Math.round((next - midnight) / 86400000);
}

/* ---------- counts ---------- */
async function loadCounts() {
  const [mem, places, doo, moods] = await Promise.all([
    supabase.from("memories").select("*", { count: "exact", head: true }),
    supabase.from("places").select("wish"),
    supabase.from("doodles").select("*", { count: "exact", head: true }),
    supabase.from("moods").select("cat,mood,pets"),
  ]);

  setStat("memories", mem.count ?? 0);
  const pl = places.data || [];
  setStat("places", pl.filter((p) => !p.wish).length);
  setStat("dreams", pl.filter((p) => p.wish).length);
  setStat("doodles", doo.count ?? 0);

  const md = moods.data || [];
  setStat("pets", md.reduce((n, x) => n + (x.pets || 0), 0).toLocaleString());

  const byCat = Object.fromEntries(md.map((x) => [x.cat, x]));
  const line = ["lion", "mimi"].map((c) => {
    const p = CONFIG.people[c];
    const mood = byCat[c] ? byCat[c].mood : "cozy";
    return `<strong>${p.name}</strong> ${MOOD_EMOJI[mood] || "😌"} ${mood}`;
  }).join(" &nbsp;·&nbsp; ");
  root.querySelector(".mood-line").innerHTML = line;
}

/* ---------- helpers ---------- */
function haversine(a, b) {
  const R = 6371, rad = (x) => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
function pad(n) { return String(n).padStart(2, "0"); }
function set(sel, v) { const el = root.querySelector(sel); if (el) el.textContent = v; }
function setStat(name, v) { const el = root.querySelector(`[data-stat="${name}"]`); if (el) el.textContent = v; }

/* ---------- markup ---------- */
function card(stat, label, ico) {
  return `<div class="stat-card"><span class="stat-ico">${ico}</span><span class="stat-num" data-stat="${stat}">–</span><span class="stat-lbl">${label}</span></div>`;
}
function shell() {
  return `
  <div class="journal stats">
    <p class="kicker">us, in numbers</p>
    <h2 class="title title--sm">our love, counting</h2>

    <div class="love-counter">
      <div class="lc-unit"><span class="lc-num" data-d>–</span><span class="lc-lbl">days</span></div>
      <div class="lc-unit"><span class="lc-num" data-h>–</span><span class="lc-lbl">hours</span></div>
      <div class="lc-unit"><span class="lc-num" data-m>–</span><span class="lc-lbl">minutes</span></div>
      <div class="lc-unit"><span class="lc-num" data-s>–</span><span class="lc-lbl">seconds</span></div>
    </div>
    <p class="love-caption"></p>
    <p class="milestone-line"></p>

    <div class="stat-grid">
      ${card("together", "days together", "💞")}
      ${card("reunion", "days till we meet", "✈️")}
      ${card("distance", "apart", "🌍")}
      ${card("memories", "memories", "📸")}
      ${card("places", "places been", "📍")}
      ${card("dreams", "dream spots", "✦")}
      ${card("doodles", "doodles", "✏️")}
      ${card("pets", "cat pets", "🐾")}
      ${card("treats", "treats", "🐟")}
    </div>

    <p class="mood-line"></p>
  </div>`;
}
