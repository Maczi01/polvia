import type { PremiumSubscriptionState } from '@/lib/premium';

import {
    selectOgCoverPath,
    selectProfileView,
    shouldLoadSimilarServices,
    toPremiumProfileView,
} from './select-profile-view';
import type { PremiumContent, ServiceProfileView } from './service-profile-types';

const NOW = new Date('2026-10-31T12:00:00Z');

function subscription(overrides: Partial<PremiumSubscriptionState> = {}): PremiumSubscriptionState {
    return {
        status: 'active',
        currentPeriodStart: new Date('2026-10-30T12:00:00Z'),
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
        serviceId: '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01',
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
        premium,
    };
}

describe('selectProfileView', () => {
    it('aktywne premium z szablonem gallery daje widok premium gallery z trescia', () => {
        const content = premiumContent({ template: 'gallery' });

        const result = selectProfileView({
            loadPremiumContent: () => content,
            subscription: subscription(),
            now: NOW,
        });

        expect(result).toEqual({ kind: 'premium', template: 'gallery', content });
    });

    it('aktywne premium bez tresci daje domyslny szablon classic', () => {
        const result = selectProfileView({
            loadPremiumContent: () => null,
            subscription: subscription(),
            now: NOW,
        });

        expect(result).toEqual({ kind: 'premium', template: 'classic', content: null });
    });

    it('wygasle premium z zachowana trescia daje profil free bez parsowania tresci', () => {
        const loadPremiumContent = jest.fn(() => premiumContent({ template: 'professional' }));

        const result = selectProfileView({
            loadPremiumContent,
            subscription: subscription({
                status: 'canceled',
                currentPeriodEnd: new Date('2026-09-30T12:00:00Z'),
            }),
            now: NOW,
        });

        expect(result).toEqual({ kind: 'free' });
        expect(loadPremiumContent).not.toHaveBeenCalled();
    });

    it('status active po karencji (wygaslo bez webhooka) z zachowana trescia daje profil free', () => {
        const result = selectProfileView({
            loadPremiumContent: () => premiumContent({ template: 'gallery' }),
            subscription: subscription({
                status: 'active',
                currentPeriodEnd: new Date('2026-10-27T12:00:00Z'),
            }),
            now: NOW,
        });

        expect(result).toEqual({ kind: 'free' });
    });

    it('brak subskrypcji daje profil free i nie wola ladowania tresci premium', () => {
        const loadPremiumContent = jest.fn(() => premiumContent());

        const result = selectProfileView({ loadPremiumContent, subscription: null, now: NOW });

        expect(result).toEqual({ kind: 'free' });
        expect(loadPremiumContent).not.toHaveBeenCalled();
    });
});

describe('selectOgCoverPath', () => {
    const COVER_SRC = '/services/mistrz-remontu/cover.jpg';

    it('widok free nie wypuszcza coveru do Open Graph', () => {
        expect(selectOgCoverPath({ kind: 'free' })).toBeNull();
    });

    it('widok premium z coverem daje sciezke coveru', () => {
        expect(
            selectOgCoverPath({ kind: 'premium', template: 'gallery', content: premiumContent() }),
        ).toBe(COVER_SRC);
    });

    it('widok premium bez tresci daje null', () => {
        expect(
            selectOgCoverPath({ kind: 'premium', template: 'classic', content: null }),
        ).toBeNull();
    });

    it('widok premium z trescia bez coveru daje null', () => {
        expect(
            selectOgCoverPath({
                kind: 'premium',
                template: 'gallery',
                content: premiumContent({ coverImage: null }),
            }),
        ).toBeNull();
    });
});

describe('shouldLoadSimilarServices', () => {
    it('widok free pobiera podobne firmy', () => {
        expect(shouldLoadSimilarServices({ kind: 'free' })).toBe(true);
    });

    it('widok premium nie pobiera podobnych firm', () => {
        expect(
            shouldLoadSimilarServices({ kind: 'premium', template: 'professional', content: null }),
        ).toBe(false);
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
