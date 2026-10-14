# ARK-BLOG-001 — Architecture Assessment

> **Obsoleto en lo referido a CMS (2026-10-14):** el proyecto migra de Hygraph a Storyblok. Las suposiciones de Hygraph de este documento ya no aplican. Ver [ark-blog-001-v2-cms-migration-decision.md](ark-blog-001-v2-cms-migration-decision.md).

**Status:** Complete — assessment only.  
**Scope date:** 2026-10-09.  
**Method:** repository inspection and safe local validation. No application, CMS, deployment, dependency, or environment configuration was changed by this assessment.

## 1. Executive summary

The repository is already materially beyond the starting state described in the attached contract. It is an Astro **7.3.5** static website with an implemented Insights module, build-time Hygraph access layer, four-language routes, article rendering, service/offering relationships, structured data, sitemap, robots, and localized RSS. Therefore, ARK-BLOG-002 should not recreate these capabilities. Its scope must first be reconciled with the existing implementation and the actual Hygraph project schema.

**Verified:** Insights is integrated into the same public Astro site at `/{locale}/insights/` and `/{locale}/insights/{slug}/`; no separate application or deployment exists in the repository.  
**Verified:** Local production builds fail closed when Hygraph configuration is absent.  
**Unknown:** the actual remote Hygraph schema, content, permissions, hosting provider, deployment trigger, preview deployment, analytics, and consent configuration cannot be established from the repository.  
**Important discrepancy:** the primary navigation currently links the Insights label to the localized home anchor `/{locale}/#insights`, while the footer links to the standalone Insights listing only when at least one published article exists. See `src/components/layout/Navigation.astro`, `src/layouts/PageLayout.astro`, and `src/components/layout/Footer.astro`.

## 2. Verified repository and application baseline

| Finding | Evidence |
| --- | --- |
| Runtime requires Node `>=22.12.0`; the project uses npm and has a lockfile. | `package.json`, `package-lock.json` |
| Installed Astro version is `7.3.5`, not Astro 5 as stated in the task brief. | `npm ls astro --depth=0`; `package.json` |
| TypeScript uses Astro strict configuration. | `tsconfig.json` |
| Output is static directory-format HTML with trailing slashes and a configured `/` → `/en/` redirect. | `astro.config.mjs` |
| Source boundaries are components, layouts, `lib`, i18n, pages, static content, styles, and Hygraph fixtures. | `src/`, `hygraph/seed/`, `README.md` |
| No `AGENTS.md` was found under the workspace. The current directory is not a Git worktree, so a reliable working-tree diff/status cannot be determined. | filesystem search; `git status --short` returned “not a git repository” |

Relevant commands are `npm run dev`, `npm run build`, `npm run preview`, `npm run check`, `npm test`, and `npm run cms:mock`. The tests cover case-study integrity, Insights publication/Rich Text safety, and SEO helper behavior. See `package.json`, `scripts/test-*.mjs`.

## 3. Routes and localization

### Verified

- Locale source of truth: `en`, `es`, `pt`, `fr`; default `en`. `src/i18n/config.ts`.
- Every public locale is explicit: `/en/`, `/es/`, `/pt/`, `/fr/`; `getLocalizedPath()` enforces trailing slashes. `src/i18n/utils.ts`, `astro.config.mjs`.
- Insights routes are statically generated in `src/pages/[locale]/insights/index.astro` and `src/pages/[locale]/insights/[slug]/index.astro`.
- Article slugs are localized. An absent article localization produces no route and no hreflang alternate. `src/lib/insights/index.ts`, `src/pages/[locale]/insights/[slug]/index.astro`.
- `BaseLayout` emits locale-specific canonical URLs, HTML `lang`, alternate links and `x-default`. `src/layouts/BaseLayout.astro`, `src/lib/seo/hreflang.ts`.
- The language switcher receives actual article locale paths for translated article slugs; its behavior should be reused rather than replaced. `src/pages/[locale]/insights/[slug]/index.astro`, `src/components/layout/LanguageSwitcher.astro`.
- Unrecognized/missing routes use a branded, `noindex` 404. `src/pages/404.astro`.

### Constraint

The i18n dictionary has an English fallback for missing interface keys, but Insights content itself does **not** fall back to English. This distinction is intentional and must remain intact. `src/i18n/utils.ts`, `src/lib/insights/normalize.ts`.

## 4. Shared UI and design-system findings

### Verified reusable capabilities

- Document/layout shell: `src/layouts/BaseLayout.astro` and `src/layouts/PageLayout.astro`.
- Shared navigation/footer: `src/components/layout/`.
- Design tokens, global styles and responsive component rules: `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/components.css`, `src/styles/insights.css`.
- Reusable UI: `Button.astro`, `SectionHeading.astro`, and existing card patterns under `src/components/ui/`.
- Existing editorial components: `InsightCard.astro`, `InsightHero.astro`, `ArticleContent.astro`, `ArticleAuthor.astro`, `RelatedInsights.astro`, and `RichText.astro` in `src/components/insights/`.
- Accessibility patterns include skip links, semantic `<main>`, responsive navigation controls, image dimensions, and external-link rel attributes. `src/layouts/BaseLayout.astro`, `src/components/layout/Navigation.astro`, `src/components/insights/RichText.astro`.

### Verified editorial safety

Hygraph Rich Text is not injected as CMS HTML. `src/lib/insights/richtext.ts` allow-lists nodes/links/images and `src/components/insights/RichText.astro` renders Astro elements. Invalid Rich Text breaks the build rather than publishing corrupt content.

### Gaps / decisions

- Article category/tag archive routes are intentionally absent. The data model exists but archive quality criteria and design remain a later decision. `docs/hygraph-model.md`.
- The landing page has a fixed 24-item display limit and source query limit of 100. Pagination is not implemented. `src/pages/[locale]/insights/index.astro`, `src/lib/hygraph/queries/articles.ts`.

## 5. Services and commercial-link findings

### Verified

The catalog source of truth is the build-time Hygraph integration, normalized under `src/lib/catalog/`; the local fixture is development-only. Service relationship references use `family` + `slug`; offering references include their owning service. `src/lib/catalog/index.ts`, `src/lib/catalog/types.ts`, `src/lib/hygraph/queries/articles.ts`.

The two commercial priorities are already structurally representable:

- Strategy / Technology Diagnosis: family `consulting`, service `technology-diagnosis`.
- Architecture Consulting and Technology Governance: family `consulting`, services `architecture-consulting` and `technology-governance`.

Article detail pages resolve only explicit relationships from the CMS and render related services, offerings/contextual CTA, and related case studies. `src/pages/[locale]/insights/[slug]/index.astro`.

Current route helpers include service and individual offering paths. `src/lib/catalog/index.ts`; route implementation: `src/pages/[locale]/solutions/[family]/[service]/[offering]/index.astro`.

## 6. Hygraph and editorial integration

### Verified

- Environment variable names are `HYGRAPH_ENDPOINT`, `HYGRAPH_TOKEN`, `HYGRAPH_STAGE`, and `CATALOG_SOURCE`; none carry a `PUBLIC_` prefix. `src/env.d.ts`, `src/lib/hygraph/client.ts`, `src/lib/cms-source.ts`.
- The client runs server/build-side only, uses a bearer token only if supplied, has a 20-second timeout, reports GraphQL errors, and fails the build on no data or request failure. `src/lib/hygraph/client.ts`.
- Insights has separate summary and detail GraphQL documents and type shapes. `src/lib/hygraph/queries/articles.ts`.
- Existing query/model evidence supports localized title, slug, excerpt, Rich Text body, images with asset metadata, author, categories, tags, service/offering/case-study relationships, related articles, publication/update/schedule timestamps, workflow status, and SEO fields. `src/lib/hygraph/queries/articles.ts`, `docs/hygraph-model.md`, `docs/hygraph-blog-schema.md`.
- Publicability is enforced in code: localized title/slug/excerpt; `READY` workflow; real `publishedAt`; non-future publish/schedule timestamps; and only a per-locale public page. `src/lib/insights/normalize.ts`.
- Draft-stage querying can be selected with `HYGRAPH_STAGE=DRAFT`, but the repository explicitly says a preview flow is not implemented. `src/lib/insights/index.ts`, `docs/hygraph-model.md`.

### Unknown / requires confirmation

- There is no local `.env` file, only `.env.example`; actual remote endpoint/token availability is not established.
- No remotely authenticated schema introspection was performed. Actual model names, field IDs, locales, role permissions, asset configuration, content records, and publication-stage access require Hygraph access/confirmation.
- No webhook or content-triggered deployment configuration is present in the repository.

## 7. SEO, distribution, analytics and privacy

### Verified SEO/distribution

- Central metadata covers title, description, canonical URL, hreflang, Open Graph, X/Twitter metadata, optional RSS discovery, and noindex. `src/layouts/BaseLayout.astro`, `src/lib/seo/`.
- Global Organization, ProfessionalService and WebSite schemas are centralized; Article and BreadcrumbList schemas are added on Insight pages. `src/lib/seo/structured-data.ts`, `src/pages/[locale]/insights/[slug]/index.astro`.
- `@astrojs/sitemap` is configured with i18n. A build hook regenerates entries from rendered canonical/hreflang/noindex metadata to handle localized article slugs. `astro.config.mjs`.
- Dynamic `robots.txt` references `sitemap-index.xml`. `src/pages/robots.txt.ts`.
- Root English RSS and per-locale RSS feeds exist. RSS takes metadata/excerpts and filters public/indexable articles; it sorts by `publishedAt`. `src/pages/rss.xml.ts`, `src/pages/[locale]/rss.xml.ts`, `src/lib/seo/rss.ts`.
- Noindex policy excludes private/unlisted/noindex/archived/unpublished material in the shared helper. `src/lib/seo/indexability.ts`.

### Unknown

No analytics, consent manager, tracking provider, tag-manager implementation, or privacy preference tooling was found in application source/configuration. Package-lock transitive dependencies are not evidence of a configured provider. Provider selection and consent requirements are decisions for a later task.

## 8. Deployment and publishing lifecycle

### Verified

- Production output is static. `astro.config.mjs`.
- Content is fetched at build time; client-side Insights/CMS fetching is not used. `src/lib/insights/index.ts`, `src/lib/hygraph/client.ts`.
- Without an endpoint, a production build fails rather than silently using fixtures. `src/lib/cms-source.ts`.
- The README identifies host-level work required for an actual HTTP 301 for `/`, and gives Netlify/Cloudflare Pages/Vercel as examples only; it does not identify an active host. `README.md`.

### Unknown

Hosting provider, CI/CD pipeline, production environment-variable injection, deploy hook/webhook, preview deployments, content publish trigger, and rebuild/revalidation process have no evidence in the repository.

## 9. Baseline validation

| Command | Outcome |
| --- | --- |
| `npm ls astro --depth=0` | Passed; reported `astro@7.3.5`. |
| `npm test` | Passed: 33 case-study integrity checks, 37 Insights checks, and 6 SEO checks. |
| `npm run build` | Expected safe failure: production static generation stopped because `HYGRAPH_ENDPOINT` is absent locally. This is an environment/configuration condition, not a code failure. |
| `npm run check` | Inconclusive in this session: `astro check` began generating types/diagnostics but did not return a final diagnostics summary before the process ended. It must be rerun in CI or a stable local shell before relying on it as a release gate. |

## 10. Risks, gaps and constraints

1. **High:** the contract’s premise that Insights and SEO are unimplemented conflicts with repository evidence. A task based on that premise risks duplicate routes, queries, schemas, or metadata.
2. **High:** successful production deployment depends on CMS environment variables and the remote schema matching the existing queries. Neither is locally verifiable.
3. **Medium:** the public navigation points to the home Insights anchor, whereas the standalone listing is conditional in the footer. Product should decide the desired primary navigation destination.
4. **Medium:** preview workflow, CMS webhook/build trigger, deployment provider, analytics and consent are unknown.
5. **Low:** documentation contains historical statements that no longer match implementation (for example, earlier “pending” SEO/RSS wording). Future tasks should use the code and this assessment as the operational baseline.
