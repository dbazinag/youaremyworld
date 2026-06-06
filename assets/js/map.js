/* =========================================================
   Our map — places we've been (from memory tags, auto-geocoded)
   + a someday wishlist, with our two homes joined by a thread.
   Leaflet + free CARTO/OSM tiles, warm-filtered to fit the theme.
   Geocoding via Nominatim (rate-limited, cached in the DB).
   ========================================================= */

import L from "https://esm.sh/leaflet@1.9.4";
import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";

const HOMES = [
  { label: `${CONFIG.people.lion.name}'s home`, city: CONFIG.people.lion.city, lat: 46.519, lon: 6.632 },
  { label: `${CONFIG.people.mimi.name}'s home`, city: CONFIG.people.mimi.city, lat: 44.389, lon: -79.690 },
];

/* a place that's really one of our homes shouldn't get a "been" heart */
function isHome(name) {
  const a = name.toLowerCase().trim();
  return HOMES.some((h) => {
    const c = h.city.toLowerCase().split(",")[0].trim();
    return a === c || a.includes(c) || c.includes(a);
  });
}

let root = null, map = null, markers = null, threadDrawn = false;
let places = [], memCounts = {};

export async function initMap(container) {
  root = container;
  root.innerHTML = shell();
  wire();
  setupMap();
  await load();
}

/* ---------- map ---------- */
function setupMap() {
  const el = root.querySelector(".map-canvas");
  map = L.map(el, { scrollWheelZoom: true, worldCopyJump: true }).setView([40, 0], 2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd", maxZoom: 18,
    attribution: '© OpenStreetMap · © CARTO',
  }).addTo(map);
  markers = L.layerGroup().addTo(map);
  setTimeout(() => map.invalidateSize(), 60); // in case it laid out while hidden
}

/* ---------- data ---------- */
async function load() {
  const { data: mems } = await supabase.from("memories").select("place");
  memCounts = {};
  const beenNames = [];
  for (const m of mems || []) {
    const n = (m.place || "").trim();
    if (!n) continue;
    memCounts[n] = (memCounts[n] || 0) + 1;
    if (!beenNames.includes(n)) beenNames.push(n);
  }

  let { data: pl } = await supabase.from("places").select("*");
  pl = pl || [];
  const have = new Set(pl.map((p) => p.name));
  const missing = beenNames.filter((n) => !have.has(n)).map((n) => ({ name: n, wish: false }));
  if (missing.length) {
    await supabase.from("places").insert(missing);
    ({ data: pl } = await supabase.from("places").select("*"));
    pl = pl || [];
  }
  places = pl;

  draw();
  renderLists();
  geocodeMissing();
}

/* ---------- geocoding (Nominatim, 1/sec, cached to DB) ---------- */
async function geocodeMissing() {
  const todo = places.filter((p) => p.lat == null);
  if (!todo.length) return;
  setStatus("finding places on the map…");
  for (const p of todo) {
    const hit = await geocode(p.name);
    if (hit) {
      p.lat = hit.lat; p.lon = hit.lon;
      await supabase.from("places").update({ lat: hit.lat, lon: hit.lon }).eq("id", p.id);
      draw();
    }
    await sleep(1100);
  }
  setStatus("");
  renderLists();
}

async function geocode(name) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (data && data[0]) return { lat: +data[0].lat, lon: +data[0].lon };
  } catch (_) { /* ignore */ }
  return null;
}

/* ---------- draw markers ---------- */
function draw() {
  markers.clearLayers();
  const bounds = [];

  // homes
  HOMES.forEach((h) => {
    L.marker([h.lat, h.lon], { icon: pin("home", "⌂") }).addTo(markers)
      .bindPopup(`<strong>${esc(h.label)}</strong><br>${esc(h.city)}`);
    bounds.push([h.lat, h.lon]);
  });

  // a gentle arc between the homes, with a heart at its peak
  const arc = arcPoints(HOMES[0], HOMES[1], 30);
  L.polyline(arc, { color: "#c8785b", weight: 2, dashArray: "3 7", opacity: 0.85 }).addTo(markers);
  L.marker(arc[Math.floor(arc.length / 2)], {
    interactive: false,
    icon: L.divIcon({ className: "", html: `<span class="thread-heart">♥</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
  }).addTo(markers);

  for (const p of places) {
    if (p.lat == null) continue;
    if (!p.wish && isHome(p.name)) continue;        // home, not a "been" spot
    const kind = p.wish ? "wish" : "been";
    const glyph = p.wish ? "✦" : "♥";
    const sub = p.wish ? "someday" : `${memCounts[p.name] || 0} ${(memCounts[p.name] === 1 ? "memory" : "memories")}`;
    L.marker([p.lat, p.lon], { icon: pin(kind, glyph) })
      .addTo(markers)
      .bindPopup(`<strong>${esc(p.name)}</strong><br>${sub}`);
    bounds.push([p.lat, p.lon]);
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
}

/* quadratic-bezier arc (control point bumped north) for a cute flight-path curve */
function arcPoints(a, b, n) {
  const cLat = (a.lat + b.lat) / 2 + 16, cLon = (a.lon + b.lon) / 2;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([
      u * u * a.lat + 2 * u * t * cLat + t * t * b.lat,
      u * u * a.lon + 2 * u * t * cLon + t * t * b.lon,
    ]);
  }
  return pts;
}

function pin(kind, glyph) {
  return L.divIcon({
    className: "",
    html: `<span class="pin pin--${kind}">${glyph}</span>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14],
  });
}

/* ---------- lists ---------- */
function renderLists() {
  const been = places.filter((p) => !p.wish && !isHome(p.name)).sort((a, b) => a.name.localeCompare(b.name));
  const wish = places.filter((p) => p.wish).sort((a, b) => a.name.localeCompare(b.name));

  root.querySelector(".been-list").innerHTML = been.length
    ? been.map((p) => `<li><button class="place-go" data-id="${p.id}">${esc(p.name)} ${
        p.lat == null ? `<span class="cnt muted">·not found</span>` : `<span class="cnt">♥${memCounts[p.name] || 0}</span>`
      }</button></li>`).join("")
    : `<li class="muted">tag a memory with a place and it'll appear here</li>`;

  root.querySelector(".wish-list").innerHTML = wish.length
    ? wish.map((p) => `<li><button class="place-go" data-id="${p.id}">${esc(p.name)}</button>
        <button class="place-del" data-id="${p.id}" title="remove">×</button></li>`).join("")
    : `<li class="muted">nowhere yet — add a dream spot ✦</li>`;
}

/* ---------- wiring ---------- */
function wire() {
  root.querySelector(".wish-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector("input");
    const name = input.value.trim();
    if (!name) return;
    input.value = "";
    const { error } = await supabase.from("places").insert({ name, wish: true });
    if (error) { setStatus("couldn't add 😿 — " + error.message); return; }
    await load();
  });

  root.querySelector(".map-lists").addEventListener("click", async (e) => {
    const go = e.target.closest(".place-go");
    if (go) {
      const p = places.find((x) => x.id === go.dataset.id);
      if (p && p.lat != null) { map.flyTo([p.lat, p.lon], 8); }
      return;
    }
    const del = e.target.closest(".place-del");
    if (del) {
      await supabase.from("places").delete().eq("id", del.dataset.id);
      await load();
    }
  });
}

/* ---------- helpers ---------- */
function setStatus(t) { root.querySelector(".map-status").textContent = t; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- markup ---------- */
function shell() {
  return `
  <div class="journal map">
    <p class="kicker">everywhere we've been</p>
    <h2 class="title title--sm">our map</h2>
    <p class="map-status"></p>
    <div class="map-canvas cozy-map"></div>
    <div class="map-lists">
      <div class="map-col">
        <h3 class="map-h">♥ places we've been</h3>
        <ul class="been-list"></ul>
      </div>
      <div class="map-col">
        <h3 class="map-h">✦ someday</h3>
        <ul class="wish-list"></ul>
        <form class="wish-form">
          <input name="place" placeholder="add a dream spot…" maxlength="60" autocomplete="off" />
          <button class="btn" type="submit">+ add</button>
        </form>
      </div>
    </div>
  </div>`;
}
