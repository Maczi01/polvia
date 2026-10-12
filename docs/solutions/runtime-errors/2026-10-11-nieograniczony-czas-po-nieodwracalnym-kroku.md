---
title: "Zgłoszenie znika bez śladu: SMTP bez limitu czasu po nieodwracalnym `consumeDraft`"
date: 2026-10-11
category: runtime-errors
severity: high
stack:
  - Next.js
  - Vercel
  - nodemailer
  - Redis
tags:
  - server-actions
  - maxDuration
  - timeouts
  - nodemailer
  - data-loss
  - serverless
status: verified
last_verified: 2026-10-11
---

# Zgłoszenie znika bez śladu: SMTP bez limitu czasu po nieodwracalnym `consumeDraft`

## Symptomy

Problem wykryło review fazy B zadania „Dodaj firmę z AI” (performance-oracle). Nie wystąpił na
produkcji. Scenariusz:

- `submitDraft` zużywa szkic przez `consumeDraft` (Redis GETDEL, jednorazowo), a potem wysyła
  mail do operatora przez Gmail SMTP.
- Gmail zawiesza połączenie. Vercel ubija funkcję po `maxDuration = 60` s.
- Szkicu już nie ma, mail nie wyszedł, a `logLostSubmission` nigdy się nie wykonał.
  Zgłoszenie znika bez śladu. Właściciel widzi ogólny błąd, a ponowna próba zjada kolejny
  limit generowania i wysyłki.

Komentarz w kodzie mówił „po `consumeDraft` maile nie rzucają”. To prawda, ale nie gwarantuje,
że maile **kończą się** w skończonym czasie.

## Root Cause

`nodemailer.createTransport` bez opcji czasu korzysta z domyślnych limitów: `connectionTimeout`
2 min, `greetingTimeout` 30 s, `socketTimeout` 10 min. Każdy z nich przekracza budżet funkcji
serverless. Logika „błąd → log” zadziała tylko wtedy, gdy błąd w ogóle nadejdzie przed
ubiciem procesu. Do tego kroki przed `consumeDraft` (geokodowanie ≤ 9,5 s, pobranie logo
≤ 8 s) szły sekwencyjnie i zjadały czas, który mógł zostać na maile.

## Rozwiązanie

1. Każda faza SMTP ma jawny limit. Zawieszony transport rzuca, a `sendMail` zwraca
   `SEND_FAILED`, który wołający loguje:

   ```ts
   // src/lib/mailer.ts
   export const SMTP_TIMEOUT_MS = 10_000;

   const transporter = nodemailer.createTransport({
       service: 'gmail',
       auth: { user: env.MY_GMAIL, pass: env.MY_GMAIL_PASSWORD },
       connectionTimeout: SMTP_TIMEOUT_MS,
       greetingTimeout: SMTP_TIMEOUT_MS,
       socketTimeout: SMTP_TIMEOUT_MS,
   });
   ```

2. Niezależne kroki przed nieodwracalnym idą równolegle. Oba są przed `consumeDraft`, więc
   ich porażka nie pali szkicu:

   ```ts
   // src/lib/add-business/submit-draft.ts
   const [geo, logo] = await Promise.all([
       resolveGeo(current.stored, edits, deps.geocode),
       resolveLogo(upload, candidate, deps),
   ]);
   const consumed = await consumeDraft(draftId); // dopiero teraz nieodwracalne
   ```

3. Rachunek budżetu jest zapisany w docstringu orkiestratora:
   - przed `consumeDraft`: ok. 9 s geokodowania (równolegle z logo) plus ok. 1 s Redis i sharp;
   - mail operatora kończy się najpóźniej po ok. 40 s, sukcesem albo `SEND_FAILED` z logiem;
   - teoretyczny sufit razem z potwierdzeniem to ok. 70 s, ale ubicie w trakcie potwierdzenia
     niczego już nie gubi.

4. Test woła prawdziwy `sendMail` i mockuje tylko `nodemailer` (zewnętrzna granica).
   Transport rzuca `ETIMEDOUT`, a test oczekuje `SEND_FAILED` i wpisu w logu
   (`submit-draft-resilience.test.ts`, `mailer.test.ts`).

## Komendy diagnostyczne

```bash
# Czy transport ma jawne limity czasu?
grep -n "Timeout" src/lib/mailer.ts

# Kolejność kroków wokół nieodwracalnego:
grep -n "consumeDraft\|Promise.all\|logLostSubmission" src/lib/add-business/submit-draft.ts
```

## Zapobieganie

- Każde I/O, które działa **po** nieodwracalnym kroku (GETDEL, zapis, płatność), musi mieć
  jawny limit czasu. Suma limitów musi się mieścić w `maxDuration` z zapasem na cold start.
- Wszystko, co może zawieść, umieszczaj **przed** nieodwracalnym krokiem. Niezależne kroki
  uruchamiaj przez `Promise.all`.
- Domyślne limity bibliotek (nodemailer, `fetch` bez `AbortSignal`, klienci SDK) zakładają
  długo żyjący serwer, a nie funkcję serverless. Sprawdzaj je jawnie.
- Ścieżka „porażka → log” musi mieć test z zawieszeniem lub timeoutem zależności, nie tylko
  z natychmiastowym błędem.

## Powiązane

- `docs/completed/dodaj-firme-z-ai/review-faza-B.md`: P2 #2
- `docs/completed/dodaj-firme-z-ai/dodaj-firme-z-ai-podsumowanie.md`

## Kontekst

Next.js 15 Server Actions na Vercelu (`maxDuration = 60` w `page.tsx`), nodemailer 7 z Gmail
SMTP, Redis 6.2+ (GETDEL). Poprawka w commicie `66413bc` na gałęzi `feature/dodaj-firme-z-ai`.
