import { MapPin } from 'lucide-react';
import type { ReactElement } from 'react';

import { ProfileAbout } from '../profile-about/profile-about';
import { ProfileBadges } from '../profile-badges/profile-badges';
import { ProfileContact } from '../profile-contact/profile-contact';
import { getHeaderCity, getMainLocation } from '../profile-helpers';
import { ProfileHours } from '../profile-hours/profile-hours';
import { ProfileLocations } from '../profile-locations/profile-locations';
import { ProfileLogo } from '../profile-logo/profile-logo';
import { ProfileUpgradeCta } from '../profile-upgrade-cta/profile-upgrade-cta';
import type { ServiceProfileView } from '../service-profile-types';
import { SimilarServices } from '../similar-services/similar-services';

type ProfileFreeProps = {
    profile: ServiceProfileView;
};

/**
 * Darmowy profil: dane wpisu jak w karcie + „Podobne firmy” i CTA ulepszenia.
 * Desktop: tresc po lewej, kontakt i CTA w kolumnie po prawej. Mobile: kontakt
 * zaraz pod naglowkiem (najczestsza akcja), CTA na koncu tresci.
 */
export function ProfileFree({ profile }: ProfileFreeProps): ReactElement {
    const mainLocation = getMainLocation(profile.locations);
    const city = getHeaderCity(profile);
    const showNavigate = profile.coverage !== 'online';

    return (
        <article className="bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
                <header className="flex flex-col gap-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center md:gap-7 md:p-8">
                    <ProfileLogo
                        name={profile.name}
                        logo={profile.logo}
                        size={112}
                        priority
                        className="size-20 rounded-2xl md:size-28"
                    />
                    <div className="min-w-0">
                        <ProfileBadges
                            category={profile.category}
                            coverage={profile.coverage}
                            verified={profile.verified}
                        />
                        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50 md:text-4xl">
                            {profile.name}
                        </h1>
                        {city && (
                            <p className="mt-2 flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                                <MapPin size={16} aria-hidden="true" />
                                {city}
                            </p>
                        )}
                    </div>
                </header>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
                    <ProfileContact
                        location={mainLocation}
                        showActions
                        showNavigate={showNavigate}
                        className="lg:col-start-2 lg:row-start-1"
                    />
                    <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
                        <ProfileAbout
                            description={profile.description}
                            languages={profile.languages}
                            tags={profile.tags}
                        />
                        <ProfileLocations profile={profile} />
                        {mainLocation && <ProfileHours openingHours={mainLocation.openingHours} />}
                    </div>
                    <ProfileUpgradeCta
                        href={profile.upgradeHref}
                        className="self-start lg:col-start-2 lg:row-start-2"
                    />
                </div>

                <SimilarServices
                    services={profile.similarServices}
                    className="mt-12 border-t border-gray-200 pt-10 dark:border-gray-700"
                />
            </div>
        </article>
    );
}
