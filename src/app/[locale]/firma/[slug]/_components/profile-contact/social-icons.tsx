import type { ReactElement } from 'react';

import type { SocialIconKey } from '../profile-helpers';

/** Ikony sieci jak w karcie uslugi. Ozdobne: nazwe sieci niesie `aria-label` linku. */
const PATHS: Record<Exclude<SocialIconKey, 'instagram'>, string> = {
    facebook: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
    linkedin: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z',
    tiktok: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.53a6.27 6.27 0 00-.79-.05A6.34 6.34 0 003.15 15.65a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.22a8.16 8.16 0 004.76 1.52V7.3a4.82 4.82 0 01-1-.61z',
    x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
};

export const SOCIAL_LABELS: Record<SocialIconKey, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    x: 'X',
};

export const SOCIAL_BACKGROUNDS: Record<SocialIconKey, string> = {
    facebook: 'bg-[#1877F2]',
    instagram: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
    tiktok: 'bg-black dark:bg-gray-900',
    linkedin: 'bg-[#0A66C2]',
    x: 'bg-black dark:bg-gray-900',
};

export function SocialIcon({ network }: { network: SocialIconKey }): ReactElement {
    if (network === 'instagram') {
        return (
            <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d={PATHS[network]} />
        </svg>
    );
}
