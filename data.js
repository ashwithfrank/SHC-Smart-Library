/* ==========================================================
   data.js (Supabase version) - helpers + loading data
   Loaded after supabase.js.

   Idea: refresh() downloads the data from Supabase and puts it in
   the SAME shape the screens already use (DB.books, DB.loans ...).
   So views.js keeps working. Actions call the database functions,
   then refresh() and render() again.
   ========================================================== */

/* ---------- Global app state ---------- */
const emptyDB = () => ({
  set: { max: 3, days: 14, pickup: 2, dur: {} },
  students: [], staff: [], books: [], copies: [],
  loans: [], res: [], notes: [], audit: []
});

let DB = emptyDB();   // data shown on screen (loaded from Supabase)
let U = null;         // logged-in user (null = logged out)
let V = 'home';       // current screen name
let Q = '';           // current search text
let P = 0;            // current table page (0 = first)

/* ---------- Small helpers ---------- */
const $ = id => document.getElementById(id);
const g = id => $(id).value.trim();
const now = () => new Date();
const iso = d => d.toISOString();
const fd = s => (s ? new Date(s).toLocaleDateString('en-IN') : '-');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Old screens still call save() after some buttons. The database saves now, so do nothing.
const save = () => {};

function toast(message, isError) {
  const t = $('toast');
  t.textContent = message;
  t.className = isError ? 'e' : '';
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3200);
}

// Run a Supabase request; throw its error if there is one
async function must(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

/* ---------- Lookups and checks ---------- */
const stu   = id => DB.students.find(s => s.id === id);
const book  = id => DB.books.find(b => b.id === id);
const staff = () => U && U.role !== 'student';
const admin = () => U && U.role === 'admin';

function yr(s) {
  const duration = DB.set.dur[s.course] || 3;
  const y = now().getFullYear() - s.adm + (now().getMonth() >= 5 ? 1 : 0);
  return y > duration ? 'Graduated' : 'Year ' + Math.max(1, y) + ' of ' + duration;
}

const avail = bookId => DB.copies.filter(c => c.book === bookId && c.st === 'available').length;
const badge = s => `<span class="b ${s.toLowerCase().replace(/ /g, '')}">${esc(s)}</span>`;

/* ---------- Logged-in user ---------- */
const loadProfile = userId =>
  must(sb.from('profiles').select('*').eq('id', userId).maybeSingle());

function setUser(p) {
  // U.id is the college ID (what people type); U.uuid is the Supabase id
  U = { id: p.login_id, uuid: p.id, name: p.name, role: p.role,
        course: p.course, adm: p.adm_year, active: p.active };
}

/* ---------- Load everything this user is allowed to see ---------- */
// Row Level Security in the database decides what comes back:
// a student only receives their own loans/reservations/notifications.
async function refresh() {
  try { await sb.rpc('run_sweep'); } catch (e) { /* not critical */ }

  const [set, profiles, books, copies, loans, res, notes] = await Promise.all([
    must(sb.from('settings').select('*').eq('id', 1).single()),
    must(sb.from('profiles').select('*').order('login_id')),
    must(sb.from('books').select('*').order('id')),
    must(sb.from('copies').select('*').order('id')),
    must(sb.from('loans').select('*').order('issued_at', { ascending: false })),
    must(sb.from('reservations').select('*').order('created_at', { ascending: false })),
    must(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(200))
  ]);
  const audit = admin()
    ? await must(sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200))
    : [];

  // uuid -> college ID, so screens can show "DEMO001" instead of a long uuid
  const login = {};
  profiles.forEach(p => (login[p.id] = p.login_id));

  const code = {};   // copy id -> readable code like B3-C2
  copies.forEach(c => (code[c.id] = 'B' + c.book_id + '-C' + c.copy_no));

  const holdBy = {}; // copy id -> reservation id (copies waiting for pickup)
  res.forEach(r => { if (r.status === 'Ready' && r.copy_id) holdBy[r.copy_id] = r.id; });

  DB = {
    set: { max: set.max_loans, days: set.loan_days, pickup: set.pickup_days, dur: set.durations },

    students: profiles.filter(p => p.role === 'student').map(p => ({
      id: p.login_id, uuid: p.id, name: p.name, course: p.course, adm: p.adm_year,
      mobile: p.mobile || '', email: p.email || '', active: p.active
    })),
    staff: profiles.filter(p => p.role !== 'student').map(p => ({
      id: p.login_id, uuid: p.id, name: p.name, email: p.email || '', role: p.role, active: p.active
    })),

    books: books.map(b => ({
      id: b.id, title: b.title, author: b.author, isbn: b.isbn || '', cat: b.category,
      pub: b.publisher || '', year: b.pub_year, archived: b.archived
    })),
    copies: copies.map(c => ({
      id: c.id, code: code[c.id], book: c.book_id, st: c.status, hold: holdBy[c.id] ?? null
    })),

    loans: loans.map(l => ({
      id: l.id, sid: login[l.student_id] || '?', copy: code[l.copy_id] || l.copy_id,
      book: l.book_id, out: l.issued_at, due: l.due_at, ret: l.returned_at, od: l.overdue_notified
    })),
    res: res.map(r => ({
      id: r.id, book: r.book_id, sid: login[r.student_id] || '?', type: r.type,
      status: r.status, at: r.created_at, exp: r.expires_at, pos: null
    })),

    notes: notes.map(n => ({
      id: n.id, to: n.for_staff ? 'STAFF' : (login[n.recipient] || '?'), m: n.message, at: n.created_at
    })),
    audit: audit.map(a => ({ at: a.created_at, by: login[a.actor] || '-', a: a.action }))
  };

  // A student only sees their own reservations, so ask the database for queue positions
  if (U && U.role === 'student') {
    await Promise.all(DB.res.filter(r => r.status === 'Waiting').map(async r => {
      const { data } = await sb.rpc('queue_position', { p_res: r.id });
      r.pos = data;
    }));
  }
}

/* ---------- Start-up: restore an existing login ---------- */
async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const p = await loadProfile(session.user.id);
      if (p && p.active) {
        setUser(p);
        V = U.role === 'student' ? 'cat' : 'home';
        await refresh();
      } else {
        await sb.auth.signOut();
      }
    }
  } catch (e) {
    console.error(e);
    toast('Could not connect to the database. Check supabase.js.', 1);
  }
  render();
}
