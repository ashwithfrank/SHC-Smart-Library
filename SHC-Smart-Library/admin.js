/* ==========================================================
   admin.js - student, staff, settings and audit log
   Adds extra screens to VIEWS (defined in views.js).
   ========================================================== */
 
/* ---------- Screens ---------- */
 
// Students: admin can add/activate/deactivate, librarian can only view
VIEWS.students = function () {
  const rows = DB.students
    .filter(s => has(Q, s.id, s.name, s.course, s.mobile))
    .map(s => [
      esc(s.id),
      esc(s.name),
      esc(s.course),
      yr(s),
      DB.loans.filter(l => l.sid === s.id && !l.ret).length,
      badge(s.active ? 'Active' : 'Inactive'),
      admin()
        ? `<button class="btn s" onclick="tog('students','${s.id}')">${s.active ? 'Deactivate' : 'Activate'}</button>`
        : ''
    ]);
 
  const courses = Object.keys(DB.set.dur).map(c => `<option>${c}</option>`).join('');
 
  const addForm = admin() ? `
    <h3>Add student</h3>
    <div class="row">
      <input id="si" placeholder="Student ID">
      <input id="sn" placeholder="Full name">
      <select id="sc">${courses}</select>
      <input id="sa" type="number" placeholder="Admission year" value="${now().getFullYear()}">
      <input id="sm" placeholder="Mobile">
      <input id="se" placeholder="Email (optional)">
      <input id="sp" type="password" placeholder="Initial password">
      <button class="btn" onclick="newStu()">Add</button>
    </div>` : '';
 
  return `<h2>Students</h2>${addForm}
    ${search('Search ID, name, course, mobile')}
    ${tbl(['ID', 'Name', 'Course', 'Year', 'Loans', 'Status', ''], rows)}`;
};
 
// Staff accounts (admin only)
VIEWS.staff = function () {
  const rows = DB.staff.map(s => [
    esc(s.id),
    esc(s.name),
    esc(s.role),
    badge(s.active ? 'Active' : 'Inactive'),
    s.id === U.id ? '' :      // you cannot deactivate yourself
      `<button class="btn s" onclick="tog('staff','${s.id}')">${s.active ? 'Deactivate' : 'Activate'}</button>`
  ]);
 
  return `<h2>Staff</h2>
    <div class="row">
      <input id="ti" placeholder="Staff ID">
      <input id="tn" placeholder="Name">
      <input id="te" placeholder="Email">
      <select id="tr">
        <option value="librarian">Librarian</option>
        <option value="admin">Admin</option>
      </select>
      <input id="tp" type="password" placeholder="Initial password">
      <button class="btn" onclick="newStaff()">Add</button>
    </div>
    ${tbl(['ID', 'Name', 'Role', 'Status', ''], rows)}`;
};
 
// Library settings (admin only)
VIEWS.set = function () {
  const d = DB.set;
  const durations = Object.entries(d.dur).map(([course, years]) =>
    `<label>${course} <input class="dur" data-c="${course}" type="number" min="1" max="6" value="${years}"></label>`
  ).join('');
 
  return `<h2>Settings</h2>
    <div class="card">
      <div class="row">
        <label>Max loans <input id="x1" type="number" min="1" value="${d.max}"></label>
        <label>Loan days <input id="x2" type="number" min="1" value="${d.days}"></label>
        <label>Pickup days <input id="x3" type="number" min="1" value="${d.pickup}"></label>
      </div>
      <h3>Course duration (years)</h3>
      <div class="row">${durations}</div>
      <button class="btn" onclick="saveSet()">Save settings</button>
    </div>`;
};
 
// Audit log (admin only)
VIEWS.audit = function () {
  return `<h2>Audit log</h2>
    ${tbl(['When', 'By', 'Action'],
      DB.audit.map(a => [new Date(a.at).toLocaleString('en-IN'), esc(a.by), esc(a.a)]), 10)}`;
};
 
/* ---------- Actions (every one re-checks admin() itself) ---------- */
 
// Activate / deactivate. History is never deleted.
function tog(table, id) {
  if (!admin()) return;
  const user = DB[table].find(x => x.id === id);
  user.active = !user.active;
  log((user.active ? 'Activated ' : 'Deactivated ') + id);
  save();
  render();
}
 
async function newStu() {
  if (!admin()) return;
  const id = g('si'), password = $('sp').value, mobile = g('sm'), email = g('se');
 
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(id) || !g('sn') || password.length < 8) {
    return toast('Valid ID, name and an 8+ character password are required.', 1);
  }
  if (stu(id)) return toast('Student ID already exists.', 1);
  if (mobile && !/^[6-9]\d{9}$/.test(mobile)) return toast('Enter a valid 10-digit mobile number.', 1);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast('Invalid email.', 1);
 
  DB.students.push({
    id, name: g('sn'), course: g('sc'), adm: +g('sa'),
    mobile, email, active: true, pw: await hash(id, password)
  });
  log('Added student ' + id);
  save();
  toast('Student added');
  render();
}
 
async function newStaff() {
  if (!admin()) return;
  const id = g('ti'), password = $('tp').value;
 
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(id) || !g('tn') || password.length < 8) {
    return toast('Valid ID, name and an 8+ character password are required.', 1);
  }
  if (DB.staff.some(s => s.id === id)) return toast('Staff ID already exists.', 1);
 
  DB.staff.push({
    id, name: g('tn'), email: g('te'), role: g('tr'),
    active: true, pw: await hash(id, password)
  });
  log('Added staff ' + id);
  save();
  toast('Staff added');
  render();
}
 
function saveSet() {
  if (!admin()) return;
  DB.set.max = +g('x1');
  DB.set.days = +g('x2');
  DB.set.pickup = +g('x3');
  document.querySelectorAll('.dur').forEach(i => (DB.set.dur[i.dataset.c] = +i.value));
  log('Updated settings');
  save();
  toast('Settings saved');
}
 