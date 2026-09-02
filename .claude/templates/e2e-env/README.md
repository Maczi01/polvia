# Środowisko E2E dla dev-autopilot (one-time setup Operatora)

Po tym setupie autopilot **autonomicznie wykonuje scenariusze E2E w przeglądarce**: stawia dev server Next na dedykowanej bazie e2e, synchronizuje schema + seed per faza, a fail asercji wchodzi w pętlę fix jako finding P2 typu E2E.

**Bramka opt-in:**

- **Brak `.env.e2e`** → projekt nie chce E2E → scenariusze klasyfikowane jako OPERATOR, run leci dalej.
- **`.env.e2e` istnieje, ale środowisko niegotowe** (baza nie wstała, brak klucza wymaganego przez `env.ts`) → autopilot **TWARDO zatrzymuje run w bootstrapie** z gotową komendą naprawczą. Powód: gdy projekt opt-inował się w E2E, ciche pominięcie = E2E znika z runu bez śladu. Świadomy run bez E2E: usuń albo zmień nazwę `.env.e2e`.

## Architektura

```
Bootstrap:  env-up     — .env.e2e? gitignore? guard tożsamości DATABASE_URL (≠ dev),
                         Postgres (docker-compose) + dev server na :3000 (detached, env z .env.e2e).
                         .env.e2e jest, a env niegotowe = HARD STOP; brak .env.e2e = pominięto, run leci dalej.
Per faza:   db-sync    — npx drizzle-kit push na bazę e2e (PIERWSZY realny apply schematu)
                         + npm run db:seed + dosianie rekordów wymaganych przez scenariusze fazy.
Review:     tester     — feature-tester-web-e2e wykonuje checkboxy `Weryfikacja:` przez chrome-devtools MCP.
Zakończenie: env-down  — zabija TYLKO proces dev servera uruchomiony przez pipeline (/tmp/autopilot-dev.pid).
                         Kontener Postgresa zostaje (tani w utrzymaniu, przydatny do debugowania).
```

## Setup (raz)

1. **Skopiuj szablon:**

   ```bash
   cp .claude/templates/e2e-env/.env.e2e.example .env.e2e
   ```

2. **Dopisz `.env.e2e` do `.gitignore`** — plik zawiera połączenie do bazy. Autopilot sprawdza to twardo (`git check-ignore`) i odmawia startu, jeśli plik nie jest ignorowany.

3. **Utwórz dedykowaną bazę e2e.** Najprościej druga baza w tym samym kontenerze:

   ```bash
   docker-compose up -d
   docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -c "CREATE DATABASE polvia_e2e;"
   docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d polvia_e2e -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

   `DATABASE_URL` w `.env.e2e` **musi** różnić się od tego w `.env` — autopilot porównuje te wartości i odmawia startu, jeśli są identyczne (ochrona bazy dev).

4. **Uzupełnij pozostałe klucze wymagane przez `env.ts`.** `@t3-oss/env-nextjs` waliduje **wszystkie** zmienne Zodem przy starcie — brak choćby jednej wywali dev server. Klucze do integracji zewnętrznych (OpenAI, ConvertKit, Gmail, Clarity) mogą być atrapami, jeśli scenariusze E2E ich nie dotykają.

5. **Sprawdź, że wstaje:**

   ```bash
   set -a; source .env.e2e; set +a
   npx drizzle-kit push
   npm run db:seed
   npm run dev          # → http://localhost:3000 powinno zwrócić 200/307
   ```

## Uwagi

- **Port 3000 jest współdzielony** z normalnym dev serverem. Jeśli masz uruchomiony dev server na bazie dev, autopilot uzna go za „zastany" i będzie testował **na bazie dev**. Przed runem E2E zabij swój dev server albo świadomie zaakceptuj ten tryb (autopilot ostrzega w `detal`).
- **Pierwszy build Next trwa** — env-up polluje `curl` do ~120 s, co przy zimnym `.next` bywa graniczne. Jeśli timeout wywali run, odpal raz `npm run dev` ręcznie, żeby zbudować cache, i wznów.
- **Seed musi być idempotentny** — autopilot aplikuje go per faza. Nieidempotentny seed przy drugiej fazie sypie błędami duplikatów (odnotowywanymi, nie failującymi run, ale zaśmiecającymi raport).
- **Nigdy nie kieruj E2E na bazę produkcyjną.** Guard tożsamości sprawdza tylko różnicę względem `.env`/`.env.local` — nie wie, co jest produkcją.
