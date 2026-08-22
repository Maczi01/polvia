# Learned Patterns

Reguly wyciagniete z rozwiazanych problemow w `docs/solutions/`. Zarzadzane przez `/dev-compound` i `/dev-compound-refresh`.

<!-- rule-count: 3 -->

- **Zmiany schematu aplikuj przez `npx drizzle-kit push`, nie `generate`**: katalog `drizzle/` w tym repo jest martwy (snapshoty znaja 2 z 4 enumow i nie znaja tabeli `service_locations`), wiec `generate` produkuje migracje tworzaca od zera obiekty juz istniejace w bazie. Jesli `generate` zapyta o `rename`, ZATRZYMAJ SIE — wybor `~ county > coverage rename enum` jest destrukcyjny. Skrypt `npm run drizzle:generate` wola przedawniony `generate:pg` i nic nie robi.
  Source: docs/solutions/database-issues/2026-08-22-drizzle-generate-nieuzywalny-snapshoty.md

- **`z.coerce.*` na granicy `FormData` zawsze przez `z.preprocess`**: `FormData.get()` zwraca `null` dla pola nieobecnego i `''` dla pustego, a `Number()` zamienia oba na `0` — walidacja przechodzi i cicho zapisuje zero jako prawdziwa wartosc. Normalizuj puste wejscie do `null` przed coercja, a wymagalnosc wyrazaj przez `.superRefine()`. `?? 0` na nullowalnej kolumnie liczbowej to ten sam bug w druga strone. Nie rzutuj `formData.get(x) as string` — to wycisza jedyne ostrzezenie, ktore by to wylapalo.
  Source: docs/solutions/runtime-errors/2026-08-22-zod-coerce-number-puste-formdata.md

- **Zaleznosc ESM w tescie: `moduleNameMapper` na build CJS, nie `transformIgnorePatterns`**: `next/jest` nadpisuje `transformIgnorePatterns` z `jest.config.js`, wiec dopracowywanie regexa jest strata czasu. Gdy `render()` failuje pustym `AggregateError`, opakuj go w `try/catch` i wypisz `error.errors[0].message` — React ukrywa przyczyne (u nas: brak `ResizeObserver` w jsdom, wymaganego przez `virtua`).
  Source: docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md
