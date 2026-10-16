/**
 * Menú de sesión: si la persona ya inició sesión, el enlace «Iniciar sesión» del menú se convierte en
 * su nombre, con su organización y su rol, y un botón para cerrar sesión.
 * No hace nada sin sesión: el enlace de inicio de sesión queda como está.
 */
import { Clerk } from '@clerk/clerk-js';

/** Lo que el menú necesita de cada membresía. */
interface Membership {
  role: string;
  organization: { name: string };
}

interface SessionStrings {
  account: string;
  signOut: string;
  noOrganization: string;
  roleAdmin: string;
  roleMember: string;
}

const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
const triggers = document.querySelectorAll<HTMLAnchorElement>('[data-login-link]');
const strings = JSON.parse(document.getElementById('session-strings')?.textContent ?? '{}') as SessionStrings;

// En /acceso/ ya hay una instancia de Clerk para el flujo de entrada: no se crea otra.
const onAccessPage = window.location.pathname.includes('/acceso/');

function roleLabel(role: string): string {
  return role === 'org:admin' ? strings.roleAdmin : strings.roleMember;
}

function buildMenu(name: string, email: string | undefined, memberships: Membership[], onSignOut: () => void): HTMLElement {
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
    roles.append(item);
  }
  panel.append(roles);

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
  return menu;
}

async function run() {
  if (!publishableKey || triggers.length === 0 || onAccessPage) return;

  const clerk = new Clerk(publishableKey);
  await clerk.load();
  const user = clerk.user;
  if (!user) return;

  const name = user.fullName || user.primaryEmailAddress?.emailAddress || strings.account;
  const email = user.primaryEmailAddress?.emailAddress;
  const memberships = user.organizationMemberships ?? [];
  const onSignOut = () => {
    void clerk.signOut({ redirectUrl: window.location.href });
  };

  triggers.forEach((link) => link.replaceWith(buildMenu(name, email, memberships, onSignOut)));
}

run().catch((error) => console.error('[sesión]', error));
