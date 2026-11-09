import { createHash } from "crypto";
import { safeRequest } from "./ssrfGuard";

/**
 * Vercel "Password Protection" support. The protected site answers every
 * request with a password form; POSTing `_vercel_password` to it returns a
 * `_vercel_jwt` cookie that unlocks the deployment. We log in once per
 * origin + password, cache the cookie in memory, and send it with each page
 * check (origin-bound, like any other secret header).
 *
 * The password and cookie are never logged or returned to the browser.
 */

const COOKIE_NAME = "_vercel_jwt";
/** Vercel issues a 90-day cookie; re-login well before that. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const LOGIN_TIMEOUT_MS = 15000;

export class VercelPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VercelPasswordError";
  }
}

interface CacheEntry {
  cookie: Promise<string>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(origin: string, password: string): string {
  return createHash("sha256").update(`${origin}\n${password}`).digest("hex");
}

function extractJwt(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = setCookie.match(/(?:^|[\s,;])_vercel_jwt=([^;,\s]+)/);
  return match ? match[1] : null;
}

async function login(origin: string, password: string): Promise<string> {
  const { response } = await safeRequest(`${origin}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; SitecoreChecker/1.0)",
    },
    body: new URLSearchParams({ _vercel_password: password }).toString(),
    timeoutMs: LOGIN_TIMEOUT_MS,
    maxBodyBytes: 64 * 1024,
    maxRedirects: 0, // the 303 that carries the cookie is all we need
    skipBody: true,
  });
  const jwt = extractJwt(response.headers.get("set-cookie"));
  if (!jwt) {
    throw new VercelPasswordError(
      response.status === 401 || response.status === 403 || (response.status >= 200 && response.status < 400)
        ? "Vercel password was rejected"
        : `Vercel password login failed (HTTP ${response.status})`,
    );
  }
  return `${COOKIE_NAME}=${jwt}`;
}

/**
 * Returns the `Cookie` value that unlocks `origin`, logging in if needed.
 * Concurrent page checks share one login.
 */
export function getVercelPasswordCookie(origin: string, password: string, { fresh = false } = {}): Promise<string> {
  const key = cacheKey(origin, password);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && !fresh && hit.expiresAt > now) return hit.cookie;

  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(k);
    }
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  }

  const cookie = login(origin, password);
  const entry: CacheEntry = { cookie, expiresAt: now + CACHE_TTL_MS };
  cache.set(key, entry);
  // A failed login must not stick: the next check retries
  cookie.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return cookie;
}
