import type { Meta, StoryObj } from '@storybook/react';

import type { PremiumPurchase } from '@/lib/premium-checkout-fields';

import {
    chainServiceFixture,
    localServiceFixture,
    noLogoServiceFixture,
    onlineServiceFixture,
} from '../profile-fixtures';
import { mobileViewport, profileStoryParameters, withProfileIntl } from '../profile-story-parameters';
import { ProfileFree } from './profile-free';

/** Zastepstwo `startPremiumCheckout`: Storybook nie laczy sie ze Stripe. */
const storyPurchase: PremiumPurchase = { kind: 'checkout', action: async () => null };

const meta = {
    title: 'firma/Profil darmowy',
    component: ProfileFree,
    decorators: [withProfileIntl],
    parameters: profileStoryParameters,
    globals: { theme: 'light' },
    args: { profile: localServiceFixture, purchase: storyPurchase },
} satisfies Meta<typeof ProfileFree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalDesktop: Story = {};

export const LocalMobile: Story = { parameters: mobileViewport };

/** Platnosci online wylaczone: CTA prowadzi do formularza kontaktowego. */
export const ContactPurchaseDesktop: Story = { args: { purchase: { kind: 'contact' } } };

export const OnlineDesktop: Story = { args: { profile: onlineServiceFixture } };

export const OnlineMobile: Story = {
    args: { profile: onlineServiceFixture },
    parameters: mobileViewport,
};

export const NoLogoDesktop: Story = { args: { profile: noLogoServiceFixture } };

export const NoLogoMobile: Story = {
    args: { profile: noLogoServiceFixture },
    parameters: mobileViewport,
};

/** 8 punktow w 5 miastach: podsumowanie pod nazwa, grupy miast i zwiniete adresy. */
export const ManyLocationsDesktop: Story = { args: { profile: chainServiceFixture } };

export const ManyLocationsMobile: Story = {
    args: { profile: chainServiceFixture },
    parameters: mobileViewport,
};
