# Cloudflare migration — prepared 19 November 2026

## Current state

The replacement code is prepared locally, but a Cloudflare test deployment is live and the authoritative nameservers have not changed. The Netlify project remains the live host and rollback copy. GitHub is connected; `dikshitkashyap/dkd-portfolio` contains a different version of the portfolio and must not be overwritten without reconciling it. Use a migration branch or separate repository.

39 automated checks pass. The Worker bundle compiles with esbuild and the full Wrangler dry-run succeeds. The local Cloudflare runtime serves the homepage, all three case studies, the resume and the live Medium RSS proxy. The stats endpoint correctly returns unavailable until private data is migrated. Cloudflare account sign-in and publishing OAuth are verified. Cloudflare's official skills are installed at ~/.agents/skills/ and its Codex MCP connection is registered and authorized. The current Cloudflare deployment is `b3cdd806-4f91-48eb-ae9e-8ad61afe90f8`, at https://dikshit-portfolio.dkashyap450.workers.dev . Remote pages, resume, theme/printer scripts match local hashes. Video range delivery and the Medium RSS proxy pass. The browser printer intro successfully reveals the light homepage. The COROS connection and public summary have been imported privately, with the import route disabled again. Its imported summary was updated 2026-11-19T02:01:04.415Z. The new daily updater stays disabled until coordinated handover; Netlify remains the active updater.

## Replacement architecture

- Cloudflare Worker with Static Assets serves the existing `dist/` without a visual rewrite. Static assets bypass Worker code by default. Only `/api/*`, `/medium-feed.xml`, and the five audio/video files run Worker-first. Media requests implement byte ranges because Static Assets does not natively provide them; normal pages, images and styles still bypass Worker code.
- The fixed Medium RSS proxy replaces Netlify's external 200 rewrite. The old `_redirects` stays for rollback but is excluded from the clean `.cloudflare-assets/` build. Ignoring the file alone does not prevent Cloudflare from parsing it.
- A single SQLite-backed Durable Object stores the private COROS connection and public running summary. OAuth state claims and collection leases use transactions. Private owner actions require `COROS_OWNER_KEY`.
- The daily 02:00 UTC trigger (07:30 India time) queues a durable alarm. Failed updates preserve the last successful summary. Public output remains limited to total kilometres, last-run date/distance and summary freshness/coverage metadata.
- `SYNC_ENABLED` and `MIGRATION_ENABLED` are initially false. Staging cannot automatically refresh or import credentials. No secrets belong in GitHub or `dist/`.

## Local commands

`npm ci`

`npm test`

`npm run check:cloudflare`

`npm run preview:cloudflare`

For local owner-only testing, a gitignored `.dev.vars` can contain a throwaway `COROS_OWNER_KEY` of at least 32 characters. Never use real credentials in fixtures.

## Deployment and cutover order

1. Complete Cloudflare sign-in and authorize its publishing tool. Use Workers Free and SQLite-backed Durable Objects; do not enable paid services.
2. Audit the repository payload. Include `dist/`, `cloudflare/`, `server/coros-core.mjs`, tests and package/configuration files. Exclude `.netlify/`, `.wrangler/`, `.env*`, `.dev.vars*`, drafts, source documents, deployment archives and account configuration. Existing Netlify source can remain locally for rollback.
3. Run the full Cloudflare dry-run and local runtime preview. Verify all three case-study routes, resume, media range requests, printer first-load behavior, light default, race pictures, book, feed and API privacy boundary.
4. Deploy to a temporary workers.dev address with the schedule disabled. Privately configure the owner key. Check real RSS requests, assets, bindings and response behavior before touching DNS.
5. Coordinate the COROS credential handover: atomically stop the old collector before the new host refreshes the same token. Export only the registered client, credentials and public summary from Netlify Blobs using authenticated tools, keeping the payload in memory or secure transport. Do not print or commit it. The owner-authenticated `/api/coros/migrate` route accepts one import only and is disabled unless explicitly enabled. Disable it again immediately after successful import. The production callback remains `https://www.kidshit.space/api/coros/callback`.
6. Trigger a private refresh on Cloudflare and verify the real summary and owner-only status. The unit tests do not substitute for this live provider check. If client/token migration is not accepted by COROS, reconnect at the new host instead.
7. Move DNS off Netlify. The observed authoritative servers were `dns1.p01.nsone.net` through `dns4.p01.nsone.net`. Export and reproduce the full existing DNS zone before changing nameservers at the registrar. Do not infer an empty zone from individual lookup failures. Preserve mail and verification records. Workers custom domains require a Cloudflare-managed zone.
8. Attach both `www.kidshit.space` and the apex. Configure the apex to redirect to `https://www.kidshit.space` while preserving path/query. Verify TLS, both hostnames, case studies, Medium and COROS through the final domain.
9. Set `SYNC_ENABLED` to true in the committed deployment configuration; keep `MIGRATION_ENABLED` false. Verify the daily trigger. Disable the old Netlify schedule/site only after the replacement is healthy. Do not delete the Netlify project or revoke authorization prematurely.
10. Update hosting/deployment records with the actual account, repository, deployment URL, timestamp and checks. Do not mark the migration complete until requests and background updates are independent of Netlify.

## Operations after migration

`npm run deploy:cloudflare` runs the checks before publishing, but must only be invoked when the user asks to publish. Ordinary edits stay local. The final active configuration must retain the daily trigger and `SYNC_ENABLED: "true"`.

Useful owner routes (Bearer key required): `GET /api/coros/status`, `POST /api/coros/sync`. No route returns private tokens. Regular visitors use `GET /api/running-summary?year=2026`.

References: https://developers.cloudflare.com/workers/static-assets/ , https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/durable-objects/api/alarms/

## Domain activation prepared

The Free zone for kidshit.space is created with the existing records preserved. Assigned nameservers: `adaline.ns.cloudflare.com` and `hank.ns.cloudflare.com`. Do not mark it active until its nameservers actually change. The existing Netlify zone was backed up in the gitignored `.migration-private/` directory and contains two managed website records; the scan produced four equivalent A records. The registrar is not yet known. Custom Domains require an active zone, so attach www and configure apex redirection after activation, then verify independence from Netlify. No registrar or authoritative nameserver changes have been made.
