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

/** Sekcje na cieplym tle, bez ramek — zdjecia maja grac pierwsze skrzypce. */
const SECTION = 'rounded-3xl border-0 bg-stone-100/70 dark:bg-stone-900/60 md:p-8';
const TITLE = 'text-2xl font-bold tracking-tight md:text-3xl';

type TemplateGalleryProps = {
    profile: ServiceProfileView;
    premium: PremiumContent;
};

/**
 * Szablon „Galeria” (beauty, remonty, gastro): pelnoekranowy cover z nazwa na
 * zdjeciu i mozaika zdjec zaraz pod nim. Bez cover naglowek ma gradient marki.
 */
export function TemplateGallery({ profile, premium }: TemplateGalleryProps): ReactElement {
    const mainLocation = getMainLocation(profile.locations);
    const city = getHeaderCity(profile);
    const showNavigate = profile.coverage !== 'online';

    return (
        <article className="bg-white dark:bg-stone-950">
            <header className="relative isolate flex min-h-[420px] items-end overflow-hidden md:min-h-[560px]">
                {premium.coverImage ? (
                    <Image
                        src={premium.coverImage.src}
                        alt={premium.coverImage.alt}
                        fill
                        priority
                        sizes="100vw"
                        className="-z-20 object-cover"
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 -z-20 bg-gradient-to-br from-brand via-fuchsia-800 to-orange-500"
                    />
                )}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/10"
                />
                <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 md:pb-14 lg:px-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end md:gap-6">
                            <ProfileLogo
                                name={profile.name}
                                logo={profile.logo}
                                size={112}
                                priority
                                className="size-20 rounded-2xl border-0 shadow-xl ring-4 ring-white/90 md:size-28"
                            />
                            <div className="min-w-0">
                                <ProfileBadges
                                    category={profile.category}
                                    coverage={profile.coverage}
                                    verified={profile.verified}
                                />
                                <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white drop-shadow md:text-6xl">
                                    {profile.name}
                                </h1>
                                {city && (
                                    <p className="mt-2 flex items-center gap-1.5 text-lg text-white/85">
                                        <MapPin size={18} aria-hidden="true" />
                                        {city}
                                    </p>
                                )}
                            </div>
                        </div>
                        <ProfileActions
                            location={mainLocation}
                            showNavigate={showNavigate}
                            className="w-full lg:w-[420px]"
                        />
                    </div>
                </div>
            </header>

            <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 md:gap-14 md:py-14 lg:px-8">
                <ProfileGallery
                    images={premium.gallery}
                    layout="mosaic"
                    className="border-0 bg-transparent p-0 dark:bg-transparent md:p-0"
                    titleClassName={TITLE}
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
                    <div className="flex min-w-0 flex-col gap-6">
                        <ProfileAbout
                            description={profile.description}
                            languages={profile.languages}
                            tags={profile.tags}
                            className={SECTION}
                            titleClassName={TITLE}
                        />
                        <ProfilePriceList
                            items={premium.priceList}
                            className={SECTION}
                            titleClassName={TITLE}
                        />
                        <ProfileFaq items={premium.faq} className={SECTION} titleClassName={TITLE} />
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
