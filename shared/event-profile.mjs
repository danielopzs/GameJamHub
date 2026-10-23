export function eventSize(participants) {
  if (
    typeof participants !== "number" ||
    !Number.isInteger(participants) ||
    participants < 0
  )
    return "Por definir";
  return participants <= 15
    ? "Pequeño"
    : participants <= 50
      ? "Mediano"
      : "Grande";
}
export function validJoinUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048)
    return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
/** Read both the original single-role records and the new multiple-role records. */
export function memberRoles(member) {
  const values = Array.isArray(member?.roles) ? member.roles : [member?.role];
  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim()),
    ),
  ];
}
