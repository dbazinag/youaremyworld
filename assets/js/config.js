/* =========================================================
   Edit-me config. The few values that change over time live here
   so you never have to dig through the app code.
   ========================================================= */

export const CONFIG = {
  // The reunion you're counting down to.
  // Format: YYYY-MM-DDTHH:mm:ss followed by the UTC offset.
  // June 18, 2026, 6:00 PM in Barrie (Eastern, EDT = -04:00):
  reunionISO: "2026-06-18T18:00:00-04:00",

  // Temporary front-end-only password (Phase 1). NOT secure — replaced by
  // the real shared Supabase login soon. Change it to whatever you like for now.
  placeholderPassword: "mimi+lion",

  // Defaults until the editable settings page (backed by Supabase) exists.
  people: {
    lion: { name: "Lion", city: "Lausanne",        tz: "Europe/Zurich"  },
    mimi: { name: "Mimi", city: "Barrie, Ontario", tz: "America/Toronto" },
  },
};
