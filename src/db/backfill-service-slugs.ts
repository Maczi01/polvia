/**
 * Jednorazowy backfill kolumny `services.slug` (adres profilu `/firma/<slug>`).
 *
 * Idempotentny: przydziela slug tylko wierszom, ktore go nie maja, a `UPDATE`
 * dodatkowo pilnuje `slug IS NULL`, wiec ponowne uruchomienie niczego nie zmienia.
 * Regula przydzialu (sufiksy `-2`, `-3`, kolejnosc po `createdAt`) zyje w
 * `service-slugs.ts`, gdzie jest testowana.
 *
 * Uruchomienie (po `drizzle-kit push` z nullowalna kolumna):
 *   npm run db:backfill-slugs -- --dry-run   # sam podglad przydzialu
 *   npm run db:backfill-slugs                # zapis
 *
 * Potem: sprawdz brak NULL i przelacz kolumne na `.notNull()` kolejnym `push`.
 */

import { and, inArray, isNull, type SQL, sql } from 'drizzle-orm';

import { db } from './index';
import { servicesTable } from './schema';
import { assignMissingServiceSlugs, type SlugAssignment } from './service-slugs';

/* eslint-disable no-console */

/** Jeden `UPDATE … SET slug = CASE id WHEN … END` zamiast zapytania na wiersz. */
function slugCase(assignments: readonly SlugAssignment[]): SQL {
    const branches = assignments.map(({ id, slug }) => sql`WHEN ${id}::uuid THEN ${slug}`);

    return sql`CASE ${servicesTable.id} ${sql.join(branches, sql` `)} END`;
}

async function main(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');

    const services = await db
        .select({
            id: servicesTable.id,
            name: servicesTable.name,
            slug: servicesTable.slug,
            createdAt: servicesTable.createdAt,
        })
        .from(servicesTable);

    const assignments = assignMissingServiceSlugs(services);
    console.log(`Uslug: ${services.length}, bez slugu: ${assignments.length}.`);

    if (assignments.length === 0) {
        console.log('Nic do zrobienia — kazda usluga ma juz slug.');
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }

    const nameById = new Map(services.map(service => [service.id, service.name]));
    for (const { id, slug } of assignments) {
        console.log(`  ${slug}  <-  ${nameById.get(id) ?? id}`);
    }

    if (isDryRun) {
        console.log('\n--dry-run: nic nie zapisano.');
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }

    const updated = await db
        .update(servicesTable)
        .set({ slug: slugCase(assignments) })
        .where(
            and(
                inArray(
                    servicesTable.id,
                    assignments.map(({ id }) => id),
                ),
                isNull(servicesTable.slug),
            ),
        )
        .returning({ id: servicesTable.id });

    console.log(`\nZapisano slug dla ${updated.length} uslug.`);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('Blad:', error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
});
