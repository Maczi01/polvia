import type { PremiumInterval } from '@/lib/premium-checkout-fields';

/**
 * Interwal zaznaczony na starcie — ten sam na profilu (`upgrade-cta`) i w `/cennik`, zeby
 * cena z cennika byla ta, ktora firma zobaczy przy zakupie. Miesieczny: na stronie zakupu
 * wstepnie zaznaczona jest nizsza kwota, a roczny zostaje swiadomym wyborem z plakietka
 * oszczednosci. Modul bez zaleznosci runtime'owych — czytaja go komponenty klienckie.
 */
export const DEFAULT_PREMIUM_INTERVAL: PremiumInterval = 'monthly';
