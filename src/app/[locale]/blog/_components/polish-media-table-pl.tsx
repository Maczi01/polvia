// components/PolishMediaTables.tsx
import React, { JSX } from 'react';

// Type definitions
interface PolishMediaItem {
    medium: string;
    rodzaj: string;
    status: string;
    kontakt: string;
    charakterystyka: string;
}

interface EnglishMediaItem {
    medium: string;
    type: string;
    status: string;
    contact: string;
    characteristics: string;
}

// Enhanced Status Badge Component
function StatusBadge({ status, className = "" }: { status: string; className?: string }): JSX.Element {
    const isActive = status.toLowerCase().includes('aktywn') || status.toLowerCase().includes('active');

    if (isActive) {
        return (
            <span className={`inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400 ${className}`}>
        <span className="mr-1.5 size-1.5 rounded-full bg-green-500 dark:bg-green-400"></span>
                {status}
      </span>
        );
    } else {
        return (
            <span className={`inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400 ${className}`}>
        <span className="mr-1.5 size-1.5 rounded-full bg-red-500 dark:bg-red-400"></span>
                {status}
      </span>
        );
    }
}

// Contact Link Component
function ContactLink({ contact }: { contact: string }): JSX.Element {
    const hasLink = contact.includes('.') && (contact.includes('http') || contact.includes('www') || contact.includes('.ie') || contact.includes('.pl') || contact.includes('.com'));

    if (hasLink) {
        const parts = contact.split('–');
        const website = parts[0]?.trim();
        const restInfo = parts.slice(1).join('–').trim();

        return (
            <div className="space-y-1">
                <a
                    href={website?.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                >
                    {website}
                </a>
                {restInfo && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                        {restInfo}
                    </div>
                )}
            </div>
        );
    }

    return (
        <span className="text-sm text-gray-900 dark:text-gray-100">
      {contact}
    </span>
    );
}

// Card-based Media Item Component for Mobile
function MediaCard({ item, isPolish }: { item: PolishMediaItem | EnglishMediaItem; isPolish: boolean }): JSX.Element {
    const data = isPolish ? item as PolishMediaItem : item as EnglishMediaItem;
    const typeField = isPolish ? (data as PolishMediaItem).rodzaj : (data as EnglishMediaItem).type;
    const contactField = isPolish ? (data as PolishMediaItem).kontakt : (data as EnglishMediaItem).contact;
    const characteristicsField = isPolish ? (data as PolishMediaItem).charakterystyka : (data as EnglishMediaItem).characteristics;

    return (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-col space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {data.medium}
                </h3>
                <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {typeField}
          </span>
                    <StatusBadge status={data.status} />
                </div>
            </div>

            <div className="space-y-2">
                <div>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {isPolish ? 'Kontakt' : 'Contact'}
          </span>
                    <div className="mt-1">
                        <ContactLink contact={contactField} />
                    </div>
                </div>

                <div>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {isPolish ? 'Charakterystyka' : 'Characteristics'}
          </span>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {characteristicsField}
                    </p>
                </div>
            </div>
        </div>
    );
}

// Responsive Table Component
function ResponsiveTable({ children, className = "" }: { children: React.ReactNode; className?: string }): JSX.Element {
    return (
        <div className={`my-6 ${className}`}>
            {/* Desktop Table */}
            <div className="hidden lg:block">
                <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm dark:border-gray-700 dark:shadow-gray-900/20">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        {children}
                    </table>
                </div>
            </div>
        </div>
    );
}

function TableHeader({ children, className = "" }: { children: React.ReactNode; className?: string }): JSX.Element {
    return (
        <thead className={`bg-gray-50 dark:bg-gray-800 ${className}`}>
        {children}
        </thead>
    );
}

function TableBody({ children, className = "" }: { children: React.ReactNode; className?: string }): JSX.Element {
    return (
        <tbody className={`divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900 ${className}`}>
        {children}
        </tbody>
    );
}

function TableRow({ children, className = "" }: { children: React.ReactNode; className?: string }): JSX.Element {
    return (
        <tr className={`ml-2 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800 ${className}`}>
            {children}
        </tr>
    );
}

function TableHead({ children, className = "" }: { children: React.ReactNode; className?: string }): JSX.Element {
    return (
        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 ${className}`}>
            {children}
        </th>
    );
}

function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }): JSX.Element {
    return (
        <td className={`ml-2 px-4 py-3 text-sm ${className}`}>
            {children}
        </td>
    );
}

// Polish version data
const polishMediaData: PolishMediaItem[] = [
    {
        medium: "Nasza Gazeta w Irlandii (NG24)",
        rodzaj: "Tygodnik polonijny (print + online)",
        status: "Aktywna (od 2023)",
        kontakt: "ng24.ie – redakcja@ng24.ie, tel. +353 89...",
        charakterystyka: "Bezpłatny tygodnik informacyjny dla Polaków w Irlandii; wiadomości, poradniki, kultura. Czytelnicy: ogół Polonii (różne grupy wiekowe)."
    },
    {
        medium: "MIR Magazyn",
        rodzaj: "Magazyn kulturalno-rozrywkowy",
        status: "Aktywny (miesięcznik)",
        kontakt: "mir.info.pl – magazyn.mir@gmail.com, Cork tel. 021...",
        charakterystyka: "Pismo lifestyle'owe i kulturalne; wydarzenia polonijne, wywiady, zdrowie. Czytelnicy: Polacy szukający rozrywki i kultury."
    },
    {
        medium: "Polonia Irlandia",
        rodzaj: "Portal informacyjny online",
        status: "Aktywny (codzienne newsy)",
        kontakt: "poloniairlandia.pl – info@poloniairlandia.pl",
        charakterystyka: "Najpopularniejszy portal newsowy dla Polonii; wiadomości, porady integracyjne, forum. Odbiorcy: szeroka Polonia (rodziny, pracownicy)."
    },
    {
        medium: "Polska-IE.com",
        rodzaj: "Portal publicystyczny online",
        status: "Aktywny",
        kontakt: "polska-ie.com – info@polska-ie.com",
        charakterystyka: "Serwis polityczno-społeczny; analizy wpływu wydarzeń na życie emigrantów. Odbiorcy: świadomi obywatele, przedsiębiorcy."
    },
    {
        medium: "Irlandia.ie",
        rodzaj: "Portal informacyjny online",
        status: "Aktywny (rzadsze aktual.)",
        kontakt: "irlandia.ie – kontakt przez FB/Twitter",
        charakterystyka: "Pierwszy polski portal (od 2006); unikalne treści polonijne, kalendarium wydarzeń. Odbiorcy: długoletnia Polonia, zainteresowani historią i publicystyką."
    },
    {
        medium: "Polska Gazeta (Gazeta.ie)",
        rodzaj: "Tygodnik/portal (dawniej)",
        status: "Zakończony (druk)",
        kontakt: "gazeta.ie / ogloszenia.gazeta.ie",
        charakterystyka: "Pierwszy polski tygodnik w Irlandii (lata 2005–2010); obecnie działa tylko sekcja ogłoszeń (integracja ekonomiczna Polonii)."
    },
    {
        medium: "Hello Irlandia (Polish Show)",
        rodzaj: "Audycja radiowa + portal",
        status: "Aktywna (od 2021)",
        kontakt: "helloirlandia.ie – plinirlandia@gmail.com",
        charakterystyka: "Cotygodniowa audycja radiowa (103.2 FM) + multimedia; muzyka, wywiady, newsy. Słuchacze: młodsza Polonia, również Irlandczycy ciekawi Polski."
    },
    {
        medium: "Radio Cenzura",
        rodzaj: "Radio internetowe",
        status: "Aktywne (od 2020)",
        kontakt: "radiocenzura.pl (stream online, YouTube)",
        charakterystyka: "Niezależne radio online z Kildare; muzyka, audycje na żywo, tematy społeczne i kultura. Słuchacze: Polacy 30-50, zainteresowani rozmową i alternatywą."
    },
    {
        medium: "Studio Dublin (Radio Wnet)",
        rodzaj: "Pasmo radiowe (Polska)",
        status: "Aktywne (we współpracy)",
        kontakt: "wnet.fm (Studio 37 Dublin)",
        charakterystyka: "Polskie radio nadające z Dublina na antenie w Polsce; newsy polonijne dla słuchaczy w kraju i diaspora."
    }
];

// English version data
const englishMediaData: EnglishMediaItem[] = [
    {
        medium: "Nasza Gazeta w Irlandii (NG24)",
        type: "Polish community weekly (print + online)",
        status: "Active (since 2023)",
        contact: "ng24.ie – redakcja@ng24.ie, tel. +353 89...",
        characteristics: "Free information weekly for Poles in Ireland; news, guides, culture. Readers: general Polish community (various age groups)."
    },
    {
        medium: "MIR Magazine",
        type: "Cultural and entertainment magazine",
        status: "Active (monthly)",
        contact: "mir.info.pl – magazyn.mir@gmail.com, Cork tel. 021...",
        characteristics: "Lifestyle and cultural magazine; Polish events, interviews, health. Readers: Poles looking for entertainment and culture."
    },
    {
        medium: "Polonia Irlandia",
        type: "Online information portal",
        status: "Active (daily news)",
        contact: "poloniairlandia.pl – info@poloniairlandia.pl",
        characteristics: "The most popular news portal for the Polish community; news, integration advice, forum. Recipients: broad Polish community (families, workers)."
    },
    {
        medium: "Polska-IE.com",
        type: "Online publicist portal",
        status: "Active",
        contact: "polska-ie.com – info@polska-ie.com",
        characteristics: "Political-social service; analyses of the impact of events on the life of emigrants. Recipients: conscious citizens, entrepreneurs."
    },
    {
        medium: "Irlandia.ie",
        type: "Online information portal",
        status: "Active (less frequent updates)",
        contact: "irlandia.ie – contact via FB/Twitter",
        characteristics: "The first Polish portal (since 2006); unique Polish community content, calendar of events. Recipients: long-term Polish community, those interested in history and journalism."
    },
    {
        medium: "Polska Gazeta (Gazeta.ie)",
        type: "Weekly/portal (formerly)",
        status: "Ended (print)",
        contact: "gazeta.ie / ogloszenia.gazeta.ie",
        characteristics: "The first Polish weekly in Ireland (2005-2010); currently only the classified ads section operates (economic integration of the Polish community)."
    },
    {
        medium: "Hello Irlandia (Polish Show)",
        type: "Radio broadcast + portal",
        status: "Active (since 2021)",
        contact: "helloirlandia.ie – plinirlandia@gmail.com",
        characteristics: "Weekly radio broadcast (103.2 FM) + multimedia; music, interviews, news. Listeners: younger Polish community, also Irish people curious about Poland."
    },
    {
        medium: "Radio Cenzura",
        type: "Internet radio",
        status: "Active (since 2020)",
        contact: "radiocenzura.pl (stream online, YouTube)",
        characteristics: "Independent online radio from Kildare; music, live broadcasts, social topics, and culture. Listeners: Poles 30-50, interested in conversation and alternative."
    },
    {
        medium: "Studio Dublin (Radio Wnet)",
        type: "Radio band (Poland)",
        status: "Active (in cooperation)",
        contact: "wnet.fm (Studio 37 Dublin)",
        characteristics: "Polish radio broadcasting from Dublin on the antenna in Poland; Polish community news for listeners in the country and the diaspora."
    }
];

// Enhanced Polish Media Table Component with Responsive Design
export function PolishMediaTable(): JSX.Element {
    return (
        <>
            {/* Desktop Table */}
            <ResponsiveTable>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-1/5">Medium</TableHead>
                        <TableHead className="w-1/6">Rodzaj</TableHead>
                        <TableHead className="w-1/8">Status (2025)</TableHead>
                        <TableHead className="w-1/5">Strona / Kontakt</TableHead>
                        <TableHead className="w-2/5">Charakterystyka i grupa docelowa</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {polishMediaData.map((item: PolishMediaItem, index: number) => (
                        <TableRow key={index}>
                            <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                                {item.medium}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                                {item.rodzaj}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={item.status} />
                            </TableCell>
                            <TableCell>
                                <ContactLink contact={item.kontakt} />
                            </TableCell>
                            <TableCell className="leading-relaxed text-gray-700 dark:text-gray-300">
                                {item.charakterystyka}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </ResponsiveTable>

            {/* Mobile Cards */}
            <div className="my-6 space-y-4 lg:hidden">
                {polishMediaData.map((item: PolishMediaItem, index: number) => (
                    <MediaCard key={index} item={item} isPolish={true} />
                ))}
            </div>
        </>
    );
}

// Enhanced English Media Table Component with Responsive Design
export function EnglishMediaTable(): JSX.Element {
    return (
        <>
            {/* Desktop Table */}
            <ResponsiveTable>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-1/5">Medium</TableHead>
                        <TableHead className="w-1/6">Type</TableHead>
                        <TableHead className="w-1/8">Status (2025)</TableHead>
                        <TableHead className="w-1/5">Website / Contact</TableHead>
                        <TableHead className="w-2/5">Characteristics and target group</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {englishMediaData.map((item: EnglishMediaItem, index: number) => (
                        <TableRow key={index}>
                            <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                                {item.medium}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                                {item.type}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={item.status} />
                            </TableCell>
                            <TableCell>
                                <ContactLink contact={item.contact} />
                            </TableCell>
                            <TableCell className="leading-relaxed text-gray-700 dark:text-gray-300">
                                {item.characteristics}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </ResponsiveTable>

            {/* Mobile Cards */}
            <div className="my-6 space-y-4 lg:hidden">
                {englishMediaData.map((item: EnglishMediaItem, index: number) => (
                    <MediaCard key={index} item={item} isPolish={false} />
                ))}
            </div>
        </>
    );
}

// Export types for external use
export type { PolishMediaItem, EnglishMediaItem };