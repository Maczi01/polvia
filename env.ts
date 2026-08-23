import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

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
        // Furtka awaryjna dla `db:drop` na zdalnej bazie. Ustawiana swiadomie
        // i na jedno wywolanie, nie w .env — patrz src/db/drop.ts.
        // Schemat jest przepuszczajacy CELOWO: scisle sprawdzenie ('yes') robi
        // drop.ts, zeby literowka we flagze dawala czytelna odmowe zamiast
        // stack trace'a z walidacji env.
        ALLOW_REMOTE_DROP: z.string().optional(),
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
        ALLOW_REMOTE_DROP: process.env.ALLOW_REMOTE_DROP,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    },
});