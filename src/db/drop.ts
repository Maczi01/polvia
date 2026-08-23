import { sql } from 'drizzle-orm';
import { db } from '../db';
import { env } from '../../env';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/**
 * Zabezpieczenie przed skasowaniem zdalnej bazy.
 *
 * `db:drop` (a wiec i `db:reset`) wyglada w `package.json` niewinnie, a kasuje
 * wszystkie tabele i typy. Jesli `DATABASE_URL` wskazuje na cokolwiek innego niz
 * localhost, skrypt odmawia — chyba ze ktos swiadomie ustawi `ALLOW_REMOTE_DROP=yes`
 * na to jedno wywolanie.
 *
 * Powstalo po incydencie: `.env` w tym repo celuje w zdalna baze Supabase, a
 * `docker-compose` stawia lokalna na porcie 5433. Kto uruchomi `db:reset`
 * zakladajac, ze pracuje lokalnie, skasuje zdalna baze.
 */
function assertDropAllowed(): void {
    let host: string;
    try {
        host = new URL(env.DATABASE_URL).hostname;
    } catch {
        // Nie da sie ustalic hosta, wiec traktujemy jako zdalny — bezpieczniej odmowic.
        host = '(nieznany)';
    }

    if (LOCAL_HOSTS.has(host)) {
        return;
    }

    if (env.ALLOW_REMOTE_DROP === 'yes') {
        console.warn(
            `⚠️  Kasuje ZDALNA baze na hoscie: ${host}\n` +
                '   Wymuszone przez ALLOW_REMOTE_DROP=yes.',
        );
        return;
    }

    if (env.ALLOW_REMOTE_DROP !== undefined) {
        console.error(
            `\n⛔ ODMOWA: ALLOW_REMOTE_DROP ma wartosc "${env.ALLOW_REMOTE_DROP}", ` +
                `a wymagane jest dokladnie "yes".\n\n` +
                `     ALLOW_REMOTE_DROP=yes npm run db:drop\n`,
        );
        process.exit(1);
    }

    // console.error, nie throw — komunikat ma byc czytelny dla czlowieka
    // przy terminalu, nie stack trace.
    console.error(
        `\n⛔ ODMOWA: DATABASE_URL nie wskazuje na localhost.\n\n` +
            `   host: ${host}\n\n` +
            `   Ten skrypt kasuje WSZYSTKIE tabele i typy. Jesli naprawde chcesz to\n` +
            `   zrobic na tej bazie, uruchom swiadomie:\n\n` +
            `     ALLOW_REMOTE_DROP=yes npm run db:drop\n\n` +
            `   Lokalna baza z docker-compose stoi na porcie 5433 (baza "mydb").\n`,
    );
    process.exit(1);
}

async function dropAll() {
    assertDropAllowed();

    console.log('🗑️ Usuwam wszystkie tabele i typy...');

    await db.execute(sql`
      DROP TABLE IF EXISTS services_tags CASCADE;
      DROP TABLE IF EXISTS tags_translations CASCADE;
      DROP TABLE IF EXISTS tags CASCADE;
      DROP TABLE IF EXISTS services_translations CASCADE;
      DROP TABLE IF EXISTS service_locations CASCADE;
      DROP TABLE IF EXISTS service_engagements CASCADE;
      DROP TABLE IF EXISTS promoted_services CASCADE;
      DROP TABLE IF EXISTS newsletter_subscribers CASCADE;
      DROP TABLE IF EXISTS services CASCADE;
      DROP TYPE IF EXISTS category CASCADE;
      DROP TYPE IF EXISTS coverage CASCADE;
      DROP TYPE IF EXISTS status CASCADE;
      DROP TYPE IF EXISTS voivodeship CASCADE;
    `);

    console.log('✅ Baza wyczyszczona!');
}

dropAll()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Błąd czyszczenia:', error);
        process.exit(1);
    });
