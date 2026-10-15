# ARK-BLOG-002 v2 — Editorial Domain & Storyblok Content Model

**Status:** Specification complete. Implementation **blocked** (see §9).
**Date:** 2026-10-14.
**Depends on:** [`ark-blog-001-v2-architecture-assessment.md`](ark-blog-001-v2-architecture-assessment.md) and [`ark-blog-001-v2-cms-migration-decision.md`](ark-blog-001-v2-cms-migration-decision.md).
**Companion:** [`ark-blog-002-v2-localization-and-teaser.md`](ark-blog-002-v2-localization-and-teaser.md) (localization decision record and homepage teaser contract).
**Supersedes:** the Hygraph-based model in `ark-blog-002-editorial-domain-content-model.md` and `ark-blog-002-decision-register.md`. Their concepts are reused where still valid (§8).

Scope followed: specification only. No application code, dependency, Storyblok space, component, story, datasource, locale, role, token, or content entry was created or changed. No credentials were read or used.

---

## 1. Preflight

| Input | Status |
| --- | --- |
| ARK-BLOG-001 v2 assessment and decision record | Read. Recommendation: *Proceed after blockers*. Owner has stated Storyblok is the chosen CMS; the implementation gate is still closed. This document treats Storyblok as the **proposed** target, as the contract requires. |
| Project instructions, task records | None found in the project. |
| Working-tree state | Not a git repository. Cannot be inspected through version control. |
| Astro route and i18n conventions | Inspected. Locales `en`, `es`, `pt`, `fr`; default `en`; `trailingSlash: 'always'`; routes `/{locale}/insights/` and `/{locale}/insights/{slug}/` exist (`src/i18n/config.ts`, `src/lib/insights/index.ts`, `src/pages/[locale]/insights/`). |
| Service catalog | Inspected. `docs/service-catalog-taxonomy.md` defines the hierarchy and route model. **The catalog data itself is no longer in the repository**: it was read from Hygraph and the fixtures were deleted in this session. See §5.6. |
| Hygraph schema exports | None available in the repository. The Hygraph model was described only in documents that are now superseded. Used as migration reference only (§8). |
| Local Storyblok artifacts | None. No `@storyblok/*` dependency, no Storyblok configuration, no schema export, no environment variable names for Storyblok. |
| Remote Storyblok space | **Not accessed.** Every remote capability below is marked as documented, not verified in the space. |

---

## 2. Verified facts from official Storyblok documentation

Read on 2026-10-14. Quotes are paraphrased unless marked.

| Topic | Verified statement | Source |
| --- | --- | --- |
| Field-level translation | Translatable setting "allows translation when field-level translations are enabled (not applicable to block or group fields)". **Blocks and groups cannot be translated.** | [Fields](https://www.storyblok.com/docs/concepts/fields) |
| Field types available | Asset, Blocks, Boolean, Date/time, Group, Link, Markdown, Number, Option (single or multi), Plugin, References, Rich text, Table, Text, Textarea. Image and File are deprecated. | Fields |
| Option sources | Options can come from Self (static values), Stories, Languages, Datasource, or External JSON. | Fields |
| References | "Links to stories in the same space." Selection can be restricted by folder or content type. | Fields |
| Link fields | Story links expose `cached_url` captured on save, which "can go stale if the story moves". `resolve_links` is needed to resolve at request time. | Fields |
| Asset alt text | **Not documented** on the fields page. Asset alt handling is unverified. | Fields |
| Nestable blocks | Blocks are "children of other blocks" and "dynamic building blocks used to create rich content layouts". | [Blocks](https://www.storyblok.com/docs/concepts/blocks) |
| Blocks in Rich text | **Not documented.** Whether Rich text can embed blocks, and whether such blocks are translatable, is unverified. | Blocks |
| Content types vs blocks | "Content type blocks are stories." A block "can be an entire entry (a story), or it can be just one piece of an entry." "Universal blocks can be used as both." | Blocks |
| Language configuration | Languages are added under Settings → Internationalization → Languages, using codes such as `es`. | [Astro i18n quickstart](https://www.storyblok.com/docs/quickstarts/astro/internationalization) |
| Language selection | The `language` parameter selects the version. Region codes use underscores (`es_co`). | Astro i18n quickstart; [Internationalization](https://www.storyblok.com/docs/concepts/internationalization) |
| Language path | The language code is the first segment of `full_slug` for each language-specific version (for example `es/articles/example-article`). | Astro i18n quickstart |
| Fallback | **Not described** for untranslated content. `fallback_lang` exists for untranslated fields in the API. | Astro i18n quickstart; Internationalization |
| hreflang | **Not described** by Storyblok. The alternates must be built by the application. | Astro i18n quickstart |
| Publishing per language | Default: publishing a story publishes all language versions at once. Individual publishing is opt-in under Settings → Internationalization. | [Internationalization](https://www.storyblok.com/docs/concepts/internationalization) |
| Translated slugs app | Stores a separate slug per language on each story and folder. Plan-dependent. | Internationalization |
| Dimensions app | Links alternate versions across top-level folders. Plan-dependent. | Internationalization |
| API rate limits | REST: `per_page` maximum 100. GraphQL: 100 points per second; cost depends on `first`/`last`. | CDN and GraphQL docs (see assessment §4) |

**Not verified and therefore unknown:** fallback behaviour; how published status per language is read from the API; GraphQL locale argument; how translatable Rich text handles embedded blocks; asset alt translation; datasource entry translation; story-level system fields exposed to GraphQL (`first_published_at`, `published_at`).

---

## 3. Editorial domain

### 3.1 Single editorial type for both formats

Both `analysis` and `guide` use the same content type and the same fields. The difference is a `format` option. **Justification:** the verified field capabilities do not require separate schemas; the contract asks for a separate type only when fields, workflow or rendering differ materially. The differences in rendering are presentation-only (§3.3).

### 3.2 Domain model

```text
insight (content type; one conceptual publication)
 ├─ identity: stable internal key (story slug), not publicly displayed
 ├─ per locale: title, excerpt, slug, body (rich text), cover alt text, SEO title/description
 ├─ shared: format, publication date, featured flag, cover image, category key
 ├─ optional: author (inline fields), related insights (references), service keys, offering keys, CTA label
 └─ derived in Astro: reading time, table of contents, canonical URL, hreflang set, teaser/archive membership
```

### 3.3 Format presentation

| Format | Meaning | Presentation in Astro | Model difference |
| --- | --- | --- | --- |
| `analysis` | Analysis & Perspective | Standard article layout; label from i18n. | None. |
| `guide` | Practical Guide & Framework | Same layout; label from i18n; optional TOC emphasised. | None. |

Guide-specific structures (steps, checklists, framework blocks) are **deferred**. A block-based design would not be translatable (§2), so these must use rich text lists until a translatable structure is verified.

### 3.4 Editorial body

- **Rich text only** in MVP. The body is a single Rich text field, translatable at field level (a Rich text field is not a Blocks field).
- **Allowed elements (recommended):** paragraphs; headings `h2` and `h3`; ordered and unordered lists; bold and italic; links (story or URL, see §5.5); quotes if the Storyblok editor allows them within rich text.
- **Not allowed in MVP:** page-builder layouts, arbitrary embeds, custom components inside rich text. Embedded blocks inside rich text are **unverified** for translation (§2).
- **Images:** the cover image is a field. Inline images in the body are **not** recommended until alt-text handling is verified.
- **Table of contents:** generated in Astro from `h2`/`h3` nodes. Not stored in the CMS.
- **Callouts and quotes as blocks:** deferred (not translatable).

---

## 4. Field and component mapping matrix

Legend. **Scope:** `L` = translatable per locale, `S` = shared across locales, `R` = reference. **Req:** required for public display.

| # | Concept | Proposed Storyblok field (technical name) | Type | Scope | Req | Astro use | Unresolved question |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Internal identity | Story slug (system) | Story slug | S | Yes | Build key only; never public. | Format convention (for example `ins-0001-…`). |
| 2 | Title | `title` | Text | L | Yes for locale | `<h1>`, cards, `<title>` fallback. | None. |
| 3 | Excerpt / summary | `excerpt` | Textarea | L | Yes for locale | Cards, meta description fallback. | Maximum length. Owner decision. |
| 4 | Public slug | `slug` | Text | L | Yes for locale | Public URL segment `/{locale}/insights/{slug}/`. | Native translated slugs vs localized field (see localization record). |
| 5 | Body | `body` | Rich text | L | Yes for locale | Rendered as `RtNode[]` after sanitisation. | Whether the editor can embed blocks inside rich text (unverified). |
| 6 | Format | `format` | Option (Self): `analysis`, `guide` | S | Yes | Label from i18n; presentation variant. | Owner approves the enum. |
| 7 | Publication date | `publication_date` | Date/time | S | Yes for eligibility | Teaser and archive ordering; article date. | Confirm it is not system `first_published_at`. |
| 8 | Featured flag | `featured` | Boolean | S | No | Highlight in archive only (§6.4). | Maximum one featured per locale: not enforceable in Storyblok; Astro build warns. |
| 9 | Cover image | `cover_image` | Asset (Single) | S | No | Card and article hero; Open Graph fallback. | Asset alt handling unverified. |
| 10 | Cover alt text | `cover_alt` | Text | L | Yes when cover exists | `alt` on the image. | Required when image exists: enforced in Astro build. |
| 11 | Category | `category` | Option (Datasource or Self) with stable keys | S | Yes for archive | Label from i18n keyed by value. | Pillars are **proposed, not approved** (§5.1). |
| 12 | Tags | — | — | — | — | **Not in MVP** (§5.2). | Owner decision on tag archives. |
| 13 | Author name | `author_name` | Text | S | No | Byline. | Public profile only; no author accounts. |
| 14 | Author role | `author_role` | Text | L | No | Byline subtitle. | None. |
| 15 | Author bio | `author_bio` | Textarea | L | No | Author block when present. | Privacy review before publication. |
| 16 | Author LinkedIn | `author_linkedin` | Link (URL) | S | No | Optional link. | None. |
| 17 | Related insights | `related_insights` | References (same content type) | S | No | Related list; resolved per locale (§5.4). | Storyblok relation resolution with `resolve_links` (unverified). |
| 18 | Services | `services` | Option (Self) with service keys `{family}/{service}` | S | No | Contextual link to `servicePath`. | Catalog home and key list (§5.6). |
| 19 | Offerings | `offerings` | Option (Self) with keys `{family}/{service}/{offering}` | S | No | Contextual link to `offeringPath`. | Same as 18. |
| 20 | CTA label | `cta_label` | Text | L | No | Localised label for the service CTA. | If empty, use i18n default label. |
| 21 | CTA service | `cta_service` | Option (Self) from the services list | S | No | `ctaPath(locale, service, offering)`. | Must reference a valid service key. |
| 22 | SEO title | `seo_title` | Text | L | No | `<title>`, OG title. | Fallback: `title`. |
| 23 | SEO description | `seo_description` | Textarea | L | No | Meta description, OG description. | Fallback: `excerpt`. |
| 24 | SEO noindex | `seo_noindex` | Boolean | S | No | Robots meta and sitemap exclusion. | Owner guidance on use. |
| 25 | Social image | `seo_image` | Asset (Single) | S | No | OG image. | Fallback: `cover_image`, then site default. |
| 26 | Case study link | `case_studies` | References to case-study content | S | No | Contextual corporate link. | **No case-study content type exists** in the verified sources. Deferred. |
| 27 | Editorial status | — | — | — | — | **Not added.** Use Storyblok publish state (§7). | None. |
| 28 | Scheduling | — | — | — | — | **Not added.** Use `publication_date` for ordering; Storyblok scheduling unverified. | Confirm whether scheduling is needed. |
| 29 | Canonical URL | — | — | — | — | Derived in Astro (BLOG-002-D08 remains valid). | None. |

---

## 5. Relationship contract

### 5.1 Categories

**Options compared.**

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| A. Option field (Self) with stable keys; labels from Astro i18n | No extra content type; labels are translated in the repository's existing i18n files; keys are stable. | Editors cannot rename a category without a code change. | **Recommended for MVP.** |
| B. Option field with Datasource | Editors manage the list in Storyblok. | Datasource entry translation is **unverified**. Labels could diverge from i18n. | Revisit if editors need to manage categories. |
| C. Reference to a `category` content type | Full editorial control; relation integrity. | Overkill for four values; localisation of labels would require the same unverified path as B. | Rejected for MVP. |

**Proposed keys (not approved; must be validated against the service catalog and ARK-BLOG-001 findings):** `strategy-business`, `diagnosis-risk`, `architecture-modernization`, `governance-leadership`.

**Constraint.** Exactly one primary category per insight. Enforced by a single-option field; Astro build fails if the key is not in the approved list.

### 5.2 Tags

**MVP decision: no tags field, no tag archives.** Rationale: tag archive pages are deferred (BLOG-002-D11) and Storyblok native tags are not localised by the verified documentation. A tags field may be added when archive criteria are approved. Storyblok native story tags are **not** used.

### 5.3 Authors

**Options compared.**

| Option | Verdict |
| --- | --- |
| Author fields inline on each insight (§4 rows 13–16) | **Recommended for MVP.** One or few authors; no author pages. Simplest maintenance. |
| Reusable `author` content type referenced by insights | Deferred. Adopt when author pages, multiple authors or shared bios become a requirement. |

Author data is **public editorial content**. It is not a Storyblok role, not a user account and not an application authentication model.

### 5.4 Related insights

- Field `related_insights`: a multi-reference to `insight` stories in the same space.
- The reference points to the story. Under field-level translation (the preferred localisation model), one story serves all locales, so the reference is locale-neutral.
- At build time, Astro renders a related item in locale X **only if** that item has a published version in locale X with required fields (§5.7). No fallback to another language.
- **Unverified:** whether the reference resolves per locale when only some language versions are published. Spike required.

### 5.5 Links in the body

- Story links and URL links are allowed in rich text.
- Story links store `cached_url`, which can go stale. Astro must resolve links at build time using the current `full_slug` for the requested locale, and must not render links whose target has no published version in that locale.
- External URLs are allowed for editorial references. **No free-form CTA URL** is allowed (BLOG-002-D10 remains valid).

### 5.6 Service references and CTAs

**Verified situation.** The corporate catalog hierarchy is documented in `docs/service-catalog-taxonomy.md`. The catalog **data** was read from Hygraph and is no longer in the repository. It is not currently a Storyblok record set either.

**Options compared.**

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| S1. Catalog migrates to Storyblok; insights reference catalog stories | Native integrity. Single source. | Requires a separate catalog migration workstream. Not in scope. | **Target state.** Revisit when the catalog migrates. |
| S2. Stable keys in insights, validated at build against an identity list in code | No dependency on catalog migration; no duplicated descriptions, prices or copy; no invented records. | Keys are maintained in two places until S1. | **Recommended interim.** |
| S3. Free-form URLs | Simple. | Breaks when routes change; no validation. | Rejected. |

**Key format.** `{family}/{service}` and `{family}/{service}/{offering}`. The slugs of families, services and offerings are **not verified** (the taxonomy document lists names only). They must be confirmed from the catalog source before the option list is created.

**Rule.** Insights never store service descriptions, prices or translated service copy. The destination is produced by the existing helpers `servicePath`, `offeringPath` and `ctaPath` in `src/lib/catalog/index.ts`.

### 5.7 Publication eligibility (for relations and listings)

An insight is **eligible** in locale X only if all of the following hold:
1. A published version exists in locale X (per-language publication state; mechanism **unverified**, see §7 risk R-01).
2. `title`, `slug`, `excerpt`, `body` and, if a cover exists, `cover_alt` are present in locale X.
3. `publication_date` is set and is not in the future at build time.
4. `format` and `category` are set.

Eligibility is evaluated in Astro. No fallback to another locale.

---

## 6. Structure of the public experience

### 6.1 Archive

- Route: `/{locale}/insights/` (existing).
- Lists all eligible insights in locale X, ordered by `publication_date` descending, then `slug` ascending as a tie-breaker.
- Optional featured highlight: if one eligible insight has `featured = true`, it is shown as a highlighted card above the list. It does **not** change the order of the remaining items. Maximum one featured per locale; more than one triggers a build warning and the most recent is highlighted.

### 6.2 Article page

- Route: `/{locale}/insights/{slug}/` (existing).
- Shared presentation for both formats; format shown as a label.
- Table of contents from `h2`/`h3` when there are at least two headings.
- Related insights and contextual service CTA rendered only when populated.

### 6.3 Category and tag archives

- **Category archives:** not in MVP. Recommended later only after an approved indexing policy (BLOG-002-D11 remains valid).
- **Tag archives:** not in MVP.

### 6.4 Homepage teaser

Defined in `ark-blog-002-v2-localization-and-teaser.md`.

---

## 7. Publication, preview and permissions assumptions

- **Public delivery:** published content only. The application must never query draft versions for public pages, lists, RSS or sitemap.
- **Editorial states:** use Storyblok's native publish state. **No custom status field.** Draft and review states depend on the configured workflow, which is not verified.
- **Translations:** a locale may be unpublished while another is published. The application must treat that as "no public version" in the unpublished locale.
- **Preview:** governed by ARK-BLOG-007. Preview content must not reach lists, related content, SEO, sitemap or RSS.
- **Roles:** editing roles are Storyblok permissions and are separate from site visitors. No application auth fields are added.

**Risk R-01.** The mechanism to determine per-locale publication status through the API is **unverified**. Without it, the eligibility rule in §5.7 cannot be implemented safely. This is the highest-priority spike.

---

## 8. Migration gap matrix (Hygraph concepts → Storyblok)

| Hygraph concept (v1 model, reference only) | Disposition | Storyblok equivalent | Note |
| --- | --- | --- | --- |
| `id` (stable across locales) | Reuse concept | Story identity + internal key | Story-level identity is natural only under field-level translation. |
| `slug` per locale | Reuse concept | Localised `slug` field (or translated slugs app) | Decision in localization record. |
| `title`, `excerpt` (`exerpt` misspelling in the remote schema) | Reuse concept, fix spelling | `title`, `excerpt` | Do not carry the misspelling. |
| `content` (rich text) | Reuse | `body` (rich text) | Blocks are not used. |
| `featured` | Reuse | `featured` | Archive highlight only. |
| `publishedAt` | Reuse concept | `publication_date` (editorial) | System publish date is not used for ordering (R-02). |
| `updatedAt` | Retire from public logic | System metadata if needed | Not used for ordering or display. |
| `scheduledAt` | Retire or defer | Unverified | Confirm need. |
| `editorialStatus` (`READY`) | Retire | Storyblok publish state + eligibility rules | Per §7. |
| `featuredImage` with `altText`, `caption` | Reuse, change | `cover_image`, `cover_alt` | Alt stored on the insight, not the asset. |
| `author` (name, slug, role, bio, avatar, linkedin, website) | Reuse, simplify | §4 rows 13–16 | No avatar or website in MVP. |
| `categories[]` (multiple) | Change | One `category` option | Contract: one primary category. |
| `tags[]` | Defer | None in MVP | §5.2. |
| `services[]`, `offerings[]` | Reuse concept, change to keys | `services`, `offerings` options | §5.6. |
| `caseStudies[]` | Defer | Future reference | No case-study type. |
| `relatedArticles[]` | Reuse | `related_insights` references | §5.4. |
| `seo` (metaTitle, metaDescription, canonicalUrl, noIndex, ogImage) | Reuse, change | `seo_title`, `seo_description`, `seo_noindex`, `seo_image` | Canonical derived, not stored. |
| Locale-native fields (`locales: [$locale]`, no fallback) | Reuse rule | Per-locale publish state + eligibility | §5.7. |
| Stage (`PUBLISHED`/`DRAFT`) | Reuse concept | Storyblok version (`published` / `draft`) | Preview only in ARK-BLOG-007. |

---

## 9. Decision and risk register

| ID | Decision or risk | Status | Evidence | Recommendation | Owner / action | Downstream impact |
| --- | --- | --- | --- | --- | --- | --- |
| D-A1 | Single `insight` content type for both formats | **Recommended** | §3.1 | Adopt. | Owner approves. | ARK-BLOG-003, 005 |
| D-A2 | Body is Rich text, not Blocks | **Confirmed** (constraint) | Fields page: blocks not translatable | Adopt. | None. | ARK-BLOG-003, 005 |
| D-A3 | Embedded blocks inside rich text | **Unknown** | Not documented | Do not use in MVP. | Spike in space. | ARK-BLOG-005 |
| D-A4 | Category: option with stable keys, labels from i18n | **Recommended** | §5.1 | Adopt. | Owner approves the four proposed keys or replaces them. | ARK-BLOG-005 |
| D-A5 | No tags and no tag archives in MVP | **Recommended** | §5.2 | Defer. | Owner confirms. | ARK-BLOG-006 |
| D-A6 | Authors inline; no author content type | **Recommended** | §5.3 | Adopt. | Owner confirms privacy and author set. | ARK-BLOG-005 |
| D-A7 | Services as stable keys validated at build (S2) | **Recommended** | §5.6 | Adopt interim; S1 later. | Owner confirms catalog home. | ARK-BLOG-003, 008 |
| D-A8 | Catalog home (Storyblok or code) | **Blocked** | Catalog data not in repository | Decide before keys are created. | Owner. | ARK-BLOG-008 |
| D-A9 | Service and offering slugs | **Unknown** | Taxonomy lists names only | Confirm from catalog source. | Owner. | ARK-BLOG-008 |
| D-A10 | No custom editorial status; use publish state | **Recommended** | §7 | Adopt. | None. | ARK-BLOG-007 |
| D-A11 | Publication date is an editorial field, not system metadata | **Recommended** | §4 row 7; R-02 | Adopt. | Owner confirms the field. | ARK-BLOG-004, 005 |
| D-A12 | Asset alt text stored on the insight (`cover_alt`) | **Recommended** | Asset alt undocumented | Adopt. | None. | ARK-BLOG-005 |
| D-A13 | Featured: highlight only; max one per locale | **Recommended** | §6.1 | Adopt. | Owner approves. | ARK-BLOG-005 |
| D-A14 | Case-study references deferred | **Recommended** | No case-study type | Defer. | Owner, later task. | ARK-BLOG-008 |
| R-01 | Per-locale publication status cannot be read safely from the API | **Blocked** | Documentation silent on fallback and per-locale status | Spike before ARK-BLOG-003. | Owner access + engineering spike. | ARK-BLOG-003, 004 |
| R-02 | System publish date may differ from editorial date after re-publication | **Open** | Documentation lists the fields; behaviour not confirmed | Use editorial `publication_date`. | Confirm in space. | ARK-BLOG-004 |
| R-03 | Relations to stories with partial language coverage | **Unknown** | Not documented | Spike; omit unpublished targets. | Spike. | ARK-BLOG-004 |
| R-04 | Plan does not include per-language publishing | **Blocked** | Plan-dependent | Use the separate-stories fallback in the localization record. | Owner confirms plan. | ARK-BLOG-002 re-spec |
| R-05 | Story links go stale | **Recommended** mitigation | `cached_url` captured on save | Resolve links at build; never trust `cached_url` alone. | None. | ARK-BLOG-005 |

---

## 10. Readiness decision for ARK-BLOG-003

**Decision: BLOCKED.**

ARK-BLOG-003 must not start implementation. The integration layer depends on:

1. **Plan confirmation** for per-language publishing (D-11 / R-04).
2. **A spike** that confirms how per-locale publication status and locale selection behave in the real space (R-01, D-12, B2).
3. **The localisation model** approved (D-02 in ARK-BLOG-001 v2; localization record here).
4. **The service catalog home** decided (D-A8) and slugs confirmed (D-A9), at least for the interim key list.
5. **SDK compatibility** with Astro 7.3.5 (B3, from ARK-BLOG-001 v2).

A **read-only schema check** of the content type described in §4 is allowed once the owner grants read access. It must not change the space.

---

## 11. Acceptance criteria check

| # | Criterion | Result |
| --- | --- | --- |
| 1 | ARK-BLOG-001 decision referenced | Passed. |
| 2 | Content model documented with types, fields, relations, rationale | Passed (§3–§5). |
| 3 | `analysis` and `guide` without duplicate schemas | Passed (§3.1, §3.3). |
| 4 | Categories, tags, authors decided or marked as blocked | Passed (§5.1–5.3). Category labels depend on D-A4. |
| 5 | Rich text / block strategy and limits documented with official docs | Passed, with the embedded-block gap marked Unknown (D-A3). |
| 6 | Localization strategy explicit for EN, ES, FR, PT | Passed in companion document. Final choice pending plan (R-04). |
| 7 | Independent publication readiness and missing-translation behaviour defined | Passed (§5.7, §7) in rules; mechanism unverified (R-01). |
| 8 | Homepage teaser contract | Passed in companion document. |
| 9 | Archive, article, optional author and related content covered | Passed (§5.3–5.4, §6). Category and tag archives deferred with rationale. |
| 10 | Service relations reuse the catalog | Passed by rule (§5.6). Catalog home undecided (D-A8). |
| 11 | Public content, draft and preview assumptions explicit | Passed (§7). |
| 12 | Hygraph schema assessed without copying | Passed (§8). |
| 13 | Unresolved decisions and risks listed with impact | Passed (§9). |
| 14 | Field/component mapping matrix | Passed (§4). |
| 15 | Readiness decision for ARK-BLOG-003 | Passed: **Blocked** (§10). |

---

## 12. Validation (this document)

Architecture and document checks only; no application code changed.

- Every field in §4 is marked as documented, unverified or unknown. Fields described as "documented" are those with a verified source in §2.
- Locale codes `en`, `es`, `pt`, `fr` come from `src/i18n/config.ts`, not from display labels.
- The model expresses both formats with one type.
- The teaser and archive do not depend on a separate manually maintained list (§6, companion document).
- Service references are keys, not copies (§5.6).
- Missing or unpublished translations are excluded by rule (§5.7); the rule cannot be tested without space access (R-01).
- Draft and preview content are excluded from public delivery (§7).

**Not performed (requires Storyblok space access):** field existence and types in a real space; per-locale publication status; GraphQL locale semantics; embedded-block translation; asset alt handling; system date fields.
