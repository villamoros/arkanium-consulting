# API de Arkanium

## Stripe en local (modo de prueba)

Las facturas se emiten con `STRIPE_SECRET_KEY` (clave `sk_test_…`). Para que un pago se refleje solo en Core, Stripe tiene que avisar a la API con su webhook.

1. Instala la [Stripe CLI](https://docs.stripe.com/stripe-cli) y ejecuta una vez `stripe login`.
2. Con la API corriendo (por defecto en el puerto 3000), reenvía los eventos a la API:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

3. La CLI imprime un secreto que empieza con `whsec_`. Ponlo en `services/api/.env.local` como `STRIPE_WEBHOOK_SECRET` y reinicia la API. Ese valor es secreto: no lo pegues en el chat ni lo subas al repositorio.
4. Para probar: emite una factura desde Aprobaciones, abre su enlace de pago y paga con la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y cualquier CVC). La factura debe pasar a «pagada» en Cobros.

Si la API arranca sin `STRIPE_WEBHOOK_SECRET`, avisa en la consola: los pagos no se reflejarán solos hasta configurarlo.

## Correo de facturación

Stripe envía cada factura al correo de facturación del cliente, que se edita en Clientes. Sin ese correo, la factura no se puede emitir.
