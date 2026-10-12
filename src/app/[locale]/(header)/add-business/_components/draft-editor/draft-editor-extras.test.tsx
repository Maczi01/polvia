import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { EDITOR_DRAFT, renderEditor, submitEditor } from './render-editor';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));
jest.mock('react-map-gl/mapbox', () => jest.requireActual('../test-utils/map-gl-mock'));

const hoursCheckbox = () => screen.getByRole('checkbox', { name: 'Podaj godziny otwarcia' });
const mondayOpen = () => screen.queryByLabelText('Poniedziałek: otwarcie');
const othersButton = () => screen.getByRole('button', { name: 'Dodaj inne' });

function draftWith(preview: Partial<typeof EDITOR_DRAFT.preview>) {
    return { ...EDITOR_DRAFT, preview: { ...EDITOR_DRAFT.preview, ...preview } };
}

describe('<DraftEditor /> — godziny otwarcia', () => {
    it('checkbox domyslnie odznaczony, pola ukryte, karta bez godzin', async () => {
        await renderEditor();

        expect(hoursCheckbox()).not.toBeChecked();
        expect(mondayOpen()).not.toBeInTheDocument();
        expect(screen.queryByText(/Dziś:/)).not.toBeInTheDocument();
    });

    it('zaznaczenie rozwija pola z godzinami ze szkicu, fokus zostaje na checkboxie', async () => {
        await renderEditor();

        await userEvent.click(hoursCheckbox());
        expect(mondayOpen()).toHaveValue('09:00');
        expect(hoursCheckbox()).toHaveFocus();
        expect(screen.getByText(/Dziś:/)).toBeInTheDocument();

        await userEvent.click(hoursCheckbox());
        expect(mondayOpen()).not.toBeInTheDocument();
    });

    it('szkic bez godzin: po zaznaczeniu puste pola do wpisania', async () => {
        await renderEditor({ draft: draftWith({ openingHours: null }) });

        await userEvent.click(hoursCheckbox());

        expect(mondayOpen()).toHaveValue('');
    });

    it('odznaczone godziny: wysylka bez hoursEnabled i bez pol hours.*', async () => {
        const onSubmit = jest.fn();
        await renderEditor({ onSubmit });

        await submitEditor();

        const formData: FormData = onSubmit.mock.calls[0][0];
        expect(formData.get('hoursEnabled')).toBeNull();
        expect(formData.get('hours.monday.open')).toBeNull();
    });
});

describe('<DraftEditor /> — komunikatory i social media', () => {
    it('prefill: numer WhatsApp i glowne serwisy od razu, reszta zwinieta', async () => {
        await renderEditor({
            draft: draftWith({
                socials: { telegram: 'https://t.me/kawiarnia' },
                whatsappNumber: '+48500600700',
            }),
        });

        const whatsapp = screen.getByRole('textbox', { name: 'WhatsApp (numer telefonu)' });
        expect(whatsapp).toHaveValue('+48500600700');
        expect(whatsapp).toHaveAttribute('type', 'tel');
        expect(screen.getByRole('textbox', { name: 'Telegram' })).toHaveValue(
            'https://t.me/kawiarnia',
        );
        expect(screen.getByRole('textbox', { name: 'Instagram' })).toHaveAttribute(
            'placeholder',
            '@nazwa lub link do profilu',
        );
        expect(othersButton()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('textbox', { name: 'TikTok' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'WhatsApp (link)' })).not.toBeInTheDocument();
    });

    it('„Dodaj inne" rozwija pozostale serwisy', async () => {
        await renderEditor();

        await userEvent.click(othersButton());

        expect(othersButton()).toHaveAttribute('aria-expanded', 'true');
        for (const name of ['TikTok', 'YouTube', 'LinkedIn', 'Viber', 'Tripadvisor', 'X']) {
            expect(screen.getByRole('textbox', { name })).toBeVisible();
        }
    });

    it('wartosc w „innym" polu otwiera disclosure; link WhatsApp bez numeru tez tam trafia', async () => {
        await renderEditor({
            draft: draftWith({
                socials: {
                    youtube: 'https://youtube.com/@kawiarnia',
                    whatsapp: 'https://wa.me/message/ABC',
                },
            }),
        });

        expect(othersButton()).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('textbox', { name: 'YouTube' })).toHaveValue(
            'https://youtube.com/@kawiarnia',
        );
        expect(screen.getByRole('textbox', { name: 'WhatsApp (link)' })).toHaveValue(
            'https://wa.me/message/ABC',
        );
    });

    it('blad wrongSocialService jest podpiety do pola przez aria-describedby', async () => {
        await renderEditor({
            fieldErrors: { 'socials.facebook': 'addBusiness.errors.wrongSocialService' },
        });

        const facebook = screen.getByRole('textbox', { name: 'Facebook' });
        expect(facebook).toBeInvalid();
        expect(facebook).toHaveAccessibleDescription(
            'Ten link prowadzi do innego serwisu niż to pole.',
        );
    });

    it('blad w zwinietym polu otwiera disclosure', async () => {
        await renderEditor({ fieldErrors: { 'socials.tiktok': 'addBusiness.errors.invalidUrl' } });

        expect(othersButton()).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('textbox', { name: 'TikTok' })).toBeInvalid();
    });

    it('wysyla pola socials.<klucz> i whatsappNumber, podglad pokazuje ikone', async () => {
        const onSubmit = jest.fn();
        await renderEditor({ onSubmit });

        await userEvent.type(
            screen.getByRole('textbox', { name: 'WhatsApp (numer telefonu)' }),
            '+48 500 600 700',
        );
        await userEvent.type(screen.getByRole('textbox', { name: 'Instagram' }), '@kawiarnia');
        expect(screen.getByRole('img', { name: 'Instagram' })).toBeInTheDocument();
        await submitEditor();

        const formData: FormData = onSubmit.mock.calls[0][0];
        expect(formData.get('whatsappNumber')).toBe('+48 500 600 700');
        expect(formData.get('socials.instagram')).toBe('@kawiarnia');
        expect(formData.get('socials.whatsapp')).toBeNull();
    });

    it('nie ma naruszen dostepnosci z rozwinietymi polami i bledami', async () => {
        const { container } = await renderEditor({
            draft: draftWith({ openingHours: null }),
            fieldErrors: {
                whatsappNumber: 'addBusiness.errors.invalidPhone',
                'socials.x': 'addBusiness.errors.tooLong',
            },
        });

        expect(await axe(container)).toHaveNoViolations();
    });
});
