'use client';

import { Clock, Globe, type LucideIcon, Mail, MapPin, Phone } from 'lucide-react';
import Image from 'next/image';
import { hasLocale, useLocale, useTranslations } from 'next-intl';
import type { JSX, ReactNode } from 'react';

import { Badge } from '@/components/ui/badge/badge';
import { Card } from '@/components/ui/card';
import type { FactField } from '@/lib/add-business/draft-schema';
import { LANGUAGE_CODES, type LanguageCode } from '@/lib/add-business/form-limits';
import type { BusinessPreview, DraftPin } from '@/lib/add-business/types';
import { CATEGORY_DEFINITIONS } from '@/lib/categories';
import { cn } from '@/lib/utilities';
import { WEEKDAY_KEYS } from '@/lib/weekdays';

import { StaticMapPin } from './static-map-pin';

/**
 * Podglad karty wpisu (R5, D12). Klasy odwzorowane 1:1 z ROZWINIETEJ `service-card.tsx`
 * (bez jej efektow: licznika klikniec, callbackow mapy, animacji rozwijania).
 * Pomiar logo: `Card` ma `p-2 md:p-4`, naglowek `p-1 md:p-0` — lewa krawedz logo to
 * 12 px na telefonie i 16 px od `md`, jak w katalogu.
 *
 * Swiadome roznice wzgledem karty: brak strzalki rozwijania i przyciskow akcji (podglad
 * nie dzwoni ani nie nawiguje), brak `z-[99]`, logo ma `size-14` (preflight daje `img`
 * `height: auto`, a logo ze strony bywa prostokatne), dni tygodnia z malej litery (karta
 * szuka `Monday` i nie pokazuje godzin — znany dlug, plan U9).
 */

const LANGUAGE_FLAGS: Record<LanguageCode, string> = {
    pl: '/icons/pl.svg',
    en: '/icons/gb.svg',
    ru: '/icons/ru.svg',
    uk: '/icons/ua.svg',
};

const DEFAULT_LOGO = '/default.png';

/** `getDay()`: 0 = niedziela; `WEEKDAY_KEYS` zaczyna sie od poniedzialku. */
function todayKey(): (typeof WEEKDAY_KEYS)[number] {
    return WEEKDAY_KEYS[(new Date().getDay() + 6) % 7];
}

function formatAddress({ street, postcode, city }: BusinessPreview): string {
    const place = [postcode, city].filter(part => part !== null && part.trim() !== '').join(' ');
    return [street, place].filter(part => part !== null && part.trim() !== '').join(', ');
}

function PendingMarker(): JSX.Element {
    const t = useTranslations('addBusiness.preview');
    return (
        <span className="ml-1.5 inline-flex items-center whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100">
            {t('unconfirmed')}
        </span>
    );
}

interface DetailRowProps {
    icon: LucideIcon;
    label: string;
    value: ReactNode;
    isPending: boolean;
    valueClassName?: string;
}

/** Wiersz szczegolu karty. Brak wartosci + pole niepotwierdzone = etykieta i znacznik (R4). */
function DetailRow({
    icon: Icon,
    label,
    value,
    isPending,
    valueClassName,
}: DetailRowProps): JSX.Element | null {
    if (!value && !isPending) return null;
    return (
        <div className="flex items-start gap-2.5 text-sm">
            <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
                {value ? (
                    <span className={valueClassName}>{value}</span>
                ) : (
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                )}
                {isPending && <PendingMarker />}
            </span>
        </div>
    );
}

export interface BusinessCardPreviewProps {
    preview: BusinessPreview;
    /** Pola do uzupelnienia — znacznik dostaja tylko te, ktore wciaz sa puste. */
    unconfirmed: readonly FactField[];
    logoSrc: string | null;
    pin: DraftPin | null;
}

export function BusinessCardPreview(props: BusinessCardPreviewProps): JSX.Element {
    const { preview, unconfirmed, logoSrc, pin } = props;
    const t = useTranslations('addBusiness');
    const tCard = useTranslations('MapCard');
    const locale = useLocale();
    const language: LanguageCode = hasLocale(LANGUAGE_CODES, locale) ? locale : 'pl';

    const isPending = (...fields: FactField[]): boolean =>
        fields.some(field => unconfirmed.includes(field));
    const address = formatAddress(preview);
    const todayHours = preview.openingHours?.[todayKey()] ?? null;
    const servesRemotely = preview.coverage === 'online' || preview.coverage === 'hybrid';
    const badgeColor = CATEGORY_DEFINITIONS[preview.category].badgeColor;
    const image = logoSrc ?? DEFAULT_LOGO;
    const description = preview.descriptions[language];

    return (
        <Card
            className={cn(
                'transition-all duration-300 ease-in-out bg-white dark:bg-gray-800',
                'border-t-4 border-[#C52289]',
                'flex flex-col overflow-hidden border-gray-200 dark:border-gray-700',
            )}
        >
            <div className="relative p-1 md:p-0">
                <div className="flex items-start gap-3">
                    <div className="shrink-0">
                        <Image
                            src={image}
                            alt={t('preview.logoAlt', {
                                name: preview.name ?? t('preview.namePlaceholder'),
                            })}
                            className="size-14 overflow-hidden rounded-full border-2 border-gray-200 object-cover dark:border-gray-600"
                            width={56}
                            height={56}
                            // blob: i logo z obcej strony nie przechodza przez optymalizator Next.
                            unoptimized={!image.startsWith('/')}
                        />
                    </div>

                    <div className="min-w-0 flex-1 pr-10">
                        <div className="flex items-center gap-2">
                            <h3 className="break-words text-base font-bold text-gray-900 dark:text-gray-100 md:text-lg">
                                {preview.name ?? (
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('preview.namePlaceholder')}
                                    </span>
                                )}
                                {isPending('name') && preview.name === null && <PendingMarker />}
                            </h3>
                            {servesRemotely && (
                                <Badge variant="aqua" className="shrink-0">
                                    {tCard('coverage_online')}
                                </Badge>
                            )}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            {description || preview.city}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-2 space-y-4 px-1 pb-1 md:px-0 md:pb-0">
                <div className="flex gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <DetailRow
                            icon={MapPin}
                            label={t('fields.address')}
                            value={address}
                            isPending={isPending('street', 'postcode', 'city')}
                        />
                        <DetailRow
                            icon={Clock}
                            label={t('fields.openingHours')}
                            value={
                                todayHours && (
                                    <>
                                        {tCard('today')}:{' '}
                                        <span className="font-semibold">
                                            {todayHours.open} – {todayHours.close}
                                        </span>
                                    </>
                                )
                            }
                            isPending={isPending('openingHours') && preview.openingHours === null}
                        />
                        <DetailRow
                            icon={Phone}
                            label={t('fields.phoneNumber')}
                            value={preview.phoneNumber}
                            isPending={isPending('phoneNumber') && preview.phoneNumber === null}
                        />
                        <DetailRow
                            icon={Globe}
                            label={t('fields.webpage')}
                            value={preview.webpage}
                            isPending={false}
                            valueClassName="break-all text-blue-600 dark:text-blue-400"
                        />
                        <DetailRow
                            icon={Mail}
                            label={t('fields.email')}
                            value={preview.email}
                            isPending={isPending('email') && preview.email === null}
                            valueClassName="break-all"
                        />
                    </div>

                    {preview.languages.length > 0 && (
                        <div className="flex shrink-0 flex-col items-end">
                            <span className="text-xs font-semibold tracking-wider text-gray-400 dark:text-gray-500">
                                {tCard('languages')}
                            </span>
                            <div className="mt-1.5 flex gap-1.5">
                                {preview.languages.map(code => (
                                    <Image
                                        key={code}
                                        src={LANGUAGE_FLAGS[code]}
                                        alt={t(`languages.${code}`)}
                                        width={28}
                                        height={20}
                                        className="rounded-sm"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {preview.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {preview.tags.map(tag => (
                            <Badge key={tag.pl} label={tag[language]} variant={badgeColor} />
                        ))}
                    </div>
                )}

                <StaticMapPin pin={pin} coverage={preview.coverage} address={address} />
            </div>
        </Card>
    );
}
