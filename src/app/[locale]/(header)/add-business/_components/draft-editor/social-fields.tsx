'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type JSX, useId, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import {
    PRIMARY_SOCIAL_KEYS,
    SOCIAL_KEYS,
    SOCIAL_URL_MAX_LENGTH,
    type SocialKey,
    WHATSAPP_NUMBER_MAX_LENGTH,
} from '@/lib/add-business/form-limits';
import type { FieldErrors } from '@/lib/add-business/types';
import { cn } from '@/lib/utilities';

import { TextField } from '../form-field/form-field';
import type { SocialValues } from './draft-values';

/** Nazwy wlasne serwisow — takie same w kazdym locale (jak etykiety ikon w `service-card`). */
const SERVICE_NAMES: Record<SocialKey, string> = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    threads: 'Threads',
    linkedin: 'LinkedIn',
    viber: 'Viber',
    tripadvisor: 'Tripadvisor',
    x: 'X',
};

/** Serwisy, w ktorych serwer zamienia uchwyt `@nazwa` na URL (`owner-socials-schema.ts`). */
const HANDLE_KEYS: ReadonlySet<SocialKey> = new Set([
    'telegram',
    'instagram',
    'tiktok',
    'x',
    'threads',
]);

/** Pole `socials.whatsapp` (link) od razu ukrywamy — numer obsluguje pole `whatsappNumber`. */
const PRIMARY_LINK_KEYS: readonly SocialKey[] = PRIMARY_SOCIAL_KEYS.filter(
    key => key !== 'whatsapp',
);

interface SocialFieldsProps {
    socials: SocialValues;
    whatsappNumber: string;
    /** Link WhatsApp bez numeru ze szkicu — tylko wtedy pokazujemy pole `socials.whatsapp`. */
    hasWhatsappLink: boolean;
    fieldErrors: FieldErrors;
    onSocialChange: (key: SocialKey, value: string) => void;
    onWhatsappNumberChange: (value: string) => void;
}

function otherKeys(hasWhatsappLink: boolean): SocialKey[] {
    return SOCIAL_KEYS.filter(
        key => !PRIMARY_LINK_KEYS.includes(key) && (key !== 'whatsapp' || hasWhatsappLink),
    );
}

/**
 * Komunikatory i social media (A): od razu WhatsApp (numer), Telegram, Facebook, Instagram;
 * reszta `SOCIAL_KEYS` pod „Dodaj inne". Ukryte pola zostaja w DOM-ie (`hidden`), wiec ich
 * wartosc nie ginie przy zwinieciu; disclosure otwiera sie sam, gdy ktores ma wartosc albo blad.
 */
export function SocialFields(props: SocialFieldsProps): JSX.Element {
    const { socials, whatsappNumber, hasWhatsappLink, fieldErrors } = props;
    const t = useTranslations('addBusiness.socials');
    const othersId = useId();
    const others = otherKeys(hasWhatsappLink);
    const [isOpen, setIsOpen] = useState(() => others.some(key => Boolean(socials[key])));
    const isExpanded = isOpen || others.some(key => fieldErrors[`socials.${key}`] !== undefined);

    const socialField = (key: SocialKey): JSX.Element => (
        <TextField
            key={key}
            name={`socials.${key}`}
            type="text"
            inputMode="url"
            autoComplete="off"
            label={key === 'whatsapp' ? t('whatsappLink') : SERVICE_NAMES[key]}
            placeholder={HANDLE_KEYS.has(key) ? t('handlePlaceholder') : t('linkPlaceholder')}
            maxLength={SOCIAL_URL_MAX_LENGTH}
            value={socials[key] ?? ''}
            onChange={event => props.onSocialChange(key, event.target.value)}
            error={fieldErrors[`socials.${key}`]}
        />
    );

    return (
        <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t('heading')}
            </legend>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('hint')}</p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <TextField
                    name="whatsappNumber"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    label={t('whatsappNumber')}
                    placeholder="+48 500 600 700"
                    maxLength={WHATSAPP_NUMBER_MAX_LENGTH}
                    value={whatsappNumber}
                    onChange={event => props.onWhatsappNumberChange(event.target.value)}
                    error={fieldErrors.whatsappNumber}
                />
                {PRIMARY_LINK_KEYS.map(socialField)}
            </div>
            <Button
                type="button"
                variant="link"
                aria-expanded={isExpanded}
                aria-controls={othersId}
                onClick={() => setIsOpen(!isExpanded)}
                className="h-auto p-0 text-green-700 dark:text-green-400"
            >
                <ChevronDown
                    aria-hidden
                    className={cn('transition-transform', isExpanded && 'rotate-180')}
                />
                {t('showOthers')}
            </Button>
            <div id={othersId} hidden={!isExpanded}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {others.map(socialField)}
                </div>
            </div>
        </fieldset>
    );
}
