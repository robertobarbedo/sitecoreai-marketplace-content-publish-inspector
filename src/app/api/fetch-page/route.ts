import { NextRequest, NextResponse } from "next/server";
import { globalRateLimiter } from "../../../utils/rateLimit";
import { BlockedUrlError, describeRequestError, safeRequest } from "../../../utils/ssrfGuard";
import { requireSitecoreUser } from "../../../lib/marketplace-auth/server";
import { auditLog } from "../../../lib/marketplace-auth/audit-log";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

// Host only: the path and query of a customer's page are not logged
function targetHost(url: string): string | undefined {
  try {
    return new URL(url).hostname || undefined;
  } catch {
    return undefined;
  }
}

function extractMetaValue(html: string, metaName: string): string | null {
  const metaPattern = /<meta\s+([^>]*)>/gi;
  let match;
  const nameEscaped = metaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(`name\\s*=\\s*["']${nameEscaped}["']`, "i");
  while ((match = metaPattern.exec(html)) !== null) {
    const attrs = match[1];
    if (nameRe.test(attrs)) {
      const contentMatch = attrs.match(/content\s*=\s*["']([^"']+)["']/i);
      if (contentMatch) return contentMatch[1];
    }
  }
  return null;
}

interface FetchPageBody {
  url?: unknown;
  source?: unknown;
  name?: unknown;
  followRedirect?: unknown;
  requestHeader?: unknown;
}

// RFC 9110 field-name token
const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/;
// Visible ASCII, space and tab only: no CR/LF (header injection) or other controls
const HEADER_VALUE_RE = /^[\t\x20-\x7e]{1,2048}$/;

type RequestHeaderResult = { ok: true; header?: Record<string, string> } | { ok: false; error: string };

// Optional extra header (e.g. x-vercel-protection-bypass). Never logged.
function parseRequestHeader(raw: unknown): RequestHeaderResult {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== "object") return { ok: false, error: "Invalid requestHeader" };
  const { name, value } = raw as { name?: unknown; value?: unknown };
  if (typeof name !== "string" || typeof value !== "string") {
    return { ok: false, error: "Invalid requestHeader" };
  }
  const headerName = name.trim();
  const headerValue = value.trim();
  if (!headerName || !headerValue) return { ok: true };
  if (!HEADER_NAME_RE.test(headerName)) return { ok: false, error: "Invalid request header name" };
  if (!HEADER_VALUE_RE.test(headerValue)) return { ok: false, error: "Invalid request header value" };
  return { ok: true, header: { [headerName]: headerValue } };
}

// POST so the page URL travels in the body, never in request logs
export async function POST(request: NextRequest) {
  const auth = await requireSitecoreUser(request);
  if (!auth.ok) return auth.response;

  let body: FetchPageBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const source = body.source === "header" ? "header" : "meta";
  const name = typeof body.name === "string" && body.name ? body.name : "Last-Modified";
  const followRedirect = body.followRedirect === true;
  const requestHeader = parseRequestHeader(body.requestHeader);
  if (!requestHeader.ok) {
    return NextResponse.json({ error: requestHeader.error }, { status: 400 });
  }
  const audit = {
    event: "website.fetch",
    sub: auth.user.sub,
    org: auth.user.organizationId,
    targetHost: targetHost(url),
  };

  try {
    // Apply rate limiting on server side
    await globalRateLimiter.acquire();

    // SSRF-guarded: public hosts only, checked at connect time, every
    // redirect hop re-checked, body capped (meta tags live in <head>)
    const { response } = await safeRequest(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SitecoreChecker/1.0)" },
      // Secret-bearing: sent only while the request stays on the page's origin
      originHeaders: requestHeader.header,
      timeoutMs: 15000,
      maxBodyBytes: MAX_BODY_BYTES,
      maxRedirects: followRedirect ? MAX_REDIRECTS : 0,
      skipBody: source === "header",
    });

    const status = response.status;
    let updated: string | null = null;

    if (status >= 200 && status < 300) {
      if (source === "header") {
        updated = response.headers.get(name);
      } else {
        updated = extractMetaValue(await response.text(), name);
      }
    }

    auditLog(request, { ...audit, outcome: "allow", targetStatus: status });
    return NextResponse.json({ status, updated });
  } catch (err) {
    auditLog(request, {
      ...audit,
      outcome: err instanceof BlockedUrlError ? "deny" : "error",
      reason: describeRequestError(err),
    });
    return NextResponse.json({
      status: 0,
      updated: null,
      error: describeRequestError(err),
    });
  }
}
