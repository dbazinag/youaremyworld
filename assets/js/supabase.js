/* =========================================================
   Supabase client — shared by the whole app.
   Loaded straight from a CDN so there's no build step.
   ========================================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONFIG } from "./config.js";

export const supabase = createClient(
  CONFIG.supabase.url,
  CONFIG.supabase.publishableKey,
  {
    auth: {
      persistSession: true,      // stay logged in across visits
      autoRefreshToken: true,
    },
  }
);
