export const meta = {
  name: 'dev-autopilot-wf',
  description: 'Autonomiczny pipeline: bootstrap (stan z .autopilot-state.json) -> per faza (execute -> review+verify -> fix, bez re-review) -> compound -> complete. Orkiestrator trzyma stan w JSON i liczy gate\'y w JS; buildery i reviewerzy to leaf-agenci.',
  whenToUse: 'Wykonanie calego planu zadania z docs/active/. Git zwaliduj w sesji PRZED odpaleniem (workflow nie pyta o branch switch). RESUME po przerwanym runie: uzyj Workflow({scriptPath, resumeFromRunId}) i ZAWSZE przekaz args ponownie (te sama sciezke zadania) — args NIE przezywa miedzy wywolaniami. Stan wznowienia czyta z docs/active/<zadanie>/.autopilot-state.json (zrodlo prawdy), checkboxy md sa tylko widokiem dla czlowieka.',
  phases: [
    { title: 'Bootstrap', detail: 'stan z .autopilot-state.json (lub pierwszy parse md) + rozgrzewka cache testow + srodowisko E2E (gdy .env.e2e istnieje: TWARDY STOP runu dopoki E2E nie gotowe — dev server na :3000 + baza e2e)' },
    { title: 'Zakonczenie', detail: 'walidacja koncowa -> compound -> complete (compound pierwszy: sciezki w docs/active/ jeszcze zyja)' },
  ],
}

// ── Architektura (audyt 2026-06-09) ──────────────────────────────────────
// Filar 1: BLOK_DLUGIE_KOMENDY — prawa srodowiska (watchdog ~180s, Bash max 600s) doklejane do
//          KAZDEGO prompta mogacego uruchamiac testy. Kopia tej stalej zyje tez w execute-wf
//          i review-wf (workflowy sa self-contained — przy zmianie synchronizuj recznie).
// Filar 2: stan maszynowy w docs/active/<zadanie>/.autopilot-state.json — resume czyta JSON,
//          nie liczy checkboxow. Orkiestrator liczy kolejke i przejscia w JS.
// Filar 3: trust-but-verify — gate'y liczone w JS z review.findings[], null-guardy po kazdym
//          await, warmup wymaga dowodu (kontrolny warm-run w sekundach).
// Re-review po fixie USUNIETY (decyzja usera, dane wf_3c9d3864): gate z self-reportu fixa.
// Mitygacja test-weakeningu: zakaz modyfikacji asercji w fixPrompt + git diff testow w walidacji.

const BLOK_DLUGIE_KOMENDY = `
=== DLUGIE KOMENDY (przeczytaj ZANIM uruchomisz testy/buildy — prawa srodowiska, nie sugestie) ===
(1) Runtime zabija subagenta po ~180s bez zadnego outputu ("agent stalled"); po 6 killach pada CALY run.
(2) Pojedyncze foreground Bash ma limit 600s (domyslnie 120s) — dluzszej komendy NIE dokonczysz.
(3) Pierwszy pelny `npx jest` po zmianie zaleznosci/configu buduje cache next/jest + SWC i moze
    milczec wiele minut — cisza to faza transform PRZED pierwszym outputem reportera; zaden reporter nie pomaga.
REGULY:
- Komenda mogaca trwac >100s (pelny `npx jest`, `npm run build`, `npm run build-storybook`): uruchom przez
  Bash z run_in_background i przekierowaniem do pliku logu, potem POLLUJ krotkim Bash co ~45-60s
  (tail loga / sprawdzenie procesu) az do zakonczenia. Kazda sonda = znak zycia dla watchdoga.
- NIGDY nie podnos timeoutu foreground zamiast isc w tlo — 180s ciszy zabija CIEBIE, nie komende.
- Po zmianie package.json / lockfile / jest.config.js przez kogokolwiek w tym runie: pierwszy `npx jest`
  traktuj jako ZIMNY (pelna procedura tla powyzej).
- `npx jest` strumieniuje wynik per plik testowy: stdout W TRAKCIE foreground Bash resetuje watchdog,
  wiec chroni WARM suite'y w oknie 180-600s.
  NIE chroni: zimnego cache (transform milczy do konca) ani komend >600s (twardy limit Bash).
- FLAKE INFRA: gdy pelny suite zglosi na pliku blad infrastruktury workera (jest worker terminated,
  "Call retries were exceeded", ENOMEM, heap out of memory) — re-runuj TEN plik
  w izolacji (procedura OSOBNO dla kazdego takiego pliku). PASS w izolacji = flake infra, NIE defekt:
  odnotuj "flake-infra: <plik> (PASS w izolacji)" i NIE traktuj jako FAIL. FAIL w izolacji = realny defekt.
  Po obsludze flake'ow DOKONCZ przerwany lancuch walidacji (kolejne kroki, np. npm run build).
=== KONIEC BLOKU DLUGICH KOMEND ===`

// ── Schematy ──────────────────────────────────────────────────────────────

const FINDING_OTWARTY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    severity: { type: 'string', enum: ['P1', 'P2'] },
    typ: { type: 'string', enum: ['KOD', 'TEST', 'E2E'] },
    plik: { type: 'string' },
    opis: { type: 'string' },
  },
  required: ['severity', 'typ', 'plik', 'opis'],
}

const PLAN_STATE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nazwaZadania: { type: 'string', description: 'ostatni segment sciezki zadania' },
    branch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        aktualny: { type: 'string' },
        wymagany: { type: ['string', 'null'] },
        zgodny: { type: 'boolean' },
        czysty: { type: 'boolean', description: 'brak niezacommitowanych zmian' },
      },
      required: ['aktualny', 'wymagany', 'zgodny', 'czysty'],
    },
    zrodloStanu: { type: 'string', enum: ['state-json', 'pierwszy-parse-md'] },
    fazy: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          numer: { type: 'integer' },
          nazwa: { type: 'string' },
          execute: { type: 'string', enum: ['done', 'pending'] },
          review: { type: 'string', enum: ['done', 'pending'] },
          fix: { type: 'string', enum: ['done', 'pending', 'none'], description: 'none = review nie zostawil otwartych P1/P2' },
          otwarteFindingi: { type: 'array', items: FINDING_OTWARTY },
        },
        required: ['numer', 'nazwa', 'execute', 'review', 'fix', 'otwarteFindingi'],
      },
    },
    zakonczenie: {
      type: 'object',
      additionalProperties: false,
      properties: {
        walidacja: { type: 'string', enum: ['done', 'pending'] },
        complete: { type: 'string', enum: ['done', 'pending'] },
        compound: { type: 'string', enum: ['done', 'pending'] },
      },
      required: ['walidacja', 'complete', 'compound'],
    },
    rozbieznosci: { type: 'array', items: { type: 'string' }, description: 'informacyjne: stan vs pliki md (np. review-faza-N.md istnieje a stan mowi pending)' },
  },
  required: ['nazwaZadania', 'branch', 'zrodloStanu', 'fazy', 'zakonczenie', 'rozbieznosci'],
}

const ZAPIS_STANU = {
  type: 'object',
  additionalProperties: false,
  properties: { zapisano: { type: 'boolean' } },
  required: ['zapisano'],
}

const WARMUP_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['zbudowano', 'zbedne', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co odpalono + czasy, lub powod pominiecia/niepowodzenia' },
    czasZimnySek: { type: ['integer', 'null'], description: 'czas pierwszego (zimnego) biegu w sekundach' },
    czasKontrolnySek: { type: ['integer', 'null'], description: 'czas kontrolnego warm-runu w sekundach — DOWOD zbudowania cache' },
  },
  required: ['status', 'detal'],
}

const E2E_ENV_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['gotowe', 'pominieto', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co postawiono / powod pominiecia lub niepowodzenia (BEZ wartosci sekretow)' },
    devServer: { type: 'string', enum: ['uruchomiony', 'zastany', 'brak'] },
    baza: { type: 'string', enum: ['gotowa', 'brak'] },
  },
  required: ['status', 'detal', 'devServer', 'baza'],
}

const E2E_DB_SYNC_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['zsynchronizowano', 'aktualna', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co zaaplikowano (migracje/seedy/konto) lub tresc bledu — blad SQL migracji to potencjalny DEFEKT KODU' },
  },
  required: ['status', 'detal'],
}

const E2E_DOWN_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    posprzatano: { type: 'boolean' },
    detal: { type: 'string' },
  },
  required: ['posprzatano', 'detal'],
}

const FIX_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    naprawione: { type: 'integer' },
    pozostaje: { type: 'integer' },
    typy: {
      type: 'object',
      additionalProperties: false,
      properties: { kod: { type: 'integer' }, test: { type: 'integer' }, e2e: { type: 'integer' } },
      required: ['kod', 'test', 'e2e'],
    },
    e2eReweryfikacja: { type: 'string', description: 'X/Y passed lub "n/a"' },
    walidacja: { type: 'string', enum: ['PASS', 'FAIL'] },
    commity: { type: 'array', items: { type: 'string' } },
    nienaprawione: { type: 'array', items: { type: 'string' } },
    nierozwiazaneP1: { type: 'integer', description: 'P1 ktorych fix NIE zamknal (krytyczne -> STOP)' },
    nierozwiazaneP2: { type: 'integer', description: 'P2 przeniesione do known-issues (graceful)' },
  },
  required: ['naprawione', 'pozostaje', 'walidacja', 'nierozwiazaneP1', 'nierozwiazaneP2'],
}

const VALIDATION_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wykryteKomendy: { type: 'array', items: { type: 'string' } },
    typecheck: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    lint: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    testy: { type: 'string', description: 'PASS/FAIL z liczbami X/Y (+ adnotacje flake-infra)' },
    build: { type: 'string', enum: ['PASS', 'FAIL', 'n/a'] },
    testyZmodyfikowane: { type: 'array', items: { type: 'string' }, description: 'pliki *.test.* ze ZMIENIONYMI istniejacymi asercjami w commitach fix(...) — sygnal test-weakeningu' },
    wynik: { type: 'string', enum: ['PASS', 'FAIL'] },
    bledy: { type: 'array', items: { type: 'string' } },
  },
  required: ['wynik'],
}

// ── Prompty leaf-agentow ──────────────────────────────────────────────────

function bootstrapPrompt(sciezka) {
  return `Jestes bootstrapem pipeline'u dev-autopilot. Zbuduj jawny stan orkiestratora.

Folder zadania: ${sciezka}

1. GIT: uruchom \`git branch --show-current\` i \`git status --short\`.
   Przeczytaj wymagany branch z dokumentacji w ${sciezka}/ (szukaj "Branch:").
   Ustaw branch.zgodny (aktualny == wymagany lub wymagany == null) oraz branch.czysty (pusty status).

2. STAN — najpierw sprawdz czy istnieje ${sciezka}/.autopilot-state.json:

   A) PLIK ISTNIEJE (resume): przeczytaj go i zwroc jego fazy/zakonczenie BEZ reinterpretacji
      checkboxow md — plik stanu jest ZRODLEM PRAWDY, checkboxy to tylko widok dla czlowieka.
      zrodloStanu = "state-json". Dodatkowo porownaj informacyjnie z plikami (np. istnieje
      ${sciezka}/review-faza-N.md a stan mowi review=pending) i wpisz różnice do rozbieznosci[]
      (NIE koryguj stanu samodzielnie).

   B) PLIKU NIE MA (pierwszy run): zbuduj stan z plikow, zrodloStanu = "pierwszy-parse-md":
      - ${sciezka}/*-plan.md -> lista faz [(numer, nazwa)].
      - ${sciezka}/*-zadania.md -> per faza execute:
        execute = "done" gdy wszystkie checkboxy fazy sa [x], LICZAC WYLACZNIE checkboxy
        implementacyjne. POMIN CALKOWICIE: checkboxy z prefiksem "Weryfikacja:", "Operator:",
        oznaczone "[E2E]" lub "[Manual]", ORAZ wszystkie checkboxy w sekcjach
        "## Do poprawy po review fazy N" i "## Operator checklist faza N" (te sekcje obsluguje
        review/fix, nie execute). Dowolny INNY [ ] => execute = "pending".
      - review = "done" gdy istnieje ${sciezka}/review-faza-{numer}.md, inaczej "pending".
        UWAGA: faza z execute="done" i review="pending" to NORMALNY stan po awarii — taka faza
        MUSI miec review (nie pomijaj jej).
      - sekcja "## Do poprawy po review fazy {numer}" w zadaniach: niezaznaczone checkboxy P1/P2
        -> sparsuj kazdy do otwarteFindingi (severity z [P1]/[P2], typ KOD/TEST/E2E z kontekstu,
        plik i opis z tresci linii) i ustaw fix = "pending". Wszystkie zaznaczone lub sekcji brak
        przy review="done" -> fix = "done" lub "none" (none gdy sekcji nigdy nie bylo).
        Gdy review="pending" -> fix = "pending" tylko jesli sa otwarte findingi, inaczej "none"
        (review je ustali).

3. zakonczenie: przy pierwszym parse ustaw walidacja/complete/compound = "pending"
   (chyba ze zadanie jest juz w docs/completed/ — wtedy "done").
4. nazwaZadania = ostatni segment sciezki ${sciezka}.

Zwroc obiekt zgodny ze schematem. Nie modyfikuj zadnych plikow — to read-only bootstrap.`
}

function zapiszStanPrompt(sciezka, trescJson) {
  return `Zapisz plik stanu pipeline'u dev-autopilot. Uzyj narzedzia Write (pelne nadpisanie pliku).

Sciezka: ${sciezka}/.autopilot-state.json
Tresc — zapisz DOKLADNIE ponizszy JSON, bez zadnych zmian, dopiskow ani komentarzy:

${trescJson}

Nie modyfikuj ZADNYCH innych plikow. Zwroc {zapisano:true}.`
}

function warmupPrompt(sciezka) {
  return `Jestes rozgrzewka cache testowego pipeline'u dev-autopilot (folder zadania: ${sciezka}).
CEL: zbudowac cache transformacji jest (next/jest + SWC, .jest-cache) PRZED fazami implementacji,
zeby zaden pozniejszy agent nie trafil na zimny ~16-minutowy bieg.
${BLOK_DLUGIE_KOMENDY}

1. Wykryj runner: przeczytaj package.json + jest.config.js. Rozgrzewka dotyczy WYLACZNIE jest.
   Brak jest (inny runner lub brak testow) -> zwroc {status:"zbedne", detal:"<powod>"} i ZAKONCZ.
2. Wybierz JEDEN test komponentu z najciezszym setupem: szukaj *.test.tsx renderujacego komponent
   przez @testing-library/react (src/components/, src/app/ — transform next/jest + SWC i setup
   jsdom sa najdrozsze). Jesli W CALYM repo nie ma zadnego testu komponentu
   (projekt greenfield): utworz TYMCZASOWY plik .autopilot-warmup.test.tsx w src/
   z trywialnym renderem <div>warmup</div> i 1 asercja — to JEDYNY
   wyjatek od zakazu modyfikacji plikow; USUN go w kroku 5.
3. BIEG ZIMNY — OBOWIAZKOWO przez tlo (komenda moze trwac wiele minut, foreground NIE dokonczy):
   uruchom \`npx jest <plik> > /tmp/autopilot-warmup.log 2>&1\` przez Bash
   z run_in_background (package manager: npm — package-lock.json).
   POLLUJ co ~45-60s: \`tail -5 /tmp/autopilot-warmup.log\` + sprawdzenie czy proces zyje.
   Czekaj do zakonczenia (budzet ~25 min). Zanotuj laczny czas jako czasZimnySek.
   WYNIK testu (pass/fail asercji) jest NIEISTOTNY — liczy sie ukonczenie procesu (= zapis cache).
4. DOWOD — bieg kontrolny foreground: uruchom TEN SAM test zwyklym Bash (timeout 120s wystarczy).
   Zanotuj czas jako czasKontrolnySek. Cache zbudowany = czas rzedu SEKUND.
   czasKontrolnySek < 60 -> status "zbudowano". Wiecej lub timeout -> status "niepowodzenie"
   (cache NIE dziala — nie raportuj sukcesu ktorego nie ma).
5. Sprzatanie: usun /tmp/autopilot-warmup.log i ewentualny tymczasowy test z kroku 2.

Poza wyjatkiem z kroku 2 NIE modyfikuj zadnych plikow. Zwroc {status, detal, czasZimnySek, czasKontrolnySek}.`
}

function e2eEnvUpPrompt() {
  return `Jestes agentem srodowiska E2E pipeline'u dev-autopilot. Postaw srodowisko testow E2E weba
(dev server Next na :3000 + baza e2e), zeby reviewer E2E i fix mogly REALNIE wykonac scenariusze
zamiast klasyfikowac je jako OPERATOR. Baza = DEDYKOWANA baza e2e z .env.e2e (nigdy dev/prod).
${BLOK_DLUGIE_KOMENDY}

0. SELF-SKIP: jesli w korzeniu repo NIE ma pliku .env.e2e -> zwroc
   {status:"pominieto", detal:"brak .env.e2e — E2E w trybie OPERATOR (setup: .claude/templates/e2e-env/README.md)", devServer:"brak", baza:"brak"}
   i ZAKONCZ.

1. BEZPIECZENSTWO (twarde):
   a) \\`git check-ignore -q .env.e2e\\` — exit != 0 (plik NIE jest gitignorowany) -> {status:"niepowodzenie",
      detal:"dopisz .env.e2e do .gitignore — plik zawiera sekrety"}. NIGDY nie loguj wartosci z tego pliku.
   b) Wymagane klucze: DATABASE_URL, REDIS_URL, NEXT_PUBLIC_SITE_URL. Brak -> niepowodzenie z LISTA NAZW brakow.
      Pozostale klucze z env.ts (OPENAI_API_KEY, CONVERT_KIT_*, CLARITY_PROJECT_ID, MY_GMAIL*) moga byc
      atrapami, ale MUSZA istniec — @t3-oss/env-nextjs waliduje je Zodem przy starcie i bez nich dev server padnie.
   c) GUARD TOZSAMOSCI: DATABASE_URL z .env.e2e musi byc ROZNY od wartosci w .env / .env.local
      (jesli istnieja). Identyczny = to nie jest dedykowana baza e2e -> niepowodzenie (ochrona bazy dev).

2. BAZA: sprawdz czy Postgres odpowiada (\\`docker ps\\`, potem \\`psql "$DATABASE_URL" -c "select 1"\\`;
   brak psql lokalnie -> \\`docker exec <kontener> psql -U postgres -c "select 1"\\`). Nie odpowiada ->
   \\`docker-compose up -d\\` i polluj co ~5s (max ~90s). Sukces -> baza:"gotowa", timeout -> niepowodzenie.

3. DEV SERVER: \\`curl -s -o /dev/null -w "%{http_code}" localhost:3000\\`.
   - Odpowiada (200/307) -> devServer:"zastany"; w detal ostrzezenie: istniejacy proces ma env swojego
     startu, wiec moze wskazywac na baze dev — scenariusze zweryfikuja to posrednio.
   - Nie odpowiada -> uruchom DETACHED (musi przezyc Twoje zakonczenie):
     \\`set -a; source .env.e2e; set +a; nohup npm run dev > /tmp/autopilot-dev.log 2>&1 & echo $! > /tmp/autopilot-dev.pid\\`
     Polluj curl co ~10s (max ~120s; pierwszy build Next trwa). Sukces -> devServer:"uruchomiony",
     timeout -> niepowodzenie (dolacz tail -20 /tmp/autopilot-dev.log do detal).

4. status "gotowe" TYLKO gdy: dev server odpowiada ORAZ baza e2e odpowiada. Nie modyfikuj plikow repo.`
}

function e2eDbSyncPrompt(sciezka, numerFazy) {
  return `Jestes agentem synchronizacji bazy e2e pipeline'u dev-autopilot (zadanie: ${sciezka}, faza ${numerFazy}).
Cel: dedykowana baza e2e ma miec schema i dane tej fazy PRZED scenariuszami E2E.
Ta baze WOLNO modyfikowac autonomicznie — to nie jest baza dev/prod (guard tozsamosci zrobil env-up).
NIGDY nie loguj wartosci sekretow z .env.e2e.
${BLOK_DLUGIE_KOMENDY}

1. Wczytaj DATABASE_URL z .env.e2e (do uzycia, nie do logu).
2. SCHEMA — realny apply: \\`set -a; source .env.e2e; set +a; npx drizzle-kit push\\`.
   Jesli CLI zapyta o zmiane destrukcyjna (drop/rename kolumny) — NIE potwierdzaj, zwroc
   niepowodzenie z trescia pytania. To pierwsza PRAWDZIWA weryfikacja schematu w pipeline:
   blad SQL -> status "niepowodzenie" z pelna trescia bledu w detal (moze to byc DEFEKT KODU
   w src/db/schema.ts, nie infra).
3. SEED: \\`set -a; source .env.e2e; set +a; npm run db:seed\\`. Bledy duplikatow przy
   nieidempotentnym seedzie odnotuj w detal, nie failuj.
4. DANE SCENARIUSZY: jesli checkboxy "Weryfikacja:" fazy ${numerFazy} w ${sciezka}/*-zadania.md
   wymagaja konkretnych rekordow (usluga o danym slugu, tag, tlumaczenie), sprawdz ich obecnosc
   i dopisz brakujace idempotentnym INSERTem. Nie dotykaj bazy dev.

Zwroc {status, detal}: "zsynchronizowano" (cos zaaplikowano), "aktualna" (nic do zrobienia),
"niepowodzenie" (+ co dokladnie padlo).`
}

function e2eEnvDownPrompt() {
  return `Sprzatanie srodowiska E2E dev-autopilot. Zabij WYLACZNIE procesy uruchomione przez pipeline:
1. Jesli istnieje /tmp/autopilot-dev.pid: \\`kill $(cat /tmp/autopilot-dev.pid)\\` (ignoruj blad gdy
   proces juz nie zyje), potem usun /tmp/autopilot-dev.pid i /tmp/autopilot-dev.log.
   Dev server "zastany" (brak naszego .pid) zostaw w spokoju — nie nalezy do nas.
2. Kontenera z Postgresem NIE zatrzymuj (tani w utrzymaniu, operator moze chciec zajrzec w dane).
Zwroc {posprzatano, detal}.`
}

function fixPrompt(sciezka, numerFazy, otwarteFindingi) {
  return `Jestes czescia pipeline'u dev-autopilot. Naprawiasz problemy z review fazy ${numerFazy}.
WAZNE: to JEDYNY przebieg fix tej fazy — po nim NIE ma ponownego review. Twoj raport jest
OSTATECZNYM zrodlem prawdy o stanie findingow, wiec klasyfikuj uczciwie czego nie zamknales.

Folder zadania: ${sciezka}
Numer fazy: ${numerFazy}

OTWARTE FINDINGI DO NAPRAWY (lista autorytatywna — przekazana przez orkiestratora):
${JSON.stringify(otwarteFindingi, null, 2)}

Pelny kontekst kazdego findingu: ${sciezka}/review-faza-${numerFazy}.md.
Checkboxy w sekcji "Do poprawy po review fazy ${numerFazy}" w ${sciezka}/*-zadania.md odznaczaj
w miare napraw (to widok dla czlowieka).

Napraw WSZYSTKIE z listy (sa to P1 blocking i P2 important; P3 nie ma na liscie).

KLASYFIKUJ kazdy finding przed naprawa:
- Typ KOD (blad implementacji/security/perf/architektury): napraw kod -> uruchom unit testy -> odznacz checkbox.
- Typ TEST (brakujacy test): NIE ruszaj kodu produkcyjnego, napisz test (min 1 asercja, nie assertion-free)
  zgodnie z planem w docs/plans/ -> uruchom -> odznacz.
- Typ E2E (weryfikacja E2E): napraw przyczyne -> re-uruchom scenariusz w przegladarce przez
  chrome-devtools MCP (snapshot + asercja po roli/nazwie, zero bledow konsoli) -> odznacz DOPIERO
  po PASS (nie na "naprawilem kod").

ZAKAZ TEST-WEAKENINGU (twardy): NIE modyfikuj istniejacych testow ani asercji zeby przeszly —
napraw IMPLEMENTACJE. Mozesz testy DODAWAC. Oslabienie/usuniecie asercji = niedopuszczalne;
walidacja koncowa audytuje git diff testow w commitach fix i zglosi kazda taka zmiane.

Kolejnosc: KOD -> TEST -> E2E. Po naprawach: pelna walidacja (npx tsc --noEmit, npx jest,
npx next lint, npm run build), commit \`fix([nazwa]): poprawki po review fazy ${numerFazy}\`,
staguj tylko zmienione pliki.
${BLOK_DLUGIE_KOMENDY}

KNOWN-ISSUES (graceful — bez osobnego agenta): jesli ZOSTAJA P2 ktorych NIE udalo sie naprawic
(a zero nierozwiazanych P1), zapisz je do ${sciezka}/known-issues.md. Dedup: jesli sekcja
"## Faza ${numerFazy}" juz istnieje — ZASTAP jej cala tresc (od naglowka do nastepnego "## " lub konca pliku),
NIE dopisuj duplikatu. Format: "## Faza ${numerFazy}\\nPozostaje N problemow P2 po fixie. Review: review-faza-${numerFazy}.md\\n- 🟠 [P2] plik — opis".
Po zapisie upewnij sie ze jest DOKLADNIE jeden naglowek "## Faza ${numerFazy}".

Dzialaj autonomicznie, nie pytaj usera. Zwroc obiekt FixResult — KRYTYCZNE pola (orkiestrator gate'uje
z nich, bez re-review): nierozwiazaneP1 (P1 ktorych NIE zamknales -> orkiestrator zrobi STOP),
nierozwiazaneP2 (P2 przeniesione do known-issues), walidacja (PASS/FAIL pelnej walidacji).`
}

function finalValidationPrompt(sciezka) {
  return `Wykonaj pelna walidacje calego projektu po autopilocie (folder zadania: ${sciezka}).
${BLOK_DLUGIE_KOMENDY}

KROK 1 — odkryj komendy (NIE zgaduj): przeczytaj package.json scripts (typecheck/lint/test/check),
wykryj package manager (bun.lockb->bun, pnpm-lock->pnpm, yarn.lock->yarn, package-lock->npm).
W tym repo NIE MA skryptow typecheck ani test: uzyj \`npx tsc --noEmit\` i \`npx jest\`.
Lint: \`npx next lint\`. Build: \`npm run build\` (ostatni, najciezszy krok).

KROK 2 — uruchom w kolejnosci: typecheck -> lint (jesli jest) -> test (pelny suite, wg BLOKU
DLUGICH KOMEND: tlo + polling; flake infra obsluz wg procedury z bloku i DOKONCZ lancuch) -> build.
Zatrzymaj sie dopiero na REALNYM FAIL (flake infra PASS-w-izolacji nie jest FAIL).

KROK 3 — AUDYT TESTOW PO FIXACH: \`git log --oneline --grep="^fix(" \` dla commitow fix tego zadania,
potem \`git diff <zakres>\` zawezony do plikow *.test.* — szukaj ZMIAN W ISTNIEJACYCH asercjach/testach
(usuniecie testu, oslabienie expect, zmiana oczekiwanej wartosci). Nowe testy sa OK. Kazda modyfikacje
istniejacego testu wpisz do testyZmodyfikowane[] (to sygnal test-weakeningu do raportu, nie auto-FAIL).

KROK 4 — jesli REALNY FAIL i potrafisz naprawic prosty problem (import, typ) — napraw, commituj,
uruchom ponownie. Jak nie potrafisz — zwroc liste bledow z lokalizacjami i wynik=FAIL.

Zwroc obiekt zgodny ze schematem ValidationResult.`
}

// ── Helpery orkiestratora (deterministycznie, w JS) ───────────────────────

// Filar 3: liczniki i gate liczone z findings[], nie z self-reportu scribe'a.
function policzFindingi(findings) {
  const istotne = (findings || []).filter((f) => f.typ !== 'OPERATOR')
  return {
    p1: istotne.filter((f) => f.severity === 'P1').length,
    p2: istotne.filter((f) => f.severity === 'P2').length,
    p3: istotne.filter((f) => f.severity === 'P3').length,
    operator: (findings || []).length - istotne.length,
  }
}

function otwartePoReview(findings) {
  return (findings || [])
    .filter((f) => f.typ !== 'OPERATOR' && (f.severity === 'P1' || f.severity === 'P2'))
    .map((f) => ({ severity: f.severity, typ: f.typ, plik: f.plik, opis: f.opis }))
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

// Sanityzacja args — UI wstrzykuje prefix '@' (mention) i czesto trailing '/'.
const sciezkaRaw = typeof args === 'string' ? args : args && args.sciezka
const sciezka = sciezkaRaw && sciezkaRaw.replace(/^@/, '').replace(/\/+$/, '')
if (!sciezka) {
  return {
    status: 'STOP',
    powod: 'brak sciezki zadania. Przy starcie: args:"docs/active/<zadanie>". Przy RESUME (scriptPath+resumeFromRunId): przekaz args PONOWNIE — nie przenosi sie z poprzedniego runu.',
  }
}

const tokSpent = () => (typeof budget !== 'undefined' && budget && budget.spent ? budget.spent() : 0)

phase('Bootstrap')
const stan = await agent(bootstrapPrompt(sciezka), { schema: PLAN_STATE, label: 'bootstrap' })
if (!stan) {
  return { status: 'STOP', powod: 'bootstrap nie zwrocil stanu (agent null)' }
}

// Decyzja A: git zwalidowany w sesji przed odpaleniem; tu tylko bezpiecznik.
if (!stan.branch.zgodny) {
  return { status: 'STOP', powod: `branch mismatch: jestes na "${stan.branch.aktualny}", wymagany "${stan.branch.wymagany}"`, stan }
}
if (!stan.branch.czysty) {
  return { status: 'STOP', powod: 'niezacommitowane zmiany — zacommituj/stash przed autopilotem (po awarii runu: NAJPIERW git status, kod faz zwykle JEST na dysku)', stan }
}
for (const r of stan.rozbieznosci || []) log(`Bootstrap rozbieznosc (informacyjna): ${r}`)

// Filar 2: kolejka liczona w JS ze stanu — zero interpretacji LLM.
const kolejka = stan.fazy
  .filter((f) => f.execute === 'pending' || f.review === 'pending' || f.fix === 'pending')
  .map((f) => f.numer)

log(`Autopilot: ${stan.nazwaZadania} (stan: ${stan.zrodloStanu}) — fazy do wykonania: ${kolejka.join(', ') || 'brak'}`)

// Utrwalanie stanu: tresc liczona w JS, zapis przez tani leaf-agent (haiku). Best-effort z ostrzezeniem.
async function zapiszStan() {
  const tresc = JSON.stringify(
    { wersja: 1, zadanie: stan.nazwaZadania, fazy: stan.fazy, zakonczenie: stan.zakonczenie },
    null,
    2
  )
  const w = await agent(zapiszStanPrompt(sciezka, tresc), { schema: ZAPIS_STANU, label: 'stan:zapis', model: 'haiku' })
  if (!w || !w.zapisano) log('OSTRZEZENIE: zapis .autopilot-state.json nie powiodl sie — resume bedzie polegac na parse md')
}

// Filar 1: rozgrzewka cache jest — zawsze (self-skip gdy brak jest; warm = sekundy).
// Chroni tez walidacje koncowa przy pustej kolejce (np. resume po ukonczonych fazach na zimnej maszynie).
const warmup = await agent(warmupPrompt(sciezka), { schema: WARMUP_RESULT, label: 'warmup:jest', phase: 'Bootstrap' })
if (!warmup) {
  return { status: 'STOP', powod: 'rozgrzewka nie zwrocila wyniku (agent null)', stan }
}
log(`Rozgrzewka: ${warmup.status} — ${warmup.detal} (zimny: ${warmup.czasZimnySek ?? 'n/a'}s, kontrolny: ${warmup.czasKontrolnySek ?? 'n/a'}s)`)
if (warmup.status === 'niepowodzenie') {
  return { status: 'STOP', powod: `rozgrzewka cache nie powiodla sie: ${warmup.detal} — fazy UI zginelyby na watchdogu, taniej zatrzymac tu`, stan }
}

// Srodowisko E2E: raz per run (dev server Next hot-reloaduje working tree, restart per faza zbedny).
// BRAMKA OPT-IN (2026-06-16, regresja etap-11): status decyduje czy run leci dalej.
//   'pominieto'     = brak .env.e2e -> projekt nie chce E2E -> cicha degradacja do OPERATOR (status quo).
//   'niepowodzenie' = .env.e2e ISTNIEJE (projekt opt-in'owal sie w E2E), ale srodowisko nie gotowe
//                     -> HARD STOP w bootstrapie, PRZED jakakolwiek faza. Bez tego E2E znika z runu
//                     bez sladu (cicho do OPERATOR) — operator dowiaduje sie z checkboxow po fakcie.
//   'gotowe'        = dev server na :3000 + baza e2e -> E2E aktywne.
// null (agent padl) = infra hiccup, nie brak setupu -> nie blokuj (degraduj z ostrzezeniem w logu).
const e2eEnv = await agent(e2eEnvUpPrompt(), { schema: E2E_ENV_RESULT, label: 'e2e:env-up', phase: 'Bootstrap' })
log(`E2E env: ${e2eEnv ? `${e2eEnv.status} (dev server: ${e2eEnv.devServer}, baza: ${e2eEnv.baza}) — ${e2eEnv.detal}` : 'agent zwrocil null — pomijam E2E (infra, nie brak setupu)'}`)
if (e2eEnv && e2eEnv.status === 'niepowodzenie') {
  return {
    status: 'STOP',
    powod: `Srodowisko E2E nie gotowe, a .env.e2e istnieje (projekt wymaga E2E): ${e2eEnv.detal}`,
    naprawa: 'Setup: .claude/templates/e2e-env/README.md. Najczestsze braki = baza e2e nie wstala (`docker-compose up -d`) albo .env.e2e nie ma wszystkich kluczy wymaganych przez env.ts (dev server nie wstanie, bo @t3-oss/env-nextjs waliduje je Zodem). Opt-out swiadomego runu bez E2E: usun/zmien nazwe .env.e2e. Po setupie wznow: Workflow({scriptPath, resumeFromRunId}) + TE SAME args.',
    e2eEnv,
    stan,
  }
}
const e2eAktywne = !!e2eEnv && e2eEnv.status === 'gotowe'

const historia = {}
const raporty = []
const tokRunStart = tokSpent()

for (const numerFazy of kolejka) {
  const faza = stan.fazy.find((f) => f.numer === numerFazy)
  if (!faza) {
    return { status: 'STOP', powod: `kolejka zawiera faze ${numerFazy} nieobecna w fazy[] — niespojny stan bootstrapu`, raporty }
  }
  phase(`Faza ${numerFazy}`)
  const tokFazaStart = tokSpent()
  let gateFazy = 'CZYSTE'
  let cykle = 0
  let e2eSync = null

  // 1) EXECUTE — tylko gdy pending (resume nigdy nie powtarza ukonczonego execute, w tym migracji).
  if (faza.execute === 'pending') {
    const exec = await workflow('dev-docs-execute-wf', { sciezka, faza: numerFazy })
    if (!exec || exec.status !== 'completed') {
      return { status: 'STOP', powod: `execute fazy ${numerFazy} zwrocil "${exec ? exec.status : 'null'}"${exec && exec.problem ? `: ${exec.problem}` : ''}`, faza: numerFazy, exec, raporty }
    }
    faza.execute = 'done'
    await zapiszStan()
    log(`Faza ${numerFazy}: Execute OK (${exec.iu.length} IU)`)
  }

  // 2) REVIEW — tylko gdy pending. Faza ukonczona z otwartymi findingami idzie PROSTO do fix (Bug 1).
  if (faza.review === 'pending') {
    // Sync bazy e2e per faza PO execute (migracje fazy powstaja w execute, db push jest
    // przyrostowy — brak nowych migracji = no-op). Niepowodzenie nie blokuje review:
    // tester E2E trafi na brak danych i sklasyfikuje OPERATOR, a detal (np. blad SQL
    // migracji = potencjalny defekt kodu!) zostaje w logu i raporcie fazy dla operatora.
    if (e2eAktywne) {
      e2eSync = await agent(e2eDbSyncPrompt(sciezka, numerFazy), { schema: E2E_DB_SYNC_RESULT, label: `e2e:db-sync:faza-${numerFazy}` })
      log(`E2E db-sync fazy ${numerFazy}: ${e2eSync ? `${e2eSync.status} — ${e2eSync.detal}` : 'agent zwrocil null'}`)
    }
    const review = await workflow('dev-docs-review-wf', {
      sciezka,
      faza: numerFazy,
      poprzednieFindingi: faza.otwarteFindingi.length ? faza.otwarteFindingi : null,
    })
    if (!review) {
      return { status: 'STOP', powod: `review fazy ${numerFazy} zwrocil null`, faza: numerFazy, raporty }
    }
    // Filar 3: liczniki/gate w JS z findings[]; liczniki scribe'a tylko do porownania w logu.
    const liczniki = policzFindingi(review.findings)
    const scribeL = review.liczniki || {}
    if (scribeL.p1 !== liczniki.p1 || scribeL.p2 !== liczniki.p2) {
      log(`Faza ${numerFazy}: NIESPOJNOSC licznikow scribe (p1=${scribeL.p1},p2=${scribeL.p2}) vs JS (p1=${liczniki.p1},p2=${liczniki.p2}) — uzywam JS`)
    }
    log(`Review fazy ${numerFazy}: P1=${liczniki.p1} P2=${liczniki.p2} P3=${liczniki.p3} OPERATOR=${liczniki.operator}`)
    faza.review = 'done'
    faza.otwarteFindingi = otwartePoReview(review.findings)
    faza.fix = faza.otwarteFindingi.length ? 'pending' : 'none'
    await zapiszStan()
  }

  // 3) FIX — bez re-review; gate z self-reportu + lista findingow przekazana wprost (md tylko jako widok).
  if (faza.fix === 'pending') {
    const fix = await agent(fixPrompt(sciezka, numerFazy, faza.otwarteFindingi), { schema: FIX_RESULT, label: `fix:faza-${numerFazy}` })
    if (!fix) {
      return { status: 'STOP', powod: `fix fazy ${numerFazy} zwrocil null`, faza: numerFazy, raporty }
    }
    cykle = 1
    log(`Fix fazy ${numerFazy}: naprawiono ${fix.naprawione}, nierozwiazane P1=${fix.nierozwiazaneP1} P2=${fix.nierozwiazaneP2}, walidacja ${fix.walidacja}`)

    if (fix.walidacja === 'FAIL' || fix.nierozwiazaneP1 > 0) {
      // Stan NIE oznacza fix=done — resume wroci wprost do fixa z ta sama lista.
      await zapiszStan()
      return {
        status: 'STOP',
        powod: fix.nierozwiazaneP1 > 0
          ? `Faza ${numerFazy}: ${fix.nierozwiazaneP1}x P1 nierozwiazane po fixie (brak re-review) — wymagana reczna interwencja`
          : `Faza ${numerFazy}: walidacja fixa FAIL — wymagana reczna interwencja`,
        faza: numerFazy, fix, raporty,
      }
    }

    gateFazy = fix.nierozwiazaneP2 > 0 ? 'ZASTRZEZENIA' : 'CZYSTE'
    if (fix.nierozwiazaneP2 > 0) {
      cykle = '1 (graceful P2)'
      log(`Faza ${numerFazy}: GRACEFUL — ${fix.nierozwiazaneP2}x P2 do known-issues, kontynuuje`)
    }
    faza.fix = 'done'
    faza.otwarteFindingi = []
    await zapiszStan()
  } else if (faza.fix === 'none') {
    gateFazy = 'CZYSTE'
  }

  historia[numerFazy] = cykle
  const tokFazy = Math.round((tokSpent() - tokFazaStart) / 1000)
  // Delta 0 po resume = agenci fazy wrocili z journala (cache), nie "darmowa faza" — oznacz w raporcie.
  const tokFazyOpis = tokFazy === 0 ? '0k (z cache — resume)' : `${tokFazy}k`
  log(`Faza ${numerFazy}: koniec — gate ${gateFazy}, cykle ${cykle}, ~${tokFazyOpis} tokenow`)
  raporty.push({ faza: numerFazy, gate: gateFazy, cykle, tokeny: tokFazyOpis, e2eSync: e2eSync ? `${e2eSync.status}: ${e2eSync.detal}` : 'n/a' })
}

// ── Zakonczenie ──────────────────────────────────────────────────────────
phase('Zakonczenie')

if (stan.zakonczenie.walidacja === 'pending') {
  const walidacja = await agent(finalValidationPrompt(sciezka), { schema: VALIDATION_RESULT, label: 'walidacja-koncowa' })
  if (!walidacja) {
    return { status: 'STOP', powod: 'walidacja koncowa zwrocila null', historia, raporty }
  }
  if (walidacja.testyZmodyfikowane && walidacja.testyZmodyfikowane.length) {
    log(`UWAGA test-weakening: fix zmodyfikowal istniejace testy: ${walidacja.testyZmodyfikowane.join(', ')}`)
  }
  if (walidacja.wynik === 'FAIL') {
    return { status: 'STOP', powod: 'walidacja koncowa FAIL', walidacja, historia, raporty }
  }
  stan.zakonczenie.walidacja = 'done'
  stan.walidacjaWynik = walidacja
  await zapiszStan()
}

// Teardown E2E dopiero PO walidacji i tylko na sciezce sukcesu — kazdy wczesniejszy STOP
// celowo zostawia dev server i kontener bazy zywe (operator debuguje na gotowym srodowisku; nasz .pid
// pozwala nastepnemu runowi przejac lub ubic proces).
if (e2eAktywne) {
  const down = await agent(e2eEnvDownPrompt(), { schema: E2E_DOWN_RESULT, label: 'e2e:env-down', model: 'haiku' })
  log(`E2E env-down: ${down ? `${down.posprzatano ? 'OK' : 'pominieto'} — ${down.detal}` : 'agent zwrocil null'}`)
}

// Compound PRZED complete: dokumentuje solutions gdy sciezki w docs/active/ jeszcze zyja.
// Complete (archiwizacja, przenosi folder) jest OSTATNI — po nim juz NIE zapisujemy stanu
// (plik wedruje do archiwum razem z folderem; zapis wskrzesilby pusty katalog w active/).
// Stempel complete:"done" w zarchiwizowanym pliku stawia sam complete-wf (krok 5 jego prompta).
let compound = null
if (stan.zakonczenie.compound === 'pending') {
  compound = await workflow('dev-compound-wf', { sciezka })
  stan.zakonczenie.compound = 'done'
  await zapiszStan()
}

let complete = null
if (stan.zakonczenie.complete === 'pending') {
  complete = await workflow('dev-docs-complete-wf', { nazwaZadania: stan.nazwaZadania })
}

const tokRazem = Math.round((tokSpent() - tokRunStart) / 1000)
log(`Autopilot koniec: ${kolejka.length} faz, ~${tokRazem}k tokenow lacznie`)

return {
  status: 'OK',
  nazwaZadania: stan.nazwaZadania,
  fazyUkonczone: kolejka.length,
  tokeny: `${tokRazem}k`,
  historia,
  raporty,
  walidacja: stan.walidacjaWynik || 'done w poprzednim runie',
  e2eSrodowisko: e2eEnv ? e2eEnv.status : 'brak',
  archiwum: complete && complete.archiwum,
  archiwumCommit: (complete && complete.commit) || '',
  solution: compound && compound.plik,
  regula: compound && compound.regula,
}
