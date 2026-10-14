/**
 * Traducciones — English.
 * `en` es el esquema base: los demás idiomas deben cumplir TranslationSchema.
 * Sistema i18n ≠ CMS: aquí vive navegación, UI, CTAs y contenido estático temporal.
 * TODO(contenido): validar/aprobar las métricas del Hero (97.8%, 4, 0) antes de publicar.
 */

export const en = {
  meta: {
    title: "Arkanium Consulting | Software Architecture & Digital Infrastructure",
    description: "Arkanium Consulting helps growing businesses modernize legacy systems, reduce technical risk, and build scalable digital infrastructure.",
  },
  ui: {
    skipToContent: "Skip to content",
    homeLabel: "Arkanium Consulting — home",
    backToTop: "Arkanium Consulting — back to top",
    primaryNav: "Primary navigation",
    footerNav: "Footer navigation",
    menuOpen: "Open navigation menu",
    menuClose: "Close navigation menu",
    changeLanguage: "Change language",
    newTab: "opens in a new tab",
    primaryActions: "Primary actions",
    serviceMetrics: "Service metrics",
    logoAlt: "Arkanium Consulting",
    assessmentSteps: "What happens after you reach out",
    processPhases: "Process phases",
    serviceLines: "Service lines",
    aboutCarousel: {
      label: "About Arkanium",
      controls: "About carousel controls",
      prev: "Previous about card",
      next: "Next about card",
      dots: "Select about card",
      dotLabel: "Go to card",
    },
    servicesCarousel: {
      label: "Services",
      controls: "Carousel controls",
      prev: "Previous service",
      next: "Next service",
      dots: "Select service",
      dotLabel: "Go to service",
    },
  },
  navigation: {
    about: "Who We Are",
    problem: "Challenges",
    solutions: "Solutions",
    allSolutions: "View all solutions",
    process: "How We Work",
    why: "Why Arkanium",
    cases: "Case Studies",
    faq: "Insights",
    login: "Log in",
  },
  solutionsPage: {
    eyebrow: "Solutions",
    title: "Solutions",
    intro: "Focused engagements grouped into a coherent portfolio for companies that need clarity, technical depth, and execution discipline.",
    breadcrumb: "Breadcrumb",
    comingSoon: "Coming soon",
    explore: "Explore",
    problem: "The problem",
    whatWeDo: "What we do",
    approach: "How we approach it",
    outcomes: "Outcomes",
    deliverables: "Deliverables",
    engagementOptions: "Engagement options",
    faq: "FAQ",
    related: "Related services",
    ctaHeading: "Start a conversation",
    ctaDefault: "Discuss this service",
    duration: "Duration",
    engagement: "Engagement",
    investment: "Investment",
    from: "From",
    contactForPricing: "Contact us for pricing",
    engagementTypes: {
      fixedScope: "Fixed scope",
      project: "Project",
      retainer: "Retainer",
    },
  },
  hero: {
    eyebrow: "Digital infrastructure consulting",
    title: "Engineering the Infrastructure of Modern Business",
    lede: "We help growing companies modernize legacy systems, reduce technical risk, and build scalable digital infrastructure.",
    ctaPrimary: "Book an architecture assessment",
    ctaSecondary: "Explore services",
    metrics: [
      {
        value: "97.8%",
        label: "System integrity post-modernization",
      },
      {
        value: "4",
        label: "Structured modernization phases",
      },
      {
        value: "0",
        label: "Generic playbooks — every case is unique",
      },
    ],
  },
  about: {
    eyebrow: "Who We Are",
    title: "Technology leadership for organizations that need to scale with confidence.",
    intro: "Arkanium Consulting is a boutique firm specializing in technology strategy, software architecture, and engineering governance.",
    cardLabel: "Focus",
    cards: [
      {
        kicker: "Who we are",
        title: "A boutique technology strategy firm",
        body: "We help founders, executives, and technical teams turn complex systems into strategic capabilities that support business growth.",
      },
      {
        kicker: "What we do",
        title: "We turn technological complexity into executable direction",
        body: "We assess architectures, identify risks, design modernization strategies, and provide technology leadership for organizations that need to make critical decisions with greater clarity.",
      },
      {
        kicker: "How we work",
        title: "Structured methodologies. Actionable outcomes.",
        body: "Every engagement follows proprietary frameworks designed to generate visibility, alignment, and execution capacity. Each initiative produces clear diagnostics, prioritized recommendations, executable roadmaps, governance metrics, and defined next steps.",
      },
      {
        kicker: "Our approach",
        title: "We do not sell hours. We apply methodology.",
        body: "Arkanium operates through ASTM, the Arkanium Strategic Transformation Methodology, a proprietary system designed to assess, modernize, govern, and lead technology ecosystems.",
      },
    ],
  },
  challenges: {
    eyebrow: "Operational reality",
    title: "Growth Exposes Weak Systems",
    intro: "When business growth outpaces software architecture, companies need engineering leadership, not more developers.",
    items: [
      {
        title: "Fragile Deployments",
        body: "Release cycles become slower, riskier, and harder to coordinate with the business.",
      },
      {
        title: "Technical Debt",
        body: "Past decisions compound into maintenance friction that slows every new delivery.",
      },
      {
        title: "Scaling Bottlenecks",
        body: "Performance, data flow, and infrastructure limits begin to drive business decisions.",
      },
      {
        title: "Knowledge Silos",
        body: "Critical systems depend on undocumented context and a few overloaded people.",
      },
    ],
  },
  solutions: {
    eyebrow: "Business lines",
    groupTitle: "Consulting",
    title: "STRATEGY, ARCHITECTURE, GOVERNANCE, AND LEADERSHIP",
    intro: "Focused engagements grouped into a coherent portfolio for companies that need clarity, technical depth, and execution discipline.",
    lines: {
      strategy: {
        title: "Strategy",
        body: "We turn technical uncertainty into a prioritized direction that leaders can use to decide what to change, why, and in what order.",
      },
      architecture: {
        title: "Architecture",
        body: "We design practical target architectures and modernization paths that improve resilience, maintainability, and the capacity to scale.",
      },
      governance: {
        title: "Governance",
        body: "We define standards, decision rights, and oversight mechanisms so technology decisions remain consistent and risks stay visible.",
      },
      leadership: {
        title: "Leadership",
        body: "We guide executives and engineering teams with clear technical direction, priorities, and support for executing technology strategy.",
      },
    },
    labels: {
      engagement: "Engagement",
      investment: "Investment",
      problem: "Problem",
      solution: "Solution",
      outcome: "Outcome",
    },
  },
  process: {
    eyebrow: "Arkanium Framework",
    title: "Diagnose. Architect. Modernize. Scale.",
    intro: "A practical path from system chaos to durable digital infrastructure.",
    phases: {
      assess: {
        label: "Assess",
        kicker: "Phase 01",
        title: "Assess",
        body: "Understand the business, systems, risks, and constraints.",
        items: [
          "Architecture Review",
          "Technical Risk Assessment",
          "Executive Findings Report",
        ],
      },
      architect: {
        label: "Architect",
        kicker: "Phase 02",
        title: "Architect",
        body: "Design the future state of the system.",
        items: [
          "Target Architecture",
          "Modernization Plan",
          "Prioritization Framework",
        ],
      },
      modernize: {
        label: "Modernize",
        kicker: "Phase 03",
        title: "Modernize",
        body: "Guide implementation and system transformation.",
        items: ["Strategic Oversight", "Architecture Governance", "Risk Reduction"],
      },
      scale: {
        label: "Scale",
        kicker: "Phase 04",
        title: "Scale",
        body: "Support sustainable business growth.",
        items: ["Leadership Support", "Architecture Reviews", "Continuous Guidance"],
      },
    },
  },
  why: {
    eyebrow: "Why Arkanium",
    title: "Engineering Leadership Beyond Software Development",
    items: [
      {
        title: "Business-First Thinking",
        body: "Every technical decision is tied to risk, scalability, and business continuity — not stack preferences.",
      },
      {
        title: "Infrastructure Mindset",
        body: "Systems are treated as operational foundations, not isolated features. Every decision considers long-term production impact.",
      },
      {
        title: "Executive-Level Guidance",
        body: "We communicate technical state in terms leadership can evaluate and act on with confidence.",
      },
      {
        title: "Scalable Architecture",
        body: "We design structures that support future growth without accumulating new technical debt in the process.",
      },
      {
        title: "Long-Term Maintainability",
        body: "Modernization choices are designed to stay maintainable after the engagement ends.",
      },
      {
        title: "Technology Decision Support",
        body: "We help evaluate options, vendors, and architectures with aligned technical and business criteria.",
      },
    ],
    gain: {
      eyebrow: "What Leaders Gain",
      items: [
        "Greater visibility into technical risk",
        "Clear modernization priorities",
        "More predictable delivery outcomes",
        "Better alignment between technology and business goals",
        "Increased confidence in strategic decisions",
      ],
    },
  },
  caseStudies: {
    eyebrow: "Case Studies",
    title: "Case Studies",
    titleRepresentative: "Representative Projects",
    representativeNote: "Representative projects are scenarios that illustrate how we approach this type of problem. They do not describe an engagement with a specific client, and the outcomes listed are expected, not achieved.",
    anonymizedNote: "Anonymized engagement: a real engagement for a client that cannot be identified publicly.",
    empty: "No case studies have been published yet.",
    viewAll: "View all case studies",
    readMore: "Read case study",
    badges: {
      real: "Case study",
      representative: "Representative project",
      anonymized: "Anonymized engagement",
    },
    groups: {
      featured: "Featured",
      real: "Real engagements",
      representative: "Representative projects",
      anonymized: "Anonymized engagements",
    },
    meta: {
      industry: "Industry",
      client: "Client",
      timeline: "Timeline",
      services: "Services",
      offerings: "Offerings",
      technologies: "Technologies",
    },
    labels: {
      challenge: "Challenge",
      approach: "Approach",
      solution: "Solution",
      deliverables: "Deliverables",
      outcome: "Outcome",
      outcomeExpected: "Expected outcomes",
      metrics: "Metrics",
      source: "Source",
      related: "Related case studies",
    },
    phases: {
      ASSESSMENT: "Assessment",
      STRATEGY: "Strategy",
      ARCHITECTURE: "Architecture",
      IMPLEMENTATION: "Implementation",
      GOVERNANCE: "Governance",
    },
  },
  insights: {
    eyebrow: "Insights",
    title: "Latest Insights",
    comingSoon: "Coming soon",
    viewAll: "View all insights",
    readMore: "Read article",
    minRead: "{minutes} min read",
    updated: "Updated",
    featured: "Featured",
    latest: "Latest articles",
    empty: "No articles have been published yet.",
    relatedArticles: "You may also be interested in…",
    relatedServices: "Related services",
    aboutAuthor: "About the author",
    tags: "Tags",
    by: "By",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Straight Answers",
    items: [
      {
        question: "What types of companies do you work with?",
        answer: "We work with B2B companies in growth stage, SaaS with accumulated technical debt, companies running critical legacy systems, and organizations that need architecture leadership before scaling.",
      },
      {
        question: "Do you provide software development?",
        answer: "No. Arkanium does not sell developers or deliver code. We provide engineering leadership, technical strategy, and architectural oversight. We work alongside the client's existing teams.",
      },
      {
        question: "How long does an Architecture Assessment take?",
        answer: "Typically 2 to 4 weeks depending on system complexity. At the end, the client receives an executive report with prioritized risks and an actionable modernization plan.",
      },
      {
        question: "Do you replace an internal CTO?",
        answer: "No. The Fractional CTO service complements and strengthens existing technical leadership. In companies without a CTO, it acts as that function until a full-time hire makes sense.",
      },
      {
        question: "Can you work alongside existing engineering teams?",
        answer: "Yes, that is the standard. We work directly with internal teams — we don't replace them. The goal is to strengthen their capability and transfer knowledge.",
      },
      {
        question: "Do you support implementation after the assessment?",
        answer: "Yes. We can accompany execution through the Fractional CTO service or specific architectural oversight engagements during modernization.",
      },
      {
        question: "What industries do you specialize in?",
        answer: "We work with B2B companies regardless of sector. The common denominator is the problem: legacy systems slowing growth, technical debt accumulating operational risk, and architecture that does not scale.",
      },
    ],
  },
  cta: {
    eyebrow: "Start with clarity",
    title: "Your Software Should Accelerate Growth. Not Limit It.",
    intro: "Start with an Architecture Assessment and turn technical uncertainty into an actionable modernization plan.",
    steps: [
      "You'll receive a response within 24 business hours.",
      "We schedule a 30-minute call to understand your context.",
      "Together we define scope and concrete next steps.",
    ],
    form: {
      kicker: "Next step",
      title: "Book an assessment",
      successTitle: "Request received.",
      successBody: "We'll review your message and get back to you within 24 business hours.",
      nameLabel: "Name",
      emailLabel: "Business email",
      priorityLabel: "What is your immediate priority?",
      priorities: {
        assessment: "Architecture assessment",
        modernization: "Legacy modernization",
        cto: "Fractional CTO",
        governance: "Engineering Governance",
        unsure: "Not sure — I want to explore options",
      },
      contextLabel: "Briefly describe your problem (optional)",
      submit: "Book a free assessment",
      note: "No commitment. The first conversation is to understand if we can help.",
      errors: {
        name: "Please enter your name.",
        email: "Please enter a valid email address.",
      },
    },
  },
  footer: {
    tagline: "Engineering the digital infrastructure behind modern business growth.",
    copyright: "Arkanium Consulting. All rights reserved.",
    lines: {
      label: "Business lines",
    },
    company: {
      label: "Company",
      framework: "Framework",
      why: "Why Arkanium",
      contact: "Contact",
    },
    connect: {
      label: "Connect",
      linkedin: "LinkedIn",
      X: "X",
      instagram: "Instagram",
      facebook: "Facebook",
      tiktok: "TikTok",
    },
    legal: {
      label: "Legal",
      privacy: "Privacy policy",
      terms: "Terms of use",
      cookies: "Cookies policy",
      disclaimer: "Disclaimer",
    },
  },
};

export type TranslationSchema = typeof en;
