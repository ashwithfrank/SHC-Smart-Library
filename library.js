/* ==========================================================
   library.js (Supabase version) - actions
   Every rule (limits, queue, double-issue protection) now lives
   in the database functions from functions.sql. This file only
   calls them, then reloads the data and redraws the screen.
   ========================================================== */

// Run an action: call the database, reload data, redraw, show a message
async function act(action, successMessage) {
  try {
    const result = await action();
    await refresh();
    if (successMessage) toast(typeof successMessage === 'function' ? successMessage(result) : successMessage);
    render();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Something went wrong.', 1);   // message comes from the database rules
  }
}

/* ---------- Books and copies (staff) ---------- */
function newBook() {
  if (!staff()) return;
  const copies = +g('bn');
  if (!g('bt') || !g('ba') || !g('bc') || !(copies >= 1)) {
    return toast('Title, author, category and copies are required.', 1);
  }
  act(() => must(sb.rpc('add_book', {
    p_title: g('bt'), p_author: g('ba'), p_isbn: g('bi'), p_category: g('bc'),
    p_publisher: '', p_year: now().getFullYear(), p_copies: copies
  })), 'Book added');
}

function addCopy(bookId) {
  if (!staff()) return;
  act(() => must(sb.rpc('add_copy', { p_book: Number(bookId) })), 'Copy added');
}

function archive(bookId) {
  if (!staff()) return;
  if (!confirm('Archive this book?')) return;
  act(() => must(sb.rpc('archive_book', { p_book: Number(bookId) })), 'Book archived');
}

/* ---------- Student: reserve / join waiting list ---------- */
function reserve(bookId) {
  if (!U || U.role !== 'student') return;
  act(() => must(sb.rpc('reserve_book', { p_book: Number(bookId) })),
      r => (r && r.status === 'Ready' ? 'Reserved - ready for pickup' : 'Added to waiting list'));
}

function cancelRes(id) {
  if (!confirm('Cancel this reservation?')) return;
  act(() => must(sb.rpc('cancel_reservation', { p_res: Number(id) })), 'Reservation cancelled');
}

/* ---------- Staff: issue and return ---------- */
function issue(studentId, copyId) {
  if (!staff()) return;
  if (!studentId) return toast('Enter a Student ID.', 1);
  if (!copyId) return toast('Select a copy.', 1);
  act(() => must(sb.rpc('issue_book', { p_login: studentId, p_copy: Number(copyId) })),
      r => 'Book issued. Due ' + fd(r && r.due_at));
}

function ret(loanId) {
  if (!staff()) return;
  act(() => must(sb.rpc('return_book', { p_loan: Number(loanId) })), 'Book returned');
}
