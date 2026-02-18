# SEO Operations Runbook

This runbook covers Search Console setup, sitemap submission, and recurring SEO checks for `https://thefairmate.com`.

## 1) One-time setup

- Verify ownership in Google Search Console for `https://thefairmate.com`.
- Add `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in environment variables with your Search Console token.
- Deploy and confirm verification meta tag is present in page source.
- Submit `https://thefairmate.com/sitemap.xml` in Search Console.

## 2) Indexing checks (weekly)

- Confirm `https://thefairmate.com/robots.txt` is reachable and references sitemap.
- Confirm `https://thefairmate.com/sitemap.xml` lists only public pages:
  - `/`
  - `/how-it-works`
  - `/fair-play`
  - `/ranking`
  - `/support`
  - `/terms`
  - `/privacy`
- Validate private routes are excluded from sitemap and noindexed:
  - `/account/*`, `/game/*`, `/play`, `/admin/*`, auth flows.

## 3) Performance and CTR loop (weekly)

- In Search Console, review:
  - Top queries and top pages.
  - CTR outliers (high impressions, low CTR).
  - Coverage/indexing issues.
- Update titles/descriptions on underperforming pages while preserving intent terms.

## 4) Content optimization loop (monthly)

- Refresh homepage, ranking, and support copy using product-specific intent terms:
  - `play chess for USDC`
  - `USDC chess platform`
  - `1v1 chess with stakes`
  - branded `FairMate` queries
- Add internal links where appropriate between:
  - `/how-it-works`
  - `/fair-play`
  - `/ranking`
  - `/support`

## 5) Rich result validation

- Validate structured data for:
  - `Organization` and `WebSite` (layout-level JSON-LD)
  - `FAQPage` (support page)
- Use:
  - Google Rich Results Test
  - Schema Markup Validator
