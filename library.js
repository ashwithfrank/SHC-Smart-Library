/* ==========================================================
   library.js - the core business rules
   Books/copies, reservations + waiting list, issue, return.

   Copy status:  available -> held (reserved for a student)
                 available/held -> issued -> available (on return)
   ========================================================== */

/* ---------- Books and copies ---------- */
function addBook(title, author, isbn, cat, pub, year, copies) {
  const id = 'B' + (DB.books.length + 1 + Math.floor(Math.random() * 90) * 100);
  DB.books.push({ id, title, author, isbn, cat, pub, year, archived: false });
  for (let i = 0; i < copies; i++) addCopy(id);
}

function addCopy(bookId) {
  const n = DB.copies.filter(c => c.book === bookId).length + 1;
  DB.copies.push({ id: bookId + '-C' + n, book: bookId, st: 'available', hold: null });
}

// Form handler for the "Add a book" row
function newBook() {
  const title = g('bt'), copies = +g('bn');
  if (!title || !g('ba') || !g('bc') || copies < 1) {
    return toast('Title, author, category and copies are required.', 1);
  }
  addBook(title, g('ba'), g('bi'), g('bc'), '', now().getFullYear(), copies);
  log('Added book ' + title);
  save();
  toast('Book added');
  render();
}

// Archive instead of delete, and never while a book is in use
function archive(id) {
  const inUse = DB.loans.some(l => l.book === id && !l.ret) ||
                DB.res.some(r => r.book === id && ['Waiting', 'Ready'].includes(r.status));
  if (inUse) return toast('Cannot archive: active loans or reservations exist.', 1);
  if (!confirm('Archive this book?')) return;

  book(id).archived = true;
  log('Archived ' + id);
  save();
  render();
}

/* ---------- Waiting list engine ---------- */

// If a copy is free and someone is waiting, hold it for the FIRST in line
function queue(bookId) {
  const copy = DB.copies.find(c => c.book === bookId && c.st === 'available');
  if (!copy) return;

  const next = DB.res
    .filter(r => r.book === bookId && r.status === 'Waiting' && stu(r.sid)?.active)
    .sort((a, b) => (a.at < b.at ? -1 : 1))[0];        // oldest request first = fair order
  if (!next) return;

  copy.st = 'held';
  copy.hold = next.id;
  next.status = 'Ready';
  next.type = 'Reserved';
  next.exp = iso(new Date(Date.now() + DB.set.pickup * 864e5));   // pickup deadline

  notify(next.sid, `"${book(bookId).title}" is ready for pickup until ${fd(next.exp)}.`);
  notify('STAFF', `Reservation ${next.id} ready for ${next.sid}.`);
}

// Free a held copy (reservation cancelled or expired), then offer it to the next person
function release(reservation) {
  const copy = DB.copies.find(c => c.hold === reservation.id);
  if (copy) {
    copy.st = 'available';
    copy.hold = null;
    queue(reservation.book);
  }
}

// Runs on every screen draw: expire old pickups, flag overdue loans
function sweep() {
  let changed = false;

  DB.res.forEach(r => {
    if (r.status === 'Ready' && new Date(r.exp) < now()) {
      r.status = 'Expired';
      notify(r.sid, `Your reservation for "${book(r.book).title}" expired.`);
      release(r);
      changed = true;
    }
  });

  DB.loans.forEach(l => {
    if (!l.ret && new Date(l.due) < now() && !l.od) {
      l.od = 1;                                         // flag once, so we notify only once
      notify(l.sid, `Overdue: "${book(l.book).title}"`);
      notify('STAFF', `Overdue loan ${l.id} (${l.sid})`);
      changed = true;
    }
  });

  if (changed) save();
}

/* ---------- Student: reserve / join waiting list ---------- */
function reserve(bookId) {
  if (U.role !== 'student') return;
  const bk = book(bookId);

  const duplicate = DB.res.some(r =>
    r.book === bookId && r.sid === U.id && ['Waiting', 'Ready'].includes(r.status));
  if (duplicate) return toast('You already have an active reservation for this book.', 1);

  const onLoan = DB.loans.some(l => l.book === bookId && l.sid === U.id && !l.ret);
  if (onLoan) return toast('You already have this book on loan.', 1);

  const r = { id: uid('R'), book: bookId, sid: U.id, type: 'Waiting', status: 'Waiting', at: iso(now()) };
  DB.res.push(r);
  queue(bookId);     // if a copy is free, this turns the request into "Ready"

  notify(U.id, r.status === 'Ready'
    ? `Reserved "${bk.title}". Ready for pickup.`
    : `Joined waiting list for "${bk.title}".`);
  save();
  toast(r.status === 'Ready' ? 'Reserved - ready for pickup' : 'Added to waiting list');
  render();
}

function cancelRes(id) {
  const r = DB.res.find(x => x.id === id);
  if (!r) return;
  if (U.role === 'student' && r.sid !== U.id) return;           // students: own only
  if (!['Waiting', 'Ready'].includes(r.status)) return;
  if (!confirm('Cancel this reservation?')) return;

  const wasReady = r.status === 'Ready';
  r.status = 'Cancelled';
  r.cx = iso(now());
  if (wasReady) release(r);                                      // pass the copy on

  notify(r.sid, `Reservation for "${book(r.book).title}" cancelled.`);
  log('Cancelled ' + id);
  save();
  render();
}

/* ---------- Staff: issue and return ---------- */
function issue(studentId, copyId) {
  if (!staff()) return;
  const s = stu(studentId);
  const c = DB.copies.find(x => x.id === copyId);

  if (!s || !s.active) return toast('Student not found or inactive.', 1);
  if (!c) return toast('Select a copy.', 1);
  if (c.st === 'issued') return toast('Copy already issued.', 1);

  // A held copy can only go to the student it is held for
  const held = c.st === 'held' ? DB.res.find(x => x.id === c.hold) : null;
  if (held && held.sid !== studentId) return toast('Copy is held for another student.', 1);

  const active = DB.loans.filter(l => l.sid === studentId && !l.ret);
  if (active.length >= DB.set.max) return toast('Borrowing limit reached (' + DB.set.max + ').', 1);
  if (active.some(l => new Date(l.due) < now())) return toast('Student has overdue books.', 1);

  const loan = {
    id: uid('L'), sid: studentId, copy: c.id, book: c.book,
    out: iso(now()),
    due: iso(new Date(Date.now() + DB.set.days * 864e5)),
    ret: null
  };
  DB.loans.push(loan);
  c.st = 'issued';
  c.hold = null;
  if (held) { held.status = 'Fulfilled'; held.done = iso(now()); }

  notify(studentId, `Issued "${book(c.book).title}". Due ${fd(loan.due)}.`);
  log(`Issued ${c.id} to ${studentId}`);
  save();
  toast('Book issued. Due ' + fd(loan.due));
  render();
}

function ret(loanId) {
  if (!staff()) return;
  const loan = DB.loans.find(x => x.id === loanId);
  if (!loan || loan.ret) return;

  loan.ret = iso(now());                       // loan record is kept as history
  DB.copies.find(x => x.id === loan.copy).st = 'available';

  notify(loan.sid, `Returned "${book(loan.book).title}".`);
  log('Returned ' + loan.copy);
  queue(loan.book);                            // offer the copy to the next waiting student
  save();
  toast('Book returned');
  render();
}
