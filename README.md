# Dikshit Kashyap Das — Cloudflare portfolio migration

This branch preserves the existing main branch and adds the current portfolio source for Cloudflare hosting.

- `dist/`: public portfolio, case studies, resume and media.
- `cloudflare/`: hosting routes, media compatibility and private COROS updater.
- `server/coros-core.mjs`: shared COROS parsing and collection logic.
- `netlify/`: previous-host functions retained for rollback.
- `tests/`: privacy, authentication, media and interaction checks.

Run `npm ci`, then `npm run preview:cloudflare`. Run `npm run check:cloudflare` to check packaging. Publishing is manual and must be explicitly requested: `npm run deploy:cloudflare`.

The temporary Cloudflare site is https://dikshit-portfolio.dkashyap450.workers.dev . Domain cutover and updater handover remain pending. See CLOUDFLARE-MIGRATION.md for verified state and remaining steps.

Private settings, provider credentials, local account data and source documents are excluded from version control. Never commit `.env`, `.dev.vars`, `.netlify`, `.wrangler` or `.migration-private`.
