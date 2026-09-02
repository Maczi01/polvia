# Common Issues

Częste błędy w projekcie Next.js 15 (App Router) + React 19 + Tailwind v3 + Drizzle/Postgres + next-intl, z przykładami.

---

## React 19

### 1. Używanie forwardRef (przestarzałe)

**Problem:** W React 19 `ref` to zwykły prop.
```typescript
// ❌ Źle — niepotrzebne forwardRef
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});

// ✅ Dobrze — ref jako prop
function Input({ ref, ...props }: InputProps & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

### 2. Używanie Context.Provider (przestarzałe)

**Problem:** W React 19 można używać `<Context>` bezpośrednio.
```typescript
// ❌ Źle — stary sposób
<ThemeContext.Provider value={theme}>
  <App />
</ThemeContext.Provider>

// ✅ Dobrze — nowy sposób
<ThemeContext value={theme}>
  <App />
</ThemeContext>
```

### 3. useEffect do fetchowania danych

**Problem:** `useEffect` + `useState` do fetch — brak cache, dedup, retry, obsługi race conditions.
```typescript
// ❌ Źle — useEffect + useState
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <div>{user?.name}</div>;
}
```
```tsx
// ✅ Dobrze — Server Component pobiera dane bezpośrednio (bez API, bez spinnera w kliencie)
export default async function UserProfile({ userId }: Props) {
  const user = await getUserPublicProfile(userId);   // z src/lib/queries.ts ('server-only')
  if (!user) return <NotFoundCard />;
  return <div>{user.name}</div>;
}

// ✅ Dobrze — ładowanie i błąd obsłużone przez konwencje App Routera
// app/[locale]/(main)/profile/loading.tsx  → skeleton
// app/[locale]/(main)/profile/error.tsx    → fallback z reset()

// ✅ Gdy dane MUSZĄ przyjść po interakcji w kliencie — Server Action + useTransition
'use client';
function Filters() {
  const [isPending, startTransition] = useTransition();
  return (
    <button disabled={isPending} onClick={() => startTransition(() => applyFilter('health'))}>
      Zdrowie
    </button>
  );
}
```

### 4. Brak useOptimistic dla lepszego UX

**Problem:** UI czeka na odpowiedź serwera.
```typescript
// ❌ Źle — czekanie na mutację
function LikeButton({ postId, likes }: Props) {
  const [isPending, startTransition] = useTransition();

  async function handleLike() {
    startTransition(async () => {
      await likePost(postId);
    });
  }

  return (
    <button onClick={handleLike} disabled={isPending}>
      ❤️ {likes} {isPending && "(...)"}
    </button>
  );
}
```
```typescript
// ✅ Dobrze — optimistic update
function LikeButton({ postId, likes }: Props) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    likes,
    (current) => current + 1
  );

  async function handleLike() {
    addOptimisticLike(null); // natychmiast +1
    await likePost(postId);  // w tle
  }

  return (
    <button onClick={handleLike}>
      ❤️ {optimisticLikes}
    </button>
  );
}
```

> **Nota:** W tym repo nie ma React Query — `useOptimistic` używaj razem z Server Action (form action / `startTransition`), a rollback dzieje się automatycznie, gdy akcja zwróci błąd.

### 5. Manualne zarządzanie stanem loading w formularzach

**Problem:** Manualne zarządzanie stanem loading zamiast użycia API frameworka.
```typescript
// ❌ Źle — manualne śledzenie
function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button disabled={isSubmitting}>
      {isSubmitting ? "Wysyłanie..." : "Wyślij"}
    </button>
  );
}

// ✅ Dobrze (preferowane) — React Hook Form
function SubmitButton() {
  const { formState: { isSubmitting } } = useFormContext();
  return (
    <button type="submit" disabled={isSubmitting}>
      {isSubmitting ? "Wysyłanie..." : "Wyślij"}
    </button>
  );
}

// ✅ Dobrze (alternatywa) — useFormStatus dla native form actions
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending}>
      {pending ? "Wysyłanie..." : "Wyślij"}
    </button>
  );
}
```

> **Nota:** W projektach z React Hook Form używaj `formState.isSubmitting`. `useFormStatus` działa z native `<form action={}>` i jest alternatywą dla prostych formularzy bez RHF.

---

## Drizzle / Postgres

### 1. `update` / `delete` bez `where`

**Problem:** jedna linia kasuje całą tabelę. `eslint-plugin-drizzle` to wyłapuje — dopóki ktoś nie wyciszy reguły.
```typescript
// ❌ Źle
await db.delete(servicesTable);

// ✅ Dobrze — where + returning do weryfikacji zasięgu
const deleted = await db
    .delete(servicesTable)
    .where(eq(servicesTable.id, id))
    .returning({ id: servicesTable.id });

if (deleted.length === 0) return { error: { code: 'NOT_FOUND', message: 'Nie znaleziono' } };
```

---

### 2. Brak walidacji przed zapisem

**Problem:** dane z formularza / requesta lądują w bazie bez walidacji; rzutowanie `as` udaje typ.
```typescript
// ❌ Źle
export async function createService(input: any) {
    await db.insert(servicesTable).values(input);
}

// ✅ Dobrze — schema Zod na granicy, enum z bazy jako źródło wartości
const schema = z.object({
    name: z.string().min(1).max(255),
    category: z.enum(categoryEnum.enumValues),
});

export async function createService(input: unknown) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: { code: 'BAD_INPUT', message: 'Nieprawidłowe dane' } };

    await db.insert(servicesTable).values(parsed.data);
}
```

---

### 3. Konkatenacja user inputu w surowym SQL

**Problem:** SQL injection. Query builder parametryzuje, `sql.raw` ze stringiem — nie.
```typescript
// ❌ Źle
await db.execute(sql.raw(`select * from services where name ilike '%${q}%'`));

// ✅ Dobrze — placeholder
await db
    .select({ id: servicesTable.id, name: servicesTable.name })
    .from(servicesTable)
    .where(sql`${servicesTable.name} ilike ${`%${q}%`}`);
```

---

### 4. Brak `revalidatePath` po mutacji

**Problem:** zapis się udał, UI pokazuje stare dane — wygląda jak bug zapisu.
```typescript
// ❌ Źle
await db.update(servicesTable).set(values).where(eq(servicesTable.id, id));
return { data: { ok: true } };

// ✅ Dobrze
await db.update(servicesTable).set(values).where(eq(servicesTable.id, id));
revalidatePath('/dashboard');
revalidatePath(`/mapa/${values.slug}`);
return { data: { ok: true } };
```

---

### 5. Query poza warstwą danych

**Problem:** `db` wołane w komponencie lub route handlerze — logika zapytań rozlewa się po repo, nie da się jej przetestować ani zoptymalizować w jednym miejscu.
```typescript
// ❌ Źle — komponent zna schemat bazy
export default async function Page() {
    const rows = await db.select().from(servicesTable);
    return <List items={rows} />;
}

// ✅ Dobrze — query w src/lib/queries.ts (z 'server-only'), komponent woła funkcję
export default async function Page({ params }: Props) {
    const services = await getServices(params.locale);
    return <List items={services} />;
}
```

---

## Obsługa błędów i logowanie

> To repo nie ma Sentry ani innego error trackingu. Sygnał: logi Vercela, logi dev servera, konsola przeglądarki.

### 1. Połykanie błędów

**Problem:** puste `catch` zamienia awarię w ciszę — użytkownik widzi pusty ekran, nikt nie wie dlaczego.
```typescript
// ❌ Źle
try {
    await sendNewsletter(email);
} catch {}

// ✅ Dobrze — log z kontekstem + zwrócony błąd dla UI
try {
    await sendNewsletter(email);
} catch (error) {
    console.error('[newsletter] wysyłka nieudana', { locale, cause: String(error) });
    return { error: { code: 'MAIL_FAILED', message: 'Nie udało się zapisać. Spróbuj ponownie.' } };
}
```

---

### 2. Dane wrażliwe w logach

**Problem:** log z całym `formData` zapisuje e-mail i treść wiadomości do logów platformy.
```typescript
// ❌ Źle
console.log('kontakt', formData);

// ✅ Dobrze — loguj fakt i identyfikator, nie zawartość
console.info('[kontakt] zgłoszenie przyjęte', { topicLength: topic.length, hasMessage: message.length > 0 });
```

---

### 3. Surowy błąd bazy w odpowiedzi

**Problem:** treść błędu Postgresa zdradza schemat (nazwy tabel, kolumn, constraintów).
```typescript
// ❌ Źle
catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
}

// ✅ Dobrze — log techniczny na serwerze, komunikat ogólny dla klienta
catch (error) {
    console.error('[api/services] zapytanie nieudane', { cause: String(error) });
    return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Coś poszło nie tak' } },
        { status: 500 },
    );
}
```

---

### 4. Brak granicy błędu w UI

**Problem:** wyjątek w jednym segmencie wywala całą stronę.
```tsx
// ✅ Dobrze — error.tsx przy segmencie, który może paść (mapa, lista z fetchem)
'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
    return (
        <div role="alert">
            <p>Nie udało się załadować tej sekcji.</p>
            <button onClick={reset}>Spróbuj ponownie</button>
        </div>
    );
}
```

---

## Tailwind CSS 3

> Wersja 3 z `tailwind.config.ts`. Składnia v4 (`@theme`, `@import "tailwindcss"`) tu nie działa.

### 1. Nadużywanie `@apply`

**Problem:** klasy przenoszone do CSS tracą czytelność i lokalność; zmiana w jednym miejscu psuje drugie.
```css
/* ❌ Źle */
.card { @apply rounded-lg border bg-card p-6 shadow-sm; }
```
```tsx
/* ✅ Dobrze — klasy w komponencie, warianty przez cva */
<div className="rounded-lg border bg-card p-6 shadow-sm" />
```

---

### 2. Hexy zamiast tokenów

**Problem:** kolor spoza systemu designu nie reaguje na dark mode i rozjeżdża się z resztą UI.
```tsx
// ❌ Źle
<button className="bg-[#3B82F6] text-white" />

// ✅ Dobrze — token z tailwind.config.ts / zmiennej CSS
<button className="bg-primary text-primary-foreground" />
```

Wartość dowolna (`p-[18px]`) jest OK, gdy SPEC designu podaje konkretny pomiar.

---

### 3. Sklejanie klas bez `cn()`

**Problem:** konflikty klas Tailwinda rozstrzyga kolejność w CSS, nie w stringu — bez `twMerge` warunkowa klasa może nie zadziałać.
```tsx
// ❌ Źle
<div className={`p-4 ${isActive ? 'p-6' : ''}`} />

// ✅ Dobrze — cn() z @/lib/utilities (clsx + twMerge)
<div className={cn('p-4', isActive && 'p-6')} />
```

---

## Radix UI

### 1. Brak aria-label dla icon buttons

**Problem:** Niedostępne dla screen readers.
```typescript
// ❌ Źle — brak opisu
<Button>
  <TrashIcon />
</Button>

// ✅ Dobrze — aria-label
<Button aria-label="Usuń element">
  <TrashIcon aria-hidden />
</Button>
```

### 2. Brak Portal dla overlays

**Problem:** Z-index issues, clipping.
```typescript
// ❌ Źle — bez Portal
<Dialog.Content className="...">
  Modal content
</Dialog.Content>

// ✅ Dobrze — z Portal
<Dialog.Portal>
  <Dialog.Overlay className="..." />
  <Dialog.Content className="...">
    Modal content
  </Dialog.Content>
</Dialog.Portal>
```

> **Nota:** Komponenty shadcn/ui (Dialog, Popover, DropdownMenu) automatycznie używają Portal. Ten issue dotyczy raw Radix UI.

### 3. Niespójne rozmiary ikon

**Problem:** Ikony różnej wielkości.
```typescript
// ❌ Źle — różne rozmiary
<HomeIcon />                    // default
<SettingsIcon size={24} />      // 24px
<UserIcon className="w-6 h-6" /> // 24px ale inaczej

// ✅ Dobrze — spójny system
const ICON_SIZE = 20;

<HomeIcon size={ICON_SIZE} />
<SettingsIcon size={ICON_SIZE} />
<UserIcon size={ICON_SIZE} />

// lub wrapper
function Icon({ icon: IconComponent, size = 20 }: Props) {
  return <IconComponent size={size} aria-hidden />;
}
```

---

## Bezpieczeństwo

### 1. Brak walidacji danych wejściowych

**Problem:** wejście z requesta / formularza używane bez schemy.
```typescript
// ❌ Źle
export async function createPost(input: any) {
    await db.insert(postsTable).values(input);
}

// ✅ Dobrze — Zod na granicy, guard clause przed operacją
const schema = z.object({ title: z.string().min(1).max(200), body: z.string().min(1) });

export async function createPost(input: unknown) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: { code: 'BAD_INPUT', message: 'Nieprawidłowe dane' } };

    await db.insert(postsTable).values(parsed.data);
}
```

---

### 2. Wyciek danych server → client

**Problem:** props przekazane z Server do Client Component trafiają do HTML strony — cały rekord jest publiczny, nawet gdy UI go nie renderuje.
```tsx
// ❌ Źle — cały rekord w props
const user = await getUserById(id);          // select() bez kolumn
return <ProfileCard user={user} />;

// ✅ Dobrze — query zwraca tylko to, co UI pokazuje
const user = await getUserPublicProfile(id); // select({ id, name, avatarUrl })
return <ProfileCard user={user} />;
```

---

### 3. Mutacja bez sprawdzenia uprawnień

**Problem:** Server Action to publiczny endpoint POST. Nie ma RLS — jeśli funkcja nie sprawdzi uprawnień, nikt tego nie zrobi. Ukryty przycisk w UI nie jest zabezpieczeniem.
```typescript
// ❌ Źle — kto zna kształt akcji, ten usuwa cudze dane
'use server';
export async function deletePost(id: number) {
    await db.delete(postsTable).where(eq(postsTable.id, id));
}

// ✅ Dobrze — bramka uprawnień + zawężenie zapytania do właściciela
'use server';
export async function deletePost(input: unknown) {
    const actor = await requireDashboardAccess();
    if (!actor) return { error: { code: 'FORBIDDEN', message: 'Brak uprawnień' } };

    const parsed = z.object({ id: z.coerce.number().int().positive() }).safeParse(input);
    if (!parsed.success) return { error: { code: 'BAD_INPUT', message: 'Nieprawidłowe dane' } };

    const deleted = await db
        .delete(postsTable)
        .where(and(eq(postsTable.id, parsed.data.id), eq(postsTable.authorId, actor.id)))
        .returning({ id: postsTable.id });

    if (deleted.length === 0) return { error: { code: 'NOT_FOUND', message: 'Nie znaleziono' } };

    revalidatePath('/dashboard');
    return { data: { id: deleted[0].id } };
}
```

> Uwaga: `requireDashboardAccess()` w tym repo **nie istnieje** — dashboard nie ma dziś warstwy auth. Brak bramki zgłaszaj jako finding z rekomendacją, gdzie ma stanąć, nie jako „TODO na później".

---

### 4. Sekret dostępny w przeglądarce

**Problem:** wszystko z `NEXT_PUBLIC_*` i wszystko w bloku `client` w `env.ts` jest w bundlu.
```typescript
// ❌ Źle
client: { NEXT_PUBLIC_OPENAI_API_KEY: NonEmpty }

// ✅ Dobrze
server: { OPENAI_API_KEY: NonEmpty }
client: { NEXT_PUBLIC_SITE_URL: NonEmpty }
```
Dodatkowo: moduł czytający bazę lub sekrety ma `import 'server-only'` — bez tego jeden import z Client Component wciąga go do bundla.

---

## TypeScript

### 1. Używanie `any`

**Problem:** Brak type safety.
```typescript
// ❌ Źle
function processData(data: any) {
  return data.value.nested.property; // może crashnąć
}

// ✅ Dobrze
interface DataPayload {
  value: {
    nested: {
      property: string;
    };
  };
}

function processData(data: DataPayload) {
  return data.value.nested.property;
}

// lub unknown + type guard
function processData(data: unknown) {
  if (isDataPayload(data)) {
    return data.value.nested.property;
  }
  throw new Error("Invalid data format");
}
```

---

## Data fetching (RSC / Server Actions)

> W tym repo nie ma React Query. Dane pobiera Server Component przez `@/lib/queries`, mutacje idą przez Server Actions.

### 1. Fetch w `useEffect` zamiast Server Component

**Problem:** własne API tylko po to, żeby klient pobrał dane, które serwer miał już w ręku — dodatkowy round-trip, spinner, race conditions.
```tsx
// ❌ Źle — Client Component fetchuje własny endpoint
'use client';
function Services() {
    const [items, setItems] = useState<Service[]>([]);
    useEffect(() => {
        fetch('/api/services').then(r => r.json()).then(setItems);
    }, []);
    return <List items={items} />;
}

// ✅ Dobrze — Server Component pobiera dane bezpośrednio
export default async function Services({ params }: Props) {
    const items = await getServices(params.locale);
    return <List items={items} />;
}
```

Klient fetchuje tylko wtedy, gdy dane zależą od interakcji (filtry, paginacja bez nawigacji) — wtedy przez Server Action lub route handler z jasnym kontraktem.

---

### 2. Brak rewalidacji po mutacji

**Problem:** dane zapisane, widok stary. Wygląda jak nieudany zapis.
```typescript
// ✅ Dobrze — po mutacji rewaliduj każdą ścieżkę, która pokazuje te dane
revalidatePath('/dashboard');
revalidatePath('/mapa');
```

---

### 3. Brak obsługi stanów loading / error / empty

**Problem:** przy wolnym zapytaniu strona wisi, przy błędzie pada, przy pustej liście pokazuje nic.
```tsx
// ✅ Dobrze — loading.tsx / Suspense dla ładowania, error.tsx dla błędu,
//    pusty stan jawnie w komponencie
export default async function Page() {
    const items = await getServices();
    if (items.length === 0) return <EmptyState />;
    return <List items={items} />;
}
```

---

## React Hook Form + Zod

### 1. Manualna walidacja zamiast zodResolver

**Problem:** Duplikacja logiki walidacji, niespójne komunikaty błędów.
```typescript
// ❌ Źle — manualna walidacja
function ContactForm() {
  const { register, handleSubmit, setError } = useForm();

  const onSubmit = (data: any) => {
    if (!data.email.includes("@")) {
      setError("email", { message: "Nieprawidłowy email" });
      return;
    }
    if (data.name.length < 2) {
      setError("name", { message: "Imię za krótkie" });
      return;
    }
    // ...
  };
}
```
```typescript
// ✅ Dobrze — zodResolver
import { zodResolver } from "@hookform/resolvers/zod";

const contactSchema = z.object({
  name: z.string().min(2, "Imię musi mieć min. 2 znaki"),
  email: z.string().email("Nieprawidłowy email"),
  message: z.string().min(10, "Wiadomość musi mieć min. 10 znaków"),
});

type ContactFormData = z.infer<typeof contactSchema>;

function ContactForm() {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = (data: ContactFormData) => {
    // data jest już zwalidowane i typowane
  };
}
```

### 2. Brak obsługi błędów serwera w formularzu

**Problem:** Błędy API nie są mapowane na pola formularza.
```typescript
// ❌ Źle — brak mapowania błędów API
const onSubmit = async (data: FormData) => {
  try {
    await createUser(data);
  } catch (e) {
    toast.error("Coś poszło nie tak"); // generyczny komunikat
  }
};
```
```typescript
// ✅ Dobrze — mapowanie błędów API na pola
const onSubmit = async (data: FormData) => {
  try {
    await createUser(data);
    toast.success("Użytkownik utworzony!");
  } catch (e) {
    if (e instanceof ApiError && e.fieldErrors) {
      // mapowanie błędów serwera na pola formularza
      for (const [field, message] of Object.entries(e.fieldErrors)) {
        form.setError(field as keyof FormData, { message });
      }
    } else {
      form.setError("root", {
        message: "Nie udało się zapisać. Spróbuj ponownie.",
      });
    }
  }
};
```

---

## Race Conditions w React

### 1. useEffect bez cleanup (brak AbortController)

**Problem:** Komponent odmontowany w trakcie fetcha — state update na odmontowanym komponencie, memory leak.
```typescript
// ❌ Źle — brak cleanup
useEffect(() => {
  fetch(`/api/users/${userId}`)
    .then((res) => res.json())
    .then(setUser); // crash jeśli komponent odmontowany
}, [userId]);
```
```typescript
// ✅ Dobrze — AbortController w cleanup
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((res) => res.json())
    .then(setUser)
    .catch((err) => {
      if (err.name !== "AbortError") throw err;
    });

  return () => controller.abort();
}, [userId]);
```

> **Nota:** W tym repo dane pobiera Server Component — jeśli piszesz `useEffect` + `fetch`, najpierw sprawdź, czy nie da się tego zrobić po stronie serwera. `AbortController` dotyczy tylko realnie klienckich strumieni (np. autocomplete).

### 2. setTimeout/setInterval bez cleanup

**Problem:** Timer wykonuje się po odmontowaniu komponentu — state update na ghost component.
```typescript
// ❌ Źle — brak cleanup
useEffect(() => {
  const id = setInterval(() => {
    setCount((c) => c + 1);
  }, 1000);
  // brak clearInterval!
}, []);
```
```typescript
// ✅ Dobrze — cleanup w return
useEffect(() => {
  const id = setInterval(() => {
    setCount((c) => c + 1);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

### 3. Wiele booleanów zamiast state machine

**Problem:** Kombinatoryczna eksplozja stanów — można mieć `isLoading: true` i `isError: true` jednocześnie.
```typescript
// ❌ Źle — niezależne booleany
const [isLoading, setIsLoading] = useState(false);
const [isError, setIsError] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);
// 8 możliwych kombinacji, większość nieprawidłowa!
```
```typescript
// ✅ Dobrze — discriminated union
type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };

const [state, setState] = useState<FetchState<User>>({ status: "idle" });

// Użycie — TypeScript gwarantuje poprawny dostęp
if (state.status === "success") {
  return <div>{state.data.name}</div>;
}
```

> **Nota:** Dla akcji serwerowych `useTransition` daje `isPending`, a wynik akcji nieś jako discriminated union (`{ data } | { error }`) — zamiast trzech osobnych booleanów.

### 4. Brak guardu na mutually exclusive operations

**Problem:** User klika 5 razy "Załaduj" — 5 równoległych requestów, wyścig o to który finish ostatni.
```typescript
// ❌ Źle — brak guardu
async function handleLoad() {
  setIsLoading(true);
  const data = await fetchData(); // 5 równoległych!
  setData(data); // ostatni wygrywa, niekoniecznie najnowszy
  setIsLoading(false);
}
```
```typescript
// ✅ Dobrze — guard z flagą stanu
const [status, setStatus] = useState<"idle" | "loading">("idle");

async function handleLoad() {
  if (status === "loading") return; // guard
  setStatus("loading");
  try {
    const data = await fetchData();
    setData(data);
  } finally {
    setStatus("idle");
  }
}
```

### 5. Brak cleanup dla subscriptions

**Problem:** Memory leak — strumień / listener żyje po odmontowaniu komponentu.
```typescript
// ❌ Źle — brak zamknięcia strumienia
useEffect(() => {
  const source = new EventSource('/api/services/stream');
  source.addEventListener('message', handleChange);
  // brak cleanup!
}, []);
```
```typescript
// ✅ Dobrze — zamknięcie w cleanup
useEffect(() => {
  const source = new EventSource('/api/services/stream');
  source.addEventListener('message', handleChange);

  return () => {
    source.removeEventListener('message', handleChange);
    source.close();
  };
}, []);
```
To samo dotyczy `IntersectionObserver`, `MutationObserver`, `matchMedia` i listenerów `window` — w tym repo hooki `use-media-query`, `use-layout-change` i `use-scrollable-list-handle` są wzorcem do naśladowania.

---

## Performance

### 1. N+1 query w pętli

**Problem:** Zapytanie do bazy w pętli — 100 iteracji = 100 round-tripów do Postgresa.
```typescript
// ❌ Źle — zapytanie w pętli
async function getServicesWithTags(serviceIds: number[]) {
    const result = [];
    for (const id of serviceIds) {
        const rows = await db
            .select()
            .from(servicesTable)
            .where(eq(servicesTable.id, id));
        result.push(rows[0]);
    }
    return result;
}
```
```typescript
// ✅ Dobrze — jedno zapytanie z inArray + join
async function getServicesWithTags(serviceIds: number[]) {
    return db
        .select({
            id: servicesTable.id,
            name: servicesTable.name,
            tag: tagsTable.name,
        })
        .from(servicesTable)
        .leftJoin(servicesTagsTable, eq(servicesTagsTable.serviceId, servicesTable.id))
        .leftJoin(tagsTable, eq(tagsTable.id, servicesTagsTable.tagId))
        .where(inArray(servicesTable.id, serviceIds));
}
```

### 2. Brak lazy loading dla dużych komponentów

**Problem:** Cały bundle ładowany upfront — wolny initial load.
```typescript
// ❌ Źle — static import dużego komponentu
import { HeavyChart } from "@/components/heavy-chart";
import { AdminPanel } from "@/components/admin-panel";

function App() {
  return (
    <div>
      <HeavyChart />
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```
```typescript
// ✅ Dobrze — lazy loading z Suspense
import { lazy, Suspense } from "react";

const HeavyChart = lazy(() => import("@/components/heavy-chart"));
const AdminPanel = lazy(() => import("@/components/admin-panel"));

function App() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart />
      </Suspense>
      {isAdmin && (
        <Suspense fallback={<PanelSkeleton />}>
          <AdminPanel />
        </Suspense>
      )}
    </div>
  );
}
```

### 3. select("*") zamiast konkretnych kolumn

**Problem:** Transfer niepotrzebnych danych — wolniejsze zapytania, większy payload, a przy props Client Component także wyciek pól do HTML.
```typescript
// ❌ Źle — cały rekord (może zawierać JSON, embeddingi, dane wewnętrzne)
const rows = await db.select().from(servicesTable);

// ✅ Dobrze — wypisane kolumny
const rows = await db
    .select({
        id: servicesTable.id,
        name: servicesTable.name,
        slug: serviceLocationsTable.slug,
    })
    .from(servicesTable)
    .innerJoin(serviceLocationsTable, eq(serviceLocationsTable.serviceId, servicesTable.id));
```

---

### 2. Brak typów dla props

**Problem:** Niejasne API komponentu.
```typescript
// ❌ Źle
function UserCard({ user, onEdit, showActions }) {
  // co to są za typy?
}

// ✅ Dobrze
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  showActions?: boolean;
}

function UserCard({ user, onEdit, showActions = true }: UserCardProps) {
  // jasne API
}
```

### 3. Non-null assertion bez uzasadnienia

**Problem:** Potencjalny runtime crash.
```typescript
// ❌ Źle — ślepe !
const user = users.find((u) => u.id === id)!;
console.log(user.name); // crash jeśli nie znaleziono

// ✅ Dobrze — explicit handling
const user = users.find((u) => u.id === id);
if (!user) {
  throw new Error(`User ${id} not found`);
}
console.log(user.name);
```
