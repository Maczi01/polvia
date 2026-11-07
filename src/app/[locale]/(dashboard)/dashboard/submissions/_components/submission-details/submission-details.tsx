import type { ReactNode } from 'react';

import { formatAddress, formatHours } from '@/lib/add-business/submission-email-format';
import type { ServiceSubmission } from '@/lib/service-submissions';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/** Adres podany przez zglaszajacego: link tylko dla http(s), inaczej `javascript:` w panelu. */
function isHttpUrl(value: string): boolean {
    try {
        return HTTP_PROTOCOLS.has(new URL(value).protocol);
    } catch {
        return false;
    }
}

function UrlValue({ url }: { url: string | null | undefined }) {
    if (!url) return <>-</>;
    if (!isHttpUrl(url)) return <>{url}</>;
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-blue-600 hover:underline dark:text-blue-400"
        >
            {url}
        </a>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm">{children || '-'}</dd>
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">{title}</h2>
            {children}
        </section>
    );
}

function warnings(submission: ServiceSubmission): string[] {
    return [
        ...(submission.manualPin ? ['Pin set manually by the owner: check it against the address.'] : []),
        ...(submission.missingCoordinates ? ['Geocoding failed: fill in latitude and longitude.'] : []),
        ...(submission.unconfirmed.length > 0
            ? [`Not confirmed by the website: ${submission.unconfirmed.join(', ')}`]
            : []),
        ...(submission.changedByOwner.length > 0
            ? [`Changed by the owner: ${submission.changedByOwner.join(', ')}`]
            : []),
    ];
}

export function SubmissionDetails({ submission }: { submission: ServiceSubmission }) {
    const { entry, slug } = submission;
    const [location] = entry.locations;
    const notices = warnings(submission);
    const hours = formatHours(location?.openingHours, day => day.slice(0, 3)).join(', ');

    return (
        <div className="space-y-6">
            {notices.length > 0 && (
                <Section title="Check before publishing">
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {notices.map(notice => (
                            <li key={notice}>{notice}</li>
                        ))}
                    </ul>
                </Section>
            )}

            <Section title="Company">
                <dl className="divide-y">
                    <Row label="Category">{entry.category}</Row>
                    <Row label="Coverage">{entry.coverage}</Row>
                    <Row label="Address">{formatAddress(location)}</Row>
                    <Row label="Phone">{location?.phoneNumber}</Row>
                    <Row label="Email">{location?.email}</Row>
                    <Row label="Website">
                        <UrlValue url={location?.webpage} />
                    </Row>
                    <Row label="Languages">{entry.languages?.join(', ')}</Row>
                    <Row label="Hours">{hours}</Row>
                    <Row label="Description (pl)">{entry.translations.pl.description}</Row>
                </dl>
            </Section>

            <Section title="Submitted by">
                <dl className="divide-y">
                    <Row label="Email">
                        <a
                            href={`mailto:${submission.submitterEmail}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                            {submission.submitterEmail}
                        </a>
                    </Row>
                    <Row label="Notes">{submission.notes}</Row>
                    <Row label="Premium info consent">
                        {submission.premiumInfoConsent ? 'Yes' : 'No'}
                    </Row>
                    <Row label="Form language">{submission.locale}</Row>
                    <Row label="Source">{submission.source}</Row>
                    <Row label="Source URL">
                        <UrlValue url={submission.sourceUrl} />
                    </Row>
                </dl>
            </Section>

            <Section title="Publish manually">
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                    <li>
                        Save the JSON as <code>data/services/{slug}.json</code>
                        {submission.hasLogo && (
                            <>
                                {' '}
                                and the logo as <code>public/services/{slug}.png</code>
                            </>
                        )}
                        .
                    </li>
                    <li>
                        Run <code>npm run db:add -- data/services/{slug}.json --dry-run</code>, then
                        without <code>--dry-run</code>.
                    </li>
                    <li>Mark this submission as added.</li>
                </ol>
            </Section>

            <Section title="JSON">
                <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                    {JSON.stringify(entry, null, 4)}
                </pre>
            </Section>
        </div>
    );
}
