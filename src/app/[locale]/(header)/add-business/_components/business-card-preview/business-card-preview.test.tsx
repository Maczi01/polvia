import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../test-utils/render-with-intl';
import { BusinessCardPreview, type BusinessCardPreviewProps } from './business-card-preview';
import { PIN_FIXTURE, PREVIEW_FIXTURE } from './preview-fixture';

expect.extend(toHaveNoViolations);

function renderPreview(overrides: Partial<BusinessCardPreviewProps> = {}) {
    return renderWithIntl(
        <BusinessCardPreview
            preview={PREVIEW_FIXTURE}
            unconfirmed={[]}
            logoSrc={null}
            pin={PIN_FIXTURE}
            {...overrides}
        />,
    );
}

/** Wiersz szczegolu karty, w ktorym wystepuje dany tekst. */
const rowOf = (text: string): HTMLElement => {
    const row = screen.getByText(text).closest('div');
    if (row === null) throw new Error(`Brak wiersza dla "${text}"`);
    return row;
};

describe('<BusinessCardPreview />', () => {
    it('pokazuje dane karty z opisem i tagami w locale UI', () => {
        renderPreview();

        expect(
            screen.getByRole('heading', { level: 3, name: 'Kawiarnia Lwów' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Kawiarnia z ukraińskimi wypiekami w centrum Gdańska.'),
        ).toBeInTheDocument();
        expect(screen.getByText('ul. Długa 1, 80-831 Gdańsk')).toBeInTheDocument();
        expect(screen.getByText('Wypieki')).toBeInTheDocument();
        expect(screen.getByText('Online')).toBeInTheDocument();
        expect(screen.queryByText('do uzupełnienia')).not.toBeInTheDocument();
    });

    it('pole niepotwierdzone ma widoczny znacznik „do uzupelnienia" przy etykiecie', () => {
        renderPreview({
            preview: { ...PREVIEW_FIXTURE, phoneNumber: null },
            unconfirmed: ['phoneNumber'],
        });

        expect(within(rowOf('Telefon')).getByText('do uzupełnienia')).toBeVisible();
        expect(screen.getAllByText('do uzupełnienia')).toHaveLength(1);
    });

    it('brak nazwy daje zastepczy naglowek ze znacznikiem', () => {
        renderPreview({ preview: { ...PREVIEW_FIXTURE, name: null }, unconfirmed: ['name'] });

        expect(
            screen.getByRole('heading', { level: 3, name: 'Nazwa firmy do uzupełnienia' }),
        ).toBeInTheDocument();
    });

    it('logo: wlasny upload ma pierwszenstwo, bez logo placeholder', () => {
        const { rerender } = renderPreview({ logoSrc: 'blob:http://localhost/logo' });
        expect(screen.getByRole('img', { name: 'Logo firmy Kawiarnia Lwów' })).toHaveAttribute(
            'src',
            'blob:http://localhost/logo',
        );

        rerender(
            <BusinessCardPreview
                preview={PREVIEW_FIXTURE}
                unconfirmed={[]}
                logoSrc={null}
                pin={null}
            />,
        );
        expect(
            screen.getByRole('img', { name: 'Logo firmy Kawiarnia Lwów' }).getAttribute('src'),
        ).toContain('default.png');
    });

    it('pin to statyczny obraz mapy z atrybucja', () => {
        renderPreview();

        const map = screen.getByRole('img', { name: /Mapa z pinezką firmy przy adresie/ });
        expect(map.getAttribute('src')).toContain('api.mapbox.com');
        expect(screen.getByRole('link', { name: '© Mapbox' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '© OpenStreetMap' })).toBeInTheDocument();
    });

    it('pin przyblizony ma ostrzezenie, brak pinu ma komunikat', () => {
        const { rerender } = renderPreview({ pin: { ...PIN_FIXTURE, approximate: true } });
        expect(screen.getByText(/Pinezka jest przybliżona/)).toBeInTheDocument();

        rerender(
            <BusinessCardPreview
                preview={PREVIEW_FIXTURE}
                unconfirmed={[]}
                logoSrc={null}
                pin={null}
            />,
        );
        expect(screen.getByText(/Nie znaleźliśmy tego adresu na mapie/)).toBeInTheDocument();
    });

    it('social media jak na karcie katalogu: ikony w kolejnosci karty, WhatsApp z numeru', () => {
        renderPreview({
            preview: {
                ...PREVIEW_FIXTURE,
                socials: {
                    x: 'https://x.com/kawiarnia',
                    facebook: 'https://facebook.com/kawiarnia',
                    youtube: 'https://youtube.com/@kawiarnia',
                },
                whatsappNumber: '+48500600700',
            },
        });

        const icons = screen
            .getAllByRole('img')
            .map(node => node.getAttribute('aria-label'))
            .filter(label => label === 'Facebook' || label === 'X' || label === 'YouTube');
        expect(icons).toEqual(['Facebook', 'YouTube', 'X']);
        expect(screen.getByText('WhatsApp')).toBeInTheDocument();
        expect(screen.queryByText('Telegram')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument();
    });

    it('Threads i Viber pokazuje jak karta katalogu', () => {
        renderPreview({
            preview: {
                ...PREVIEW_FIXTURE,
                socials: {
                    threads: 'https://www.threads.com/@kawiarnia',
                    viber: 'https://invite.viber.com/?g2=kawiarnia',
                },
            },
        });

        expect(screen.getByRole('img', { name: 'Threads' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Viber' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Threads' })).not.toBeInTheDocument();
    });

    it('bez social media nie ma pustego rzedu', () => {
        renderPreview();

        expect(screen.queryByRole('img', { name: 'Facebook' })).not.toBeInTheDocument();
        expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
    });

    it('wpis online nie ma mapy', () => {
        renderPreview({ preview: { ...PREVIEW_FIXTURE, coverage: 'online' }, pin: null });

        expect(screen.queryByRole('img', { name: /Mapa/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/Nie znaleźliśmy tego adresu/)).not.toBeInTheDocument();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderPreview({
            preview: {
                ...PREVIEW_FIXTURE,
                phoneNumber: null,
                openingHours: null,
                socials: { instagram: '@kawiarnia', telegram: '@kawiarnia' },
            },
            unconfirmed: ['phoneNumber', 'openingHours'],
        });

        expect(await axe(container)).toHaveNoViolations();
    });
});
