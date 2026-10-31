import type { Meta, StoryObj } from '@storybook/react';

import {
    premiumEmptyFixture,
    premiumProfessionalFixture,
    premiumServiceFixture,
} from '../profile-fixtures';
import { mobileViewport, profileStoryParameters, withProfileIntl } from '../profile-story-parameters';
import { TemplateClassic } from './template-classic';

const meta = {
    title: 'firma/Premium — Klasyczny',
    component: TemplateClassic,
    decorators: [withProfileIntl],
    parameters: profileStoryParameters,
    globals: { theme: 'light' },
    args: { profile: premiumServiceFixture },
} satisfies Meta<typeof TemplateClassic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullDesktop: Story = {};

export const FullMobile: Story = { parameters: mobileViewport };

/** Ta sama tresc co w szablonie Profesjonalnym — porownanie ukladow. */
export const LawFirmDesktop: Story = {
    args: { profile: premiumProfessionalFixture },
};

/** Premium oplacone przed publikacja tresci: bez cover, galerii i adresu. */
export const EmptyDesktop: Story = {
    args: { profile: premiumEmptyFixture },
};

export const EmptyMobile: Story = {
    args: { profile: premiumEmptyFixture },
    parameters: mobileViewport,
};
