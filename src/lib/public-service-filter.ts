import { eq } from 'drizzle-orm';

import { servicesTable } from '@/db/schema';

/**
 * Warunek SQL: usluga widoczna publicznie (mapa, wyszukiwanie, landing page).
 *
 * Publiczne sa tylko wpisy `active` — `pending` czeka na moderacje, `inactive`
 * jest wylaczony z dashboardu. Jeden warunek dla wszystkich zapytan, bo gdy
 * filtrowala tylko czesc z nich, statystyki landing page liczyly aktywne firmy,
 * a mapa pokazywala wszystkie.
 */
export const isPublicService = eq(servicesTable.status, 'active');
