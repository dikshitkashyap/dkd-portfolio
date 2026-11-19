# Dikshit Kashyap Das — portfolio

Live at https://www.kidshit.space/ , hosted entirely on Cloudflare. The main portfolio, Medium feed, audio/video and private daily COROS updater are independent of Netlify. Source for this release is on the cloudflare-migration branch; the original main branch is preserved.

Run `npm ci`, then `npm run preview:cloudflare`. Check packaging with `npm run check:cloudflare`. Publish only when explicitly requested using `npm run deploy:cloudflare`; this deploys the main site and apex redirect.

Public assets live in `dist/`. Hosting and updater code is in `cloudflare/`, with provider parsing in `server/coros-core.mjs`. `netlify/` is retained for rollback. Private local settings and credentials are excluded from source control.

See CLOUDFLARE-MIGRATION.md for verified state, operations and rollback notes. 42 automated checks and the live-domain checks passed.
