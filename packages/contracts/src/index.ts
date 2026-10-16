/**
 * Contratos compartidos. Cualquier forma de dato que cruce una frontera
 * (API ↔ app, API ↔ control) se define aquí, no en cada app.
 */
export { healthResponseSchema, type HealthResponse } from './health.js';
export * from './leads.js';
