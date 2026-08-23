---
title: "Jest worker encountered child process exceptions — rywalizacja o katalog .next"
date: 2026-08-23
category: build-errors
severity: medium
stack:
  - Next.js
  - Turbopack
tags:
  - dev-server
  - next-build
  - jest-worker
  - enoent
  - porty
status: verified
last_verified: 2026-08-23
---

# Jest worker encountered child process exceptions — rywalizacja o katalog .next

## Symptomy

W przeglądarce, na miejscu strony:

```
Server Error
Error: Jest worker encountered 2 child process exceptions, exceeding retry limit
```

**Komunikat jest mylący — to nie ma nic wspólnego z testami.** Next.js używa `jest-worker`
do własnych procesów renderujących; ten błąd oznacza, że worker dev servera padł i przestał
się wznawiać.

Wcześniejsza, łagodniejsza faza tego samego problemu: wszystkie strony zwracają **500**,
a w logu dev servera lecą `ENOENT` na plikach manifestu:

```
⨯ [Error: ENOENT: no such file or directory, open
  '...\.next\server\app\[locale]\(main)\map\[[...slug]]\page\app-build-manifest.json']
⨯ [Error: ENOENT: no such file or directory, open
  '...\.next\static\development\_buildManifest.js.tmp.dp297dbxir6']
```

Objaw dodatkowy, po którym łatwo poznać ten problem: **numery portów rosną**
(3000 → 3001 → 3002 → …) przy każdym uruchomieniu dev servera.

## Root Cause

Dwie niezależne przyczyny, obie prowadzące do uszkodzenia `.next`:

1. **`npm run build` uruchomiony przy działającym dev serverze.** Produkcyjny build nadpisuje
   ten sam katalog `.next`, z którego dev server właśnie czyta. Dev server traci pliki
   manifestu pod nogami i zwraca 500 na wszystko.
2. **Kilka dev serverów na jednym projekcie.** Każdy pisze do **tego samego** `.next`, bo
   katalog jest własnością projektu, nie procesu. Przy dwóch i więcej worker w końcu padnie.

Skąd bierze się kilka serverów: zatrzymanie zadania w tle **nie zawsze zabija potomny proces
`node`**. Proces przeżywa, trzyma port, dalej obserwuje pliki i dalej pisze do `.next`.
Kolejne uruchomienie widzi zajęty port, wybiera następny — i teraz są dwa. `curl`
odpowiadający na nowym porcie **nie dowodzi**, że stary proces umarł.

## Rozwiązanie

Zatrzymaj **wszystkie** procesy trzymające porty dev servera, wyczyść `.next`, uruchom
**jeden**.

```powershell
# 1. Kto naprawde trzyma porty (nie ufaj odpowiedzi HTTP)
foreach ($p in 3000..3005) {
    $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($c) {
        $procId = $c[0].OwningProcess
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        "port $p -> PID $procId $($proc.ProcessName) start: $($proc.StartTime)"
    } else { "port $p -> wolny" }
}

# 2. Zatrzymaj wszystkie znalezione
Stop-Process -Id <PID>,<PID>,... -Force
```

```bash
# 3. Wyczysc artefakty i uruchom JEDEN server
rm -rf .next node_modules/.cache
npm run dev
```

**Kolejność przy uruchamianiu quality gate:** najpierw `tsc` / `jest` / `lint` / `build`
przy **zatrzymanym** dev serverze, dopiero potem uruchom server do weryfikacji w przeglądarce.
Odwrotna kolejność gwarantuje uszkodzenie `.next`.

## Komendy diagnostyczne

```bash
# Czy problem dotyczy wszystkich stron (uszkodzony .next) czy jednej (blad w kodzie)
for u in / /mapa /blog; do
  curl -s -o /dev/null -w "$u -> %{http_code}\n" "http://localhost:3000$u"
done

# ENOENT w logu dev servera = pewny znak rywalizacji o .next
grep -c "ENOENT" <plik-logu-dev-servera>
```

## Zapobieganie

- **Jeden dev server na projekt.** Dwa zawsze będą się bić o `.next`.
- **Nigdy `npm run build` przy działającym dev serverze.** Jeśli musisz: zatrzymaj server,
  zbuduj, `rm -rf .next`, uruchom ponownie.
- **Rosnące numery portów to ostrzeżenie**, nie ciekawostka. Oznaczają, że poprzednie procesy
  żyją.
- **Sprawdzaj `Get-NetTCPConnection`, nie odpowiedź HTTP**, żeby stwierdzić czy proces umarł.
  Zatrzymanie zadania w tle nie zawsze zabija potomka.
- Przy dziwnych statusach HTTP (500 wszędzie, nieaktualne zachowanie mimo zmiany kodu):
  **najpierw** wyklucz uszkodzony `.next`, potem szukaj błędu w kodzie. Pomiar na uszkodzonym
  serverze prowadzi do fałszywych wniosków — u nas pokazał nieaktualny status przekierowania
  i kazał podejrzewać kod, który był poprawny.

## Powiązane

- `docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md` —
  tam ten sam problem dał fałszywy odczyt statusów HTTP w trakcie diagnozy

## Kontekst

Next.js 15.1.11 z Turbopackiem, Windows 11, dev server uruchamiany jako zadanie w tle.
Nazbierało się pięć procesów na portach 3000–3004, wszystkie wskazujące ten sam katalog
projektu; dwa razy dodatkowo nadpisany `.next` produkcyjnym buildem.

Ten sam błąd wystąpił w jednej sesji dwukrotnie — pierwszy raz jako 500 z `ENOENT`
(zdiagnozowane), drugi raz jako padnięty worker (dopiero to wymusiło porządne czyszczenie).
