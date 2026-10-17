/**
 * Página /acceso/: activa la organización de la persona en Clerk y la lleva a su aplicación.
 *
 * - Sin parámetros: pregunta a la API a qué aplicación va (la primera que le corresponda).
 * - Con ?destino=core|app&org=…: el menú de sesión eligió un dashboard concreto. La API confirma
 *   que la persona puede entrar ahí antes de activar la organización.
 *
 * Sin sesión: Clerk muestra su página de acceso y vuelve aquí.
 * Cada paso tiene un tiempo máximo: si algo se detiene, la página muestra el error con acciones
 * en lugar de quedarse en «Verificando». El paso que falla queda en la consola.
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

const LOAD_TIMEOUT_MS = 10_000;
const STEP_TIMEOUT_MS = 8_000;

function show(state: 'checking' | 'none' | 'error') {
  document.querySelectorAll<HTMLElement>('[data-access]').forEach((el) => {
    el.hidden = el.dataset.access !== state;
  });
}

/** Rechaza si la promesa no termina a tiempo. El nombre del paso aparece en el error. */
function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo agotado: ${step}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Muestra el error con su motivo y tres acciones: reintentar, ir a Core o volver al sitio. */
function showError(detail: string) {
  show('error');
  const detailEl = document.getElementById('access-error-detail');
  if (detailEl) detailEl.textContent = detail;

  const actions = document.getElementById('access-error-actions');
  if (!actions) return;
  const home = actions.dataset.home ?? '/';
  actions.innerHTML = '';
  const make = (label: string, href: string, primary: boolean) => {
    const a = document.createElement('a');
    a.href = href;
    a.className = primary ? 'button button-primary' : 'button button-secondary';
    a.textContent = label;
    actions.append(a);
  };
  make('Reintentar', window.location.href, true);
  if (targets.core) make('Ir a Core', targets.core, false);
  make('Volver al sitio', home, false);
}

/** Activa la organización y lleva a la aplicación. Las apps leen la organización activa de la sesión. */
async function enter(clerk: Clerk, destination: 'core' | 'app', orgId: string) {
  try {
    await withTimeout(clerk.setActive({ organization: orgId }), STEP_TIMEOUT_MS, 'activar la organización');
  } catch (error) {
    // Si Clerk no confirma la organización, se avanza igual: la aplicación comprueba el acceso por su cuenta.
    console.warn('[acceso] no se confirmó la organización activa', error);
  }
  console.info('[acceso] redirigiendo a', destination);
  window.location.href = targets[destination];
}

async function run() {
  if (!publishableKey || !apiUrl) throw new Error('Configuración incompleta de la página de acceso.');

  console.info('[acceso] cargando Clerk');
  const clerk = new Clerk(publishableKey);
  await withTimeout(clerk.load(), LOAD_TIMEOUT_MS, 'cargar Clerk');

  if (!clerk.user || !clerk.session) {
    console.info('[acceso] sin sesión: va a iniciar sesión');
    await clerk.redirectToSignIn({ redirectUrl: window.location.href });
    return;
  }

  console.info('[acceso] obteniendo token');
  const token = await withTimeout(clerk.session.getToken(), STEP_TIMEOUT_MS, 'obtener el token');
  const headers = { Authorization: `Bearer ${token}` };

  // Elección explícita desde el menú de sesión.
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get('destino');
  const wantedOrg = params.get('org');
  if ((wanted === 'core' || wanted === 'app') && wantedOrg) {
    console.info('[acceso] consultando destinos');
    const response = await withTimeout(fetch(`${apiUrl}/session/destinations`, { headers }), STEP_TIMEOUT_MS, 'consultar la API');
    if (!response.ok) throw new Error(`La API respondió ${response.status} al consultar destinos.`);
    const { destinations } = (await response.json()) as DestinationsResponse;
    const match = destinations.find((d) => d.destination === wanted && d.orgId === wantedOrg);
    if (!match) {
      showError('Tu cuenta no tiene acceso a ese destino.');
      return;
    }
    await enter(clerk, match.destination, match.orgId);
    return;
  }

  console.info('[acceso] consultando destino');
  const response = await withTimeout(fetch(`${apiUrl}/session/destination`, { headers }), STEP_TIMEOUT_MS, 'consultar la API');
  if (!response.ok) throw new Error(`La API respondió ${response.status} al consultar el destino.`);

  const data = (await response.json()) as DestinationResponse;
  if (data.destination === 'none' || !data.orgId) {
    show('none');
    return;
  }
  await enter(clerk, data.destination, data.orgId);
}

show('checking');
run().catch((error: unknown) => {
  // El motivo queda en la consola; el visitante ve el error y sus acciones.
  console.error('[acceso]', error);
  const message = error instanceof Error ? error.message : 'Error desconocido.';
  showError(message);
});
