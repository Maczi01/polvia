---
title: "Test MapPageClient nie montuje się — paczki bez buildu CJS i next/dynamic z Pages Routera"
date: 2026-09-27
category: testing-issues
severity: medium
stack:
  - Jest
  - Testing Library
  - Next.js
  - next-intl
  - nuqs
tags:
  - jest-config
  - esm
  - transformIgnorePatterns
  - moduleNameMapper
  - next-dynamic
  - react-lazy
  - app-router
status: verified
last_verified: 2026-09-27
---

# Test MapPageClient nie montuje się — paczki bez buildu CJS i next/dynamic z Pages Routera

## Symptomy

Kolejne błędy przy montowaniu `MapPageClient` z prawdziwymi dziećmi (`FilterComponent`, `ServicesClientComponent`):

1. `SyntaxError: Unexpected token 'export'` w `node_modules/next-intl/dist/esm/...`,
   potem to samo dla `use-supercluster` (`Cannot use import statement outside a module`).
2. `This package is ESM only. See https://err.47ng.com/NUQS-101` — z `nuqs`.
3. `invariant expected app router to be mounted` — z `useRouter()` z `@/i18n/navigation`.
4. `TypeError: mapRef.current?.getMap is not a function` w `overview-map.tsx`, **mimo** mocka
   `react-map-gl/mapbox` z `getMap` w `useImperativeHandle`. Mock factory się wykonywał,
   ale komponent mapy nie renderował się ani razu.
5. Po naprawie 4: `A suspended resource finished loading inside a test, but the event was not wrapped in act(...)`.

## Root Cause

1–2. `next-intl` 4, `use-intl`, `nuqs` 2 i `use-supercluster` **nie mają żadnego buildu CJS**
(next-intl ma w `dist/cjs` tylko `plugin.cjs`). Wzorzec „`moduleNameMapper` na build CJS"
z `2026-08-22-testy-komponentow-esm-i-resizeobserver.md` nie ma tu na co wskazać. `nuqs`
dodatkowo pod warunkiem `require` w `exports` wskazuje zaślepkę `esm-only.cjs`, która rzuca.

4. W Jeście `next/dynamic` to `next/dist/shared/lib/dynamic` — loader **Pages Routera**, który
robi `useImperativeHandle(ref, () => ({ retry }))`. Ref przekazany do `dynamic()`-komponentu
dostaje więc `{ retry }`, zanim moduł się załaduje. W buildzie App Routera Next aliasuje
`next/dynamic` na `next/dist/api/app-dynamic` (`createAppRouterApiAliases` w
`next/dist/build/create-compiler-aliases.js`) — tam jest `React.lazy` i ref do czasu
załadowania jest `null`. Test uruchamiał więc inną implementację niż produkcja.

## Rozwiązanie

`jest.config.js` — wyjątki dopisane do `transformIgnorePatterns` **już wyliczonych** przez
`next/jest` (nadpisuje on tylko to, co jest w `customJestConfig`), plus dwa mapowania:

```js
const customJestConfig = {
    moduleNameMapper: {
        // ...
        '^next/dynamic$': '<rootDir>/node_modules/next/dist/shared/lib/app-dynamic.js',
        '^nuqs$': '<rootDir>/node_modules/nuqs/dist/index.js',
        '^nuqs/adapters/testing$': '<rootDir>/node_modules/nuqs/dist/adapters/testing.js',
    },
};

const ESM_ONLY_PACKAGES = ['next-intl', 'use-intl', 'nuqs', 'use-supercluster'];

module.exports = async function jestConfig() {
    const config = await createJestConfig(customJestConfig)();
    const esmOnly = ESM_ONLY_PACKAGES.join('|');
    return {
        ...config,
        transformIgnorePatterns: config.transformIgnorePatterns.map(pattern =>
            pattern.replace('(?!(geist)', `(?!(geist|${esmOnly})`),
        ),
    };
};
```

W teście — prawdziwe providery zamiast mocków bibliotek, render w async `act` (React.lazy):

```tsx
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { NextIntlClientProvider } from 'next-intl';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import messages from '../../../../../messages/pl.json';

await act(async () => {
    render(
        <AppRouterContext.Provider value={ROUTER_STUB}>
            <NextIntlClientProvider locale="pl" messages={messages}>
                <NuqsTestingAdapter>
                    <MapPageClient services={SERVICES} initialFilters={initialFilters} />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        </AppRouterContext.Provider>,
    );
});
```

Mock tylko `react-map-gl/mapbox` (WebGL): `forwardRef` z `useImperativeHandle` zwracającym
`getMap: () => null` — wszystkie gałęzie `if (mapRef.current?.getMap())` się pomijają.
`mapbox-gl` nie wymaga mocka — kod importuje z niego tylko typy i CSS.

Drobne: nazwa dostępna `ButtonCategory` to `"icon <tekst>"` (alt ikony + tekst), więc
`getByRole('button', { name: /Usuń filtry$/ })` — kotwica odcina „Usuń filtry kategorii" z modala.
Modal filtrów woła `window.scrollTo` → `jest.spyOn(window, 'scrollTo')`, jak w `mobile-filter-modal.test.tsx`.

## Komendy diagnostyczne

```bash
# Czy paczka ma w ogole build CJS?
node -e "const j=require('./node_modules/nuqs/package.json');console.log(j.type, j.main, JSON.stringify(j.exports['.']))"
ls node_modules/next-intl/dist/cjs/*

# Co next/jest faktycznie wylicza jako transformIgnorePatterns
node -e "require('next/jest')({dir:'./'})({})().then(c=>console.log(c.transformIgnorePatterns))"

# Na co next/dynamic wskazuje w Jescie vs w buildzie App Routera
cat node_modules/next/dynamic.js
grep -n "app-dynamic" node_modules/next/dist/build/create-compiler-aliases.js
```

Gdy mock się „nie stosuje" (factory odpalony, komponent nie renderuje): tymczasowy
`console.log` w factory i w renderze mocka rozróżnia „mock nie załadowany" od „mock nie wyrenderowany".

## Zapobieganie

- Zanim wybierzesz `moduleNameMapper`, sprawdź `exports`/`dist` paczki — brak CJS = wyjątek
  w `transformIgnorePatterns` doklejony po `createJestConfig(...)()`, nie w `customJestConfig`.
- Komponent używający `next/dynamic` z `ref` testuj na `app-dynamic` (mapowanie jest już
  globalne w `jest.config.js`) i renderuj w `await act(async () => ...)`.
- Test okablowania weryfikuj mutacją: tu `FilterComponent` z serwerowym `initialFilters`
  zamiast `currentFilters` → test czerwony na asercji paska filtrów, lista przechodzi.
  Asercja tylko na liście przepuściłaby dokładnie ten błąd.

## Powiązane

- `docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md` —
  wzorzec `moduleNameMapper` na build CJS (lucide-react, supercluster); ten dokument go
  uzupełnia dla paczek, które CJS nie mają wcale.
- Test: `src/app/[locale]/(main)/_components/map-page-client.test.tsx`
- Poprawka testowana: commit `00e1486` (fix(mapa): przycisk Wstecz przywraca filtry, nie tylko adres)

## Kontekst

Next.js 15.1, next-intl 4.0.2, nuqs 2.4.1, use-supercluster (tylko `*.esm.js`), Jest 29 +
`next/jest` (SWC). Branch `test/map-back-button-wiring`, commit `03decb9`. Pełny suite po
zmianie `jest.config.js`: 41/41 zestawów, 501 testów zielonych.
