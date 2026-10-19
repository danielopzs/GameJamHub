import { createClient } from "@supabase/supabase-js";
declare global {
  interface Window {
    __GAMEJAM_CONFIG__?: {
      supabaseUrl?: string;
      supabasePublishableKey?: string;
    };
  }
}
const runtime = window.__GAMEJAM_CONFIG__;
export const projectUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  runtime?.supabaseUrl ||
  ""
).trim();
const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  runtime?.supabasePublishableKey ||
  ""
).trim();
export function configurationError(): string | null {
  if (!projectUrl || !publicKey)
    return "Faltan la URL y la clave pública de tu proyecto Supabase.";
  try {
    if (new URL(projectUrl).protocol !== "https:")
      return "La URL de Supabase debe usar HTTPS.";
  } catch {
    return "La URL de Supabase no es válida.";
  }
  if (publicKey.startsWith("sb_secret_"))
    return "No uses una clave secreta en el frontend. Sustitúyela por la clave publishable.";
  if (!publicKey.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(
        atob(publicKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon")
        return "Solo se permite una clave pública publishable o anon.";
    } catch {
      return "La clave pública de Supabase no tiene un formato válido.";
    }
  }
  return null;
}
export const supabase = configurationError()
  ? null
  : createClient(projectUrl, publicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
