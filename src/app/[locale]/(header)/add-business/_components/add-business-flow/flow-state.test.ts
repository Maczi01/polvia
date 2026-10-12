import { PIN_FIXTURE, PREVIEW_FIXTURE } from '../business-card-preview/preview-fixture';
import {
    afterAction,
    afterGenerate,
    afterRejection,
    afterSubmit,
    editingLogo,
    type EditingState,
    type FlowState,
    INITIAL_FLOW,
    linkWithError,
    manualStep,
    type ReadyDraft,
    submittedLogo,
} from './flow-state';

const DRAFT: ReadyDraft = {
    status: 'ready',
    draftId: 'draft-1',
    preview: PREVIEW_FIXTURE,
    unconfirmed: ['phoneNumber'],
    logoCandidate: 'https://kawiarnia.pl/logo.png',
    pin: PIN_FIXTURE,
};

const EDITING: EditingState = { step: 'editing', draft: DRAFT, fieldErrors: {}, error: null };

const failure = (
    code:
        | 'DRAFT_EXPIRED'
        | 'SEND_FAILED'
        | 'INVALID_ENTRY'
        | 'GEOCODE_UNAVAILABLE'
        | 'GENERATION_FAILED',
) => ({ status: 'error', error: { code, message: 'techniczny' } }) as const;

describe('afterGenerate', () => {
    it('gotowy szkic przechodzi do edycji', () => {
        expect(afterGenerate(INITIAL_FLOW, DRAFT)).toEqual(EDITING);
    });

    it('link social przechodzi do trybu recznego z zachowanym linkiem', () => {
        const next = afterGenerate(INITIAL_FLOW, {
            status: 'needsManual',
            reason: 'SOCIAL_LINK',
            prefill: { link: 'https://instagram.com/kawiarnia' },
        });

        expect(next).toEqual(manualStep('SOCIAL_LINK', 'https://instagram.com/kawiarnia'));
    });

    it('duplikat i limit maja wlasne ekrany', () => {
        expect(
            afterGenerate(INITIAL_FLOW, {
                status: 'duplicate',
                name: 'K',
                slug: 'k',
            }),
        ).toEqual({ step: 'duplicate', name: 'K', slug: 'k' });
        expect(afterGenerate(INITIAL_FLOW, { status: 'limited', retryAfter: 60 })).toEqual({
            step: 'limited',
            retryAfter: 60,
        });
    });

    it('odrzucenie wraca do kroku, z ktorego przyszlo, z bledami pol', () => {
        const manual = manualStep('UNREADABLE', 'https://firma.pl');
        const next = afterGenerate(manual, {
            status: 'invalid',
            fieldErrors: { city: 'addBusiness.errors.required' },
        });

        expect(next).toEqual({ ...manual, fieldErrors: { city: 'addBusiness.errors.required' } });
    });

    it('blad akcji czysci stare bledy pol i zostawia kod', () => {
        const withErrors = {
            ...INITIAL_FLOW,
            fieldErrors: { url: 'addBusiness.errors.invalidUrl' as const },
        };

        expect(afterGenerate(withErrors, failure('GENERATION_FAILED'))).toEqual({
            step: 'link',
            fieldErrors: {},
            error: 'GENERATION_FAILED',
        });
    });
});

describe('afterSubmit', () => {
    it('wyslane zgloszenie konczy flow karta z serwera', () => {
        const next = afterSubmit(EDITING, {
            status: 'sent',
            card: PREVIEW_FIXTURE,
            unconfirmed: [],
            pin: PIN_FIXTURE,
            hasLogo: true,
        });

        expect(next).toMatchObject({
            step: 'submitted',
            hasLogo: true,
            logoCandidate: DRAFT.logoCandidate,
        });
    });

    it('wygasly albo zuzyty szkic wraca do linku z komunikatem', () => {
        expect(afterSubmit(EDITING, failure('DRAFT_EXPIRED'))).toEqual({
            step: 'link',
            fieldErrors: {},
            error: 'DRAFT_EXPIRED',
        });
        expect(afterSubmit(EDITING, failure('SEND_FAILED'))).toMatchObject({ step: 'link' });
    });

    it('szkicu nie da sie zlozyc we wpis — wraca do linku z INVALID_ENTRY', () => {
        expect(afterSubmit(EDITING, failure('INVALID_ENTRY'))).toEqual(
            linkWithError('INVALID_ENTRY'),
        );
    });

    it('limit wysylek zostaje w edycji z tym samym szkicem i czasem ponowienia', () => {
        const withFieldErrors: EditingState = {
            ...EDITING,
            fieldErrors: { submitterEmail: 'addBusiness.errors.invalidEmail' },
        };

        const next = afterSubmit(withFieldErrors, { status: 'limited', retryAfter: 600 });

        expect(next).toEqual({
            step: 'editing',
            draft: DRAFT,
            fieldErrors: {},
            error: { kind: 'submitLimited', retryAfter: 600 },
        });
        expect(next).not.toMatchObject({ step: 'limited' });
    });

    it('blad, po ktorym szkic zyje, zostaje w edycji', () => {
        expect(afterSubmit(EDITING, failure('GEOCODE_UNAVAILABLE'))).toEqual({
            ...EDITING,
            error: 'GEOCODE_UNAVAILABLE',
        });
    });

    it('odrzucenie pol zostaje w edycji z bledami', () => {
        expect(
            afterSubmit(EDITING, {
                status: 'invalid',
                fieldErrors: { submitterEmail: 'addBusiness.errors.invalidEmail' },
            }),
        ).toEqual({
            ...EDITING,
            fieldErrors: { submitterEmail: 'addBusiness.errors.invalidEmail' },
        });
    });
});

describe('afterRejection', () => {
    it('odrzucona akcja zostawia krok z INTERNAL i bez starych bledow pol', () => {
        const withErrors: EditingState = {
            ...EDITING,
            fieldErrors: { submitterEmail: 'addBusiness.errors.invalidEmail' },
            error: 'GEOCODE_UNAVAILABLE',
        };

        expect(afterRejection(withErrors)).toEqual({ ...EDITING, error: 'INTERNAL' });
    });

    it('dziala tez dla kroku z linkiem', () => {
        expect(
            afterRejection({
                ...INITIAL_FLOW,
                fieldErrors: { link: 'addBusiness.errors.required' },
            }),
        ).toEqual({ ...INITIAL_FLOW, error: 'INTERNAL' });
    });
});

describe('afterAction', () => {
    const SUBMITTED: FlowState = {
        step: 'submitted',
        card: PREVIEW_FIXTURE,
        unconfirmed: [],
        pin: PIN_FIXTURE,
        hasLogo: false,
        logoCandidate: null,
    };

    it('po udanej wysylce kolejny wynik akcji nie nadpisuje podziekowania', () => {
        const late = afterSubmit(EDITING, failure('DRAFT_EXPIRED'));

        expect(afterAction(SUBMITTED, late)).toBe(SUBMITTED);
        expect(afterAction(SUBMITTED, afterRejection(EDITING))).toBe(SUBMITTED);
        expect(afterAction(SUBMITTED, { step: 'limited', retryAfter: 60 })).toBe(SUBMITTED);
    });

    it('przed wysylka wynik akcji przechodzi bez zmian', () => {
        const next = afterSubmit(EDITING, failure('DRAFT_EXPIRED'));

        expect(afterAction(EDITING, next)).toBe(next);
    });
});

describe('logo', () => {
    it('upload ma pierwszenstwo przed kandydatem ze strony', () => {
        expect(editingLogo('blob:x', DRAFT)).toBe('blob:x');
        expect(editingLogo(null, DRAFT)).toBe(DRAFT.logoCandidate);
    });

    it('po wysylce bez logo zostaje placeholder', () => {
        const submitted = {
            step: 'submitted',
            card: PREVIEW_FIXTURE,
            unconfirmed: [],
            pin: null,
            hasLogo: false,
            logoCandidate: DRAFT.logoCandidate,
        } as const;

        expect(submittedLogo('blob:x', { ...submitted, unconfirmed: [] })).toBeNull();
        expect(submittedLogo(null, { ...submitted, unconfirmed: [], hasLogo: true })).toBe(
            DRAFT.logoCandidate,
        );
    });
});
