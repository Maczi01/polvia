# Review fazy 2 — Treść premium (concierge)

**Branch:** `feature/strona-firmy-premium`
**Data:** 2026-10-31
**Zakres:** `16e762d..1440555` (U6, `premium.ts` przeniesiony z U8, U7): 26 plików, +1797/−19
**Reviewerzy:** security-sentinel, performance-oracle, kieran-typescript-reviewer (+ architecture-strategist), spec-flow-analyzer (scenariusze i pokrycie testów). E2E (Agent 5) nie był uruchamiany: faza nie ma checkboxów `Weryfikacja:` w przeglądarce, a jedyny scenariusz przeglądarkowy (U7) to krok `Operator:`, wykonalny dopiero po U8.

## Werdykt

⚠️ **KONTYNUUJ Z ZASTRZEŻENIAMI** — 0 × P1, 4 × P2, 20 × P3.

Kod jest czysty:
- bez `any`, `as` i `!`;
- granica klient/serwer zachowana: komponenty klienckie nie importują zoda ani `src/db/**`;
- path traversal w nazwach zdjęć zamknięty regexem na zapisie i na odczycie;
- XSS: brak wektora;
- treść premium nie wycieka do widoku free;
- premium nie da się włączyć bez subskrypcji.

Problemy P2 dotyczą **kontraktu, który U8 przejmie** (źródło subskrypcji, nietestowana ścieżka premium w `page.tsx`), dwóch kształtów tej samej treści i nowego sposobu, w jaki może się wyłożyć `db:reset`.

## 🟠 P2 — ważne

### P2-1. Źródło subskrypcji: stub bez `serviceId`, synchroniczny, w `page.tsx`
**Zgłosili:** architektura P2-2, security P3, scenariusze F1, performance P3.
- **Gdzie:** `src/app/[locale]/firma/[slug]/page.tsx:56` (`getPremiumSubscription(): PremiumSubscriptionState | null`), `:64-65`.
- **Problem:**
  - U8 musi zmienić sygnaturę, nie tylko ciało: dochodzi `serviceId`, funkcja staje się async, a za nią `resolveProfileView` i oba wywołania.
  - Sygnatura bez `serviceId` zaprasza do źródła, które nie filtruje po usłudze. To jedyna realna ścieżka do „premium dla wszystkich”.
  - Źródło danych w `page.tsx` łamie przepływ `page → @/lib (server-only) → Drizzle`.
  - `new Date()` wołane osobno w metadanych i stronie może na granicy karencji dać różne decyzje.
- **Poprawka (preferowana):** `getServiceProfile` zwraca `subscription: PremiumSubscriptionState | null`. Do U8 to stała `null` w zapytaniu, w U8 `leftJoin(service_subscriptions)`, tak jak `premiumContent`. To jedno zapytanie, już deduplikowane przez `cache()`, a `resolveProfileView(profile)` zostaje synchroniczne.
- W U8 wymagany test negatywny: aktywna subskrypcja usługi A nie włącza premium usłudze B.

### P2-2. Ścieżka premium w `page.tsx` bez testu
**Zgłosili:** architektura P2-3, scenariusze F1.
- **Gdzie:** `page.tsx:120-121` (cover w OG tylko przy premium), `:138-151` (pomijanie `getSimilarServices`), `:85-111` (mapowanie szablonów w `ProfileView`).
- **Problem:** R18 mówi, że treść zostaje po wygaśnięciu. Odwrócony warunek wypuściłby cover wygasłego premium do Open Graph albo pokazał „Podobne firmy” przy premium, a gate by tego nie złapał. `service-profile-metadata.test.ts` sprawdza tylko, że builder użyje podanego `coverImagePath`, a nie kiedy go dostaje.
- **Poprawka:** wyciągnąć czystą funkcję (np. `selectOgCoverPath(viewKind, content)` + `shouldLoadSimilarServices(viewKind)`) do `select-profile-view.ts` z testami: free z treścią → `null`, premium z coverem → src, premium bez treści → `null`. Opcjonalnie przenieść `ProfileView` do `_components/profile-view.tsx` z testem renderu (architektura P3-8).

### P2-3. Dwa ręcznie zsynchronizowane kształty treści premium; projekcja widoku w `src/db/**`
**Zgłosiła:** architektura P2-1.
- **Gdzie:** `src/db/premium-content-schema.ts:115-151` (`LocalizedPremiumContent`, `localizePremiumContent`, `premiumImagePath`) i `_components/service-profile-types.ts:35-47` (`PremiumContent` z typami składowymi).
- **Problem:** typy łączy tylko jednokierunkowe przypisanie w `to-profile-view.ts:61`. Nowe pole w `LocalizedPremiumContent` nie dotrze do szablonu, a kompilator nie zaprotestuje. Moduł „schema” w warstwie `db` wybiera locale, liczy alt coveru i ścieżki pod `next/image`.
- **Poprawka:** przenieść `LocalizedPremiumContent`, `localizePremiumContent` i `premiumImagePath` do `src/lib/service-profile-premium.ts`. W `service-profile-types.ts` zostaje `export type PremiumContent = LocalizedPremiumContent` (import type). `premium-content-schema.ts` zostaje czystym Zodem plus `premiumImageFiles`.

### P2-4. Seed (`db:reset`) pada na dowolnym niepoprawnym JSON w `data/services/`, bez nazwy pliku
**Zgłosiły:** scenariusze F2. Potwierdzone w kodzie.
- **Gdzie:** `src/db/upsert-premium-content.ts:180`. `JSON.parse` stoi przed `hasPremiumBlock`.
- **Problem:** wcześniej seed nie czytał `data/services/`, a teraz plik roboczy bez bloku premium (np. niedokończony wpis z `/dodaj`) przerywa `db:reset` na samym końcu gołym `SyntaxError`. To łamie kontrakt z docstringu: pliki bez bloku nie blokują seeda.
- **Poprawka:** owinąć parse. Plik nieparsowalny dostaje ostrzeżenie z nazwą pliku i jest pomijany (bez bloku nie wiadomo, czy jest premium), albo `PremiumContentError('INVALID_ENTRY', '<plik>: niepoprawny JSON')`. Plus test z plikiem `'{'`.

## 🟡 P3 — nity

**Struktura i typy**
1. `upsert-premium-content.ts` (276 linii) łączy trzy odpowiedzialności: logikę na porcie, wsad plików seeda i adapter Drizzle. Lookup usługi robi dwa zapytania: `findServiceSlugsByLocationSlugs`, potem `findServiceIdBySlug`.
   - Propozycja: wydzielić `premium-content-store.ts` i `publish-premium-entries.ts`; `resolveEntryService` zwraca `{ serviceId, serviceSlug }`.
   - *(Architektura zgłosiła jako P2; obniżone, bo brak defektu i plik mieści się w limicie. Performance: ten sam podwójny lookup jako P3.)*
2. `upsert-premium-content.ts:211`: `buildSavePremiumContentQuery` bez explicit return type.
3. Formatowanie issue Zoda powtórzone 3× (`add-service.ts:88`, `publish-premium.ts:60`, `upsert-premium-content.ts:186`). Wydzielić `formatZodIssue`.
4. `publish-premium.ts:91-106` powtarza `upsertPremiumContent`, żeby wpiąć diff; ujednolicić albo opisać komentarzem.
5. `premium-content-diff.ts`: parametr `previous` niesie `keyOf` także dla `next`; `sameKeys` lepiej nazwać `isOnlyReordered`.
6. `premium-content-schema.ts:54` hardkoduje `{pl, uk, en, ru}` zamiast `locales` z `@/i18n/config`.
7. `service-profile-premium.ts:20`: `stored === undefined` broni przed niemożliwym scenariuszem.
8. `select-profile-view.ts:7`: martwy eksport `DEFAULT_PREMIUM_TEMPLATE`.
9. `premium.ts`:
   - `interface` zamiast `type`, niespójne z modułami obok;
   - test `cancelAtPeriodEnd` przechodzi trywialnie (pole nie wpływa na wynik), więc przemianować na „nie skraca okresu”;
   - `expect(PREMIUM_GRACE_DAYS).toBe(3)` testuje stałą, nie zachowanie;
   - rozważyć nazwę `premiumEntitlementEnd`.
10. `service-profile-metadata.ts:93`: `coverImagePath?: string | null` ma dwa stany „brak”, a `page.tsx` zawsze go podaje, więc zrobić pole wymaganym.
11. `seed.ts:12`: kolejność importów (`node:path` po lokalnych).

**Dane i walidacja**

12. Brak górnego limitu liczby pozycji `priceList` i `faq` (`premium-content-schema.ts:88-89`). Dodać stałe w `premium-templates.ts` obok `PREMIUM_GALLERY_MAX`.
13. Duplikaty w galerii, cenniku i FAQ przechodzą walidację: diff je zlewa („Bez zmian”, a zapis dodaje), a w jednym locale powstają zduplikowane klucze Reacta (`profile-price-list.tsx:32` `key={item.name}`). Rozwiązanie: `superRefine` z unikalnością.
14. `existsSync` na Windows nie rozróżnia wielkości liter, a regex ma `/i`. `Cover.JPG` przy `cover.jpg` na dysku przejdzie lokalnie i da 404 na Vercelu. Porównywać z `readdir` albo wymusić małe litery.
15. Seed publikuje blok `premium` bez kroku weryfikacji płacącego (R17). W SKILL.md dopisać „blok `premium` dopiero po weryfikacji” albo wprowadzić flagę.
16. Katalog zdjęć jest powiązany ze slugiem usługi. Gdy `db:reset` przenumeruje sufiks `-2`, seed padnie na `IMAGES_MISSING` (niestabilność slugu istniała wcześniej, faza 2 robi z niej twardą awarię). Odnotować w SKILL.md.

**Wydajność i cache (do U8)**

17. Trasa `/[locale]/firma/[slug]` nie deklaruje `dynamic`/`revalidate`, a decyzja widoku zależy od `new Date()`. Przed U8 sprawdzić w `npm run build`, czy trasa ma `ƒ`; jeśli jest statyczna, webhook potrzebuje `revalidatePath`.
18. Zod i lokalizacja treści premium liczą się także dla widoku free. Pomijalne; w U8 rozważyć leniwe parsowanie. Uszkodzony wiersz loguje błąd przy każdym wejściu.

**Testy**

19. Brak testów propagacji `IMAGES_MISSING` i `ENTRY_AMBIGUOUS` w `publishPremiumEntries`. Brak przypadku `status: 'active'` po karencji na poziomie `selectProfileView`.
20. Filtr `slug === null` w `createPremiumContentStore` bez pokrycia. Test „jeden wiersz” (`upsert-premium-content.test.ts:77`/`:239`) sprawdza `Map` atrapy; realną gwarancję daje test SQL, więc przemianować.

Sprawdzone bez uwag (wybór):
- `cache(getServiceProfile)` deduplikuje metadane i stronę;
- left join po PK;
- `onDelete: cascade`;
- `INSERT … ON CONFLICT` bezpieczny przy równoległych upsertach;
- log Zoda bez wartości pól;
- bundle klienta bez zoda.

## Odchylenia od planu

| # | Odchylenie | Ocena |
|---|---|---|
| 1 | U6: usługa szukana po slugach lokalizacji z pliku, nie po `services.slug` z pliku | Słuszne: zamyka zapis treści do cudzego profilu przy duplikacie nazwy. Koszt: podwójny lookup (P3-1). |
| 2 | U6: lokalizacja treści (`localizePremiumContent`) w `src/db/premium-content-schema.ts`; plan miał ją w `getServiceProfile` (`src/lib`) | Odchylenie warstwowe → **P2-3** |
| 3 | U6: dodatkowe moduły `premium-content-diff.ts`, `service-profile-premium.ts`, fixture `tests/fixtures/premium/` | OK (limit 300 linii, reguła fixtures) |
| 4 | U6: limity długości tekstów, regex nazwy pliku; bez limitu liczby pozycji | Regex to plus; limit pozycji → P3-12 |
| 5 | `premium.ts` przeniesiony z U8 do fazy 2 | Decyzja usera; zgodne z zależnością U7 → U8 |
| 6 | U7: `toPremiumProfileView` (pusta treść `classic`) | OK, typowane zawężenie zamiast `!` |
| 7 | U7: decyzja „kiedy cover w OG” w nietestowanym `page.tsx` | → **P2-2** |
| 8 | U7: scenariusz [Manual] niewykonalny do U8 | Przenieść weryfikację do U8 |

- Pliki testowe z planu (`premium-content-schema.test.ts`, `upsert-premium-content.test.ts`, `select-profile-view.test.ts`) istnieją i mają realne asercje.
- `Delegate to:` jest zgodne z kategorią plików w obu IU.
- Zmiany asercji w `service-profile-queries.test.ts` i `to-profile-view.test.ts` wzmacniają testy.

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 6
- Odznaczone na podstawie Agent 5 E2E (chrome-devtools): 0
- Pozostawione dla operatora (Manual): 0
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły
- [x] CLI U6: `npx tsc --noEmit` bez błędów → PASS
- [x] CLI U6: `npx jest src/db/premium-content-schema src/db/upsert-premium-content src/lib/service-profile-queries` → PASS (3/3 suite'y, 53 testy)
- [x] CLI U6: `npx next lint` bez błędów → PASS (0 błędów)
- [x] CLI U7: `npx tsc --noEmit` bez błędów → PASS
- [x] CLI U7: `npx jest "src/app/\[locale\]/firma"` → PASS (21/21 suite'ów, 88 testów)
- [x] CLI U7: `npx next lint` bez błędów → PASS

Severity gate bez zmian: ⚠️ kontynuuj z zastrzeżeniami (4 × P2).
