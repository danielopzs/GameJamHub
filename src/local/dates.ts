export function jamDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("es-MX", options)
    : "Fecha pendiente";
}
export function taskDate(start: string, offset: number) {
  const time = new Date(start).getTime();
  return Number.isFinite(time)
    ? new Date(time + offset * 86400000).toISOString()
    : "";
}
export function inputDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
}
