import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import { LanguageSelect } from './language-select';
import messages from '../../../../../../messages/pl.json';

const meta = {
    title: 'component/languageSelect',
    component: LanguageSelect,
    decorators: [
        Story => (
            <NextIntlClientProvider locale="pl" messages={messages}>
                <div className="w-56 p-4">
                    <Story />
                </div>
            </NextIntlClientProvider>
        ),
    ],
    args: {
        value: null,
        onChange: () => {},
        counts: { pl: 42, uk: 17, ru: 9, en: 23, be: 3 },
        className: 'w-full',
    },
} satisfies Meta<typeof LanguageSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AnyLanguage: Story = {};

export const Selected: Story = {
    args: { value: 'uk' },
};

export const EmptyBelarusian: Story = {
    args: { counts: { pl: 42, uk: 17, ru: 9, en: 23, be: 0 } },
};

export const WithoutCounts: Story = {
    args: { counts: undefined },
};

export const CompactAnyLanguage: Story = {
    args: { variant: 'compact', className: undefined },
};

export const CompactSelected: Story = {
    args: { variant: 'compact', className: undefined, value: 'ru' },
};
