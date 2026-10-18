/**
 * Agentes especialistas de los departamentos operativos (ARK-ARCH-003, sección 3). Son 42:
 * Arquitectura 13, Estrategia 14 y Producto 15. Ninguno opera todavía: aquí solo se definen.
 */
export const AGENT_DEPARTMENTS = [
  { id: 'arquitectura', name: 'Arquitectura' },
  { id: 'estrategia', name: 'Estrategia' },
  { id: 'producto', name: 'Producto' },
] as const;

export type AgentDepartmentId = (typeof AGENT_DEPARTMENTS)[number]['id'];

export interface AgentSpec {
  code: string;
  name: string;
  service: string;
  department: AgentDepartmentId;
}

export const AGENT_CATALOG: AgentSpec[] = [
  // Arquitectura · consultoría de arquitectura
  { code: 'evaluacion-arquitectura', name: 'Agente de evaluación de arquitectura', service: 'Evaluación de arquitectura', department: 'arquitectura' },
  { code: 'hoja-ruta-modernizacion', name: 'Agente de hoja de ruta de modernización', service: 'Hoja de ruta de modernización de arquitectura', department: 'arquitectura' },
  { code: 'diseno-arquitectura-solucion', name: 'Agente de diseño de arquitectura de solución', service: 'Diseño de arquitectura de solución', department: 'arquitectura' },
  { code: 'due-diligence-tecnica', name: 'Agente de due diligence técnica', service: 'Due diligence técnica', department: 'arquitectura' },
  { code: 'arquitecto-fraccional', name: 'Agente de arquitecto fraccional', service: 'Arquitecto fraccional', department: 'arquitectura' },
  // Arquitectura · gobierno tecnológico
  { code: 'comite-arquitectura', name: 'Agente de comité de arquitectura', service: 'Comité de revisión de arquitectura', department: 'arquitectura' },
  { code: 'marco-gobierno', name: 'Agente de marco de gobierno', service: 'Diseño del marco de gobierno', department: 'arquitectura' },
  { code: 'retainer-gobierno', name: 'Agente de retainer de gobierno', service: 'Retainer de gobierno', department: 'arquitectura' },
  { code: 'riesgo-tecnico', name: 'Agente de riesgo técnico', service: 'Monitoreo de riesgo técnico', department: 'arquitectura' },
  // Arquitectura · liderazgo tecnológico
  { code: 'asesoria-cto-ligera', name: 'Agente de asesoría de CTO ligera', service: 'Asesoría de CTO (ligera)', department: 'arquitectura' },
  { code: 'liderazgo-tecnico-integrado', name: 'Agente de liderazgo técnico integrado', service: 'Liderazgo técnico integrado', department: 'arquitectura' },
  { code: 'cto-fraccional-crecimiento', name: 'Agente de CTO fraccional, nivel crecimiento', service: 'CTO fraccional — nivel crecimiento', department: 'arquitectura' },
  { code: 'cto-fraccional-startup', name: 'Agente de CTO fraccional, nivel startup', service: 'CTO fraccional — nivel startup', department: 'arquitectura' },
  // Estrategia · diagnóstico tecnológico
  { code: 'diagnostico-tecnologico-completo', name: 'Agente de diagnóstico tecnológico completo', service: 'Diagnóstico tecnológico completo', department: 'estrategia' },
  { code: 'sprint-descubrimiento-pagado', name: 'Agente de sprint de descubrimiento pagado', service: 'Sprint de descubrimiento pagado', department: 'estrategia' },
  { code: 'chequeo-tecnico', name: 'Agente de chequeo técnico', service: 'Chequeo técnico', department: 'estrategia' },
  // Estrategia · estrategia digital
  { code: 'portafolio-iniciativas', name: 'Agente de portafolio de iniciativas', service: 'Portafolio de iniciativas digitales', department: 'estrategia' },
  { code: 'madurez-digital', name: 'Agente de madurez digital', service: 'Evaluación de madurez digital', department: 'estrategia' },
  { code: 'taller-oportunidades', name: 'Agente de taller de oportunidades', service: 'Taller de oportunidades digitales', department: 'estrategia' },
  { code: 'blueprint-estrategia-digital', name: 'Agente de blueprint de estrategia digital', service: 'Blueprint de estrategia digital', department: 'estrategia' },
  // Estrategia · estrategia tecnológica
  { code: 'construir-vs-comprar', name: 'Agente de construir vs. comprar', service: 'Análisis de construir vs. comprar', department: 'estrategia' },
  { code: 'caso-inversion-deuda-tecnica', name: 'Agente de caso de inversión en deuda técnica', service: 'Caso de inversión en deuda técnica', department: 'estrategia' },
  { code: 'blueprint-estrategia-tecnologica', name: 'Agente de blueprint de estrategia tecnológica', service: 'Blueprint de estrategia tecnológica', department: 'estrategia' },
  { code: 'sprint-estrategia-tecnologica', name: 'Agente de sprint de estrategia tecnológica', service: 'Sprint de estrategia tecnológica', department: 'estrategia' },
  // Estrategia · hoja de ruta de TI
  { code: 'hoja-ruta-ti', name: 'Agente de hoja de ruta de TI', service: 'Hoja de ruta de TI (12-24 meses)', department: 'estrategia' },
  { code: 'sprint-hoja-ruta', name: 'Agente de sprint de hoja de ruta', service: 'Sprint de hoja de ruta de TI', department: 'estrategia' },
  { code: 'actualizacion-trimestral-hoja-ruta', name: 'Agente de actualización trimestral', service: 'Actualización trimestral de la hoja de ruta', department: 'estrategia' },
  // Producto · descubrimiento
  { code: 'taller-descubrimiento', name: 'Agente de taller de descubrimiento', service: 'Taller de descubrimiento', department: 'producto' },
  { code: 'evaluacion-oportunidad', name: 'Agente de evaluación de oportunidad', service: 'Evaluación de oportunidad y viabilidad', department: 'producto' },
  { code: 'sprint-descubrimiento-producto', name: 'Agente de sprint de descubrimiento', service: 'Sprint de descubrimiento de producto', department: 'producto' },
  { code: 'experimentos-validacion', name: 'Agente de experimentos de validación', service: 'Experimentos de validación de producto', department: 'producto' },
  // Producto · definición
  { code: 'paquete-definicion', name: 'Agente de paquete de definición', service: 'Paquete de definición de producto', department: 'producto' },
  { code: 'requisitos-backlog', name: 'Agente de requisitos y backlog', service: 'Requisitos de producto y backlog', department: 'producto' },
  { code: 'vision-alcance', name: 'Agente de visión y alcance', service: 'Taller de visión y alcance de producto', department: 'producto' },
  { code: 'especificacion-tecnica', name: 'Agente de especificación técnica', service: 'Especificación técnica de producto', department: 'producto' },
  // Producto · estrategia de MVP
  { code: 'taller-alcance-mvp', name: 'Agente de taller de alcance de MVP', service: 'Taller de definición de alcance del MVP', department: 'producto' },
  { code: 'estrategia-hoja-ruta-mvp', name: 'Agente de estrategia y hoja de ruta de MVP', service: 'Estrategia y hoja de ruta del MVP', department: 'producto' },
  { code: 'revision-preparacion', name: 'Agente de revisión de preparación', service: 'Revisión de preparación para construir el MVP', department: 'producto' },
  // Producto · gestión de producto
  { code: 'director-producto-fraccional', name: 'Agente de director de producto fraccional', service: 'Director de producto fraccional', department: 'producto' },
  { code: 'product-manager-fraccional', name: 'Agente de product manager fraccional', service: 'Product Manager fraccional', department: 'producto' },
  { code: 'asesoria-producto-ligera', name: 'Agente de asesoría de producto ligera', service: 'Asesoría de producto (ligera)', department: 'producto' },
  { code: 'modelo-operativo-producto', name: 'Agente de modelo operativo de producto', service: 'Diseño del modelo operativo de producto', department: 'producto' },
];
