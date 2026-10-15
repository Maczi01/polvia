import type { ReactElement, ReactNode } from 'react';
import { Phone, Play } from 'lucide-react';

import type { Socials } from '@/types';
import { cn } from '@/lib/utilities';

type IconProps = { className?: string };

const FacebookIcon = ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
);

const InstagramIcon = ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
);

const ThreadsIcon = ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} width="16" height="16" fill="currentColor">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
    </svg>
);

const TikTokIcon = ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.53a6.27 6.27 0 00-.79-.05A6.34 6.34 0 003.15 15.65a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.22a8.16 8.16 0 004.76 1.52V7.3a4.82 4.82 0 01-1-.61z" />
    </svg>
);

const LinkedInIcon = ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
    </svg>
);

const XIcon = ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

export type SocialNetwork = {
    key: keyof Socials;
    label: string;
    className: string;
    icon: ReactNode;
};

/**
 * Jedna lista steruje i kolejnoscia ikon, i tym, czy rzad w ogole sie pojawi.
 * Wczesniej warunek `hasSocials` i JSX byly osobno i rozjezdzaly sie przy
 * kazdej nowej sieci (LinkedIn, potem YouTube i Viber nie pokazywaly sie wcale).
 *
 * Telegrama i WhatsAppa tu nie ma celowo: to kanaly kontaktu, wiec karta
 * pokazuje je jako przyciski akcji.
 *
 * Z tej samej listy korzysta podglad karty w „Dodaj firme" (`preview-socials.tsx`).
 */
export const SOCIAL_NETWORKS: SocialNetwork[] = [
    { key: 'facebook', label: 'Facebook', className: 'bg-[#1877F2]', icon: <FacebookIcon /> },
    {
        key: 'instagram',
        label: 'Instagram',
        className: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
        icon: <InstagramIcon />,
    },
    {
        key: 'youtube',
        label: 'YouTube',
        className: 'bg-[#FF0000]',
        icon: <Play className="size-4" fill="currentColor" aria-hidden="true" />,
    },
    {
        key: 'threads',
        label: 'Threads',
        className: 'bg-black dark:bg-gray-900',
        icon: <ThreadsIcon />,
    },
    {
        key: 'viber',
        label: 'Viber',
        className: 'bg-[#7360F2]',
        icon: <Phone className="size-4" fill="currentColor" aria-hidden="true" />,
    },
    { key: 'tiktok', label: 'TikTok', className: 'bg-black dark:bg-gray-900', icon: <TikTokIcon /> },
    { key: 'linkedin', label: 'LinkedIn', className: 'bg-[#0A66C2]', icon: <LinkedInIcon /> },
    { key: 'x', label: 'X', className: 'bg-black dark:bg-gray-900', icon: <XIcon /> },
];

type ServiceSocialsProps = {
    socials: Socials | null;
};

export const ServiceSocials = ({ socials }: ServiceSocialsProps): ReactElement | null => {
    const links = SOCIAL_NETWORKS.flatMap(network => {
        const href = socials?.[network.key];
        return href ? [{ ...network, href }] : [];
    });

    if (links.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-3">
            {links.map(({ key, href, label, className, icon }) => (
                <a
                    key={key}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        'flex size-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        className,
                    )}
                    // Klik w karte rozwija ja i przesuwa mape — link ma tylko otworzyc siec.
                    onClick={event => event.stopPropagation()}
                >
                    {icon}
                </a>
            ))}
        </div>
    );
};
