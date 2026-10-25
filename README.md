# Content Publish Inspector

A side-by-side publishing debugger for SitecoreAI developers, QA teams and
content editors.

When content doesn't show up on a SitecoreAI (XM Cloud) site, the cause can be
in several places: the item is stuck in workflow, it was never published to
the Preview or Live Experience Edge endpoint, the published version is older
than the authoring version, or the rendering host serves a stale or broken
page. Checking each of these by hand means switching between the Content
Editor, GraphQL IDEs and the browser.

Content Publish Inspector puts all four stages next to each other. It shows
the authoring content tree and, row by row, whether each item exists in the
Preview and Live Delivery APIs, whether its `__Updated` timestamp matches
authoring, and what the rendered website returns for that page.

## Features

- **Four synchronized columns** — Authoring API, Delivery API Preview,
  Delivery API Live and Website, with shared scrolling and row hover.
- **Workflow state badges** — items in a non-final workflow state show the
  state name in the authoring tree.
- **Freshness check** — Delivery rows are flagged as outdated when their
  `__Updated` value differs from authoring; "not found" when the item isn't
  published to that endpoint.
- **Website check** — for every page item under a site root, fetches the
  page's Live URL and shows the HTTP status, redirects and errors.
- **Website timestamp comparison** — reads the page's updated timestamp from a
  configurable HTTP header or `<meta>` tag and compares it with Preview and
  Live.
- **Language switcher** — lists the languages under
  `/sitecore/system/Languages` and reloads all columns for the selected one.
- **Change the tree root** — start the tree at any item path or GUID instead
  of `/sitecore/content`.
- **Authoring item details** — metadata, access rights, publishing
  restrictions, versions, workflow and all fields, plus the raw JSON and the
  GraphQL query used.
- **Delivery item details** — fields, personalization variants, child count,
  raw JSON, the query, and a Layout tab that runs the Experience Edge `layout`
  query for a chosen site and language.
- **Redirect and trailing-slash options** — follow redirects for the homepage
  and/or other pages, and add or remove trailing slashes before fetching.
- **Built-in throttling** — all GraphQL queries and page fetches go through a
  token-bucket rate limiter (default 30 requests per second).

## How it works

- **Extension point:** Full Screen.
- **Authoring column:** the browser calls the Authoring and Management GraphQL
  API (`xmc.authoring.graphql`, `master` database) through the Sitecore
  Marketplace SDK
  ([`@sitecore-marketplace-sdk/client`](https://www.npmjs.com/package/@sitecore-marketplace-sdk/client),
  [`@sitecore-marketplace-sdk/xmc`](https://www.npmjs.com/package/@sitecore-marketplace-sdk/xmc)).
  Children are loaded as you expand nodes.
- **Preview and Live columns:** for every item loaded in the authoring tree,
  the browser runs an Experience Edge `item(path, language)` query against
  `xmc.preview.graphql` and `xmc.live.graphql` through the SDK, using the
  environment's Preview and Live context IDs from `application.context`.
- **Website column:**
  1. The site list (name and root path) comes from the Preview endpoint's
     `site.allSiteInfo`.
  2. For each item that has presentation and sits under a site root, the page
     URL is taken from the Live endpoint's `url { url }`.
  3. The browser sends that URL to the app's own `/api/fetch-page` route with
     a Sitecore Cloud access token. The route verifies the token, checks the
     URL (see Security), fetches the page server-side and returns only the
     HTTP status and the extracted timestamp.

```
Browser (inside SitecoreAI)
  ├─ Marketplace SDK ──> Authoring GraphQL, Experience Edge Preview / Live
  └─ authedFetch ─────> /api/fetch-page (app server) ──> your public website
```

Status rules in the Website column:

| Shown as | Condition |
| --- | --- |
| Greyed out | Item has no presentation, is not under a site root, or has no Live URL |
| Status badge (grey) | 3xx response that was not followed |
| Status badge (red) | Response outside 2xx/3xx, or the fetch failed |
| Timestamp (normal) | Website value equals both Preview and Live `__Updated` |
| Timestamp (amber) | Website value equals Live but not Preview |
| Timestamp (orange) | Website value does not match Live |
| No timestamp | 2xx response but the header or meta tag was not found |

The comparison is an exact string match against the raw `__Updated` value
(for example `20260101T120000Z`), so your rendering host must emit that value
unchanged for the timestamp check to work. Redirect handling treats items named
`home` or `homepage` as the homepage.

## Requirements

- A SitecoreAI (XM Cloud) organization with at least one environment.
- Permission to create and install apps in the Cloud Portal App Studio.
- Users of the app need read access to the items they inspect; all Sitecore
  queries run with the signed-in user's own permissions.
- Custom authorization (SPA client credentials) for the app in the Cloud
  Portal, used by the Website column.
- For the timestamp comparison: the rendering host must expose the item's
  `__Updated` value in a response header or `<meta>` tag. Without it, the
  Website column still shows HTTP status codes.
- The website must be reachable from the public internet on port 80 or 443.

## Install in SitecoreAI

1. In the Cloud Portal, open **App Studio** and choose **Create App**.
2. Set **App name** to `Content Publish Inspector` and **Type** to `Custom`.
3. Under **Extension points**, enable **Full Screen** with the root route
   `/`.
4. Under **API access**, select **SitecoreAI APIs**.
5. Set **Deployment URL** to your deployment, for example
   `https://<your-deployment>/`. A public deployment is available at
   `https://content-publish-inspector.vercel.app/`.
6. Upload the app logo from [`public/icon.png`](public/icon.png).
7. Enable custom authorization and create **client credentials** of type
   **Single-page app**. Register your deployment origin (no path) as:
   - Allowed callback URL, with a trailing slash:
     `https://<your-deployment>/`
   - Logout URL, web origin and CORS origin: `https://<your-deployment>`
8. Copy the client ID and the Marketplace app ID into
   `NEXT_PUBLIC_AUTH0_CLIENT_ID` and `NEXT_PUBLIC_SITECORE_APP_ID` on your
   deployment and rebuild it (see below).
9. Save the app, go to **My apps** and click **Install**.
10. Open the app from the apps menu in the top-right corner of the SitecoreAI
    environment portal.

The server only accepts tokens issued to the client ID the deployment was
built with. If you create your own app in App Studio, deploy your own
instance with your own client credentials; otherwise the Website column will
fail to sign in.

## Deploy your own instance

```bash
npm install
npm run build
npm start          # serves on port 5000
```

Deploy to Vercel or any Node.js host that runs Next.js, then point the App
Studio deployment URL at it.

Environment variables (create `.env.local` locally, or set them in your
host's project settings):

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Yes | Client ID of the app's SPA client credentials from the Cloud Portal. If missing, the Website column shows "Sign-in is not configured" and `/api/fetch-page` returns 500. Inlined at build time. |
| `NEXT_PUBLIC_SITECORE_APP_ID` | Yes | Marketplace app ID; sent as `product_codes=mkp_<id>` at sign-in. Inlined at build time. |
| `RATE_LIMIT_PER_SECOND` | No | Requests per second for GraphQL queries and page fetches. Default `30`. Server-side; served to the browser by `/api/config`. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`). Leave empty to disable analytics. Inlined at build time. |
| `NEXT_PUBLIC_AUTH0_DOMAIN` | No | Default `auth.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_AUDIENCE` | No | Default `https://api-webapp.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_SCOPE` | No | Default `openid profile email offline_access`. |
| `AUTH0_ISSUER` | No | Server-only. Token issuer; defaults to `https://<NEXT_PUBLIC_AUTH0_DOMAIN>/`. |

There are no server-side secrets. All `NEXT_PUBLIC_*` values are public
identifiers; change them, then rebuild.

The app only runs inside SitecoreAI: the Marketplace SDK needs the host
iframe, so opening the deployment URL directly in a browser shows a
connection error. For local development, run `npm run dev` (port 5000),
expose it over HTTPS (for example with ngrok), and register that URL in a
separate development app in App Studio, including its callback and origin
URLs.

## Configuration

The column headers hold the in-app settings. Everything is stored in the
browser's `localStorage`, keyed by app and installation, and nothing is
written to the Sitecore content tree.

- **Language** (Authoring header) — default `en`.
- **Tree root** (search icon in the Authoring header) — an item path starting
  with `/` or a GUID. The clear button returns to `/sitecore/content`. Not
  persisted.
- **Website Settings** (gear icon in the Website header):
  - Source for the `__Updated` comparison: **Meta Tag** (default) or
    **HTTP Header**, and its name (default `Last-Modified`).
  - Redirect handling: follow redirects for the homepage (default on) and for
    other pages (default off), up to 5 hops.
  - Trailing slash: leave as is (default), always add, or always remove.
    URLs with a file extension are left unchanged.
- **Refresh** (Website header) — re-fetches all pages with the current
  settings.

The rate limit is set by `RATE_LIMIT_PER_SECOND` on the server; see
[RATE_LIMITING.md](RATE_LIMITING.md).

## Security and privacy

- **Sitecore access:** all Authoring and Experience Edge queries go through
  the Marketplace SDK and run with the signed-in user's own SitecoreAI
  permissions. The app stores no Sitecore credentials.
- **Sign-in on the API:** `/api/fetch-page` requires a Sitecore Cloud access
  token. The server verifies its signature (RS256, issuer's JWKS), issuer,
  audience, expiry and that it was issued to this app's client ID (`azp`).
  `/api/config` is unauthenticated and returns only the rate limit number.
- **Secrets:** none. Auth0 access and refresh tokens are kept in the
  browser's `localStorage` (third-party cookies are blocked in the
  Marketplace iframe), together with the current organization ID so a switch
  forces a new sign-in.
- **What leaves the browser:**
  - Sitecore queries go to your SitecoreAI environment through the host.
  - Page URLs from the Live endpoint are sent to the app's own server, which
    requests those pages from your website with the user agent
    `Mozilla/5.0 (compatible; SitecoreChecker/1.0)`. Only the status code and
    the timestamp value are returned; nothing is stored.
  - If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, Google Analytics receives page
    views and a `marketplace_client_ready` event tagged with the app name. No
    content data is sent.
- **SSRF protection on `/api/fetch-page`:** only `http`/`https` on ports 80
  and 443, no credentials in the URL, and the host must resolve only to public
  addresses (private, loopback, link-local, CGNAT, multicast and reserved
  ranges are blocked). Redirects are followed manually and every hop is
  re-checked. Requests time out after 15 seconds and at most 2 MB of the body
  is read.

See [PRIVACY.md](PRIVACY.md) for the privacy policy.

## Limitations

- Only the first 100 sites returned by `site.allSiteInfo` are used for the
  Website column.
- The Website column only checks items that have presentation, are under a
  site root and have a URL in the Live endpoint; items not published to Live
  are greyed out there.
- The timestamp comparison needs the rendering host to output the raw
  `__Updated` value; formatted or converted dates never match.
- Pages behind IP allowlists, basic auth, deployment protection or on
  non-standard ports can't be fetched by the server.
- The Preview and Live columns follow the authoring tree: only items you have
  expanded are queried.
- The app uses the first environment in `application.context`
  (`resourceAccess[0]`).
- The server-side rate limiter is per server instance and shared by all
  users of that instance.

## Development

- Next.js 16 (App Router), React 19, TypeScript, plain CSS with design tokens
  in `src/app/globals.css`, Material Design Icons (`@mdi/js`).
- Sitecore Marketplace SDK 0.2 (`client` and `xmc` modules).
- `@auth0/auth0-react` and `jose` for the custom-authorization kit.
- Dev server: `npm run dev` on port 5000.

Project structure:

```
src/app/          Page, layout and API routes (/api/config, /api/fetch-page)
src/components/   Tree columns, item detail modals, analytics
src/lib/          marketplace-auth kit (sign-in and token verification)
src/utils/        Marketplace client hook, rate limiter, SSRF guard
public/           App icon
```

Further reading:

- [RATE_LIMITING.md](RATE_LIMITING.md) — how the rate limiter works
- [src/lib/marketplace-auth/README.md](src/lib/marketplace-auth/README.md) —
  the custom-authorization kit and Cloud Portal setup
- [PRIVACY.md](PRIVACY.md) — privacy policy

## Support

Report bugs and request features by opening an issue in this repository.
This is a community app and is not an official Sitecore product.

## License

Licensed under the Apache License 2.0 — see [LICENSE](LICENSE).
