# Tech Stack Checklist

Checklisty do code review dla każdej technologii w projekcie.

---

## React 19

### Nowe API
- [ ] `use()` zamiast `useEffect` + `useState` dla async data
- [ ] `useFormStatus()` dla form loading states
- [ ] `useOptimistic()` dla optimistic updates
- [ ] `useActionState()` dla form actions (client-side)

### Usunięte/zmienione wzorce
- [ ] Brak `forwardRef` — ref to zwykły prop w React 19
- [ ] `<Context>` zamiast `<Context.Provider>`
- [ ] Brak `useContext` gdzie można użyć `use(Context)` — pozwala na warunkowe użycie (w if/loop), czego useContext nie obsługuje

### React Compiler (jeśli włączony)
- [ ] Brak ręcznych `useMemo` (compiler optymalizuje automatycznie)
- [ ] Brak ręcznych `useCallback` (compiler optymalizuje automatycznie)
- [ ] Brak `React.memo` wrapperów (compiler decyduje o memoizacji)

### Rendering
- [ ] Suspense boundaries dla async components
- [ ] Brak niepotrzebnych renderów
- [ ] Stan na odpowiednim poziomie (lifting vs colocation)
- [ ] Keys w listach są stabilne i unikalne

### Forms
- [ ] Native form actions gdzie możliwe
- [ ] `formAction` prop na `<button>`
- [ ] React Hook Form + zodResolver jako domyślne podejście
- [ ] Native form actions jako alternatywa dla prostych formularzy

---

## Async / Race Conditions

### useEffect cleanup
- [ ] useEffect z async ma AbortController w cleanup
- [ ] setTimeout/setInterval ma clearTimeout/clearInterval w useEffect return
- [ ] requestAnimationFrame loop sprawdza cancel flag
- [ ] WebSocket / EventSource zamykany w cleanup
- [ ] IntersectionObserver / MutationObserver disconnected w cleanup
- [ ] Listener `window` / `matchMedia` / `EventSource` odłączony w cleanup

### State management
- [ ] Więcej niż 1 boolean ładowania = discriminated union / state machine
- [ ] Operacje wzajemnie wykluczające się mają guard (nie ładuj kolejnego preview jeśli poprzedni trwa)
- [ ] Promise.allSettled dla równoległych operacji które mogą niezależnie failować

### Async patterns
- [ ] Promise.finally() do cleanup zamiast duplikacji w resolve/reject
- [ ] Brak fire-and-forget promises (każdy promise obsłużony lub świadomie zignorowany z komentarzem)
- [ ] Brak floating promises w event handlerach (`.catch()` lub `void`)

---

## Drizzle / Postgres

### Zapytania
- [ ] `update` / `delete` zawsze z `where` (eslint-plugin-drizzle nie wyłączony komentarzem)
- [ ] `select` z wypisanymi kolumnami, nie całym rekordem (gdy wynik idzie do klienta)
- [ ] Brak konkatenacji user inputu w wyrażeniach `sql` — tylko placeholdery
- [ ] Brak zapytań w pętli (N+1) — join / `inArray` / batch
- [ ] Paginacja / `limit` przy listach

### Warstwa i granice
- [ ] Query mieszkają w `src/lib/` (nie w komponencie, nie w route handlerze)
- [ ] Moduł czytający bazę ma `import 'server-only'`
- [ ] Komponent woła funkcję query, nie `db` bezpośrednio

### Schema i migracje
- [ ] Zmiana schematu w `src/db/schema.ts`, migracja wygenerowana przez `npm run drizzle:generate`
- [ ] Wygenerowany SQL w `drizzle/` nieedytowany ręcznie
- [ ] Zmiana destrukcyjna (drop/rename/typ) oznaczona i uzgodniona, nie przemycona
- [ ] Nowe kolumny filtrowane/sortowane mają indeks

### Mutacje
- [ ] Walidacja Zod przed dotknięciem bazy
- [ ] Sprawdzenie uprawnień przed mutacją (nie ma RLS!)
- [ ] `revalidatePath` / `revalidateTag` po zapisie
- [ ] Błąd bazy nie leci do klienta w surowej postaci

---

## Obsługa błędów i logowanie

> To repo nie ma zewnętrznego error trackingu (brak Sentry). Sygnałem są logi Vercela, logi dev servera i konsola przeglądarki.

### Obsługa
- [ ] Zero pustych `catch {}` — log albo re-throw
- [ ] Guard clauses na górze funkcji, happy path na końcu
- [ ] Typowane błędy (`AppError`-like), nie `throw "string"`
- [ ] Server Action / route handler zwraca ustandaryzowany kształt `{ data, error: { code, message } }`

### Granice UI
- [ ] `error.tsx` w segmencie, którego crash nie powinien wywalić całej strony
- [ ] `not-found.tsx` dla ścieżek po nieistniejącym rekordzie
- [ ] Fallback UI zamiast pustego ekranu przy błędzie danych

### Logi
- [ ] Brak `console.log` z PII, tokenami, treścią maila (`no-console: warn` to sygnał, nie ochrona)
- [ ] Komunikat dla użytkownika ≠ treść błędu technicznego
- [ ] Log zawiera kontekst potrzebny do diagnozy (route, locale, id operacji)

---

## Data fetching (RSC / Server Actions)

> W tym repo nie ma React Query. Dane pobiera Server Component przez `@/lib/queries`, mutacje idą przez Server Actions.

### Pobieranie
- [ ] Dane pobierane w Server Component, nie przez `useEffect` + `fetch` do własnego API
- [ ] `'use client'` tylko gdy komponent potrzebuje stanu / efektów / event handlerów
- [ ] Brak sekretów i pełnych rekordów w props przekazywanych do Client Component
- [ ] Cache / `revalidate` świadomie ustawione tam, gdzie dane się zmieniają

### Mutacje
- [ ] Mutacja z UI tego repo → Server Action (`_actions.ts`); endpoint dla zewnętrznych → route handler
- [ ] `revalidatePath` / `revalidateTag` po udanej mutacji
- [ ] `useTransition` / `useOptimistic` gdy UX tego wymaga
- [ ] Ta sama schema Zod po stronie serwera i w `zodResolver` formularza

### Stany
- [ ] Loading obsłużony (`loading.tsx` / `Suspense` / `isPending`)
- [ ] Error obsłużony (`error.tsx` / zwrócony `error` z akcji)
- [ ] Empty state obsłużony (pusta lista ≠ błąd)

---

## next-intl (i18n)

- [ ] `Link`, `useRouter`, `usePathname`, `redirect` z `@/i18n/navigation` (nie z `next/link` / `next/navigation`)
- [ ] Każdy nowy klucz obecny we **wszystkich** `messages/{pl,en,ru,uk}.json`
- [ ] Teksty przez `useTranslations()` (client) / `await getTranslations()` (server) — zero hardkodowanych stringów w UI
- [ ] Nowa lokalizowana ścieżka uwzględniona w `src/i18n/routing.ts` i (jeśli trzeba) w rewrite'ach `src/middleware.ts`
- [ ] Metadata (`title`, `description`) tłumaczona, nie zaszyta po polsku

---

## Tailwind CSS 3

> Wersja 3 z `tailwind.config.ts` — **nie** v4. Brak `@theme`, brak CSS-first config.

### Konfiguracja
- [ ] Tokeny (kolory, spacing, fonty) w `tailwind.config.ts` i zmiennych CSS w `src/app/globals.css`
- [ ] Dyrektywy `@tailwind base/components/utilities` obecne w `globals.css`
- [ ] Brak składni v4 (`@theme`, `@import "tailwindcss"`) — nie zadziała na v3

### Użycie
- [ ] Klasy warunkowe przez `cn()` z `@/lib/utilities` (uwaga: alias `@/lib/utils` z `components.json` nie istnieje)
- [ ] Warianty komponentu przez `cva`, nie przez sklejanie stringów
- [ ] Tokeny (`bg-primary`) zamiast hexów; wartości dowolne (`p-[18px]`) tylko gdy SPEC designu tak mówi
- [ ] Brak nadużywania `@apply` — powtórzenie klas jest lepsze niż warstwa abstrakcji w CSS
- [ ] Kolejność klas zgodna z `eslint-plugin-tailwindcss` (lint nie zgłasza `tailwindcss/classnames-order`)
- [ ] Dark mode przez `dark:` + `next-themes`, nie przez własny stan

---

## shadcn/ui / Radix UI

### Użycie
- [ ] Odpowiedni komponent (Dialog vs AlertDialog, etc.)
- [ ] Prawidłowa kompozycja (Root, Trigger, Content)
- [ ] Portal używany dla overlays

### Accessibility
- [ ] `aria-label` gdzie brak widocznego tekstu
- [ ] `aria-describedby` dla opisów
- [ ] Focus trap w modalach
- [ ] Escape zamyka overlay

### Styling
- [ ] `data-state` używane do stylowania stanów
- [ ] Animacje przez CSS/Tailwind
- [ ] Spójne z resztą UI

### Icons (Lucide)
- [ ] Spójny rozmiar (np. `size={20}`)
- [ ] `aria-hidden` lub `aria-label`
- [ ] Stroke width konsekwentny

---

## TypeScript

### Typy
- [ ] Brak `any` (użyj `unknown` jeśli trzeba)
- [ ] Interfejsy/typy eksportowane gdzie potrzeba
- [ ] Props komponentów typowane
- [ ] Return types dla funkcji (explicit lub inferred)

### Strict mode
- [ ] `strictNullChecks` respektowane
- [ ] Brak `!` (non-null assertion) bez uzasadnienia
- [ ] Optional chaining (`?.`) zamiast `&&`

### Imports
- [ ] Type imports (`import type { X }`)
- [ ] Brak circular dependencies
- [ ] Path aliases używane konsekwentnie (`@/`)

---

## Bezpieczeństwo

### Input
- [ ] Walidacja Zod na operacjach zapisu
- [ ] Sanityzacja danych użytkownika
- [ ] Parametryzowane zapytania (query builder Drizzle; brak konkatenacji w `sql`)
- [ ] Rate limiting na publicznych endpointach (Redis)

### Auth/Authz
- [ ] Sprawdzenie uprawnień na początku Server Action / route handlera (nie ma RLS — kod jest jedyną bramką)
- [ ] Zapytanie zawężone do zasobów wołającego, nie tylko po przekazanym ID (IDOR)
- [ ] Brak danych innych użytkowników w odpowiedzi i w props Client Component
- [ ] Sekrety wyłącznie w bloku `server` w `env.ts`; moduły z bazą mają `server-only`

### Secrets
- [ ] Brak hardcoded secrets
- [ ] Env variables przez `import.meta.env`
- [ ] `.env` w `.gitignore`

### Output
- [ ] Brak XSS (React domyślnie escapuje)
- [ ] `dangerouslySetInnerHTML` tylko z sanityzowanym contentem (DOMPurify)
- [ ] Error messages nie zdradzają internals

---

## Wydajność

### Bundle
- [ ] Dynamic imports dla dużych komponentów
- [ ] `React.lazy()` z `<Suspense fallback={...}>` dla lazy loading
- [ ] Tree shaking działa (named imports)

### Images
- [ ] `<img>` z `loading="lazy"` dla obrazów poniżej fold
- [ ] `fetchpriority="high"` dla obrazów above-the-fold (LCP)
- [ ] Width/height zdefiniowane (zapobieganie layout shift)
- [ ] Formaty next-gen (WebP/AVIF) gdzie możliwe

### Lists
- [ ] Wirtualizacja dla długich list (>100 items)
- [ ] Pagination/infinite scroll
- [ ] Stable keys

---

## Dostępność (a11y)

### Interactive elements
- [ ] Touch targets min 44x44px
- [ ] Focus visible (outline)
- [ ] Keyboard navigation działa

### Semantics
- [ ] Headings w hierarchii (h1 → h2 → h3)
- [ ] Landmarks (`main`, `nav`, `aside`)
- [ ] Labels dla form inputs

### ARIA
- [ ] `aria-label` dla icon buttons
- [ ] `aria-live` dla dynamicznych treści
- [ ] `role` gdzie semantyczny HTML nie wystarczy

### Visual
- [ ] Kontrast WCAG 2.2 AA (4.5:1 text, 3:1 UI)
- [ ] Nie tylko kolor przekazuje informację
- [ ] Animacje respektują `prefers-reduced-motion`
