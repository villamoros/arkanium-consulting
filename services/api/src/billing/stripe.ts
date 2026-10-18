/**
 * Facturación con Stripe por la API REST, sin SDK. Modo de prueba mientras no esté constituida la LLC:
 * se usan claves sk_test_… y después se cambian por las de la LLC, sin tocar el código.
 * Stripe envía la factura por correo al cliente al emitirla (correo de facturación de la organización);
 * el cliente también la ve en la app y paga en la página segura de Stripe.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface BillingLine {
  description: string;
  quantity: number;
  unitAmountCents: number;
}

export interface BillingGateway {
  createCustomer(input: { name: string; email: string | null; metadata: Record<string, string> }): Promise<{ id: string }>;
  /** Actualiza el correo del cliente de Stripe (la factura se envía a ese correo). */
  updateCustomerEmail(customerId: string, email: string | null): Promise<void>;
  /** Crea la factura con sus líneas y la finaliza. Devuelve la página de pago. */
  createInvoice(input: {
    customerId: string;
    lines: BillingLine[];
    currency: string;
    description: string;
    daysUntilDue: number;
    metadata: Record<string, string>;
  }): Promise<{ id: string; hostedUrl: string }>;
  /** Anula una factura ya emitida. Stripe la deja visible como anulada. */
  voidInvoice(stripeInvoiceId: string): Promise<void>;
  /** Reenvía la factura por correo al cliente. */
  sendInvoice(stripeInvoiceId: string): Promise<void>;
  /**
   * Nota de crédito sobre una factura. Con `refund`, el monto vuelve al medio de pago del cliente
   * (necesario en facturas ya pagadas).
   */
  createCreditNote(input: { stripeInvoiceId: string; amountCents: number; description: string; refund: boolean }): Promise<{ id: string }>;
}

export class BillingError extends Error {}

export function createStripeBilling(options: { secretKey: string; fetchImpl?: typeof fetch }): BillingGateway {
  const doFetch = options.fetchImpl ?? fetch;
  const base = 'https://api.stripe.com/v1';

  async function call<T>(method: 'POST', path: string, form: URLSearchParams): Promise<T> {
    const response = await doFetch(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${options.secretKey}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!response.ok) {
      // El mensaje de Stripe dice qué parámetro falló; queda en la bitácora de la factura.
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new BillingError(`Stripe respondió ${response.status} en ${path}: ${body?.error?.message ?? 'sin detalle'}`);
    }
    return (await response.json()) as T;
  }

  function withMetadata(form: URLSearchParams, metadata: Record<string, string>) {
    for (const [key, value] of Object.entries(metadata)) form.set(`metadata[${key}]`, value);
  }

  return {
    async createCustomer({ name, email, metadata }) {
      const form = new URLSearchParams({ name });
      if (email) form.set('email', email);
      withMetadata(form, metadata);
      return call<{ id: string }>('POST', '/customers', form);
    },

    async updateCustomerEmail(customerId, email) {
      // Stripe no acepta un correo vacío para borrarlo con la misma llamada: se envía cadena vacía.
      await call('POST', `/customers/${customerId}`, new URLSearchParams({ email: email ?? '' }));
    },

    async createInvoice({ customerId, lines, currency, description, daysUntilDue, metadata }) {
      // Primero la factura en borrador, luego sus líneas dentro de ella: así ningún ítem queda suelto
      // en el cliente si algo falla antes de finalizarla.
      const form = new URLSearchParams({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: String(daysUntilDue),
        currency,
        description,
      });
      withMetadata(form, metadata);
      const draft = await call<{ id: string }>('POST', '/invoices', form);

      for (const line of lines) {
        await call('POST', '/invoiceitems', new URLSearchParams({
          customer: customerId,
          invoice: draft.id,
          currency,
          description: line.description,
          quantity: String(line.quantity),
          // Stripe espera el precio unitario en centavos como decimal (unit_amount no existe en este endpoint).
          unit_amount_decimal: String(line.unitAmountCents),
        }));
      }

      const finalized = await call<{ id: string; hosted_invoice_url: string }>('POST', `/invoices/${draft.id}/finalize`, new URLSearchParams());
      return { id: finalized.id, hostedUrl: finalized.hosted_invoice_url };
    },

    async voidInvoice(stripeInvoiceId) {
      await call('POST', `/invoices/${stripeInvoiceId}/void`, new URLSearchParams());
    },

    async sendInvoice(stripeInvoiceId) {
      await call('POST', `/invoices/${stripeInvoiceId}/send`, new URLSearchParams());
    },

    async createCreditNote({ stripeInvoiceId, amountCents, description, refund }) {
      const form = new URLSearchParams({
        invoice: stripeInvoiceId,
        'lines[0][type]': 'custom_line_item',
        'lines[0][description]': description,
        'lines[0][quantity]': '1',
        'lines[0][unit_amount]': String(amountCents),
      });
      if (refund) form.set('refund_amount', String(amountCents));
      const note = await call<{ id: string }>('POST', '/credit_notes', form);
      return { id: note.id };
    },
  };
}

/**
 * Verifica la firma del webhook de Stripe (cabecera Stripe-Signature: t=…,v1=…).
 * Tolera 5 minutos de diferencia para evitar repeticiones.
 */
export function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((part) => part.split('=') as [string, string]));
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(now / 1000 - timestamp) > 300) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
