import { NextRequest, NextResponse } from "next/server";
import { globalRateLimiter } from "../../../utils/rateLimit";
import { describeRequestError, safeRequest } from "../../../utils/ssrfGuard";
import { requireSitecoreUser } from "../../../lib/marketplace-auth/server";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

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

  try {
    // Apply rate limiting on server side
    await globalRateLimiter.acquire();

    // SSRF-guarded: public hosts only, checked at connect time, every
    // redirect hop re-checked, body capped (meta tags live in <head>)
    const { response } = await safeRequest(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SitecoreChecker/1.0)" },
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

    return NextResponse.json({ status, updated });
  } catch (err) {
    return NextResponse.json({
      status: 0,
      updated: null,
      error: describeRequestError(err),
    });
  }
}
