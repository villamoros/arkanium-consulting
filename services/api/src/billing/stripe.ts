/**
 * Facturación con Stripe por la API REST, sin SDK. Modo de prueba mientras no esté constituida la LLC:
 * se usan claves sk_test_… y después se cambian por las de la LLC, sin tocar el código.
 * Ninguna factura se envía por correo desde aquí: el cliente la ve en la app y paga en la página de Stripe.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface BillingGateway {
  createCustomer(input: { name: string; email: string | null; metadata: Record<string, string> }): Promise<{ id: string }>;
  /** Crea la factura con un solo concepto y la finaliza. Devuelve la página de pago. */
  createInvoice(input: {
    customerId: string;
    amountCents: number;
    currency: string;
    description: string;
    daysUntilDue: number;
    metadata: Record<string, string>;
  }): Promise<{ id: string; hostedUrl: string }>;
  /** Anula una factura ya emitida. Stripe la deja visible como anulada. */
  voidInvoice(stripeInvoiceId: string): Promise<void>;
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
    if (!response.ok) throw new BillingError(`Stripe respondió ${response.status} en ${path}`);
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

    async createInvoice({ customerId, amountCents, currency, description, daysUntilDue, metadata }) {
      // El concepto va como ítem pendiente del cliente; la factura lo toma al crearse.
      await call('POST', '/invoiceitems', new URLSearchParams({
        customer: customerId,
        amount: String(amountCents),
        currency,
        description,
      }));

      const form = new URLSearchParams({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: String(daysUntilDue),
        currency,
      });
      withMetadata(form, metadata);
      const invoice = await call<{ id: string }>('POST', '/invoices', form);
      const finalized = await call<{ id: string; hosted_invoice_url: string }>('POST', `/invoices/${invoice.id}/finalize`, new URLSearchParams());
      return { id: finalized.id, hostedUrl: finalized.hosted_invoice_url };
    },

    async voidInvoice(stripeInvoiceId) {
      await call('POST', `/invoices/${stripeInvoiceId}/void`, new URLSearchParams());
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
