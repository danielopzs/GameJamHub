import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventSize,
  memberRoles,
  validJoinUrl,
} from "../shared/event-profile.mjs";
test("event size follows participant boundaries, including zero, without organizer input", () => {
  for (const [count, size] of [
    [0, "Pequeño"],
    [15, "Pequeño"],
    [16, "Mediano"],
    [50, "Mediano"],
    [51, "Grande"],
    [1000, "Grande"],
  ])
    assert.equal(eventSize(count), size);
  for (const invalid of [undefined, null, "", -1, 1.5, NaN])
    assert.equal(eventSize(invalid), "Por definir");
});
test("joining links accept HTTP/HTTPS and reject unsafe schemes and embedded credentials", () => {
  for (const url of [
    "https://discord.gg/jam",
    "https://meet.google.com/abc-defg-hij",
    "http://192.168.1.10:5174",
  ])
    assert.equal(validJoinUrl(url), true);
  for (const url of [
    "",
    "not a url",
    "javascript:alert(1)",
    "data:text/html,test",
    "ftp://example.com",
    "https://user:password@example.com",
    undefined,
  ])
    assert.equal(validJoinUrl(url), false);
});
test("legacy single-role members retain their role and multiple responsibilities stay distinct", () => {
  assert.deepEqual(memberRoles({ role: "Logística" }), ["Logística"]);
  assert.deepEqual(
    memberRoles({
      role: "Logística",
      roles: [" Logística ", "Marketing", "Logística"],
    }),
    ["Logística", "Marketing"],
  );
});
