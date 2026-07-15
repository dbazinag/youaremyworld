/* =========================================================
   Edit-me config. The few values that change over time live here
   so you never have to dig through the app code.
   ========================================================= */

export const CONFIG = {
  // The reunion you're counting down to.
  // Format: YYYY-MM-DDTHH:mm:ss followed by the UTC offset.
  // August 14, 2026, 5:00 PM in Ireland (Irish Standard Time, IST = +01:00):
  reunionISO: "2026-08-14T17:00:00+01:00",

  // the day it all began 🤍 (used by the stats / time-in-love counter)
  togetherSince: "2025-04-25",

  // Supabase backend. The publishable key is meant to be public — your data is
  // protected by access rules (RLS), not by hiding this key.
  supabase: {
    url: "https://wknpwvyfbgbbwhwsnors.supabase.co",
    publishableKey: "sb_publishable_DZCvNzOB59nXe9a-I5KXmg_NrAfPOWi",
    // The single shared account you BOTH log into. Create a user with EXACTLY
    // this email in Supabase (Authentication -> Users -> Add user), and whatever
    // password you set there becomes your shared "magic word".
    sharedEmail: "us@youaremyworld.love",
  },

  // Defaults until the editable settings page (backed by Supabase) exists.
  people: {
    lion: { name: "Lion", city: "Lausanne",        tz: "Europe/Zurich"  },
    mimi: { name: "Mimi", city: "Barrie, Ontario", tz: "America/Toronto" },
  },
};
