/* ==========================================================
   auth.js - login, logout, navigation, change password
   ========================================================== */

async function login() {
  const id = g('lid');
  const password = $('lpw').value;
  const role = $('lrole').value;                       // 'student' or 'staff'

  const list = role === 'student' ? DB.students : DB.staff;
  const user = list.find(x => x.id.toLowerCase() === id.toLowerCase());

  // Same message for wrong ID or wrong password (does not reveal which)
  if (!user || user.pw !== await hash(user.id, password)) {
    return toast('Invalid ID or password.', 1);
  }
  if (!user.active) {
    return toast('Account is inactive. Contact the library.', 1);
  }

  U = { ...user, role: role === 'student' ? 'student' : user.role };
  V = U.role === 'student' ? 'cat' : 'home';           // first screen
  Q = '';
  P = 0;
  render();
}

function logout() {
  U = null;
  render();
}

// Switch screen (used by the sidebar buttons)
function go(view) {
  V = view;
  Q = '';
  P = 0;
  render();
}

async function chpw() {
  const list = U.role === 'student' ? DB.students : DB.staff;
  const user = list.find(x => x.id === U.id);

  if (user.pw !== await hash(user.id, $('p1').value)) {
    return toast('Current password is wrong.', 1);
  }
  if ($('p2').value.length < 8) {
    return toast('New password needs 8+ characters.', 1);
  }

  user.pw = await hash(user.id, $('p2').value);
  save();
  toast('Password updated');
}
