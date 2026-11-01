/**
 * Konfiguracja Stripe z env: komplet pieciu zmiennych albo zadna (Stripe uspiony).
 *
 * Modul czysty (bez `env`, `server-only` i paczki `stripe`): czyta go `env.ts` przy starcie,
 * zeby czesciowa konfiguracja byla bledem walidacji, a nie cicho wylaczonym checkoutem.
 * Wylaczenie platnosci online = usuniecie WSZYSTKICH piatek w Vercelu; powrot = dodanie ich.
 */

export const STRIPE_ENV_KEYS = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_MONTHLY',
    'STRIPE_PRICE_YEARLY',
    'STRIPE_PORTAL_LOGIN_URL',
] as const;

export type StripeEnvKey = (typeof STRIPE_ENV_KEYS)[number];

export type StripeEnv = Partial<Record<StripeEnvKey, string | undefined>>;

export type StripeConfig = {
    secretKey: string;
    webhookSecret: string;
    priceMonthly: string;
    priceYearly: string;
    /** No-code login link do Customer Portal (Stripe Dashboard → Customer portal). */
    portalLoginUrl: string;
};

export class StripePartialConfigError extends Error {
    readonly code = 'STRIPE_PARTIAL_CONFIG';
    readonly missingKeys: readonly StripeEnvKey[];

    constructor(missingKeys: StripeEnvKey[]) {
        super(
            `Stripe: ustaw wszystkie zmienne ${STRIPE_ENV_KEYS.join(', ')} albo zadnej. ` +
                `Brakuje: ${missingKeys.join(', ')}`,
        );
        this.name = 'StripePartialConfigError';
        this.missingKeys = missingKeys;
    }
}

function isSet(value: string | undefined): value is string {
    return value !== undefined && value !== '';
}

/**
 * `null`: zadna zmienna nie jest ustawiona (platnosci online wylaczone). Czesc ustawiona,
 * czesc nie: `StripePartialConfigError` — polowiczna konfiguracja to zawsze pomylka.
 */
export function resolveStripeConfig(vars: StripeEnv): StripeConfig | null {
    const {
        STRIPE_SECRET_KEY: secretKey,
        STRIPE_WEBHOOK_SECRET: webhookSecret,
        STRIPE_PRICE_MONTHLY: priceMonthly,
        STRIPE_PRICE_YEARLY: priceYearly,
        STRIPE_PORTAL_LOGIN_URL: portalLoginUrl,
    } = vars;

    if (
        isSet(secretKey) &&
        isSet(webhookSecret) &&
        isSet(priceMonthly) &&
        isSet(priceYearly) &&
        isSet(portalLoginUrl)
    ) {
        return { secretKey, webhookSecret, priceMonthly, priceYearly, portalLoginUrl };
    }

    const missingKeys = STRIPE_ENV_KEYS.filter(key => !isSet(vars[key]));
    if (missingKeys.length === STRIPE_ENV_KEYS.length) return null;

    throw new StripePartialConfigError(missingKeys);
}
