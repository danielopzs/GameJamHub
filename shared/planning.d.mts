export type PlanningEvent = {
  start: string;
  end?: string;
  planningStart?: string;
};
export type ScheduledReminder = {
  id: string;
  day?: number;
  role?: string;
  audience: string;
  level: string;
  text: string;
  at: number;
};
export function taskTimestamp(
  event: PlanningEvent,
  task: { id: number; phase: number; day: number },
): number;
export const automaticReminders: Array<{
  id: string;
  day: number;
  role: string;
  audience: string;
  level: string;
  text: string;
}>;
export function eventReminders(
  event: PlanningEvent,
  custom?: Array<{
    id: string;
    audience: string;
    level: string;
    text: string;
    at: string;
  }>,
): ScheduledReminder[];
