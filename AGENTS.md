# Portfolio publishing policy

Keep ordinary edits local. Publish only when the user explicitly asks to publish or push changes.

The user authorized migration from Netlify to Cloudflare on 19 November 2026. Cloudflare is now the production host for www.kidshit.space, including Medium and the daily private COROS updater. Do not deploy to Netlify unless the user explicitly requests rollback.

Canonical Git checkout: /Users/dikshit/Documents/Codex/2026-10-04/te/outputs/portfolio-github-migration, branch cloudflare-migration. Use that checkout for future work and commits. The earlier portfolio folder is retained as the migration working copy.

When publishing is requested, run npm run deploy:cloudflare. This runs tests, prepares public assets, and publishes the main portfolio and apex redirect. Keep SYNC_ENABLED true and MIGRATION_ENABLED false. Never commit .migration-private, .netlify, .wrangler, .env or .dev.vars files. Existing Netlify source and deployment history are retained for rollback, not as live dependencies.
