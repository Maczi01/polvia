'use client';

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

/** Radix Select nie przyjmuje pustej `value` w itemie — „Dowolny jezyk" ma wartosc-wartownika. */
const ANY_LANGUAGE = 'any';

type LanguageSelectProps = {
    /** Wybrany jezyk obslugi; `null` = bez filtra. */
    value: ServiceLanguage | null;
    onChange: (value: ServiceLanguage | null) => void;
    /** Liczba kart per jezyk przy pozostalych filtrach. Pominiete = bez licznikow. */
    counts?: Record<ServiceLanguage, number>;
    className?: string;
};

function LanguageLabel({ code }: { code: ServiceLanguage }): React.JSX.Element {
    return (
        <span className="flex items-center gap-2">
            <Image
                src={LANGUAGE_FLAG_PATHS[code]}
                alt=""
                width={20}
                height={14}
                className="rounded-sm"
            />
            {/* Endonim jest w swoim jezyku — `lang` daje czytnikowi poprawna wymowe. */}
            <span lang={code}>{LANGUAGE_ENDONYMS[code]}</span>
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
    className,
}: LanguageSelectProps): React.JSX.Element {
    const t = useTranslations('MapPage');

    const handleValueChange = (next: string): void => {
        onChange(isServiceLanguage(next) ? next : null);
    };

    return (
        <Select value={value ?? ANY_LANGUAGE} onValueChange={handleValueChange}>
            <SelectTrigger aria-label={t('languageFilter')} className={className}>
                {/* Wlasna tresc wyzwalacza: bez licznika, ktory jest tylko w liscie opcji. */}
                <SelectValue>
                    {value ? <LanguageLabel code={value} /> : t('anyLanguage')}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
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
