/* ==========================================================
   app.js - menus, login screen, main render, start-up
   Loaded LAST.
   ========================================================== */

// Sidebar menu for each role: [screen name, label]
const NAV = {
  student: [
    ['cat', 'Catalogue'], ['loans', 'My loans'], ['res', 'My reservations'],
    ['notes', 'Notifications'], ['me', 'Profile']
  ],
  librarian: [
    ['home', 'Dashboard'], ['books', 'Books'], ['issue', 'Issue'], ['loans', 'Loans'],
    ['res', 'Reservations'], ['students', 'Students'], ['notes', 'Notifications'], ['me', 'Profile']
  ],
  admin: [
    ['home', 'Dashboard'], ['students', 'Students'], ['staff', 'Staff'], ['books', 'Books'],
    ['issue', 'Issue'], ['loans', 'Loans'], ['res', 'Reservations'], ['set', 'Settings'],
    ['audit', 'Audit log'], ['notes', 'Notifications'], ['me', 'Profile']
  ]
};

/* ---------- Sidebar open / close ---------- */
// The open state is a class on #app, so it survives render() and
// toggling it never wipes anything typed into a form.
function setNav(open) {
  $('app').classList.toggle('nav-open', open);
  const btn = $('menuBtn');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function toggleNav() { setNav(!$('app').classList.contains('nav-open')); }
function closeNav() { setNav(false); }

// Esc key closes the sidebar
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

function loginView() {
  return `<div class="login"><div class="card">
    <h2 style="margin:0">SHC Smart Library</h2>
    <span class="note">Sacred Heart College, Madanthyar</span>
    <select id="lrole">
      <option value="student">Student</option>
      <option value="staff">Librarian / Admin</option>
    </select>
    <input id="lid" placeholder="ID" autocomplete="username">
    <input id="lpw" type="password" placeholder="Password" autocomplete="current-password"
           onkeydown="if(event.key==='Enter')login()">
    <button class="btn" onclick="login()">Log in</button>
    <p class="note">Prototype demo accounts (dev only):<br>
      DEMO001 / student123 &middot; LIB001 / lib12345 &middot; ADM001 / admin123.<br>
      Data is stored in this browser only.</p>
  </div></div>`;
}

// Draws the whole screen. Called after every change.
function render() {
  const app = $('app');
  if (!DB) return;

  if (!U) {                       // not logged in
    closeNav();
    app.innerHTML = loginView();
    return;
  }

  const menu = NAV[U.role];
  if (!VIEWS[V]) V = menu[0][0];  // unknown screen -> first menu item

  const open = app.classList.contains('nav-open');

  // Same menu items and same go() navigation as before; closeNav() just hides the sidebar first
  const buttons = menu
    .map(n => `<button class="${V === n[0] ? 'on' : ''}" onclick="closeNav();go('${n[0]}')">${n[1]}</button>`)
    .join('');

  app.innerHTML = `
    <header class="topbar">
      <button id="menuBtn" class="menu-btn" onclick="toggleNav()"
              aria-controls="sidebar" aria-expanded="${open}">&#9776; Menu</button>
      <span class="brand">SHC Library</span>
    </header>

    <div class="backdrop" onclick="closeNav()"></div>

    <aside id="sidebar" aria-label="Main navigation">
      <div class="side-head">
        <div>
          <h1>SHC Library</h1>
          <small>${esc(U.name)} &middot; ${U.role}</small>
        </div>
        <button class="close-btn" onclick="closeNav()" aria-label="Close menu">&#10005;</button>
      </div>
      <nav>${buttons}<button onclick="closeNav();logout()">Log out</button></nav>
    </aside>

    <main>${VIEWS[V]()}</main>`;

  // keep the cursor in the search box while typing
  const q = $('q');
  if (q && Q) { q.focus(); q.setSelectionRange(99, 99); }
}

// Start the app
init();
