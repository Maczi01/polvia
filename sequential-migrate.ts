import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'mydb'
});

const db = drizzle(pool);

async function applyMigration(filePath: string) {
    console.log(`Applying migration: ${path.basename(filePath)}`);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
        // Split the SQL file by semicolons to execute statements separately
        const statements = sql.split(';').filter(stmt => stmt.trim() !== '');

        for (const stmt of statements) {
            if (stmt.trim()) {
                await pool.query(stmt);
            }
        }
        console.log(`✅ Successfully applied migration: ${path.basename(filePath)}`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to apply migration: ${path.basename(filePath)}`);
        console.error(err);
        return false;
    }
}

async function main() {
    try {
        console.log('Running migrations sequentially...');

        // Get all migration files
        const migrationsDir = './drizzle';
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Ensure files are in order

        // Apply migrations one by one
        for (const file of migrationFiles) {
            const success = await applyMigration(path.join(migrationsDir, file));
            if (!success) {
                console.log(`Stopping at migration: ${file}`);
                break;
            }
        }
    } catch (err) {
        console.error('Migration process failed:', err);
    } finally {
        await pool.end();
    }
}

main();
