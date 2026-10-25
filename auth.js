/* ==========================================================
   auth.js (Supabase version) - login, logout, navigation, password
   Passwords are handled and hashed by Supabase Auth, never by this app.
   ========================================================== */

async function login() {
  const id = g('lid');
  const password = $('lpw').value;
  const wantStudent = $('lrole').value === 'student';

  if (!id || !password) return toast('Enter your ID and password.', 1);

  const { data, error } = await sb.auth.signInWithPassword({ email: idToEmail(id), password });
  if (error) return toast('Invalid ID or password.', 1);

  let profile = null;
  try { profile = await loadProfile(data.user.id); } catch (e) { /* handled below */ }

  // Same message for every failure (does not reveal which part was wrong)
  const roleMatches = profile && (wantStudent ? profile.role === 'student' : profile.role !== 'student');
  if (!roleMatches) {
    await sb.auth.signOut();
    return toast('Invalid ID or password.', 1);
  }
  if (!profile.active) {
    await sb.auth.signOut();
    return toast('Account is inactive. Contact the library.', 1);
  }

  setUser(profile);
  V = U.role === 'student' ? 'cat' : 'home';
  Q = '';
  P = 0;

  try { await refresh(); } catch (e) { console.error(e); toast('Could not load data: ' + e.message, 1); }
  render();
}

async function logout() {
  await sb.auth.signOut();
  U = null;
  DB = emptyDB();
  render();
}

// Switch screen: fetch fresh data first so you always see the latest
async function go(view) {
  V = view;
  Q = '';
  P = 0;
  try { await refresh(); } catch (e) { console.error(e); }
  render();
}

async function chpw() {
  const current = $('p1').value, next = $('p2').value;

  // Check the current password by signing in again
  const { error } = await sb.auth.signInWithPassword({ email: idToEmail(U.id), password: current });
  if (error) return toast('Current password is wrong.', 1);
  if (next.length < 8) return toast('New password needs 8+ characters.', 1);

  const res = await sb.auth.updateUser({ password: next });
  if (res.error) return toast(res.error.message, 1);
  toast('Password updated');
}
