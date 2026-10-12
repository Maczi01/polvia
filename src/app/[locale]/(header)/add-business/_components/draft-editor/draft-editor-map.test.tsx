import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { POLAND_BOUNDS } from '@/lib/add-business/form-limits';

import { clickMap, dragMarker, flyTo } from '../test-utils/map-gl-mock';
import { EDITOR_DRAFT, renderEditor, submitEditor } from './render-editor';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));
jest.mock('react-map-gl/mapbox', () => jest.requireActual('../test-utils/map-gl-mock'));

const SEARCHED_PIN = { lat: 54.4, lng: 18.6, approximate: false };

function relocated() {
    return jest.fn().mockResolvedValue({
        status: 'relocated',
        pin: SEARCHED_PIN,
        remainingRelocations: 9,
    });
}

const marker = () => screen.getByTestId('map-marker');
const hiddenValue = (name: string) =>
    document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;

async function searchStreet(street: string): Promise<void> {
    const input = screen.getByRole('textbox', { name: 'Ulica i numer' });
    await userEvent.clear(input);
    await userEvent.type(input, street);
    await userEvent.click(screen.getByRole('button', { name: 'Szukaj na mapie' }));
}

describe('<DraftEditor /> — mapa z pinezka', () => {
    beforeEach(() => flyTo.mockClear());

    it('mapa ma etykiete i podpowiedz, pin ze szkicu', async () => {
        await renderEditor();

        const map = screen.getByRole('group', { name: 'Mapa do ustawienia pinezki firmy' });
        expect(map).toHaveAccessibleDescription(/Bez myszy: wpisz adres/);
        expect(marker()).toHaveAttribute('data-lat', String(EDITOR_DRAFT.pin?.lat));
    });

    it('wyszukiwanie woła relokacje z ulica i miastem, centruje mape i NIE ustawia pinLat/pinLng', async () => {
        const relocateAction = relocated();
        const onSubmit = jest.fn();
        await renderEditor({ relocateAction, onSubmit });

        await searchStreet('ul. Długa 5');

        await waitFor(() => expect(marker()).toHaveAttribute('data-lat', '54.4'));
        const formData: FormData = relocateAction.mock.calls[0][1];
        expect(formData.get('street')).toBe('ul. Długa 5');
        expect(formData.get('city')).toBe('Gdańsk');
        expect(flyTo).toHaveBeenLastCalledWith(
            expect.objectContaining({ center: [SEARCHED_PIN.lng, SEARCHED_PIN.lat] }),
        );
        expect(screen.queryByText('Pinezka ustawiona ręcznie.')).not.toBeInTheDocument();

        await submitEditor();
        const submitted: FormData = onSubmit.mock.calls[0][0];
        expect(submitted.get('pinLat')).toBe('');
        expect(submitted.get('pinLng')).toBe('');
    });

    it('klik w mape ustawia ukryte pola, pin i komunikat „recznie"', async () => {
        await renderEditor();

        clickMap(52.2297, 21.0122);

        expect(hiddenValue('pinLat')).toBe('52.229700');
        expect(hiddenValue('pinLng')).toBe('21.012200');
        expect(marker()).toHaveAttribute('data-lng', '21.0122');
        expect(screen.getByText('Pinezka ustawiona ręcznie.')).toBeInTheDocument();
    });

    it('przeciagniecie pinezki tez ustawia pin reczny', async () => {
        await renderEditor();

        dragMarker(50.0614, 19.9366);

        expect(hiddenValue('pinLat')).toBe('50.061400');
        expect(screen.getByText('Pinezka ustawiona ręcznie.')).toBeInTheDocument();
    });

    it('„Cofnij do adresu" czysci pinLat/pinLng i wraca do pinu ze szkicu, fokus na mapie', async () => {
        await renderEditor();
        clickMap(52.2297, 21.0122);

        await userEvent.click(screen.getByRole('button', { name: 'Cofnij do adresu' }));

        expect(hiddenValue('pinLat')).toBe('');
        expect(hiddenValue('pinLng')).toBe('');
        expect(marker()).toHaveAttribute('data-lat', String(EDITOR_DRAFT.pin?.lat));
        expect(screen.queryByText('Pinezka ustawiona ręcznie.')).not.toBeInTheDocument();
        expect(
            screen.getByRole('group', { name: 'Mapa do ustawienia pinezki firmy' }),
        ).toHaveFocus();
    });

    it('udane wyszukiwanie po recznym pinie zdejmuje pin reczny', async () => {
        await renderEditor({ relocateAction: relocated() });
        clickMap(52.2297, 21.0122);

        await searchStreet('ul. Długa 5');

        await waitFor(() => expect(marker()).toHaveAttribute('data-lat', '54.4'));
        expect(hiddenValue('pinLat')).toBe('');
    });

    it('klik poza Polska nie ustawia pinu i jest ogloszony', async () => {
        await renderEditor();

        clickMap(POLAND_BOUNDS.maxLat + 0.5, 18);

        expect(hiddenValue('pinLat')).toBe('');
        expect(marker()).toHaveAttribute('data-lat', String(EDITOR_DRAFT.pin?.lat));
        expect(screen.getByText('Pinezka musi być w Polsce.')).toBeInTheDocument();
    });

    it('blad pola pin z serwera jest podpiety do mapy', async () => {
        await renderEditor({ fieldErrors: { pin: 'addBusiness.errors.pinOutsidePoland' } });

        expect(
            screen.getByRole('group', { name: 'Mapa do ustawienia pinezki firmy' }),
        ).toHaveAccessibleDescription(/Pinezka musi być w Polsce\./);
    });

    it('wpis online nie ma mapy ani pol pinezki', async () => {
        await renderEditor({
            draft: { ...EDITOR_DRAFT, preview: { ...EDITOR_DRAFT.preview, coverage: 'online' } },
        });

        expect(screen.queryByTestId('pin-map')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Szukaj na mapie' })).not.toBeInTheDocument();
        expect(hiddenValue('pinLat')).toBeUndefined();
    });

    it('nie ma naruszen dostepnosci z recznym pinem', async () => {
        const { container } = await renderEditor();
        clickMap(52.2297, 21.0122);

        expect(await axe(container)).toHaveNoViolations();
    });
});
