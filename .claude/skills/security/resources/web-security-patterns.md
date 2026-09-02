# Wzorce Bezpieczeństwa (Next.js 15 + Drizzle + Redis)

Wzorce specyficzne dla tego stacku. Każdy blok to para: **antywzorzec** (co znajdujesz w audycie) → **wzorzec** (co rekomendujesz w remediation).

---

## 1. Server Action — autoryzacja i walidacja

Server Action to publiczny endpoint POST. Brak bramki w funkcji = brak bramki w ogóle.

```ts
// ❌ ANTYWZORZEC — ufa, że wywoła to tylko dashboard
'use server';
export async function deleteService(id: string) {
    await db.delete(servicesTable).where(eq(servicesTable.id, Number(id)));
    revalidatePath('/dashboard');
}
```

Trzy luki: brak sprawdzenia uprawnień, brak walidacji (`Number('abc')` → `NaN`), brak potwierdzenia, że rekord należy do wołającego.

```ts
// ✅ WZORZEC — guard clauses, walidacja Zod, zawężenie do właściciela
'use server';

const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

export async function deleteService(input: unknown): Promise<ActionResult> {
    const actor = await requireDashboardAccess();          // rzuca/zwraca błąd, nie zwraca null po cichu
    if (!actor) return { error: { code: 'FORBIDDEN', message: 'Brak uprawnień' } };

    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) return { error: { code: 'BAD_INPUT', message: 'Nieprawidłowe dane' } };

    const deleted = await db
        .delete(servicesTable)
        .where(and(eq(servicesTable.id, parsed.data.id), eq(servicesTable.ownerId, actor.id)))
        .returning({ id: servicesTable.id });

    if (deleted.length === 0) return { error: { code: 'NOT_FOUND', message: 'Nie znaleziono' } };

    revalidatePath('/dashboard');
    return { data: { id: deleted[0].id } };
}
```

**Uwaga o tym repo:** `requireDashboardAccess()` nie istnieje — dashboard nie ma dziś warstwy auth. W findingu wskaż to explicite: rekomendacja to dodanie bramki (middleware + sprawdzenie w akcji), nie „dopisanie TODO".

**Schema współdzielona z formularzem:** ta sama schema Zod w Server Action i w `zodResolver` react-hook-form. Duplikat reguł = rozjazd walidacji przy pierwszej zmianie.

---

## 2. Route handler — walidacja + rate limiting

Wzorzec referencyjny w repo: `src/app/api/submit-contact-query/route.ts`.

```ts
export async function POST(request: Request) {
    // 1. Rate limit PRZED kosztowną operacją
    const ip = getClientIP(request);
    const limit = await checkRateLimit(ip);
    if (limit.blocked) {
        return NextResponse.json(
            { error: { code: 'RATE_LIMITED', message: 'Za dużo żądań' } },
            { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
        );
    }

    // 2. Walidacja Zod PRZED użyciem danych
    const body = await request.json().catch(() => null);
    const parsed = ContactFormSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: { code: 'BAD_INPUT', message: 'Nieprawidłowe dane' } }, { status: 400 });
    }

    // 3. Happy path na końcu
    await sendMail(parsed.data);
    return NextResponse.json({ data: { ok: true } });
}
```

**Podrabialny IP:** `x-forwarded-for` pochodzi z requesta. Na Vercelu limit oparty wyłącznie o ten nagłówek obchodzi się jednym nagłówkiem — użyj nagłówka wstrzykiwanego przez platformę i traktuj IP jako heurystykę, nie tożsamość. Przy operacjach kosztownych dodaj drugi wymiar (e-mail, konto, cooldown na treść).

**Kolejność ma znaczenie:** limit → walidacja → operacja. Walidacja po wysłaniu maila nie chroni budżetu.

---

## 3. Drizzle — surowy SQL i bezpieczne zapytania

```ts
// ❌ CRITICAL — konkatenacja user inputu
const rows = await db.execute(sql.raw(`select * from services where name ilike '%${q}%'`));

// ✅ Placeholder — Drizzle parametryzuje wartość
const rows = await db
    .select({ id: servicesTable.id, name: servicesTable.name })
    .from(servicesTable)
    .where(sql`${servicesTable.name} ilike ${'%' + q + '%'}`);
```

```ts
// ❌ eslint-plugin-drizzle to wyłapie — brak where kasuje całą tabelę
await db.delete(servicesTable);

// ✅ zawsze where, najlepiej z returning() do weryfikacji ile rekordów poszło
await db.delete(servicesTable).where(eq(servicesTable.id, id)).returning({ id: servicesTable.id });
```

**Enumy z requesta:** `z.enum(categoryEnum.enumValues)` — nie `value as Category`. Rzutowanie przepuszcza dowolny string do zapytania.

**Nadmiar kolumn:** `select()` bez argumentu zwraca cały rekord. Jeśli wynik leci do klienta, wypisz kolumny — inaczej każde nowe pole w schemacie automatycznie wycieka.

---

## 4. Sekrety i granica server/client

```ts
// ❌ CRITICAL — trafia do bundla przeglądarki
export const env = createEnv({
    client: { NEXT_PUBLIC_OPENAI_API_KEY: NonEmpty },
    // ...
});

// ✅ sekret w bloku server, klient dostaje tylko to, co może być publiczne
export const env = createEnv({
    server: { OPENAI_API_KEY: NonEmpty },
    client: { NEXT_PUBLIC_SITE_URL: NonEmpty },
    // ...
});
```

```ts
// ✅ moduł czytający bazę pilnuje granicy sam
import 'server-only';
import { db } from '@/db';
```

Bez `server-only` jeden import z Client Component wciąga moduł (i sekrety) do bundla — błąd wyjdzie dopiero w buildzie, albo wcale.

**Props są publiczne:** wszystko, co Server Component przekazuje do Client Component, ląduje w HTML strony. `<AdminPanel user={fullUserRow} />` publikuje cały rekord, w tym pola, których UI nie renderuje.

**Logi:** `console.log(formData)` przy formularzu kontaktowym zapisuje treść i e-mail nadawcy do logów Vercela. `no-console` jest ustawione na `warn` — traktuj jako sygnał, nie jako ochronę.

---

## 5. XSS i treść zewnętrzna

React escapuje domyślnie. Pułapki:

```tsx
// ❌ HIGH — treść od użytkownika renderowana jako HTML
<div dangerouslySetInnerHTML={{ __html: post.body }} />

// ✅ MDX z zaufanego repo (content/) renderuj przez next-mdx-remote,
//    a treść od użytkownika traktuj jako tekst
<p>{post.body}</p>
```

```tsx
// ❌ javascript: przechodzi przez href
<a href={service.webpage}>Strona</a>

// ✅ walidacja schematu i hosta
const safeUrl = (raw: string): string | null => {
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
        return null;
    }
};
```

**MDX:** pliki w `content/posts` i `content/terms` są kodem, nie danymi — MDX potrafi wykonać JSX. Treść dodawana przez osoby z zewnątrz (PR, panel) wymaga review, nie sanityzacji runtime.

---

## 6. SSRF — fetch po URL od użytkownika

```ts
// ❌ HIGH — użytkownik wskazuje, gdzie serwer ma pójść (metadane sieci wewnętrznej, 169.254.x.x)
const res = await fetch(userProvidedUrl);

// ✅ allowlista hosta + weryfikacja PO redirectach
const ALLOWED_HOSTS = new Set(['images.example.com', 'cdn.example.com']);

const target = new URL(userProvidedUrl);
if (!ALLOWED_HOSTS.has(target.host)) throw new AppError('BLOCKED_HOST');

const res = await fetch(target, { redirect: 'follow' });
if (!ALLOWED_HOSTS.has(new URL(res.url).host)) throw new AppError('BLOCKED_REDIRECT');
```

Sprawdzenie tylko przed fetchem nie wystarcza: dozwolony host może przekierować na `localhost`. Walidacja `response.url` po fetchu jest przenośna między runtime'ami (Node, edge) — nie polegaj na `redirect: 'error'`, bo nie wszędzie działa.

---

## 7. Uploady plików

```ts
// ❌ typ z Content-Type (podrabialny), nazwa wprost od użytkownika (path traversal)
const ext = file.type.split('/')[1];
await writeFile(path.join('public/uploads', file.name), buffer);

// ✅ allowlista typów, limit rozmiaru, nazwa generowana, weryfikacja zawartości
if (!ALLOWED_IMAGE_TYPES.has(file.type)) return badRequest('Nieobsługiwany typ');
if (file.size > MAX_IMAGE_SIZE) return badRequest('Plik za duży');

const safeName = `${slugify(baseName, { lower: true, strict: true })}-${hash}.webp`;
const buffer = await sharp(await file.arrayBuffer()).webp().toBuffer();  // re-encode = strip metadanych i payloadów
await writeFile(path.join(UPLOAD_DIR, path.basename(safeName)), buffer);
```

Re-encode przez `sharp` jest jednocześnie walidacją: plik, który nie jest obrazem, wysadzi konwersję zamiast wylądować w `public/`.

---

## 8. Nagłówki i konfiguracja

- `next.config.ts` → `headers()`: `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`. Brak = LOW (hardening), ale przy formularzach i mapach warto.
- CORS na route handlerach: `Access-Control-Allow-Origin: *` na endpoincie mutującym = finding. Publiczny GET — świadoma decyzja.
- Nowe domeny w `images.remotePatterns` — każdy wpis to zaufanie do zewnętrznego hosta.
- `npm audit` przed deployem; CVE w zależności produkcyjnej traktuj jak finding z terminem, nie jak informację.

---

## 9. Checklist szybkiego audytu PR

- [ ] Każdy nowy endpoint/Server Action: walidacja Zod na wejściu
- [ ] Każda mutacja: sprawdzenie uprawnień PRZED dotknięciem bazy
- [ ] Każdy publiczny endpoint: rate limiting (Redis), limit przed kosztowną operacją
- [ ] Zapytania: `where` przy `update`/`delete`, wypisane kolumny w `select`, brak konkatenacji SQL
- [ ] Nowe zmienne: w `env.ts` (`server` vs `client`) + `runtimeEnv`, sekret nigdy w `NEXT_PUBLIC_*`
- [ ] Moduły czytające bazę: `import 'server-only'`
- [ ] Brak `console.log` z PII / treścią / tokenami
- [ ] `dangerouslySetInnerHTML`, `href`/`src` z user inputu, `fetch` po URL od użytkownika — uzasadnione i zwalidowane
- [ ] Uploady: allowlista typów, limit rozmiaru, generowana nazwa, re-encode
- [ ] Odpowiedź błędu nie zawiera surowej treści błędu bazy
