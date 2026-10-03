export const DEFAULT_PREFERENCES = { enabled: false, timezone: 'Asia/Jakarta', duration: 30, weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
export function normalizePreferences(value = DEFAULT_PREFERENCES) {
    if (!value || typeof value !== 'object') throw new Error('Invalid meeting settings')
    const { timezone, duration, weekdays, start, end } = value
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() } catch { throw new Error('Invalid timezone') }
    if (typeof timezone !== 'string' || timezone.length > 100 || ![15, 30, 60].includes(duration) ||
        !Array.isArray(weekdays) || !weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7) ||
        ![start, end].every(time => typeof time === 'string' && /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(time)) ||
        minute(end) <= minute(start) || minute(end) - minute(start) < duration) throw new Error('Invalid meeting settings')
    return { enabled: value.enabled === true, timezone, duration, weekdays: [...new Set(weekdays)].sort(), start, end }
}
export function localDate(instant, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
    const get = type => parts.find(part => part.type === type).value
    return `${get('year')}-${get('month')}-${get('day')}`
}
export function slotsForDay(date, preferences, now = new Date()) {
    const p = normalizePreferences(preferences)
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Invalid date')
    const day = Date.parse(`${date}T00:00:00Z`)
    const daysAhead = (day - Date.parse(localDate(now, p.timezone))) / 86400000
    if (daysAhead < 0 || daysAhead > 14 || !p.weekdays.includes(new Date(day).getUTCDay() || 7)) return []
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    const wallTime = ms => {
        const parts = formatter.formatToParts(ms); const get = type => parts.find(part => part.type === type).value
        return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
    }
    const slots = []; const labels = new Set()
    // Enumerating real instants naturally skips DST gaps. Offer one occurrence of repeated wall times.
    for (let start = day - 18 * 3600000; start < day + 42 * 3600000; start += 15 * 60000) {
        const end = start + p.duration * 60000; const from = wallTime(start); const to = wallTime(end)
        if (from.date !== date || to.date !== date || from.minutes < minute(p.start) || from.minutes >= minute(p.end) ||
            (from.minutes - minute(p.start)) % p.duration || to.minutes > minute(p.end) || start < now.getTime() + 2 * 3600000 || labels.has(from.minutes)) continue
        let insideWorkingHours = true
        for (let instant = start; instant < end; instant += 60000) {
            const point = wallTime(instant)
            if (point.date !== date || point.minutes < minute(p.start) || point.minutes >= minute(p.end)) { insideWorkingHours = false; break }
        }
        if (!insideWorkingHours) continue
        labels.add(from.minutes); slots.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() })
    }
    return slots
}
export function availableSlots(slots, busy) {
    return slots.filter(slot => !busy.some(event => Date.parse(event.start) < Date.parse(slot.end) && Date.parse(event.end) > Date.parse(slot.start)))
}
export function normalizeRequest(value) {
    if (!value || typeof value !== 'object') throw new Error('Invalid request')
    const name = typeof value.name === 'string' ? value.name.trim() : ''
    const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : ''
    const note = typeof value.note === 'string' ? value.note.trim() : ''
    if (name.length < 2 || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || note.length > 1000 ||
        typeof value.start !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value.start) || !Number.isFinite(Date.parse(value.start))) throw new Error('Invalid contact or meeting time')
    return { name, email, note, start: new Date(value.start).toISOString() }
}
