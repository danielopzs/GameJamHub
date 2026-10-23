export type JamAnswers = {
  mode?: "Presencial" | "Virtual" | "Híbrido";
  start?: string;
  end?: string;
  planningStart?: string;
  student?: boolean;
  studentName?: string;
  crew?: { name: string; email: string; role: string; color: string }[];
  venue?: string;
  university?: boolean;
  universityRelation?: string;
  framework?: boolean;
  frameworkName?: string;
  platform?: string;
  participants?: number;
  infrastructure?: boolean;
  partner?: boolean;
  partnerName?: string;
  civil?: boolean;
  civilName?: string;
  teamSize?: number;
};
export type Organizer = {
  id: string;
  name: string;
  username: string;
  email: string;
  role?: "organizer" | "judge" | "participant" | "staff";
};
export type LocalJam = {
  id: string;
  name: string;
  edition?: string;
  createdAt?: string;
  onboarded: boolean;
  answers: JamAnswers;
  answersRevision: number;
};
export type LocalSnapshot = {
  user: Organizer;
  jam: LocalJam;
  state: { key: string; value: unknown; revision: number }[];
};
export async function localApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api/local/" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "No se pudo leer la respuesta. Comprueba que el servidor local esté activo.",
    );
  }
  if (!response.ok)
    throw Object.assign(
      new Error(data.error || "No se pudo completar la solicitud."),
      { status: response.status },
    );
  return data as T;
}
