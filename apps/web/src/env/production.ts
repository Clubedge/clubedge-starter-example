// The variables a production deploy needs, for the modules this project uses. Hosts that only run
// the app (Vercel, Netlify) check them before the build with `pnpm check:env`, so a missing key
// stops the deploy instead of shipping an app whose features fail at runtime.
import { parseClientIpSettings } from "@clubedge/core";
import { isNeonPooledUrl } from "@clubedge/db/urls";

type Env = Record<string, string | undefined>;

/**
 * `url`: an absolute URL to a hosted service, not this machine. `serverless`: only on hosts that
 * run no long-lived process (Vercel, Netlify).
 */
export type Requirement = { key: string; use: string; url?: boolean; serverless?: boolean };

/** What every production deploy of this project needs. */
export function requiredVariables(env: Env): Requirement[] {
  const required: Requirement[] = [
    { key: "DATABASE_URL", use: "the database", url: true },
    { key: "NEXT_PUBLIC_APP_URL", use: "links in emails and redirects", url: true },
    { key: "BETTER_AUTH_SECRET", use: "Better Auth sessions" },
    { key: "REDIS_URL", use: "the cache and rate limits", url: true },
    { key: "STORAGE_BUCKET", use: "file storage" },
    { key: "STORAGE_ACCESS_KEY_ID", use: "file storage" },
    { key: "STORAGE_SECRET_ACCESS_KEY", use: "file storage" },
    { key: "SMTP_URL", use: "email", url: true },
    { key: "EMAIL_FROM", use: "the sender of every email" },
  ];
  const serverless = Boolean(env.VERCEL || env.NETLIFY);
  return required.filter((requirement) => serverless || !requirement.serverless);
}

/** The host of an absolute URL, or null for a value that isn't one. */
function urlHost(value: string): string | null {
  try {
    return new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** A URL to this machine: from a development env file, unreachable from the deployed app. */
export function isLocalUrl(value: string): boolean {
  const host = urlHost(value);
  if (host === null) return false;
  return (
    ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "host.docker.internal"].includes(host) ||
    host.endsWith(".localhost")
  );
}

export type ProductionEnvCheck = { missing: Requirement[]; local: string[]; invalid: string[] };

/** The required variables that are unset, point at this machine, or have an unusable value. */
export function checkProductionEnv(env: Env): ProductionEnvCheck {
  const required = requiredVariables(env);
  const missing = required.filter(({ key }) => !env[key]?.trim());
  const urls = required.filter(({ key, url }) => url && env[key]?.trim());
  const local = urls.filter(({ key }) => isLocalUrl(env[key]!)).map(({ key }) => key);
  const invalid = urls
    .filter(({ key }) => urlHost(env[key]!) === null)
    .map(({ key }) => `${key} is not an absolute URL`);
  // Optional, but migrations and the jobs worker use it instead of DATABASE_URL when it is set.
  const direct = env.DATABASE_URL_DIRECT?.trim();
  if (direct) {
    if (urlHost(direct) === null) invalid.push("DATABASE_URL_DIRECT is not an absolute URL");
    else if (!/^postgres(ql)?:\/\//i.test(direct)) {
      invalid.push("DATABASE_URL_DIRECT is not a postgresql:// URL");
    } else if (isLocalUrl(direct)) local.push("DATABASE_URL_DIRECT");
    else if (isNeonPooledUrl(direct)) {
      invalid.push("DATABASE_URL_DIRECT points at Neon's pooler: use the host without -pooler");
    }
  }
  // Optional too: where rate limits find the client's address (SETUP.md, "Client addresses").
  try {
    parseClientIpSettings(env);
  } catch (error) {
    invalid.push((error as Error).message);
  }
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (secret && secret.length < 32) invalid.push("BETTER_AUTH_SECRET needs at least 32 characters");
  // .env.example's placeholder sender: providers refuse a domain you haven't verified.
  if (/@example\.com\b/i.test(env.EMAIL_FROM ?? "")) {
    invalid.push("EMAIL_FROM still uses example.com: set a sender on a domain you verified");
  }
  return { missing, local, invalid };
}
