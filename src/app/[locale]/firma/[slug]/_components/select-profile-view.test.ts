import type { PremiumSubscriptionState } from '@/lib/premium';

import { selectProfileView, toPremiumProfileView } from './select-profile-view';
import type { PremiumContent, ServiceProfileView } from './service-profile-types';

const NOW = new Date('2026-10-31T12:00:00Z');

function subscription(overrides: Partial<PremiumSubscriptionState> = {}): PremiumSubscriptionState {
    return {
        status: 'active',
        currentPeriodEnd: new Date('2026-11-30T12:00:00Z'),
        cancelAtPeriodEnd: false,
        ...overrides,
    };
}

function premiumContent(overrides: Partial<PremiumContent> = {}): PremiumContent {
    return {
        template: 'gallery',
        coverImage: { src: '/services/mistrz-remontu/cover.jpg', alt: 'Mistrz Remontu' },
        gallery: [],
        priceList: [{ name: 'Malowanie', price: '30 zl/m2' }],
        faq: [],
        ...overrides,
    };
}

function view(premium: PremiumContent | null): ServiceProfileView {
    return {
        slug: 'mistrz-remontu',
        name: 'Mistrz Remontu',
        description: null,
        logo: '/services/remont.png',
        category: 'renovation',
        coverage: 'local',
        languages: ['pl'],
        tags: [],
        verified: false,
        locations: [],
        mapHref: null,
        similarServices: [],
        upgradeHref: '/pricing',
        premium,
    };
}

describe('selectProfileView', () => {
    it('aktywne premium z szablonem gallery daje widok premium gallery', () => {
        const result = selectProfileView({
            premiumContent: premiumContent({ template: 'gallery' }),
            subscription: subscription(),
            now: NOW,
        });

        expect(result).toEqual({ kind: 'premium', template: 'gallery' });
    });

    it('aktywne premium bez tresci daje domyslny szablon classic', () => {
        const result = selectProfileView({
            premiumContent: null,
            subscription: subscription(),
            now: NOW,
        });

        expect(result).toEqual({ kind: 'premium', template: 'classic' });
    });

    it('wygasle premium z zachowana trescia daje profil free', () => {
        const result = selectProfileView({
            premiumContent: premiumContent({ template: 'professional' }),
            subscription: subscription({
                status: 'canceled',
                currentPeriodEnd: new Date('2026-09-30T12:00:00Z'),
            }),
            now: NOW,
        });

        expect(result).toEqual({ kind: 'free' });
    });

    it('brak subskrypcji z trescia daje profil free', () => {
        const result = selectProfileView({
            premiumContent: premiumContent(),
            subscription: null,
            now: NOW,
        });

        expect(result).toEqual({ kind: 'free' });
    });
});

describe('toPremiumProfileView', () => {
    it('zachowuje opublikowana tresc premium', () => {
        const content = premiumContent();

        expect(toPremiumProfileView(view(content)).premium).toBe(content);
    });

    it('bez tresci daje pusta tresc classic bez coveru', () => {
        const result = toPremiumProfileView(view(null));

        expect(result.premium).toEqual({
            template: 'classic',
            coverImage: null,
            gallery: [],
            priceList: [],
            faq: [],
        });
        expect(result.name).toBe('Mistrz Remontu');
    });
});
