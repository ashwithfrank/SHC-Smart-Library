/* ==========================================================
   supabase.js - connection to your Supabase project
   Loaded right after the Supabase library, BEFORE data.js.

   Supabase Dashboard > Project Settings > API
     - Project URL   -> SUPABASE_URL
     - anon public   -> SUPABASE_ANON_KEY   (safe for the browser)

   NEVER paste the "service_role" key anywhere in this project.
   ========================================================== */

const SUPABASE_URL = 'https://hfrxknkpetmkxskogvvp.supabase.co';        // e.g. https://abcdxyz.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmcnhrbmtwZXRta3hza29ndnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NDEzODIsImV4cCI6MjEwODQxNzM4Mn0.gsHPrCMlVkB7GvFiRX_ld9TGLFw4QJM9Qpyg_g8KKZg';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Supabase logs in with email, so a college ID becomes a hidden email:
//   DEMO001  ->  demo001@shc.local   (the user never sees or types this)
const ID_DOMAIN = '@shc.local';
const idToEmail = id => id.trim().toLowerCase() + ID_DOMAIN;
