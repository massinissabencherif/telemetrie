# Observability Report Generator — Design

## Purpose

Sujet.md §5.3 requires a delivered "rapport d'observabilité" containing: (1) Umami screenshots showing the completed purchase funnel, (2) an analysis of the observed bounce rate and conversion rate, and (3) a GlitchTip screenshot of the simulated payment error's stack trace with an explanation of how a developer would diagnose it. Today this is filled in by hand: log into two dashboards, take screenshots, read numbers off the UI, paste them into `docs/rapport-observabilite.md`. This is repetitive every time new demo traffic is generated (which the project already encourages via `scripts/demo-traffic`).

This feature adds one CLI command that reproduces that manual work: log into Umami and GlitchTip, capture the four screenshots the template already references, pull the real metrics from Umami's API, and render a ready-to-submit `docs/rapport-observabilite.pdf`.

## Non-Goals

- No web UI / clickable button in a browser — this is a CLI script, consistent with `scripts/demo-traffic`.
- No automatic generation of the *interpretive* analysis text (why a step drops off, how to fix the bug). The assignment asks for the student's own analysis; the script supplies accurate numbers and flags the highest-drop-off step, but the prose stays hand-written in `docs/rapport-observabilite.md`.
- No automated extraction of GlitchTip's median load time — see "Risks / Open Questions."
- Not a general-purpose reporting tool — hardcoded to this project's two dashboards, one project, one website.

## Architecture

```
scripts/generate-report/
├── package.json                (playwright, marked)
├── generate-report.mjs         (orchestrator / CLI entrypoint)
└── lib/
    ├── umami-data.mjs          (Umami REST API client + pure aggregation functions)
    ├── umami-capture.mjs       (Playwright: log into Umami UI, take 2 screenshots)
    ├── glitchtip-capture.mjs   (Playwright: log into GlitchTip UI, take 2 screenshots)
    └── render-pdf.mjs          (fill template placeholders, render markdown -> HTML -> PDF)
└── tests/
    └── umami-data.test.mjs     (Vitest, plain JS — no TypeScript in this script package)
```

`docs/rapport-observabilite.md` remains the template and source of truth for wording and structure (already exists, committed). The script reads it, replaces the numeric `___` placeholders with real values and the `![...](screenshots/...)` paths with freshly captured images (same filenames already wired up: `01-tunnel-umami.png`, `02-metriques-umami.png`, `03-erreur-glitchtip.png`, `04-performance-glitchtip.png`), and writes `docs/rapport-observabilite.pdf`. Hand-written analysis prose already present in the `.md` is preserved verbatim — the script only touches the specific placeholder tokens, never rewrites paragraphs.

## Data Flow

1. **Load config** from `.env` via Node's built-in `--env-file` flag (no new `dotenv` dependency): `NUXT_PUBLIC_UMAMI_HOST`, `NUXT_PUBLIC_UMAMI_WEBSITE_ID` (both already present), plus four new variables — `UMAMI_ADMIN_USERNAME`, `UMAMI_ADMIN_PASSWORD` (Umami currently has no credentials stored in `.env` at all; the project's README instructs changing the default `admin`/`umami` password by hand, but nothing captures the result — this is a real gap the implementation plan must close, not an assumption), `GLITCHTIP_EMAIL`, `GLITCHTIP_PASSWORD`.
2. **Fetch Umami numbers** (`umami-data.mjs`):
   - `POST /api/auth/login` → bearer token.
   - `GET /api/websites/{id}/stats?startAt&endAt` → visits, bounces, pageviews, totaltime.
   - `GET /api/websites/{id}/metrics?type=event&startAt&endAt` → counts per named event (`view_product`, `add_to_cart`, `checkout_start`, `checkout_success`).
   - Raw `checkout_success` event records (endpoint TBD at implementation time, see Risks) → aggregate average `value` (panier moyen) and `utm_source` distribution in JS, not relying on a specific pre-built Umami aggregation endpoint.
   - Pure functions compute: bounce rate %, conversion rate % (`checkout_success / visits`), per-step drop-off %, and which step has the largest drop — all covered by unit tests.
   - Default time window: last 7 days (covers everything generated in one working session), overridable via a CLI arg the same way `demo-traffic` takes a journey count.
3. **Capture Umami screenshots** (`umami-capture.mjs`, Playwright): log in through the actual login form (not just API — screenshots need the rendered UI), navigate to the site's Funnel/Events report, screenshot the funnel region → `01-tunnel-umami.png`; navigate to the overview page, screenshot the metrics card region → `02-metriques-umami.png`.
4. **Capture GlitchTip screenshots** (`glitchtip-capture.mjs`, Playwright): log in with `GLITCHTIP_EMAIL`/`GLITCHTIP_PASSWORD`, open Issues, find the payment error by searching for a keyword from its known message (e.g. "gateway de paiement") rather than assuming it's the first/only issue, open it, screenshot the stack trace + client-info sidebar → `03-erreur-glitchtip.png`; navigate to Performance, filter to `/checkout` and `/checkout/success` transactions, screenshot the table → `04-performance-glitchtip.png`.
5. **Render** (`render-pdf.mjs`): read `docs/rapport-observabilite.md`, substitute placeholders with the computed numbers and the new screenshot paths, parse the result with `marked` into HTML (simple, self-contained stylesheet for print), and use a Playwright page's `page.pdf()` to produce `docs/rapport-observabilite.pdf`. Reuses Playwright (already a dependency here and in `demo-traffic`) instead of adding Pandoc or another system-level converter.

## Error Handling

Each capture/fetch step is independently try/caught in the orchestrator. If one step fails (element not found, no `checkout_success` events yet, GlitchTip issue not found), it logs a clear message naming which section is affected and continues with the rest — it does not abort the whole run. The corresponding placeholder in the rendered output is left as the template's original `___` / broken-image marker rather than a fabricated value, so a partial run is still visibly identifiable as partial (no silent wrong numbers).

## Testing

The Playwright login/capture flows and the live API calls are integration-level and not meaningfully unit-testable (they depend on the running Docker stack and real accounts) — verified by running the script against the live stack, same as `demo-traffic` was.

The pure computation functions in `umami-data.mjs` (bounce rate, conversion rate, per-step drop-off, highest-drop-off step, average cart value / utm breakdown from a list of raw event records) are ordinary JS taking plain data in and returning plain data out — these get unit tests (Vitest, matching the main app's convention for `payment.ts`/`utm.ts`), covering at minimum: normal case, zero-visits (no division-by-zero), and empty event list.

## Risks / Open Questions

- **Exact Umami endpoint for per-event property data** (needed for average cart value and `utm_source` breakdown) hasn't been confirmed live — `/api/websites/{id}/events` returns event summaries but its exact shape for custom `data` properties wasn't checked with real `checkout_success` records during this session's debugging (only tested when the count was 0). First implementation step for `umami-data.mjs` is a one-off live probe against a real `checkout_success` event to confirm the field, before writing the aggregation logic. Fallback if the API doesn't expose it cleanly: scrape the value from Umami's own Events-tab UI via Playwright (the UI shows per-event property breakdowns), same technique already used for the screenshots.
- **GlitchTip median load time** is deliberately left manual (read from the Performance screenshot) rather than scraped, because GlitchTip's performance UI is more complex to parse reliably than Umami's REST API and the assignment only requires a screenshot here, not a computed number.
- **GlitchTip login selectors**: not yet inspected live (this session only used API login for GlitchTip diagnostics, not the UI form) — first implementation step for `glitchtip-capture.mjs` is confirming the actual login form field names/selectors against the running instance.
