# Privacy Policy

**Last Updated: October 24, 2026**

## Overview

This policy explains what data the Content Publish Inspector handles, where
it goes, and what is stored.

## Summary

- The app has no database and stores no Sitecore content, item data or
  credentials on its servers.
- Analytics (Google Analytics) are usage metrics only and contain no
  content data.
- Data leaves your browser only in the ways listed under
  [Where data goes](#where-data-goes).

## How the Application Works

The app runs inside SitecoreAI. It reads your content through the Sitecore
Marketplace SDK, which queries your environment with your own SitecoreAI
permissions:

- Sitecore Authoring GraphQL API
- Experience Edge Delivery GraphQL API (Preview and Live)

The results are processed in your browser and are not sent to the app's
servers. The one exception is the page URLs used by the Website check,
described below.

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
   message. It does not store or log the URL, the token, or the page
   content.
3. **Google Analytics**, when the deployment has a measurement ID configured.
   It receives page views and a `marketplace_client_ready` event tagged with
   the app name, plus the standard technical information Google Analytics
   collects (browser type, approximate location derived from IP, device
   category, and the address of the app's own page). No Sitecore content,
   item data, URLs of your website pages or credentials are sent to
   analytics.

The app does not share data with anyone else.

## Sign-in

The Website check requires you to sign in with your Sitecore Cloud account
(Sitecore's Auth0 tenant at `auth.sitecorecloud.io`). The sign-in is handled
by Sitecore. The app only receives the resulting access and refresh
tokens; the browser sends the refresh token back to Sitecore's sign-in
service to renew your session.

## Local Storage

The app uses your browser's local storage for:

- UI preferences (selected language, Website check settings)
- Sign-in tokens (access and refresh tokens) and the current organization ID,
  so you stay signed in. The organization ID is kept so that switching
  organization forces a new sign-in.

This data stays on your device. The access token is sent only to the app's
own server, as described above, and the refresh token only to Sitecore's
sign-in service. You can clear all of it by clearing your
browser data for the app.

## Third-Party Services

- **Sitecore Cloud** (sign-in and the SitecoreAI APIs).
- **Google Analytics**, for usage measurement. It may set cookies in
  the app's iframe. See https://policies.google.com/privacy for how Google
  processes this data.

No other analytics, tracking or advertising services are used.

## Changes to This Policy

We may update this policy from time to time. Changes are reflected in the
"Last Updated" date at the top of this document.

## Contact

If you have questions about this policy, open an issue in the project
repository.

## Your Rights

Apart from the usage metrics described above, which Google Analytics
processes under its own policy, the app collects and keeps no data, so there
is no personal information held by the app to request, modify or delete. You
control everything stored in your browser.
