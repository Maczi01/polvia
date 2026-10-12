---
title: "React 19: niezakończona akcja async w jednym teście blokuje przejścia w kolejnych"
date: 2026-10-11
category: testing-issues
severity: medium
stack:
  - React 19
  - Jest
  - Testing Library
tags:
  - useActionState
  - transitions
  - async-actions
  - test-isolation
  - flaky-tests
status: verified
last_verified: 2026-10-11
---

# React 19: niezakończona akcja async w jednym teście blokuje przejścia w kolejnych

## Symptomy

- Test stanu „w trakcie” (np. „w trakcie generowania ogłasza etap i blokuje przycisk”)
  mockuje akcję obietnicą, której nigdy nie rozwiązuje, i przechodzi.
- **Kolejne** testy w tym samym pliku padają, choć same są poprawne. UI zostaje na
  pierwszym kroku:

  ```
  ● <AddBusinessFlow /> › link social przechodzi do trybu recznego z wypelnionym linkiem
    Unable to find role="heading" and name "Dane firmy"
  ```

- W `add-business-flow.test.tsx` jedna niezakończona obietnica dała 8 nieudanych testów na 25.
  Każdy z nich przechodzi uruchomiony osobno (`it.only`).

## Root Cause

React 19 splata wszystkie trwające akcje async (transitions) w jedną partię. Aktualizacje z
akcji, w tym nowy stan `useActionState`, commitują dopiero wtedy, gdy zakończą się
**wszystkie** trwające akcje. Obietnica, której test nie rozwiązał, żyje dalej po `cleanup()`
między testami. Każda akcja z następnego testu czeka więc na nią w nieskończoność i
przejście stanu nigdy nie trafia do DOM.

## Rozwiązanie

Każdą obietnicę, którą test trzyma „w locie”, rozwiąż przed końcem testu i poczekaj na
wynikowe przejście:

```tsx
it('w trakcie generowania ogłasza etap i blokuje przycisk', async () => {
    // React 19 splata wszystkie trwajace akcje asynchroniczne: niezakonczona obietnica
    // zablokowalaby przejscia w kolejnych testach, wiec konczymy ja na koniec testu.
    let finish: (result: GenerateDraftResult) => void = () => {};
    generate.mockReturnValue(new Promise(resolve => (finish = resolve)));
    renderWithIntl(<AddBusinessFlow />);

    await submitLink();
    expect(await screen.findByText('Czytam stronę…')).toBeInTheDocument();

    finish({ status: 'limited', retryAfter: 60 });
    expect(
        await screen.findByRole('heading', { name: 'Osiągnięto dzienny limit' }),
    ).toBeInTheDocument();
});
```

Samo wywołanie `finish(...)` bez `await findBy…` też odblokowuje kolejne testy, ale
asercja na stan końcowy daje pewność, że akcja się zamknęła, zanim test się skończy.

## Komendy diagnostyczne

```bash
# Test przechodzi sam, a pada w pakiecie → podejrzenie przecieku stanu między testami
npx jest "add-business-flow.test" -t "link social"

# Szukaj obietnic, których test nie rozwiązuje:
grep -n "new Promise(" src/**/*.test.tsx
```

## Zapobieganie

- Mock akcji jako obietnica „w locie” zawsze idzie w parze z jej rozwiązaniem w tym samym
  teście.
- Kaskada nieudanych testów z „Unable to find …” po teście stanu pending to najpierw sygnał
  przecieku akcji, a dopiero potem błąd w komponencie.
- Nie lecz tego przez `jest.resetModules` ani osobne pliki. Przyczyną jest żywa obietnica,
  nie stan modułu.

## Powiązane

- `docs/solutions/testing-issues/2026-09-27-montowanie-map-page-client-esm-only-i-next-dynamic.md`
  (inne pułapki React/Next w Jest)

## Kontekst

React 19.0, `useActionState`, Jest 29 + Testing Library. Odkryte przy U9 zadania „Dodaj firmę
z AI”. Odtworzone 2026-10-11: po usunięciu `finish(...)` padło 8 z 25 testów
`add-business-flow.test.tsx`.
