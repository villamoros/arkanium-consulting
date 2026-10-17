/**
 * Menú de sesión: si la persona ya inició sesión, el enlace «Iniciar sesión» del menú se convierte en
 * su nombre, con su organización y su rol, enlaces a los dashboards a los que puede entrar y un botón
 * para cerrar sesión. Los enlaces pasan por /acceso/, que activa la organización antes de entrar.
 * No hace nada sin sesión: el enlace de inicio de sesión queda como está.
 */
import { Clerk } from '@clerk/clerk-js';

/** Lo que el menú necesita de cada membresía. */
interface Membership {
  role: string;
  organization: { id: string; name: string };
}

interface SessionStrings {
  account: string;
  signOut: string;
  noOrganization: string;
  roleAdmin: string;
  roleMember: string;
  goToCore: string;
  goToApp: string;
}

/** Un destino al que la API dice que la persona puede entrar. */
interface Destination {
  destination: 'core' | 'app';
  orgId: string;
}

const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
const apiUrl = import.meta.env.PUBLIC_API_URL;
const triggers = document.querySelectorAll<HTMLAnchorElement>('[data-login-link]');
const strings = JSON.parse(document.getElementById('session-strings')?.textContent ?? '{}') as SessionStrings;

// En /acceso/ ya hay una instancia de Clerk para el flujo de entrada: no se crea otra.
const onAccessPage = window.location.pathname.includes('/acceso/');

function roleLabel(role: string): string {
  return role === 'org:admin' ? strings.roleAdmin : strings.roleMember;
}

/** Texto del enlace a un destino. El nombre de la organización sustituye a {org}. */
function destinationLabel(destination: Destination, orgName: string): string {
  return destination.destination === 'core' ? strings.goToCore : strings.goToApp.replace('{org}', orgName);
}

/** Enlace a /acceso/ con el destino elegido. La página vuelve a comprobarlo con la API. */
function destinationHref(accessPath: string, destination: Destination): string {
  const params = new URLSearchParams({ destino: destination.destination, org: destination.orgId });
  return `${accessPath}?${params.toString()}`;
}

function buildMenu(name: string, email: string | undefined, memberships: Membership[], onSignOut: () => void): { menu: HTMLElement; links: HTMLUListElement } {
  const menu = document.createElement('div');
  menu.className = 'session-menu';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'session-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.textContent = name.split(' ')[0] ?? name;

  const panel = document.createElement('div');
  panel.className = 'session-panel';
  panel.hidden = true;

  const who = document.createElement('p');
  who.className = 'session-name';
  who.textContent = name;
  panel.append(who);

  if (email) {
    const mail = document.createElement('p');
    mail.className = 'session-email';
    mail.textContent = email;
    panel.append(mail);
  }

  const roles = document.createElement('ul');
  roles.className = 'session-roles';
  if (memberships.length === 0) {
    const item = document.createElement('li');
    item.textContent = strings.noOrganization;
    roles.append(item);
  }
  for (const membership of memberships) {
    const item = document.createElement('li');
    item.textContent = `${membership.organization.name} · ${roleLabel(membership.role)}`;
    item.dataset.orgId = membership.organization.id;
    roles.append(item);
  }
  panel.append(roles);

  // Enlaces a los dashboards: se llenan cuando la API responde.
  const links = document.createElement('ul');
  links.className = 'session-links';
  panel.append(links);

  const signOut = document.createElement('button');
  signOut.type = 'button';
  signOut.className = 'button button-secondary session-signout';
  signOut.textContent = strings.signOut;
  signOut.addEventListener('click', onSignOut);
  panel.append(signOut);

  trigger.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  });

  // Cerrar al pulsar fuera del menú o con Escape.
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target as Node) && !panel.hidden) {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }
  });

  menu.append(trigger, panel);
  return { menu, links };
}

/** Pide a la API los destinos de la persona y los pinta como enlaces. Si falla, el menú sigue sin enlaces. */
async function fillDestinations(links: HTMLUListElement, token: string, accessPath: string, memberships: Membership[]) {
  if (!apiUrl) return;
  try {
    const response = await fetch(`${apiUrl}/session/destinations`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`API respondió ${response.status}`);
    const { destinations } = (await response.json()) as { destinations: Destination[] };

    // Si el equipo de Arkanium entra a Core, la lista de organizaciones se reduce a la interna.
    const core = destinations.find((d) => d.destination === 'core');
    if (core) {
      document.querySelectorAll<HTMLLIElement>('.session-roles li[data-org-id]').forEach((item) => {
        if (item.dataset.orgId !== core.orgId) item.remove();
      });
    }

    for (const destination of destinations) {
      const orgName = memberships.find((m) => m.organization.id === destination.orgId)?.organization.name ?? destination.orgId;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'session-link';
      link.href = destinationHref(accessPath, destination);
      link.textContent = destinationLabel(destination, orgName);
      item.append(link);
      links.append(item);
    }
  } catch (error) {
    console.error('[sesión] destinos', error);
  }
}

async function run() {
  if (!publishableKey || triggers.length === 0 || onAccessPage) return;

  const clerk = new Clerk(publishableKey);
  await clerk.load();
  const user = clerk.user;
  if (!user) return;

  const name = user.fullName || user.primaryEmailAddress?.emailAddress || strings.account;
  const email = user.primaryEmailAddress?.emailAddress;
  const memberships = (user.organizationMemberships ?? []) as Membership[];
  const onSignOut = () => {
    // Vuelve a la portada del idioma actual, con barra final: /es/ existe; /es da 404 con trailingSlash 'always'.
    // No se usa window.location.href: si la página actual no tiene barra final, el cierre de sesión termina en 404.
    const lang = document.documentElement.lang || 'es';
    void clerk.signOut({ redirectUrl: new URL(`/${lang}/`, window.location.origin).href });
  };
  const accessPath = triggers[0]?.dataset.accessPath ?? '/acceso/';

  const { menu, links } = buildMenu(name, email, memberships, onSignOut);
  triggers.forEach((link) => link.replaceWith(menu));

  const token = await clerk.session?.getToken();
  if (token) await fillDestinations(links, token, accessPath, memberships);
}

run().catch((error) => console.error('[sesión]', error));
