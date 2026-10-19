/** Netlify deploys the cloud build; the standalone offline demo remains available. */
export const CLOUD_BUILD = import.meta.env.MODE === "cloud";
export const STATIC_MODE = ["static", "cloud"].includes(import.meta.env.MODE);
