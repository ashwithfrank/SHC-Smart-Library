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
    app.innerHTML = loginView();
    return;
  }
 
  sweep();                        // expire reservations, flag overdue loans
 
  const menu = NAV[U.role];
  if (!VIEWS[V]) V = menu[0][0];  // unknown screen -> first menu item
 
  const buttons = menu
    .map(n => `<button class="${V === n[0] ? 'on' : ''}" onclick="go('${n[0]}')">${n[1]}</button>`)
    .join('');
 
  app.innerHTML = `
    <aside>
      <h1>SHC Library</h1>
      <small>${esc(U.name)} &middot; ${U.role}</small>
      <nav>${buttons}<button onclick="logout()">Log out</button></nav>
    </aside>
    <main>${VIEWS[V]()}</main>`;
 
  // keep the cursor in the search box while typing
  const q = $('q');
  if (q && Q) { q.focus(); q.setSelectionRange(99, 99); }
}
 
// Start the app
init();
 