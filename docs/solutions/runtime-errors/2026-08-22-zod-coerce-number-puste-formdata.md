---
title: "z.coerce.number() na pustym FormData zapisuje 0 zamiast null — cichy pin na (0,0)"
date: 2026-08-22
category: runtime-errors
severity: high
stack:
  - Zod
  - Next.js
  - Server Actions
  - Drizzle ORM
tags:
  - zod
  - formdata
  - coercion
  - walidacja
  - silent-bug
status: verified
last_verified: 2026-08-22
---

# z.coerce.number() na pustym FormData zapisuje 0 zamiast null

## Symptomy

Brak jakiegokolwiek błędu. Walidacja przechodzi, zapis się udaje, typy się zgadzają —
a w bazie ląduje wartość, której nikt nie wpisał.

Usługa dodana przez formularz bez podanych współrzędnych dostaje `latitude: 0, longitude: 0`,
czyli pin na Zatoce Gwinejskiej u zachodnich wybrzeży Afryki. Na mapie Polski nie widać nic,
więc problem nie ujawnia się w normalnym użyciu.

Wariant w drugą stronę, w formularzu edycji: `location?.latitude ?? 0` wstawia `0` do inputu,
a zapis utrwala fałszywy pin.

## Root Cause

`FormData.get()` zwraca **`null`** dla pola nieobecnego i **`''`** dla pola pustego.
`z.coerce.number()` woła `Number()`, a ten zamienia **oba** na `0`:

```javascript
Number(null)  // 0
Number('')    // 0
Number(undefined)  // NaN — jedyny przypadek, ktory Zod odrzuci
```

Więc `z.coerce.number().min(-90).max(90)` przepuszcza puste wejście jako `0`, bo `0` mieści się
w zakresie. Zod nie ma szansy zaprotestować — dostaje już liczbę.

Dodatkowo: `parseRawServiceData` rzutuje `formData.get('latitude') as string`, co **kłamie**
o typie (może być `null`) i wycisza ostrzeżenie kompilatora.

## Rozwiązanie

Normalizuj puste wejście do `null` **przed** coercją, przez `z.preprocess`:

```typescript
/**
 * FormData.get() zwraca null dla pola nieobecnego i '' dla pustego.
 * z.coerce.number() zamienia OBA na 0 — czyli wpis bez wspolrzednych dostalby
 * pin na (0, 0) i przeszedlby walidacje bez sladu.
 */
const emptyToNull = (value: unknown): unknown =>
    value === '' || value === null || value === undefined ? null : value;

const optionalCoordinate = (min: number, max: number) =>
    z.preprocess(emptyToNull, z.coerce.number().min(min).max(max).nullable());

export const serviceSchema = z.object({
    latitude: optionalCoordinate(-90, 90),
    longitude: optionalCoordinate(-180, 180),
});
```

`.nullable()` opakowuje coercję, więc dla wejścia `null` Zod zwraca `null` bez wołania
`Number()`. Wejście `'abc'` nadal jest odrzucane (`NaN`), a `'999'` łamie `max` — czyli
poprawne wartości i błędne dane są dalej weryfikowane.

Odpowiednik w drugą stronę, przy wypełnianiu formularza edycji:

```typescript
// ZLE — utrwala falszywy pin
latitude: location?.latitude ?? 0,

// DOBRZE
latitude: location?.latitude ?? null,
```

Wymagalność wyrażaj **warunkowo**, przez `.superRefine()`, nie przez wymuszanie liczby:

```typescript
.superRefine((data, ctx) => {
    if (data.coverage !== 'online') {
        if (data.latitude === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['latitude'],
                message: 'Latitude is required unless coverage is online',
            });
        }
    }
});
```

## Komendy diagnostyczne

```bash
# Czy w bazie sa juz zerowe wspolrzedne (skutek tego buga)
# SELECT COUNT(*) FROM service_locations WHERE latitude = 0 OR longitude = 0;

# Szukaj wzorca w calym repo
grep -rn "z.coerce.number" src/
grep -rn "?? 0" src/ | grep -iE "latitude|longitude|price|amount|count"
```

## Zapobieganie

- **`z.coerce.*` na granicy `FormData` zawsze wymaga `preprocess`**, jeśli pole może być puste.
  Dotyczy to `coerce.number`, `coerce.boolean` (`Boolean('')` = `false`, `Boolean('false')`
  = `true`!) i `coerce.date`.
- **`?? 0` na kolumnie liczbowej nullowalnej to czerwona flaga.** Zero jest legalną wartością
  współrzędnej, ceny i licznika, więc nie da się go odróżnić od „brak danych".
- **Nie rzutuj `formData.get(x) as string`.** Zwraca `FormDataEntryValue | null` — rzutowanie
  wycisza dokładnie to ostrzeżenie, które by ten bug wyłapało.
- Test, który to łapie, musi symulować **realne** zgłoszenie formularza: wszystkie pola jako
  `''`, nie pominięte. Wzorzec `z.string().optional().or(z.literal(''))` używany w tym repo
  dla pól opcjonalnych **nie przyjmuje `null`**, więc builder `FormData` pomijający pola daje
  fałszywy obraz.

## Powiązane

- `docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md`

## Kontekst

Odkryte w zadaniu `online-service-coverage` przy dopuszczaniu wpisów bez współrzędnych
(usługi świadczone zdalnie). Bug był **preegzystujący** — istniał przed tą zmianą, tylko nikt
nie dodawał usług bez współrzędnych, bo formularz wymagał ich twardo.

Zod 3, Next.js 15 Server Actions, `src/app/[locale]/(dashboard)/dashboard/_service-schema.ts`.

Naprawa objęta 15 scenariuszami testowymi, w tym osobnymi przypadkami dla pola pustego (`''`)
i pola nieobecnego (`null`).
