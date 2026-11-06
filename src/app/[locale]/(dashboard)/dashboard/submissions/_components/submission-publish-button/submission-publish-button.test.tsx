import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { publishSubmission } from '../../_actions';
import { SubmissionPublishButton } from './submission-publish-button';

expect.extend(toHaveNoViolations);

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';
const mockRefresh = jest.fn();
const PUBLISHED = {
    serviceSlug: 'kancelaria-nowak',
    files: ['data/services/kancelaria-nowak.json', 'public/services/kancelaria-nowak.png'],
    isSearchIndexed: true,
};

jest.mock('../../_actions', () => ({ publishSubmission: jest.fn() }));
jest.mock('@/i18n/navigation', () => ({
    Link: ({ href, children }: { href: { params: { slug: string } }; children: React.ReactNode }) => (
        <a href={`/firma/${href.params.slug}`}>{children}</a>
    ),
    useRouter: () => ({ refresh: mockRefresh }),
}));

const mockPublish = jest.mocked(publishSubmission);

beforeEach(() => {
    jest.clearAllMocks();
    mockPublish.mockReset();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
    jest.restoreAllMocks();
});

async function clickPublish(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
}

function renderButton(isPublished = false) {
    return render(
        <SubmissionPublishButton id={ID} name="Kancelaria" isPublished={isPublished} />,
    );
}

describe('SubmissionPublishButton', () => {
    it('po potwierdzeniu publikuje, podaje adres i pliki do commita, bez naruszen a11y', async () => {
        mockPublish.mockResolvedValue({ data: PUBLISHED });
        const { container } = renderButton();

        expect(await axe(container)).toHaveNoViolations();
        await clickPublish();

        const link = await screen.findByRole('link', { name: '/firma/kancelaria-nowak' });
        expect(link).toHaveAttribute('href', '/firma/kancelaria-nowak');
        expect(screen.getByText(PUBLISHED.files[0])).toBeInTheDocument();
        expect(screen.getByText(PUBLISHED.files[1])).toBeInTheDocument();
        expect(screen.queryByText(/db:embeddings/)).not.toBeInTheDocument();
        expect(mockPublish).toHaveBeenCalledWith(ID);
        await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
        expect(await axe(container)).toHaveNoViolations();
    });

    it('anulowanie potwierdzenia niczego nie publikuje', async () => {
        jest.mocked(window.confirm).mockReturnValue(false);
        renderButton();

        await clickPublish();

        expect(mockPublish).not.toHaveBeenCalled();
    });

    it('opublikowane zgloszenie nie ma przycisku', () => {
        renderButton(true);

        expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    });

    it('blad akcji pokazuje powod i nie odswieza strony', async () => {
        mockPublish.mockResolvedValue({
            error: { code: 'DUPLICATE_NAME', message: 'The catalog already has this entry.' },
        });
        renderButton();

        await clickPublish();

        expect(await screen.findByText('The catalog already has this entry.')).toBeInTheDocument();
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('brak embeddingu podaje komende do uruchomienia', async () => {
        mockPublish.mockResolvedValue({ data: { ...PUBLISHED, isSearchIndexed: false } });
        renderButton();

        await clickPublish();

        expect(await screen.findByText(/npm run db:embeddings/)).toBeInTheDocument();
    });

    it('odrzucona akcja pokazuje komunikat zamiast wywracac strone', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPublish.mockRejectedValue(new TypeError('Failed to fetch'));
        renderButton();

        await clickPublish();

        expect(await screen.findByText('Could not reach the server. Try again.')).toBeInTheDocument();
    });
});
