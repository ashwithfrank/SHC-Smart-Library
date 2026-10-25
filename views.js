/* ==========================================================
   views.js - table helpers + the main screens
   Each screen is a function that returns HTML text.
   Admin-only screens are added to VIEWS in admin.js.
   ========================================================== */
 
/* ---------- Shared helpers ---------- */
 
// Table with pagination (8 rows per page)
function tbl(heads, rows, perPage = 8) {
  if (!rows.length) return '<div class="card empty">Nothing to show yet.</div>';
 
  const pages = Math.ceil(rows.length / perPage);
  P = Math.min(P, pages - 1);
 
  const head = heads.map(h => `<th>${h}</th>`).join('');
  const body = rows
    .slice(P * perPage, P * perPage + perPage)
    .map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
 
  const pager = pages > 1
    ? `<div class="pg">
         <button class="btn s" onclick="P=Math.max(0,P-1);render()">Prev</button>
         Page ${P + 1} / ${pages}
         <button class="btn s" onclick="P=Math.min(${pages - 1},P+1);render()">Next</button>
       </div>`
    : '';
 
  return `<div class="tw"><table><tr>${head}</tr>${body}</table></div>${pager}`;
}
 
// Search box (re-draws the screen as you type)
const search = placeholder =>
  `<div class="row"><input id="q" placeholder="${placeholder}" value="${esc(Q)}"
     oninput="Q=this.value;P=0;render()"></div>`;
 
// Does any of these fields contain the search text?
const has = (q, ...fields) => fields.join(' ').toLowerCase().includes(Q.toLowerCase());
 
// Dashboard number card
const stat = (number, label) =>
  `<div class="card stat"><b>${number}</b><span>${label}</span></div>`;
 
/* ---------- Screens ---------- */
const VIEWS = {
 
  // Staff dashboard (numbers come from real data)
  home() {
    const active = DB.loans.filter(l => !l.ret);
    const overdue = active.filter(l => new Date(l.due) < now()).length;
 
    const adminCards = admin()
      ? stat(DB.students.filter(s => !s.active).length, 'Inactive students') +
        stat(DB.staff.length, 'Staff accounts')
      : '';
 
    return `<h2>Dashboard</h2>
      <div class="grid">
        ${stat(DB.books.filter(b => !b.archived).length, 'Book titles')}
        ${stat(DB.copies.length, 'Total copies')}
        ${stat(DB.copies.filter(c => c.st === 'available').length, 'Available')}
        ${stat(active.length, 'Borrowed')}
        ${stat(DB.students.filter(s => s.active).length, 'Active students')}
        ${adminCards}
        ${stat(overdue, 'Overdue')}
        ${stat(DB.res.filter(r => r.status === 'Ready').length, 'Ready for pickup')}
        ${stat(DB.res.filter(r => r.status === 'Waiting').length, 'Waiting list')}
      </div>
      <h3>Recent activity</h3>
      ${tbl(['When', 'Who', 'Action'],
        DB.audit.slice(0, 30).map(a => [fd(a.at), esc(a.by), esc(a.a)]), 6)}`;
  },
 
  // Catalogue (students) / Books list (staff)
  cat() {
    const rows = DB.books
      .filter(b => !b.archived && has(Q, b.title, b.author, b.isbn, b.cat, b.id))
      .map(b => {
        const free = avail(b.id);
        const total = DB.copies.filter(c => c.book === b.id).length;
 
        const action = U.role === 'student'
          ? `<button class="btn s" onclick="reserve('${b.id}')">${free ? 'Reserve' : 'Join waitlist'}</button>`
          : `<button class="btn s" onclick="addCopy('${b.id}');save();render()">+ Copy</button>
             <button class="btn d" onclick="archive('${b.id}')">Archive</button>`;
 
        return [
          esc(b.id),
          `<b>${esc(b.title)}</b><br><span class="note">${esc(b.author)}${b.isbn ? ' &middot; ' + esc(b.isbn) : ''}</span>`,
          esc(b.cat),
          `${free} / ${total} ${badge(free ? 'Available' : 'Borrowed')}`,
          action
        ];
      });
 
    return `<h2>${staff() ? 'Books' : 'Catalogue'}</h2>
      ${search('Search title, author, category, ISBN or ID')}
      ${tbl(['ID', 'Book', 'Category', 'Available', ''], rows)}`;
  },
 
  // Staff: add-book form + the book list
  books() {
    return `<h2>Books</h2>
      <h3>Add a book</h3>
      <div class="row">
        <input id="bt" placeholder="Title">
        <input id="ba" placeholder="Author">
        <input id="bi" placeholder="ISBN (optional)">
        <input id="bc" placeholder="Category">
        <input id="bn" type="number" min="1" value="1" placeholder="Copies">
        <button class="btn" onclick="newBook()">Add book</button>
      </div>` + VIEWS.cat().replace('<h2>Books</h2>', '');
  },
 
  // Loans: students see their own, staff see everyone's
  loans() {
    const own = U.role === 'student';
 
    const rows = DB.loans
      .filter(l => (!own || l.sid === U.id) &&
                   has(Q, l.sid, l.copy, book(l.book).title, stu(l.sid)?.name))
      .sort((a, b) => (a.out < b.out ? 1 : -1))
      .map(l => {
        const overdue = !l.ret && new Date(l.due) < now();
        const status = l.ret
          ? badge('Returned') + ' ' + fd(l.ret)
          : badge(overdue ? 'Overdue' : 'Borrowed');
 
        return [
          ...(own ? [] : [`${esc(l.sid)}<br><span class="note">${esc(stu(l.sid)?.name)}</span>`]),
          `${esc(book(l.book).title)}<br><span class="note">${esc(l.copy)}</span>`,
          fd(l.out),
          fd(l.due),
          status,
          !own && !l.ret ? `<button class="btn s" onclick="ret('${l.id}')">Return</button>` : ''
        ];
      });
 
    return `<h2>${own ? 'My loans' : 'Loans'}</h2>
      ${search('Search loans')}
      ${tbl([...(own ? [] : ['Student']), 'Book', 'Issued', 'Due', 'Status', ''], rows)}`;
  },
 
  // Reservations + waiting list
  res() {
    const own = U.role === 'student';
 
    // Queue position = place among Waiting requests for the same book
    const position = r => DB.res
      .filter(x => x.book === r.book && x.status === 'Waiting')
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .findIndex(x => x.id === r.id) + 1;
 
    const rows = DB.res
      .filter(r => (!own || r.sid === U.id) &&
                   has(Q, r.id, r.sid, stu(r.sid)?.name, book(r.book).title, r.status))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .map(r => {
        const heldCopy = DB.copies.find(c => c.hold === r.id);
 
        const status = badge(r.status) +
          (r.status === 'Waiting' ? ' #' + (r.pos ?? position(r)) : '') +
          (r.exp && r.status === 'Ready' ? `<br><span class="note">until ${fd(r.exp)}</span>` : '');
 
        const fulfil = !own && r.status === 'Ready' && heldCopy
          ? `<button class="btn s" onclick="issue('${r.sid}','${heldCopy.id}')">Fulfil</button>` : '';
        const cancel = ['Waiting', 'Ready'].includes(r.status)
          ? `<button class="btn d" onclick="cancelRes('${r.id}')">Cancel</button>` : '';
 
        return [
          esc(r.id),
          ...(own ? [] : [`${esc(r.sid)}<br><span class="note">${esc(stu(r.sid)?.name)}</span>`]),
          esc(book(r.book).title),
          fd(r.at),
          r.type,
          status,
          fulfil + cancel
        ];
      });
 
    return `<h2>${own ? 'My reservations' : 'Reservations'}</h2>
      ${search('Search reservations')}
      ${tbl(['ID', ...(own ? [] : ['Student']), 'Book', 'Requested', 'Type', 'Status', ''], rows)}`;
  },
 
  // Staff: issue a book
  issue() {
    const options = DB.copies
      .filter(c => c.st !== 'issued')
      .map(c => {
        const r = c.st === 'held' ? DB.res.find(x => x.id === c.hold) : null;
        return `<option value="${c.id}">${esc(c.code)} &middot; ${esc(book(c.book).title)}${r ? ' (held for ' + esc(r.sid) + ')' : ''}</option>`;
      }).join('');
 
    const students = DB.students.filter(s => s.active)
      .map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
 
    return `<h2>Issue a book</h2>
      <div class="card">
        <div class="row">
          <input id="is" placeholder="Student ID" list="sl">
          <datalist id="sl">${students}</datalist>
          <select id="ic">${options || '<option value="">No copies available</option>'}</select>
          <button class="btn" onclick="issue(g('is'),g('ic'))">Issue</button>
        </div>
        <p class="note">Limit ${DB.set.max} loans &middot; ${DB.set.days} days.
          Students with overdue books or inactive accounts are blocked.</p>
      </div>`;
  },
 
  // Notifications (students: own, staff: staff messages)
  notes() {
    const owner = U.role === 'student' ? U.id : 'STAFF';
    return `<h2>Notifications</h2>
      ${tbl(['When', 'Message'],
        DB.notes.filter(n => n.to === owner)
          .map(n => [new Date(n.at).toLocaleString('en-IN'), esc(n.m)]), 10)}`;
  },
 
  // Profile + change password
  me() {
    const isStudent = U.role === 'student';
    return `<h2>Profile</h2>
      <div class="card">
        <p><b>${esc(U.name)}</b> &middot; ${esc(U.id)}</p>
        <p>${isStudent ? esc(U.course) + ' &middot; admitted ' + U.adm + ' &middot; ' + yr(U) : esc(U.role)}</p>
      </div>
      <h3>Change password</h3>
      <div class="row">
        <input id="p1" type="password" placeholder="Current password">
        <input id="p2" type="password" placeholder="New password (8+ chars)">
        <button class="btn" onclick="chpw()">Update</button>
      </div>`;
  }
};
 


