/**
 * Página /acceso/: activa la organización de la persona en Clerk y la lleva a su aplicación.
 *
 * - Sin parámetros: pregunta a la API a qué aplicación va (la primera que le corresponda).
 * - Con ?destino=core|app&org=…: el menú de sesión eligió un dashboard concreto. La API confirma
 *   que la persona puede entrar ahí antes de activar la organización.
 *
 * Sin sesión: Clerk muestra su página de acceso y vuelve aquí.
 * La API es quien decide; esta página solo redirige.
 */
import { Clerk } from '@clerk/clerk-js';

type Destination = 'core' | 'app' | 'none';
interface DestinationResponse {
  destination: Destination;
  orgId?: string;
}
interface DestinationsResponse {
  destinations: Array<{ destination: 'core' | 'app'; orgId: string }>;
}

const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
const apiUrl = import.meta.env.PUBLIC_API_URL;
const targets: Record<'core' | 'app', string> = {
  core: import.meta.env.PUBLIC_CORE_URL,
  app: import.meta.env.PUBLIC_APP_URL,
};

function show(state: 'checking' | 'none' | 'error') {
  document.querySelectorAll<HTMLElement>('[data-access]').forEach((el) => {
    el.hidden = el.dataset.access !== state;
  });
}

/** Activa la organización y lleva a la aplicación. Las apps leen la organización activa de la sesión. */
async function enter(clerk: Clerk, destination: 'core' | 'app', orgId: string) {
  await clerk.setActive({ organization: orgId });
  window.location.href = targets[destination];
}

async function run() {
  if (!publishableKey || !apiUrl) throw new Error('Configuración incompleta');

  const clerk = new Clerk(publishableKey);
  await clerk.load();

  if (!clerk.user || !clerk.session) {
    await clerk.redirectToSignIn({ redirectUrl: window.location.href });
    return;
  }

  const token = await clerk.session.getToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Elección explícita desde el menú de sesión.
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get('destino');
  const wantedOrg = params.get('org');
  if ((wanted === 'core' || wanted === 'app') && wantedOrg) {
    const response = await fetch(`${apiUrl}/session/destinations`, { headers });
    if (!response.ok) throw new Error(`API respondió ${response.status}`);
    const { destinations } = (await response.json()) as DestinationsResponse;
    const match = destinations.find((d) => d.destination === wanted && d.orgId === wantedOrg);
    if (!match) {
      // La persona no tiene ese acceso: no se activa nada.
      show('error');
      return;
    }
    await enter(clerk, match.destination, match.orgId);
    return;
  }

  // Entrada normal: la primera aplicación que le corresponda.
  const response = await fetch(`${apiUrl}/session/destination`, { headers });
  if (!response.ok) throw new Error(`API respondió ${response.status}`);

  const data = (await response.json()) as DestinationResponse;
  if (data.destination === 'none' || !data.orgId) {
    show('none');
    return;
  }
  await enter(clerk, data.destination, data.orgId);
}

show('checking');
run().catch((error) => {
  // Se registra el motivo para diagnosticar; el visitante ve un mensaje genérico.
  console.error('[acceso]', error);
  show('error');
});
