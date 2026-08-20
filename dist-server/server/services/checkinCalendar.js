export const CHECKIN_TIME_ZONE = process.env.CHECKIN_TIME_ZONE?.trim() || 'Asia/Shanghai';
const DAY_MS = 24 * 60 * 60 * 1000;
const checkinDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CHECKIN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
export function getCheckinDayKey(date) {
    const parts = checkinDateFormatter.formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}
export function getNextCheckinStreak(latestDay, latestStreak, today) {
    const latest = Date.parse(`${latestDay}T00:00:00.000Z`);
    const current = Date.parse(`${today}T00:00:00.000Z`);
    const isNextDay = Number.isFinite(latest) && Number.isFinite(current)
        && Math.round((current - latest) / DAY_MS) === 1;
    return isNextDay ? latestStreak + 1 : 1;
}
export function getDisplayedCheckinStreak(latestDay, latestStreak, today) {
    if (!latestDay)
        return 0;
    const latest = Date.parse(`${latestDay}T00:00:00.000Z`);
    const current = Date.parse(`${today}T00:00:00.000Z`);
    const daysSinceLatest = Number.isFinite(latest) && Number.isFinite(current)
        ? Math.round((current - latest) / DAY_MS)
        : Number.POSITIVE_INFINITY;
    return daysSinceLatest === 0 || daysSinceLatest === 1 ? latestStreak : 0;
}
//# sourceMappingURL=checkinCalendar.js.map