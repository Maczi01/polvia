---
title: "Wzorzec ścieżki z route group w `npx jest` nie łapie żadnego pliku"
date: 2026-10-11
category: testing-issues
severity: medium
stack:
  - Jest
  - Next.js
tags:
  - jest-cli
  - testPathPattern
  - regex
  - route-groups
  - windows
  - weryfikacja
status: verified
last_verified: 2026-10-11
---

# Wzorzec ścieżki z route group w `npx jest` nie łapie żadnego pliku

## Symptomy

- Komenda weryfikacyjna z checklisty zadania nie uruchamia testów UI:

  ```bash
  npx jest "src/app/\[locale\]/(header)/add-business"
  ```

- Uruchomiona sama kończy się tak:

  ```
  Pattern: src\\app\\\[locale\]\\(header)\\contact - 0 matches
  No tests found, exiting with code 1
  ```

- W połączeniu z innym, pasującym wzorcem błędu **nie widać**. Jest uruchamia tylko pasujące
  suity i kończy się kodem 0:

  ```bash
  npx jest src/lib/add-business "src/app/\[locale\]/(header)/add-business"
  # Test Suites: 19 passed  ← tylko src/lib; 17 suit UI nie weszło
  ```

- W zadaniu „Dodaj firmę z AI” ta komenda stała w checklistach U9 i U10 oraz w planie
  technicznym. Review fazy B odkrył, że nie weryfikowała ani jednego testu UI.

## Root Cause

Argumenty pozycyjne `npx jest` to wyrażenia regularne (`testPathPattern`), a nie globy. W
regexie `(header)` to grupa przechwytująca, więc pasuje do tekstu `header` **bez** nawiasów.
Ścieżki w repo mają dosłowne nawiasy (`(header)`, `(main)`, `(dashboard)`), więc wzorzec nie
trafia w żaden plik. Escapowanie `\[locale\]` przy jednoczesnym pominięciu nawiasów
okrągłych daje wrażenie, że wzorzec jest poprawny.

Na Windows jest dodatkowo zamienia `/` na `\\`, co widać w komunikacie `Pattern:`. Nie ma to
jednak wpływu na wynik; problemem są wyłącznie nawiasy.

## Rozwiązanie

Escapuj nawiasy okrągłe tak samo jak kwadratowe:

```bash
npx jest "src/app/\[locale\]/\(header\)/add-business"   # 18 suit
npx jest "src/app/\[locale\]/\(header\)/contact"        # 1 suita
```

Krótsza alternatywa to fragment ścieżki bez nawiasów, o ile jest jednoznaczny:

```bash
npx jest "header..add-business"   # . dopasowuje ) oraz separator
```

## Komendy diagnostyczne

```bash
# Ile plików pasuje? Lista zamiast uruchamiania:
npx jest --listTests "src/app/\[locale\]/\(header\)/add-business" | wc -l

# Komunikat "Pattern: ... - 0 matches" przy pojedynczym wzorcu = zły regex
npx jest "<wzorzec>" 2>&1 | grep -E "Pattern|Test Suites|No tests"
```

## Zapobieganie

- W `Weryfikacja:` checklisty i w sekcji „Weryfikacja” planu (`/dev-plan`, `/dev-docs`)
  ścieżki z route group pisz z `\(` i `\)`.
- Weryfikując komendę z kilkoma wzorcami, sprawdź liczbę `Test Suites:` względem
  oczekiwanej, a nie sam kod wyjścia. Kod 0 oznacza tylko, że *któryś* wzorzec coś
  znalazł.
- Gdy wynik budzi wątpliwość, uruchamiaj każdy wzorzec osobno: pusty wzorzec da wtedy kod 1
  (`No tests found`).

## Powiązane

- `docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md`
  (inne pułapki konfiguracji Jest w tym repo)
- `docs/completed/dodaj-firme-z-ai/review-faza-B.md`: P3 #37 i bookkeeping checkboxów

## Kontekst

Jest 29 przez `next/jest` na Windows 11 (Git Bash). Odkryte 2026-10-11 przez agenta pokrycia
testami w review fazy B zadania „Dodaj firmę z AI”. Komendy poprawiono w `zadania.md` i w
planie `2026-10-11-001-feat-dodaj-firme-z-ai-plan.md`. Zachowanie (kod 1 dla samego
wzorca, kod 0 w połączeniu) zostało odtworzone ręcznie.
