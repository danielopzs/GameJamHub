export type CloudEvent = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};
export type AccessMember = {
  email: string;
  name: string;
  role: "organizer" | "judge";
};
export type RankingRow = {
  team_code: string;
  jury_average: number;
  judge_count: number;
  total: number;
};
export type Dataset = Record<string, unknown>;
export type Draft = { value: unknown; revision: number; blocked?: boolean };
export type Snapshot = {
  data: Dataset;
  revisions: Record<string, number>;
  drafts: Record<string, Draft>;
};
