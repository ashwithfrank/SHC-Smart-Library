/* ==========================================================
   admin.js (Supabase version) - students, staff, settings, audit log
   Screens are the same as before. Actions now call Supabase:
     - add student / staff  -> Edge Function "create-user"
     - activate / settings  -> database functions (admin only)
   The server checks admin rights again, so hiding a button is
   never the only protection.
   ========================================================== */

/* ---------- Screens ---------- */

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
      <input id="sp" type="password" placeholder="Initial password" autocomplete="new-password">
      <button class="btn" onclick="newStu()">Add</button>
    </div>` : '';

  return `<h2>Students</h2>${addForm}
    ${search('Search ID, name, course, mobile')}
    ${tbl(['ID', 'Name', 'Course', 'Year', 'Loans', 'Status', ''], rows)}`;
};

VIEWS.staff = function () {
  const rows = DB.staff.map(s => [
    esc(s.id),
    esc(s.name),
    esc(s.role),
    badge(s.active ? 'Active' : 'Inactive'),
    s.id === U.id ? '' :
      `<button class="btn s" onclick="tog('staff','${s.id}')">${s.active ? 'Deactivate' : 'Activate'}</button>`
  ]);

  return `<h2>Staff</h2>
    <div class="row">
      <input id="ti" placeholder="Staff ID">
      <input id="tn" placeholder="Name">
      <input id="te" placeholder="Email (optional)">
      <select id="tr">
        <option value="librarian">Librarian</option>
        <option value="admin">Admin</option>
      </select>
      <input id="tp" type="password" placeholder="Initial password" autocomplete="new-password">
      <button class="btn" onclick="newStaff()">Add</button>
    </div>
    ${tbl(['ID', 'Name', 'Role', 'Status', ''], rows)}`;
};

VIEWS.set = function () {
  const d = DB.set;
  const durations = Object.entries(d.dur).map(([course, years]) =>
    `<label>${esc(course)} <input class="dur" data-c="${esc(course)}" type="number" min="1" max="6" value="${years}"></label>`
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

VIEWS.audit = function () {
  return `<h2>Audit log</h2>
    ${tbl(['When', 'By', 'Action'],
      DB.audit.map(a => [new Date(a.at).toLocaleString('en-IN'), esc(a.by), esc(a.a)]), 10)}`;
};

/* ---------- Actions ---------- */

// Activate / deactivate. History is never deleted.
function tog(table, id) {
  if (!admin()) return;
  const user = DB[table].find(x => x.id === id);
  if (!user) return;
  const makeActive = !user.active;
  act(() => must(sb.rpc('set_active', { p_login: id, p_active: makeActive })),
      makeActive ? 'Account activated' : 'Account deactivated');
}

// Ask the Edge Function to create a login + profile
async function createUser(body) {
  const { data, error } = await sb.functions.invoke('create-user', { body });
  if (error) throw new Error('Could not reach the server function. Is "create-user" deployed?');
  if (data && data.error) throw new Error(data.error);
  return data;
}

function newStu() {
  if (!admin()) return;
  if (!g('si') || !g('sn') || $('sp').value.length < 8) {
    return toast('ID, name and an 8+ character password are required.', 1);
  }
  act(() => createUser({
    kind: 'student', login_id: g('si'), name: g('sn'), course: g('sc'),
    adm_year: +g('sa'), mobile: g('sm'), email: g('se'), password: $('sp').value
  }), 'Student added');
}

function newStaff() {
  if (!admin()) return;
  if (!g('ti') || !g('tn') || $('tp').value.length < 8) {
    return toast('ID, name and an 8+ character password are required.', 1);
  }
  act(() => createUser({
    kind: 'staff', login_id: g('ti'), name: g('tn'), role: g('tr'),
    email: g('te'), password: $('tp').value
  }), 'Staff added');
}

function saveSet() {
  if (!admin()) return;
  const dur = {};
  document.querySelectorAll('.dur').forEach(i => (dur[i.dataset.c] = +i.value));
  act(() => must(sb.rpc('save_settings', {
    p_max: +g('x1'), p_days: +g('x2'), p_pickup: +g('x3'), p_dur: dur
  })), 'Settings saved');
}
