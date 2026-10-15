# ARK-BLOG-001 v2 — CMS Migration Decision Record

**Decision under assessment:** Replace the planned Hygraph integration with Storyblok as the editorial CMS.
**Date:** 2026-10-14.
**Companion:** [`ark-blog-001-v2-architecture-assessment.md`](ark-blog-001-v2-architecture-assessment.md) (evidence, impact matrix, next steps).

---

## 1. Recommendation

**Proceed after blockers.**

- **Storyblok is an acceptable target** for the Insights workstream. Its documented capabilities cover the core needs: a GraphQL and REST delivery API, field-level translation, optional per-language publishing, a webhook for static rebuilds, and an official Astro SDK.
- **Implementation is not authorised yet.** Four facts that the decision depends on are unverified: the owner's plan features, the locale and version semantics of the GraphQL API, the compatibility of the Storyblok SDK with Astro 7.3.5, and the hosting provider. Writing an adapter before those are known would mean guessing.
- **Preparatory work is authorised:** owner verification (§5), the decision register (§6), and a branch-only SDK spike once the owner confirms the space.

**Go/no-go: NO-GO for ARK-BLOG-003 implementation now. GO for owner verification and the spike.**

**Confidence: medium.** The direction is well supported by documentation. The specific fit depends on account facts not yet available.

---

## 2. Options

| Option | Description | Evaluation | Verdict |
| --- | --- | --- | --- |
| **A.** Proceed with Storyblok now; treat Hygraph as legacy. | Start ARK-BLOG-002 and 003 against Storyblok immediately. | Plan features (per-language publishing, Dimensions, Translatable Slugs) and GraphQL locale semantics are unknown. The design of the body field, the locale model and the preview path all depend on them. Proceeding would require inventing those facts. | **Rejected for now.** |
| **B.** Defer migration until blockers are resolved; keep Storyblok as the target. | Owner verifies the space and plan, host is chosen, spike runs on a branch, then ARK-BLOG-002 is re-specified. | Uses the existing work (Insights UI, SEO, sanitiser, publication gate). Only blocks the data-access adapter and preview. Consistent with the contract's "decide with evidence". | **Recommended.** |
| **C.** Retain Hygraph. | Reconnect Hygraph and continue ARK-BLOG-003 as originally planned. | The previous blocker report (`ark-blog-003-preflight-blocker.md`) recorded a remote schema that lacked the approved Article contract: one locale, no `format`, no service or offering relations, no asset metadata path. Those gaps are not resolved by any evidence in this assessment. No verified requirement makes Storyblok an inferior fit. | **Not recommended on current evidence.** Revisit only if the owner confirms Hygraph's schema can be aligned. |

---

## 3. Evidence supporting the recommendation

Documentation facts, from official Storyblok pages read on 2026-10-14. Each is described in more detail in the assessment §4–5.

- **SDK:** `@storyblok/astro` v8.x, Astro ≥3.0, Node 22 LTS recommended.
- **Localization:** field-level translation per story, but **Blocks fields cannot be translated**. Publishing all languages together is the default; per-language publishing is opt-in.
- **Delivery:** GraphQL and REST with a `language` parameter (REST documented; GraphQL not confirmed). REST `per_page` max 100. GraphQL uses 100 points per second.
- **Preview:** draft content is fetched with a preview token. Preview is documented for **client-side or server-side rendering**, not static output.
- **Publishing:** a webhook on "Story published & unpublished" triggers a rebuild in static mode.

Repository facts, from the assessment §2: static output, four locales with no English fallback for articles, no Clerk, no analytics, no hosting configuration, Insights components and publication gate already present.

---

## 4. Assumptions and unresolved blockers

### Assumptions (not verified)
- The owner's plan includes Storyblok's Content Delivery API for the four locales.
- A Storyblok space exists or will be created by the owner, in the EU or another region.
- The Storyblok SDK can be installed with Astro 7.3.5. Not tested.
- A static production build with a webhook to a deploy hook is acceptable for the owner's host.

### Blockers (must be resolved before ARK-BLOG-003)

| # | Blocker | Why it blocks | Owner action |
| --- | --- | --- | --- |
| B1 | Plan features: individual language publishing, Translatable Slugs, Dimensions. | Decides the localization model and the no-fallback rule. | Confirm in Settings → Internationalization and the Apps list. |
| B2 | GraphQL locale and version semantics. | The adapter queries by locale and draft or published. | Spike against the real space, or owner confirmation from Storyblok support. |
| B3 | SDK compatibility with Astro 7.3.5. | Integration cannot be built on an unverified combination. | Branch-only install spike (later task; dependency installation is out of scope here). |
| B4 | Hosting provider and preview deployment. | Webhook target, preview deployment and token handling depend on it. | Owner confirms host; confirms a server-rendered preview deployment is acceptable. |
| B5 | Canonical ARK-BLOG task list. | The impact matrix and task scope depend on it. | Owner confirms the numbering (D-07). |

---

## 5. Required owner verification (outside the repository)

1. Storyblok space: region, plan, and whether individual language publishing, Translatable Slugs and Dimensions are available.
2. Read-only build-time token (published scope) and separate preview token. Store in the host's secret manager. Never in the repository, never in browser code.
3. Host and deployment: provider, deploy hook for webhook, and preview deployment approach.
4. Revocation of the Hygraph token that was in `.env.example`, and a decision on the Hygraph workspace (§8).

---

## 6. Decision register

Status values: **Confirmed** (evidence sufficient), **Recommended** (evidence supports; owner approval pending), **Open** (owner decision needed), **Blocked** (depends on external verification).

| ID | Decision | Status | Evidence | Recommendation | Owner / action |
| --- | --- | --- | --- | --- | --- |
| D-01 | Target CMS is Storyblok. | **Recommended** | Official docs (assessment §4); repository static model. | Proceed as target; implementation after blockers. | Owner approves in principle. |
| D-02 | Localization model: field-level in one story vs separate localised stories with explicit relation. | **Blocked** (B1) | Official i18n docs: translation per field; per-language publishing opt-in; Dimensions and Translatable Slugs plan-dependent. | If independent language publishing is available: one story with field-level translation and a Rich Text body. If not: separate localised stories linked by a relation field. | Owner confirms plan (B1). |
| D-03 | Article body must be a Rich Text field, not Blocks. | **Confirmed** (constraint); design choice **Recommended** | Official docs: Blocks fields cannot be translated individually. | Use Rich Text for the localised body. | Owner accepts in ARK-BLOG-002. |
| D-04 | Draft preview requires a server-rendered route separate from the static production build. | **Blocked** (B4) | Visual Preview guidance: preview in SSR or client-side rendering; repo is `output: 'static'`. | Protected SSR preview route with a preview token kept server-side; production stays static. | Owner approves the approach after host decision. |
| D-05 | Publishing: webhook to deploy hook triggers a static rebuild. | **Blocked** (B4) | Astro guide: webhook needed for static builds. | Use the host's deploy hook. | Owner confirms host. |
| D-06 | Homepage teaser ordering: current code sorts featured first, then date. | **Open** | `src/lib/insights/normalize.ts` `byPriority`; contract requires "most recent". | Teaser uses publication date only, descending. Featured articles get their own explicit slot or archive ordering. | Owner decides. |
| D-07 | Canonical ARK-BLOG task numbering. | **Open** (B5) | Two documents disagree on 006–009 (assessment §9). | Adopt the ARK-BLOG-002 numbering for 004–007 and confirm 008–009 with the owner. | Owner confirms. |
| D-08 | Teaser behaviour on CMS failure: fail the build, or degrade only the teaser. | **Open** | Current loader (before removal) threw and failed the build; contract requires graceful degradation for the teaser. | Teaser degrades to the empty state with a build warning; the archive and article pages still fail closed so no stale content is published. | Owner approves. |
| D-09 | Hygraph token in `.env.example` must be revoked. | **Confirmed** | File contained a full token; removed from repository in this session. | Revoke immediately. | Owner. |
| D-10 | Hygraph workspace: archive, delete, or keep read-only. | **Open** | No remote inspection was performed. Previous blocker report recorded an incomplete schema. | Archive after content inventory; do not delete until the owner confirms no content is needed. | Owner decides. |
| D-11 | Storyblok plan features (per-language publishing, Dimensions, Translatable Slugs). | **Blocked** (B1) | Official docs: plan-dependent. | Confirm before ARK-BLOG-002. | Owner. |
| D-12 | GraphQL locale and draft/published arguments. | **Blocked** (B2) | Official GraphQL page did not state the locale argument; REST uses `language` and `version`. | Spike; prefer REST if GraphQL semantics cannot be confirmed. | Engineering spike after owner access. |
| D-13 | Sign-in entry: placeholder `/login/` now, Clerk later. | **Confirmed** | Owner instruction in this session. No Clerk code present. | Keep the placeholder; ARK-AUTH-001 and ARK-WEB-008 own the rest. | Owner. |
| D-14 | Header Insights item links to `/#insights`. | **Confirmed** | Owner instruction in this session. | Keep. | None. |
| D-15 | Footer Insights link appears even when no articles exist. | **Open** | `PageLayout.astro` passes Insights unconditionally. | Show the footer link only when there are published articles. | Owner approves. |
| D-16 | Teaser "View more" copy. Contract says "Ver más / View more"; current copy is "Ver todos los artículos / View all insights". | **Open** | `src/i18n/*.ts` `viewAll`. | Use contract wording in all four locales, approved by the owner. | Owner approves copy. |
| D-17 | Destination for CTA form submissions. | **Open** | No endpoint or network call in `CTA.astro`. | Choose an inquiry destination before any form goes live. | Owner. |
| D-18 | Analytics and consent provider. | **Open** | None present (legal page only). | Out of scope for ARK-BLOG-001. | Owner, later task. |
| D-19 | `test:seo` expectation vs site name. | **Open** | Test expects "Arkanium Consulting"; constant is "Arkanium Consulting LLC, New Mexico - USA". | Decide the canonical site name and align the test or the constant. | Owner. |

---

## 7. Reusable work, re-specification and CMS-independent work

### Reusable with amendments
- Astro static routing, locale prefixes, trailing slash, redirects, sitemap and hreflang hook.
- BaseLayout SEO, RSS and robots.
- Insights components, Rich Text sanitiser, reading-time, publication gate and its tests (`test:insights`).
- Case-study integrity rules and tests (`test:integrity`) where the case-study model is retained.
- Design system, navigation and responsive behaviour.

### Must be re-specified
- **ARK-BLOG-002:** Article field names, `format` enum (`analysis`, `guide`), body type (Rich Text), localisation model (D-02), locale-independent publication rule, SEO field mapping.
- **ARK-BLOG-003:** the data-access adapter. Build on the existing loaders, which return empty data today, with Storyblok field names.
- **ARK-BLOG-004:** translated slugs and alternates (depends on D-02).
- **ARK-BLOG-007:** preview route (D-04) and publishing lifecycle (D-05).

### CMS-independent (proceed when their own prerequisites are met)
- ARK-BLOG-005 (editorial UI): amend for the final field set.
- ARK-BLOG-006 (SEO, or category archives per the proposal): SEO metadata mapping depends on Storyblok SEO fields; archive decisions depend on D-07.
- ARK-BLOG-008 and 009 (deployment and publishing automation): host-dependent (D-05).

---

## 8. Hygraph assets: decisions required

| Asset | Current state | Decision |
| --- | --- | --- |
| Client, queries, source resolution, fixtures, mock server | Deleted from the repository in this session. | Done. No migration path kept. |
| `.env.example` token | Removed from file. Still valid remotely. | **Revoke (D-09).** |
| Hygraph content (catalog, case studies, articles) | Not inspected. Previous fixtures deleted without backup at owner's direction. | Owner inventories content before archive or deletion (D-10). |
| Hygraph schema and roles | Not inspected in this task. | Owner records them before archive. |
| ARK-BLOG-002 and 003 documents, `ark-blog-001-*.md` | Still mention Hygraph. | Superseded by this v2 set; banners added (see §9). |

---

## 9. Banners on superseded documents

A one-line banner was added to the top of the following documents, to mark their CMS-specific statements as obsolete. Their history is retained.

- `docs/ark-blog-001-architecture-assessment.md`
- `docs/ark-blog-001-gap-decision-register.md`
- `docs/ark-blog-001-integration-contract-proposal.md`
- `docs/ark-blog-002-decision-register.md`
- `docs/ark-blog-002-editorial-domain-content-model.md`
- `docs/ark-blog-003-preflight-blocker.md`
- `docs/service-catalog-taxonomy.md` (line updated earlier, banner added)

---

## 10. Go/no-go record

| Gate | Result |
| --- | --- |
| Repository instructions inspected | Passed. None found. |
| Working tree preserved | Not verifiable (not a git repository). Recorded as a limitation. |
| Official Storyblok documentation consulted | Passed, with gaps recorded as Unknown. |
| Storyblok account evidence | **Not available.** |
| Localization trade-offs captured | Passed. |
| Homepage teaser requirement documented | Passed. Open decisions D-06, D-08, D-16. |
| Clerk dependency recognised as separate | Passed. |
| Impact on prior tasks classified | Passed (assessment §9). Numbering conflict open (D-07). |
| Blockers listed with owners | Passed (§4, §5). |
| **Final decision** | **Proceed after blockers. NO-GO for implementation now; GO for owner verification and spike.** |
