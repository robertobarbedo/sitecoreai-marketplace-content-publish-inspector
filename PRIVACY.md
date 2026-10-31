# Privacy Policy

**Last updated: 2026-10-31**

## Overview

This policy explains what data the Content Publish Inspector ("the app")
handles, where it goes, what is stored, and how you can exercise your
rights. It applies to the hosted app listed in the Sitecore Marketplace.

## Summary

- The app has no database and stores no Sitecore content, item data, page
  content or credentials on its servers.
- The app uses no analytics, tracking or advertising services.
- The only data kept on the server side are short audit and runtime log
  lines (who called the API, the outcome, and for website checks the host
  name and HTTP status), retained for 90 days.
- Data leaves your browser only in the ways listed under
  [Where data goes](#where-data-goes).

## How the app works

The app runs inside SitecoreAI. It reads your content through the Sitecore
Marketplace SDK, which queries your environment with your own SitecoreAI
permissions:

- Sitecore Authoring and Management GraphQL API
- Experience Edge Delivery GraphQL API (Preview and Live)

The results are processed in your browser and are not sent to the app's
servers. The one exception is the page URLs used by the Website check,
described below.

## What data the app handles

- **Sitecore content and metadata** (item names, paths, IDs, fields,
  workflow state, versions, site names and page URLs): read from your
  environment and shown in your browser only.
- **Page URLs** of your website (Website check): sent to the app's server
  so it can request the page.
- **Account identifiers**: your Sitecore Cloud user ID (the token's `sub`)
  and organization ID, taken from the access token when you use the Website
  check.
- **Sign-in tokens**: your Sitecore Cloud access and refresh tokens, kept in
  your browser.
- **Preferences**: selected language and Website check settings, kept in
  your browser.

## Where data goes

1. **Sitecore.** Authoring and Experience Edge queries, made through the
   Marketplace SDK, and sign-in requests to Sitecore Cloud (see
   [Sign-in](#sign-in)).
2. **The app's own server (Website check).** To check whether a page is live,
   the browser sends the page URL to the app's `/api/fetch-page` route in
   the body of a POST request (not in the address, so it does not appear in
   request logs), together with your Sitecore Cloud access token, which
   proves you are signed in. The server requests that URL from your website,
   so your website sees the request coming from the app's server. It returns
   only the HTTP status, the value of the header or meta tag configured in
   the Website check settings (`Last-Modified` by default), or an error
   message. It does not store the token or the page content, and it logs
   only the host name of the URL, never its path or query.
3. **The app's server (configuration).** The browser loads the rate limit
   setting from `/api/config`. This request carries no user data.

The app does not sell or share data with anyone else.

## What is stored and where

| Data | Where | Retention |
| --- | --- | --- |
| Audit log lines: time (UTC), API path, event (`auth`, `website.fetch`), outcome, Sitecore user ID, organization ID, denial reason, and for website checks the target host name and HTTP status | The publisher's server logs (Vercel runtime logs and the publisher's log store) | 90 days |
| Standard request metadata recorded by the hosting provider (IP address, time, path, user agent) | Vercel | 90 days at most |
| Sign-in tokens and current organization ID | Your browser's `localStorage` | Until you sign out, the session expires, or you clear site data |
| Preferences (language, Website check settings) | Your browser's `localStorage` | Until you clear site data |

Log lines never contain tokens, secrets, Sitecore content, page content or
full page URLs. Nothing is written to your Sitecore content tree.

## Who can access it

- **Server logs:** only the app's maintainer, for operating, securing and
  troubleshooting the app, and the hosting provider as a sub-processor.
- **Browser storage:** only you, on your own device.
- **Sitecore data:** governed by your SitecoreAI permissions and your
  agreement with Sitecore; the app does not keep a copy.

## How data is protected

- All traffic uses HTTPS (TLS 1.2 or later) with HSTS.
- The API verifies every Sitecore Cloud access token (signature, issuer,
  audience, expiry and that it was issued to this app) before acting.
- The Website check only fetches public `http`/`https` addresses on ports 80
  and 443; private and internal networks are blocked.
- Security headers restrict which sites may embed the app.
- Logs are stored with the hosting provider's encryption at rest.

## Sign-in

The Website check requires you to sign in with your Sitecore Cloud account
(Sitecore's Auth0 tenant at `auth.sitecorecloud.io`). The sign-in is handled
by Sitecore. The app only receives the resulting access and refresh
tokens; the browser sends the refresh token back to Sitecore's sign-in
service to renew your session.

## Local storage

The app uses your browser's local storage for:

- UI preferences (selected language, Website check settings)
- Sign-in tokens (access and refresh tokens) and the current organization ID,
  so you stay signed in. The organization ID is kept so that switching
  organization forces a new sign-in.

This data stays on your device. The access token is sent only to the app's
own server, as described above, and the refresh token only to Sitecore's
sign-in service. You can clear all of it by clearing your browser data for
the app.

## Sub-processors and third parties

- **Vercel Inc.** (hosting). Serverless functions run in the United States
  (region `iad1`, Washington, D.C.) unless a deployment sets another region.
  See https://vercel.com/legal/privacy-policy.
- **Sitecore** (sign-in and the SitecoreAI APIs), under your own agreement
  with Sitecore.
- **Your website**, which receives the page requests made by the Website
  check from the app's server.

No analytics, tracking or advertising services are used.

## Your rights

Depending on where you live (for example under the GDPR or CCPA), you may
have the right to access, correct, delete, restrict or object to the
processing of your personal data, and to receive a copy of it.

To make a request, email rb205@proton.me with the subject "Data request".
Include your Sitecore Cloud organization ID and, if you know it, your user
ID, so we can find the matching log lines. We answer within 30 days. The
only personal data the publisher holds is in the server logs described
above. You can also complain to your local data protection authority.

## Deletion

- **Server logs** are deleted automatically after 90 days. On a verified
  request we delete matching log lines sooner where the log store allows it.
- **Browser data** is deleted when you sign out or clear site data for the
  app.
- The app stores nothing in your Sitecore environment, so uninstalling the
  app leaves nothing behind there.

## Changes to this policy

We may update this policy from time to time. Changes are published in this
file and reflected in the "Last updated" date at the top.

## Contact

Questions about this policy: email rb205@proton.me or open an issue at
https://github.com/robertobarbedo/sitecoreai-marketplace-content-publish-inspector/issues.
