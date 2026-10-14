/**
 * Textos editoriales de la página de inicio. Viven en content/pages/<idioma>/home.json y se leen con GraphQL local.
 * La interfaz (botones, etiquetas, formulario, estados) sigue en src/i18n.
 */
import type { Locale } from '../../i18n/config';
import { runContentQuery } from '../content/execute.ts';

export interface Metric { value: string; label: string }
export interface AboutCard { kicker: string; title: string; body: string }
export interface TitledBody { title: string; body: string }
export interface ProcessPhase { label: string; kicker: string; title: string; body: string; items: string[] }
export interface QuestionAnswer { question: string; answer: string }

export interface HomeHero { eyebrow: string; title: string; lede: string; metrics: Metric[] }
export interface HomeAbout { eyebrow: string; title: string; intro: string; cards: AboutCard[] }
export interface HomeChallenges { eyebrow: string; title: string; intro: string; items: TitledBody[] }
export interface HomeSolutions { eyebrow: string; title: string; intro: string; groupTitle: string }
export interface HomeProcess { eyebrow: string; title: string; intro: string; phases: Record<'assess' | 'architect' | 'modernize' | 'scale', ProcessPhase> }
export interface HomeWhy { eyebrow: string; title: string; items: TitledBody[]; gain: { eyebrow: string; items: string[] } }
export interface HomeFaq { eyebrow: string; title: string; items: QuestionAnswer[] }
export interface HomeCta { eyebrow: string; title: string; intro: string; steps: string[] }

export interface HomeContent {
  hero: HomeHero;
  about: HomeAbout;
  challenges: HomeChallenges;
  solutions: HomeSolutions;
  process: HomeProcess;
  why: HomeWhy;
  faq: HomeFaq;
  cta: HomeCta;
}

const HOME_QUERY = /* GraphQL */ `
  query Home($locale: Locale!) {
    homePage(locale: $locale) {
      hero { eyebrow title lede metrics { value label } }
      about { eyebrow title intro cards { kicker title body } }
      challenges { eyebrow title intro items { title body } }
      solutions { eyebrow title intro groupTitle }
      process {
        eyebrow
        title
        intro
        phases {
          assess { label kicker title body items }
          architect { label kicker title body items }
          modernize { label kicker title body items }
          scale { label kicker title body items }
        }
      }
      why { eyebrow title items { title body } gain { eyebrow items } }
      faq { eyebrow title items { question answer } }
      cta { eyebrow title intro steps }
    }
  }
`;

export async function getHomePage(locale: Locale): Promise<HomeContent> {
  const data = await runContentQuery<{ homePage: HomeContent | null }>(HOME_QUERY, { locale });
  if (!data.homePage) throw new Error(`[home] Falta content/pages/${locale}/home.json.`);
  return data.homePage;
}
