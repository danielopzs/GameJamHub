export function eventSize(
  participants: unknown,
): "Pequeño" | "Mediano" | "Grande" | "Por definir";
export function validJoinUrl(value: unknown): boolean;
export function memberRoles(member: {
  role?: string;
  roles?: string[];
}): string[];
