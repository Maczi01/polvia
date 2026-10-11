---
title: "`URL.canParse` nie istnieje w jsdom (testy) ani w Safari < 17"
date: 2026-10-11
category: testing-issues
severity: medium
stack:
  - Jest
  - jsdom
  - TypeScript
tags:
  - jest-environment
  - jsdom
  - url
  - browser-compat
  - zod
status: verified
last_verified: 2026-10-11
---

# `URL.canParse` nie istnieje w jsdom (testy) ani w Safari < 17

## Symptomy

- Test modułu, który woła `URL.canParse` (schemat zod z walidacją linku, `domain-match`,
  `link-kind`, `html-extract`), pada w domyślnym środowisku Jest:

  ```
  TypeError: URL.canParse is not a function
  ```

- Ten sam kod działa w Node 22 i w produkcji (serwer). TypeScript niczego nie zgłasza, bo
  `lib.dom` deklaruje `URL.canParse`.
- Odtworzenie:

  ```ts
  it('canParse', () => expect(typeof URL.canParse).toBe('function'));
  // jsdom: Expected "function", Received "undefined"
  ```

## Root Cause

Domyślne środowisko testów w repo to `jest-environment-jsdom@29`, które ma jsdom 20.0.3.
Jego `URL` (whatwg-url) jest starszy niż `URL.canParse`. Zamiast globalnego `URL` z Node
test dostaje implementację z jsdom. Przeglądarki zyskały `URL.canParse` dopiero niedawno:
Safari ma je od wersji 17.

Druga pułapka: wyjątek z `new URL()` w jsdom pochodzi z innego realmu, więc
`error instanceof TypeError` bywa `false`.

## Rozwiązanie

**Kod serwerowy** (`src/lib/**` z `server-only`): `URL.canParse` jest w porządku, bo działa na
Node. Testy takich modułów uruchamiaj w środowisku node:

```ts
/**
 * @jest-environment node
 */
```

Tak mają `domain-match.test.ts`, `manual-input-schema.test.ts`, `owner-edits-schema.test.ts`
i pozostałe testy `src/lib/add-business/**`.

**Kod kliencki** (komponent `'use client'`): nie używaj `URL.canParse`. Użyj konstruktora w
`try`, bez `instanceof`:

```ts
// link-step.tsx
/**
 * `URL.canParse` nie istnieje w Safari < 17 ani w jsdom, wiec zostaje konstruktor.
 * Konstruktor z jednym napisem rzuca wylacznie `TypeError` „Invalid URL" (spec WHATWG).
 * `instanceof` nie wchodzi w gre: w jsdom wyjatek pochodzi z innego realmu.
 */
function parseUrl(value: string): URL | null {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}
```

## Komendy diagnostyczne

```bash
node -p "require('./node_modules/jsdom/package.json').version"   # 20.0.3
grep -rn "URL.canParse" src --include=*.ts --include=*.tsx
grep -rL "@jest-environment node" src --include=*.test.ts   # testy w jsdom — czy któryś importuje moduł z canParse?
```

## Zapobieganie

- Moduł z `URL.canParse` testuj z `@jest-environment node`. Gdy schemat z `canParse` trafia
  do testu komponentu w jsdom, przenieś walidację na serwer albo użyj konstruktora.
- W kodzie klienckim nie używaj `URL.canParse`, dopóki wspierane jest Safari < 17.
- Nie polegaj na `instanceof` dla błędów z API, które jsdom implementuje we własnym realmie.

## Powiązane

- `docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md`
  (inne braki jsdom: `ResizeObserver`)

## Kontekst

Node 22.12, Jest 29.7, `jest-environment-jsdom` 29.7 (jsdom 20.0.3). Odkryte przy testach
schematów zadania „Dodaj firmę z AI” (2026-10-11).
