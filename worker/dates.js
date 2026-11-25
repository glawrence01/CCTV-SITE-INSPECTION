const inspectionTimeZone = 'Africa/Lagos';

function inspectionDay(offset = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: inspectionTimeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = type => parts.find(entry => entry.type === type).value;
  const date = new Date(part('year') + '-' + part('month') + '-' + part('day'));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function validInspectionDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

const dateRequestWhere = 'business_id=? AND user_id=? AND inspection_date=?';

async function checkInspectionDate(db, user, date) {
  if (!validInspectionDate(date)) return reply('Enter a valid inspection date.', 400);
  if (user.role !== 'technician') return;
  if (date > inspectionDay()) return reply('Technicians cannot save future inspections.', 403);
  if (date >= inspectionDay(-3)) return;
  const grant = await db.prepare('SELECT status FROM inspection_date_requests WHERE ' + dateRequestWhere)
    .bind(user.business_id, user.id, date).first();
  if (grant?.status !== 'approved') return reply('Request approval from your business administrator to save records for ' + date + '.', 403);
}

async function dateRequestRoutes(req, db, user) {
  const admin = user.role === 'super_admin';
  const bid = user.business_id;
  const technician = user.role === 'technician' && ['inspect','observations','manage_actions','manage_incidents'].some(p => permitted(user, p));
  if (!admin && !technician) return reply('Date request access denied.', 403);
  if (req.method === 'GET') {
    const select = 'SELECT r.user_id, a.email, r.inspection_date, r.reason, r.status FROM inspection_date_requests r JOIN accounts a ON a.id=r.user_id WHERE r.business_id=?';
    const statement = admin ? db.prepare(select + ' ORDER BY r.requested_at DESC').bind(bid)
      : db.prepare(select + ' AND r.user_id=? ORDER BY r.requested_at DESC').bind(bid, user.id);
    return jsonResponse((await statement.all()).results);
  }
  const { date, reason, userId, decision } = await req.json();
  if (!validInspectionDate(date) || date >= inspectionDay(-3)) return reply('Choose a date more than three days ago.', 400);
  if (admin) {
    if (!['approved', 'denied'].includes(decision) || typeof userId !== 'string') return reply('Choose a valid decision.', 400);
    const result = await db.prepare("UPDATE inspection_date_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE " + dateRequestWhere + " AND status='pending'")
      .bind(decision, user.id, bid, userId, date).run();
    return result.meta.changes ? jsonResponse({ saved: true }) : reply('This request is no longer pending.', 409);
  }
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) return reply('Enter a reason of up to 1,000 characters.', 400);
  const result = await db.prepare("INSERT INTO inspection_date_requests(business_id,user_id,inspection_date,reason) VALUES(?,?,?,?) ON CONFLICT(business_id,user_id,inspection_date) DO UPDATE SET reason=excluded.reason,status='pending',requested_at=CURRENT_TIMESTAMP,reviewed_at=NULL,reviewed_by=NULL WHERE inspection_date_requests.status='denied'")
    .bind(bid, user.id, date, reason.trim()).run();
  return result.meta.changes ? jsonResponse({ saved: true }) : reply('You already have a pending or approved request for this date.', 409);
}
