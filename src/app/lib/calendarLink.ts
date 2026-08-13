// Build a Google Calendar "add event" link.
// date: "YYYY-MM-DD", time: "HH:MM", durationMin: number
export function googleCalendarUrl(opts: {
  title: string;
  date: string;
  time: string;
  durationMin: number;
  details?: string;
  location?: string;
}): string {
  const { title, date, time, durationMin, details = "", location = "" } = opts;
  const pad = (n: number) => String(n).padStart(2, "0");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "10:00").split(":").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 10, mm ?? 0);
  const end = new Date(start.getTime() + durationMin * 60000);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
    location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}
