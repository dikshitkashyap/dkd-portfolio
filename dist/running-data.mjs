export function dateKey(date, timeZone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
}

export function calendarDays(now = new Date()) {
  const today = dateKey(now);
  const end = new Date(`${today}T12:00:00Z`);
  // Twelve Monday–Sunday weeks, with future days visibly distinct.
  const mondayOffset = (end.getUTCDay() + 6) % 7;
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - mondayOffset - 77);
  return Array.from({ length: 84 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return { date: day.toISOString().slice(0, 10), future: day > end, today: day.toISOString().slice(0, 10) === today };
  });
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function validateSummary(input, year, now = new Date()) {
  if (input?.version === 2) {
    const { coverage, totals, lastRun, updatedAt } = input;
    const today = dateKey(now);
    if (input.status !== 'success' || input.source !== 'COROS' || input.year !== year
      || !coverage || !validDate(coverage.startDate) || !validDate(coverage.endDate)
      || coverage.startDate !== `${year}-01-01` || coverage.endDate > today
      || coverage.endDate < coverage.startDate || coverage.complete !== true
      || !Number.isFinite(totals?.distanceKm) || totals.distanceKm < 0
      || !Number.isFinite(Date.parse(updatedAt)) || Date.parse(updatedAt)>now.getTime()+300000
      || (totals.distanceKm>0 && !lastRun)
      || (lastRun != null && (!validDate(lastRun.date) || lastRun.date<coverage.startDate
        || lastRun.date>coverage.endDate || !Number.isFinite(lastRun.distanceKm)
        || lastRun.distanceKm<0 || lastRun.distanceKm>totals.distanceKm))) throw new Error('Invalid public running summary');
    return { source:'COROS', year, coverage:{startDate:coverage.startDate,endDate:coverage.endDate,complete:true},
      totals:{distanceKm:totals.distanceKm}, lastRun:lastRun?{date:lastRun.date,distanceKm:lastRun.distanceKm}:null, updatedAt };
  }
  if (input?.status !== 'success' || input.source !== 'COROS' || input.version !== 1 || input.year !== year) throw new Error('Invalid running summary');
  const { coverage, totals, updatedAt } = input;
  const today = dateKey(now);
  const stamp = Date.parse(updatedAt);
  if (!coverage || !validDate(coverage.startDate) || !validDate(coverage.endDate)
    || coverage.startDate > coverage.endDate || coverage.endDate > today
    || coverage.startDate < `${year}-01-01` || coverage.endDate > `${year}-12-31`
    || typeof coverage.complete !== 'boolean' || !Number.isFinite(stamp)
    || stamp > now.getTime() + 300000) throw new Error('Invalid coverage');
  if (coverage.complete && coverage.startDate !== `${year}-01-01`) throw new Error('Incomplete yearly coverage');
  if (!totals || !Number.isInteger(totals.runs) || totals.runs < 0 || !Number.isFinite(totals.distanceKm) || totals.distanceKm < 0
    || !Number.isInteger(totals.runDays) || totals.runDays < 0 || totals.runDays > totals.runs) throw new Error('Invalid totals');
  const days = Math.round((Date.parse(`${coverage.endDate}T12:00:00Z`) - Date.parse(`${coverage.startDate}T12:00:00Z`)) / 86400000) + 1;
  if (totals.runDays > days || !Array.isArray(input.runningDates) || input.runningDates.length > 366
    || input.runningDates.some(d => !validDate(d) || d < coverage.startDate || d > coverage.endDate)) throw new Error('Invalid running days');
  const runningDates = [...new Set(input.runningDates)].sort();
  if (runningDates.length !== totals.runDays || (totals.runs === 0 && (totals.distanceKm !== 0 || input.lastRun))) throw new Error('Inconsistent summary');
  let lastRun = null;
  if (input.lastRun != null) {
    if (!validDate(input.lastRun.date) || !runningDates.includes(input.lastRun.date)
      || input.lastRun.date !== runningDates.at(-1) || !Number.isFinite(input.lastRun.distanceKm)
      || input.lastRun.distanceKm < 0 || input.lastRun.distanceKm > totals.distanceKm) throw new Error('Invalid latest run');
    lastRun = { date: input.lastRun.date, distanceKm: input.lastRun.distanceKm };
  }
  // Only the display fields cross this boundary. Provider metadata stays out of the page.
  return { source: 'COROS', year, coverage: { startDate: coverage.startDate, endDate: coverage.endDate, complete: coverage.complete }, totals: { runs: totals.runs, distanceKm: totals.distanceKm, runDays: totals.runDays }, updatedAt, runningDates, lastRun };
}
