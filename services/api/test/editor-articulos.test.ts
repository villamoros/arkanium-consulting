import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { articles, auditLog, organizations } from '../src/db/schema.js';
import { createTestDb } from './support/db.js';
import { CLIENT, INTERNAL, fakeIdentity } from './support/identity.js';

let db: Db;
let close: () => Promise<void>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(articles);
  await db.delete(organizations);
  await db.insert(organizations).values({ name: 'Cliente', kind: 'client', clerkOrgId: CLIENT });
  app = buildApp({ identity: fakeIdentity(), internalOrgId: INTERNAL, db });
});

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
}

/** Documento del editor con un párrafo de texto. */
function doc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

async function article(langs = ['es']) {
  const response = await call('POST', '/articles', 'token-owner', { title: 'Sin título', langs });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

describe('editor de artículos', () => {
  it('guarda el contenido de un idioma y el título de la lista sale del español', async () => {
    const id = await article();
    const saved = await call('PATCH', `/articles/${id}`, 'token-owner', {
      content: { es: { title: 'Escalar un SaaS', subtitle: 'Qué medir primero', body: doc('Antes de comprar servidores…') } },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ title: 'Escalar un SaaS', langs: ['es'] });
    expect(saved.json().content.es.body).toMatchObject({ type: 'doc' });
  });

  it('escribir en un idioma nuevo lo añade a los idiomas del artículo', async () => {
    const id = await article(['es']);
    const saved = await call('PATCH', `/articles/${id}`, 'token-owner', {
      content: { en: { title: 'Scaling a SaaS', body: doc('Before buying servers…') } },
    });
    expect(saved.json().langs.sort()).toEqual(['en', 'es']);
  });

  it('no se revisa un artículo sin cuerpo escrito en cada idioma', async () => {
    const id = await article(['es', 'en']);
    await call('PATCH', `/articles/${id}`, 'token-owner', {
      excerpt: 'Qué medir antes de comprar más infraestructura.',
      caseRef: 'Escalabilidad SaaS (caso representativo)',
      content: { es: { title: 'Escalar', body: doc('Texto en español') }, en: { title: 'Scale', body: { type: 'doc', content: [{ type: 'paragraph' }] } } },
    });
    const refused = await call('POST', `/articles/${id}/review`, 'token-owner');
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toContain('EN');
  });

  it('con contenido completo en cada idioma, el artículo pasa a revisión', async () => {
    const id = await article(['es', 'en']);
    await call('PATCH', `/articles/${id}`, 'token-owner', {
      excerpt: 'Resumen',
      caseRef: 'Caso',
      content: { es: { title: 'Escalar', body: doc('Texto') }, en: { title: 'Scale', body: doc('Text') } },
    });
    const reviewed = await call('POST', `/articles/${id}/review`, 'token-owner');
    expect(reviewed.json().status).toBe('en_revision');
  });

  it('el artículo se lee completo para el editor, y un cliente no lo ve', async () => {
    const id = await article();
    await call('PATCH', `/articles/${id}`, 'token-owner', { content: { es: { title: 'Título', body: doc('Cuerpo') } } });
    const read = await call('GET', `/articles/${id}`, 'token-owner');
    expect(read.statusCode).toBe(200);
    expect(read.json().content.es.title).toBe('Título');
    expect((await call('GET', `/articles/${id}`, 'token-client')).statusCode).toBe(403);
  });

  it('un cuerpo demasiado largo se rechaza', async () => {
    const id = await article();
    const huge = doc('x'.repeat(210_000));
    const response = await call('PATCH', `/articles/${id}`, 'token-owner', { content: { es: { title: 'Largo', body: huge } } });
    expect(response.statusCode).toBe(400);
  });
});
