/** Error de negocio con código HTTP. Las rutas lo traducen a una respuesta clara, sin detalles internos. */
export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: 'not_found' | 'forbidden' | 'suspended' | 'invalid_state' | 'conflict' | 'billing_unavailable' | 'invalid' | 'suppressed' | 'calendar_unavailable',
    message: string,
  ) {
    super(message);
  }
}
