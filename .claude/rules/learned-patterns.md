# Learned Patterns

Reguly wyciagniete z rozwiazanych problemow w `docs/solutions/`. Zarzadzane przez `/dev-compound` i `/dev-compound-refresh`.

<!-- rule-count: 11 -->

- **Zmiany schematu aplikuj przez `npx drizzle-kit push`, nie `generate`**: katalog `drizzle/` w tym repo jest martwy (snapshoty znaja 2 z 4 enumow i nie znaja tabeli `service_locations`), wiec `generate` produkuje migracje tworzaca od zera obiekty juz istniejace w bazie. Jesli `generate` zapyta o `rename`, ZATRZYMAJ SIE — wybor `~ county > coverage rename enum` jest destrukcyjny. Skrypt `npm run drizzle:generate` wola przedawniony `generate:pg` i nic nie robi.
  Source: docs/solutions/database-issues/2026-08-22-drizzle-generate-nieuzywalny-snapshoty.md

- **`z.coerce.*` na granicy `FormData` zawsze przez `z.preprocess`**: `FormData.get()` zwraca `null` dla pola nieobecnego i `''` dla pustego, a `Number()` zamienia oba na `0` — walidacja przechodzi i cicho zapisuje zero jako prawdziwa wartosc. Normalizuj puste wejscie do `null` przed coercja, a wymagalnosc wyrazaj przez `.superRefine()`. `?? 0` na nullowalnej kolumnie liczbowej to ten sam bug w druga strone. Nie rzutuj `formData.get(x) as string` — to wycisza jedyne ostrzezenie, ktore by to wylapalo.
  Source: docs/solutions/runtime-errors/2026-08-22-zod-coerce-number-puste-formdata.md

- **Zaleznosc ESM w tescie: `moduleNameMapper` na build CJS, nie `transformIgnorePatterns`**: `next/jest` nadpisuje `transformIgnorePatterns` z `jest.config.js`, wiec dopracowywanie regexa jest strata czasu. Gdy `render()` failuje pustym `AggregateError`, opakuj go w `try/catch` i wypisz `error.errors[0].message` — React ukrywa przyczyne (u nas: brak `ResizeObserver` w jsdom, wymaganego przez `virtua`).
  Source: docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md

- **Catch-all + `<Suspense>` = walidacja w middleware, nie w `page.tsx`**: `notFound()` odpalone po rozpoczeciu streamowania NIE zmieni statusu — Next dokleja tresc 404 do odpowiedzi, ktora ma juz `200`, czyli soft-404 indeksowalny przez Google. Sprawdzaj `curl -o /dev/null -w "%{http_code}"`, nie wyglad strony. Nie mierz statusow na dev serverze po `npm run build` — produkcyjny build nadpisuje `.next` i wszystko zwraca 500.
  Source: docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md

- **Prefiks locale wyliczaj z locale, nigdy nie wpisuj `'/en'` na sztywno**: warunek `locale === 'pl' ? '' : '/en'` dziala poprawnie na `pl` i `en`, a na `ru` i `uk` cicho przelacza uzytkownikowi jezyk — wiec nie widac go w normalnym testowaniu. Uzywaj `localePathPrefix()` / `localizedMapBasePath()` z `map-url-builder.ts`. Test niech zawiera asercje NEGATYWNA: zadne locale poza `en` nie moze dostac sciezki z `/en`.
  Source: docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md

- **Jeden dev server na projekt; nigdy `npm run build` przy dzialajacym dev serverze**: produkcyjny build nadpisuje ten sam `.next`, z ktorego dev server czyta — wszystkie strony zaczynaja zwracac 500 z `ENOENT`, a przy kilku serverach worker Next.js pada z "Jest worker encountered child process exceptions" (komunikat NIE dotyczy testow). Kolejnosc: gate (`tsc`/`jest`/`lint`/`build`) przy zatrzymanym serverze, potem uruchom server do weryfikacji. Rosnace numery portow oznaczaja zywe stare procesy — sprawdzaj `Get-NetTCPConnection`, nie odpowiedz HTTP.
  Source: docs/solutions/build-errors/2026-08-23-jest-worker-exceptions-rywalizacja-o-next.md

- **Paczka bez buildu CJS i `next/dynamic` w tescie**: gdy paczka nie ma CJS (next-intl, use-intl, nuqs, use-supercluster), dopisz ja do `ESM_ONLY_PACKAGES` w `jest.config.js` — wyjatek trafia do `transformIgnorePatterns` juz wyliczonych przez `next/jest`, nie do `customJestConfig`. `next/dynamic` w Jescie musi byc zmapowany na `app-dynamic` (tak robi build App Routera); loader Pages Routera wiaze `ref` z `{ retry }`, wiec test uruchamia inna implementacje niz produkcja. Komponent z `dynamic()` renderuj w `await act(async () => ...)`.
  Source: docs/solutions/testing-issues/2026-09-27-montowanie-map-page-client-esm-only-i-next-dynamic.md

- **Wzorzec `npx jest` ze sciezka route group escapuj w calosci**: argumenty `npx jest` to regex, wiec `(header)` jest grupa dopasowujaca `header` bez nawiasow i nie trafia w zaden plik. Pisz `"src/app/\[locale\]/\(header\)/..."`. Przy kilku wzorcach w jednej komendzie pusty wzorzec znika bez bledu (kod 0), wiec porownuj liczbe `Test Suites:` z oczekiwana albo sprawdz `npx jest --listTests "<wzorzec>"`.
  Source: docs/solutions/testing-issues/2026-10-11-jest-wzorzec-sciezki-z-route-group.md

- **Po nieodwracalnym kroku kazde I/O ma jawny timeout**: kod po GETDEL/zapisie/platnosci musi skonczyc sie w `maxDuration`, inaczej Vercel ubija funkcje przed logiem porazki i dane znikaja bez sladu. Domyslne limity bibliotek zakladaja dlugo zyjacy serwer (nodemailer: 2 min / 30 s / 10 min) — ustaw `connectionTimeout`/`greetingTimeout`/`socketTimeout`. Wszystko, co moze zawiesc, przed nieodwracalnym krokiem; niezalezne kroki przez `Promise.all`.
  Source: docs/solutions/runtime-errors/2026-10-11-nieograniczony-czas-po-nieodwracalnym-kroku.md

- **`URL.canParse`: tylko na serwerze, testy z `@jest-environment node`**: jsdom 20 (domyslne srodowisko testow) i Safari < 17 nie maja `URL.canParse` — test pada `TypeError: URL.canParse is not a function`, a TypeScript milczy. W kodzie klienckim uzyj `new URL()` w `try` bez `instanceof` (jsdom rzuca z innego realmu).
  Source: docs/solutions/testing-issues/2026-10-11-url-canparse-brak-w-jsdom.md

- **Akcje „w locie” w tescie zawsze rozwiazuj przed koncem testu**: React 19 splata trwajace akcje async, wiec niezakonczona obietnica z mocka akcji blokuje commit przejsc we WSZYSTKICH kolejnych testach pliku („Unable to find …” w testach, ktore przechodza osobno). Trzymaj `resolve` i wolaj go na koncu testu z `await findBy…` na stan koncowy.
  Source: docs/solutions/testing-issues/2026-10-11-react-19-niezakonczona-akcja-blokuje-kolejne-testy.md
