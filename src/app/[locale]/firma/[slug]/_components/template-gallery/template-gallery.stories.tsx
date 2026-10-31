import type { Meta, StoryObj } from '@storybook/react';

import {
    premiumEmptyFixture,
    premiumOf,
    premiumProfessionalFixture,
    premiumServiceFixture,
} from '../profile-fixtures';
import { mobileViewport, profileStoryParameters, withProfileIntl } from '../profile-story-parameters';
import { TemplateGallery } from './template-gallery';

const meta = {
    title: 'firma/Premium — Galeria',
    component: TemplateGallery,
    decorators: [withProfileIntl],
    parameters: profileStoryParameters,
    globals: { theme: 'light' },
    args: { profile: premiumServiceFixture, premium: premiumOf(premiumServiceFixture) },
} satisfies Meta<typeof TemplateGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullDesktop: Story = {};

export const FullMobile: Story = { parameters: mobileViewport };

/** Ta sama tresc co w szablonie Profesjonalnym — porownanie ukladow. */
export const LawFirmDesktop: Story = {
    args: { profile: premiumProfessionalFixture, premium: premiumOf(premiumProfessionalFixture) },
};

/** Premium oplacone przed publikacja tresci: bez cover, galerii i adresu. */
export const EmptyDesktop: Story = {
    args: { profile: premiumEmptyFixture, premium: premiumOf(premiumEmptyFixture) },
};

export const EmptyMobile: Story = {
    args: { profile: premiumEmptyFixture, premium: premiumOf(premiumEmptyFixture) },
    parameters: mobileViewport,
};
