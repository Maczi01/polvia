import 'server-only';

import { z } from 'zod';

import { withActionBoundary } from '@/lib/add-business/action-errors';
import {
    buildServiceJson,
    type BuildServiceJsonInput,
} from '@/lib/add-business/build-service-json';
import { type Geocode, geocodeToDraftGeo } from '@/lib/add-business/draft-geo';
import {
    consumeDraft,
    type DraftGeo,
    getDraft,
    type StoredDraft,
} from '@/lib/add-business/draft-store';
import { consumeSubmitLimit } from '@/lib/add-business/limits';
import { type LogoErrorCode, processLogoUpload } from '@/lib/add-business/logo';
import { OWNER_EDIT_ERRORS, parseOwnerEdits } from '@/lib/add-business/owner-edits-schema';
import { buildPreview, toPin } from '@/lib/add-business/preview';
import {
    buildOperatorEmail,
    buildOwnerConfirmationEmail,
    type BuiltServiceEntry,
} from '@/lib/add-business/submission-emails';
import {
    actionFailure,
    EXTRA_FIELD_ERRORS,
    type FieldErrorKey,
    type SubmitDraftResult,
} from '@/lib/add-business/types';
import type { MailMessage, SendMailResult } from '@/lib/mailer';

/**
 * Orkiestrator kroku 2: edycje wlasciciela + szkic z Redisa → plik wpisu → maile (R13, R15).
 *
 * Kategoria, zasieg, tagi i opisy pochodza wylacznie ze szkicu (R9) — `buildServiceJson`
 * nie czyta ich z formularza. Szkic jest jednorazowy, wiec wszystko, co moze sie nie udac
 * z winy danych albo uslug (walidacja, logo, geokodowanie, pobranie logo ze strony), dzieje
 * sie PRZED `consumeDraft`: porazka nie pali szkicu i wlasciciel moze poprawic i wyslac
 * ponownie. Po `consumeDraft` zostaje czysta budowa JSON-a i maile, ktore nie rzucaja.
 */

export interface SubmitDraftDeps {
    geocode: Geocode;
    /** `processLogoCandidate` — pobiera obcy obrazek, wiec wstrzykiwany. Porazka = `null`. */
    fetchLogoCandidate: (url: string) => Promise<Buffer | null>;
    sendMail: (message: MailMessage) => Promise<SendMailResult>;
}

export interface SubmitRequest {
    formData: FormData;
    ip: string;
}

type Edits = BuildServiceJsonInput['edits'];

const LOGO_FIELD_ERRORS: Record<LogoErrorCode, FieldErrorKey> = {
    INVALID_LOGO: EXTRA_FIELD_ERRORS.invalidLogo,
    LOGO_TOO_LARGE: EXTRA_FIELD_ERRORS.logoTooLarge,
};

const draftIdSchema = z.string();

function sameText(a: string | null, b: string | null): boolean {
    return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

/** Ponowne geokodowanie tylko przy zmianie adresu wzgledem tego, ktory geokodowano. */
async function resolveGeo(
    stored: StoredDraft,
    edits: Edits,
    geocode: Geocode,
): Promise<DraftGeo | null> {
    if (stored.draft.coverage === 'online') return null;

    const { geo } = stored;
    const unchanged =
        geo !== null &&
        sameText(geo.address.street, edits.street) &&
        sameText(geo.address.city, edits.city);
    if (unchanged) return geo;

    return geocodeToDraftGeo(geocode, { street: edits.street, city: edits.city });
}

function logoFile(value: unknown): File | null {
    return value instanceof File ? value : null;
}

/**
 * Mail operatora nie wyszedl, a szkic jest juz zuzyty — log to jedyny slad zgloszenia.
 * Plik wpisu to dane firmy (publiczne z natury, trafiaja do katalogu). Bez `submitterEmail`
 * i `notes`: to dane osobowe zglaszajacego, a nie firmy.
 */
function logLostSubmission(entry: BuiltServiceEntry, hasLogo: boolean): void {
    console.error('add-business operator mail failed, submission kept only in this log', {
        slug: entry.slug,
        entry: entry.json,
        unconfirmed: entry.unconfirmed,
        changedByOwner: entry.changedByOwner,
        missingCoordinates: entry.missingCoordinates,
        hasLogo,
    });
}

function sentResult(
    stored: StoredDraft,
    edits: Edits,
    geo: DraftGeo | null,
    entry: BuiltServiceEntry,
    hasLogo: boolean,
): SubmitDraftResult {
    const { openingHours, languages, webpage, ...facts } = edits;
    const postcode = facts.postcode ?? geo?.postcode ?? null;
    return {
        status: 'sent',
        card: buildPreview({
            draft: stored.draft,
            facts: { ...facts, postcode, openingHours },
            webpage,
            languages,
        }),
        unconfirmed: entry.unconfirmed,
        pin: toPin(geo),
        hasLogo,
    };
}

async function submit(request: SubmitRequest, deps: SubmitDraftDeps): Promise<SubmitDraftResult> {
    const { formData, ip } = request;
    const draftId = draftIdSchema.safeParse(formData.get('draftId'));
    const parsed = parseOwnerEdits(formData);
    if (!parsed.ok) return { status: 'invalid', fieldErrors: parsed.fieldErrors };
    if (!draftId.success) {
        return { status: 'invalid', fieldErrors: { draftId: OWNER_EDIT_ERRORS.invalidValue } };
    }

    const current = await getDraft(draftId.data);
    if (!current.ok) return actionFailure(current.code);

    const upload = await processLogoUpload(logoFile(formData.get('logo')));
    if (!upload.ok)
        return { status: 'invalid', fieldErrors: { logo: LOGO_FIELD_ERRORS[upload.code] } };

    const limit = await consumeSubmitLimit(ip);
    if (!limit.allowed) return { status: 'limited', retryAfter: limit.retryAfter };

    const { submitterEmail, notes, ...edits } = parsed.data;
    const geo = await resolveGeo(current.stored, edits, deps.geocode);
    const candidate = current.stored.logoCandidate;
    const logo =
        upload.png ?? (candidate === null ? null : await deps.fetchLogoCandidate(candidate));

    const consumed = await consumeDraft(draftId.data);
    if (!consumed.ok) return actionFailure(consumed.code);
    const { stored } = consumed;

    const entry = buildServiceJson({ stored, edits, geo, hasLogo: logo !== null });
    if (!entry.ok) return actionFailure(entry.code);

    const mail = { entry, stored, submitterEmail, notes, logo };
    const operator = await deps.sendMail(buildOperatorEmail(mail));
    if (!operator.ok) {
        logLostSubmission(entry, logo !== null);
        return actionFailure(operator.code);
    }

    // Potwierdzenie to uprzejmosc: zgloszenie juz dotarlo, wiec porazka idzie tylko do logu.
    const confirmation = await deps.sendMail(buildOwnerConfirmationEmail(mail));
    if (!confirmation.ok) console.warn('add-business confirmation not sent', { slug: entry.slug });

    return sentResult(stored, edits, geo, entry, logo !== null);
}

export async function submitDraft(
    request: SubmitRequest,
    deps: SubmitDraftDeps,
): Promise<SubmitDraftResult> {
    return withActionBoundary('submitDraft', () => submit(request, deps));
}
