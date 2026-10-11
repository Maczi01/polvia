# Dodaj firmę z AI — kontekst

Branch: `feature/dodaj-firme-z-ai`
Worktree: `C:\Users\mateu\WebstormProjects\polvia-dodaj-firme-ai`
Ostatnia aktualizacja: 2026-10-11

## Źródła

- Requirements doc: `docs/brainstorms/2026-10-10-dodaj-firme-z-ai-requirements.md`
- Plan techniczny: `docs/plans/2026-10-11-001-feat-dodaj-firme-z-ai-plan.md`

## Powiązane pliki (istniejące)

| Plik | Rola w tym zadaniu |
|---|---|
| `src/db/service-input-schema.ts` | **Kontrakt wyjścia.** `serviceInputSchema` (strict; `local`/`hybrid` wymagają lat/lng; `openingHours` z kluczami `monday`…`sunday`), `buildServiceSlug`. Importowalny z app (brak `server-only` i `db`). |
| `src/db/add-service.ts` | CLI operatora `npm run db:add`. Nie zmieniamy. Konsumuje plik z maila. |
| `src/lib/categories.ts` | `CATEGORY_VALUES`, jedyne źródło kategorii. Enum w schemacie LLM. |
| `src/lib/category-contexts.ts` | `CATEGORY_CONTEXTS`, opisy kategorii w 4 językach do promptu. |
| `src/lib/semantic-relevance-judge.ts` (+ test) | Wzorzec OpenAI: wstrzykiwany klient, `json_schema strict`, `temperature: 0`, `maxRetries: 0`, typowane błędy, `safeParse`. |
| `src/lib/rate-limit.ts` (+ test) | `checkRateLimit`, `getClientIp`. Fixed window na ioredis. |
| `src/lib/redis.ts` | Singleton ioredis. W testach mock jak w `src/app/api/services/route.test.ts`. |
| `src/app/api/submit-contact-query/route.ts` | Transport Gmail. U7 przenosi go do `src/lib/mailer.ts`. |
| `src/lib/queries.ts` | `server-only`. U5 dodaje `findServiceByDomain`. |
| `src/lib/map-url-builder.ts` | `buildServiceUrl`, `localePathPrefix()`. Link do duplikatu bez hardkodu `/en`. |
| `src/app/[locale]/(main)/_components/service-card/service-card.tsx` | Wzorzec wizualny podglądu (777 linii, ma efekty uboczne, nie używamy wprost). |
| `src/app/[locale]/(dashboard)/dashboard/_service-schema.ts` (+ test) | `emptyToNull` + `z.preprocess` dla FormData. |
| `src/app/[locale]/(dashboard)/dashboard/_actions.ts` | `validateImage` (sharp), `useActionState`. Nie kopiujemy zapisu na dysk. |
| `src/app/[locale]/(header)/contact/page.tsx` | U10: CTA pod `<ContactForm />`. |
| `src/i18n/routing.ts` | U9: `pathnames['/add-business']`. |
| `next.config.ts` | U8: `experimental.serverActions.bodySizeLimit: '3mb'`. |
| `messages/{pl,en,ru,uk}.json` | Namespace `addBusiness` + klucz CTA. |
| `.claude/skills/dodaj/SKILL.md`, `references/klasyfikacja.md` | Reguły merytoryczne (fakty, opisy 300–600 znaków, zasięg, języki obsługi, kontrole geokodowania). Źródło dla promptu i `geocode.ts`. |

## Decyzje techniczne (skrót; pełne uzasadnienie w planie technicznym)

- **D1:** dwa kroki. Krok 1 to tylko link albo tryb ręczny. Logo, e-mail i uwagi są w kroku 2.
- **D2:** draft w Redis (`draftId`, TTL 2 h, jednorazowy GETDEL). Kategoria, zasięg, tagi i
  opisy przy submit pochodzą wyłącznie z Redis.
- **D3:** wynik waliduje `serviceInputSchema`. Brak lat/lng przy `local`/`hybrid` tylko
  flagowany w mailu.
- **D4:** fakty w kolejności JSON-LD > dosłownie w tekście źródła > `null` + `unconfirmed`.
- **D5:** prompt z `CATEGORY_CONTEXTS` + stała reguła zasięgu i języków. Bez kopii
  `klasyfikacja.md`.
- **D6:** Server Actions + `useActionState`, `maxDuration = 60` w `page.tsx`. Bez streamingu.
- **D7:** limity (24 h):

  | Klucz | Limit |
  |---|---|
  | `gen:<ip>` | 2, zużywane tuż przed LLM |
  | `gen:global` | 40 |
  | `fetch:<ip>` | 6 |
  | `submit:<ip>` | 2 |
  | relokacja | 10 na draft |

- **D8:** hosty social pomijają fetch i kierują do trybu ręcznego. Duplikaty sprawdzamy tylko
  dla własnych domen.
- **D9:** logo przez sharp: PNG/JPEG/WebP, ≤ 2 MB, PNG ≤ 512 px. Kandydat ze strony pobierany
  dopiero przy submit. Bez SVG.
- **D10:** pin jako statyczny obraz Mapbox + atrybucja. „Sprawdź na mapie” wywołuje
  `relocate`.
- **D11:** maile plain text przez `src/lib/mailer.ts` (Gmail). Do operatora z załącznikami i
  `replyTo`. Do właściciela w jego locale.
- **D12:** `business-card-preview` jako osobny komponent, klasy 1:1 z `service-card`.
- **D13:** ścieżka pl `/dodaj-firme`, en/ru/uk `/add-business`. Strona indeksowalna.
- **D14:** przypięty snapshot `gpt-4.1-mini`, `max_completion_tokens` ok. 3000.

## Zależności

- **Nowa:** `cheerio`, dokładna wersja (decyzja usera 2026-10-11). Guard SSRF bez biblioteki
  (undici `Agent` + własny lookup).
- **Istniejące:** `openai@^4.91`, `sharp@^0.34.5`, `nodemailer@^7`, `ioredis`, `zod@^3.24`,
  `slugify`.
- **Usługi zewnętrzne:**
  - OpenAI;
  - Nominatim (≤ 1 req/s, User-Agent, cache, atrybucja OSM);
  - Gmail SMTP;
  - Mapbox static images (publiczny token `pk.`).
- **Środowisko:** brak nowych zmiennych w `env.ts`.

## Wiedza instytucjonalna do przestrzegania

- FormData: `emptyToNull` + `z.preprocess`; bez `as string`; bez `?? 0`. Testy z polami `''`.
  (`docs/solutions/runtime-errors/2026-08-22-zod-coerce-number-puste-formdata.md`)
- Prefiks locale przez helper, test z asercją negatywną `/en`.
  (`docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md`)
- Gate przy zatrzymanym dev serverze. Nigdy `npm run build` obok `next dev`.
  (`docs/solutions/build-errors/2026-08-23-jest-worker-exceptions-rywalizacja-o-next.md`)
- Zależność ESM-only w Jest: `moduleNameMapper` na build CJS. Pusty `AggregateError` →
  `error.errors[0].message`.
  (`docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md`).
  Dotyczy też `cheerio`, jeśli w testach wejdzie wersja ESM.
- Pamięć projektu:
  - `DATABASE_URL` = produkcja; feature tylko czyta (duplikaty);
  - seed jest jedynym źródłem prawdy;
  - upload na Vercelu jest efemeryczny;
  - pracujemy w worktree, bez `git switch` w głównym katalogu.

## Otwarte (odroczone do implementacji)

- Dokładny prompt i schemat LLM — kształtowane na fixture'ach.
- Normalizacja telefonu przy porównaniu ze źródłem.
- Pełna lista hostów social.
- Czy `ipaddr.js` jest bezpośrednią zależnością. Przechodniej nie używamy.
- Czy `src/app/sitemap.ts` listuje strony statyczne. Jeśli tak, dopisać `/add-business`.
- Brak `docs/DESIGN.md`: UI opiera się na `service-card`, `contact-form` i shadcn/ui.
