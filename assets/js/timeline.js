/* =========================================================
   The timeline / scrapbook — our memories.
     • Scrapbook    — tilted polaroids (multiple photos each)
     • Constellation — memories grouped by place into little
                       clusters of connected stars in a starry sky
   Photos live in a private Supabase Storage bucket ("memories")
   and are shown via short-lived signed URLs.
   ========================================================= */

import { supabase } from "./supabase.js";
import exifr from "https://esm.sh/exifr@7";
import { earn } from "./wallet.js";

let root = null;
let modalEl = null;   // add-memory form  (moved to <body>)
let detailEl = null;  // memory lightbox  (moved to <body>)
let memories = [];
let mode = "scrapbook";

export async function initTimeline(container) {
  root = container;
  root.innerHTML = shell();
  // Move the overlays out to <body> so their position:fixed is relative to the
  // viewport, not trapped by any transformed/animated ancestor in the app shell.
  modalEl  = root.querySelector(".tl-modal");
  detailEl = root.querySelector(".tl-detail");
  document.body.appendChild(modalEl);
  document.body.appendChild(detailEl);
  wire();
  await load();
}

/* ---------- data ---------- */
async function load() {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) { setStatus("couldn't load memories 😿 — " + error.message); return; }
  memories = data || [];
  refreshPlaceOptions();
  render();
}

/* suggest places already used, so we don't fragment "Paris" / "Paris, FR" */
function refreshPlaceOptions() {
  const places = [...new Set(memories.map((m) => (m.place || "").trim()).filter(Boolean))].sort();
  const dl = modalEl.querySelector("#place-options");
  if (dl) dl.innerHTML = places.map((p) => `<option value="${esc(p)}"></option>`).join("");
}

/* auto-fill the date from the first photo's EXIF "date taken" (if blank) */
async function onPhotoPicked(e) {
  const dateInput = modalEl.querySelector('input[name="date"]');
  if (dateInput.value) return;                 // don't clobber a typed date
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const data = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    const dt = data && (data.DateTimeOriginal || data.CreateDate);
    if (dt instanceof Date && !isNaN(dt)) {
      dateInput.value = toYMD(dt);
      setStatus("📅 date filled in from the photo");
    }
  } catch (_) { /* no EXIF — leave it for them to type */ }
}

function toYMD(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function photosOf(m) {
  if (m.photo_paths && m.photo_paths.length) return m.photo_paths;
  return m.photo_path ? [m.photo_path] : [];          // legacy single-photo rows
}

async function addMemory(form) {
  const fd = new FormData(form);
  const title = (fd.get("title") || "").toString().trim();
  const date  = fd.get("date");
  const note  = (fd.get("note") || "").toString().trim() || null;
  const place = (fd.get("place") || "").toString().trim() || null;
  const files = fd.getAll("photo").filter((f) => f && f.size);
  if (!title || !date) return;

  setSaving(true);
  const photo_paths = [];
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      setStatus(`"${file.name}" is over 10MB — skip or shrink it 🐾`); setSaving(false); return;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("memories").upload(path, file);
    if (upErr) { setStatus("photo upload failed 😿 — " + upErr.message); setSaving(false); return; }
    photo_paths.push(path);
  }

  const { error } = await supabase.from("memories")
    .insert({ title, note, event_date: date, place, photo_paths });

  setSaving(false);
  if (error) { setStatus("couldn't save 😿 — " + error.message); return; }

  closeForm();
  setStatus("");
  earn(5);            // a new memory earns treats 🐟
  await load();
}

async function signed(path) {
  const { data } = await supabase.storage.from("memories").createSignedUrl(path, 3600);
  return data ? data.signedUrl : null;
}

/* ---------- render ---------- */
function render() {
  root.querySelectorAll(".tl-toggle button").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode));

  const view = root.querySelector(".tl-view");
  if (memories.length === 0) {
    view.innerHTML = `<p class="tl-empty">no memories yet —
      tap <strong>+ add a memory</strong> to start our scrapbook 🤍</p>`;
    return;
  }
  if (mode === "scrapbook") renderScrapbook(view);
  else renderConstellation(view);
}

function renderScrapbook(view) {
  view.innerHTML = `<div class="scrapbook">${memories.map(polaroid).join("")}</div>`;
  view.querySelectorAll(".polaroid").forEach((el) =>
    el.addEventListener("click", () => openMemory(el.dataset.id)));

  memories.forEach(async (m) => {
    const photos = photosOf(m);
    if (!photos.length) return;
    const url = await signed(photos[0]);
    const holder = view.querySelector(`.po-photo[data-id="${m.id}"]`);
    if (url && holder) {
      holder.style.backgroundImage = `url("${url}")`;
      holder.classList.add("loaded");
      holder.querySelector(".po-loading")?.remove();
    }
  });
}

function polaroid(m) {
  const photos = photosOf(m);
  const more = photos.length > 1 ? `<span class="po-count">+${photos.length - 1}</span>` : "";
  const photo = photos.length
    ? `<div class="po-photo" data-id="${m.id}"><span class="po-loading">🐾</span>${more}</div>`
    : `<div class="po-photo po-nophoto">🤍</div>`;
  const place = m.place ? `<span class="po-place">✦ ${esc(m.place)}</span>` : "";
  return `
  <figure class="polaroid" data-id="${m.id}" style="${vary(m.id)}">
    <span class="po-tape" aria-hidden="true"></span>
    ${photo}
    <figcaption>
      <span class="po-title">${esc(m.title)}</span>
      <span class="po-date">${fmtDate(m.event_date)}</span>
      ${place}
    </figcaption>
  </figure>`;
}

/* ---------- constellation ---------- */
function renderConstellation(view) {
  const W = 820, H = 500;
  const rnd = mulberry32(20260606);

  // ambient sky: scattered dim stars + a few sparkles
  let deco = "";
  for (let i = 0; i < 60; i++) {
    deco += `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(0.5 + rnd() * 1.7).toFixed(1)}" fill="#cdd6f0" opacity="${(0.25 + rnd() * 0.5).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 7; i++) deco += sparkle(rnd() * W, rnd() * H);

  // group memories by place (ungrouped share one quiet cluster)
  const groups = {};
  for (const m of memories) {
    const key = (m.place || "").trim() || "·";
    (groups[key] ||= []).push(m);
  }
  const keys = Object.keys(groups);
  const anchors = anchorsFor(keys.length, W, H, rnd);

  let lines = "", stars = "", labels = "";
  keys.forEach((key, gi) => {
    const items = groups[key];
    const a = anchors[gi];
    const pts = items.map((m, j) => {
      const ang = (j / Math.max(1, items.length)) * Math.PI * 2 + gi * 1.3;
      const rad = items.length === 1 ? 0 : 24 + (j % 3) * 15;
      return {
        x: a.x + Math.cos(ang) * rad + (rnd() - 0.5) * 12,
        y: a.y + Math.sin(ang) * rad * 0.8 + (rnd() - 0.5) * 12,
        m,
      };
    });
    if (pts.length > 1) {
      const d = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(0) + " " + p.y.toFixed(0)).join(" ");
      lines += `<path d="${d}" class="cline"/>`;
    }
    pts.forEach((p) => {
      stars += `<g class="cstar" data-id="${p.m.id}" transform="translate(${p.x.toFixed(0)},${p.y.toFixed(0)})">
          <circle r="15" fill="transparent"/>
          <path class="star-shape" d="M0 -7 L2 -2.2 L7 -2.2 L3 1.4 L4.6 6.6 L0 3.4 L-4.6 6.6 L-3 1.4 L-7 -2.2 L-2 -2.2 Z"/>
        </g>`;
    });
    if (key !== "·") {
      const ly = Math.max(...pts.map((p) => p.y)) + 20;
      labels += `<text x="${a.x.toFixed(0)}" y="${ly.toFixed(0)}" class="clabel">${esc(key)}</text>`;
    }
  });

  view.innerHTML = `
    <div class="sky-wrap">
      <svg viewBox="0 0 ${W} ${H}" class="sky-svg" preserveAspectRatio="xMidYMid meet">
        ${deco}${lines}${labels}${stars}
      </svg>
    </div>
    <p class="sky-hint">tap a star ✦ — your places, drawn in the sky</p>`;

  view.querySelectorAll(".cstar").forEach((s) =>
    s.addEventListener("click", () => openMemory(s.dataset.id)));
}

/* spread cluster centres across the sky on a loose jittered grid */
function anchorsFor(n, W, H, rnd) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    out.push({
      x: W * ((c + 0.5) / cols) + (rnd() - 0.5) * (W / cols) * 0.4,
      y: H * ((r + 0.5) / rows) + (rnd() - 0.5) * (H / rows) * 0.4,
    });
  }
  return out;
}

function sparkle(x, y) {
  const p = (n) => n.toFixed(1);
  return `<path d="M${p(x)} ${p(y - 6)} L${p(x + 1.3)} ${p(y - 1.3)} L${p(x + 6)} ${p(y)} L${p(x + 1.3)} ${p(y + 1.3)} L${p(x)} ${p(y + 6)} L${p(x - 1.3)} ${p(y + 1.3)} L${p(x - 6)} ${p(y)} L${p(x - 1.3)} ${p(y - 1.3)} Z" fill="#eaf0ff" opacity="0.85"/>`;
}

/* ---------- memory detail (shared by both views) ---------- */
async function openMemory(id) {
  const m = memories.find((x) => x.id === id);
  if (!m) return;
  detailEl.querySelector(".detail-title").textContent = m.title;
  detailEl.querySelector(".detail-meta").textContent =
    fmtDate(m.event_date) + (m.place ? ` · ${m.place}` : "");
  detailEl.querySelector(".detail-note").textContent = m.note || "";
  const strip = detailEl.querySelector(".detail-photos");

  const photos = photosOf(m);
  strip.innerHTML = photos.length ? `<span class="po-loading">🐾</span>` : "";
  detailEl.hidden = false;

  if (photos.length) {
    const { data } = await supabase.storage.from("memories").createSignedUrls(photos, 3600);
    strip.innerHTML = (data || [])
      .map((d) => d.signedUrl ? `<img src="${d.signedUrl}" alt="" />` : "")
      .join("");
  }
}

/* ---------- wiring ---------- */
function wire() {
  root.querySelector(".tl-add").addEventListener("click", openForm);
  modalEl.querySelector(".tl-cancel").addEventListener("click", closeForm);
  modalEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("tl-modal")) closeForm();
  });
  modalEl.querySelector(".tl-form").addEventListener("submit", (e) => {
    e.preventDefault();
    addMemory(e.currentTarget);
  });
  modalEl.querySelector('input[name="photo"]').addEventListener("change", onPhotoPicked);
  root.querySelector(".tl-toggle").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { mode = b.dataset.mode; render(); }
  });
  detailEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("tl-detail") || e.target.classList.contains("detail-close"))
      detailEl.hidden = true;
  });
}

function openForm()  { modalEl.hidden = false; }
function closeForm() { modalEl.hidden = true; modalEl.querySelector(".tl-form").reset(); }
function setStatus(t){ root.querySelector(".tl-status").textContent = t; }
function setSaving(on) {
  const btn = modalEl.querySelector(".tl-save");
  btn.disabled = on;
  btn.textContent = on ? "saving…" : "save it 🤍";
}

/* ---------- helpers ---------- */
function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB",
    { day: "numeric", month: "short", year: "numeric" });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/* deterministic per-memory styling so each polaroid looks hand-placed */
function vary(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 131 + c.charCodeAt(0)) >>> 0;
  const r = (s) => (((h >>> s) % 1000) / 1000);
  const rot = (r(0) * 8 - 4).toFixed(2);     // -4..4 deg slant
  const tl  = (22 + r(3) * 46).toFixed(0);   // tape 22%..68% across
  const tr  = (r(7) * 26 - 13).toFixed(1);   // tape -13..13 deg
  const tw  = (46 + r(11) * 26).toFixed(0);  // tape 46..72px wide
  const tapes = [
    "rgba(224,196,138,0.55)", "rgba(200,120,91,0.42)",
    "rgba(138,154,123,0.42)", "rgba(227,166,146,0.48)",
  ];
  return `--rot:${rot}deg;--tl:${tl}%;--tr:${tr}deg;--tw:${tw}px;--tb:${tapes[h % tapes.length]};`;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- markup ---------- */
function shell() {
  return `
  <div class="journal tl">
    <p class="kicker">our memories, kept</p>
    <h2 class="title title--sm">the scrapbook</h2>
    <p class="tl-status"></p>

    <div class="tl-bar">
      <div class="tl-toggle">
        <button data-mode="scrapbook" class="active">📖 scrapbook</button>
        <button data-mode="constellation">✦ constellation</button>
      </div>
      <button class="tl-add btn">+ add a memory</button>
    </div>

    <div class="tl-view"></div>
  </div>

  <div class="tl-modal" hidden>
    <form class="tl-form">
      <p class="tl-form-title">a new memory</p>
      <label>what happened?
        <input name="title" required maxlength="80" placeholder="our first…" />
      </label>
      <label>when?
        <input name="date" type="date" required />
      </label>
      <label>where? <span class="opt">(optional — groups it in the sky)</span>
        <input name="place" maxlength="40" list="place-options" autocomplete="off" placeholder="Lausanne, our Paris trip…" />
        <datalist id="place-options"></datalist>
      </label>
      <label>a little note <span class="opt">(optional)</span>
        <textarea name="note" maxlength="500" rows="2" placeholder="something to remember…"></textarea>
      </label>
      <label>photos <span class="opt">(optional — you can pick several)</span>
        <input name="photo" type="file" accept="image/*" multiple />
      </label>
      <div class="tl-form-actions">
        <button type="button" class="tl-cancel">never mind</button>
        <button type="submit" class="btn tl-save">save it 🤍</button>
      </div>
    </form>
  </div>

  <div class="tl-detail" hidden>
    <div class="detail-card">
      <button class="detail-close" aria-label="close">×</button>
      <div class="detail-photos"></div>
      <strong class="detail-title"></strong>
      <span class="detail-meta"></span>
      <p class="detail-note"></p>
    </div>
  </div>`;
}
