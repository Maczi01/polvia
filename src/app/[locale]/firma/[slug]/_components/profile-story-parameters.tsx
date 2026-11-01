import type { Decorator, Parameters } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import messages from '../../../../../../messages/pl.json';

/** Szerokosci akceptacji wizualnej (U3): desktop 1440 i telefon 390. */
const PROFILE_VIEWPORTS = {
    desktop1440: {
        name: 'Desktop 1440',
        styles: { width: '1440px', height: '900px' },
        type: 'desktop',
    },
    mobile390: {
        name: 'Mobile 390',
        styles: { width: '390px', height: '844px' },
        type: 'mobile',
    },
} as const;

export const profileStoryParameters: Parameters = {
    layout: 'fullscreen',
    // `Link` z next-intl korzysta z hookow App Routera.
    nextjs: { appDirectory: true },
    viewport: { viewports: PROFILE_VIEWPORTS, defaultViewport: 'desktop1440' },
};

export const mobileViewport: Parameters = {
    viewport: { viewports: PROFILE_VIEWPORTS, defaultViewport: 'mobile390' },
};

export const withProfileIntl: Decorator = Story => (
    <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
        <Story />
    </NextIntlClientProvider>
);
