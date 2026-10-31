import { MapPin } from 'lucide-react';
import Image from 'next/image';
import type { ReactElement } from 'react';

import { ProfileAbout } from '../profile-about/profile-about';
import { ProfileActions } from '../profile-actions/profile-actions';
import { ProfileBadges } from '../profile-badges/profile-badges';
import { ProfileContact } from '../profile-contact/profile-contact';
import { ProfileFaq } from '../profile-faq/profile-faq';
import { ProfileGallery } from '../profile-gallery/profile-gallery';
import { getHeaderCity, getMainLocation } from '../profile-helpers';
import { ProfileHours } from '../profile-hours/profile-hours';
import { ProfileLocations } from '../profile-locations/profile-locations';
import { ProfileLogo } from '../profile-logo/profile-logo';
import { ProfilePriceList } from '../profile-price-list/profile-price-list';
import type { PremiumContent, ServiceProfileView } from '../service-profile-types';

const SECTION = 'rounded-2xl shadow-sm';
const GALLERY_PREVIEW = 6;

type TemplateClassicProps = {
    profile: ServiceProfileView;
    premium: PremiumContent;
};

/**
 * Szablon „Klasyczny”: wizytowka z banerem, logo nachodzacym na baner i nazwa
 * na srodku; ponizej tresc i kontakt w dwoch kolumnach. Bez cover baner ma
 * gradient w kolorach serwisu.
 */
export function TemplateClassic({ profile, premium }: TemplateClassicProps): ReactElement {
    const mainLocation = getMainLocation(profile.locations);
    const city = getHeaderCity(profile);
    const showNavigate = profile.coverage !== 'online';

    return (
        <article className="bg-gray-50 pb-12 dark:bg-gray-900">
            <div className="mx-auto max-w-6xl sm:px-6 sm:pt-6 lg:px-8">
                <header className="overflow-hidden bg-white shadow-sm dark:bg-gray-800 sm:rounded-3xl">
                    <div className="relative h-44 sm:h-60 md:h-72">
                        {premium.coverImage ? (
                            <Image
                                src={premium.coverImage.src}
                                alt={premium.coverImage.alt}
                                fill
                                priority
                                sizes="(min-width: 1152px) 1152px, 100vw"
                                className="object-cover"
                            />
                        ) : (
                            <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-gradient-to-r from-green-700 via-green-500 to-brand/80"
                            />
                        )}
                    </div>
                    <div className="-mt-14 flex flex-col items-center px-4 pb-8 text-center sm:px-8 md:-mt-16">
                        <ProfileLogo
                            name={profile.name}
                            logo={profile.logo}
                            size={128}
                            priority
                            className="relative size-28 rounded-full border-0 shadow-lg ring-4 ring-white dark:ring-gray-800 md:size-32"
                        />
                        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 md:text-4xl">
                            {profile.name}
                        </h1>
                        {city && (
                            <p className="mt-2 flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                                <MapPin size={16} aria-hidden="true" />
                                {city}
                            </p>
                        )}
                        <ProfileBadges
                            category={profile.category}
                            coverage={profile.coverage}
                            verified={profile.verified}
                            className="mt-4 justify-center"
                        />
                        <ProfileActions
                            location={mainLocation}
                            showNavigate={showNavigate}
                            layout="centered"
                            className="mt-6 w-full max-w-2xl"
                        />
                    </div>
                </header>

                <div className="mt-6 grid gap-6 px-4 sm:px-0 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <ProfileAbout
                            description={profile.description}
                            languages={profile.languages}
                            tags={profile.tags}
                            className={SECTION}
                        />
                        <ProfileGallery
                            images={premium.gallery}
                            layout="grid"
                            previewLimit={GALLERY_PREVIEW}
                            className={SECTION}
                        />
                        <ProfilePriceList items={premium.priceList} className={SECTION} />
                        <ProfileFaq items={premium.faq} className={SECTION} />
                    </div>
                    <div className="flex flex-col gap-6">
                        <ProfileContact
                            location={mainLocation}
                            showActions={false}
                            showNavigate={showNavigate}
                            className={SECTION}
                        />
                        {mainLocation && (
                            <ProfileHours openingHours={mainLocation.openingHours} className={SECTION} />
                        )}
                        <ProfileLocations profile={profile} className={SECTION} />
                    </div>
                </div>
            </div>
        </article>
    );
}
