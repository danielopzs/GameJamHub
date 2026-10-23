export function jamDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("es-MX", options)
    : "Fecha pendiente";
}
export function taskDate(start: string, offset: number) {
  const time = new Date(start).getTime();
  return Number.isFinite(time)
    ? new Date(time + offset * 86400000).toISOString()
    : "";
}
