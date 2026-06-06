/* =========================================================
   Doodle exchange ✏️ — draw little doodles for each other;
   they pin up on a shared board. Drawings are PNGs in a
   private Storage bucket; rows in public.doodles sync live.
   ========================================================= */

import { supabase } from "./supabase.js";

const BG = "#fffef9";
const COLORS = ["#3b332c", "#c8785b", "#8a9a7b", "#e3a692", "#5a7d9a", "#d8a23a"];

let root = null, canvas = null, ctx = null;
let drawing = false, last = null, color = COLORS[0], erasing = false;
let doodles = [];

export async function initDoodles(container) {
  root = container;
  root.innerHTML = shell();
  setupCanvas();
  wire();
  await load();
  supabase
    .channel("doodles-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "doodles" }, load)
    .subscribe();
}

/* ---------- canvas ---------- */
function setupCanvas() {
  canvas = root.querySelector(".doodle-canvas");
  canvas.width = 640;
  canvas.height = 440;
  ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  clearCanvas();

  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    last = posOf(e);
    canvas.setPointerCapture(e.pointerId);
    stroke(last, last); // a dot for taps
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = posOf(e);
    stroke(last, p);
    last = p;
  });
  canvas.addEventListener("pointerup", () => { drawing = false; });
  canvas.addEventListener("pointercancel", () => { drawing = false; });
}

function posOf(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function stroke(a, b) {
  ctx.strokeStyle = erasing ? BG : color;
  ctx.lineWidth = erasing ? 26 : 4;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function clearCanvas() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/* ---------- data ---------- */
async function load() {
  const { data, error } = await supabase
    .from("doodles").select("*").order("created_at", { ascending: false });
  if (error) { setStatus("couldn't load 😿 — " + error.message); return; }
  doodles = data || [];
  renderBoard();
}

async function send() {
  const btn = root.querySelector(".tool-send");
  btn.disabled = true; btn.textContent = "sending…";
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;

  const { error: up } = await supabase.storage.from("doodles").upload(path, blob, { contentType: "image/png" });
  if (up) { setStatus("upload failed 😿 — " + up.message); resetSend(); return; }
  const { error } = await supabase.from("doodles").insert({ path });
  resetSend();
  if (error) { setStatus("couldn't send 😿 — " + error.message); return; }

  clearCanvas();
  setStatus("pinned it up 🤍");
  await load();
}

function resetSend() {
  const btn = root.querySelector(".tool-send");
  btn.disabled = false; btn.textContent = "send 🤍";
}

async function signed(path) {
  const { data } = await supabase.storage.from("doodles").createSignedUrl(path, 3600);
  return data ? data.signedUrl : null;
}

/* ---------- board ---------- */
function renderBoard() {
  const board = root.querySelector(".doodle-board");
  if (!doodles.length) {
    board.innerHTML = `<p class="muted">no doodles yet — draw something silly above ✏️</p>`;
    return;
  }
  board.innerHTML = doodles.map((d) =>
    `<figure class="doodle-note" style="--rot:${rot(d.id)}deg">
       <span class="po-tape" aria-hidden="true"></span>
       <div class="doodle-img" data-path="${d.path}"></div>
       <button class="doodle-del" data-id="${d.id}" data-path="${d.path}" title="remove">×</button>
     </figure>`
  ).join("");

  doodles.forEach(async (d) => {
    const url = await signed(d.path);
    const el = board.querySelector(`.doodle-img[data-path="${d.path}"]`);
    if (url && el) el.style.backgroundImage = `url("${url}")`;
  });
}

/* ---------- wiring ---------- */
function wire() {
  root.querySelector(".doodle-colors").addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw) return;
    color = sw.dataset.color; erasing = false;
    root.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("on", s === sw));
    root.querySelector(".tool-eraser").classList.remove("on");
  });
  root.querySelector(".tool-eraser").addEventListener("click", (e) => {
    erasing = !erasing;
    e.currentTarget.classList.toggle("on", erasing);
  });
  root.querySelector(".tool-clear").addEventListener("click", clearCanvas);
  root.querySelector(".tool-send").addEventListener("click", send);

  root.querySelector(".doodle-board").addEventListener("click", async (e) => {
    const del = e.target.closest(".doodle-del");
    if (!del) return;
    await supabase.from("doodles").delete().eq("id", del.dataset.id);
    await supabase.storage.from("doodles").remove([del.dataset.path]);
    await load();
  });
}

/* ---------- helpers ---------- */
function setStatus(t) { root.querySelector(".doodle-status").textContent = t; }
function rot(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 9;
  return ((h - 4) * 0.9).toFixed(2);
}

/* ---------- markup ---------- */
function shell() {
  return `
  <div class="journal doodles">
    <p class="kicker">draw me something</p>
    <h2 class="title title--sm">our doodles</h2>
    <p class="doodle-status"></p>

    <div class="doodle-pad">
      <canvas class="doodle-canvas"></canvas>
      <div class="doodle-tools">
        <div class="doodle-colors">
          ${COLORS.map((c, i) =>
            `<button class="swatch${i === 0 ? " on" : ""}" data-color="${c}" style="background:${c}" aria-label="colour"></button>`
          ).join("")}
        </div>
        <button class="tool-eraser">eraser</button>
        <button class="tool-clear">clear</button>
        <button class="btn tool-send">send 🤍</button>
      </div>
    </div>

    <div class="doodle-board"></div>
  </div>`;
}
