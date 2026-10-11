# Review fazy B — Dodaj firmę z AI

Data: 2026-10-11
Zakres: `1add5ed..6cd970e` (U8 `5228704`, U9 `e099104`, U10 `3b1e0a3`; 75 plików).
Obejmuje orkiestratory `src/lib/add-business/**`, Server Actions, stronę `/dodaj-firme` z
komponentami, CTA na `/kontakt`, `routing.ts`, sitemap i `messages/*.json`.
Reviewerzy: security-sentinel, performance-oracle, kieran-typescript-reviewer
(+ architecture-strategist), tester scenariuszy.

E2E (chrome-devtools) pominięte. Wszystkie scenariusze przeglądarkowe fazy B są oznaczone
`[Manual]`, bo flow woła płatne OpenAI, wysyła prawdziwe maile, a `.env.e2e` nie istnieje.
Checkboxy `Weryfikacja:` fazy B to wyłącznie CLI i grep.

## Severity gate

**⚠️ KONTYNUUJ Z ZASTRZEŻENIAMI: 0 × P1, 11 × P2, 37 × P3**

Rdzeń jest solidny:
- **Warstwy:**
  - `_actions.ts` jest cienkie: tylko IP, locale i wstrzyknięcie usług;
  - orkiestratory mają `server-only` i DI;
  - klient importuje z `types.ts` wyłącznie `import type`;
  - `sharp`, `openai` i `ioredis` nie trafiają do chunków klienta.
- **R9:** z FormData czytane są tylko pola R8. Kategoria, zasięg, tagi, opisy i geo pochodzą
  ze szkicu i z serwerowego geokodowania.
- **Szkic:** `consumeDraft` (GETDEL) jest atomowy, a `updateDraftGeo` z `XX` nie wskrzesza
  wysłanego szkicu.
- **Budżet generowania:** najgorszy przypadek to ok. 50–51 s przy `maxDuration = 60`.
  Deadline jest liczony od startu, podstrony są pobierane równolegle.
- **`FlowState`:** jedna unia, przejścia to czyste funkcje, a każdy `switch` jest wyczerpujący.
- **Bezpieczeństwo i typy:**
  - brak XSS: nie ma `dangerouslySetInnerHTML`, `webpage` i `email` są renderowane jako tekst;
  - brak open redirect w linku duplikatu;
  - nie ma `any`, `as` ani `!`.
- **Testy:** każdy scenariusz `[Unit]` z planu U8–U10 ma test z asercją odpowiadającą
  scenariuszowi. Na lib, UI i kontakt przechodzi 391/391.

## 🟠 P2 — important

| # | Plik:linia | Problem | Poprawka | Źródło |
|---|---|---|---|---|
| 1 | `src/lib/add-business/submit-draft.ts:139-147` | `processLogoUpload` (sharp, do 4096² ≈ 67 MB RGBA) działa **przed** `consumeSubmitLimit`. Jeden `draftId` (żyje 2 h) pozwala na tysiące POST-ów z PNG-bombą, a każdy dekoduje obraz, zanim dostanie `limited`. Skutek: DoS funkcji i koszt skalowania. | `peekRateLimit(submitIpKey(ip))` przed sharpem; wiążący `consume` zostaje tam, gdzie jest. Test: po wyczerpaniu limitu `processLogoUpload` nie jest wołany. | sec, perf |
| 2 | `src/lib/add-business/submit-draft.ts:150-170`, `src/lib/mailer.ts:67` | Kroki submitu idą sekwencyjnie: geo (≤ 9,5 s), logo kandydata (≤ 8 s), `consumeDraft`, dwa maile SMTP. `createTransport` ma domyślne timeouty (połączenie 2 min, socket 10 min). Zawieszony Gmail → Vercel ubija funkcję po `consumeDraft`. Szkic jest zużyty, mail nie wyszedł, a `logLostSubmission` się nie wykonuje, więc zgłoszenie znika bez śladu. | `resolveGeo` i `fetchLogoCandidate` równolegle (`Promise.all`). Timeouty `connectionTimeout`/`greetingTimeout`/`socketTimeout` ok. 10 s w `sendMail`. Test: timeout maila → `SEND_FAILED` + log. | perf |
| 3 | `add-business/_components/business-card-preview/static-map-url.ts:9-10` | Druga kopia zahardkodowanego tokenu Mapbox `pk.` z obcego konta (`hijiangtao`); pierwsza jest w `overview-map.tsx`. Wartość leży poza `env.ts`, co narusza ToS i obciąża cudzą quotę. Unieważnienie tokenu da pusty obrazek, bo nie ma `onError`. | **Decyzja usera:** własny token z ograniczeniem URL jako `NEXT_PUBLIC_MAPBOX_TOKEN` w `env.ts` (client + runtimeEnv), jedna stała dla obu miejsc i fallback `noPin` przy błędzie obrazka. | sec, arch |
| 4 | `manual-step.tsx:7-10`, `draft-editor.tsx:7`, `business-card-preview.tsx:10`, `draft-values.ts:1`, `opening-hours-fields.tsx:7`, `languages-field.tsx:6`, `generated-summary.tsx:6` | Komponenty klienckie importują stałe (`WEEKDAY_KEYS`, `LANGUAGE_CODES`, `NOTES_MAX_LENGTH`, `MANUAL_DESCRIPTION_*`) z modułów walidacji. Przez to schematy zod, `slugify` i `DRAFT_JSON_SCHEMA` dla LLM trafiają do bundla i wykonują się w przeglądarce (chunk strony 14,7 KB gzip, `slugify` 8,9 KB). Klient importuje też z `src/db/**`, co łamie granicę warstw (§14). | Lekkie moduły stałych na wzór `src/lib/categories.ts`: `src/lib/weekdays.ts`, `src/lib/add-business/form-limits.ts` (z `LOGO_MAX_BYTES`, allowlistą MIME i `LANGUAGE_CODES`). Schematy je reeksportują. | perf, arch |
| 5 | `draft-editor.tsx:278-287`, `add-business-flow.tsx:181`, `next.config.ts:13-17` | Logo większe niż ok. 3 MB odbija się na `bodySizeLimit`, a promise jest rejectowany przez `.catch(() => null)`. UI pokazuje ogólne „Coś poszło nie tak” zamiast „logo za duże”. Pliki 2–3 MB i tak idą w całości przez sieć. | Sprawdzić `file.size > LOGO_MAX_BYTES` po stronie klienta, przed wysyłką (z błędem pola). Test edytora. | scen, perf |
| 6 | `add-business-flow.tsx:175, 181`, `use-relocation.ts:52` | `.catch(() => null)` i `.catch(() => NETWORK_FAILURE)` połykają odrzucenie bez logu (§4). Fallback `{ ...origin, error: 'INTERNAL' }` zostawia stare `fieldErrors`. `NETWORK_FAILURE` składa `ActionError` ręcznie. | Logować błąd. Przejście `afterRejection(origin)` z `cleared()` dodać w `flow-state.ts` i użyć `actionFailure('INTERNAL')`. Test przejścia. | arch |
| 7 | `generate-draft.ts:91-96, 169`, `types.ts:155-158` vs `flow-notices.tsx:66` | Wynik `duplicate` niesie `slug` i `url`, ale UI używa tylko `slug`. `url`/`duplicateUrl()` to martwy kontrakt i druga, ręczna implementacja prefiksu locale. Negatywna asercja „`ru` ≠ `/en`” (`generate-draft.test.ts:76`) testuje więc kod, którego nikt nie renderuje. | Usunąć `url` i `duplicateUrl`. Asercję negatywną przenieść do testu `DuplicateNotice` (href dla `ru`/`uk`). | arch |
| 8 | `generate-draft.ts:163-164, 182-183, 192-193` | Gałęzie kosztowe limitów nie mają testu. Brakuje przypadków: `consumeGenerationLimit` → `allowed:false` po fetchu (wyścig dwóch requestów przy ostatnim generowaniu), wyczerpany `consumeFetchLimit`, wyczerpany limit globalny przy wolnym IP, tryb ręczny przy wyczerpanym limicie. Regresja oznacza płatne wywołanie OpenAI ponad limit (R16). | 4 testy orkiestratora: wynik `limited`, zero wywołań LLM. | scen |
| 9 | `draft-geo.ts:14-20`, `submit-draft.ts:70-85`, `relocate-draft.ts` | Porażka geokodera (D3) nie ma testu w żadnym orkiestratorze. W testach `geocode` nigdy nie zwraca `ok:false`. | Testy: (a) `local` + `NOT_FOUND` przy generowaniu → `ready`, `pin:null`; (b) submit z `stored.geo === null` i niezmienionym adresem → ponowne geokodowanie; (c) submit + `RATE_LIMITED` → `sent`, `missingCoordinates: true`; (d) relocate + `RATE_LIMITED`/`UPSTREAM_FAILED` → `GEOCODE_UNAVAILABLE`. | scen |
| 10 | `src/lib/add-business/manual-input-schema.ts` | Brak własnego testu. Pośrednio pokryte są tylko „brak opisu” i „za krótki”. | Test: `tooLong` (> 1000), opis z samych spacji → `required`, zły `email`, `link` inny niż http, brak `name`/`city`, `File` w polu tekstowym → `invalidValue`. | scen, arch |
| 11 | `src/lib/add-business/page-sources.ts` | Brak własnego testu, a ścieżki błędów `readPageSource` są niepokryte. | Testy: `HtmlExtractError` strony głównej → `needsManual('UNREADABLE')`; `mainTimeout < MIN_FETCH_TIMEOUT_MS` → `TIMEOUT` bez fetcha; odrzucona podstrona; priorytet JSON-LD strony głównej i podział budżetu tekstu w `combine`. | scen |

## 🟡 P3 — nit

**Bezpieczeństwo**
1. `relocate-draft.ts:244-248`, `submit-draft.ts:139`: szkic nie jest związany z IP, a `draft-store` loguje pełny `draftId`. Kto zna id, może relokować i wysłać zgłoszenie. Defense in depth: nie logować pełnego id albo zapisać `rateLimitSubject(ip)` w szkicu.
2. `rate-limit.ts:67-79`: agregacja do /64 nadal przepuszcza właściciela /48 (tunel HE). 20 podmiotów wyczerpuje `gen:global`. To rezyduum P2-3 z A. Do rozważenia globalny limit fetch i drugi poziom agregacji (/48). Decyzja otwarta z fazy A.
3. `submit-draft.ts:170`: potwierdzenie na niezweryfikowany adres może służyć jako kanał spamu i phishingu, bo w trybie ręcznym `name` i `webpage` trafiają do maila wysyłanego z Gmaila operatora. Poprawka: usunąć `webpage` z potwierdzenia albo dodać globalny limit submitu.
4. `submission-emails.ts:217`: mail operatora pokazuje tylko `Opis (pl)`. Prompt injection w opisie uk/en/ru jest widoczny tylko w załączniku JSON. Wypisywać wszystkie 4 opisy.
5. `next.config.ts:11-15`: `bodySizeLimit: '3mb'` działa dla WSZYSTKICH Server Actions. Dopisać to w komentarzu.
6. `submit-draft.ts:96-105`: `logLostSubmission` loguje pełny `entry.json` (telefon i e-mail firmy). To świadoma decyzja (P3-5 z A); alternatywą jest Redis z TTL.

**Wydajność**
7. `generate-draft.ts:160-166`: limity Redisa i zapytanie o duplikat idą sekwencyjnie, a `findDuplicate` nie ma własnego timeoutu, więc zawieszona baza wisi do 60 s.
8. `generate-draft.ts:131-145`: geokodowanie startuje po LLM. Przy adresie z JSON-LD można je robić równolegle (do −9 s), ale wynik trzeba odrzucić, jeśli LLM zmieni adres.
9. `business-card-preview.tsx:125-134`: `logoCandidate` to obcy URL ładowany przez przeglądarkę w pełnym rozmiarze.
10. `static-map-url.ts:113`: obraz mapy zawsze `@2x`; brak `srcSet`. `loading="lazy"` na sticky podglądzie opóźnia mapę.
11. `generation-progress.tsx:322-325`: interwał działa dalej po ostatnim etapie. Koszt jest pomijalny.
12. `[locale]/layout.tsx:95,165`: cały plik `messages` idzie do `NextIntlClientProvider`, a `addBusiness` dodaje +7 KB (+21%) RSC na każdej stronie. Wzorzec istniał przed tym zadaniem; proponuję osobne zadanie z `pick` per namespace.
13. `add-business-flow.tsx:34-51`: dwa wysłania w jednej klatce mogą nadpisać stan `submitted` błędem `DRAFT_EXPIRED`. Poprawka: zwracać `_previous`, gdy `step === 'submitted'`.

**Flow i scenariusze**
14. Brak testów współbieżności: podwójny submit na tym samym `draftId` (jeden mail), relocate po `consumeDraft` (`DRAFT_EXPIRED`), relocate → submit z tym samym adresem (bez ponownego geokodowania, D10).
15. `draft-editor.tsx:314-320`: wysyłka nie jest blokowana w trakcie relokacji. Submit czyta stare `geo` i geokoduje ponownie.
16. `flow-state.ts:119-120`: `limited` z submitu porzuca edytor, choć szkic żyje. Komunikat mówi o limicie generowania, nie wysyłek. Lepiej zostać w `editing` z błędem i dodać test `afterSubmit` dla `limited`/`INVALID_ENTRY`.
17. `flow-state.ts:102-106`: `SEND_FAILED` mówi „Spróbuj ponownie później”, ale szkic jest zużyty, więc ponowna próba zjada kolejne generowanie.
18. `generate-draft.ts:72` vs `optionalWebpage` (max 255): link do 2048 znaków wraca w prefill trybu ręcznego i daje `link: tooLong`.
19. `generate-draft.ts:188-205`: tryb ręczny nie sprawdza duplikatu po domenie pola `link`, więc R7 jest spełnione luźniej niż w trybie link.
20. Słabe asercje:
    - `submit-draft.test.ts:202-212`: brak asercji, że mail operatora poszedł i że jest `warn`;
    - `draft-editor.test.tsx:279-295`: brak sprawdzenia współrzędnych w `src`;
    - `submit-draft.test.ts:295`: nazwa testu mówi o Redisie, a rzuca `geocode`.
21. Brakujące przypadki brzegowe:
    - `fetchLogoCandidate` → `null` (oczekiwane `hasLogo:false`);
    - submit `online` bez geokodowania;
    - edytor `online` bez `RelocateControl`;
    - pełny flow trybu ręcznego w `add-business-flow.test.tsx`;
    - podgląd po odrzuceniu logo.
22. Moduły tylko z pokryciem pośrednim: `action-errors.ts` (gałąź `ZodError` w `describeException`), `draft-geo.ts`, `preview.ts`, `use-relocation.ts` (`NETWORK_FAILURE`).

**Architektura i jakość**
23. `types.ts:41-90`: „kontrakt dla UI” trzyma też serwerowe tabele mapowania błędów i `ACTION_ERROR_MESSAGES`. Przenieść je do `action-errors.ts`.
24. `relocate-draft.ts:258`: ręcznie składa pin, duplikując `toPin()` z `preview.ts:10`.
25. `fieldErrorsFromZod` (`manual-input-schema.ts:88`) i jego kopia w `owner-edits-schema.ts:224-233`. Wydzielić `field-errors.ts`.
26. `page-sources.ts:124`: `HtmlExtractError` jest mapowany na `'INVALID_URL'`, więc kod w logu kłamie.
27. Niespójne sygnatury orkiestratorów: `relocateDraft(formData, deps)` vs `generateDraft({…}, deps)`. Do tego ogólna nazwa `ActionRequest`.
28. `owner-edits-schema.ts:45`: eksportowany `optionalText` nie ma jawnego typu zwracanego.
29. `link-step.tsx:166-167, 199-205`: duplikuje klucze `OWNER_EDIT_ERRORS`, `checkLink` siedzi w pliku komponentu, a `catch {}` bez logu (uzasadniony komentarzem) i tak łamie literę CLAUDE.md.
30. Kolizje nazw:
    - typ i komponent `SubmittedState`;
    - `isPending` w `business-card-preview.tsx:105` znaczy „niepotwierdzone”. Proponuję `isUnconfirmed`.
31. Duplikacja stylów:
    - `PRIMARY_BUTTON_CLASSES` obok `buttonVariants`;
    - `LINK_CLASSES` powtórzone inline w `submitted-state.tsx:94`;
    - `text-green-700` w 3 krokach.
    Lepiej warianty `cva`.
32. `disabled={isPending}` na przyciskach drugorzędnych (`link-step.tsx:275`, `manual-step` `onBack`, `draft-editor.tsx:207`) jest sprzeczne z decyzją „`aria-disabled`, bo `disabled` gubi fokus”.
33. `draft-values.ts:40-70`: `emptyHours()` wypisuje 7 dni ręcznie obok `WEEKDAY_KEYS`.
34. `hasLocale(LANGUAGE_CODES, locale) ? locale : 'pl'` powtórzone w 2 miejscach. Lepiej helper.
35. Funkcje ponad 50 linii: `DraftEditor` (ok. 170) i `BusinessCardPreview` (ok. 140). Do wyciągnięcia podkomponenty. W edytorze propsy są czytane mieszanie: część destrukturyzowana, część przez `props.x`.
36. `sitemap.ts:3` importuje z folderu route'a (`add-business-urls`). Przenieść helper do `src/lib/`.
37. Dokumentacja:
    - komenda `npx jest "src/app/\[locale\]/(header)/…"` w checklistach U9/U10 dopasowuje 0 plików (nawiasy w regexie), więc testy UI nie były nią weryfikowane;
    - `zadania.md:211` opisuje kolejność „social → duplikat → peek” niezgodną z kodem (decyzja usera: limit przed duplikatem).

    Poprawione w trakcie review.

## Odchylenia od planu

- **Pliki:** wszystkie pliki z sekcji „Pliki:” U8–U10 istnieją, łącznie z testami i stories.
  `bodySizeLimit: '3mb'` jest ustawione, `routing.ts` daje `/dodaj-firme` dla pl i
  `/add-business` dla pozostałych.
- **Pliki spoza planu:**
  - z U8: `relocate-draft`, `action-errors`, `page-sources`, `manual-input-schema`, `draft-geo`, `preview`, harness;
  - z U9: `flow-state`, `use-object-url`, `form-field`, `flow-heading`, `generation-progress`, `flow-notices`, podkomponenty edytora, `static-map-*`, `add-business-urls`, `test-utils`.

  Wszystkie są zalogowane w kontekście. Uzasadnienie (limit 300 linii, testowalność przejść) jest trafne; największy plik produkcyjny ma 240 linii.
- **Niezalogowane jako odchylenie:**
  - zmiana `src/app/sitemap.ts` i `sitemap.test.ts` (plan kazał tylko sprawdzić);
  - kontrakt `duplicate` dostał `slug` obok planowanego `url` (P2 #7).
- **Zalogowane, akceptowalne:**
  - kolejność `generateDraft` (limit fetch przed duplikatem, decyzja usera);
  - wszystkie kroki, które mogą zawieść, w `submitDraft` przed `consumeDraft`;
  - nagłówek w CTA;
  - logo, e-mail i uwagi w kroku 2.
- **`Delegate to:`** zgodne z kategorią plików. Jedyny plik U9 spoza warstwy UI to `sitemap.ts` (⚪ info).
- **Poza zakresem** (bez zmian): martwy import `Header` i nieposortowane importy w `contact/page.tsx:4-5`.

## E2E

0 scenariuszy. Checkboxy przeglądarkowe fazy B to `[Manual]` w Operator checklist U9/U10.

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 9
- Odznaczone na podstawie Agent 5 E2E (chrome-devtools): 0
- Pozostawione dla operatora (Manual): 0. Operator checklist U9/U10 (7 pozycji `[Manual]`) ma inny prefiks i zostaje bez zmian.
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły
- [x] CLI: jest `generate-draft.test.ts` + `submit-draft.test.ts` → PASS, 2 suity, 24/24
- [x] CLI: `npx tsc --noEmit` (U8) → PASS, exit 0
- [x] Grep: `_actions.ts` bez `process.env` / `console.log` → PASS, 0 trafień
- [x] CLI: jest `add-business` (UI) → PASS, 16 suit, 102/102. Uruchomione z poprawionym wzorcem `\(header\)`; wzorzec z checklisty dopasowywał 0 plików i został poprawiony (P3 #37).
- [x] CLI: `npx tsc --noEmit` + `npx next lint` (U9) → PASS, exit 0 / 0 błędów
- [x] Grep: każdy klucz `addBusiness.*` w 4 plikach `messages/*.json` → PASS, 148 kluczy, identyczne zbiory
- [x] Grep: brak `next/link` / `next/navigation` w `add-business/**` → PASS, 0 trafień
- [x] CLI: jest `contact` → PASS, 1 suita, 3/3 (poprawiony wzorzec)
- [x] Grep: klucz CTA (`addBusiness.cta.*`) w 4 plikach → PASS

Sekcja „Quality gate (przed PR)” leży poza fazą B i zostaje do `/dev-docs-complete`.
