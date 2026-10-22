/* ==========================================================
   data.js - database, helpers, seed data
   Loaded FIRST. Every other file uses what is defined here.

   PROTOTYPE NOTE: data is saved in this browser's localStorage.
   A real multi-user library needs a server + PostgreSQL.
   ========================================================== */

const STORAGE_KEY = 'shc_lib_v1';

/* ---------- Global app state ---------- */
let DB;          // the whole database (students, books, loans...)
let U = null;    // logged-in user (null = logged out)
let V = 'home';  // current screen name
let Q = '';      // current search text
let P = 0;       // current table page (0 = first)

/* ---------- Small helpers ---------- */
const $ = id => document.getElementById(id);
const g = id => $(id).value.trim();               // read an input's value
const uid = prefix => prefix + Math.random().toString(36).slice(2, 8).toUpperCase();
const now = () => new Date();
const iso = d => d.toISOString();
const fd = s => (s ? new Date(s).toLocaleDateString('en-IN') : '-');   // format date

// Escape text before putting it in HTML (stops script injection)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// One-way password hash (SHA-256 with the user ID as salt)
async function hash(id, password) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id + ':' + password));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- Saving ---------- */
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); } catch (e) { /* storage full or blocked */ }
}

/* ---------- Messages ---------- */
function toast(message, isError) {
  const t = $('toast');
  t.textContent = message;
  t.className = isError ? 'e' : '';
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3200);
}

// Notification for one student ID, or 'STAFF' for all staff
const notify = (to, message) =>
  DB.notes.unshift({ id: uid('N'), to, m: message, at: iso(now()), read: false });

// Audit log entry (who did what)
const log = action =>
  DB.audit.unshift({ at: iso(now()), by: U ? U.id : '-', a: action });

/* ---------- Lookups and checks ---------- */
const stu   = id => DB.students.find(s => s.id === id);
const book  = id => DB.books.find(b => b.id === id);
const staff = () => U && U.role !== 'student';    // librarian or admin?
const admin = () => U && U.role === 'admin';      // admin only?

// Academic year, calculated from admission year + course length
function yr(s) {
  const duration = DB.set.dur[s.course] || 3;
  const y = now().getFullYear() - s.adm + (now().getMonth() >= 5 ? 1 : 0);
  return y > duration ? 'Graduated' : 'Year ' + Math.max(1, y) + ' of ' + duration;
}

// Number of copies of a book that are free right now
const avail = bookId => DB.copies.filter(c => c.book === bookId && c.st === 'available').length;

// Coloured status label, e.g. badge('Overdue')
const badge = s => `<span class="b ${s.toLowerCase().replace(/ /g, '')}">${esc(s)}</span>`;

/* ---------- First-time setup ---------- */
async function init() {
  try { DB = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* ignore */ }

  if (!DB) {
    DB = {
      set: { max: 3, days: 14, pickup: 2, dur: { BCA: 3, 'B.Com': 3, 'B.A': 3, 'M.Com': 2 } },
      students: [], staff: [], books: [], copies: [],
      loans: [], res: [], notes: [], audit: []
    };

    // DEMO ACCOUNTS - development only. Remove before real use.
    DB.students.push({
      id: 'DEMO001', name: 'Demo Student', course: 'BCA', adm: 2024,
      mobile: '', email: '', active: true, pw: await hash('DEMO001', 'student123') }
   );
    DB.staff.push(
      { id: 'LIB001', name: 'Demo Librarian', email: '', role: 'librarian', active: true, pw: await hash('LIB001', 'lib12345') },
      { id: 'ADM001', name: 'Demo Admin',     email: '', role: 'admin',     active: true, pw: await hash('ADM001', 'admin123') }
    );

    // Sample books: title, author, isbn, category, publisher, year, copies
    [
      ['Introduction to Algorithms', 'Cormen et al.',    '', 'Computer Science', '', 2020, 2],
      ['Financial Accounting',       'R. Narayanaswamy', '', 'Commerce',         '', 2020, 1],
      ['The Discovery of India',     'J. Nehru',         '', 'History',          '', 2020, 2],
      ['Database System Concepts',   'Silberschatz',     '', 'Computer Science', '', 2020, 1]
    ].forEach(b => addBook(...b));

    save();
  }
  render();
}
