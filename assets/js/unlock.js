/* =========================================================
   The unlock flow 🔐 — a simple password box that signs into
   the shared Supabase account. (The password itself is NOT in
   this code — it lives in Supabase Auth.)
   ========================================================= */

import { supabase } from "./supabase.js";
import { CONFIG } from "./config.js";

export function initUnlock(container, solved) {
  container.innerHTML = `
  <div class="journal journal--small unlock">
    <p class="kicker">just between us two</p>
    <h2 class="title title--sm">let us in 🐾</h2>
    <form class="gate-form">
      <input class="gate-input" type="password" autocomplete="off" placeholder="our magic word" aria-label="password" />
      <button class="btn" type="submit">unlock 🤍</button>
    </form>
    <p class="gate-error" hidden>hmm, not quite. try again 🐾</p>
  </div>`;

  const form = container.querySelector(".gate-form");
  const input = container.querySelector(".gate-input");
  const error = container.querySelector(".gate-error");
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
    else solved();
  });
}
