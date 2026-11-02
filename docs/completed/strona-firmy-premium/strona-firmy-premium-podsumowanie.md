# Strona firmy: darmowy profil + Premium (podsumowanie)

**Data ukończenia:** 2026-11-01

**Branch:** `feature/strona-firmy-premium`, zmergowany do `master` jako PR #32 (`23830a4`). Poprawka nazw dwóch warsztatów weszła osobnym PR (`fix/slug-warsztaty-bez-or`).

**Źródła:**
- Requirements: `docs/dev-brainstorms/2026-10-31-strona-firmy-premium-requirements.md`
- Plan techniczny: `docs/plans/2026-10-31-001-feat-strona-firmy-premium-plan.md`

**Status:** kod jest na `master` i na produkcji. Zrobione na produkcji:
- `drizzle-kit push` (kolumna `services.slug`; tabele premium i Stripe przez ten sam `push`),
- backfill slugów dla 179 wpisów,
- ręczna poprawka dwóch slugów z `-or-` (SQL w Supabase).

Bramka na gałęzi:
- `tsc`: OK
- `jest`: 191 suite'ów, 2097 testów
- `lint`: 0 błędów
- `npm run build`: nieuruchomiony, bo worktree nie ma `.env`.

**Zadanie zarchiwizowane z decyzji usera.** Kroki operatora i drobne follow-upy są otwarte (lista niżej).

## Co zostało dostarczone

Pierwszy płatny produkt polvia:

1. **Darmowy profil `/firma/<slug>`** dla każdego aktywnego wpisu, w 4 locale.
   - Treść: kontakt, godziny, WWW, social, WhatsApp/Telegram, lokalizacje i „Podobne firmy”.
   - SEO: metadane, hreflang z `x-default`, JSON-LD (`LocalBusiness`/`Organization`) i wpisy w sitemapie.
   - Prawdziwe 404 dla nieistniejącego slugu.
   - Link „Zobacz profil” z karty listy i z popupu mapy.
2. **Premium** (plan „Profesjonalny”, 9 zł/mies. albo 49 zł/rok) daje:
   - 3 szablony (Galeria, Profesjonalny, Klasyczny), cover i galerię (do 15 zdjęć),
   - cennik usług i FAQ,
   - brak „Podobnych firm”,
   - wyższą pozycję w rankingu,
   - krótki adres `polvia.pl/<slug>` (307 na profil, tylko przy aktywnym premium).
3. **Treść premium (concierge):** blok `premium` w `data/services/<plik>.json`, publikowany przez `npm run db:premium` (`--dry-run`, Zod, idempotentny upsert). Seed odtwarza treść.
4. **Premium ręczne** (przelew): `premium.activeUntil` w JSON → `service_profiles.manual_premium_until` + ranking. CTA „Przejdź na Premium” prowadzi do `/kontakt?topic=premium&firma=<slug>`.
5. **Stripe (uśpiony):**
   - checkout jako Server Action, formularz materiałów po opłaceniu,
   - webhook z podpisem, dedupe `stripe_events` i synchronizacją świeżo pobranej subskrypcji,
   - `db:sync-subscriptions`, link do Customer Portal.

   Wszystko włącza się dopiero z kompletem 5 zmiennych `STRIPE_*`.
6. **`/cennik`** obiecuje tylko to, co premium daje, a jego CTA prowadzą do istniejących stron.

## Kluczowe decyzje

- **Slug usługi jest niezmienny i liczony z nazwy jedną regułą** (`createServiceSlugAllocator`, sufiksy `-2`/`-3`) w seedzie, backfillu i `db:add`.
  - Jeden format w `src/lib/service-slug-format.ts` (zod + middleware).
  - `slug` w JSON to tylko baza slugów lokalizacji.
- **Walidacja profilu i aliasu w middleware**, przez `GET /api/service-slug/[slug]` (Node + db).
  - Jawny timeout i fail-open; rewrite na niedopasowaną ścieżkę daje 404 przed streamowaniem (soft-404 przez `loading.tsx`).
  - Lookup uwierzytelniony `SERVICE_SLUG_LOOKUP_SECRET`; ruch publiczny limitowany po `x-vercel-forwarded-for`.
  - Wyniki w cache CDN; linki bez prefetchu.
- **`hasActivePremium` to jedyne źródło prawdy** o premium: Stripe (`isPremiumActive` z karencją) albo data ręczna. Ranking przez istniejące `promoted_services`.
- **Treść premium w `service_profiles` (jsonb)** jest niezależna od subskrypcji. Po wygaśnięciu widok wraca do free, a treść zostaje.
- **Stripe opcjonalny:** konfiguracja wszystko albo nic (`stripe-config.ts`). Testowy klucz nie zapisuje do zdalnej bazy (`CONFIG_MISMATCH`).
- **Kontrakt widoku:** `ServiceProfileView` / `PremiumProfileView`; typy lokalizacji wyprowadzone z zapytania.
- **Nowa zależność:** `stripe@23.0.1` (zgoda usera).

## Główne pliki

**Nowe:**
- `src/app/[locale]/firma/[slug]/` (strona, szablony, sekcje, `_actions.ts`, `premium/dziekujemy`)
- `src/app/api/service-slug/[slug]/route.ts`, `src/app/api/stripe/webhook/route.ts`
- slugi: `src/db/service-slugs.ts`, `src/db/backfill-service-slugs.ts`, `src/lib/service-slug-format.ts`, `src/lib/service-slug-lookup.ts`
- profil: `src/lib/service-profile-path.ts`, `service-profile-queries.ts`, `service-profile-metadata.ts`, `similar-services.ts`
- premium i Stripe: `premium.ts`, `manual-premium.ts`, `stripe-config.ts`, `stripe.ts`, adaptery subskrypcji i treści premium
- CLI `db:premium`, `db:sync-subscriptions`
- `(main)/_components/service-profile-link/`

**Zmienione:**
- `src/db/schema.ts` (`services.slug`, `service_profiles`, `service_subscriptions`, `stripe_events`, indeks `idx_location_service_main`)
- `src/middleware.ts`, `src/app/sitemap.ts`, `env.ts`
- `service-card.tsx`, `marker-popup.tsx`, `language-switcher.tsx`
- `/cennik`, formularz kontaktowy, `messages/*.json`, `seed.ts`, `add-service.ts`, `CLAUDE.md`, `/dodaj` `SKILL.md`

## Otwarte po archiwizacji

- **Dodawanie firmy z dashboardu nie nadaje slugu** (`dashboard/_actions.ts:383`; także stare skrypty `add-it-deweloper.ts`, `seed-example.ts`). Taki wpis nie ma profilu. Dopiero po poprawce można ustawić `services.slug` jako `.notNull()` i zrobić `push`.
- **Kroki operatora:**
  - kontrola produkcji: profile, 404, sitemap, `/cennik`, alias,
  - akceptacja szablonów w Storybooku,
  - pierwsza firma premium przez `db:premium`,
  - po obserwacji zmiana 307 aliasu na 308.
- **Przy włączaniu Stripe:**
  - konfiguracja konta, 5 zmiennych `STRIPE_*`, Fakturownia/KSeF, konsultacja z księgowym,
  - pełna lista w `strona-firmy-premium-zadania.md`, w sekcji „Stripe, odłożone”,
  - wcześniej naprawić 🟠 V3 (awaria Redisa w `isWithinPremiumLimit('materials')` rzuca przed fail-open). Bez Stripe ta ścieżka jest nieosiągalna.
- **P3 z rundy 5 review fazy 3** (#1–#30): wydajność, duplikacje, długie funkcje, brakujące testy. Lista w `strona-firmy-premium-zadania.md`.

## Wnioski

- **Slug jako publiczny adres trzeba ustalić jedną regułą przed pierwszym zapisem na produkcji.** Seed, backfill i CLI liczyły go inaczej, a `db:reset` zmieniłby linki z outreachu. Tak samo pierwszy backfill pokazał, że `|` w nazwie daje `-or-` w adresie. Listę z `--dry-run` zawsze przeglądać przed prawdziwym runem.
- **Fetch z middleware na Vercelu wychodzi z jednego adresu**, więc rate limit po IP takiego ruchu to globalny kubełek, a `x-forwarded-for` od klienta da się podrobić. Ruch wewnętrzny uwierzytelniać sekretem, publiczny limitować po nagłówku platformy.
- **Prefetch `Link` przechodzi przez middleware.** Każda widoczna karta odpalała lookup, więc linki do tras walidowanych w middleware dostają `prefetch={false}`.
- **`drizzle-kit push` z unikalnym ograniczeniem na niepustej tabeli pyta o truncate.** Właściwa odpowiedź to zawsze „No”: nowa kolumna ma same `NULL`, a te nie łamią `UNIQUE`.
- **`.notNull()` na kolumnie wykrywa przez typecheck wszystkie ścieżki insertu.** Tak wyszedł dashboard bez slugu. Warto to zrobić przed ogłoszeniem kolumny „gotową”.
- **psql na Windowsie z URL Supabase:** parametr `pgbouncer` i kodowanie klienta (`PGCLIENTENCODING=UTF8`) sprawiają problemy. Jednorazowy SQL prościej wykonać w SQL Editorze Supabase.
