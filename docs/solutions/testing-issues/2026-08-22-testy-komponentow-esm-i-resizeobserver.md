---
title: "Testy komponentów nie startują — lucide-react ESM i brak ResizeObserver w jsdom"
date: 2026-08-22
category: testing-issues
severity: high
stack:
  - Jest
  - Testing Library
  - Next.js
  - jsdom
tags:
  - jest-config
  - esm
  - jsdom
  - lucide-react
  - virtua
  - transformIgnorePatterns
status: verified
last_verified: 2026-08-22
---

# Testy komponentów nie startują — lucide-react ESM i brak ResizeObserver w jsdom

## Symptomy

Próba napisania pierwszego testu dla komponentu w `src/app/**` kończy się jednym z dwóch błędów,
zanim wykona się jakakolwiek asercja.

**1. Import ESM:**

```
node_modules/lucide-react/dist/esm/lucide-react.js:8
import * as index from './icons/index.js';
^^^^^^
SyntaxError: Cannot use import statement outside a module
```

**2. Brakujące API przeglądarki** (po naprawieniu pierwszego):

```
TypeError: y(...).ResizeObserver is not a constructor
    at Object.V (node_modules/virtua/src/src/core/resizer.ts:20:15)
    at resizer (node_modules/virtua/src/src/react/ListItem.tsx:42:37)
```

Drugi błąd React zawija w `AggregateError` bez treści, więc `render()` failuje bez wskazania
przyczyny. Testy nierenderujące żadnego elementu listy przechodzą, co maskuje problem.

## Root Cause

Dwie niezależne luki środowiska testowego, obie ujawnione dopiero przy pierwszym teście
komponentu bogatszego niż `Badge`:

1. **`lucide-react` publikuje ESM dla warunku `browser`**, który wybiera `jest-environment-jsdom`
   (`exports["."]`: `browser` i `import` → `dist/esm`, `require`/`node` → `dist/cjs`).
   Domyślne `transformIgnorePatterns` z `next/jest` wykluczają cały `node_modules`
   z transformacji, więc plik ESM trafia do Node'a bez przepisania.
2. **jsdom nie implementuje `ResizeObserver`**, a `virtua` konstruuje go przy renderze
   **każdego** elementu wirtualizowanej listy.

**Pułapka przy pierwszym problemie:** ustawienie `transformIgnorePatterns` w `customJestConfig`
**nie działa** — `next/jest` nadpisuje ten klucz własną wartością. Godzina zmarnowana na
próbach dopracowania regexa.

## Rozwiązanie

`jest.config.js` — skieruj Jesta na build CJS biblioteki przez `moduleNameMapper` zamiast
walczyć z transformacją:

```javascript
const customJestConfig = {
    testEnvironment: 'jest-environment-jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/setupAfterEnv.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // lucide-react wskazuje ESM dla warunku `browser`, ktory wybiera jsdom,
        // a next/jest wyklucza node_modules z transformacji (i nadpisuje
        // transformIgnorePatterns z tego pliku). Kierujemy Jesta na build CJS
        // samej biblioteki — ikony renderuja sie normalnie, bez stubowania.
        '^lucide-react$': '<rootDir>/node_modules/lucide-react/dist/cjs/lucide-react.js',
    },
};
```

`setupAfterEnv.ts` — dodaj stub `ResizeObserver`, aktywny tylko gdy brak globalnego:

```typescript
if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub implements ResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }

    globalThis.ResizeObserver = ResizeObserverStub;
}
```

Żadna z tych zmian nie stubuje testowanego kodu — pierwsza używa własnego buildu CJS biblioteki
(ikony renderują się normalnie), druga uzupełnia brakujące API przeglądarki.

## Komendy diagnostyczne

```bash
# Ktory build wskazuje biblioteka dla ktorego warunku
node -e "console.log(JSON.stringify(require('./node_modules/lucide-react/package.json').exports, null, 2))"

# Czy istnieje build CJS
ls node_modules/lucide-react/dist/

# AggregateError bez tresci — wyciagnij prawdziwy blad
# (tymczasowy test opakowujacy render w try/catch)
# catch (error) { console.log(error?.errors?.[0]?.message) }
```

## Zapobieganie

- Przy dodawaniu zależności renderującej ikony lub komponenty: sprawdź `exports` w jej
  `package.json`. Warunek `browser` wskazujący na ESM oznacza kolizję z `next/jest`.
- Nie próbuj naprawiać tego przez `transformIgnorePatterns` — `next/jest` nadpisuje ten klucz.
  `moduleNameMapper` na build CJS jest jedyną działającą drogą bez rezygnacji z `next/jest`.
- Gdy `render()` failuje z pustym `AggregateError`: opakuj render w `try/catch` i wypisz
  `error.errors[0].message`. React ukrywa przyczynę.
- Przy testach komponentów używających `virtua`: pamiętaj, że `useMediaQuery` startuje od
  `false` i przełącza się w efekcie, więc **pierwszy render idzie ścieżką desktopową**.
  W jsdom kontener ma zerową wysokość, więc zbiór zamontowanych elementów jest
  niedeterministyczny — nie asercjonuj długości tablicy refów, celuj w DOM.

## Powiązane

- `docs/solutions/database-issues/2026-08-22-drizzle-generate-nieuzywalny-snapshoty.md` —
  druga luka narzędziowa odkryta w tej samej sesji

## Kontekst

Odkryte przy pisaniu pierwszego testu `MapList` w zadaniu `online-service-coverage`.
Repo miało wtedy **dwa** pliki testowe (`badge.test.tsx`, `button.test.tsx`), z których żaden
nie importował ikon ani listy wirtualizowanej — dlatego luki przetrwały niezauważone.

Wersje: `next` 15.1.11, `jest` 29, `lucide-react` (build ESM + CJS w `dist/`), `virtua`,
`jest-environment-jsdom`.

Po naprawie: 197 testów w 11 suitach, w tym testy `MapList`, `ServiceCard` i `overview-map`.
