import { sql } from 'drizzle-orm';
import { db } from '../db';

async function dropAll() {
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
        DROP TYPE IF EXISTS status CASCADE;
        DROP TYPE IF EXISTS voivodeship CASCADE;
    `);

    console.log('✅ Baza wyczyszczona!');
}

dropAll().catch((err) => {
    console.error('❌ Błąd czyszczenia:', err);
    process.exit(1);
});
