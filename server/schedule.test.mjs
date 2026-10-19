import { test } from "node:test";
import assert from "node:assert/strict";
import { dueReminders, reminders } from "./schedule.mjs";
const start = "2026-11-30T17:00:00Z";
const at = Date.parse(start);
test("all five role reminders fire only when due, including hour 46", () => {
  for (const r of reminders) {
    const time = at + r.day * 86400000;
    assert.equal(
      dueReminders(start, time - 1).some((x) => x.role === r.role),
      false,
    );
    assert.equal(
      dueReminders(start, time).some((x) => x.role === r.role),
      true,
    );
    assert.equal(
      dueReminders(start, time + 86400000).some((x) => x.role === r.role),
      false,
    );
  }
});
test("invalid event date produces no notification", () =>
  assert.deepEqual(dueReminders("invalid"), []));
