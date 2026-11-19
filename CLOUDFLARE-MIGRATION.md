# Cloudflare portfolio — production hosting

Verified on 19 November 2026. Production: https://www.kidshit.space/ . The apex https://kidshit.space/ redirects to www and preserves paths and query strings.

## Current architecture

- `dikshit-portfolio`: current portfolio Static Assets, the Medium RSS proxy and the private COROS updater.
- `dikshit-portfolio-apex`: a small permanent redirect to www.
- Both use Cloudflare routes on zone `41a4c5fcd8343e88a803f71cd1a58ab1`. The direct Custom Domain API rejected the imported DNS records, so routes provide the same fully independent hosting. Proxied A records use reserved placeholders 192.0.2.1 and 192.0.2.2; they are not real servers. No Netlify origin addresses remain. Every request is handled by a Worker or its bundled assets; no handler forwards requests to those placeholder addresses.
- Static pages, images, fonts and styles bypass Worker code. API/feed requests and the five audio/video assets run Worker-first. The media handler supplies byte ranges needed for browser seeking and Safari playback.
- A single SQLite-backed Durable Object privately stores COROS authorization and summaries. OAuth state claims and sync leases are transactional. Only allowlisted total kilometres, latest-run distance/date and freshness/coverage metadata are public.
- Daily refresh: 02:00 UTC / 07:30 India time. `SYNC_ENABLED` is true. A fresh provider query completed at 2026-11-19T10:21:02.845Z. The one-time credential import is complete and `MIGRATION_ENABLED` is false.
- The old Netlify collector is paused by a compare-and-set migration lease. Netlify remains a rollback copy; the production site, DNS, Medium feed and COROS connection do not depend on it. Its legacy scheduled entry may still invoke and exit/fail, so disabling that old schedule/project is optional cleanup rather than a production dependency.

## Verification

42 automated tests passed. Live homepage, three case studies, resume, theme/printer scripts and book manifest match local hashes. All five media files return correct partial bytes. Medium RSS loads, the owner endpoint rejects unauthenticated access, the apex HTTPS redirect preserves paths/query strings, and the real domain displays the current running summary. The printer introduction was exercised in the browser on the Cloudflare preview. The live-domain homepage was verified in the browser after DNS stopped pointing to Netlify.

## Code and publishing

Canonical Git checkout: `/Users/dikshit/Documents/Codex/2026-10-04/te/outputs/portfolio-github-migration`.

Repository branch: https://github.com/dikshitkashyap/dkd-portfolio/tree/cloudflare-migration . The original main branch is preserved. Publishing stays manual; ordinary changes must remain local until the user asks to publish.

`npm ci`

`npm run preview:cloudflare`

`npm run check:cloudflare`

`npm run deploy:cloudflare`

The last command runs tests, prepares the asset directory and deploys both Workers. Keep the schedule enabled in committed configuration. Do not re-enable the migration import.

`dist/` remains the public source. The clean `.cloudflare-assets/` build omits the old Netlify `_redirects` proxy rule; ignoring that file alone does not stop Cloudflare's parser from reading it. The Worker now owns `/medium-feed.xml`.

## Private settings and rollback

No credentials are stored in the public source or GitHub. Local migration keys and the original DNS export are in the gitignored, protected `.migration-private/` directory in the original migration working copy. They are not part of the canonical checkout or deployment assets. The provider client and tokens were transferred in memory over HTTPS, not through an exported credential file.

Registrar: Hostinger. Current authoritative nameservers: `adaline.ns.cloudflare.com` and `hank.ns.cloudflare.com`. Original Netlify nameservers were dns1.p01.nsone.net through dns4.p01.nsone.net. The old managed website zone was backed up before changes. Hostinger had no DNSSEC records configured; security settings were not disabled.

If rollback is explicitly requested, coordinate credentials and collector leases before re-enabling the old updater. Worker code rollback does not roll back Durable Object data. Do not remove the Cloudflare routes while DNS points at the reserved placeholders: there is deliberately no external origin behind them.

## Codex setup

Cloudflare's official agent setup was completed: 22 skills installed in ~/.agents/skills/, the official MCP server registered in ~/.codex/config.toml and OAuth authorized. Restart Codex to load the newly registered connection. Wrangler publishing authorization was independently verified. The optional cf CLI was not installed because this existing project uses Wrangler.

References: https://developers.cloudflare.com/agent-setup/prompt.md , https://developers.cloudflare.com/workers/static-assets/ , https://developers.cloudflare.com/workers/configuration/routing/routes/ , https://developers.cloudflare.com/workers/runtime-apis/request/
