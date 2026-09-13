# Migrar esta app de Base44 a Supabase

**Para quién es este documento:** para vos, GitHub Copilot (o cualquier agente de código que esté
leyendo esto dentro de VSCode), trabajando junto a una persona sin experiencia programando. Ella
no va a escribir código — tu trabajo es ejecutar esta migración de punta a punta, un checklist a
la vez, marcando `[x]` cada tarea en este mismo archivo a medida que la completás, y **parando y
preguntándole explícitamente** cuando llegues a un punto marcado como `🛑 HUMANO`.

No sigas de largo sobre un `🛑 HUMANO` asumiendo un valor. Si falta información (una URL, una key),
pedísela literalmente y esperá la respuesta antes de continuar.

---

## 0. Contexto (leer antes de tocar nada)

Esto es una app de fantasy football / DFS (Daily Fantasy Sports) en React + Vite, hoy construida
sobre **Base44** (un backend-as-a-service propietario). Base44 le da a la app 5 cosas: login,
base de datos (5 entidades), storage de imágenes, una función serverless (`syncNFLDFS`, que trae
jugadores de la NFL desde una API externa) y el hosting.

El objetivo: reemplazar las 5 por **Supabase** (Postgres + Auth + Storage + Edge Functions), para
dejar de pagar Base44 y depender solo de GitHub Copilot para seguir desarrollando. No hay datos de
producción reales que migrar — es un proyecto en desarrollo, así que se puede recrear el backend
desde cero sin script de migración de datos.

### Decisiones ya tomadas (no las vuelvas a preguntar)

- Backend nuevo: **Supabase**.
- El botón de "Continuar con Google" en Login/Register **se elimina por ahora** (requiere
  credenciales OAuth de Google Cloud Console que solo el dueño de la cuenta puede crear). Queda
  solo login por email/password.
- `src/pages/OAuthConsent.jsx`, `src/components/UserNotRegisteredError.jsx` y el estado
  `authError.type === 'user_not_registered'` en `AuthContext.jsx`/`ProtectedRoute.jsx`/`App.jsx`
  **se eliminan por completo**. Es el flujo de consentimiento MCP propietario de Base44 (para que
  agentes externos pidan acceso a la app) y no tiene equivalente ni falta en Supabase.
- La lógica de transformación de imágenes de `src/components/ui/image-helpers.js` e `image.jsx`
  (`media.base44.com`, transform URLs estilo Wix) **se simplifica** a un `<img>` normal con
  fallback — no hay imágenes reales cargadas todavía, no hace falta reconstruir un CDN.

---

## 1. 🛑 HUMANO — Prerequisitos que solo la persona dueña de la cuenta puede hacer

**No avances a la Fase 2 hasta que esto esté resuelto.** Pedile a la persona, en este orden:

1. Crear una cuenta gratis en [supabase.com](https://supabase.com) y un proyecto nuevo (cualquier
   nombre, y que guarde la contraseña de base de datos que le pida).
2. En el dashboard del proyecto → **Settings → API**, copiar:
   - `Project URL`
   - `anon public` key
   - `service_role` key (esta es secreta — no va en el frontend ni se sube a git)
3. Crear un archivo `.env.local` en la raíz del repo (ya está en `.gitignore`, confirmalo) con:
   ```
   VITE_SUPABASE_URL=<Project URL>
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
4. Instalar la Supabase CLI y correr `npx supabase login` (abre el navegador) y
   `npx supabase link --project-ref <ref-del-proyecto>` desde la raíz del repo — el ref está en la
   URL del dashboard o en Settings → General.
5. Conseguir una API key de RapidAPI para `tank01-nfl-live-in-game-real-time-statistics-nfl` (la
   que ya usaba `syncNFLDFS`) si no la tienen guardada de antes.

Una vez que tengas `.env.local` con las dos variables y el proyecto está linkeado con la CLI,
tildá esto y seguí:

- [ ] `.env.local` creado con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [ ] `npx supabase link` corrido con éxito
- [ ] Key de RapidAPI disponible

---

## 2. Dependencias y config

- [ ] `npm uninstall @base44/sdk @base44/vite-plugin`
- [ ] `npm install @supabase/supabase-js`
- [ ] En `vite.config.js`: sacar el import y el bloque de `@base44/vite-plugin` (habilita imports
      legacy `@/integrations`/`@/entities` que nada en `src/` usa — se puede confirmar con
      `grep -r "@/integrations\|@/entities" src`).
- [ ] En `package.json`: cambiar `"name": "base44-app"` por algo genérico del proyecto.

---

## 3. Esquema de base de datos

Crear `supabase/migrations/0001_init.sql` con este contenido (ajustalo solo si al leer el código
encontrás un campo que no está listado acá — la fuente de verdad son los usos reales en `src/` y
`base44/entities/*.jsonc`):

```sql
-- Perfil de usuario (Supabase Auth no permite campos custom en auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Crea el profile automáticamente cuando alguien se registra
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null default 'NFL' check (sport in ('NFL','NBA','MLB','NHL','Soccer')),
  description text,
  invite_code text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null,
  sport text not null default 'NFL' check (sport in ('NFL','NBA','MLB','NHL','Soccer')),
  status text not null default 'open' check (status in ('open','locked','completed')),
  entry_fee numeric not null default 0,
  prize_pool numeric not null default 0,
  salary_cap numeric not null default 50000,
  contest_date date,
  allowed_teams text[] not null default '{}',
  captain_mode boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text,
  position text not null check (position in ('QB','RB','WR','TE','K','DEF')),
  salary numeric not null default 0,
  projected_points numeric not null default 0,
  actual_points numeric not null default 0,
  sport text not null default 'NFL' check (sport in ('NFL','NBA','MLB','NHL','Soccer')),
  created_at timestamptz not null default now()
);

create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  player_ids uuid[] not null default '{}',
  captain_id uuid,
  total_projected numeric not null default 0,
  total_actual numeric not null default 0,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Helper para políticas de admin
create function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.contests enable row level security;
alter table public.players enable row level security;
alter table public.lineups enable row level security;

create policy "profiles: leer propio" on public.profiles for select using (id = auth.uid());
create policy "profiles: actualizar propio" on public.profiles for update using (id = auth.uid());

create policy "leagues: leer autenticado" on public.leagues for select using (auth.uid() is not null);
create policy "leagues: crear autenticado" on public.leagues for insert with check (auth.uid() is not null);
create policy "leagues: editar propio o admin" on public.leagues for update using (created_by = auth.uid() or is_admin());
create policy "leagues: borrar propio o admin" on public.leagues for delete using (created_by = auth.uid() or is_admin());

create policy "contests: leer autenticado" on public.contests for select using (auth.uid() is not null);
create policy "contests: crear autenticado" on public.contests for insert with check (auth.uid() is not null);
create policy "contests: editar propio o admin" on public.contests for update using (created_by = auth.uid() or is_admin());
create policy "contests: borrar propio o admin" on public.contests for delete using (created_by = auth.uid() or is_admin());

create policy "players: leer autenticado" on public.players for select using (auth.uid() is not null);
create policy "players: solo admin escribe" on public.players for all using (is_admin()) with check (is_admin());

create policy "lineups: leer autenticado" on public.lineups for select using (auth.uid() is not null);
create policy "lineups: crear propio" on public.lineups for insert with check (created_by = auth.uid());
create policy "lineups: editar propio" on public.lineups for update using (created_by = auth.uid());
```

- [ ] Migración escrita en `supabase/migrations/0001_init.sql`
- [ ] `npx supabase db push` corrido con éxito (requiere Fase 1 completa)
- [ ] Verificar en el dashboard de Supabase (Table Editor) que las 5 tablas existen

---

## 4. Cliente y auth

- [ ] Reemplazar todo el contenido de `src/api/base44Client.js` por:
  ```js
  import { createClient } from '@supabase/supabase-js';

  export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  ```
- [ ] Borrar `src/lib/app-params.js` (todo el concepto de "app bootstrap" multi-tenant de Base44
      desaparece — Supabase es single-tenant).
- [ ] Reescribir `src/lib/AuthContext.jsx`: sacar el chequeo de "app public settings" (era
      específico de Base44). Usar `supabase.auth.getSession()` al montar +
      `supabase.auth.onAuthStateChange()` para mantener `user`/`isAuthenticated` actualizados.
      Traer el `role` haciendo `supabase.from('profiles').select('role').eq('id', user.id).single()`.
      Sacar `appPublicSettings`, `isLoadingPublicSettings` y cualquier `authError.type` que no sea
      un error real de auth.
- [ ] `src/components/ProtectedRoute.jsx`: sacar la rama de `user_not_registered`.
- [ ] `src/App.jsx`: sacar la ruta de `OAuthConsent`, el import, y la rama que redirige a
      `UserNotRegisteredError`.
- [ ] Borrar `src/pages/OAuthConsent.jsx` y `src/components/UserNotRegisteredError.jsx`.
- [ ] `src/pages/Login.jsx`: `base44.auth.loginViaEmailPassword(email, password)` →
      `supabase.auth.signInWithPassword({ email, password })`. Sacar el botón/handler de Google.
- [ ] `src/pages/Register.jsx`: `base44.auth.register({email, password})` → `supabase.auth.signUp({email, password})`.
      Para mantener la pantalla de código OTP: `supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' })`
      en vez de `verifyOtp`+`setToken` manual (Supabase setea la sesión solo).
      `resendOtp` → `supabase.auth.resend({ type: 'signup', email })`. Sacar el botón de Google.
      ⚠️ Esto requiere que en el dashboard de Supabase → Auth → Email Templates, el template de
      confirmación incluya `{{ .Token }}` (el código de 6 dígitos), no solo el link — avisale a
      la persona que lo revise si el código no le llega.
- [ ] `src/pages/ForgotPassword.jsx`: `base44.auth.resetPasswordRequest(email)` →
      `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- [ ] `src/pages/ResetPassword.jsx`: reestructurar — ya no hay `?token=` por query param. Escuchar
      `supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') {...} })`
      y en el submit llamar `supabase.auth.updateUser({ password: newPassword })`.
- [ ] `src/components/dfs/AppHeader.jsx`: `base44.auth.isAuthenticated()` → derivar de
      `supabase.auth.getSession()`; `base44.auth.logout()` → `supabase.auth.signOut()`.
- [ ] `src/lib/PageNotFound.jsx`: `base44.auth.me()` → `supabase.auth.getUser()` +
      lookup de `role` en `profiles` (igual que en `AuthContext.jsx`).
- [ ] `src/lib/authReturnTo.js`: simplificar la lista de params a limpiar del `returnTo` — ya no
      existen `access_token/app_id/app_base_url/functions_version/from_url` de Base44 (mantené el
      chequeo de same-origin, es una protección de seguridad real, no específica de Base44).

---

## 5. Capa de datos (reemplazar `base44.entities.X` por `supabase.from('x')`)

Convenciones de Base44 que hay que traducir en cada archivo:
- `entities.X.get(id)` → `.from('x').select('*').eq('id', id).single()`
- `entities.X.list(sortStr, limit)` → `.from('x').select('*').order(campo, {ascending}).limit(limit)`
  (`sortStr` tipo `"-created_date"` = descendente por ese campo, sin el `-` = ascendente)
- `entities.X.filter(where, sortStr, limit)` (incluye `{ $in: [...] }`) →
  `.select('*').eq(...)/.in(...)/.order(...)/.limit(...)`
- `entities.X.create(data)` → `.insert(data).select().single()`
- `entities.X.update(id, data)` → `.update(data).eq('id', id)`
- `entities.X.delete(id)` → `.delete().eq('id', id)`
- Renombrar en todo el código: `created_date` → `created_at`, `created_by_id` → `created_by`.

Archivos a tocar (leé cada uno antes de editar, esta lista es la referencia de qué esperar, no un
reemplazo ciego):

- [ ] `src/pages/Home.jsx` — `Contest.list("-created_date", 50)`
- [ ] `src/pages/Players.jsx` — `Player.list("-projected_points", 500)`, `Player.delete(p.id)`
- [ ] `src/pages/ContestDetail.jsx` — `Contest.get`, `League.get`, `Player.filter` (con `$in` de
      `allowed_teams`), `Lineup.filter`, `Contest.update`, y `me?.id` comparado con `created_by`
- [ ] `src/pages/LeagueDetail.jsx` — `League.get`, `Contest.filter({league_id}, "-created_date", 50)`
- [ ] `src/components/dfs/CreateContestDialog.jsx` — `Contest.create({...})`
- [ ] `src/components/dfs/CreateLeagueDialog.jsx` — `League.create({...})`
- [ ] `src/components/dfs/LineupBuilder.jsx` — `Lineup.create`/`Lineup.update`
- [ ] `src/components/dfs/PlayerDialog.jsx` — `Player.create`/`Player.update`
- [ ] `src/components/dfs/Standings.jsx` — usa `created_by_id` para resaltar "tu equipo"

---

## 6. Imágenes

- [ ] Simplificar `src/components/ui/image-helpers.js`: sacar la detección de
      `media.base44.com`/`static.wixstatic.com` y el armado de transform URLs. Dejar solo lo
      mínimo que `image.jsx` necesite (o inlinear un `<img>` simple ahí directamente).
- [ ] `src/components/ui/image.jsx`: renderizar `<img src={src} onError={...fallback local...} />`
      sin lógica de CDN. Usar un asset local del proyecto como fallback en vez del de Wix.

---

## 7. Función `syncNFLDFS`

- [ ] Crear `supabase/functions/syncNFLDFS/index.ts`:
  ```ts
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  Deno.serve(async (req) => {
    try {
      const authHeader = req.headers.get('Authorization') ?? '';
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

      let body; try { body = await req.json(); } catch { body = {}; }
      const replace = !!body?.replace;

      let date = body?.date;
      if (!date) {
        const d = new Date();
        const day = d.getDay();
        const addDays = (7 - day) % 7 || 7;
        d.setDate(d.getDate() + addDays);
        date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      }
      if (!/^\d{8}$/.test(String(date))) {
        return Response.json({ error: 'date must be YYYYMMDD' }, { status: 400 });
      }

      const apiKey = Deno.env.get('RAPIDAPI_KEY');
      if (!apiKey) return Response.json({ error: 'RAPIDAPI_KEY not set' }, { status: 500 });

      const url = `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLDFS?date=${date}&includeTeamDefense=true`;
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
      });
      if (!res.ok) return Response.json({ error: `Upstream ${res.status}` }, { status: 502 });
      const data = await res.json();

      const slate = data?.body?.draftkings;
      if (!Array.isArray(slate)) return Response.json({ error: 'Unexpected API shape' }, { status: 502 });

      const seen = new Set();
      const normalized = [];
      for (const item of slate) {
        const name = item.longName, team = item.team, position = item.pos;
        const salary = Number(item.salary) || 0;
        if (!name || !position || !team) continue;
        const key = `${name.toLowerCase()}|${(team || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push({ name, team, position, salary, projected_points: 0, actual_points: 0, sport: 'NFL' });
      }

      if (replace) {
        await admin.from('players').delete().eq('sport', 'NFL');
        const { data: created } = await admin.from('players').insert(normalized).select();
        return Response.json({ created: created?.length ?? 0, updated: 0, total: normalized.length, date });
      }

      const { data: existing } = await admin.from('players').select('*').eq('sport', 'NFL')
        .order('created_at', { ascending: false }).limit(500);
      const byKey = {};
      for (const p of existing ?? []) byKey[`${(p.name || '').toLowerCase()}|${(p.team || '').toLowerCase()}`] = p;

      const toCreate = [], toUpdate = [];
      for (const n of normalized) {
        const key = `${n.name.toLowerCase()}|${(n.team || '').toLowerCase()}`;
        const found = byKey[key];
        if (found) {
          if (found.salary !== n.salary || found.position !== n.position) {
            toUpdate.push({ id: found.id, salary: n.salary, position: n.position });
          }
        } else {
          toCreate.push(n);
        }
      }

      let created = 0, updated = 0;
      if (toCreate.length) {
        const { data } = await admin.from('players').insert(toCreate).select();
        created = data?.length ?? 0;
      }
      for (const u of toUpdate) {
        await admin.from('players').update({ salary: u.salary, position: u.position }).eq('id', u.id);
      }
      updated = toUpdate.length;

      return Response.json({ created, updated, total: normalized.length, date });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  });
  ```
- [ ] `npx supabase secrets set RAPIDAPI_KEY=<la key de la Fase 1>`
- [ ] `npx supabase functions deploy syncNFLDFS`
- [ ] `src/components/dfs/SyncNFLDFS.jsx`: `base44.functions.invoke("syncNFLDFS", {date, replace})`
      → `supabase.functions.invoke('syncNFLDFS', { body: { date, replace } })`. Ojo con el
      envelope de la respuesta: Base44 daba `resp.data.data`, Supabase da `{ data, error }`
      directo — un nivel de anidación menos.

---

## 8. Limpieza final

- [ ] Borrar la carpeta `base44/` completa (`config.jsonc`, `entities/`, `functions/`) — ya está
      todo migrado a `supabase/`.
- [ ] `grep -ri base44 src package.json vite.config.js` no debería devolver nada.
- [ ] Actualizar `README.md` y `AGENTS.md` para que digan Supabase en vez de Base44 CLI/dashboard
      (cómo correr `npm run dev`, cómo aplicar migraciones, cómo deployar funciones).

---

## 9. Verificación (no marques la migración como terminada sin esto)

- [ ] `npm run build`, `npm run lint`, `npm run typecheck` sin errores.
- [ ] `npm run dev` y probar a mano: registro con código OTP, login, logout, forgot/reset
      password, crear liga, crear contest, armar un lineup, listar/crear/borrar jugadores en
      `/players`, correr "Sync NFL DFS".
- [ ] Marcar el primer usuario admin a mano en el SQL editor de Supabase:
      `update public.profiles set role = 'admin' where id = '<uuid del usuario>';`
      (el uuid se ve en Authentication → Users en el dashboard).

## 10. Recién ahora — avisarle a la persona

Cuando **todo** lo de arriba esté tildado y verificado funcionando: avisale que puede cancelar la
suscripción de Base44. De acá en adelante, para pedir features nuevas o arreglar bugs, alcanza con
que te describa lo que quiere en una frase — no necesita este documento de nuevo, es solo para
esta migración puntual.
