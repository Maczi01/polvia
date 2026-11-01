/**
 * Pola, limity i kontrakt wynikow checkoutu premium oraz formularza materialow.
 *
 * Modul bez importow runtime'owych: czytaja go komponenty klienckie (`upgrade-cta`,
 * `premium-materials-form`), a schemat zod (`_checkout-schema.ts`) go reeksportuje.
 * Klient nie moze wciagac zoda ani `src/db`.
 */

/** Interwal subskrypcji wybierany na profilu. Cene wybiera serwer z allowlisty env. */
export const PREMIUM_INTERVALS = ['monthly', 'yearly'] as const;

export type PremiumInterval = (typeof PREMIUM_INTERVALS)[number];

export const PREMIUM_MATERIALS_TEXT_FIELDS = ['priceList', 'faq', 'notes'] as const;

export type PremiumMaterialsTextField = (typeof PREMIUM_MATERIALS_TEXT_FIELDS)[number];

/** Gorne limity znakow: chronia skrzynke foundera przed mailem bez konca. */
export const PREMIUM_MATERIALS_MAX_LENGTH: Record<PremiumMaterialsTextField, number> = {
    priceList: 4000,
    faq: 4000,
    notes: 2000,
};

export type PremiumMaterialsField = 'template' | PremiumMaterialsTextField;

/** Platnosci online wylaczone (brak `STRIPE_*`) — UI wtedy akcji nie wola, ale to publiczny POST. */
export type CheckoutErrorCode =
    | 'CHECKOUT_DISABLED'
    | 'BAD_INPUT'
    | 'RATE_LIMITED'
    | 'NOT_FOUND'
    | 'ALREADY_PREMIUM'
    | 'CHECKOUT_FAILED';

/** Wynik `startPremiumCheckout`. Sukces nie wraca — akcja konczy sie przekierowaniem do Stripe. */
export type CheckoutState = { error: { code: CheckoutErrorCode; message: string } } | null;

export type CheckoutAction = (
    previous: CheckoutState,
    formData: FormData,
) => Promise<CheckoutState>;

/**
 * Jak profil sprzedaje premium. Decyduje serwer (`isStripeConfigured`): Stripe Checkout albo
 * — przy wylaczonych platnosciach online — link do formularza kontaktowego (premium reczne).
 */
export type PremiumPurchase = { kind: 'checkout'; action: CheckoutAction } | { kind: 'contact' };

export type MaterialsErrorCode =
    | 'CHECKOUT_DISABLED'
    | 'BAD_INPUT'
    | 'RATE_LIMITED'
    | 'FORBIDDEN'
    | 'VERIFY_FAILED'
    | 'SEND_FAILED';

export type MaterialsFieldErrors = Partial<Record<PremiumMaterialsField, string>>;

export type MaterialsState =
    | { data: { sent: true } }
    | { error: { code: MaterialsErrorCode; message: string; fields?: MaterialsFieldErrors } }
    | null;

export type MaterialsAction = (
    previous: MaterialsState,
    formData: FormData,
) => Promise<MaterialsState>;
