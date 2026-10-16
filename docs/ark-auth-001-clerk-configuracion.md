# ARK-AUTH-001 — configuración de Clerk (B2B, multi-tenant)

**Estado:** guía de configuración. La conexión en código empieza cuando tengas la instancia de desarrollo lista y me pases la clave pública.
**Fecha:** 2026-10-15.

---

## 1. Qué se configura en Clerk

Clerk identifica a las personas y a sus organizaciones. Nuestro modelo de tenants (proyectos, permisos) vive en PostgreSQL y se sincroniza con Clerk. Clerk no decide qué ve cada cliente: eso lo decide la API.

- **Organización de Clerk = cliente.** La organización interna de Arkanium es la del equipo.
- **Proyecto = servicio contratado.** Es nuestro. No se configura en Clerk.

## 2. Pasos en el dashboard de Clerk (instancia de desarrollo)

Los nombres exactos de los menús pueden cambiar con las versiones del dashboard. Si algo no coincide, dime qué ves y lo ajustamos.

### 2.1 Crear la aplicación

1. Crea una aplicación llamada **Arkanium**.
2. Clerk crea una instancia de **desarrollo** (claves `pk_test_` y `sk_test_`). Úsala hasta que el sitio esté listo para producción.

### 2.2 Métodos de inicio de sesión

- Activa **correo electrónico** (código o enlace mágico).
- Google es opcional. No lo actives si no lo necesitas todavía.

### 2.3 Registro público: desactivarlo

- Desactiva el **registro público** (sign-up abierto).
- Las personas entran por **invitación** de su organización. Así un cliente no puede darse de alta por su cuenta.

### 2.4 Organizaciones (B2B)

1. Activa **Organizations**.
2. Roles: deja los predeterminados, **`org:admin`** y **`org:member`**, por ahora.
3. Desactiva **crear organizaciones** para usuarios normales. Las organizaciones de clientes las creas tú desde `core` (más adelante, por la API).
4. Desactiva **unirse automáticamente por dominio de correo**. Si queda activo, cualquiera con un correo `@empresa.com` podría entrar en la organización de esa empresa sin invitación.
5. Revisa en la página de precios de Clerk si Organizations está incluido en tu plan y cuántas organizaciones permite. Eso afecta a cuántos clientes podemos tener en desarrollo y producción.

### 2.5 Crear la organización interna

- Crea la organización **Arkanium Consulting** (la del equipo).
- Tu cuenta queda como **`org:admin`**.
- Anota el **ID de la organización** (empieza por `org_`). La API lo usa para decidir quién entra a `core`.

### 2.6 Orígenes y redirecciones (desarrollo)

En la configuración de dominios y URL permitidas, agrega:

| Aplicación | URL local |
| --- | --- |
| Sitio web (Astro) | `http://localhost:4321` |
| App de clientes (Next.js) | `http://localhost:3001` |
| Core interno (Next.js) | `http://localhost:3002` |
| Control (Next.js, privado) | `http://localhost:3003` |

Página de retorno tras iniciar sesión: **`http://localhost:4321/acceso/`**. Es la página que decide a dónde va cada persona (ver §3).

### 2.7 Claves

Ve a **API Keys** y copia:
- **Clave pública** (`pk_test_…`): va en el frontend. No es secreta.
- **Clave secreta** (`sk_test_…`): **no la pegues en este chat.** Ponla tú en los archivos `.env` locales (ver §4).

### 2.8 Producción (más adelante)

- Crea la instancia de **producción** cuando el sitio esté listo para publicarse.
- Configura los dominios reales: `arkanium.consulting`, `app.arkanium.consulting` y `core.arkanium.consulting`.
- Para que la sesión se comparta entre subdominios, Clerk usa **dominios satélite**. Confirma en la documentación de Clerk la configuración exacta para este caso antes de publicar.
- Configura el **webhook** de Clerk hacia la API, para sincronizar usuarios y organizaciones con PostgreSQL. Es parte del contrato de la fase 3.

## 3. Cómo funciona el inicio de sesión

Pregunta del owner: el botón de «Iniciar sesión» del sitio debe llevar a la app o a core según el usuario.

```text
1. Visitante pulsa «Iniciar sesión» en arkanium.consulting
2. Clerk muestra su página de acceso (alojada por Clerk)
3. Al entrar, Clerk devuelve a arkanium.consulting/acceso/
4. /acceso/ pide a la API el destino, enviando el token de sesión
5. La API verifica el token en el servidor y revisa las membresías:
     · organización interna  → core.arkanium.consulting
     · organización cliente  → app.arkanium.consulting
     · sin organización      → página «sin acceso»
6. /acceso/ redirige al destino
```

**Regla de seguridad:** el redireccionamiento es comodidad. El acceso real se verifica en cada app y en cada endpoint de la API. Si un cliente escribe `core.arkanium.consulting` a mano, su token llega a la API, la API lo identifica como miembro de un cliente y rechaza la petición. Nunca se decide por un parámetro de URL.

**Por qué `/acceso/` en el sitio estático:** el sitio sigue siendo Astro estático. La página solo ejecuta JavaScript del navegador y llama a la API. No necesita servidor propio.

## 4. Variables de entorno (solo nombres)

Los valores van en archivos `.env.local` de cada proyecto. Esos archivos no se versionan (ya están en `.gitignore`).

| Dónde | Variable | Tipo |
| --- | --- | --- |
| `apps/web` | `PUBLIC_CLERK_PUBLISHABLE_KEY` | Pública |
| `apps/app`, `apps/core`, `apps/control` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Pública |
| `apps/app`, `apps/core`, `apps/control` | `CLERK_SECRET_KEY` | **Secreta** |
| `services/api` | `CLERK_SECRET_KEY` | **Secreta** |
| `services/api` | `ARKANIUM_ORG_ID` | Interna (ID de la organización de Arkanium) |

Cuando tengas la instancia lista, me pasas solo la **clave pública** y el **ID de la organización**. La clave secreta la pones tú en los `.env.local`.

## 5. Decisiones que necesito de ti

| # | Pregunta | Mi recomendación |
| --- | --- | --- |
| A1 | ¿Desactivamos el registro público? | Sí. Solo por invitación. |
| A2 | ¿Métodos de acceso? | Correo con código. Google después, si lo quieres. |
| A3 | ¿Cómo se llama la organización interna y quién es admin? | «Arkanium Consulting», con tu cuenta como `org:admin`. |
| A4 | ¿El botón de «Iniciar sesión» pasa por `/acceso/` (router) o cada subdominio pide su propio login? | `/acceso/`. Es una sola entrada y el destino lo decide la API. |

## 6. Lo que haré yo al recibir las claves

1. **`apps/app`, `apps/core`, `apps/control`:** instalar `@clerk/nextjs`, proteger rutas con middleware y crear las páginas de acceso.
2. **`services/api`:** verificar el token de Clerk en servidor con `@clerk/backend` y crear `GET /session/destination`. La API nunca confía en datos enviados por el navegador.
3. **`apps/web`:** conectar el botón de «Iniciar sesión» con Clerk y crear `/acceso/`. Hoy el botón apunta a `/login/`, que devuelve 404.
4. **Puertos:** fijar `3001` (app), `3002` (core), `3003` (control) y `3000` (API). Next.js usa el 3000 por defecto y chocaría con la API.
5. **Pruebas:** token válido, token inválido, usuario sin organización, cliente intentando entrar a `core`.

Nada de esto requiere producción: todo se prueba en la instancia de desarrollo.

## 7. Estado de implementación (2026-10-15)

**Hecho:**
- Puertos fijos: web `4321`, app `3001`, core `3002`, control `3003`, API `3000`.
- Variables locales en `.env.local` (no versionadas) con la clave pública y el ID de la organización interna. Plantillas `.env.example` con solo nombres.
- **API (`services/api`):**
  - `GET /session/destination` exige token de Clerk, lo verifica en servidor y consulta las membresías de la persona.
  - Responde `core` (con el ID de la interna), `app` (con el ID de su primera organización de cliente) o `none`.
  - Sin token válido responde `401`. CORS limitado a los orígenes de `CORS_ORIGINS`.
  - 12 pruebas pasan (con un doble de Clerk, sin red).
- **Apps (`apps/app`, `apps/core`, `apps/control`):** `proxy.ts` con `ClerkProvider` y reglas por organización:
  - app: cualquier organización activa.
  - core: solo la organización interna.
  - control: la organización interna y rol `org:admin`.
  - Quien no cumple va a `/sin-acceso`. Sin sesión, Clerk redirige a `/es/acceso/`.
- **Web (`apps/web`):** el botón de inicio de sesión lleva a `/{idioma}/acceso/`. La página usa Clerk JS: si no hay sesión, inicia el acceso; si la hay, consulta a la API, activa la organización y redirige.
- Todo compila: `astro check` sin errores, `astro build` (249 páginas) y `next build` en las tres apps.

**Falta para probar de extremo a extremo:**
1. Añadir `CLERK_SECRET_KEY` (clave secreta) en `apps/app/.env.local`, `apps/core/.env.local`, `apps/control/.env.local` y `services/api/.env.local`. Sin ella, la API no arranca y las apps no verifican sesiones.
2. En el dashboard de Clerk, confirmar que los orígenes locales `http://localhost:4321`, `:3001`, `:3002` y `:3003` están permitidos.
3. Probar con cuentas reales: una de `Arkanium Consulting` (debe llegar a core), una de `Cliente Demo` (debe llegar a app) y una sin organización (debe ver `/sin-acceso` o la página de «sin acceso» del sitio).

**Limitaciones conocidas:**
- Si una persona pertenece a varias organizaciones de cliente, se elige la primera. El selector llega en la fase 4.
- Los permisos de negocio no están aquí: la API los aplicará en cada endpoint cuando existan.
- Las apps leen la organización activa de la sesión. Por eso `/acceso/` la activa antes de redirigir.
