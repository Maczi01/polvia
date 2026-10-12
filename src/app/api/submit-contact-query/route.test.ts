/**
 * @jest-environment node
 */
// `Request` z fetch API, ktorego jsdom nie ma.
import { redis } from '@/lib/redis';

import pl from '../../../../messages/pl.json';
import { POST } from './route';

const mockTransportSendMail = jest.fn();
const mockExec = jest.fn();

/** Fluent API ioredis w zakresie, ktorego uzywa trasa. `exec` leniwie: fabryka mocka jest hoistowana. */
interface MultiChain {
    incr(): MultiChain;
    expire(): MultiChain;
    exec(): Promise<unknown>;
}

// Zewnetrzne serwisy: SMTP (Gmail) i Redis. Zaden test nie wysyla prawdziwego maila.
jest.mock('nodemailer', () => ({
    __esModule: true,
    default: { createTransport: () => ({ sendMail: mockTransportSendMail }) },
}));
jest.mock('@/lib/redis', () => {
    const chain: MultiChain = { incr: () => chain, expire: () => chain, exec: () => mockExec() };
    return { redis: { get: jest.fn(), ttl: jest.fn(), multi: () => chain } };
});
jest.mock('../../../../env', () => ({
    env: { MY_GMAIL: 'operator@example.com', MY_GMAIL_PASSWORD: 'app-password' },
}));
// `getTranslations` wymaga kontekstu requestu next-intl; podstawiamy prawdziwe teksty pl.
jest.mock('next-intl/server', () => {
    const { createTranslator } = jest.requireActual('next-intl');
    const messages = jest.requireActual('../../../../messages/pl.json');
    return {
        getTranslations: async (namespace: string) =>
            createTranslator({ locale: 'pl', messages, namespace }),
    };
});

const SMTP_MESSAGE = '535-5.7.8 Username and Password not accepted';

function request(): Request {
    return new Request('https://www.polvia.pl/api/submit-contact-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body: JSON.stringify({
            email: 'jan@example.com',
            topic: 'Pytanie',
            message: 'Dzien dobry',
        }),
    });
}

beforeEach(() => {
    mockTransportSendMail.mockReset();
    mockExec.mockReset().mockResolvedValue([]);
    jest.mocked(redis.get).mockResolvedValue(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('POST /api/submit-contact-query', () => {
    it('wysyla wiadomosc do operatora z replyTo nadawcy i liczy limit', async () => {
        mockTransportSendMail.mockResolvedValue({ messageId: '1' });

        const response = await POST(request());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockTransportSendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'operator@example.com',
                replyTo: 'jan@example.com',
                text: 'Dzien dobry',
            }),
        );
        expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it('blad transportu zwraca 500 z kodem, bez surowego bledu SMTP', async () => {
        mockTransportSendMail.mockRejectedValue(new Error(SMTP_MESSAGE));

        const response = await POST(request());
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.success).toBe(false);
        expect(body.error).toEqual({ code: 'SEND_FAILED', message: pl.contact.sendFailed });
        expect(body.message).toBe(pl.contact.sendFailed);
        expect(JSON.stringify(body)).not.toContain('535');
        expect(mockExec).not.toHaveBeenCalled();
    });

    it('po wyczerpaniu limitu zwraca 429 bez wysylki', async () => {
        jest.mocked(redis.get).mockResolvedValue('5');
        jest.mocked(redis.ttl).mockResolvedValue(120);

        const response = await POST(request());

        expect(response.status).toBe(429);
        expect(mockTransportSendMail).not.toHaveBeenCalled();
    });
});
