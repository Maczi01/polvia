import { z } from 'zod';

import {
    PREMIUM_INTERVALS,
    PREMIUM_MATERIALS_MAX_LENGTH,
    PREMIUM_MATERIALS_TEXT_FIELDS,
    type PremiumMaterialsField,
} from '@/lib/premium-checkout-fields';
import { PREMIUM_TEMPLATES } from '@/lib/premium-templates';
import { isValidServiceSlug } from '@/lib/service-slug-format';

export {
    PREMIUM_INTERVALS,
    PREMIUM_MATERIALS_MAX_LENGTH,
    PREMIUM_MATERIALS_TEXT_FIELDS,
} from '@/lib/premium-checkout-fields';

/**
 * Walidacja wejscia checkoutu premium i formularza materialow (granica Server Actions).
 * Komponenty klienckie biora stale z `@/lib/premium-checkout-fields`, nie z tego modulu.
 */

/** Id sesji Checkout z `success_url` (`{CHECKOUT_SESSION_ID}`): tryb testowy albo produkcyjny. */
export const checkoutSessionIdSchema = z.string().regex(/^cs_(?:test|live)_[A-Za-z0-9]{1,250}$/);

export const checkoutInputSchema = z.object({
    serviceId: z.string().uuid(),
    interval: z.enum(PREMIUM_INTERVALS),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/**
 * Pole tekstowe z `FormData`: brak pola (`null`) to pusty tekst. Bez coercji — `String(null)`
 * dalby napis `"null"` zapisany w mailu jako tresc.
 */
function optionalText(maxLength: number) {
    return z.preprocess(value => (value === null ? '' : value), z.string().trim().max(maxLength));
}

export const materialsInputSchema = z.object({
    sessionId: checkoutSessionIdSchema,
    slug: z.string().refine(isValidServiceSlug),
    template: z.enum(PREMIUM_TEMPLATES),
    priceList: optionalText(PREMIUM_MATERIALS_MAX_LENGTH.priceList),
    faq: optionalText(PREMIUM_MATERIALS_MAX_LENGTH.faq),
    notes: optionalText(PREMIUM_MATERIALS_MAX_LENGTH.notes),
});

export type MaterialsInput = z.infer<typeof materialsInputSchema>;

export function parseCheckoutForm(
    formData: FormData,
): z.SafeParseReturnType<unknown, CheckoutInput> {
    return checkoutInputSchema.safeParse({
        serviceId: formData.get('serviceId'),
        interval: formData.get('interval'),
    });
}

export function parseMaterialsForm(
    formData: FormData,
): z.SafeParseReturnType<unknown, MaterialsInput> {
    return materialsInputSchema.safeParse({
        sessionId: formData.get('sessionId'),
        slug: formData.get('slug'),
        template: formData.get('template'),
        priceList: formData.get('priceList'),
        faq: formData.get('faq'),
        notes: formData.get('notes'),
    });
}

/** Pola widoczne w formularzu — z tych samych stalych co formularz, bez przepisywania unii. */
const VISIBLE_FIELDS: ReadonlySet<string> = new Set<PremiumMaterialsField>([
    'template',
    ...PREMIUM_MATERIALS_TEXT_FIELDS,
]);

function isVisibleField(path: string | number | undefined): path is PremiumMaterialsField {
    return typeof path === 'string' && VISIBLE_FIELDS.has(path);
}

/**
 * Pola formularza, ktore nie przeszly walidacji — tylko te widoczne dla uzytkownika.
 * Bledne pola ukryte (`sessionId`, `slug`) daja pusta liste: formularz pokaze blad ogolny.
 */
export function invalidMaterialsFields(error: z.ZodError): PremiumMaterialsField[] {
    const fields = error.issues.map(issue => issue.path[0]).filter(isVisibleField);
    return [...new Set(fields)];
}
