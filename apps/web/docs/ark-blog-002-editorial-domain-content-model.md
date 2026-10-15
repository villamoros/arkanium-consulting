# ARK-BLOG-002 — Editorial Domain & Content Model

> **Obsoleto en lo referido a CMS (2026-10-14):** el proyecto migra de Hygraph a Storyblok. Las suposiciones de Hygraph de este documento ya no aplican. Ver [ark-blog-001-v2-cms-migration-decision.md](ark-blog-001-v2-cms-migration-decision.md).

**Status:** Provisional, implementation-ready contract pending remote Hygraph schema verification.  
**Inputs reviewed:** ARK-BLOG-001 deliverables, `docs/hygraph-model.md`, `docs/hygraph-blog-schema.md`, current Insights types/queries/normalization, catalog types, and test fixtures.  
**Scope:** documentation only; no CMS, application, route, dependency, environment, or content change was made.

## 1. Evidence-based model position

The existing implementation already uses one primary **Article** entity for Insights. It supports the shared fields required by both approved editorial treatments and has no evidence that separate `Analysis` and `Guide` models are necessary. The recommended MVP is therefore one `Article` model with a required non-localized `format` enum:

```text
Article.format = ANALYSIS | GUIDE
```

**Verified from repository evidence:** localized article identity/content fields, author/category/tag/service/offering/related-article relationships, publication dates, workflow state, featured status, SEO fields, build-time querying, four localized routes, and public-content filtering already exist in the Astro contract. `src/lib/hygraph/queries/articles.ts`, `src/lib/insights/types.ts`, `src/lib/insights/normalize.ts`.

**Unknown:** remote Hygraph model configuration, requiredness, field IDs, unique constraints, field localization settings, asset metadata setup, roles, and per-locale publishing semantics. No local `.env` or authenticated remote schema evidence is available; no claim below treats these as verified.

## 2. Domain and relationship contract

```text
Article (one conceptual publication; localized fields)
 ├─ one primary Category
 ├─ zero or more Tags
 ├─ zero or one Author
 ├─ zero or more existing Service references
 ├─ zero or more existing Offering references
 ├─ zero or more explicit related Articles
 └─ zero or one existing Case Study reference set (contextual corporate links only)
```

Case Studies remain corporate entities, never an Article format or Insights-owned model. The current optional relationship may be retained only as a link to the existing corporate boundary; it must not duplicate case-study fields/content within Article. `src/pages/[locale]/insights/[slug]/index.astro`.

### Editorial formats

| Format | Meaning | Required model difference |
| --- | --- | --- |
| `analysis` | Analysis & Perspective for executive context, interpretation, risk or decision framing. | None beyond `format`. |
| `guide` | Practical Guide & Framework for structured decision/action guidance. | None beyond `format`. |

The UI can vary presentation by `format` later, but both formats use title, summary, Rich Text body, localization, SEO, relationships, and lifecycle consistently. No second query, route family, CMS model, or content system is recommended.

## 3. Localization and publication contract

The website convention is explicit `en`, `es`, `pt`, and `fr` locale prefixes and trailing slashes. It queries an Article only in the requested locale. The current public gate requires localized title/slug/excerpt, PUBLISHED stage, `READY` status (or current legacy omission), a real non-future `publishedAt`, and no future `scheduledAt`. `src/i18n/config.ts`, `src/lib/insights/index.ts`, `src/lib/insights/normalize.ts`.

### Recommended CMS semantics

1. One Hygraph Article record represents one conceptual publication across localized fields.
2. `title`, `slug`, `excerpt`, `content`, `metaTitle`, `metaDescription`, image alt/caption, category/tag display fields, author role/bio, and CTA copy (if approved) are localized.
3. Each locale must be publishable/available independently. If native field localization cannot model independent locale publication in the selected Hygraph plan, this is a **blocker** to claiming localized public delivery is verified.
4. The localized slug must be unique per locale and immutable after publication except through an approved redirect procedure.
5. No English fallback is allowed for Article content. Missing/unpublished locale content creates no public route, hreflang alternate, sitemap entry, or RSS item.
6. Stable Hygraph record `id` is the cross-locale identity used by relation and hreflang resolution.

## 4. Field specification — Article

| Concept | Existing evidence / current field | Proposed shape | Status | Locale | Requiredness | Validation / Astro use | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stable identity | `id` | CMS record ID | Existing | Shared | Required | Required for alternate-locale identity and related articles. | Reuse |
| Editorial format | No query/type field | enum `ANALYSIS \| GUIDE` | Missing | Shared | Required before READY | Reject unknown enum; later controls presentation only. | Request approved CMS change + later query/type mapping |
| Title | `title` | String | Existing evidence | Localized | Required | Nonblank; page H1/title/OG/schema. | Reuse; verify remote localization |
| Slug | `slug` | String | Existing evidence | Localized | Required | `^[a-z0-9]+(?:-[a-z0-9]+)*$`; unique within locale; builds detail route. | Reuse; verify unique/localized behavior |
| Summary | `excerpt` | multiline String | Existing evidence | Localized | Required | Nonblank; cards/RSS/description fallback. | Reuse |
| Body | `content.raw` | Hygraph Rich Text | Existing evidence | Localized | Required before READY | Safe allow-list renderer; no direct CMS HTML. | Reuse |
| Cover image | `featuredImage` | Asset | Existing evidence | Shared asset; localized metadata | Optional | HTTPS image; render with dimensions/alt if available. | Reuse; verify asset custom fields |
| Featured | `featured` | Boolean, default false | Existing evidence | Shared | Optional | Landing-page prioritization. | Reuse |
| Primary category | current `categories[]` | one Category relation | Partial | Shared relation / localized category fields | Conditional: recommended for READY | CMS must enforce max 1 or editorial validation must do so; supports pillar/archive. | Request cardinality decision/change |
| Tags | current `tags[]` | Tag[] | Existing evidence | Shared relation / localized display fields | Optional | Reusable controlled vocabulary; no automatic public archive. | Reuse |
| Author | `author` | zero-or-one Author | Existing evidence | Shared relation / localized author profile fields | Optional | Omit UI/schema author if absent; never fabricate. | Reuse |
| Service refs | `services[]` | Service[] | Existing evidence | Shared relation | Optional | Existing catalog is source of truth; page resolves by family+slug. | Reuse |
| Offering refs | `offerings[]` | Offering[] | Existing evidence | Shared relation | Optional | Contextual conversion link; never copy pricing/content. | Reuse |
| Related articles | `relatedArticles[]` | Article[] | Existing evidence | Shared relation | Optional | Explicit ordered editorial selections; filter unavailable locale versions. | Reuse |
| Corporate case-study refs | `caseStudies[]` | CaseStudy[] | Existing evidence | Shared relation | Optional | Corporate contextual link only; no case data inside Article. | Reuse conditionally |
| Published date | `publishedAt` | DateTime | Existing evidence | Shared | Required before READY/public | Past/non-future; RSS order and Article schema. | Reuse |
| Updated date | `updatedAt` | DateTime | Existing evidence | Shared | Optional | Editorially meaningful date only; never substitutes publication date. | Reuse |
| Scheduled date | `scheduledAt` | DateTime | Existing evidence | Shared | Optional | Future item excluded until next build. | Reuse; verify remote behavior |
| Workflow | `editorialStatus` | `IDEA \| WRITING \| REVIEW \| READY \| ARCHIVED` | Existing evidence | Shared | Required (recommended) | Only READY public; ARCHIVED excluded. | Reuse; require remote enum verification |
| SEO title | `seo.metaTitle` | String | Existing evidence | Localized | Optional | Falls back to title; no duplicate logic. | Reuse |
| SEO description | `seo.metaDescription` | String | Existing evidence | Localized | Optional | Falls back to excerpt. | Reuse |
| Social image | `seo.ogImage` | Asset | Existing evidence | Shared asset | Optional | Falls back to cover/global image. | Reuse |
| Canonical override | `seo.canonicalUrl` | HTTPS URL | Existing evidence | Shared | Not recommended | Existing code permits HTTPS override; normal canonical must be derived. | Keep legacy optional; avoid new usage |
| Noindex | `seo.noIndex` | Boolean, default false | Existing evidence | Shared | Optional | Excludes discovery. | Reuse |
| Contextual CTA label/destination | No query/type field | localized label + relation-derived destination, if approved | Missing / Not needed now | Localized label; shared relation | Optional | Current CTA derives from service/offering. Do not add free-form URL. | Defer; reuse relationship-derived CTA |

## 5. Supporting entity specifications

| Entity | Proposed fields / cardinality | Existing evidence | Required behavior | Action |
| --- | --- | --- | --- | --- |
| Category | stable identity; localized `name`, `slug`, optional description; Article has one primary category | `categories[] { slug name }`; docs describe localized name/slug/description/order | Four initial proposed pillars are editorial records, not a hierarchy. Archives only after quality/indexing approval. | Reuse model; approve primary-cardinality constraint and records later. |
| Tag | stable identity; localized `name`, `slug`; Article has zero-many tags | `tags[] { slug name }`; docs describe localized fields | Controlled cross-cutting labels; no tag pages by default. | Reuse. |
| Author | display name, stable slug, localized role/bio, optional avatar, LinkedIn, website; Article has zero-one author | article query/type supports these fields | Public identity only; omit gracefully when incomplete; no authentication relation. | Reuse; verify remote privacy/profile data. |
| Service | existing corporate Service relation, zero-many | article query and `ServiceRef` evidence | Reference identity only; resolve public label/path from catalog. | Reuse corporate catalog. |
| Offering | existing corporate Offering relation, zero-many | article query and `OfferingRef` evidence | Reference identity only; service owns offering route/content. | Reuse corporate catalog. |
| Related Article | explicit zero-many ordered relation | `relatedArticles[] { id }` | MVP recommendation is explicit editorial curation; hide items unavailable in current locale. | Reuse. |

## 6. Initial category proposal

These are proposed category records; no records were created.

1. **Technology Strategy & Business Alignment** — decision alignment, strategy, roadmaps, business/technology fit.
2. **Technology Diagnosis & Risk** — assessment, technical risk, system health and due diligence.
3. **Software Architecture & Modernization** — architecture decisions, legacy modernization, integration and delivery foundations.
4. **Technology Governance & Leadership** — governance, architecture review, technical leadership and operating models.

Recommendation: map one Article to one primary category, plus optional tags. This avoids overlapping primary taxonomy while preserving cross-cutting discovery through tags. Category names/slugs must be translated when actual localized archive routes are approved.

## 7. Fictional structural examples

The following are non-publishable structural examples. They contain no client claims or real editorial copy.

### Analysis example

```json
{
  "id": "fictional-insight-architecture-risk",
  "format": "ANALYSIS",
  "title": "[Fictional] Reading architectural risk before a major product decision",
  "slug": "reading-architectural-risk",
  "excerpt": "A fictional executive analysis placeholder.",
  "content": { "raw": { "children": [{ "type": "paragraph", "children": [{ "text": "Illustrative body only." }] }] } },
  "category": "technology-diagnosis-risk",
  "tags": ["architecture", "technical-risk"],
  "services": [{ "family": "consulting", "slug": "technology-diagnosis" }],
  "editorialStatus": "READY",
  "publishedAt": "2030-01-10T09:00:00.000Z",
  "featured": false
}
```

### Guide example

```json
{
  "id": "fictional-insight-governance-guide",
  "format": "GUIDE",
  "title": "[Fictional] A practical framework for technology-governance decisions",
  "slug": "technology-governance-framework",
  "excerpt": "A fictional framework placeholder.",
  "content": { "raw": { "children": [{ "type": "heading-one", "children": [{ "text": "Illustrative framework" }] }] } },
  "category": "technology-governance-leadership",
  "tags": ["governance", "decision-making"],
  "services": [{ "family": "consulting", "slug": "technology-governance" }],
  "editorialStatus": "READY",
  "publishedAt": "2030-02-12T09:00:00.000Z",
  "featured": true
}
```

### Translation availability example

```json
{
  "conceptualId": "fictional-insight-architecture-risk",
  "availableLocales": {
    "en": { "status": "PUBLISHED", "slug": "reading-architectural-risk" },
    "es": { "status": "PUBLISHED", "slug": "leer-riesgo-arquitectonico" },
    "fr": { "status": "DRAFT", "slug": "lire-risque-architecture" },
    "pt": null
  },
  "publicAlternates": ["en", "es"]
}
```

## 8. Downstream implementation notes

| Task | Must use from this contract | Dependency / blocker |
| --- | --- | --- |
| ARK-BLOG-003 — Hygraph Integration Layer | Existing Article client/query/normalizer boundaries; add `format` only after remote approval. | Remote schema field mapping and read access. |
| ARK-BLOG-004 — Routes & Internationalization | Explicit localized routes, Article `id` identity, localized slug/no-fallback contract. | Verify independent locale publication semantics. |
| ARK-BLOG-005 — Editorial UI | Shared Article model and `format` presentation treatment; optional fields must be conditional. | Approved `format` field and real content samples. |
| ARK-BLOG-006 — SEO | Existing BaseLayout/SEO/RSS/sitemap; derive canonical; category/tag archive policy. | Actual metadata/image field verification; archive approval. |
| ARK-BLOG-007 — Preview & Publishing Lifecycle | Existing PUBLISHED/READY/date gate and static build constraint. | Hosting, webhook/rebuild and draft-preview access decisions. |

## 9. Next-step readiness

**ARK-BLOG-003 is not fully ready to change integration code.** It may perform a read-only remote schema mapping once approved Hygraph read access is available. It must not assume `format`, one-primary-category enforcement, independent locale publication, or asset alt/caption configuration exist remotely.

Blocking evidence/decisions:

1. Authenticated or otherwise approved read-only schema evidence for the remote Hygraph project.
2. Approval for a required `format` enum (or confirmation of an equivalent existing field).
3. Decision/remote capability for a single primary Article category.
4. Confirmation of per-locale publication behavior and localized unique slug constraints.

Non-blocking follow-ups: archive threshold/indexing policy, author privacy guidance, featured editorial rules, preview workflow, analytics, deployment and webhook ownership.
