/** Bez zaleznosci: importuje go komponent kliencki formularza odpowiedzi. */
const REPLY_SENT_AT_FORMAT = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
});

/** Strefa stala, nie przegladarki: serwer i klient renderuja ten sam tekst. */
export function formatReplySentAt(sentAt: Date): string {
    return REPLY_SENT_AT_FORMAT.format(sentAt);
}
