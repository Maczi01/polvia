---
name: security
description: "Systematyczny audyt bezpieczeństwa dla Next.js 15 (App Router) + Drizzle/Postgres + Redis. Używaj przy review bezpieczeństwa, przed deployem, przy pracy z autoryzacją, walidacją inputów, Server Actions, route handlerami, rate limitingiem, uploadami, MDX, sekretami w env.ts, OWASP Top 10."
---

# Security Audit (web)

Skill do przeprowadzania systematycznego audytu bezpieczeństwa w projekcie Next.js 15 + Drizzle ORM + Postgres + Redis.

## Kiedy używać

- Review bezpieczeństwa przed deployem na produkcję
- Dodawanie nowych endpointów (route handlers `src/app/api/**/route.ts`) lub Server Actions (`_actions.ts`)
- Zmiany w autoryzacji (kto może wykonać którą mutację)
- Tworzenie nowych tabel lub zmiana schematu (`src/db/schema.ts`)
- Obsługa uploadów, generowanie plików, renderowanie treści od użytkownika
- Nowe zmienne środowiskowe, nowe integracje zewnętrzne (OpenAI, Resend, Mapbox, ConvertKit)

**Kluczowa rama mentalna weba:** wszystko, co trafia do przeglądarki, jest publiczne (bundle klienta, `NEXT_PUBLIC_*`, props przekazane z Server do Client Component), a każdy request może być podrobiony — także request do Server Action, bo to zwykły endpoint POST pod wygenerowanym ID. **Nie ma tu RLS ani Supabase — jedyną barierą jest kod serwerowy tego repo.** Brak sprawdzenia uprawnień w Server Action = brak jakiegokolwiek sprawdzenia.

---

## Procedura audytu

### Krok 1: Zmapuj punkty wejścia

1. **Route handlers** — `src/app/api/**/route.ts`: `request.json()`, `request.text()`, query params, nagłówki (`x-forwarded-for` da się podrobić!)
2. **Server Actions** — pliki z `'use server'` (`_actions.ts`, `src/app/action/`): każdy argument to niezaufany input, także `FormData`
3. **Parametry route** — `params` i `searchParams` w `page.tsx` (slug, locale, filtry, paginacja)
4. **Middleware** — `src/middleware.ts`: rewrite/redirect na podstawie pathname (czy da się ominąć zamierzoną trasę?)
5. **Uploady plików** — typ MIME, rozmiar, nazwa (path traversal!), przetwarzanie przez `sharp`
6. **Treść MDX** — `content/posts`, `content/terms`: kto może dodać plik, czy renderowanie wykonuje kod
7. **Webhooki i callbacki** — czy weryfikują podpis nadawcy

Dla każdego punktu: **czy input jest walidowany schemą Zod PRZED użyciem?** Brak walidacji = finding. `as`, `!` lub `any` na danych z requesta = finding.

### Krok 2: Bezpieczeństwo zapytań (Drizzle / Postgres)

Query builder Drizzle jest domyślnie parametryzowany, ale są pułapki.

1. **Surowy SQL:** każde wyrażenie `sql` z interpolacją user inputu — czy używa placeholderów Drizzle, czy konkatenacji stringów? Konkatenacja = CRITICAL.
2. **`delete` / `update` bez `where`** — `eslint-plugin-drizzle` to wyłapuje; sprawdź, czy reguła nie jest wyłączona lokalnie komentarzem.
3. **IDOR:** czy zapytanie zawęża wynik do zasobów, do których wołający ma prawo, czy tylko do przekazanego ID? `where(eq(table.id, params.id))` bez sprawdzenia właściciela = HIGH.
4. **Nadmiar danych:** `select()` z pełnym rekordem tam, gdzie potrzebne są dwie kolumny — wyciek pól wewnętrznych do klienta.
5. **Zaufanie do enumów:** wartości `pgEnum` przyjmowane z requesta muszą być walidowane przez `z.enum(...)`, nie rzutowane przez `as`.

### Krok 3: Autoryzacja (nie ma RLS — sprawdzasz kod)

1. **Server Actions:** czy KAŻDA mutacja sprawdza uprawnienia na początku funkcji? Server Action jest wywoływalna z dowolnego klienta — ukryty przycisk w UI nie chroni niczego.
2. **Route handlers:** czy chronione endpointy weryfikują tożsamość wołającego? Czy publiczne są publiczne świadomie?
3. **Ścieżki `(dashboard)`:** czy dostęp do panelu jest kontrolowany po stronie serwera (layout/middleware), a nie tylko brakiem linku w nawigacji?
4. **Granica Server → Client:** czy do Client Component nie trafiają pola, których użytkownik nie powinien widzieć (props są w HTML)?
5. **Walidacja serwerowa, nie kliencka:** react-hook-form to UX; ta sama schema Zod MUSI działać w Server Action.

> **Kontekst tego repo:** dashboard nie ma dziś warstwy auth. Jeśli audytujesz mutacje dashboardu, brak sprawdzenia uprawnień jest realnym findingiem (nie „to jeszcze nie zrobione") — zgłoś go z rekomendacją, na jakim poziomie bramka powinna stanąć.

### Krok 4: Rate limiting i nadużycia

1. Czy **każdy publiczny endpoint** ma rate limiting? Wzorzec referencyjny: `src/app/api/submit-contact-query/route.ts` (Redis + TTL na IP i na e-mail).
2. Czy limit opiera się na czymś, czego atakujący nie kontroluje w pełni? `x-forwarded-for` jest podrabialny — na Vercelu ufaj nagłówkowi platformy, nie dowolnemu z requesta.
3. Czy operacje kosztowne (OpenAI embeddings, wysyłka maila przez Resend/nodemailer, przetwarzanie obrazów przez `sharp`) są limitowane? Brak = MEDIUM, przy płatnym API = HIGH (rachunek jako wektor ataku).
4. Czy limit jest sprawdzany PRZED wykonaniem kosztownej operacji, a nie po?

### Krok 5: Sekrety i wyciek danych

1. **`env.ts` jako jedyne źródło:** `process.env` w kodzie aplikacji = finding. Sekret w bloku `client` = CRITICAL.
2. **`NEXT_PUBLIC_*`:** wszystko z tym prefiksem jest w bundlu przeglądarki. Klucz płatnego API tam = CRITICAL.
3. **`server-only`:** czy moduły z zapytaniami mają `import 'server-only'`? Bez tego jeden nieuważny import wciąga je (i sekrety) do bundla klienta.
4. **Logi:** `console.log` z danymi osobowymi, tokenami, treścią maila = MEDIUM. `no-console` jest ustawione na `warn` — sprawdź, czy warningi nie są ignorowane.
5. **Komunikaty błędów:** czy błąd Postgresa/Drizzle nie leci do klienta w surowej postaci (schemat bazy, nazwy kolumn, fragmenty SQL)?
6. **Pliki:** `.env`, `.env.local`, `seed.sql`, dumpy — czy są w `.gitignore`? Czy w historii nie ma już zacommitowanego sekretu (`git log -p -S "<nazwa klucza>"`)?

### Krok 6: XSS, SSRF i treść zewnętrzna

1. **`dangerouslySetInnerHTML`** — każde użycie wymaga uzasadnienia i sanityzacji. MDX renderujący HTML od użytkownika = HIGH.
2. **URL-e od użytkownika** — `href`/`src` z user inputu: sprawdź schemat (`javascript:`, `data:`), waliduj host przeciw allowliście.
3. **SSRF** — `fetch()` z URL-em pochodzącym od użytkownika (import zdjęcia, proxy, webhook): walidacja hosta po allowliście, sprawdzenie hosta również PO redirectach.
4. **Uploady** — typ pliku z zawartości (magic bytes), nie z `Content-Type`; nazwa pliku sanityzowana (`path.basename`, slugify); zapis poza katalogiem publicznym, jeśli plik nie ma być publiczny.
5. **Zewnętrzne skrypty** — Clarity, mapy, analityka: czy ładowane z zaufanych domen, czy w `next.config.ts` nie rozluźniono nagłówków bezpieczeństwa.

### Krok 7: OWASP Compliance

Przejdź kategorie OWASP Top 10 (2021) pod kątem stacku — wzorce kodu w **[resources/web-security-patterns.md](resources/web-security-patterns.md)**:

A01 Broken Access Control (kroki 2-3) · A02 Cryptographic Failures (krok 5) · A03 Injection (kroki 2, 6) · A04 Insecure Design (krok 4) · A05 Security Misconfiguration (krok 6) · A06 Vulnerable Components (`npm audit`) · A07 Auth Failures (krok 3) · A08 Data Integrity (webhooki bez podpisu) · A09 Logging Failures (krok 5) · A10 SSRF (krok 6).

---

## Klasyfikacja Findings

```
CRITICAL -- Exploit mozliwy w produkcji, wymaga natychmiastowej naprawy
   Przyklady: sekret w bloku client env.ts lub w NEXT_PUBLIC_*, SQL injection
   w surowym wyrazeniu sql, mutacja bez zadnego sprawdzenia uprawnien, endpoint
   zwracajacy dane innych uzytkownikow, zacommitowany klucz API

HIGH -- Powazna luka, exploit mozliwy przy okreslonych warunkach
   Przyklady: brak walidacji Zod na Server Action, IDOR (where po samym ID bez
   sprawdzenia wlasciciela), dangerouslySetInnerHTML z trescia od uzytkownika,
   SSRF w fetch po URL od uzytkownika, brak limitu na endpoincie wolajacym platne API

MEDIUM -- Potencjalne ryzyko, wymaga analizy kontekstu
   Przyklady: brak rate limitingu na endpoincie bez kosztow, select pelnego rekordu
   zamiast konkretnych kolumn, PII w console.log, surowy blad bazy w odpowiedzi,
   brak server-only w module czytajacym baze

LOW -- Hardening, defense-in-depth
   Przyklady: brak naglowkow bezpieczenstwa (CSP, X-Frame-Options), outdated
   dependencies bez znanych CVE, brak audit logging dla niekrytycznych operacji,
   walidacja tylko po stronie klienta duplikujaca poprawna walidacje serwerowa
```

---

## Format Raportu

```markdown
## Security Audit Report: [nazwa projektu / scope]

### Executive Summary
[1-3 zdania: ogólna ocena bezpieczeństwa, liczba findings, najważniejsze ryzyka]

### Findings

#### CRITICAL
1. **[plik:linia]** -- [tytuł]
   - Impact: [co może się stać]
   - Remediation: [jak naprawić, z przykładem kodu]

#### HIGH
[jak wyżej]

#### MEDIUM
[jak wyżej]

#### LOW
[jak wyżej]

### Risk Matrix

| Kategoria               | Status | Findings |
|-------------------------|--------|----------|
| Input Validation        | [OK/WARN/FAIL] | X |
| SQL/Query Safety        | [OK/WARN/FAIL] | X |
| Autoryzacja             | [OK/WARN/FAIL] | X |
| Rate Limiting           | [OK/WARN/FAIL] | X |
| Sekrety / Data Exposure | [OK/WARN/FAIL] | X |
| XSS / SSRF              | [OK/WARN/FAIL] | X |
| OWASP Compliance        | [OK/WARN/FAIL] | X |

### Remediation Roadmap
1. [CRITICAL] [opis] -- termin: natychmiast
2. [HIGH] [opis] -- termin: przed deployem
3. [MEDIUM] [opis] -- termin: następny sprint
4. [LOW] [opis] -- termin: backlog
```

---

## Zasady

1. **Myśl jak atakujący** — zakładaj najgorszy scenariusz, nie optymistyczny
2. **Klient jest niezaufany** — bundle publiczny, request podrabialny; Server Action to endpoint, nie „wewnętrzna funkcja"
3. **Nie ma RLS** — w tym repo nie istnieje druga linia obrony na poziomie bazy. Kod serwerowy jest jedyną bramką
4. **Zawsze podawaj rozwiązanie** — finding bez remediation jest bezużyteczny
5. **Nie dismissuj jako pre-existing** — istniejące luki są nadal lukami
6. **Weryfikuj, nie zakładaj** — „Next.js domyślnie to robi" nie wystarczy, sprawdź kod
7. **Najmniejsze uprawnienia** — każdy komponent dostaje minimum potrzebnych danych i praw
8. **Defense in depth** — waliduj na każdej granicy, nie tylko na pierwszej
9. **Dokumentuj scope** — jasno określ co zostało sprawdzone, a co nie

---

## Dokumentacja Referencyjna

- **Wzorce bezpieczeństwa web (OWASP + kod)** — `resources/web-security-patterns.md`
