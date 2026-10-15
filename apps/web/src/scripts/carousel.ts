/**
 * Carrusel de una tarjeta visible (About y Solutions).
 * Marcado esperado: [data-carousel] > [data-carousel-track] > [data-carousel-slide]*,
 * más [data-carousel-prev], [data-carousel-next] y [data-carousel-dots].
 */
export interface CarouselController {
  /** Muestra solo las diapositivas que cumplen el predicado (p. ej. por línea de servicio). */
  setFilter(predicate: (slide: HTMLElement) => boolean): void;
}

export function initCarousel(wrapper: HTMLElement): CarouselController | null {
  const track = wrapper.querySelector<HTMLElement>('[data-carousel-track]');
  if (!track) return null;
  const allSlides = Array.from(track.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
  if (!allSlides.length) return null;

  const prev = wrapper.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = wrapper.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const dots = wrapper.querySelector<HTMLElement>('[data-carousel-dots]');
  const dotLabel = wrapper.dataset.carouselDotLabel ?? '';

  let slides = [...allSlides];
  let index = 0;
  let direction = 1;

  function sync(): void {
    for (const slide of allSlides) {
      if (slides.includes(slide)) continue;
      slide.classList.remove('is-active', 'is-exiting-left', 'is-exiting-right');
      slide.setAttribute('aria-hidden', 'true');
    }
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.classList.toggle('is-exiting-left', !active && direction < 0);
      slide.classList.toggle('is-exiting-right', !active && direction > 0);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots?.querySelectorAll<HTMLElement>('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-pressed', String(i === index));
    });
    const multiple = slides.length > 1;
    for (const button of [prev, next]) {
      if (!button) continue;
      button.disabled = !multiple;
      button.setAttribute('aria-hidden', String(!multiple));
    }
  }

  function goTo(target: number): void {
    const total = slides.length;
    index = (target + total) % total;
    sync();
  }

  function buildDots(): void {
    if (!dots) return;
    dots.replaceChildren();
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `${dotLabel} ${i + 1}`.trim());
      dot.setAttribute('aria-pressed', String(i === index));
      dot.addEventListener('click', () => {
        direction = i > index ? 1 : -1;
        goTo(i);
      });
      dots.appendChild(dot);
    });
    dots.hidden = slides.length < 2;
  }

  prev?.addEventListener('click', () => { direction = -1; goTo(index - 1); });
  next?.addEventListener('click', () => { direction = 1; goTo(index + 1); });

  wrapper.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    direction = e.key === 'ArrowLeft' ? -1 : 1;
    goTo(index + direction);
  });

  buildDots();
  sync();

  return {
    setFilter(predicate) {
      slides = allSlides.filter(predicate);
      index = 0;
      direction = 1;
      buildDots();
      sync();
    },
  };
}
