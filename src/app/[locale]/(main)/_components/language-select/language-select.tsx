'use client';

import { Globe } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type * as React from 'react';

import { CountBadge } from '@/components/ui/count-badge/count-badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select/select';
import {
    isServiceLanguage,
    LANGUAGE_ENDONYMS,
    LANGUAGE_FLAG_PATHS,
    SERVICE_LANGUAGES,
    type ServiceLanguage,
} from '@/lib/languages';
import { cn } from '@/lib/utilities';

/** Radix Select nie przyjmuje pustej `value` w itemie — „Dowolny jezyk" ma wartosc-wartownika. */
const ANY_LANGUAGE = 'any';

type LanguageSelectProps = {
    /** Wybrany jezyk obslugi; `null` = bez filtra. */
    value: ServiceLanguage | null;
    onChange: (value: ServiceLanguage | null) => void;
    /** Liczba kart per jezyk przy pozostalych filtrach. Pominiete = bez licznikow. */
    counts?: Record<ServiceLanguage, number>;
    /**
     * `full` — flaga + endonim w wyzwalaczu; `compact` — flaga + kod (glob dla „Dowolny"),
     * do ciasnego paska desktopowego. Lista opcji jest w obu wariantach taka sama.
     */
    variant?: 'full' | 'compact';
    className?: string;
    /** Klasy listy opcji (portal do `body`) — np. z-index wyzszy niz warstwa rodzica. */
    contentClassName?: string;
};

function LanguageFlag({ code }: { code: ServiceLanguage }): React.JSX.Element {
    return (
        <Image src={LANGUAGE_FLAG_PATHS[code]} alt="" width={20} height={14} className="rounded-sm" />
    );
}

function LanguageLabel({ code }: { code: ServiceLanguage }): React.JSX.Element {
    return (
        <span className="flex items-center gap-2">
            <LanguageFlag code={code} />
            {/* Endonim jest w swoim jezyku — `lang` daje czytnikowi poprawna wymowe. */}
            <span lang={code}>{LANGUAGE_ENDONYMS[code]}</span>
        </span>
    );
}

/** Nazwa dostepna niesie etykiete ORAZ wartosc — kod „RU" sam nie wystarcza (WCAG 2.5.3). */
function CompactLanguageLabel({ code }: { code: ServiceLanguage | null }): React.JSX.Element {
    if (!code) return <Globe aria-hidden="true" className="size-4" />;

    return (
        <span className="flex items-center gap-1.5" aria-hidden="true">
            <LanguageFlag code={code} />
            <span>{code.toUpperCase()}</span>
        </span>
    );
}

/**
 * Filtr jezyka obslugi: jeden jezyk naraz (R2), wszystkie piec zawsze widoczne (R3),
 * nazwy jako endonimy (R4). Jezyk z licznikiem 0 zostaje klikalny (R5) — prowadzi do
 * empty state, tak jak pusta kategoria.
 */
export function LanguageSelect({
    value,
    onChange,
    counts,
    variant = 'full',
    className,
    contentClassName,
}: LanguageSelectProps): React.JSX.Element {
    const t = useTranslations('MapPage');

    const handleValueChange = (next: string): void => {
        onChange(isServiceLanguage(next) ? next : null);
    };

    const valueName = value ? LANGUAGE_ENDONYMS[value] : t('anyLanguage');
    const accessibleName = `${t('languageFilter')}: ${valueName}`;
    const isCompact = variant === 'compact';
    const fullLabel = value ? <LanguageLabel code={value} /> : t('anyLanguage');

    return (
        <Select value={value ?? ANY_LANGUAGE} onValueChange={handleValueChange}>
            <SelectTrigger
                aria-label={accessibleName}
                title={accessibleName}
                className={cn(isCompact && 'w-24 gap-1.5', className)}
            >
                {/* Wlasna tresc wyzwalacza: bez licznika, ktory jest tylko w liscie opcji. */}
                <SelectValue>
                    {isCompact ? <CompactLanguageLabel code={value} /> : fullLabel}
                </SelectValue>
            </SelectTrigger>
            <SelectContent className={contentClassName}>
                <SelectItem value={ANY_LANGUAGE}>{t('anyLanguage')}</SelectItem>
                {SERVICE_LANGUAGES.map(code => (
                    <SelectItem key={code} value={code}>
                        <span className="flex items-center gap-2">
                            <LanguageLabel code={code} />
                            {counts && (
                                <>
                                    <CountBadge
                                        count={counts[code]}
                                        aria-hidden="true"
                                        className="h-5 min-w-5 text-xs"
                                    />
                                    <span className="sr-only">{` (${counts[code]})`}</span>
                                </>
                            )}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
