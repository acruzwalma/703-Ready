// Reads the Sam+Alex calendar (secret iCal link) and pulls out what changes training:
// call days, UDA shifts, trips (multi-day all-day events and RDU flight pairs) and evening plans.
const TZ = "America/New_York";
const pad = n => String(n).padStart(2, "0");
const fmtDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export function addDay(s, n) { const t = new Date(s + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return fmtDate(t); }
const dow = s => new Date(s + "T12:00:00Z").getUTCDay(); // 0=Sun

export function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const evs = []; let cur = null;
  for (const ln of lines) {
    if (ln === "BEGIN:VEVENT") cur = { EXDATE: [] };
    else if (ln === "END:VEVENT") { if (cur) evs.push(cur); cur = null; }
    else if (cur) {
      const i = ln.indexOf(":"); if (i < 0) continue;
      const head = ln.slice(0, i), val = ln.slice(i + 1); const name = head.split(";")[0];
      if (name === "EXDATE") cur.EXDATE.push(...val.split(",").map(v => ({ head, val: v })));
      else { cur[name] = val; cur[name + "_H"] = head; }
    }
  }
  return evs;
}
// ICS date/time → local (America/New_York) date string and minutes after midnight
function local(val, head) {
  if (!val) return null;
  if (/VALUE=DATE(?!-)/.test(head || "") || val.length === 8) return { date: `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`, min: null, allDay: true };
  const y = +val.slice(0, 4), mo = +val.slice(4, 6), d = +val.slice(6, 8), h = +val.slice(9, 11), mi = +val.slice(11, 13);
  if (val.endsWith("Z")) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(Date.UTC(y, mo - 1, d, h, mi))).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute, allDay: false };
  }
  return { date: `${y}-${pad(mo)}-${pad(d)}`, min: h * 60 + mi, allDay: false }; // TZID or floating: already wall time
}
const unesc = s => (s || "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

// Expand a recurrence rule into start dates (local) inside [from, to].
function expand(rule, start, from, to, exdates) {
  const r = Object.fromEntries(rule.split(";").map(x => x.split("=")));
  const freq = r.FREQ, interval = +(r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity;
  const until = r.UNTIL ? local(r.UNTIL, r.UNTIL.length === 8 ? "VALUE=DATE" : "").date : "9999-12-31";
  const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const byday = r.BYDAY ? r.BYDAY.split(",").map(x => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return { n: m[1] ? +m[1] : null, wd: DAYS.indexOf(m[2]) }; }) : null;
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(",").map(Number) : null;
  const out = []; let made = 0;
  const push = d => { if (d < start || d > until || made >= count) return; made++; if (d >= from && d <= to && !exdates.has(d)) out.push(d); };
  if (freq === "DAILY") { for (let d = start, k = 0; d <= until && d <= to && made < count && k < 4000; d = addDay(d, interval), k++) push(d); }
  else if (freq === "WEEKLY") {
    const wds = byday ? byday.map(b => b.wd) : [dow(start)];
    let wk = addDay(start, -dow(start));
    for (let k = 0; wk <= until && wk <= to && made < count && k < 800; wk = addDay(wk, 7 * interval), k++)
      for (const wd of [...wds].sort()) push(addDay(wk, wd));
  } else if (freq === "MONTHLY" || freq === "YEARLY") {
    let y = +start.slice(0, 4), m = +start.slice(5, 7);
    for (let k = 0; k < 600 && made < count; k++) {
      const first = `${y}-${pad(m)}-01`; if (first > until || first > to) break;
      const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); const cands = [];
      if (byday) for (const b of byday) {
        const all = []; for (let dd = 1; dd <= dim; dd++) { const s = `${y}-${pad(m)}-${pad(dd)}`; if (dow(s) === b.wd) all.push(s); }
        if (b.n == null) cands.push(...all); else { const pick = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (pick) cands.push(pick); }
      } else if (bymd) for (const md of bymd) { const dd = md > 0 ? md : dim + md + 1; if (dd >= 1 && dd <= dim) cands.push(`${y}-${pad(m)}-${pad(dd)}`); }
      else { const dd = +start.slice(8, 10); if (dd <= dim) cands.push(`${y}-${pad(m)}-${pad(dd)}`); }
      cands.sort().forEach(push);
      if (freq === "YEARLY") y += interval; else { m += interval; while (m > 12) { m -= 12; y++; } }
    }
  }
  return out;
}

// All event occurrences in the window, with recurrence and per-instance overrides applied.
export function occurrences(text, from, to) {
  const evs = parseICS(text); const overrides = new Map(); const out = [];
  for (const e of evs) if (e["RECURRENCE-ID"]) overrides.set(e.UID + "|" + local(e["RECURRENCE-ID"], e["RECURRENCE-ID_H"]).date, e);
  for (const e of evs) {
    if (e["RECURRENCE-ID"]) continue;
    const s = local(e.DTSTART, e.DTSTART_H); if (!s) continue;
    const en = e.DTEND ? local(e.DTEND, e.DTEND_H) : null;
    const spanDays = en ? Math.max(0, Math.round((Date.parse(en.date) - Date.parse(s.date)) / 864e5)) : (s.allDay ? 1 : 0);
    const durMin = !s.allDay && en ? spanDays * 1440 + en.min - s.min : null;
    const ex = new Set(e.EXDATE.map(x => local(x.val, x.head).date));
    const starts = e.RRULE ? expand(e.RRULE, s.date, addDay(from, -40), to, ex) : [s.date];
    for (const d of starts) {
      const ov = overrides.get(e.UID + "|" + d);
      if (ov) continue; // handled below as its own event
      if (e.STATUS === "CANCELLED") continue;
      out.push({ title: unesc(e.SUMMARY), start: d, allDay: s.allDay, min: s.min, durMin, end: s.allDay ? addDay(d, spanDays || 1) : addDay(d, spanDays) });
    }
  }
  for (const e of overrides.values()) {
    if (e.STATUS === "CANCELLED") continue;
    const s = local(e.DTSTART, e.DTSTART_H); const en = e.DTEND ? local(e.DTEND, e.DTEND_H) : null; if (!s) continue;
    const spanDays = en ? Math.max(0, Math.round((Date.parse(en.date) - Date.parse(s.date)) / 864e5)) : 1;
    out.push({ title: unesc(e.SUMMARY), start: s.date, allDay: s.allDay, min: s.min, durMin: !s.allDay && en ? spanDays * 1440 + en.min - s.min : null, end: s.allDay ? addDay(s.date, spanDays || 1) : addDay(s.date, spanDays) });
  }
  return out.filter(o => o.end > from && o.start <= to);
}

const NOT_TRIP = /call|shadow|staying|stay(ing)? w|pay |rent|book |order |birthday|bday|reminder|deadline|due|visit(ing)? us/i;
const REMINDER = /^(book|order|pay|remind|tell|ask|bring|call|pick up|switch|cancel|buy|email|text|submit|renew|schedule|sign|send|check)\b/i;
const FLIGHT = /\b([A-Z]{3})\s*(?:->|→|to)\s*([A-Z]{3})\b/;

export function extract(text, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const from = addDay(today, -60), to = addDay(today, 420);
  const occ = occurrences(text, from, to);
  const callRe = new RegExp(opts.callPattern || "^alex\\s*call", "i"), udaRe = new RegExp(opts.udaPattern || "^UDA\\b", "i");
  const calls = new Set(), uda = {}, trips = [], evening = {};
  for (const o of occ) {
    if (callRe.test(o.title)) { for (let d = o.start, n = 0; (o.allDay ? d < o.end : d === o.start) && n < 30; d = addDay(d, 1), n++) calls.add(d); continue; }
    if (udaRe.test(o.title)) { uda[o.start] = o.allDay ? "all day" : `${Math.floor(o.min / 60)}:${pad(o.min % 60)}`; continue; }
    // trips: all-day events covering 2+ days
    if (o.allDay && Math.round((Date.parse(o.end) - Date.parse(o.start)) / 864e5) >= 2 && !NOT_TRIP.test(o.title)) { trips.push({ title: o.title, start: o.start, end: addDay(o.end, -1), kind: "event" }); continue; }
    // evening plans: timed events starting 4:30–9:30 pm, under 6 h, not reminders
    if (!o.allDay && o.min >= 990 && o.min <= 1290 && (o.durMin == null || o.durMin <= 360) && !REMINDER.test(o.title) && !FLIGHT.test(o.title)) {
      (evening[o.start] = evening[o.start] || []).push({ t: `${((Math.floor(o.min / 60) + 11) % 12) + 1}:${pad(o.min % 60)} pm`, title: o.title.slice(0, 60) });
    }
  }
  // trips from flights: a flight out of RDU paired with the next flight back into RDU (within 3 weeks)
  const flights = occ.filter(o => !o.allDay && FLIGHT.test(o.title)).map(o => { const m = FLIGHT.exec(o.title); return { date: o.start, from: m[1], to: m[2], title: o.title }; }).sort((a, b) => a.date < b.date ? -1 : 1);
  for (let i = 0; i < flights.length; i++) {
    if (flights[i].from !== "RDU") continue;
    const back = flights.slice(i + 1).find(f => f.to === "RDU" && f.date >= flights[i].date && (Date.parse(f.date) - Date.parse(flights[i].date)) / 864e5 <= 21);
    if (!back) continue;
    if (trips.some(t => t.start <= flights[i].date && t.end >= back.date)) continue; // already covered by an all-day trip event
    trips.push({ title: `Trip (${flights[i].from}→${flights[i].to})`, start: flights[i].date, end: back.date, kind: "flights" });
  }
  return { calls: [...calls].sort(), uda, trips: trips.sort((a, b) => a.start < b.start ? -1 : 1), evening };
}
