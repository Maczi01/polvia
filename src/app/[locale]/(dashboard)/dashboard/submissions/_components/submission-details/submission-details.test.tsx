import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { ServiceSubmission } from '@/lib/service-submissions';

import { SubmissionDetails } from './submission-details';

expect.extend(toHaveNoViolations);

const SUBMISSION: ServiceSubmission = {
    id: '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e',
    status: 'new',
    name: 'Kancelaria Nowak',
    slug: 'kancelaria-nowak',
    entry: {
        name: 'Kancelaria Nowak',
        category: 'law',
        coverage: 'hybrid',
        languages: ['pl', 'uk'],
        translations: {
            pl: { description: 'Kancelaria prawna w Warszawie.' },
            uk: { description: 'uk' },
            en: { description: 'en' },
            ru: { description: 'ru' },
        },
        locations: [
            {
                city: 'Warszawa',
                street: 'ul. Prosta 1',
                postcode: '00-001',
                webpage: 'https://nowak.pl/',
            },
        ],
    },
    unconfirmed: ['email'],
    changedByOwner: ['phoneNumber'],
    missingCoordinates: true,
    manualPin: false,
    submitterEmail: 'wlasciciel@nowak.pl',
    notes: 'Prosze o kontakt.',
    premiumInfoConsent: false,
    locale: 'pl',
    source: 'page',
    sourceUrl: 'https://nowak.pl/',
    createdAt: new Date('2026-11-06T10:00:00Z'),
    hasLogo: true,
};

describe('SubmissionDetails', () => {
    it('pokazuje dane firmy, zglaszajacego, flagi i kroki publikacji, bez naruszen a11y', async () => {
        const { container } = render(<SubmissionDetails submission={SUBMISSION} />);

        expect(screen.getByText('ul. Prosta 1, 00-001 Warszawa')).toBeInTheDocument();
        expect(screen.getByText('Prosze o kontakt.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'wlasciciel@nowak.pl' })).toHaveAttribute(
            'href',
            'mailto:wlasciciel@nowak.pl',
        );
        expect(screen.getByText('Geocoding failed: fill in latitude and longitude.')).toBeInTheDocument();
        expect(screen.getByText('Not confirmed by the website: email')).toBeInTheDocument();
        expect(screen.getByText('Changed by the owner: phoneNumber')).toBeInTheDocument();
        expect(screen.getByText('public/services/kancelaria-nowak.png')).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it.each([
        [true, 'Yes'],
        [false, 'No'],
    ])('zgoda na premium %s jest widoczna w danych zglaszajacego', (premiumInfoConsent, label) => {
        render(<SubmissionDetails submission={{ ...SUBMISSION, premiumInfoConsent }} />);

        expect(screen.getByText('Premium info consent').nextElementSibling).toHaveTextContent(label);
    });

    it('adres spoza http(s) jest tekstem, nie linkiem', () => {
        const malicious = 'javascript:alert(document.domain)';
        render(<SubmissionDetails submission={{ ...SUBMISSION, sourceUrl: malicious }} />);

        expect(screen.getByText(malicious).tagName).not.toBe('A');
        const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));
        expect(hrefs).not.toContain(malicious);
    });

    it('bez logo nie wspomina o pliku logo', () => {
        render(<SubmissionDetails submission={{ ...SUBMISSION, hasLogo: false }} />);
        expect(screen.queryByText('public/services/kancelaria-nowak.png')).not.toBeInTheDocument();
    });
});
