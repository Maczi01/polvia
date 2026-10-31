import { MessageCircle, Navigation, Phone, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utilities';

import { type ActionHrefs, getActionHrefs, hasAnyAction } from '../profile-helpers';
import type { ProfileLocation } from '../service-profile-types';

/** Kolory przyciskow jak w karcie uslugi (telefon, WhatsApp, Telegram, nawigacja). */
const TONES: Record<keyof ActionHrefs, string> = {
    call: 'border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-300',
    whatsapp:
        'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    telegram:
        'border-sky-500 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
    navigate:
        'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
};

const ICONS: Record<keyof ActionHrefs, ReactNode> = {
    call: <Phone size={18} aria-hidden="true" />,
    whatsapp: <MessageCircle size={18} aria-hidden="true" />,
    telegram: <Send size={18} aria-hidden="true" />,
    navigate: <Navigation size={18} aria-hidden="true" />,
};

const ACTION_ORDER: (keyof ActionHrefs)[] = ['call', 'whatsapp', 'telegram', 'navigate'];

/**
 * - `grid`: dwie kolumny (waska kolumna, naglowek z cover)
 * - `centered`: rzad wysrodkowany niezaleznie od liczby przyciskow (wizytowka)
 */
type ActionsLayout = 'grid' | 'centered';

const LIST_LAYOUT: Record<ActionsLayout, string> = {
    grid: 'grid grid-cols-2 gap-2',
    centered: 'flex flex-wrap justify-center gap-2',
};

const ITEM_LAYOUT: Record<ActionsLayout, string> = {
    grid: '',
    centered: 'min-w-[calc(50%-0.25rem)] sm:min-w-40',
};

type ProfileActionsProps = {
    location: ProfileLocation | null;
    /** Nawigacja tylko dla wpisow z punktem obslugi (zasieg inny niz `online`). */
    showNavigate: boolean;
    layout?: ActionsLayout;
    className?: string;
};

export function ProfileActions({
    location,
    showNavigate,
    layout = 'grid',
    className,
}: ProfileActionsProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    if (!location) return null;
    const hrefs = getActionHrefs(location, showNavigate);
    if (!hasAnyAction(hrefs)) return null;

    return (
        <ul className={cn(LIST_LAYOUT[layout], className)}>
            {ACTION_ORDER.map(action => {
                const href = hrefs[action];
                if (!href) return null;
                const isExternal = action !== 'call';
                return (
                    <li key={action} className={ITEM_LAYOUT[layout]}>
                        <a
                            href={href}
                            {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
                            className={cn(
                                'flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2',
                                TONES[action],
                            )}
                        >
                            {ICONS[action]}
                            {t(action)}
                        </a>
                    </li>
                );
            })}
        </ul>
    );
}
