import { automaticReminders, eventReminders } from "../shared/planning.mjs";
export const reminders = automaticReminders;
export function dueReminders(startOrEvent, now = Date.now(), custom = []) {
  const event =
    typeof startOrEvent === "string" ? { start: startOrEvent } : startOrEvent;
  return eventReminders(event, custom).filter(
    (r) => now >= r.at && now - r.at < 86400000,
  );
}
