/**
 * Banner y panel de preferencias de cookies. La lógica de la cookie vive en lib/consent/state.ts.
 * - Sin elección guardada se muestra el banner. Sin JS no aparece nada: el sitio no depende de él.
 * - Otros scripts consultan `window.arkaniumConsent.allows('analytics')` o escuchan `arkanium:consent`.
 */
import { allows, consentCookie, readConsentCookie, type ConsentChoice, type OptionalCategory, type StoredConsent } from '../lib/consent/state';

declare global {
  interface Window {
    arkaniumConsent?: {
      get(): StoredConsent | null;
      allows(category: OptionalCategory): boolean;
    };
  }
}

const banner = document.getElementById('cookie-banner');
const dialog = document.getElementById('cookie-dialog');

if (banner && dialog) setup(banner, dialog);

function setup(bannerEl: HTMLElement, dialogEl: HTMLElement) {
  const panel = dialogEl.querySelector<HTMLElement>('.cookie-dialog-panel');
  const analyticsInput = dialogEl.querySelector<HTMLInputElement>('#cookie-analytics');
  const marketingInput = dialogEl.querySelector<HTMLInputElement>('#cookie-marketing');
  const secure = location.protocol === 'https:';
  let trigger: HTMLElement | null = null;

  const current = () => readConsentCookie(document.cookie);

  window.arkaniumConsent = {
    get: current,
    allows: (category) => allows(current(), category),
  };

  if (!current()) bannerEl.hidden = false;

  function openDialog(from: HTMLElement) {
    trigger = from;
    const saved = current();
    if (analyticsInput) analyticsInput.checked = allows(saved, 'analytics');
    if (marketingInput) marketingInput.checked = allows(saved, 'marketing');
    dialogEl.hidden = false;
    panel?.focus();
  }

  /** Cierra el panel. Si `restoreFocus`, devuelve el foco al botón que lo abrió (si sigue visible). */
  function closeDialog(restoreFocus: boolean) {
    if (dialogEl.hidden) return;
    dialogEl.hidden = true;
    const back = trigger;
    trigger = null;
    if (restoreFocus && back && back.offsetParent !== null) back.focus();
  }

  function save(choice: ConsentChoice) {
    document.cookie = consentCookie(choice, new Date(), secure);
    closeDialog(false);
    bannerEl.hidden = true;
    // El botón que abrió el panel puede estar dentro del banner ya oculto: el foco va al contenido.
    document.getElementById('main')?.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('arkanium:consent', { detail: choice }));
  }

  bannerEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!button) return;
    switch (button.dataset.action) {
      case 'accept':
        save({ analytics: true, marketing: true });
        break;
      case 'reject':
        save({ analytics: false, marketing: false });
        break;
      case 'settings':
        openDialog(button);
        break;
    }
  });

  dialogEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'save') {
      save({ analytics: analyticsInput?.checked === true, marketing: marketingInput?.checked === true });
    } else if (button.dataset.action === 'close') {
      closeDialog(true);
    }
  });

  // Las preferencias se reabren desde el footer de cualquier página.
  document.querySelectorAll<HTMLElement>('[data-cookie-settings]').forEach((button) => {
    button.addEventListener('click', () => openDialog(button));
  });

  // Teclado: Escape cierra y el foco queda atrapado dentro del panel mientras está abierto.
  dialogEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(true);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogEl.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
