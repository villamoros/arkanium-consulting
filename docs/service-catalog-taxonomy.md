# Service catalog taxonomy

> **Obsoleto en lo referido a CMS (2026-10-14):** el proyecto migra de Hygraph a Storyblok. Las suposiciones de Hygraph de este documento ya no aplican. Ver [ark-blog-001-v2-cms-migration-decision.md](ark-blog-001-v2-cms-migration-decision.md).

**Alcance vigente (2026-10-14):** solo se ofertan 42 servicios en Strategy, Product y Architecture. Engineering y Managed Services quedan fuera hasta nueva decisión, y no se muestran como «próximamente». El contenido vive en `content/services/` (ver `content/README.md`).

La jerarquía de abajo sigue siendo el modelo de referencia. `ServiceFamily → ServiceCategory → Service → Offering` is the only public navigation and URL model.

```text
Consulting
├── Strategy
│   ├── Technology Diagnosis
│   ├── Digital Strategy
│   ├── Technology Strategy
│   └── IT Roadmapping
├── Product
│   ├── Product Discovery
│   ├── Product Definition
│   ├── MVP Strategy
│   └── Product Management
└── Architecture
    ├── Architecture Consulting
    ├── Technology Governance
    └── Technology Leadership

Engineering
├── Software
│   ├── Software Development
│   ├── Software Modernization
│   ├── Software Integration
│   └── Engineering Teams
├── AI
├── Cloud
└── Security

Managed Services
├── Operations
├── Support
├── QA
└── Continuous Development
```

Populate each Service with published content and zero or more complete Offerings. The site generates routes automatically:

`/{locale}/solutions/{family}/{service}/{offering}/`

Do not add “coming soon” labels to the menu. A service with no approved content should remain absent from the Content API’s published response rather than appear as an unfinished public destination.
