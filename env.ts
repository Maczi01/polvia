import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { resolveStripeConfig } from "./src/lib/stripe-config";

const NonEmpty = z.string().min(1);

export const env = createEnv({
    server: {
        DATABASE_URL: NonEmpty,
        REDIS_URL: NonEmpty,
        OPENAI_API_KEY: NonEmpty,
        CONVERT_KIT_API_KEY: NonEmpty,
        CONVERT_KIT_FORM_ID: NonEmpty,
        CLARITY_PROJECT_ID: NonEmpty,
        MY_GMAIL: NonEmpty,
        MY_GMAIL_PASSWORD: NonEmpty,
        RESEND_API_KEY: NonEmpty,
        // Furtka awaryjna dla `db:drop` na zdalnej bazie. Ustawiana swiadomie
        // i na jedno wywolanie, nie w .env — patrz src/db/drop.ts.
        // Schemat jest przepuszczajacy CELOWO: scisle sprawdzenie ('yes') robi
        // drop.ts, zeby literowka we flagze dawala czytelna odmowe zamiast
        // stack trace'a z walidacji env.
        ALLOW_REMOTE_DROP: z.string().optional(),
        // Wspolny sekret middleware i `GET /api/service-slug/<slug>`: lookup z middleware
        // idzie bez limitu po IP (na Vercelu wszystkie takie zapytania maja jeden adres
        // wychodzacy). Bez sekretu zadanie jest publiczne i dostaje limit po IP klienta.
        // Losowy, min. 32 znaki: `openssl rand -hex 32`.
        SERVICE_SLUG_LOOKUP_SECRET: z.string().min(32),
        // Stripe (premium) — OPCJONALNY, ale wszystkie piec albo zadna (sprawdza
        // `resolveStripeConfig` ponizej). Bez nich platnosci online sa wylaczone: checkout,
        // webhook, `premium/dziekujemy` i `db:sync-subscriptions` nie dzialaja, a „Przejdz na
        // Premium” prowadzi do formularza kontaktowego (premium reczne, `premium.activeUntil`).
        // Sekretny klucz API (`sk_…` albo ograniczony `rk_…`) i sekret podpisu webhooka —
        // wylacznie serwer. Ceny planu zyja w Stripe Dashboard; kod zna tylko ich ID.
        STRIPE_SECRET_KEY: NonEmpty.optional(),
        STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
        STRIPE_PRICE_MONTHLY: z.string().startsWith('price_').optional(),
        STRIPE_PRICE_YEARLY: z.string().startsWith('price_').optional(),
        // No-code login link do Customer Portal (Stripe Dashboard → Customer portal).
        STRIPE_PORTAL_LOGIN_URL: z.string().url().optional(),
        // Panel `/dashboard` (HTTP Basic Auth, `src/lib/dashboard-auth.ts`). Bez ktorejkolwiek
        // panel jest WYLACZONY (404) — fail-closed. Haslo ASCII, min. 32 znaki: `openssl rand -hex 32`.
        DASHBOARD_USER: NonEmpty.optional(),
        DASHBOARD_PASSWORD: z.string().min(32).optional(),
        // Autoryzacja crona usuwajacego stare zgloszenia (Vercel wysyla ja w Authorization).
        // Bez niej cron niczego nie usuwa. Losowy, min. 32 znaki: `openssl rand -hex 32`.
        CRON_SECRET: z.string().min(32).optional(),
    },
    client: {
        NEXT_PUBLIC_SITE_URL: NonEmpty,
    },
    // If you're using Next.js < 13.4.4, you'll need to specify the runtimeEnv manually
    runtimeEnv: {
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        CONVERT_KIT_API_KEY: process.env.CONVERT_KIT_API_KEY,
        CONVERT_KIT_FORM_ID: process.env.CONVERT_KIT_FORM_ID,
        CLARITY_PROJECT_ID: process.env.CLARITY_PROJECT_ID,
        MY_GMAIL: process.env.MY_GMAIL,
        MY_GMAIL_PASSWORD: process.env.MY_GMAIL_PASSWORD,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        ALLOW_REMOTE_DROP: process.env.ALLOW_REMOTE_DROP,
        SERVICE_SLUG_LOOKUP_SECRET: process.env.SERVICE_SLUG_LOOKUP_SECRET,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
        STRIPE_PRICE_YEARLY: process.env.STRIPE_PRICE_YEARLY,
        STRIPE_PORTAL_LOGIN_URL: process.env.STRIPE_PORTAL_LOGIN_URL,
        DASHBOARD_USER: process.env.DASHBOARD_USER,
        DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
        CRON_SECRET: process.env.CRON_SECRET,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    },
});

// Czesciowa konfiguracja Stripe (np. sam klucz bez sekretu webhooka) to blad przy starcie,
// a nie cicho wylaczone platnosci. Wersja 0.12 `createEnv` nie ma walidacji miedzy polami.
// Tylko na serwerze: w przegladarce odczyt zmiennej `server` z proxy `env` rzuca, wiec
// pierwszy komponent kliencki importujacy `env` wywalilby hydratacje calej strony.
if (typeof window === 'undefined') resolveStripeConfig(env);
