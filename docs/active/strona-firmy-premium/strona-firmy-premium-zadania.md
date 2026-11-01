# Zadania: Strona firmy — darmowy profil + Premium

**Branch:** `feature/strona-firmy-premium` (worktree: `C:\Users\mateu\WebstormProjects\polvia-strona-firmy`)
**Ostatnia aktualizacja:** 2026-11-01 (review fazy 3)

## Źródła

- Requirements doc: [docs/dev-brainstorms/2026-10-31-strona-firmy-premium-requirements.md](../../dev-brainstorms/2026-10-31-strona-firmy-premium-requirements.md)
- Plan techniczny: [docs/plans/2026-10-31-001-feat-strona-firmy-premium-plan.md](../../plans/2026-10-31-001-feat-strona-firmy-premium-plan.md)

## Legenda

| Prefiks | Znaczenie |
|---|---|
| (brak) | zadanie implementacyjne |
| `Test:` | scenariusz testowy (z planu technicznego) |
| `Weryfikacja:` | kryterium automatyczne (CLI); odznaczane przez `/dev-docs-review` po PASS |
| `Operator:` | krok wymagający człowieka; **nie** odznaczany automatycznie |

> Projekt nie ma `.env.e2e`, więc scenariusze przeglądarkowe są krokami `Operator:`, nie `[E2E]`.
> **`DATABASE_URL` wskazuje na produkcję.** Każdy `drizzle-kit push`, backfill i skrypt `db:*` to `Operator:`, po `--dry-run`.

---

## Faza 1 — Darmowy profil

### U1. Slug usługi + zapytania profilu

**Delegate to:** `feature-builder-web-data` · **Nakład:** M · **Zależności:** brak
**Wymagania:** R1, R2, R3

- [x] `src/db/schema.ts`: kolumna `services.slug` (unikalna; najpierw nullowalna)
- [x] `src/db/backfill-service-slugs.ts`: idempotentny backfill (`buildServiceSlug` + sufiks przy kolizji, kolejność po `createdAt`); skrypt w `package.json`
- [x] `src/db/seed.ts`: `seedService` zapisuje `slug` usługi
- [x] `src/db/add-service.ts` + `src/db/service-input-schema.ts`: zapis slugu usługi, odrzucenie zajętego slugu z czytelnym komunikatem
- [x] `src/lib/service-profile-queries.ts` (`server-only`): `getServiceProfile(slug, locale)`, `getSimilarServices(serviceId, locale)` (ta sama kategoria, bez siebie, najpierw to samo miasto, max 6), `getServiceSlugStatus(slug)`; typy z `InferSelectModel`
- [x] `Test:` `locale='uk'` daje nazwę i opis z tłumaczenia `uk`; brak tłumaczenia daje `services.name`
- [x] `Test:` wpis o `status != 'active'` daje `null`
- [x] `Test:` wpis online-only (lokalizacje bez współrzędnych) zwraca lokalizacje z `latitude = null` bez błędu
- [x] `Test:` `getSimilarServices`: bez samego wpisu, ta sama kategoria, max 6, to samo miasto na początku
- [x] `Test:` backfill: dwie usługi o tej samej nazwie dostają `nazwa` i `nazwa-2`; ponowny run bez zmian
- [x] `Test:` `add-service` odrzuca JSON z zajętym slugiem usługi
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest src/lib/service-profile-queries src/lib/similar-services src/db/service-slugs src/db/service-input-schema` przechodzi (4 suite'y; `add-service.ts` odpala `main()` przy imporcie, więc logika kolizji jest testowana w `service-slugs.test.ts`)
- [x] `Weryfikacja:` grep: `src/lib/service-profile-queries.ts` zawiera `import 'server-only'`
- [ ] `Operator:` `npx drizzle-kit push` (kolumna nullowalna) **na produkcji**; potwierdzić kolumnę w `information_schema`
- [ ] `Operator:` uruchomić backfill, sprawdzić brak `NULL`, potem `push` z `notNull`

### U2. Routing `/firma/[slug]`, lookup w middleware, sitemap

**Delegate to:** `feature-builder-web-data` · **Nakład:** M · **Zależności:** U1
**Wymagania:** R1, R6

- [x] `src/i18n/routing.ts`: `'/firma/[slug]'` w `pathnames`
- [x] `src/lib/service-profile-path.ts`: czyste funkcje
  - `parseServiceProfilePathname`
  - `isReservedRootSegment` (locale, segmenty `pathnames` pl i en, `api`, `firma`, `dashboard`, `thanks`, przekierowania z `next.config.ts`, katalogi `public/`)
  - `buildServiceProfilePath(locale, slug)` przez `localePathPrefix()`
  - walidacja formatu slugu
- [x] `src/app/api/service-slug/[slug]/route.ts`: GET, runtime Node, Zod na parametrze, odpowiedź `{ data: { exists }, error }`, rate limit z poprawnym IP klienta przy wywołaniu z middleware
- [x] `src/middleware.ts`: gałąź `/firma/<slug>` przed next-intl. Lookup z jawnym timeoutem; brak wpisu daje status 404; awaria lookupu przepuszcza żądanie dalej. Kolejność gałęzi opisana komentarzem.
- [x] `src/app/sitemap.ts`: profile aktywnych wpisów × 4 locale
- [x] `Test:` `parseServiceProfilePathname`: `/firma/abc` → `{ locale: 'pl', slug: 'abc' }`; `/uk/firma/abc` → `uk`; `/firma/` i `/firma/a/b` → `null`
- [x] `Test:` `buildServiceProfilePath`: `pl` → `/firma/x`, `ru` → `/ru/firma/x`; **asercja negatywna:** żadne locale poza `en` nie dostaje `/en`
- [x] `Test:` `isReservedRootSegment` jest prawdą dla `mapa`, `cennik`, `pricing`, `blog`, `en`, `api`, `firma`, `services`, `privacy`
- [x] `Test:` route handler: istniejący slug → 200 `exists: true`; nieistniejący → `exists: false`; niepoprawny format → 400 z `error.code`
- [x] `Test:` sitemap zawiera profil w 4 wariantach locale i nie zawiera wpisów nieaktywnych
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest src/lib/service-profile-path "src/app/api/service-slug" src/app/sitemap` przechodzi (liczba suite'ów zgodna z oczekiwaną)
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [ ] `Operator:` sprawdzić status przez `curl -o /dev/null -w "%{http_code}"`:
  - `/firma/nie-istnieje` → `404`
  - `/firma/<istniejący>` → `200`
  - to samo dla `/uk/firma/...`
  - nie mierzyć po `npm run build` przy działającym dev serverze

### U3. Kierunek wizualny: komponenty profilu free i 3 szablonów

**Delegate to:** `feature-builder-web-ui` · **Nakład:** L · **Zależności:** brak (równolegle z U1 i U2)
**Wymagania:** R2, R3, R7, R8, R9

- [x] `src/lib/premium-templates.ts`: `PREMIUM_TEMPLATES = ['gallery','professional','classic']`, limity galerii (bez zod i `src/db`)
- [x] `_components/service-profile-types.ts`: kontrakt `ServiceProfileView` (dane free + opcjonalne `premium`)
- [x] `_components/profile-fixtures.ts` z fixture'ami:
  - wpis lokalny z kompletem danych,
  - wpis online-only,
  - wpis bez logo,
  - premium z 12 zdjęciami, cennikiem i FAQ
- [x] `_components/profile-free/` (`.tsx`, `.test.tsx`, `.stories.tsx`): „Podobne firmy” + CTA „To moja firma — ulepsz stronę” jako link
- [x] `_components/template-gallery/`, `template-professional/`, `template-classic/` (każdy z testem i stories)
- [x] Sekcje współdzielone w folderach z testem: `profile-contact`, `profile-hours`, `profile-price-list`, `profile-faq`, `profile-gallery`, `similar-services`
- [x] Mapa jako statyczny podgląd albo link „pokaż na mapie” (`buildServiceUrl`), bez osadzania Mapboxa
- [x] Bez nowej biblioteki karuzeli/lightboxa (preferować `<dialog>`). Każda nowa paczka tylko za zgodą usera.
- [x] `messages/{pl,en,ru,uk}.json`: namespace `ServiceProfile`
- [x] `Test:` każdy szablon i profil free renderuje nazwę jako `h1`; `jest-axe` bez naruszeń
- [x] `Test:` profil free online-only: brak sekcji mapy i adresu, jest badge „online”
- [x] `Test:` szablon bez `premium.gallery` nie renderuje pustej sekcji galerii
- [x] `Test:` `profile-free` renderuje „Podobne firmy” i CTA jako link
- [x] `Test:` cennik renderuje pozycje w kolejności z danych, z ceną jako tekstem
- [x] `Test:` FAQ rozwijane (`<details>` lub odpowiednik), dostępne z klawiatury
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest "src/app/\[locale\]/firma"` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [x] `Weryfikacja:` grep: żaden plik w `src/app/[locale]/firma/**` nie importuje `next/link` ani `next/navigation` (PASS z adnotacją: jedyne trafienie to `notFound` z `next/navigation` w `page.tsx` — `@/i18n/navigation` go nie eksportuje)
- [x] `Weryfikacja:` `npx jest src/i18n/messages-parity` przechodzi
- [ ] `Operator:` **bramka:** user przegląda w Storybooku profil free i 3 szablony (desktop 1440 i mobile 390) i akceptuje kierunek przed U4 i U7

### U4. Strona profilu (free), metadane, linki z karty i popupu

**Delegate to:** `feature-builder-web-ui` · **Nakład:** M · **Zależności:** U1, U2, U3
**Wymagania:** R1, R2, R3, R4 (link), R5, R6

- [x] `src/app/[locale]/firma/[slug]/page.tsx`: Server Component (`getServiceProfile` + `getSimilarServices`), bez `<Suspense>` przed danymi; `notFound()` tylko jako siatka bezpieczeństwa
- [x] `src/app/[locale]/firma/not-found.tsx`: własny, nie kopia `map/not-found.tsx`
- [x] `src/lib/service-profile-metadata.ts`, czyste funkcje:
  - canonical,
  - `alternates.languages` ×4 + `x-default`,
  - opis meta z obcięciem,
  - JSON-LD (`LocalBusiness` albo `Organization` dla online-only)
- [x] `generateMetadata`: tytuł `<nazwa> — <kategoria>, <miasto> | Polvia`; `openGraph.images` = logo
- [x] CTA w fazie 1 → `/pricing` (`Link` z `@/i18n/navigation`)
- [x] `src/lib/queries.ts`: `getServices` zwraca `services.slug`; `src/types/index.ts` dostaje to pole tylko gdy potrzebne
- [x] `service-card.tsx`: link „Zobacz profil” w sekcji rozwiniętej (`@/i18n/navigation`, `stopPropagation`)
- [x] `marker-popup.tsx`: link do profilu
- [x] `messages/{pl,en,ru,uk}.json`
- [x] `Test:` canonical `ru` = `/ru/firma/x`; `languages` ma 4 locale + `x-default`; asercja negatywna na `/en`
- [x] `Test:` JSON-LD dla online-only bez `address` i `geo`
- [x] `Test:` opis meta obcięty do limitu bez cięcia w środku słowa
- [x] `Test:` `service-card`: rozwinięta karta ma link „Zobacz profil” z `href` w bieżącym locale; klik nie zwija karty
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest src/lib/service-profile-metadata "src/app/\[locale\]/\(main\)/_components/service-card"` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [x] `Weryfikacja:` grep: `src/app/[locale]/firma/[slug]/page.tsx` nie zawiera `'use client'`
- [ ] `Operator:` sprawdzić `/firma/<slug>` i `/uk/firma/<slug>` w przeglądarce:
  - `h1` z nazwą, „Podobne firmy”,
  - CTA prowadzi do `/cennik` (pl) albo `/uk/pricing` (uk),
  - zero błędów konsoli,
  - `hreflang` ×4 w źródle strony
- [ ] `Operator:` z `/mapa` rozwinąć kartę, kliknąć „Zobacz profil”: otwiera się profil tej firmy

## Do poprawy po review fazy 1

Raport: [review-faza-1.md](review-faza-1.md). Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 9 × P2, 17 × P3).
Przed fazą 2 naprawić #5–#8 (adresy profili i kontrakt widoku) oraz #1. Pozostałe P2 przed wdrożeniem fazy 1 na produkcję.

- [x] 🟠 [important] **`service-card.tsx:767`, `marker-popup.tsx`, `similar-services.tsx`**: prefetch linków do profilu odpala lookup w middleware i wyczerpuje limit. Dodać `prefetch={false}`.
- [x] 🟠 [important] **`src/middleware.ts:47`, `service-slug-lookup.ts:43`, `api/service-slug/[slug]/route.ts:46`**: założenie o XFF przeczy samo sobie (globalny kubełek albo obejście limitu).
  - Ruch z middleware uwierzytelniony sekretem z `env.ts`, z osobnym limitem.
  - Ruch publiczny dostaje limit po IP platformy.
  - Test: żądanie bez sekretu i z podrobionym XFF nie omija limitu.
- [x] 🟠 [important] **`service-slug-lookup.ts:43`, `route.ts:96`**: lookup bez cache.
  - `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` dla `exists:true`, `s-maxage=30` dla `false`.
  - Usunąć `cache: 'no-store'`.
- [x] 🟠 [important] **`service-profile-queries.ts:181-218`, `similar-services.ts`, `page.tsx:108`, `schema.ts`**: podobne firmy.
  - `ORDER BY (miasto = źródło) DESC, name LIMIT 6` w SQL.
  - Sygnatura `({ serviceId, category, city }, locale)` bez ponownego pobierania.
  - `Promise.all` z lokalizacjami.
  - Indeks `(service_id, is_main_location)` na `service_locations`.
- [x] 🟠 [important] **`service-input-schema.ts:119` vs `service-profile-path.ts:19`**: jeden format slugu w lekkim module dla zod i middleware. Test: `buildServiceSlug(x)` zawsze przechodzi `isValidServiceSlug`.
- [x] 🟠 [important] **`add-service.ts:208` vs `seed.ts:169`**: slug usługi zawsze z nazwy (`createServiceSlugAllocator` z zajętymi slugami z bazy), także w `db:add`.
  - `slug` w JSON zostaje wyłącznie bazą slugów lokalizacji.
  - Logika w czystym module z testem.
  - Komentarz w `schema.ts`.
- [x] 🟠 [important] **`template-*.tsx`, `service-profile-types.ts:84`**: dane premium przekazywane dwa razy. `PremiumProfileView = ServiceProfileView & { premium: PremiumContent }`, szablony przyjmują tylko `{ profile }`.
- [x] 🟠 [important] **`service-profile-types.ts:22-37`, `to-profile-view.ts:22-39`**: `ProfileLocation` przez `Omit<ServiceProfileLocation, 'slug'>`, usunąć mapper-kopistę. Jeden typ `OpeningHours` w `@/lib/weekdays` (P3 #14).
- [x] 🟠 [important] **`firma/[slug]/page.tsx:49-96`**: `generateMetadata` i `toSameAs` bez testu.
  - Pusty lub biały opis daje pusty `<meta description>`; dać fallback po `trim()`.
  - Testy: `null` daje `noindex`; opis `null` / `''` / `'   '`; brak logo w `openGraph`.
- [x] 🟡 [nit] **`profile-helpers.ts`, `page.tsx:38`**: `toSafeExternalHref` (tylko `https?:`) dla socials i `sameAs`; puste i białe stringi pominięte.
- [x] 🟡 [nit] **`language-switcher.tsx:56`**: ogólna obsługa tras z parametrem (`pathname.includes('[')`).
- [x] 🟡 [nit] **`service-card.tsx:766`, `marker-popup.tsx:101`**: wspólny `ServiceProfileLink` z tokenem `brand`.
- [x] 🟡 [nit] **`template-*.tsx`, `profile-free.tsx`**: funkcje JSX > 50 linii; wydzielić hero/nagłówek.
- [x] 🟡 [nit] **`template-classic.tsx:46,62`**: `priority` tylko na cover.
- [x] 🟡 [nit] Pozostałe P3 (#18, #20–#23, #25) według raportu, do rozważenia. Zrobione przy poprawkach: #11 (świadomie bez zmiany, komentarz), #15, #17, #24, #26. → 2026-11-01: #18 `splitLocalePrefix`, #20 galeria jako RSC + wyspa kliencka, #21 JSON-LD wg zasięgu, #22 obcięcie tytułu do 60 zn., #23 sitemapa rzuca przy błędzie bazy. #25 bez zmian (middleware nietestowalny w Jeście) — weryfikacja `curl` w „Po wdrożeniu”.

---

## Faza 2 — Treść premium (concierge)

### U6. `service_profiles`, schemat JSON, CLI `db:premium`

**Delegate to:** `feature-builder-web-data` · **Nakład:** M · **Zależności:** U1
**Wymagania:** R7, R8, R9, R13, R17, R18

- [x] `src/db/schema.ts`: enum `profile_template`, tabela `service_profiles`
  - `serviceId` pk
  - `template`, `coverImage`
  - jsonb: `gallery`, `priceList`, `faq`
- [x] `src/db/premium-content-schema.ts`: Zod dla bloku `premium` (tłumaczenia pl/uk/en/ru, limity z `premium-templates.ts`, reeksport stałych)
- [x] `src/db/service-input-schema.ts`: opcjonalny klucz `premium` (strict nie odrzuca pliku)
- [x] `src/db/upsert-premium-content.ts`: idempotentny upsert po slugu usługi; brak pliku zdjęcia w `public/services/<slug>/` przerywa z listą brakujących
- [x] `src/db/publish-premium.ts` + skrypt `db:premium` w `package.json` (`--dry-run` wypisuje diff)
- [x] `src/db/seed.ts`: upsert treści premium dla każdego `data/services/*.json` z blokiem `premium`
- [x] `src/lib/service-profile-queries.ts`: `getServiceProfile` dołącza `premiumContent` (Zod `safeParse`; błąd daje `null` + log)
- [x] `.claude/skills/dodaj/SKILL.md`: sekcja „Wpis premium”:
  1. weryfikacja, że płaci właściciel,
  2. zdjęcia do `public/services/<slug>/`,
  3. `--dry-run`,
  4. stop i OK od usera,
  5. publikacja
- [x] `Test:` poprawny blok przechodzi; brak `ru` w pozycji FAQ odrzuca blok ze ścieżką błędu
- [x] `Test:` nieznany szablon odrzucony; galeria ponad limitem odrzucona
- [x] `Test:` upsert dla nieistniejącego slugu kończy się błędem typowanym (nie cichym no-op)
- [x] `Test:` dwa upserty tych samych danych dają jeden wiersz i identyczną treść
- [x] `Test:` brakujący plik w galerii przerywa z listą brakujących plików
- [x] `Test:` `getServiceProfile` z uszkodzonym jsonb zwraca `premiumContent: null`
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest src/db/premium-content-schema src/db/upsert-premium-content src/lib/service-profile-queries` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [ ] `Operator:` `npx drizzle-kit push` (enum + `service_profiles`) na produkcji; potwierdzić w `information_schema` i `pg_type`

### U7. Profil renderuje szablon premium

**Delegate to:** `feature-builder-web-ui` · **Nakład:** S · **Zależności:** U3, U6, U8 (`isPremiumActive`)
**Wymagania:** R7, R8, R9, R10, R18

- [x] `_components/select-profile-view.ts`: czysta funkcja zwracająca `{ kind: 'free' } | { kind: 'premium', template }`
- [x] `page.tsx`: mapowanie rodzaju widoku na komponent; przy premium bez zapytania o podobne firmy i bez CTA
- [x] `src/lib/service-profile-metadata.ts`: `openGraph.images` = cover przy premium
- [x] `Test:` premium aktywne z `template='gallery'` → `{ kind: 'premium', template: 'gallery' }`
- [x] `Test:` premium aktywne bez `premiumContent` → `classic`
- [x] `Test:` premium wygasłe z zachowaną treścią → `{ kind: 'free' }`
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest "src/app/\[locale\]/firma"` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [ ] `Operator:` **(wykonalne dopiero po U8 — stub subskrypcji zwraca `null`)** wpis z aktywną subskrypcją testową:
  - pokazuje wybrany szablon, bez „Podobnych firm” i bez CTA;
  - po ustawieniu `currentPeriodEnd` w przeszłości (baza testowa, **nie prod**) wraca do free

---

## Do poprawy po review fazy 2

Raport: [review-faza-2.md](review-faza-2.md). Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 4 × P2, 20 × P3). P2-1 i P2-2 naprawić **przed U8**, bo U8 przejmuje ten kontrakt.

- [x] 🟠 [important] **`firma/[slug]/page.tsx:56-65`**: źródło subskrypcji jako stub bez `serviceId`, synchroniczny, w `page.tsx`.
  - `getServiceProfile` zwraca `subscription: PremiumSubscriptionState | null` (do U8 stałe `null` w zapytaniu, w U8 `leftJoin(service_subscriptions)`).
  - `resolveProfileView(profile)` zostaje synchroniczne; jedno `now` dla metadanych i strony.
  - W U8: test negatywny (subskrypcja usługi A nie włącza premium usłudze B).
- [x] 🟠 [important] **`firma/[slug]/page.tsx:120-121`, `:138-151`**: cover w OG tylko przy premium i pomijanie podobnych firm bez testu. Czyste funkcje (`selectOgCoverPath`, `shouldLoadSimilarServices`) w `select-profile-view.ts` z testami: free z treścią → `null`; premium z coverem → src; premium bez treści → `null`.
- [x] 🟠 [important] **`src/db/premium-content-schema.ts:115-151` vs `service-profile-types.ts:35-47`**: dwa ręcznie zsynchronizowane kształty treści premium, projekcja widoku w `src/db`.
  - `LocalizedPremiumContent`, `localizePremiumContent` i `premiumImagePath` przenieść do `src/lib/service-profile-premium.ts`.
  - `PremiumContent = LocalizedPremiumContent` (import type).
- [x] 🟠 [important] **`src/db/upsert-premium-content.ts:180`**: `JSON.parse` przed `hasPremiumBlock`, więc dowolny niepoprawny JSON w `data/services/` przerywa `db:reset` bez nazwy pliku. Owinąć parse (ostrzeżenie z nazwą pliku i pominięcie albo `INVALID_ENTRY` z nazwą) + test z plikiem `'{'`.
- [x] 🟡 [nit] **`premium-content-schema.ts:84-89`**: limit liczby pozycji `priceList`/`faq` (stałe w `premium-templates.ts`) i unikalność `file`/`name`/`q` przez `superRefine` (P3 #12, #13).
- [x] 🟡 [nit] **`upsert-premium-content.ts:74`**: sprawdzanie zdjęć wrażliwe na wielkość liter (Windows vs Vercel) (P3 #14).
- [x] 🟡 [nit] **`.claude/skills/dodaj/SKILL.md`**: blok `premium` w JSON dopiero po weryfikacji płacącego; katalog zdjęć zależy od slugu usługi (P3 #15, #16).
- [x] 🟡 [nit] **przed U8**: sprawdzić w `npm run build`, czy `/[locale]/firma/[slug]` jest dynamiczna; jeśli nie — `revalidatePath` w webhooku (P3 #17). → 2026-11-01: jawne `export const dynamic = 'force-dynamic'` w `page.tsx`; `revalidatePath` niepotrzebny.
- [x] 🟡 [nit] Pozostałe P3 według raportu: zrobione #1 (jeden lookup + adapter w `premium-content-store.ts`), #2, #3, #7–#11, #19, #20; otwarte #4, #5, #6, #18 (do rozważenia). → 2026-11-01: #4 komentarz z uzasadnieniem, #5, #6 (`satisfies Record<Locale, …>`), #18 leniwe parsowanie po decyzji widoku — zrobione.

---

## Faza 3 — Subskrypcja

### U8. Stripe: stan premium, webhook, ranking, resync

**Delegate to:** `feature-builder-web-data` · **Nakład:** L · **Zależności:** U1
**Wymagania:** R12, R15, R18
**Notatka wykonawcza:** test-first. Najpierw `isPremiumActive` i kontrakt webhooka (podpis, dedupe, kolejność), potem implementacja.

- [x] `Operator:` **przed startem U8** user akceptuje zależność `stripe` (2026-11-01: `stripe@23.0.1`)
- [x] `package.json`: `stripe` (przypięta wersja), skrypt `db:sync-subscriptions`
- [x] `env.ts` (server + `runtimeEnv`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PORTAL_LOGIN_URL`
- [x] `src/lib/stripe.ts` (`server-only`, jawny timeout i `apiVersion`)
- [x] `src/db/schema.ts`: tabele `service_subscriptions` (1:1 z usługą) i `stripe_events` (`id` pk)
- [x] `src/lib/premium.ts`: `isPremiumActive`, `PREMIUM_GRACE_DAYS` (domyślnie 3), `premiumRankingExpiry` — **zrobione w fazie 2** (`e4c7f7e`); enum `subscription_status` buduj z `SUBSCRIPTION_STATUSES`
- [x] `src/lib/service-profile-queries.ts`: zamienić stałą `NO_SUBSCRIPTION` w `getServiceProfile` na `leftJoin(service_subscriptions)` po `service_id` (kontrakt `profile.subscription` gotowy po review fazy 2; `page.tsx` bez zmian)
- [x] `Test:` aktywna subskrypcja usługi A nie włącza premium usłudze B (test negatywny z review fazy 2)
- [x] `src/lib/subscription-sync.ts`: `syncSubscriptionFromStripe(subscriptionId)`
  - pobiera subskrypcję,
  - w jednej transakcji: upsert `service_subscriptions` + upsert lub usunięcie `promoted_services`,
  - konflikt drugiej aktywnej subskrypcji: bez nadpisania, z powiadomieniem foundera
- [x] `src/app/api/stripe/webhook/route.ts`:
  - `runtime = 'nodejs'`, `request.text()` + `constructEvent`,
  - dedupe wycofywany przy błędzie,
  - zdarzenia: `checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid`, `invoice.payment_failed`,
  - mail do foundera z timeoutem po zapisie,
  - bez rate limitu (uzasadnienie w komentarzu),
  - odpowiedź `{ data, error }` bez surowych błędów
- [x] `src/db/sync-subscriptions.ts`: CLI odtwarzający stan ze Stripe
- [x] `src/lib/service-profile-queries.ts`: stan premium w `getServiceProfile` i `getServiceSlugStatus`
- [x] `Test:` `isPremiumActive` (faza 2, `src/lib/premium.test.ts`):
  - `active` w okresie → true
  - `past_due` w karencji → true
  - `past_due` po karencji → false
  - `canceled` → false
  - `cancelAtPeriodEnd` przed końcem → true
- [x] `Test:` brak lub zły podpis → 400; synchronizacja nie wołana
- [x] `Test:` to samo `event.id` dwa razy → 200 i synchronizacja raz
- [x] `Test:` błąd synchronizacji → 500, `event.id` nieoznaczone (ponowienie przejdzie)
- [x] `Test:` zawieszony `sendMail` nie blokuje odpowiedzi ponad timeout; handler zwraca 200
- [x] `Test:` `canceled` usuwa wpis z `promoted_services`; `active` ustawia `expiresAt = currentPeriodEnd + grace`
- [x] `Test:` druga aktywna subskrypcja nie nadpisuje stanu i wysyła powiadomienie
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest src/lib/premium src/lib/subscription-sync "src/app/api/stripe"` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [x] `Weryfikacja:` grep: brak `process.env` w nowych plikach; `STRIPE_SECRET_KEY` tylko w sekcji `server` w `env.ts`
- [ ] `Operator:` Stripe Dashboard (test, potem produkcja):
  - produkt „Profesjonalny” z cenami PLN miesięczną i roczną,
  - BLIK recurring (o ile przejdzie akceptację) i karty,
  - Smart Retries z końcową akcją „anuluj”,
  - Customer Portal login link,
  - webhook z wybranymi zdarzeniami
- [ ] `Operator:` zmienne Stripe w Vercelu, osobne dla Preview i Production
- [ ] `Operator:` Fakturownia ↔ Stripe:
  - faktura przy każdej płatności, także przy odnowieniu,
  - wysyłka do KSeF,
  - wyłączone PDF-y ze Stripe
- [ ] `Operator:` `npx drizzle-kit push` (dwie tabele) na produkcji i weryfikacja w `information_schema`
- [ ] `Operator:` lokalnie `stripe listen` + `stripe trigger invoice.payment_failed` oraz `customer.subscription.deleted`
- [ ] `Operator:` konsultacja z księgowym: faktury Stripe za prowizje (odwrotne obciążenie)

### U9. Checkout z profilu + formularz materiałów

**Delegate to:** `feature-builder-web-fullstack` · **Nakład:** M · **Zależności:** U4, U8
**Wymagania:** R4, R14, R16, R17

- [x] `src/app/[locale]/firma/[slug]/_checkout-schema.ts`: Zod (`serviceId` uuid, `interval ∈ {monthly, yearly}`, materiały z limitami długości)
- [x] `_actions.ts` → `startPremiumCheckout`:
  1. Zod,
  2. rate limit,
  3. wpis aktywny, inaczej `ALREADY_PREMIUM`,
  4. cena z allowlisty env,
  5. sesja z `mode: 'subscription'`, `client_reference_id`, `subscription_data.metadata.serviceId`, `tax_id_collection`, `billing_address_collection: 'required'`, `success_url` z `{CHECKOUT_SESSION_ID}` w locale, `cancel_url` na profil,
  6. `redirect(session.url)`
- [x] `_actions.ts` → `submitPremiumMaterials`:
  1. Zod,
  2. rate limit,
  3. ponowna weryfikacja `session_id` w Stripe,
  4. mail do foundera z timeoutem,
  5. typowane błędy
- [x] `_components/upgrade-cta/` (wybór miesięcznie/rocznie + submit; test, stories), który zastępuje link do `/cennik` w `profile-free`
- [x] `premium/dziekujemy/page.tsx`:
  - weryfikuje sesję przed renderem (nieopłacona lub z innego wpisu → komunikat zamiast formularza),
  - informuje „aktywacja w ciągu kilku minut”,
  - link do portalu,
  - adres mailowy dla zdjęć
- [x] `_components/premium-materials-form/` (+ test): `aria-live` na wyniku, `aria-describedby` dla błędów
- [x] `src/i18n/routing.ts`: ścieżka strony sukcesu w `pathnames`, jeśli wymagana
- [x] `messages/{pl,en,ru,uk}.json`
- [x] `Test:` `startPremiumCheckout` z niepoprawnym `interval` → `BAD_INPUT`; Stripe nie wołany
- [x] `Test:` wpis z aktywnym premium → `ALREADY_PREMIUM`
- [x] `Test:` po przekroczeniu limitu → `RATE_LIMITED`
- [x] `Test:` poprawne dane → sesja z ceną z env dla interwału i `client_reference_id = serviceId`
- [x] `Test:` `submitPremiumMaterials` z sesją nieopłaconą lub z innego wpisu → `FORBIDDEN`; mail nie wysłany
- [x] `Test:` błąd `sendMail` → typowany błąd dla użytkownika bez surowego komunikatu
- [x] `Test:` `upgrade-cta` i `premium-materials-form`: `jest-axe` bez naruszeń; błędy przez `aria-describedby`; mocki akcji rozwiązane przed końcem testu
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest "src/app/\[locale\]/firma"` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [x] `Weryfikacja:` `npx jest src/i18n/messages-parity` przechodzi
- [ ] `Operator:` w trybie testowym Stripe, w `pl` i `uk`:
  1. na `/firma/<slug>` wybrać „rocznie” i kliknąć CTA → Checkout,
  2. zapłacić kartą testową → `/firma/<slug>/premium/dziekujemy`,
  3. wysłać formularz → komunikat sukcesu i mail u foundera,
  4. po webhooku profil pokazuje premium

### U10. Krótki adres `polvia.pl/<slug>`

**Delegate to:** `feature-builder-web-data` · **Nakład:** S · **Zależności:** U2, U8
**Wymagania:** R11

- [x] `src/lib/service-profile-path.ts`: `parseRootAliasPathname`
- [x] `src/app/api/service-slug/[slug]/route.ts`: pole `hasActivePremium`
- [x] `src/middleware.ts`: gałąź aliasu
  - tylko jednosegmentowe ścieżki bez prefiksu locale, spoza listy zarezerwowanych,
  - `hasActivePremium` → **307** na `buildServiceProfilePath('pl', slug)`,
  - kolejność: walidacja mapy, `/firma/*`, alias, rewrite i redirect mapy, next-intl
- [x] `Test:` `parseRootAliasPathname`: `/firma-x` → `firma-x`; `/mapa`, `/en`, `/cennik`, `/api`, `/a/b`, `/` → `null`
- [x] `Test:` route: aktywne premium → `hasActivePremium: true`; wygasłe → `false`
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest src/lib/service-profile-path "src/app/api/service-slug"` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [ ] `Operator:` sprawdzić przez `curl`:
  - `/<slug-premium>` → `307 …/firma/<slug-premium>`
  - `/<slug-free>` → `404`
  - `/mapa` i `/cennik` → `200` jak wcześniej

### U11. Przepisanie `/cennik`

**Delegate to:** `feature-builder-web-ui` · **Nakład:** S · **Zależności:** U9
**Wymagania:** R19, R14

- [x] `pricing/page.tsx` jako Server Component (env portalu, tłumaczenia); przełącznik okresu w małym komponencie klienckim `pricing/_components/pricing-plans/` (+ test)
- [x] CTA przez `Link` z `@/i18n/navigation`:
  - free → `/add-business`
  - Profesjonalny → `/map` z instrukcją „znajdź swoją firmę i kliknij Ulepsz”
  - Przedsiębiorstwo → `/contact`
  - link „Zarządzaj subskrypcją” → `STRIPE_PORTAL_LOGIN_URL`
- [x] `messages/{pl,en,ru,uk}.json` → `Pricing.plans.essentials.features`:
  - dodać: szablony, cover i galerię, cennik usług i FAQ, brak „podobnych firm”, krótki adres, wyższą pozycję
  - usunąć: wyszukiwarkę semantyczną, powitanie w social mediach, promocje, WWW i social media jako atut płatny
- [x] `Test:` `pricing-plans`:
  - cechy planu Profesjonalny bez usuniętych obietnic,
  - CTA free ma `href` `/dodaj-firme` w `pl` i `/en/add-business` w `en`,
  - `jest-axe` bez naruszeń
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` `npx jest "src/app/\[locale\]/\(header\)/pricing"` przechodzi
- [x] `Weryfikacja:` `npx next lint` bez błędów
- [x] `Weryfikacja:` grep: brak `href="#"` w `src/app/[locale]/(header)/pricing/**`
- [x] `Weryfikacja:` `npx jest src/i18n/messages-parity` przechodzi
- [x] `Operator:` uzupełnić kwoty planu Profesjonalny w 4 plikach `messages/` (decyzja cenowa; 9 zł / 49 zł wpisane w U11)
- [ ] `Operator:` sprawdzić `/cennik` i `/ru/pricing`:
  - wszystkie CTA prowadzą do istniejących stron,
  - link portalu otwiera logowanie Stripe,
  - zero błędów konsoli

---

## Do poprawy po review fazy 3

Raport: [review-faza-3.md](review-faza-3.md). Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 7 × P2, 26 × P3). Wszystkie P2 naprawić **przed startem sprzedaży**; #1–#3 razem (łącznie dają premium bez płatności).

✅ P2 #1–#7 naprawione 2026-11-01 (commity `3b8df5a`, `0661ce2`). P3 otwarte.

- [x] 🟠 [important] **`src/lib/premium.ts:39-49`, `subscription-sync.ts:181`**: karencja `past_due` liczona od nowego końca okresu (Stripe przesuwa okres przed nieudaną płatnością) — premium i ranking bez płacenia przez cały cykl Smart Retries. Zapisać `current_period_start`, dla `past_due` granica `periodStart + grace`. Test: `past_due`, `periodEnd` za 28 dni, `periodStart` 4 dni temu → `false`.
- [x] 🟠 [important] **`src/lib/subscription-sync.ts:153` vs `:166`**: `subscriptions.retrieve` przed blokadą — równoległe `payment_failed` + `subscription.deleted` mogą zapisać nieświeży `past_due` po `canceled`. `retrieve` po `lockService` albo `canceled` jako stan końcowy. Test wyścigu z odwróconą kolejnością `retrieve`.
- [x] 🟠 [important] **`api/stripe/webhook/route.ts:52-60`, `src/db/sync-subscriptions.ts`**: brak sprawdzenia `livemode` — testowe klucze + produkcyjna baza wiążą testowe subskrypcje z prawdziwymi wpisami. Webhook: niezgodny tryb → 200 bez sync; CLI: pomijać niezgodne i wypisać tryb klucza + host bazy.
- [x] 🟠 [important] **`subscription-sync.ts:110`, `stripe-webhook-events.ts:33`, `premium-checkout.ts:104-109`**: brak sprawdzenia ceny/produktu — dowolny Payment Link z `client_reference_id=<uuid>` albo zmiana planu w portalu daje premium. Wymagać `price.id ∈ {STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY}` w sync i w `verifyPaidCheckoutSession`; operator: portal tylko z tymi cenami.
- [x] 🟠 [important] **`subscription-sync.ts:188-200`**: mail o konflikcie przy każdym zdarzeniu, odnowieniu i resyncu. Sync zwraca konflikt bez maila; mail w `processEvent` przy `isFirstDelivery` i jednym typie zdarzenia. CLI wiąże od najstarszej subskrypcji.
- [x] 🟠 [important] **`premium/dziekujemy/page.tsx:157-162`**: publiczny GET bez limitu woła `checkout.sessions.retrieve` (zużycie limitu API Stripe wspólnego z checkoutem i webhookiem). `checkRateLimit` po IP przed weryfikacją.
- [x] 🟠 [important] **`premium/dziekujemy/page.tsx:162-163`**: `unavailable` (awaria Stripe) pokazuje „nie potwierdzono” płacącemu. Osobny wariant „odśwież za chwilę” (4 × `messages/`) + test gałęzi strony.
- [x] 🟡 [nit] Webhook/sync: #8 mail „opłacono” tylko przy `isPremiumActive`; #9 log dla `service_missing`/nie-UUID; #10 `setPromotion(null)` a ręczna promocja; #11 wspólny deadline webhooka i timeout bazy; #12 CLI bez drugiego `retrieve`; #13 slug + `db:reset` w dokumentacji operatora.
- [x] 🟡 [nit] Alias: #14 SWR 86400 vs obiecane „do 5 min”; #15 negatywny cache / segmenty skanerów; #16 slug kolidujący z zarezerwowanym lub `api*` bez aliasu.
- [x] 🟡 [nit] Checkout/materiały: #17 druga płatność przed webhookiem; #18 wielokrotne wysłanie materiałów + timeout `sendMail`; #19 `referrer: 'no-referrer'`; #20 komentarz o `no_payment_required`; #21 pełny URL profilu w mailu.
- [x] 🟡 [nit] Kod: #22 `SUBSCRIPTION_METADATA_KEYS` do lekkiego modułu; #23 `subscription-query-parts.ts`; ~~#24 `syncSubscriptionFromStripe` 52 linie~~ (rozwiązane przy #2); #25 nazwy `stripe-events`/`stripe-webhook-events`; #26 `VISIBLE_FIELDS`; #27 helper `toLocale()`; #28 jedno źródło kwot i `PremiumInterval`, spójny domyślny interwał; #29 typ `WebhookErrorCode`, drobne w `/cennik`.
- [x] 🟡 [nit] Testy: #30 typy zdarzeń webhooka i równoległy duplikat; #31 `sync-subscriptions.ts`; #32 `uk` w `pricing-plans.test.tsx`, 456 linii w `service-profile-queries.test.ts`; #33 `dziekujemy` poza `pathnames` — potwierdzić w teście ręcznym U9. → #33 zostaje krokiem `Operator:` testu ręcznego U9.

---

## Do poprawy po re-review fazy 3

Raport: [review-faza-3.md](review-faza-3.md), sekcja „Re-review fazy 3 po poprawkach P2”. Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 3 × P2, 14 × P3). P2 #1, #2, #4–#7 z pierwszego review zamknięte; #3 częściowo (→ R1).

✅ R1–R3 (oraz R4, R9) naprawione 2026-11-01 (commity `e6aab21`, `ed2ffcc`). Pozostałe P3 otwarte.

- [x] 🟠 [important] **R1 `api/stripe/webhook/route.ts:108`, `src/db/sync-subscriptions.ts:53,67`**: klucz testowy + produkcyjna baza nadal zapisuje testowe subskrypcje (lokalny test checkoutu z `.env` na produkcję). Bramka wzorem `assertDropAllowed`/`LOCAL_HOSTS` z `src/db/drop.ts`: `!STRIPE_LIVE_MODE` i host bazy nielokalny → webhook 200 bez sync, CLI odmawia startu. Usunąć martwy filtr `wrong_mode`.
- [x] 🟠 [important] **R2 `premium/dziekujemy/page.tsx:34-42`, `src/lib/redis.ts:5-8`**: awaria Redisa → strona błędu płacącemu. `try/catch` z logiem (fail-open albo `CheckoutUnavailable`) + `commandTimeout` ~1–2 s w ioredis. Test „`checkRateLimit` rzuca”.
- [x] 🟠 [important] **R3 `src/lib/subscription-sync.ts:156-164`**: nowy zakup w karencji `past_due` starej subskrypcji → `conflict`, opłacona subskrypcja nie zapisana do odnowienia, mail „zwróć”. Przychodząca `active`/`trialing` wygrywa z zapisaną `past_due`. Test.
- [x] 🟡 [nit] R5–R17 (R4, R9 zrobione): `line_items.has_more`, 2 testy z osłabioną/kruchą asercją, brakujące testy (`past_due`→`active`, `trialing`, wiele pozycji, `incomplete_expired`), log konfliktu w CLI, timeouty Postgresa, `NOT NULL` bez default. Szczegóły w raporcie. → 2026-11-01: wszystkie zrobione; R16 bez zmian (tabela nie istnieje na produkcji, krok operatora niżej), R17 przez `premium-rate-limit.ts`.

---

## Do poprawy po review fazy 3 — runda 3

Raport: [review-faza-3.md](review-faza-3.md), sekcja „Review fazy 3 — runda 3”. Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 1 × P2, 11 × P3). R1–R4, R9 zamknięte.

✅ T1 (oraz T2, T3, T9, T10) naprawione 2026-11-01 (commit `4b11e94`). Otwarte: T4–T8, T11.

- [x] 🟠 [important] **T1 `src/app/api/stripe/webhook/route.ts:112-117`**: bramka „klucz testowy + baza nielokalna” odpowiada 200 → przy pomyłce w zmiennych produkcji (test key + live `whsec`) Stripe nie ponawia i zdarzenia (z mailami) przepadają. Zwracać 503 + `console.error`; test: 503, sync niewołany, zdarzenie nieoznaczone.
- [x] 🟡 [nit] T2 `export const maxDuration = 30` na stronie `dziekujemy`.
- [x] 🟡 [nit] T3 log przy każdym `conflict && isIncomingActive` + test „stara `past_due` → `active` po wyparciu”; krok operatora przy podwójnej płatności.
- [x] 🟡 [nit] T4 `checkRateLimitWithTimeout` do `src/lib/rate-limit.ts`, scalić z `isWithinLimit` (R17); `page.tsx` ma 297/300 linii.
- [x] 🟡 [nit] T5 decyzja: checkout przy `past_due` dozwolony czy R3 tylko jako obrona na wyścig (JSDoc).
- [x] 🟡 [nit] T6–T11 (T9, T10 zrobione): unia decyzji w `applySubscriptionState`, brakujące testy (kolejność bramek, sekwencje R3, timer), `payment_method_types`, `[TEST]` w mailu materiałów, JSDoc o tunelu, drobne — szczegóły w raporcie. → T5: decyzja (ii), JSDoc. T8: `allowed_payment_method_types: ['card']` (API `2026-09-30` nie ma `payment_method_types`).

---

## Do poprawy po review fazy 3 — runda 4

Raport: [review-faza-3.md](review-faza-3.md), sekcja „Review fazy 3 — runda 4”. Werdykt: ✅ gotowe do kontynuacji (0 × P1, 0 × P2, 5 × P3). T1–T3, T9, T10 zamknięte.

✅ 2026-11-01: wszystkie otwarte P3 z faz 1–3 (U1–U5, T4–T8, T11, R5–R17, #8–#32, F1, F2) naprawione. Kod zmieniony przez 4 subagentów; bramka: tsc OK, jest 183 suite'y / 1979 testów, lint 0 błędów.

- [x] 🟡 [nit] U1 **`src/lib/subscription-sync.ts:203-224`** — log „second paid subscription” odpala też dla starej `past_due` w karencji (fałszywa „podwójna opłata”); warunek `active`/`trialing` + test negatywny.
- [x] 🟡 [nit] U2 **`premium/dziekujemy/page.tsx:28`** — `maxDuration = 30` obejmuje też akcję materiałów (SMTP do 10 s/fazę); `60` albo świadoma decyzja w komentarzu.
- [x] 🟡 [nit] U3 **sekcja „Po wdrożeniu”** — poprawić zdanie o ponowieniach przy `stripe listen`, zakaz testowego endpointu dla Preview, procedura po `CONFIG_MISMATCH` na produkcji (redeploy, włączenie endpointu, resync, resend checkoutów).
- [x] 🟡 [nit] U4 **`src/lib/subscription-notifications.ts:49,71`** — `[TEST]` także w mailach o zakupie i konflikcie.
- [x] 🟡 [nit] U5 **`src/lib/subscription-sync.ts:203`** — `reportConflict` jako jawny krok (razem z T6).

---

## Do poprawy po review fazy 3 — runda 5

Raport: [review-faza-3.md](review-faza-3.md), sekcja „Review fazy 3 — runda 5”. Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 6 × P2, 30 × P3). Przed wdrożeniem bez Stripe: V2, V4. Przed powrotem Stripe: V1, V3. V5, V6: luki testów na regułach premium ręcznego.

- [ ] 🟠 [important] V1 **`env.ts:70`** — `resolveStripeConfig(env)` na końcu modułu rzuca w przeglądarce (proxy `@t3-oss/env` przy odczycie zmiennej `server`); pierwszy klient importujący `env` wywali hydratację. `if (typeof window === 'undefined')` + komentarz; `emptyStringAsUndefined: true`.
- [ ] 🟠 [important] V2 **`premium/dziekujemy/page.tsx:242`** — bez Stripe `notFound()` w streamowanej stronie (`[locale]/loading.tsx`) daje soft-404 (200). Rewrite na `SERVICE_PROFILE_NOT_FOUND_PATH` w middleware przy braku konfiguracji; czysta funkcja dopasowania ścieżki z testem.
- [ ] 🟠 [important] V3 **`firma/[slug]/_actions.ts:216`** — awaria Redisa w `isWithinPremiumLimit('materials')` rzuca przed fail-open `claimSend`; płacący dostaje stronę błędu. Limit w `try/catch` + fail-open; w checkoutcie (`:83`) wyjątek → `fail('CHECKOUT_FAILED')`; testy „limit rzuca”.
- [ ] 🟠 [important] V4 **`api/service-slug/[slug]/route.ts:60`** — cache `exists` 240/60 + timeout lookupu 1,5 s → zimny start na rzadkim `/<slug>` daje 404 zamiast 307. Osobny klucz cache dla aliasu (`?premium=1`, 240/60), profil `s-maxage=300, stale-while-revalidate=86400`; testy nagłówków.
- [ ] 🟠 [important] V5 **`src/lib/subscription-store.ts:107-124`** — `setPromotion(null)` z `NOT EXISTS` bez testu, atrapa (`fake-subscription-store.ts:53`) usuwa bezwarunkowo. `buildRemovePromotionQuery` z testem SQL; atrapa z `manualPremiumUntil` + scenariusz; razem z P3 #3 (jeden builder `GREATEST`) i #4 (`LEAST`).
- [ ] 🟠 [important] V6 **`src/db/premium-content-store.ts:102-134`** — mapowanie daty w `findContent` i transakcja `saveContent` bez testu. Czysta `toEntryShape(row)` z testem round-trip; test `saveContent` (z datą 2 zapisy, bez daty 1, jedna transakcja).
- [ ] 🟡 [nit] Stripe/bezpieczeństwo: #1 bramka trybu klucza w checkoutcie, #2 `maxDuration` profilu, #3 jeden builder `GREATEST`, #4 `LEAST` przy premium ręcznym, #5 nazwa `hasActivePremiumSubscription`, #6 budżet webhooka w komentarzu, #7 znacznik `pending`, #8 decyzja: premium ręczne blokuje przedpłatę online.
- [ ] 🟡 [nit] Premium ręczne/dokumentacja: #9 ostrzeżenie dla daty z przeszłości/odległej, #10 „alias do 5 min”, #11 zastrzeżenie o rankingu w CLAUDE.md, #12 `db:sync-subscriptions` jako krok Stripe, #13 testy dni zmiany czasu.
- [ ] 🟡 [nit] Wydajność: #14 SDK Stripe na zimnym starcie, #15 tłumaczenia per locale, #16 `emptyStringAsUndefined`, #17 cache profilu (na później), #18 jsonb dla free (na później).
- [ ] 🟡 [nit] Kod: #19 `isLocale` ×3, #20 `premiumStateColumns`, #21 unia `ServiceSlugStatus`, #22 wrapper `sendMail` ×2, #23 `premium-plan.ts`, #24 `contact-form.tsx` 350 linii, #25 funkcje > 50 linii, #26 linie > 100 znaków.
- [ ] 🟡 [nit] Testy: #27 CTA profilu w 4 locale bez mocka `Link`, #28 matcher `api/`, #29 wysłanie formularza z prefill + slug > 255, #30 wybór `PremiumPurchase`.
- [ ] 🟡 [nit] Poza zakresem: `api/submit-contact-query/route.ts:64-65` bez `safeParse` (500 zamiast 400) — osobne zadanie.

---

## Decyzja 2026-11-01: Stripe odłożony, premium ręczne

Płatności online odłożone (mały popyt). Kod Stripe uśpiony: `STRIPE_*` opcjonalne (wszystkie albo żadna). Premium włączane ręcznie po przelewie przez `premium.activeUntil` w JSON. „Przejdź na Premium” prowadzi do formularza kontaktowego. Szczegóły: plik kontekstu, sekcja „Stripe odłożony”.

**Kroki operatora potrzebne TERAZ (wdrożenie bez Stripe):**

- [ ] `Operator:` w Vercelu (Production + Preview) **brak wszystkich** pięciu `STRIPE_*` — częściowa konfiguracja zatrzymuje start aplikacji
- [ ] `Operator:` `npx drizzle-kit push` (enum, `service_profiles` z `manual_premium_until`, `service_subscriptions`, `stripe_events`, indeks `service_locations`) na produkcji po przejrzeniu planu zmian; potwierdzić w `information_schema`
- [ ] `Operator:` backfill slugów usług (U1) i `push` z `notNull`
- [ ] `Operator:` `npm run build` z produkcyjnym `.env` przy zatrzymanym dev serverze
- [ ] `Operator:` na Preview: profil `/firma/<slug>`, alias `curl` (niżej), przycisk „Przejdź na Premium” → `/kontakt?topic=premium&firma=<slug>` z wypełnionym tematem i wiadomością, `/cennik` → „Napisz do nas”; `/firma/<slug>/premium/dziekujemy` i `POST /api/stripe/webhook` → 404
- [ ] `Operator:` bramka U3 — akceptacja wyglądu profilu free i 3 szablonów (Storybook)

**Włączenie premium firmie (po przelewie):**
1. weryfikacja właściciela (krok 1 w `.claude/skills/dodaj/SKILL.md`),
2. w `data/services/<plik>.json`, w bloku `premium`: `"activeUntil": "RRRR-MM-DD"` (aktywne do końca tego dnia czasu polskiego),
3. `npm run db:premium -- data/services/<plik>.json --dry-run` → sprawdzić diff z datą,
4. `npm run db:premium -- data/services/<plik>.json`,
5. zacommitować JSON (seed odtwarza datę po `db:reset`).
Przedłużenie = nowa data i te same kroki. Wyłączenie przed czasem: usunąć `activeUntil` — widok i alias znikają od razu, ranking trwa do starej daty (skrócenie: ręcznie `promoted_services`).

**Powrót do Stripe:** pięć `STRIPE_*` w Vercelu + redeploy + webhook w Stripe Dashboard, potem kroki oznaczone niżej jako Stripe. Kod bez zmian.

---

## Po wdrożeniu

> Kroki dotyczące Stripe (zmienne `STRIPE_*`, webhook, `stripe listen`, `CONFIG_MISMATCH`, Customer Portal, `rk_live_`, `db:sync-subscriptions`, Fakturownia, test checkoutu U9) są **odłożone do powrotu Stripe**.

- [ ] `Operator:` **(Stripe, odłożone)** 5 zmiennych `STRIPE_*` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PORTAL_LOGIN_URL`) w Vercel (Production + Preview) — wszystkie albo żadna
- [ ] `Operator:` lokalny test checkoutu wymaga `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (`success_url` budowany z tej zmiennej, inaczej powrót na produkcję)
- [ ] `Operator:` lokalny test checkoutu (`stripe listen`, `sk_test_`) wymaga `DATABASE_URL` na localhost (docker-compose) — przy zdalnej bazie webhook odpowiada 503 `CONFIG_MISMATCH` i nic nie zapisuje, a `db:sync-subscriptions` odmawia startu. `stripe listen` **nie ponawia** zdarzeń: po poprawieniu bazy wyślij je ponownie przez `stripe events resend <evt_id>`
- [ ] `Operator:` **nie rejestrować** testowego endpointu webhooka dla Preview — Preview ma nielokalną bazę, więc każde zdarzenie dostanie 503, Stripe wyśle maile o awarii i w końcu wyłączy endpoint. Testy checkoutu tylko lokalnie z `stripe listen`
- [ ] `Operator:` procedura po `CONFIG_MISMATCH` w logach **produkcji** (testowy klucz na produkcji):
  1. poprawić `STRIPE_SECRET_KEY` w Vercelu (Production) i zrobić redeploy,
  2. w Stripe Dashboard → Webhooks sprawdzić, czy endpoint jest włączony (po serii błędów Stripe go wyłącza) i włączyć,
  3. `npm run db:sync-subscriptions` z kluczem live — odtwarza stan premium,
  4. ponownie wysłać nieudane `checkout.session.completed` spoza okna ponowień (Dashboard → zdarzenie → „Resend”) — tylko to odtwarza maile o zakupie
- [ ] `Operator:` slug usługi jest niezmienny: zmiana nazwy firmy w `data/services/*.json` albo w seedzie zmienia slug po `db:reset`, a wtedy subskrypcja (powiązana przez `metadata.serviceSlug` i UUID) kończy się `service_missing` i premium znika po resyncu. Przed zmianą slugu płacącej firmy — zaktualizować `metadata.serviceSlug` subskrypcji w Stripe
- [ ] Do rozważenia: staging z kluczami testowymi i zdalną bazą testową wymagałby flagi override w `env.ts` (dziś zablokowany przez R1)
- [ ] `Operator:` przeglądać logi Vercela: `second paid subscription for a service` (podwójna opłata → anulować starszą subskrypcję w Stripe i `db:sync-subscriptions`), `failing open` (awaria Redisa na stronie `dziekujemy`), `CONFIG_MISMATCH` (zły klucz/baza w webhooku)
- [ ] `Operator:` przeglądać logi `conflict` webhooka (np. stara subskrypcja odzyskała płatność po zakupie „ratunkowym” → podwójna opłata, bez maila)
- [x] ~~Do rozważenia: globalny timeout klienta Redis~~ — decyzja: bez globalnego `commandTimeout`; operacje premium mają własne limity (`withTimeout`, 1,5 s)
- [ ] `Operator:` po każdym `db:reset`: `npm run db:sync-subscriptions`
- [ ] `Operator:` `drizzle-kit push` dla fazy 3 obejmuje kolumnę `service_subscriptions.current_period_start timestamptz NOT NULL` (tabela jeszcze nie istnieje na bazie, więc bez wartości domyślnej)
- [ ] `Operator:` Customer Portal w Stripe — przy zmianie planu dopuścić tylko ceny `STRIPE_PRICE_MONTHLY` i `STRIPE_PRICE_YEARLY` (inna cena kończy premium z końcem opłaconego okresu)
- [x] ~~`Operator:` Preview z testowymi kluczami Stripe NIE może wskazywać na produkcyjny `DATABASE_URL`~~ — wymuszone w kodzie (R1)
- [x] ~~Do rozważenia: awaria Redisa na stronie `dziekujemy` kończy się stroną błędu~~ — fail-open wdrożony w R2
- [ ] `Operator:` w teście ręcznym U9 sprawdzić wariant „odśwież za chwilę” na stronie `dziekujemy` (razem z P3 #33)
- [x] ~~Do rozważenia: slugi zaczynające się od `api` bez aliasu~~ — matcher wyklucza tylko `/api/**` (#16)
- [x] ~~Do rozważenia: lista cech planu darmowego bez WWW i social mediów~~ — „Dane kontaktowe, strona WWW i media społecznościowe” w 4 locale
- [ ] `Operator:` zmienić 307 aliasu na 308 po obserwacji na produkcji
- [x] sekcja „Profil firmy i Premium” w `CLAUDE.md` (2026-11-01):
  - `isPremiumActive` jako jedyne źródło prawdy,
  - lista zarezerwowanych słów,
  - Stripe tylko przez `src/lib/stripe.ts`
- [ ] `Operator:` `/dev-compound` dla wniosków o Stripe i aliasie
- [ ] `Operator:` klucz ograniczony `rk_live_` potrzebuje odczytu **Subscriptions** (`subscriptions.search` przed checkoutem, #17). Bez uprawnienia sprzedaż idzie dalej, w logu `subscription search failed`
- [ ] `Operator:` dodatkowe logi do obserwacji w Vercelu: `subscription sync: service not found` (płatność bez wpisu — sprawdzić ręcznie), `subscription search failed`, `sent marker unavailable`, `materials marker unavailable`, `mail timed out`
- [ ] `Operator:` po wygaśnięciu/anulowaniu subskrypcji ręczna promocja tego wpisu znika (wiersz `promoted_services` nie zna pochodzenia) — założyć ją ponownie. Ręczne przedłużenie nie jest już skracane przy odnowieniu (`GREATEST`)
- [ ] `Operator:` przy podwójnej płatności zwrot dotyczy subskrypcji wskazanej w mailu jako „druga”; log CLI: `sub_X: conflict (wpis ma sub_Y, oplacona — do zwrotu)`, w podsumowaniu osobno `stale_ignored`
- [ ] `Operator:` przed sprzedażą na lokalnej bazie (docker-compose) przepuścić jedno zdarzenie webhooka przez `stripe listen` — sprawdza SQL bez testów: upsert promocji z `GREATEST` i `set_config` (`lock_timeout`/`statement_timeout`)
- [ ] `Operator:` po `npm run build` na Preview (zmieniony matcher middleware, `force-dynamic`, wyspa kliencka galerii): `curl -sI /api/service-slug/<istniejący>` → `s-maxage=240, stale-while-revalidate=60`; nieistniejący → `s-maxage=30, stale-while-revalidate=300`; `/wp-admin` → 404 bez lookupu; `/api/service-slug/x` → JSON; `/sitemap.xml` z profilami
- Informacyjnie: płatność premium przyjmuje tylko kartę (z Apple/Google Pay), niezależnie od metod w Dashboardzie. Materiały: jedno wysłanie na sesję Checkout przez 7 dni, poprawki mailem. Domyślny interwał `monthly` na profilu i w `/cennik`; „oszczędź 54%” w `Pricing.yearly` to tekst — poprawić ręcznie przy zmianie cen
