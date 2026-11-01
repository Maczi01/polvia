import type { Meta, StoryObj } from '@storybook/react';

import {
    premiumEmptyFixture,
    premiumProfessionalFixture,
    premiumServiceFixture,
} from '../profile-fixtures';
import { mobileViewport, profileStoryParameters, withProfileIntl } from '../profile-story-parameters';
import { TemplateProfessional } from './template-professional';

const meta = {
    title: 'firma/Premium — Profesjonalny',
    component: TemplateProfessional,
    decorators: [withProfileIntl],
    parameters: profileStoryParameters,
    globals: { theme: 'light' },
    args: { profile: premiumProfessionalFixture },
} satisfies Meta<typeof TemplateProfessional>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LawFirmDesktop: Story = {};

export const LawFirmMobile: Story = { parameters: mobileViewport };

/** Ta sama tresc co w szablonie Galeria (cover + 12 zdjec) — porownanie ukladow. */
export const FullDesktop: Story = {
    args: { profile: premiumServiceFixture },
};

export const FullMobile: Story = {
    args: { profile: premiumServiceFixture },
    parameters: mobileViewport,
};

/** Premium oplacone przed publikacja tresci: bez cover, galerii i adresu. */
export const EmptyDesktop: Story = {
    args: { profile: premiumEmptyFixture },
};

export const EmptyMobile: Story = {
    args: { profile: premiumEmptyFixture },
    parameters: mobileViewport,
};
