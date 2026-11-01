import { databaseHostname, isLocalDatabaseUrl } from './database-host';

describe('isLocalDatabaseUrl', () => {
    it.each([
        'postgres://user:secret@localhost:5433/mydb',
        'postgresql://user:secret@127.0.0.1:5432/mydb',
        'postgres://user:secret@[::1]:5432/mydb',
        'postgres://user:secret@0.0.0.0:5433/mydb',
        'postgres://user:secret@LOCALHOST/mydb',
    ])('%s to baza lokalna', url => {
        expect(isLocalDatabaseUrl(url)).toBe(true);
    });

    it.each([
        'postgres://user:secret@db.abcd.supabase.co:5432/postgres',
        'postgres://user:secret@localhost.attacker.example/db',
        'postgres://user:secret@10.0.0.5:5432/db',
    ])('%s to baza zdalna', url => {
        expect(isLocalDatabaseUrl(url)).toBe(false);
    });

    it.each(['', 'not a url', 'localhost:5432'])(
        'niepoprawny adres "%s" jest traktowany jak zdalny',
        url => {
            expect(isLocalDatabaseUrl(url)).toBe(false);
        },
    );
});

describe('databaseHostname', () => {
    it('zwraca sam host bez danych logowania i portu', () => {
        expect(databaseHostname('postgres://user:secret@db.example.com:6543/postgres')).toBe(
            'db.example.com',
        );
    });

    it('zwraca null dla niepoprawnego adresu', () => {
        expect(databaseHostname('not a url')).toBeNull();
    });
});
