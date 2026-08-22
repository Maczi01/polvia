# Learned Patterns

Reguly wyciagniete z rozwiazanych problemow w `docs/solutions/`. Zarzadzane przez `/dev-compound` i `/dev-compound-refresh`.

<!-- rule-count: 6 -->

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
