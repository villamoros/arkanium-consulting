/**
 * Página /acceso/: tras el inicio de sesión, pregunta a la API a qué aplicación va la persona
 * y activa su organización en Clerk antes de redirigir.
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

async function run() {
  if (!publishableKey || !apiUrl) throw new Error('Configuración incompleta');

  const clerk = new Clerk(publishableKey);
  await clerk.load();

  if (!clerk.user || !clerk.session) {
    await clerk.redirectToSignIn({ redirectUrl: window.location.href });
    return;
  }

  const token = await clerk.session.getToken();
  const response = await fetch(`${apiUrl}/session/destination`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`API respondió ${response.status}`);

  const data = (await response.json()) as DestinationResponse;
  if (data.destination === 'none' || !data.orgId) {
    show('none');
    return;
  }

  // Activar la organización antes de salir: las apps leen la organización activa de la sesión.
  await clerk.setActive({ organization: data.orgId });
  window.location.href = targets[data.destination];
}

show('checking');
run().catch((error) => {
  // Se registra el motivo para diagnosticar; el visitante ve un mensaje genérico.
  console.error('[acceso]', error);
  show('error');
});
