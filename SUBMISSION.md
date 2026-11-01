# Marketplace submission: Content Publish Inspector

Copy-paste text for Sitecore's public-app submission form, in form order.
Replace `{{APP_URL}}` with the production deployment URL before submitting.

## 1. App name

Content Publish Inspector

## 2. Headline

<!-- 347 chars -->

Debug SitecoreAI publishing in one view. Compare the authoring content tree with Experience Edge Preview, Experience Edge Live and your rendered website side by side, and spot items stuck in workflow, content that was never published or is outdated, and pages that return errors. Drill into fields, versions, workflow and layout data for any item.

## 3. Description

When content doesn't show up on a SitecoreAI site, the cause can be in several places: the item is stuck in workflow, it was never published to the Preview or Live Experience Edge endpoint, the published version is older than the authoring version, or the website serves a stale or broken page. Content Publish Inspector puts all four stages next to each other so you can see where content stopped, without switching between the Content Editor, GraphQL IDEs and the browser.

Key features:
- Four synchronized columns: Authoring API, Delivery API Preview, Delivery API Live and Website, with shared scrolling and row hover
- Workflow state badges for items in a non-final workflow state
- Freshness check: Preview and Live rows are flagged as outdated when their __Updated value differs from authoring, or as not found when the item isn't published there
- Website check: fetches each page's Live URL and shows the HTTP status, redirects and errors, and compares a timestamp read from a configurable HTTP header or meta tag
- Language switcher and a custom tree root (item path or GUID)
- Item details: metadata, access rights, publishing restrictions, versions, workflow, all fields, raw JSON and the GraphQL query used; a Layout tab runs the Experience Edge layout query
- Redirect and trailing-slash options, and built-in throttling (default 30 requests per second)

Use cases:
- Troubleshoot why a page is missing or outdated on the live site
- Look up field values and layout data on Preview and Live
- Check workflow states and publishing restrictions before a release
- Verify that every language version is published

All Sitecore queries run with the signed-in user's own permissions. The app is read-only and writes nothing to the content tree.

## 4. Financial model

Free

## 5. Categories

Suggested (match to the portal's category list before submitting):
- Developer tools
- Publishing
- Content management

## 6. Screenshots to capture

PNG, shown as 600×900 thumbnails. Capture during live QA. The existing images in `publishing/tool-01.png` to `tool-04.png` can be reused if they still match the current UI.

1. The four-column view with a site tree expanded, showing found, not found and outdated rows and website status badges.
2. An authoring item showing a workflow state badge next to the matching not-found Preview/Live rows.
3. The Authoring item details modal (fields, versions, workflow tab).
4. The Delivery item details modal on the Layout tab with a site and language selected.
5. The Website Settings dialog (meta tag / HTTP header source, redirect and trailing-slash options).

## 7. Links

- Website: https://github.com/robertobarbedo/sitecoreai-marketplace-content-publish-inspector
- Support: https://github.com/robertobarbedo/sitecoreai-marketplace-content-publish-inspector/issues
- Privacy policy: https://github.com/robertobarbedo/sitecoreai-marketplace-content-publish-inspector/blob/main/PRIVACY.md
- Terms of service: https://github.com/robertobarbedo/sitecoreai-marketplace-content-publish-inspector/blob/main/TERMS.md

## 8. Data usage disclosure

Paste from `DATA-USAGE.md`.

Summary: Sitecore content is read through the Marketplace SDK with the user's own permissions and is held only in browser memory; nothing is written to Sitecore and there is no database. Page URLs are sent to the app's own signed-in `/api/fetch-page` route, which fetches the public page and returns only the HTTP status and timestamp. Server audit logs (user ID, organization ID, target host name, status, no content or tokens) are kept for 90 days; sign-in tokens and preferences stay in the browser's localStorage.

## 9. AI usage disclosure switch

Off. The app does not use AI or machine learning.

## 10. Configuration tab

- Extension point: **Full Screen**, route `/`.
- API access: **SitecoreAI APIs** (the app calls `xmc.authoring.graphql`, `xmc.preview.graphql` and `xmc.live.graphql` through the Marketplace SDK, plus `application.context`).
- Permissions: none required by the code (no `window.open`, clipboard or file downloads). Note: page URLs in the Website column open with `target="_blank"`; if they don't open in the portal iframe during QA, enable **Pop-ups**.
- Deployment URL: `{{APP_URL}}`
- Client credentials (custom authorization): **Yes**, required for the Website column (`/api/fetch-page`). Create Single-page app credentials and register:
  - Allowed callback URL: `{{APP_URL}}/` (with trailing slash)
  - Logout URL, web origin, CORS origin: `{{APP_URL}}` (origin, no path)
- Environment variables on the host (inlined at build time, rebuild after changing):
  - `NEXT_PUBLIC_AUTH0_CLIENT_ID` (required): client ID of the SPA client credentials
  - `NEXT_PUBLIC_SITECORE_APP_ID` (required): Marketplace app ID
  - Optional: `RATE_LIMIT_PER_SECOND` (default 30), `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_AUDIENCE`, `NEXT_PUBLIC_AUTH0_SCOPE`, `AUTH0_ISSUER`, `CSP_FRAME_ANCESTORS`
- App logo: `public/icon.png`

## 11. Submission details (visible only to Sitecore)

- Contact name: `Roberto Barbedo`
- Contact email: `rb205@proton.me`

**App functionality**

Content Publish Inspector is a Next.js 16 full-stack app on the Full Screen extension point. The browser does almost all the work: it loads the authoring content tree from the Authoring and Management GraphQL API (`xmc.authoring.graphql`, master database) and, for each loaded item, runs an Experience Edge `item(path, language)` query against `xmc.preview.graphql` and `xmc.live.graphql`, all through the Marketplace SDK. For the Website column, the site list and page URLs come from Experience Edge; the browser sends each Live URL to the app's own `/api/fetch-page` route with a Sitecore Cloud access token obtained through custom authorization (Auth0 SPA client credentials). The server verifies the token, checks the URL, fetches the public page and returns only the HTTP status and the extracted timestamp. A second route, `/api/config`, is public and returns only the rate-limit number. The app has no database and stores nothing in Sitecore: preferences and sign-in tokens live in the browser's localStorage, and the server writes JSON audit lines to the hosting log.

**Business value / alignment with Sitecore standards**

The app gives developers, QA and editors one place to find where content stopped between authoring and the live site, which otherwise takes several tools. It uses only supported Marketplace SDK APIs (`application.context`, `xmc.authoring.graphql`, `xmc.preview.graphql`, `xmc.live.graphql`) and Sitecore Cloud sign-in, and every Sitecore query runs with the signed-in user's own permissions; it is read-only. The UI follows the Blok design language (tokens, typography, badges). Security measures: server-side token verification (RS256 signature against the issuer's JWKS, issuer, audience, expiry and `azp` bound to this app's client ID); an SSRF guard on `/api/fetch-page` (http/https on ports 80/443 only, no URL credentials, public addresses only, every redirect re-checked, 15 s timeout, 2 MB cap); security headers on every response (HSTS, CSP frame-ancestors limited to SitecoreAI, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and `Cache-Control: no-store` on API routes; a token-bucket rate limiter in the browser and on the server; and audit logging of sign-in decisions and website fetches with no tokens, content or URL paths. There are no server-side secrets and no analytics.

**Licensing note**

Next.js lists sharp (LGPL-3.0 libvips) as an optional dependency for image optimization; this app doesn't use next/image and sets `images.unoptimized`, so sharp is never loaded. The app uses plain CSS and does not depend on Tailwind CSS or lightningcss at all.

## 12. Pre-submit checklist

- [ ] Live QA in a SitecoreAI environment: all four columns load, outdated/not-found flags are correct, Website column shows statuses and timestamps
- [ ] Layout tab returns data for a chosen site and language
- [ ] Production client credentials created with the production callback, logout, web origin and CORS URLs (`{{APP_URL}}`)
- [ ] `NEXT_PUBLIC_AUTH0_CLIENT_ID` and `NEXT_PUBLIC_SITECORE_APP_ID` set on the production host and the app rebuilt
- [ ] Screenshots captured (PNG) and checked against the current UI
- [ ] `{{APP_URL}}` replaced with the production deployment URL in this form
- [ ] PRIVACY.md and TERMS.md links open on GitHub (`main` branch)
