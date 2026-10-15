# ARK-BLOG-001 v2 — Architecture Assessment (Storyblok migration)

**Status:** Partially complete. Documentation only. Two external checks are required before implementation (see §10).
**Date:** 2026-10-14.
**Supersedes:** the Hygraph-based assumptions of `ark-blog-001-architecture-assessment.md`, `ark-blog-001-gap-decision-register.md`, `ark-blog-001-integration-contract-proposal.md`, `ark-blog-002-*.md` and `ark-blog-003-preflight-blocker.md`. Those files keep their history; their CMS-specific statements are obsolete.
**Companion:** [`ark-blog-001-v2-cms-migration-decision.md`](ark-blog-001-v2-cms-migration-decision.md) holds the go/no-go decision and the decision register.

Scope followed: inspect, document, recommend. No application code, dependencies, lockfile, Astro configuration, environment file, Storyblok space, Hygraph content, or authentication behaviour was changed by this task. No credentials were read or used.

---

## 1. Preflight and limitations

| Check | Result |
| --- | --- |
| Repository instructions (`CLAUDE.md`, `AGENTS.md`, `.github/`, host configs) | None found within three levels of the project root. |
| Git status / working-tree preservation | **Not possible.** `git rev-parse` reports the folder is not a git repository. Earlier turns in this session changed application files without version control; the changes are listed in §11 for traceability. |
| Astro version | `package.json`: `astro ^7.3.5`; installed `7.3.5`. **The task contract says Astro 5**; the repository is on Astro 7. Recorded as a discrepancy. |
| Node | `package.json` `engines.node >=22.12`; local runtime `v24.19.0`. |
| Storyblok documentation | Read through WebFetch/WebSearch on 2026-10-14. Two official pages returned 404 or lacked version data (see §3). Tutorial pages were used only as corroboration. |
| Storyblok account | **Not accessed.** No space, plan, token, region, or permission was inspected. Everything marked "Unknown" in §3 depends on that. |
| Hygraph remote | **Not accessed.** No introspection, login, or content read was performed. |

---

## 2. Verified current state (WP1 — Astro website baseline)

| Area | Verified fact | Evidence |
| --- | --- | --- |
| Rendering | `output: 'static'`; no adapter; no server runtime. | `astro.config.mjs` |
| URL convention | `trailingSlash: 'always'`; `build.format: 'directory'`. | `astro.config.mjs` |
| Root redirect | `/` → `/en/` declared as 301; static output emits a meta refresh. Real 301 depends on hosting. | `astro.config.mjs`; `README.md` |
| Locales | `en` (default), `es`, `pt`, `fr`; prefixes `/en/`, `/es/`, `/pt/`, `/fr/`. No English fallback for article content. | `README.md` (i18n section); `astro.config.mjs` sitemap `i18n` block |
| Route set | Home, solutions (family/service/offering), case studies (index + detail), insights (index + detail), legal (4 pages), 404, `robots.txt`, `rss.xml` (root EN and per locale). | `src/pages/` tree |
| Shared layout | `PageLayout` composes `Header` (Navigation) and `Footer`; `BaseLayout` owns `<head>`, canonical, hreflang, OG, JSON-LD. | `src/layouts/PageLayout.astro`, `src/layouts/BaseLayout.astro` |
| Navigation | Desktop/mobile menu: About, Challenges, Solutions (mega-menu), How We Work, Why Arkanium, Case Studies, **Insights → `/#insights`** (restored in this session), then a placeholder **Iniciar sesión → `/{locale}/login/`** (no page exists). | `src/components/layout/Navigation.astro`, `SolutionsMenu.astro` |
| Footer | Insights link is passed **unconditionally** by `PageLayout` to `/{locale}/insights/`, so the link appears even when no article exists. | `src/layouts/PageLayout.astro` line 24; `Footer.astro` |
| Homepage Insights section | `InsightsPreview` renders `items.slice(0, 3)`; empty list shows the "Próximamente" card. "View all" label exists in all four locales (`viewAll`: "View all insights", "Ver todos los artículos", "Voir tous les articles", "Ver todos os artigos"). | `src/pages/[locale]/index.astro` line 28; `src/components/sections/InsightsPreview.astro`; `src/i18n/*.ts` |
| Insights data layer | `getArticleSummaries(locale)` and `getArticle(locale, slug)`. **Currently returns empty data**: no CMS is connected. Rich Text sanitiser, reading-time and publication rules remain. | `src/lib/insights/index.ts`, `normalize.ts`, `richtext.ts`, `types.ts` |
| Insights presentation | Index and detail pages plus six components (`InsightCard`, `InsightHero`, `ArticleContent`, `ArticleAuthor`, `RelatedInsights`, `RichText`). | `src/pages/[locale]/insights/`, `src/components/insights/` |
| Case studies | Separate corporate area; data layer and integrity rules in `normalize.ts`. Currently empty. | `src/lib/case-studies/` |
| Service catalog | Routes `/solutions/{family}/{service}/{offering}/`; mega-menu generated at build. Currently empty. | `src/lib/catalog/`, `src/pages/[locale]/solutions/` |
| SEO | Canonical per locale, hreflang with `x-default`, OG and Twitter metadata, JSON-LD (`globalSchemas`, breadcrumbs, article). Custom sitemap hook filters `noindex` and emits hreflang alternates. | `src/lib/seo/`, `BaseLayout.astro`, `astro.config.mjs` (`seoSitemap`) |
| RSS | Root feed is English; localised feeds at `/{locale}/rss.xml`. Items come from `rssItems(locale)`. | `src/pages/rss.xml.ts`, `src/pages/[locale]/rss.xml.ts`, `src/lib/seo/rss.ts` |
| Analytics | **None.** No analytics or tag-manager code found. The only consent text is the legal page content. | repository search |
| Contact / inquiry destination | The CTA form (`CTA.astro`) validates client-side and prevents default submission. **No network call or endpoint exists in the repository.** There is no real inquiry destination yet. | `src/components/sections/CTA.astro` lines ~100–165 |
| Design system | Tokens in `src/styles/tokens.css`; component CSS in `components.css`, `solutions.css`, `insights.css`, `case-studies.css`. Responsive breakpoints at 1120, 980, 720 and 480 px. Self-hosted fonts. | `src/styles/` |
| Images | Static assets in `public/images/`; Insights schema supports `featuredImage` with alt/caption. No Astro image optimisation pipeline is used. | `public/`, `src/lib/insights/types.ts` |
| Tests | `npm test` = `test:integrity` (33 OK) + `test:insights` (37 OK) + `test:seo` (**fails**, see below). | `package.json`; `scripts/` |
| Type check | `astro check`: 0 errors, 0 warnings, 0 hints (Result 96 files). | executed (§11) |
| Build | `astro build`: 33 pages generated, `sitemap-index.xml` created. | executed (§11) |
| Deployment | **No host configuration** (`netlify.toml`, `vercel.json`, `wrangler.toml`, `.github/` absent). Host unknown. | repository search |

### Baseline failures recorded, not fixed

- **`test:seo` fails.** The assertion expects the title `Architecture Consulting | Arkanium Consulting` but the generated title is `Architecture Consulting | Arkanium Consulting LLC, New Mexico - USA`. The site name constant in `src/content/static/site.ts` was not changed by this task, so the test expectation is stale or the constant changed earlier. Owner decision needed (§9).
- **Legal page static paths** was broken at build time before this session's fixes and was corrected in the earlier session (see §11). Not related to CMS.

---

## 3. Hygraph state (WP2 — classification)

**Classification: retired from the repository; remote state unverified.**

| Item | Repository evidence before removal | Current state |
| --- | --- | --- |
| Client | `src/lib/hygraph/client.ts` (`hygraphRequest`, bearer token, 20 s timeout, fail-closed on errors). | **Deleted** in this session. |
| Queries | `src/lib/hygraph/queries/articles.ts`, `shared.ts`; `src/lib/catalog/queries.ts`; `src/lib/case-studies/queries.ts`. | **Deleted**. Raw types moved to neutral `raw.ts` files. |
| Source resolution | `src/lib/cms-source.ts` (`resolveSource`, `readFixture`), selecting Hygraph when `HYGRAPH_ENDPOINT` is set, fixture otherwise, and failing production builds without an endpoint. | **Deleted**. Loaders return empty data and warn once. |
| Environment variables | `HYGRAPH_ENDPOINT`, `HYGRAPH_TOKEN`, `HYGRAPH_STAGE`, `CATALOG_SOURCE` (declared in `src/env.d.ts`, documented in `README.md`). | **Removed** from `env.d.ts` and `.env.example`. |
| Credentials in repository | `.env.example` contained a full bearer-style token for the Hygraph Content API. | **Removed from the file in this session. The token is still valid until revoked in Hygraph.** Owner action required. |
| Fixtures | `hygraph/seed/catalog-fixture.json`, `case-studies-fixture.json`, `articles-fixture.json`. | **Deleted** (user decision, no backup, no git history). |
| Mock server | `scripts/mock-hygraph.mjs`, npm script `cms:mock`. | **Deleted**. |
| Docs | `docs/hygraph-model.md`, `docs/hygraph-blog-schema.md`. | **Deleted**. Other ARK-BLOG docs still mention Hygraph (banners added; see the decision record §9). |

**Discrepancy with the task contract.** The contract states the Hygraph endpoint "has not yet been consumed by Astro." Earlier code **did consume** it: when `HYGRAPH_ENDPOINT` was set, `catalog`, `case-studies` and `insights` called `hygraphRequest` at build time. The endpoint was not called in the absence of credentials, which is consistent with "not yet consumed" in the local environment only.

**Remote Hygraph state.** Not verified. The earlier blocker report (`ark-blog-003-preflight-blocker.md`) recorded schema introspection evidence from a prior session: the `Locale` enum exposed only `en`, `Article` lacked `format`, and several relations and SEO fields were absent. That evidence is historical and is **not** re-verified here.

**Retirement is not complete.** The Hygraph workspace, its roles, its published content and its token have not been reviewed by the owner. Do not treat removal from the repository as a remote migration.

---

## 4. Storyblok feasibility with Astro (WP3)

Official sources consulted on 2026-10-14. Where the official page did not state a version, this is recorded as **Unknown**.

| Capability | Official evidence | Project requirement | Status |
| --- | --- | --- | --- |
| SDK | `@storyblok/astro` is documented as **Version 8.x**, requiring **Astro 3.0 or later** and Node LTS (22.x recommended). Install: `npm install @storyblok/astro@latest`. ([Astro SDK](https://www.storyblok.com/docs/libraries/js/astro-sdk)) | Astro 7.3.5, Node ≥22.12. | **Unknown** for Astro 7. Documented floor is satisfied; compatibility with Astro 7 is not stated. Requires an install spike (later task). |
| Quickstart versions | Quickstart was **tested with** `astro@5.7.14`, `storyblok-astro@6.2.0`, Node `v22.13.0`, and configures `output: "server"`. ([Storyblok + Astro quickstart](https://www.storyblok.com/docs/quickstarts/astro)) | Repository is static (`output: 'static'`). | **Do not copy blindly.** Versions and rendering mode differ from this project. |
| Astro CMS guide | Recommends an integration with `storyblok()` and a `components` map; the page does not pin an Astro version. Says static mode needs a **webhook** to rebuild on publish. ([Astro CMS guide](https://docs.astro.build/en/guides/cms/storyblok/)) | Static host and rebuild trigger. | Partially verified. Host-specific hook steps depend on the host (unknown). |
| Delivery API token | Quickstart and guide describe a **preview token** used to fetch drafts and published versions; production uses a **public** token. ([Visual Preview in Astro](https://www.storyblok.com/docs/guides/astro/visual-preview)) | Public read for production; protected token for previews, never in browser code. | Verified as documented. Token creation and scopes depend on the account. |
| Region | `apiOptions.region` must be set unless the space was created in the EU. The default documented is EU. | Region of the owner's space. | **Unknown**: owner must confirm space location. |
| Draft / preview | Preview fetches draft content with `version: "draft"`. The Visual Preview guide advises deploying preview in **client-side or server-side rendering** to reflect edits on save. | A static production build cannot serve draft preview on its own. | **Blocked by architecture.** Preview requires a separate SSR/on-demand preview path, or an approved alternative. |
| Live preview | `livePreview` is off by default. Live preview **requires SSR** (`output: 'server'`). Storyblok describes it as opt-in and possibly costly on large pages with heavy client scripts. ([DEV Community announcement](https://dev.to/storyblok/announcing-live-preview-for-storybloks-astro-integration-502a)) | Not needed for MVP if preview is a protected SSR route. | Documented as experimental/opt-in; not adopted by this assessment. |
| Visual Editor bridge | `storyblokEditable(blok)` adds attributes for the Bridge. Without live preview the Bridge refreshes on save or publish. | Editor experience. | Verified as documented; requires preview rendering path (above). |
| Webhooks | Static builds need a webhook on "Story published & unpublished" to a deploy hook (Netlify/Vercel examples). | Host decision. | **Blocked by host** (BLOG-001-G12 remains unknown). |
| REST limits | Content Delivery API: `per_page` default 25, **maximum 100**. Cached CDN responses: 1000 req/s; uncached listings are throttled by page size (for example 6 req/s for 75–100 entries). HTTP 429 on excess. ([CDN pagination/rate limit](https://www.storyblok.com/docs/api/content-delivery/v2/getting-started/pagination)) | Homepage needs 3–4 items; archive needs paging. | Verified as documented. Build-time fetching of a few pages is comfortably within limits. |
| GraphQL limits | GraphQL Content Delivery API uses a **points** system: **100 points per second**; cost depends on `first`/`last` on connections; HTTP 429 on excess. Pagination caps at 100. ([GraphQL CDN](https://www.storyblok.com/docs/graphql-api)) | The owner's earlier brief named a GraphQL CMS. | Verified as documented. **The GraphQL endpoint base URL depends on the space's region**; locale/version arguments were **not** confirmed in the official page (see §4 table row below). |
| GraphQL locale and version | Official page for GraphQL did not state a `language`/`locale` argument or how draft vs published is selected in GraphQL. The REST API uses `language` and `version`. | Locale-specific queries. | **Unknown.** Requires a spike against the real space. |
| Storyblok plan features | Individual language publishing is an opt-in setting under Settings → Internationalization. Dimensions app and Translatable Slugs app availability depend on plan. | Independent per-language publication; hreflang alternates. | **Unknown**: depends on the owner's plan. |

### Notable documentation inconsistencies

- The GraphQL getting-started example uses a `/v1/api` path while the endpoint list uses `/v2/api`. Use the endpoint list and verify against the space.
- The quickstart and the Astro guide show different rendering modes (`server` vs unspecified) and different versions. The project must make its own decision.

---

## 5. Localization and editorial model inputs (WP4)

Storyblok localization facts, from the official internationalization page:

1. **Field-level translation.** One story can hold several language versions. Translation is enabled **per field** in each story version. Editors can enter manual or AI translations.
2. **Blocks are not translatable.** "All field types except `Blocks` support translations." Block fields cannot be translated individually. Any Article body built from nested blocks cannot be localised field by field.
3. **Separate localised stories.** Folder-level translation uses dedicated folders per language. Space-level translation uses separate spaces. Both add structure cost.
4. **Translated slugs.** The Translatable Slugs app stores a separate slug per language on each story and folder.
5. **Alternates for hreflang.** Dimensions links alternate versions across top-level folders. Without Dimensions, alternates must be set manually and content copied manually.
6. **Publication.** By default, publishing a story publishes **all** language versions at once. Independent publication per language is opt-in.
7. **Delivery.** The API selects a language with a `language` parameter. Codes use underscores for regions (for example `es_co`). `fallback_lang` provides fallback for untranslated fields.

### Trade-offs against the approved contract (ARK-BLOG-002)

| Requirement from ARK-BLOG-002 | Field-level translation in one story | Separate localised stories per language |
| --- | --- | --- |
| One conceptual article, one identity across locales | Natural. One story, one `id`. | Requires an explicit cross-locale identifier and relations. |
| Each locale publishable independently | **Opt-in and plan-dependent.** Default publishes all languages together. | Natural. Each story publishes independently. |
| No English fallback for article content | `fallback_lang` must **not** be used. The application must check that the requested locale has a translated title, slug, excerpt and body. | Natural: a missing story means no route. |
| Localised slugs unique per locale | Translatable Slugs app (plan-dependent). | Native per story. |
| Body as structured content | Body must be a **Rich Text field**, not Blocks, to stay translatable. | Blocks can be used, but each language carries its own tree. |
| hreflang discovery of published alternates | Needs a reliable link between language versions. | Needs Dimensions or an explicit relation field. |

**Assessment.** The contract's no-fallback and independent-publication rules favour **separate localised stories linked by an explicit relation**, if Storyblok's per-language publishing cannot be enabled on the owner's plan. If the plan supports independent language publishing, field-level translation with a Rich Text body is simpler and preserves one identity.

**Open:** which path the owner's plan supports (§9).

---

## 6. Homepage Insights teaser and full Insights experience (WP5)

Contract: 3–4 most recent **published** articles in the active locale, a localised "View more" link to the archive, no drafts or unpublished translations, graceful behaviour on CMS failure, and an ordering rule from the real editorial contract.

| Requirement | Current implementation | Gap |
| --- | --- | --- |
| 3–4 items | `slice(0, 3)` hard-coded in the homepage. | Fine for 3; 4 needs a single constant. |
| Published only, current locale | `publicationOf` gate; per-locale query; no fallback. | Preserved. Requires the CMS to exist. |
| Ordering "most recent" | `byPriority`: **featured first**, then `publishedAt` descending. | **Conflict.** A featured older article would appear above newer ones, contrary to "most recent". Owner decision needed. |
| Cards | `InsightCard` uses title, excerpt, cover image, categories, author, dates. | Acceptable; conditional rendering for optional fields exists. |
| "View more" link | Label exists (`viewAll`). Current copy: "Ver todos los artículos" / "View all insights". | Contract wording is "Ver más / View more". **Copy decision needed.** |
| Empty response | Shows "Próximamente" card. | Acceptable as graceful empty state. |
| CMS failure | With a CMS, `hygraphRequest` threw and failed the build (fail-closed). **Today there is no CMS and nothing throws.** | Decision needed: fail the build (protects content) or degrade the teaser only (protects the corporate site). The contract requires the latter for the teaser. |
| Reuse | Teaser and archive use the same `getArticleSummaries`. | Keep. Do not create a second data path. |

**Shared corporate navigation.** The header Insights item goes to `/#insights` (decision made in this session). The footer goes to `/{locale}/insights/`. Both must stay consistent after the CMS is connected.

---

## 7. Shared navigation and Clerk dependency (WP6)

- **Where the sign-in entry belongs.** Desktop: last item in the `.nav-links` row, styled as an outline button (`.nav-login`). Mobile: header button beside the menu toggle (`.nav-login-mobile`). Both point to `getLocalizedPath(locale, siteConfig.loginPath)`, currently `/login/`.
- **Current state.** A **placeholder** only. The route does not exist and no auth code runs. This was placed by the owner's instruction in this session; Clerk is to be connected later.
- **Clerk in the repository.** None: no package, no configuration, no code. A repository-wide search found no matches.
- **Dependencies.** `ARK-AUTH-001` (approved sign-in behaviour, user classification, authorisation, redirect logic) and `ARK-WEB-008` (rendering the shared entry point, including final labels and the route).
- **Security considerations for later.** Routing must come from **verified authorisation**, not a query parameter or client-side role. Session sharing across `arkanium.consulting`, `app.arkanium.consulting` and `control.arkanium.consulting` must be configured and tested. Do not assume the production Clerk instance, roles, or redirect URLs exist. Do not assume a sign-in grants both dashboards.

---

## 8. Gap analysis

### Reusable as is
- Routing, locale prefixes, trailing-slash convention, sitemap and hreflang hook.
- BaseLayout SEO (canonical derivation, OG, JSON-LD), RSS and robots.
- Insights presentation components, Rich Text sanitiser, reading-time, publication gate.
- Design system and responsive navigation (with the new login entry).
- Build-time static model, provided the content source is decided.

### Requires revision
- The **data access boundary**: rebuild as a Storyblok adapter with Storyblok field names, not Hygraph names.
- The **Article contract** (ARK-BLOG-002): field names, the `format` enum, body type (Rich Text, not Blocks, if localised per field), localisation model, and locale-independent publication rule.
- **Preview**: a protected SSR path is needed for draft content. The static production model cannot serve it.
- **Publishing**: a webhook to a deploy hook needs a host decision.
- **Teaser ordering and copy**: the featured-first rule and the "Ver más" label.

### Not present
- Storyblok space, schemas, content, tokens, webhooks, and any plan-level feature confirmation.
- A real inquiry destination for the CTA form.
- Analytics and consent mechanism.
- Hosting and CI/CD configuration.
- A passing `test:seo` expectation.

---

## 9. Impact matrix (ARK-BLOG-001 to 009, plus dependencies)

**Numbering note.** Task numbering differs between documents. `ark-blog-002-editorial-domain-content-model.md` §8 lists 004 Routes & i18n, 005 Editorial UI, 006 SEO, 007 Preview & Publishing. `ark-blog-001-integration-contract-proposal.md` lists 006 Category/tag archives, 007 Analytics/consent, 008–009 Deployment/publishing automation. The task contract that requested this assessment refers to 002/003/004/007 as CMS-dependent and to 005/006/008/009 as CMS-independent, which matches §8 of ARK-BLOG-002 for 004–007 but not for 006–009 in the proposal. **The canonical list must be confirmed by the owner** (§9, decision D-07). The matrix below uses the contract's classification and the ARK-BLOG-002 meanings.

| Task | Meaning (source) | Classification | Status | Notes |
| --- | --- | --- | --- | --- |
| ARK-BLOG-001 | Architecture assessment and CMS decision | Complete for documentation; this file and the decision record | Partially complete (external checks open) | No application change. |
| ARK-BLOG-002 | Editorial domain and content model | **CMS-dependent: requires revision** | Not started against Storyblok | Field names, `format` enum, localisation model and body type must be re-specified. |
| ARK-BLOG-003 | Integration layer | **CMS-dependent: requires revision** | Not started; previous attempt blocked on Hygraph | Hygraph client removed. Re-specify as a Storyblok adapter. |
| ARK-BLOG-004 | Routes and internationalisation | **CMS-dependent: requires revision** (slugs and alternates) | Not started | Route structure reusable; translated-slug and alternate rules depend on §5. |
| ARK-BLOG-005 | Editorial UI | **CMS-independent: reusable with amendments** | Partially present (components exist) | Amend for final field set and optional fields. |
| ARK-BLOG-006 | SEO (per ARK-BLOG-002) / category archives (per proposal) | **CMS-independent: reusable with amendments** | Partially present (SEO helpers exist; archives absent by design) | SEO metadata mapping depends on Storyblok SEO fields. |
| ARK-BLOG-007 | Preview and publishing lifecycle (per ARK-BLOG-002) / analytics and consent (per proposal) | **CMS-dependent: requires revision** (preview) | Not started | Preview needs an SSR path; publishing needs a host decision. |
| ARK-BLOG-008 | Deployment/publishing automation (per proposal) | **CMS-independent in part; host-dependent** | Not started; status unverified | Hosting unknown. |
| ARK-BLOG-009 | Deployment/publishing automation (per proposal) | **CMS-independent: reusable with amendments** | Not started; status unverified | Depends on the canonical numbering (D-07). |
| Homepage teaser | Linked work, separately scoped in the contract | **CMS-dependent** for data; UI present | Partially present | Ordering and copy decisions (§6). |
| ARK-AUTH-001 | Clerk sign-in behaviour and authorisation | Separate workstream | Not started (no Clerk in repository) | Owner-approved later. |
| ARK-WEB-008 | Shared navigation entry point for sign-in | Separate workstream | Placeholder present | `/login/` route is absent. |

---

## 10. Next steps (deliverable 5)

### Owner actions outside the repository (required before ARK-BLOG-002)

1. **Revoke the Hygraph token** that was in `.env.example`, and decide whether to archive or delete the Hygraph workspace.
2. **Confirm the Storyblok space**: region, plan, and whether it can enable **individual language publishing** and the **Translatable Slugs** and **Dimensions** apps.
3. **Create a read-only Storyblok token** for build-time delivery (public or published scope), and a **separate preview token** kept out of browser code. Store both in the host's secret store, never in the repository.
4. **Confirm the hosting provider** and whether a preview deployment with server rendering is acceptable.
5. **Confirm the canonical ARK-BLOG task list** (decision D-07).

### Verification to run after the owner actions (later tasks, not this one)

- A **spike on a branch** that installs `@storyblok/astro` against Astro 7.3.5, confirms the GraphQL locale argument and draft selection, and measures a build-time fetch. Requires dependency installation and must not be merged into the repository without approval.
- A check of published and draft responses for one test story per locale.

### Ordered prerequisites

1. **ARK-BLOG-002 (re-specification)** — prerequisites: owner decisions D-01 to D-04 and D-06 in the decision record; Storyblok space access for field verification.
2. **ARK-BLOG-003 (Storyblok adapter)** — prerequisites: ARK-BLOG-002 approved; read-only token; SDK spike passed.
3. **ARK-BLOG-004 (routes and i18n)** — prerequisites: localisation model decided (D-02); plan features confirmed.
4. **ARK-BLOG-007 (preview and publishing)** — prerequisites: host decided (D-05); preview path approved (D-04).
5. **ARK-BLOG-005/006/008/009** — may proceed in parallel with the CMS-dependent tasks only where they do not need content; see the matrix.
6. **ARK-AUTH-001** and **ARK-WEB-008** — separate; they must not start the Clerk integration without their own contracts.

---

## 11. Execution report (deliverable 6)

**Status:** Partially complete. Two external checks (Storyblok plan features and locale/version behaviour in GraphQL) and the owner decisions in §9 remain open.

### Files changed by this task
- `docs/ark-blog-001-v2-architecture-assessment.md` (new).
- `docs/ark-blog-001-v2-cms-migration-decision.md` (new).
- Banner added at the top of the superseded ARK-BLOG documents (see decision record).

**No application source, configuration, dependency, lockfile, environment file, Storyblok space, or Hygraph content was changed by this task.**

### Changes made earlier in this session (for traceability; not part of this task)
- Removed Hygraph client, queries, source resolution, fixtures, mock server, `cms:mock`, env declarations and the `.env.example` token.
- Loaders for catalog, case studies and insights return empty data and warn once.
- Restored the Insights section and menu item; replaced the navbar CTA with an "Iniciar sesión" placeholder.
- Fixed the legal page static paths so the build passes; applied the UI fixes from the earlier design review.

### Validation run (this task)
| Command | Outcome |
| --- | --- |
| `npx astro build` | Pass. 33 pages built. `sitemap-index.xml` created. |
| `npx astro check` | Pass. 0 errors, 0 warnings, 0 hints. |
| `npm run test:integrity` | Pass. 33 tests OK. |
| `npm run test:insights` | Pass. 37 tests OK. |
| `npm run test:seo` | **Fail** (baseline). `AssertionError`: title expectation mismatch. Not changed. |
| Repository search for Clerk, analytics, tag managers | No matches in `src/`, `package.json` or `astro.config.mjs`. |
| `git rev-parse --is-inside-work-tree` | Not a git repository. |

### Recommended checks for later tasks
- Storyblok space and plan confirmation (manual, owner).
- SDK compatibility spike with Astro 7.3.5 (branch, install required).
- Preview route with SSR and protected token (after host decision).
- Teaser ordering and empty-state tests once a CMS returns data.
