import { test } from "node:test";
import assert from "node:assert/strict";
import { taskTimestamp, eventReminders } from "../shared/planning.mjs";
const event = {
  planningStart: "2027-04-21T10:00:00Z",
  start: "2027-05-01T10:00:00Z",
  end: "2027-05-04T10:00:00Z",
};
test("short planning windows are compressed and delivery follows the actual event end", () => {
  assert.equal(
    taskTimestamp(event, { id: 0, phase: 0, day: -60 }),
    Date.parse(event.planningStart),
  );
  assert.equal(
    taskTimestamp(event, { id: 10, phase: 1, day: -30 }),
    Date.parse("2027-04-26T10:00:00Z"),
  );
  assert.equal(
    taskTimestamp(event, { id: 45, phase: 4, day: 0 }),
    Date.parse(event.end) - 7200000,
  );
  assert.equal(
    taskTimestamp(event, { id: 46, phase: 4, day: 0 }),
    Date.parse(event.end),
  );
  assert.equal(
    taskTimestamp(event, { id: 50, phase: 5, day: 3 }),
    Date.parse(event.end) + 86400000,
  );
  const scheduled = eventReminders(event, [
    {
      id: "custom",
      audience: "Jueces",
      text: "Presentación",
      level: "action",
      at: "2027-05-04T11:00:00Z",
    },
  ]);
  assert.equal(
    scheduled.find((r) => r.id === "upload").at,
    Date.parse(event.end) - 7200000,
  );
  assert.equal(
    scheduled.find((r) => r.id === "committee").at,
    Date.parse(event.planningStart),
  );
  assert.equal(scheduled.find((r) => r.id === "custom").audience, "Jueces");
  assert.equal(
    scheduled.find((r) => r.id === "judge-ready").at,
    Date.parse(event.start) - 86400000,
  );
});
