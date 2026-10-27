# Review fazy 1 — U1: moduł języków obsługi + białoruski

**Branch:** `feature/filtr-jezyka-obslugi`
**Commit:** `54a4b17`
**Data:** 2026-10-20

## Werdykt

⚠️ **KONTYNUUJ Z ZASTRZEŻENIAMI** — 0 × P1, 3 × P2, 10 × P3.

Separacja „język obsługi" vs „locale treści" jest czysta, granice Zod zostały ścisłe
(`z.enum(LANGUAGE_CODES)` w `llmDraftSchema`, `businessDraftSchema`, `owner-edits-schema`, enum w
`DRAFT_JSON_SCHEMA`), klient nie wciąga zoda/drizzle, wszystkie 6 zaplanowanych scenariuszy
testowych pokrytych realnymi asercjami, żaden istniejący test nie został osłabiony.

## Perspektywy

| Agent | P1 | P2 | P3 | Uwagi |
|---|---|---|---|---|
| Security (`security-sentinel`) | 0 | 0 | 1 | email to plain text (brak HTML), SVG statyczne, nieznane kody z bazy odfiltrowane przed indeksowaniem |
| Performance (`performance-oracle`) | 0 | 0 | 1 | bundle +kilkaset bajtów, częściowo zrównoważone usunięciem 2 map flag; `useTranslations` per karta pomijalne |
| Architektura + TS (`kieran-typescript-reviewer`) | 0 | 2 | 4 | dashboard |
| Scenariusze + testy | 0 | 1 | 6 | brak testu `be` w ścieżce LLM |
| E2E (chrome-devtools) | — | — | — | pominięty: faza 1 nie ma checkboxów `Weryfikacja:` przeglądarkowych (tylko CLI/grep); kroki przeglądarkowe to `Operator:` |

## Findings (po deduplikacji)

### 🟠 P2-important

1. **`src/app/[locale]/(dashboard)/dashboard/_components/add-service-form.tsx:41-46`, `service-form.tsx:61-66`**
   — `satisfies readonly { value: ServiceLanguage; label: string }[]` sprawdza poprawność kodów, nie
   kompletność listy: szósty kod nie pojawi się w dashboardzie, a typecheck milczy. Tablica jest
   skopiowana w dwóch plikach, kolejność (`pl, en, uk, ru, be`) różni się od kanonicznej.
   Poprawka: `Record<ServiceLanguage, string>` z etykietami + `SERVICE_LANGUAGES.map(...)`, jedna
   definicja.
2. **`src/app/[locale]/(dashboard)/dashboard/_service-schema.ts:41, :120`** — `z.array(z.string())`
   + `formData.getAll('languages') as string[]`. Preegzystujące, ale teraz istnieje moduł kodów, a
   filtr z fazy 2 zależy od poprawnych kodów w bazie: dowolny string trafia do bazy, karta cicho go
   ukrywa, a filtr nigdy go nie dopasuje. `as` łamie regułę repo. Poprawka:
   `z.array(z.enum(SERVICE_LANGUAGES))`, bez rzutowania.
3. **`src/lib/add-business/llm-draft.test.ts`** — brak testu, w którym model zwraca `be`: nie ma
   dowodu, że `['be','be']` przechodzi przez `llmDraftSchema` i `normalizeLanguages`
   (`llm-draft.ts:207`) jako `['be']`. To główna ścieżka, którą `be` trafia do katalogu.

### 🟡 P3-nit

4. `src/lib/languages.ts` / `form-limits.ts` / `draft-schema.ts:31` — jedna rzecz pod dwiema
   nazwami (`SERVICE_LANGUAGES`/`LANGUAGE_CODES`, `ServiceLanguage`/`LanguageCode`) z łańcuchem
   reeksportów. Akceptowalny dług (komentarz + test `toBe`); kandydat na rename.
5. `service-card.tsx:184` — `useTranslations('addBusiness.languages')` wiąże kartę mapy z
   przestrzenią nazw formularza. Rozważyć neutralne `Languages.*` (×4), jeśli kolejne miejsca
   będą potrzebowały nazw języków w języku strony.
6. `service-card.tsx:10` — `Link` z `next/link` (reguła i18n) w nieposortowanym bloku importów;
   preegzystujące, plik był edytowany.
7. `submission-emails.test.ts` — asercja `not.toMatch(/: pl, be$/m)` słaba; pozytywne `toContain`
   wystarcza.
8. `draft-editor.test.tsx` — brak testu, że `languages-field` renderuje checkbox białoruskiego z
   przetłumaczoną etykietą i że zaznaczenie wkłada `be` do FormData.
9. `generated-summary.tsx:25` — przejście z `LANGUAGE_CODES` na `locales` bez testu regresji.
10. `service-card.tsx:623` — brak deduplikacji (`['be','be']` → dwa obrazki z tym samym `key`) i
    brak testu `languages: []`. Dane tylko z bazy.
11. `src/db/service-input-schema.ts:124` — `z.string().max(5)`: import `db:add` przyjmuje dowolny
    kod (np. `de`). Jedyną bramką jest filtr na karcie. Poza scope fazy.
12. `service-card.tsx:623` — `filter` + `map` dwa przejścia po ≤ 5 elementach; niemierzalne,
    zostawić.
13. `src/lib/languages.ts:29` — `LANGUAGE_ENDONYMS` bez użytkownika do fazy 4 (dropdown).
    Oczekiwane.

### ⚪ Info

- `src/lib/add-business/draft-schema.ts:61, :198` — tablica języków bez `.max()`/dedupu (dedup jest
  w `owner-edits-schema.ts:129`); wpływ minimalny przy enumie 5 wartości.
- Jeden agent zgłosił 6 failujących testów przy równoległym przebiegu 51 suite'ów, niepowtarzalne:
  ponowny przebieg czysty, pełny `npx jest` orkiestratora 1169/1169, przebieg weryfikacyjny
  460/460. Nie zidentyfikowano — nie traktowane jako finding.

## Odchylenia od planu

- Brak istotnych. Wszystkie pliki z `Pliki:` IU-1 zmienione lub świadomie bez zmian
  (`languages-field.tsx` korzysta z reeksportu). Wszystkie zaplanowane pliki testowe istnieją.
- `Delegate to: feature-builder-web-fullstack` zgodne z kategorią plików (UI + lib).
- Dashboard ma dalej własne etykiety (plan: „etykiety jak dziś") — patrz P2 #1.
- `npm run build` nie uruchomiony w fazie (dev server na :3000).

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 3
- Odznaczone na podstawie Agent 5 E2E (chrome-devtools): 0
- Pozostawione dla operatora (Manual): 0
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły

- [x] CLI: `npx tsc --noEmit` bez błędów → PASS (`npx tsc --noEmit`, exit 0)
- [x] CLI: testy `src/lib/languages`, `src/lib/add-business`, podglądu karty i karty usługi →
  PASS (35/35 suites, 460/460 testów)
- [x] Grep: `be` w `addBusiness.languages` we wszystkich czterech `messages/*.json` → PASS
  (pl: białoruski, en: Belarusian, ru: белорусский, uk: білоруська; także
  `confirmationEmail.languages.be`)

Kroki `Operator:` fazy 1 (`klasyfikacja.md`, akceptacja `by.svg`) bez zmian — poza bookkeepingiem.
