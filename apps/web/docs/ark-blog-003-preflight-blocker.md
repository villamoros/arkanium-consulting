# ARK-BLOG-003 — Preflight Blocker Report

> **Obsoleto en lo referido a CMS (2026-10-14):** el proyecto migra de Hygraph a Storyblok. Las suposiciones de Hygraph de este documento ya no aplican. Ver [ark-blog-001-v2-cms-migration-decision.md](ark-blog-001-v2-cms-migration-decision.md).

**Status:** Blocked before implementation.  
**Date:** 2026-10-09.  
**Method:** read-only GraphQL schema introspection against the configured Hygraph Content API. No content, model, permission, locale, role, or application change was made.

## Prerequisite review

ARK-BLOG-001 deliverables exist under `docs/ark-blog-001-*.md`. ARK-BLOG-002 deliverables exist under `docs/ark-blog-002-*.md`. ARK-BLOG-002 marks schema mapping, locale publication semantics, and the required editorial `format` field as unresolved prerequisites.

## Confirmed remote schema evidence

The Content API permits schema introspection. The following remote facts were verified without reading or changing editorial entries:

| Requirement / current repository contract | Remote schema evidence | Result |
| --- | --- | --- |
| Four public locales: `en`, `es`, `pt`, `fr` | `Locale` enum exposes only `en`. | **Blocker** — no four-language integration is possible. |
| Shared Article identity/title/slug/excerpt/body | `Article` exposes `id`, `title`, `slug`, `exerpt`, and `richText`. | Partial — current Astro query expects `excerpt` and `content`; spelling and Rich Text shape differ. |
| Editorial format | No `format` field or matching format enum was exposed on `Article`. | **Blocker** — required `analysis`/`guide` mapping has no confirmed source. |
| Public workflow gate | `Stage` exposes `DRAFT` and `PUBLISHED`; Article exposes publication timestamps. No current `editorialStatus` field was exposed. | Partial — current code’s `READY` gate cannot be mapped. |
| Author profile | `Author` exposes only `id`, `name`, and `slug` among public profile concepts. | Partial — no verified role, bio, avatar, LinkedIn, or website fields. |
| Category/tag contract | `Category` exposes `id`, `name`, `slug`; `Tag` exposes `id`, `name`, `slug`. Article exposes relations named `categories`, `tags`, `author`. | Partial — relationship cardinality/localization configuration is not established. |
| Service/offering references | No `services` or `offerings` Article fields were exposed. | **Blocker** for the approved contextual service/offerings contract. |
| Related insights/case studies | No `relatedArticles` or `caseStudies` Article fields were exposed. | Partial/Missing — current integrations cannot be mapped unchanged. |
| SEO contract | A remote `Seo` model exists, but its fields are `title`, `description`, `noIndex`, and `image`; Article did not expose an `seo` field in schema introspection. | Partial — existing query expects `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`, and Article relation `seo`. |
| Cover image metadata | Article did not expose `featuredImage`; schema evidence did not establish the required asset alt/caption path. | **Blocker** for current image mapping. |

## Go/no-go result

**No-go.** ARK-BLOG-003 requires an integration layer matching the approved ARK-BLOG-002 contract. Implementing against the confirmed remote schema would require changing the contractual field mapping, weakening four-language/publication guarantees, or inventing unsupported fields. Each outcome is prohibited by the task specification.

The repository’s existing integration code (`src/lib/hygraph/queries/articles.ts`, `src/lib/insights/`) targets a richer Article schema than the remote API currently exposes. It cannot be validated against this API as-is and must not be modified in this task to silently adapt to a materially different model.

## Required resolution before retrying ARK-BLOG-003

One of the following must be approved:

1. **Align Hygraph to the ARK-BLOG-002 contract:** configure the four locales and the approved Article fields/relations (`format`, localized excerpt/body, image metadata, SEO relation, service/offering and related-content relationships, and the selected publication workflow). This is a remote CMS change outside ARK-BLOG-003.
2. **Revise ARK-BLOG-002:** explicitly approve a reduced editorial contract based on the confirmed remote schema, including a new decision on localization, format, content fields, service links, SEO and publishing semantics.

After either path, provide confirmation of field localization, relation cardinality, published-read permissions, and the precise public publication/translation behavior. Then the task can safely implement/test a minimal data-access boundary using the existing environment-variable convention (`HYGRAPH_ENDPOINT`, optional `HYGRAPH_TOKEN`, `CATALOG_SOURCE`).

## Files changed

Only this blocker report was created. No application code, dependency, environment file, CMS configuration, permission, locale, or content entry was changed.
