import { loadEnv } from "vite";
const values = { ...loadEnv("cloud", process.cwd(), "VITE_"), ...process.env };
const key =
  values.VITE_SUPABASE_PUBLISHABLE_KEY || values.VITE_SUPABASE_ANON_KEY || "";
if (key) {
  let valid = key.startsWith("sb_publishable_");
  if (!valid && !key.startsWith("sb_secret_")) {
    try {
      valid =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "anon";
    } catch {}
  }
  if (!valid) {
    console.error(
      "Build blocked: use only the public Supabase publishable/anon key. Never put secret/service_role credentials in a frontend build.",
    );
    process.exit(1);
  }
}
console.log(
  key
    ? "Public Supabase key format verified."
    : "No build-time Supabase key: runtime config.js or setup screen will be used.",
);
