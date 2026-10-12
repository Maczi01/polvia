'use client';

import { useTranslations } from 'next-intl';
import type { ChangeEvent, JSX, ReactNode } from 'react';

import type { FieldErrors } from '@/lib/add-business/types';

import { TextField } from '../form-field/form-field';
import type { DraftValues, TextFieldName } from './draft-values';

interface BusinessFieldsProps {
    values: DraftValues;
    errors: FieldErrors;
    onChange: (name: TextFieldName, value: string) => void;
    /** Mapa z wyszukiwaniem — pod polami adresu, z ktorych bierze ulice i miasto. */
    map: ReactNode;
}

/** Pola tekstowe danych firmy (nazwy jak w `parseOwnerEdits`). */
export function BusinessFields({
    values,
    errors,
    onChange,
    map,
}: BusinessFieldsProps): JSX.Element {
    const t = useTranslations('addBusiness.fields');

    const textProps = (name: TextFieldName) => ({
        name,
        value: values[name],
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(name, event.target.value),
        error: errors[name],
    });

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <TextField {...textProps('name')} label={t('name')} isRequired />
            <TextField {...textProps('street')} label={t('street')} />
            <TextField {...textProps('postcode')} label={t('postcode')} />
            <TextField {...textProps('city')} label={t('city')} isRequired />
            {map && <div className="md:col-span-2">{map}</div>}
            <TextField {...textProps('phoneNumber')} type="tel" label={t('phoneNumber')} />
            <TextField {...textProps('email')} type="email" label={t('email')} />
            <div className="md:col-span-2">
                <TextField {...textProps('webpage')} type="url" label={t('webpage')} />
            </div>
        </div>
    );
}
