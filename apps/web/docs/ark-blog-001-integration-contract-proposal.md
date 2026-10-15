# ARK-BLOG-001 — Integration Contract Proposal

> **Obsoleto en lo referido a CMS (2026-10-14):** el proyecto migra de Hygraph a Storyblok. Las suposiciones de Hygraph de este documento ya no aplican. Ver [ark-blog-001-v2-cms-migration-decision.md](ark-blog-001-v2-cms-migration-decision.md).

## Status and intent

This proposal is grounded in the implementation inspected for ARK-BLOG-001. It does not authorize application, CMS, deployment, or schema changes. Existing capabilities named below must be reused rather than recreated.

## Logical boundaries

| Boundary | Current responsibility | Existing locations |
| --- | --- | --- |
| Shared | shell, navigation, i18n, design tokens, SEO, CMS transport, publication safety | `src/layouts/`, `src/components/layout/`, `src/i18n/`, `src/styles/`, `src/lib/seo/`, `src/lib/hygraph/`, `src/lib/cms-source.ts` |
| Corporate | home, service catalog/offering routes, case studies, corporate CTA | `src/pages/[locale]/index.astro`, `src/pages/[locale]/solutions/`, `src/pages/[locale]/case-studies/`, `src/lib/catalog/`, `src/lib/case-studies/` |
| Insights | listing, article pages, article presentation, normalization and feed input | `src/pages/[locale]/insights/`, `src/components/insights/`, `src/lib/insights/`, `src/lib/hygraph/queries/articles.ts` |

Insights remains inside the public website. It must not introduce a second router, CSS system, deployment, service catalog, CMS client, or SEO system.

## Required data flow

```text
Hygraph Content API (PUBLISHED) → server/build-only client → query-specific raw data
→ Insights normalizer/publication gate → Astro static paths/pages → HTML + sitemap + RSS
```

Use `hygraphRequest()` in `src/lib/hygraph/client.ts`; do not fetch CMS data in browser scripts. Keep lightweight list/feed queries separate from detail Rich Text queries. Data from Hygraph is untrusted: preserve slug validation, HTTPS URL checks, Rich Text allow-list rendering, publication checks, and build failure on corrupt/incomplete public content.

## Route and localization contract

- Reuse `locales`, `defaultLocale`, `getLocalizedPath`, and `getAlternateLocalePath` from `src/i18n/`.
- Keep explicit locale prefixes and trailing slashes.
- Listing: `/{locale}/insights/`; detail: `/{locale}/insights/{localized-slug}/`.
- Do not create a missing-language article by falling back to English.
- Pass the real, published `localePaths` to `PageLayout` for article alternates and language switching.
- Preserve `/` → `/en/` hosting redirect requirement; no duplicate root home.

## Reusable UI and SEO contract

- Reuse `PageLayout`, `BaseLayout`, `InsightCard`, `InsightHero`, `ArticleContent`, `ArticleAuthor`, `RelatedInsights`, `RelatedServices`, `SectionHeading`, and `Button`.
- Use `BaseLayout` props for title, description, canonical, Open Graph image/type, RSS link, noindex, locale paths, breadcrumbs and Article schema. Do not write `<head>` metadata in each Insights component.
- RSS routes already exist at `/rss.xml` and `/{locale}/rss.xml`; sitemap and robots are already build-generated. Test their output using real published content instead of duplicating their generation.

## Publication, missing-content, and error behavior

Public Insight output requires per-locale localized identity/copy, PUBLISHED stage, `READY` status, real past `publishedAt`, and non-future scheduling. A missing translation is absent, not redirected. Draft/private/unlisted/noindex content must stay out of pages, sitemap, and feeds. A request failure, corrupt Rich Text, invalid/duplicate slug, or incomplete public record should fail the build rather than publish a partial site.

Optional author, image, category/tag, service/offering/case-study, related-article, SEO, and CTA fields must render conditionally. Do not invent missing authors, dates, images, claims, relationships, or CTA copy.

## Proposed file map for follow-on work

Existing files are not proposals:

- `src/lib/hygraph/client.ts` — server-side GraphQL transport.
- `src/lib/hygraph/queries/articles.ts` — Insight summary/detail queries.
- `src/lib/insights/normalize.ts` — safety/publication gate.
- `src/pages/[locale]/insights/index.astro` and `[slug]/index.astro` — static routes.
- `src/components/insights/` — editorial UI.
- `src/lib/seo/` and `src/pages/*rss.xml.ts` — SEO/distribution.

Potential new paths, only if an approved future scope requires them:

- `src/pages/[locale]/insights/category/[slug]/index.astro` — proposed category archive.
- `src/pages/[locale]/insights/tag/[slug]/index.astro` — proposed tag archive; requires an explicit SEO/quality decision.
- `src/lib/insights/pagination.ts` — proposed only if pagination is approved.
- A host-specific webhook/CI configuration — proposed only after hosting is identified.

## Dependencies and ordered next steps

1. **Before ARK-BLOG-002:** verify actual Hygraph schema, locales, published-read permission, and whether the intended first articles/assets exist. Decide header navigation target (`/#insights` vs `/insights/`).
2. **ARK-BLOG-002:** reconcile its requirements with the existing Insights implementation; limit work to verified gaps and real content/schema mismatches.
3. **ARK-BLOG-003–005:** only after approved editorial taxonomy, workflow/preview decision, and real content field mapping. Reuse current formatting, routes, security, relationships and SEO.
4. **ARK-BLOG-006:** category/tag archives only after quality and indexing policy approval.
5. **ARK-BLOG-007:** analytics/consent only after provider and legal requirements are selected.
6. **ARK-BLOG-008–009:** deployment/publishing automation only after host and CI/CD ownership are confirmed.

## Explicit unresolved decisions

1. Is the header Insights item intended to link to the home preview or dedicated listing?
2. Does the actual Hygraph schema match the Article query/model contract, including localized slugs and asset fields?
3. Which build/deploy system receives Hygraph publication events and which environment stores the read-only token?
4. Is protected draft preview needed for MVP, and what host-level controls are acceptable?
5. Which analytics provider and consent/legal regime apply?
