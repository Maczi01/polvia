import { MapPin } from 'lucide-react';
import Image from 'next/image';
import type { ReactElement } from 'react';

import { ProfileAbout } from '../profile-about/profile-about';
import { ProfileActions } from '../profile-actions/profile-actions';
import { ProfileBadges } from '../profile-badges/profile-badges';
import { ProfileBreadcrumbs } from '../profile-breadcrumbs/profile-breadcrumbs';
import { ProfileContact } from '../profile-contact/profile-contact';
import { ProfileFaq } from '../profile-faq/profile-faq';
import { ProfileGallery } from '../profile-gallery/profile-gallery';
import { getHeaderCity, getMainLocation } from '../profile-helpers';
import { ProfileHours } from '../profile-hours/profile-hours';
import { ProfileLocations } from '../profile-locations/profile-locations';
import { ProfileLogo } from '../profile-logo/profile-logo';
import { ProfilePriceList } from '../profile-price-list/profile-price-list';
import { ProfileRatings } from '../profile-ratings/profile-ratings';
import type { PremiumProfileView, ProfileImage, ProfileLocation } from '../service-profile-types';

/** Cienkie ramki, mniej zaokraglen, szeryfowe naglowki — powaga kancelarii. */
const SECTION =
    'rounded-lg border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900 md:p-8';
const TITLE = 'font-serif text-2xl font-semibold text-slate-900 dark:text-slate-50';
const ASIDE_SECTION = 'rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900';
const ASIDE_TITLE = 'font-serif text-lg font-semibold text-slate-900 dark:text-slate-50';
const GALLERY_PREVIEW = 4;

type TemplateProfessionalProps = {
    profile: PremiumProfileView;
};

type ProfessionalSectionProps = {
    profile: PremiumProfileView;
    mainLocation: ProfileLocation | null;
    showNavigate: boolean;
};

/** Cover jako ilustracja sekcji „O firmie”. */
function ProfessionalCover({ coverImage }: { coverImage: ProfileImage }): ReactElement {
    return (
        <div className="relative aspect-[21/9] overflow-hidden rounded-md">
            <Image
                src={coverImage.src}
                alt={coverImage.alt}
                fill
                sizes="(min-width: 1024px) 720px, 100vw"
                className="object-cover"
            />
        </div>
    );
}

/** Oszczedny naglowek bez zdjecia: logo, nazwa, miasto i odznaki obok akcji. */
function ProfessionalHeader({
    profile,
    mainLocation,
    showNavigate,
}: ProfessionalSectionProps): ReactElement {
    const city = getHeaderCity(profile);

    return (
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="h-1 bg-gradient-to-r from-slate-900 via-slate-700 to-brand" aria-hidden="true" />
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:py-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:px-8">
                <ProfileBreadcrumbs items={profile.breadcrumbs} className="lg:col-span-2" />
                <div className="flex items-start gap-4 md:gap-6">
                    <ProfileLogo
                        name={profile.name}
                        logo={profile.logo}
                        size={88}
                        priority
                        className="size-16 rounded-md border-slate-200 md:size-[88px]"
                    />
                    <div className="min-w-0">
                        <h1 className="font-serif text-3xl font-semibold leading-tight text-slate-900 dark:text-slate-50 md:text-5xl">
                            {profile.name}
                        </h1>
                        {city && (
                            <p className="mt-2 flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                <MapPin size={16} aria-hidden="true" />
                                {city}
                            </p>
                        )}
                        <ProfileBadges
                            category={profile.category}
                            coverage={profile.coverage}
                            verified={profile.verified}
                            className="mt-4"
                        />
                    </div>
                </div>
                <ProfileActions location={mainLocation} showNavigate={showNavigate} />
            </div>
        </header>
    );
}

/** Cennik i FAQ na pierwszym planie, potem opis z coverem i galeria. */
function ProfessionalMain({ profile }: { profile: PremiumProfileView }): ReactElement {
    const { premium } = profile;

    return (
        <div className="flex min-w-0 flex-col gap-6">
            <ProfilePriceList items={premium.priceList} className={SECTION} titleClassName={TITLE} />
            <ProfileFaq items={premium.faq} className={SECTION} titleClassName={TITLE} />
            <ProfileAbout
                description={profile.description}
                languages={profile.languages}
                tags={profile.tags}
                media={
                    premium.coverImage ? <ProfessionalCover coverImage={premium.coverImage} /> : null
                }
                className={SECTION}
                titleClassName={TITLE}
            />
            <ProfileGallery
                images={premium.gallery}
                layout="strip"
                previewLimit={GALLERY_PREVIEW}
                className={SECTION}
                titleClassName={TITLE}
            />
        </div>
    );
}

/** Kontakt, godziny i adresy w przyklejonej kolumnie. */
function ProfessionalAside({
    profile,
    mainLocation,
    showNavigate,
}: ProfessionalSectionProps): ReactElement {
    return (
        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
            <ProfileRatings
                ratings={profile.premium.ratings}
                className={ASIDE_SECTION}
                titleClassName={ASIDE_TITLE}
            />
            <ProfileContact
                location={mainLocation}
                showActions={false}
                showNavigate={showNavigate}
                className={ASIDE_SECTION}
                titleClassName={ASIDE_TITLE}
            />
            {mainLocation && (
                <ProfileHours
                    openingHours={mainLocation.openingHours}
                    className={ASIDE_SECTION}
                    titleClassName={ASIDE_TITLE}
                />
            )}
            <ProfileLocations
                profile={profile}
                className={ASIDE_SECTION}
                titleClassName={ASIDE_TITLE}
            />
        </div>
    );
}

/**
 * Szablon „Profesjonalny” (prawnicy, ksiegowi, lekarze): oszczedny naglowek bez
 * zdjecia, cennik i FAQ na pierwszym planie, kontakt w przyklejonej kolumnie.
 * Cover, jesli jest, ilustruje sekcje „O firmie” zamiast dominowac nad trescia.
 */
export function TemplateProfessional({ profile }: TemplateProfessionalProps): ReactElement {
    const sectionProps: ProfessionalSectionProps = {
        profile,
        mainLocation: getMainLocation(profile.locations),
        showNavigate: profile.coverage !== 'online',
    };

    return (
        <article className="bg-slate-50 dark:bg-slate-950">
            <ProfessionalHeader {...sectionProps} />

            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:py-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:px-8">
                <ProfessionalMain profile={profile} />
                <ProfessionalAside {...sectionProps} />
            </div>
        </article>
    );
}
