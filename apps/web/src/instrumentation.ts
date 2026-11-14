/** Runs once when the server starts. */
export async function register() {
  // Server code belongs to the Node.js server: not the Edge runtime, and not `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // A CLIENT_IP_HEADER or TRUSTED_PROXY_HOPS that cannot be right stops the server here.
  const { getClientIpSettings } = await import("./env/server");
  getClientIpSettings();
}
