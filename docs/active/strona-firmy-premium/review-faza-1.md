# Review fazy 1: Darmowy profil

**Branch:** `feature/strona-firmy-premium`
**Data:** 2026-10-31
**Zakres:** `220b9b6..c3d43c8` (U1 slug + zapytania, U2 routing/lookup/sitemap, U3 komponenty i szablony, U4 strona profilu + metadane + linki)
**Recenzenci:** security-sentinel, performance-oracle, kieran-typescript-reviewer (architektura + TS), spec-flow-analyzer (scenariusze + pokrycie). Agent E2E nie był uruchamiany (patrz „E2E”).

## Werdykt

⚠️ **KONTYNUUJ Z ZASTRZEŻENIAMI.** 0 × P1, 9 × P2, 17 × P3.

Najważniejsze przed fazą 2:
- **#5 i #6** (spójność slugu): wpływają bezpośrednio na adresy profili, zanim operator zrobi backfill na produkcji.
- **#7 i #8** (kontrakt widoku): faza 2 rozbudowuje szablony.
- **#1** (prefetch): jedna linia, a chroni limit lookupu.

## Statystyki

- Plików w diffie: ~95 (z testami, stories i tłumaczeniami)
- Testy w zakresie: 29 suite'ów, 211 testów PASS; całość: 143 suite'y, 1505 testów PASS
- `npx tsc --noEmit` OK, `npx next lint` bez błędów i warningów

## 🟠 P2: do poprawy

| # | Plik | Problem | Poprawka | Źródło |
|---|---|---|---|---|
| 1 | `src/app/[locale]/(main)/_components/service-card/service-card.tsx:767`, `marker-popup.tsx:~101`, `firma/[slug]/_components/similar-services/similar-services.tsx` | Prefetch linków do profilu przechodzi przez middleware. Każda widoczna karta i każda z 6 „Podobnych firm” to wywołanie `/api/service-slug` (Redis + DB). Szybkie przewijanie listy wyczerpuje limit 120/min, a lookup przechodzi w fail-open, więc 404 staje się soft-404. | `prefetch={false}` na linkach do profilu | perf, tester, security |
| 2 | `src/middleware.ts:47-48`, `src/lib/service-slug-lookup.ts:43`, `src/app/api/service-slug/[slug]/route.ts:46` | Założenie o `x-forwarded-for` przeczy samo sobie. Jeśli Vercel nadpisuje XFF przy fetchu z middleware, limit staje się globalny: 120 żądań/min wyłącza 404 w całym serwisie. Jeśli nie nadpisuje, klient omija limit, podając dowolny XFF. | Ruch z middleware uwierzytelniony sekretem z `env.ts` (nagłówek), z osobnym, wyższym limitem. Ruch bez sekretu dostaje limit po IP platformy. Zweryfikować na preview. | security |
| 3 | `src/lib/service-slug-lookup.ts:43` (`cache: 'no-store'`), `route.ts:96` | Lookup na ścieżce krytycznej bez cache: +50–150 ms TTFB, do 1,5 s przy zimnym starcie, dwa wywołania funkcji na każde wejście | `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` dla `exists:true`, `s-maxage=30` dla `false`; usunąć `no-store` w middleware | perf |
| 4 | `src/lib/service-profile-queries.ts:181-218`, `src/lib/similar-services.ts`, `src/db/schema.ts:57-99`, `page.tsx:108-111` | `getSimilarServices` pobiera całą kategorię bez `LIMIT`, ze skorelowanym podzapytaniem `mainCity` i bez indeksu `service_locations.service_id`. Do tego drugi raz pyta o kategorię i miasto, które strona już ma. 4 sekwencyjne round-tripy. Przy 10× danych to setki podzapytań na wejście. | `ORDER BY (city = $src) DESC, name LIMIT 6` w SQL; sygnatura `({ serviceId, category, city }, locale)`; `Promise.all` z lokalizacjami; indeks `(service_id, is_main_location)` (`push` przez operatora) | perf, tester, arch |
| 5 | `src/db/service-input-schema.ts:119` vs `src/lib/service-profile-path.ts:19` | Dwa formaty slugu: `^[a-z0-9-]+$` vs `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Slug `abc-` przejdzie `db:add`, a middleware zwróci 404 dla istniejącego wpisu. | Jedna stała w lekkim module (np. `src/lib/service-slug-format.ts`) dla zod i middleware + test: `buildServiceSlug(x)` zawsze przechodzi `isValidServiceSlug` | arch |
| 6 | `src/db/add-service.ts:208` vs `src/db/seed.ts:169` + backfill | `db:add` zapisuje jawny `slug` z JSON, a seed i backfill liczą slug z nazwy. Trzy pliki w `data/services/` mają jawny slug ≠ slug z nazwy, więc ten sam wpis dostaje inny `/firma/…` po `db:add` i po `db:reset`. | **Decyzja orkiestratora:** slug usługi zawsze z nazwy przez `createServiceSlugAllocator` z zajętymi slugami z bazy, także w `db:add`. `slug` w JSON zostaje wyłącznie bazą slugów lokalizacji, tak jak w seedzie. Komentarz w `schema.ts`. | arch |
| 7 | `template-gallery.tsx:22`, `template-classic.tsx:21`, `template-professional.tsx:26`, `service-profile-types.ts:84` | Dane premium przekazywane dwa razy: `profile.premium` i osobny prop `premium`. Mogą się rozjechać, a fixture'y potrzebują rzucającego `premiumOf()`. | `type PremiumProfileView = ServiceProfileView & { premium: PremiumContent }`; szablon przyjmuje `{ profile }`, strona zawęża przez `if (view.premium)` | arch |
| 8 | `service-profile-types.ts:22-37`, `to-profile-view.ts:22-39` | `ProfileLocation` przepisany ręcznie (14 pól) zamiast inferencji z Drizzle. Mapper kopiuje pola tylko po to, żeby zmienić nazwę `isMainLocation` na `isMain`. | `type ProfileLocation = Omit<ServiceProfileLocation, 'slug'>` (`import type`), usunąć `toProfileLocation`; przy okazji jeden typ `OpeningHours` (#14) | arch |
| 9 | `src/app/[locale]/firma/[slug]/page.tsx:49-96` | Eksportowane `generateMetadata` i `toSameAs` nie mają testu. Opis `''` albo `'   '` daje pusty `<meta description>`, bo `??` łapie tylko `null`. | Fallback na pusty po `trim()`; testy: profil `null` daje `noindex`, opis `null`/`''`/`'   '`, brak logo w `openGraph` | tester |

## 🟡 P3: do rozważenia

| # | Plik | Problem |
|---|---|---|
| 10 | `profile-helpers.ts:55,79,97-99`, `page.tsx:38-43` | Linki z `socials` i `sameAs` bez allowlisty protokołu (`z.string().url()` przepuszcza `data:`). Dane pochodzą m.in. z draftów LLM. React blokuje `javascript:`, ale lepiej mieć helper `toSafeExternalHref` (tylko `https?:`). Puste stringi i same spacje w socials przechodzą jako link. |
| 11 | `src/middleware.ts:44` | Origin lookupu z nagłówka `Host`. Ryzyko teoretyczne na Vercelu, ale origin lepiej brać z `env`. |
| 12 | `src/components/language-switcher.tsx:56,67` | Gałąź `/firma/[slug]` wpisana na sztywno. Kolejna trasa z parametrem rzuci „Insufficient params”. Ogólnie: `pathname.includes('[')` oznacza przekazanie `params`. |
| 13 | `service-card.tsx:766-774`, `marker-popup.tsx:101-110` | Zduplikowany link do profilu z hardkodowanym `#C52289` mimo nowego tokenu `brand`. Wydzielić `ServiceProfileLink`. |
| 14 | `schema.ts:71`, `service-profile-types.ts:20`, `service-profile-metadata.ts:68`, `service-card.tsx:108` | Kształt godzin otwarcia zdefiniowany w 4 miejscach. Jeden typ `OpeningHours` w `@/lib/weekdays`. |
| 15 | `src/lib/similar-services.ts:4` vs `service-profile-types.ts:41` | Kolizja nazw `SimilarService`; proponowana nazwa wiersza: `SimilarServiceRow`. |
| 16 | `TemplateGallery` (103 linie), `TemplateClassic` (91), `TemplateProfessional`, `ProfileFree` (63) | Funkcje powyżej 50 linii (reguła repo). Wydzielić hero/nagłówek. |
| 17 | `page.tsx:61` | `toProfileView(profile, [], locale)` tylko dla `getHeaderCity`. Po #8 wywołać helper bezpośrednio. |
| 18 | `service-profile-path.ts` vs `map-pathname.ts` | Wycinanie prefiksu locale w dwóch miejscach (`as Locale` w mapie). Opcjonalny wspólny `splitLocalePrefix()`. |
| 19 | `template-classic.tsx:46,62` | Dwa `priority` (cover + logo) konkurują o LCP. Zostawić `priority` tylko na cover. |
| 20 | `profile-gallery.tsx` | Cała siatka jest `'use client'`; klientem musi być tylko dialog. Przy kolejnym refaktorze. |
| 21 | `page.tsx:70-72` | Wpis `local` bez lokalizacji dostaje fallback „online” i JSON-LD `Organization`. |
| 22 | `buildProfileTitle` | Brak obcięcia długiego tytułu (>60 znaków). |
| 23 | `src/app/sitemap.ts` | Przy ~12,5 tys. wpisów limit 50 tys. URL, więc trzeba będzie przejść na `generateSitemaps`. Przy błędzie bazy sitemapa bez profili zostaje w ISR przez 1 h. |
| 24 | `src/db/add-service.ts:145-154` | `isServiceSlugTaken` i `fail()` w `main()` bez testu (zaakceptowane odchylenie; scenariusz pokryty w połowie). Rozwiąże się przy #6, jeśli logika przejdzie do czystego modułu. |
| 25 | `src/middleware.ts` (`handleServiceProfile`) | Gałęzie middleware nie są testowalne w Jeście; weryfikacja ręczna przez `curl` (Operator U2). |
| 26 | `service-profile-queries.test.ts:138`, `sitemap.test.ts:134` | Kruchy test (dosłowny string SQL) i test bliski tautologii. |

## Odchylenia od planu

- **Brakujący plik testowy z planu:** `src/db/add-service.test.ts`. Odchylenie zaakceptowane w logu (moduł łączy się z bazą przy imporcie), więc nie dostaje osobnego P2. Częściowe pokrycie opisuje #24.
- **Pliki spoza planu:** wszystkie wpisane w log wykonania (`service-slugs.ts`, `similar-services.ts`, `service-slug-lookup.ts`, `firma/layout.tsx`, dodatkowe sekcje U3, token `brand`, `semantic-search.ts`, poprawki przełącznika i „Dziś”).
- **`Delegate to:`:** zgodne z kategoriami plików we wszystkich czterech unitach. U4 (`feature-builder-web-ui`) dotknął jednej kolumny w `src/lib/queries.ts` i `semantic-search.ts`, co plan przewidywał w adnotacji.
- **Nieuruchomione:** `npm run build`. ISR sitemapy i prawdziwe 404 z middleware zostają niezweryfikowane do deployu preview.

## E2E

Nie uruchomiony:
- Faza 1 nie ma checkboxów `Weryfikacja:` dla przeglądarki. Scenariusze przeglądarkowe to kroki `Operator:` (brak `.env.e2e`).
- Jedyna dostępna baza to produkcja bez kolumny `services.slug` (przed backfillem), więc profil i tak by się nie wyrenderował.

Wynik: 0 passed / 0 failed / brak scenariuszy.

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 15
- Odznaczone na podstawie Agent 5 E2E: 0
- Pozostawione dla operatora (Manual): 0 (kroki ręczne są w `Operator:`)
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły

- [x] U1 `npx tsc --noEmit` → PASS (exit 0)
- [x] U1 `npx jest src/lib/service-profile-queries src/lib/similar-services src/db/service-slugs src/db/service-input-schema` → PASS (4 suite'y, 46 testów)
- [x] U1 grep `import 'server-only'` w `service-profile-queries.ts` → PASS
- [x] U2 `npx tsc --noEmit` → PASS
- [x] U2 `npx jest src/lib/service-profile-path src/app/api/service-slug src/app/sitemap` → PASS (3 suite'y, 87 testów)
- [x] U2 `npx next lint` → PASS (zero błędów i warningów)
- [x] U3 `npx tsc --noEmit` → PASS
- [x] U3 `npx jest "src/app/\[locale\]/firma"` → PASS (20 suite'ów, 67 testów)
- [x] U3 `npx next lint` → PASS
- [x] U3 grep `next/link` / `next/navigation` w `src/app/[locale]/firma/**` → PASS z adnotacją. Jedyne trafienie to `import { notFound } from 'next/navigation'` w `page.tsx`. `@/i18n/navigation` nie eksportuje `notFound`, a cel reguły (locale-aware linki i routing) jest spełniony. Checkbox był sformułowany zbyt ostro (uwaga dla planisty).
- [x] U3 `npx jest src/i18n/messages-parity` → PASS (6 testów)
- [x] U4 `npx tsc --noEmit` → PASS
- [x] U4 `npx jest src/lib/service-profile-metadata "src/app/\[locale\]/\(main\)/_components/service-card"` → PASS (3 suite'y, 58 testów)
- [x] U4 `npx next lint` → PASS
- [x] U4 grep `'use client'` w `firma/[slug]/page.tsx` → PASS (0 trafień)

Severity gate po bookkeepingu bez zmian: ⚠️ KONTYNUUJ Z ZASTRZEŻENIAMI.
