# Plan: Strona firmy — darmowy profil + Premium w subskrypcji

**Branch:** `feature/strona-firmy-premium` (worktree: `C:\Users\mateu\WebstormProjects\polvia-strona-firmy`)
**Ostatnia aktualizacja:** 2026-10-31

## Źródła

- Requirements doc: [docs/dev-brainstorms/2026-10-31-strona-firmy-premium-requirements.md](../../dev-brainstorms/2026-10-31-strona-firmy-premium-requirements.md)
- Plan techniczny: [docs/plans/2026-10-31-001-feat-strona-firmy-premium-plan.md](../../plans/2026-10-31-001-feat-strona-firmy-premium-plan.md). Zawiera pełne podejście, wzorce i scenariusze per unit; ten plik to streszczenie wykonawcze.

## Podsumowanie wykonawcze

Polvia dostaje pierwszy produkt płatny, zbudowany w trzech krokach:

1. Każdy aktywny wpis dostaje **darmowy profil** `/firma/<slug>`, który daje SEO i link do outreachu.
2. Na tym profilu firma kupuje subskrypcję **Premium** (plan „Profesjonalny”). Premium daje:
   - wybór 1 z 3 szablonów, cover i galerię,
   - cennik usług i FAQ,
   - brak „Podobnych firm”,
   - krótki adres `polvia.pl/<slug>`,
   - wyższą pozycję na liście.
3. Treść premium publikuje founder (**concierge**). Rozliczenia (Stripe + Fakturownia/KSeF) i wygasanie działają automatycznie.

**Cel biznesowy:** co najmniej 5 płacących firm w ciągu 3 miesięcy od startu sprzedaży.

## Analiza obecnego stanu

- **Firma nie ma własnej strony**, tylko kartę na liście lub mapie (`service-card.tsx`) i popup (`marker-popup.tsx`).
- **`services` nie ma slugu.** Slugi istnieją tylko dla lokalizacji. Kontakt, godziny i social są na `service_locations`.
- **`promoted_services`** (`priority`, `expiresAt`) już steruje rankingiem w `getServices` i `semantic-search`.
- **`/cennik` to statyczna makieta** w `'use client'`, z CTA bez `href`. Obiecuje plan „Profesjonalny” 19 €/mies. albo 69 €/rok, za którym nic nie stoi.
- **Brak** Stripe, storage'u plików, kont i auth.
- **`[locale]/loading.tsx` streamuje każdą stronę**, więc `notFound()` w `page.tsx` daje soft-404. Walidację trzeba robić w middleware.
- **`DATABASE_URL` wskazuje na produkcję.** Każdy `drizzle-kit push` i każdy skrypt `db:*` działa na żywej bazie.

## Proponowany stan docelowy

- Pod adresem `/firma/<slug>` (oraz `/en|ru|uk/firma/<slug>`) jest:
  - profil free albo szablon premium,
  - z metadanymi, hreflang i JSON-LD,
  - obecny w sitemapie.
- Nieistniejący slug zwraca prawdziwy status 404.
- Karta i popup mapy linkują do profilu.
- `service_profiles` przechowuje treść premium. Jej źródłem jest blok `premium` w `data/services/<slug>.json`, publikowany przez `npm run db:premium` i odtwarzany przez seed.
- `service_subscriptions` i `stripe_events` utrzymywane przez webhook Stripe. `isPremiumActive()` to jedyne źródło prawdy o premium; ranking idzie przez `promoted_services`.
- Checkout z profilu, strona sukcesu z formularzem materiałów, mail do foundera.
- Krótki adres `polvia.pl/<slug>` daje 307 na profil, tylko przy aktywnym premium.
- `/cennik` obiecuje tylko to, co działa, a jego CTA prowadzą do istniejących stron.

## Fazy wdrożenia

| Faza | Unity | Wartość | Nakład |
|---|---|---|---|
| 1 — Darmowy profil | U1, U2, U3, U4 | SEO i link do outreachu; można wdrożyć osobno | L |
| 2 — Treść premium (concierge) | U6, U7 | Szablony i treść gotowe do sprzedaży | M |
| 3 — Subskrypcja | U8, U9, U10, U11 | Start sprzedaży | XL |

> U5 nie istnieje: sitemap wcielono do U2. Numeracja zgodna z planem technicznym.

U7 zależy od `isPremiumActive` z U8. U8 można więc zacząć równolegle z U6, zanim faza 2 się domknie.

### Zadania i kryteria akceptacji (skrót; checklisty w `strona-firmy-premium-zadania.md`)

| # | Unit | Nakład | Zależności | Kryterium akceptacji |
|---|---|---|---|---|
| U1 | Slug usługi + zapytania profilu | M | — | Unikalny `services.slug` dla każdego wpisu. `getServiceProfile` i `getSimilarServices` przetestowane, w tym nieaktywny wpis, online-only i fallback tłumaczenia. |
| U2 | Routing, lookup w middleware, sitemap | M | U1 | `/firma/<brak>` zwraca 404 (curl), `/firma/<jest>` 200, w 4 locale. Sitemap ma profile × 4 locale. |
| U3 | Kierunek wizualny: profil free + 3 szablony | L | — | Komponenty z testami `jest-axe` i stories. **User akceptuje wygląd w Storybooku przed U4 i U7.** |
| U4 | Strona profilu free, metadane, linki | M | U1, U2, U3 | Profil z danymi, hreflang ×4 + `x-default`, JSON-LD, link z karty i popupu. |
| U6 | `service_profiles` + JSON + `db:premium` | M | U1 | Idempotentny upsert z `--dry-run`, walidacja Zod, seed odtwarza treść. |
| U7 | Render szablonu premium | S | U3, U6, U8 | Unia `free \| premium(template)`; po wygaśnięciu widok free, treść zostaje w bazie. |
| U8 | Stripe: stan, webhook, ranking, resync | L | U1 | Podpis, dedupe i synchronizacja ze świeżego pobrania subskrypcji. Ścieżki awarii przetestowane. `promoted_services` zsynchronizowane. |
| U9 | Checkout + formularz materiałów | M | U4, U8 | Checkout tylko dla aktywnego wpisu bez premium, z ceną z allowlisty. Materiały tylko dla opłaconej sesji. |
| U10 | Krótki adres | S | U2, U8 | Premium daje 307, free 404. Trasy zarezerwowane działają bez zmian. |
| U11 | Przepisanie `/cennik` | S | U9 | Brak usuniętych obietnic i brak `href="#"`. Link do portalu Stripe. |

## Ocena ryzyka

| Ryzyko | Wpływ | Mitygacja |
|---|---|---|
| `push` i skrypty trafiają w produkcję | Wysoki | Kroki bazy tylko jako `Operator:`, po `--dry-run`. Weryfikacja w `information_schema`. Nigdy `db:reset`. |
| Soft-404 na `/firma/*` | Średni (SEO) | Walidacja w middleware; `curl` na statusie |
| Webhook: zdarzenia w dowolnej kolejności, duplikaty, timeouty | Wysoki (pieniądze) | Stan pobierany od nowa, `stripe_events`, skutki uboczne z timeoutem po zapisie, U8 test-first |
| BLIK recurring wymaga akceptacji Stripe | Niski | Karty zawsze włączone |
| Faktury przy odnowieniach i KSeF przez Fakturownię | Średni (compliance) | Operator testuje przed startem; próg 10 000 PLN miesięcznie poza KSeF do końca 2026 |
| Brak DESIGN.md i Figmy | Średni (konwersja) | U3 jako bramka akceptacji |
| Publikacja zdjęć wymaga deployu | Niski | Akceptowalne przy concierge |
| Nowa zależność `stripe` | Niski | Zgoda usera przed instalacją (U8) |

## Mierniki sukcesu

- **Biznes:** ≥5 rekordów `service_subscriptions` z aktywnym premium w 3 miesiące od startu fazy 3.
- **SEO:** profile zaindeksowane (Search Console) i 404 dla nieistniejących slugów.
- **Operacje:** wygasła subskrypcja wraca do free bez interwencji. Publikacja premium trwa porównywalnie z `/dodaj`.
- **Jakość:** `npx tsc --noEmit` i `npx jest` zielone, `npx next lint` bez błędów, `messages-parity` zielony.

## Zasoby i zależności

- **Konto Stripe:** produkt „Profesjonalny”, ceny PLN miesięczna i roczna, Smart Retries, Customer Portal login link, webhook.
- **Fakturownia:** aplikacja Stripe z wysyłką do KSeF. Do tego konsultacja z księgowym w sprawie faktur za prowizje Stripe.
- **Vercel:** zmienne Stripe osobno dla Preview i Production.
- **Decyzje usera:**
  - ceny i waluta,
  - akceptacja kierunku wizualnego (U3),
  - zgoda na zależność `stripe`,
  - `PREMIUM_GRACE_DAYS` (domyślnie 3).

## Szacunki czasowe

Orientacyjnie, przy pracy przez autopilota z przeglądami:

| Faza | Szacunek |
|---|---|
| Faza 1 | 2–3 dni robocze, plus czas akceptacji wyglądu |
| Faza 2 | 1–1,5 dnia |
| Faza 3 | 2–3 dni, plus konfiguracja Stripe i Fakturowni po stronie operatora (~0,5 dnia) |

## Kryteria akceptacji całości

- Wszystkie R1–R19 z requirements doc pokryte (tabela śledzenia w planie technicznym).
- Pełna ścieżka w trybie testowym Stripe działa w `pl` i jednym locale z prefiksem: profil free, checkout, webhook, szablon premium, alias, wygaśnięcie, powrót do free.
- Quality gate z `CLAUDE.md` spełniony.
