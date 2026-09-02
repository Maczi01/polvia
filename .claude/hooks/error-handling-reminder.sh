#!/bin/bash

# Error Handling Reminder (web: Next.js + Drizzle)
# Hook Stop — sprawdza edytowane pliki pod katem obslugi bledow i granic warstw
#
# Wykrywa w src/:
#   - console.log / console.warn         -> zostaje w kodzie produkcyjnym (no-console: warn)
#   - pusty catch {} / catch (e) {}      -> polkniety blad
#   - process.env.X poza env.ts          -> obejscie walidacji @t3-oss/env-nextjs
#   - 'use server' bez walidacji Zod     -> mutacja bez walidacji wejscia
#
# Exit codes: 0 = OK, 2 = blocking (Claude widzi stderr i kontynuuje prace)
# UWAGA: exit 1 = non-blocking, stderr trafia TYLKO do verbose mode — Claude NIE widzi!

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Pobierz liste zmienionych plikow (staged + unstaged + untracked)
CHANGED_FILES=$(
    {
        git diff --name-only HEAD 2>/dev/null || true
        git diff --name-only 2>/dev/null || true
        git ls-files --others --exclude-standard 2>/dev/null || true
    } | sort -u
)

if [ -z "$CHANGED_FILES" ]; then
    exit 0
fi

# Tylko pliki TS/TSX w src/, bez testow, stories i configow
FILES=$(echo "$CHANGED_FILES" | grep -E '^src/.*\.(ts|tsx)$' \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -v '\.stories\.' \
    | grep -v '\.d\.ts$' \
    | grep -v '\.config\.' \
    || true)

if [ -z "$FILES" ]; then
    exit 0
fi

WARNINGS=""
WARNING_COUNT=0

add_warning() {
    WARNINGS="${WARNINGS}\n   $1"
    WARNING_COUNT=$((WARNING_COUNT + 1))
}

for file in $FILES; do
    [ -f "$PROJECT_DIR/$file" ] || continue

    # 1. console.log / console.warn (console.error z kontekstem w catch jest OK)
    CONSOLE_HITS=$(grep -n 'console\.\(log\|warn\)[[:space:]]*(' "$PROJECT_DIR/$file" | grep -v ':[[:space:]]*//' || true)
    if [ -n "$CONSOLE_HITS" ]; then
        add_warning "${file} — console.log/warn w kodzie produkcyjnym (eslint no-console: warn)"
        LINES=$(echo "$CONSOLE_HITS" | cut -d: -f1 | tr '\n' ' ')
        WARNINGS="${WARNINGS}\n     Linie: ${LINES}— usun albo zamien na console.error z kontekstem (bez PII)"
    fi

    # 2. Pusty catch
    EMPTY_CATCH=$(grep -nE 'catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{[[:space:]]*\}' "$PROJECT_DIR/$file" || true)
    if [ -n "$EMPTY_CATCH" ]; then
        LINES=$(echo "$EMPTY_CATCH" | cut -d: -f1 | tr '\n' ' ')
        add_warning "${file} — pusty catch (polkniety blad), linie: ${LINES}"
        WARNINGS="${WARNINGS}\n     Zaloguj z kontekstem albo re-throw. Zero pustych catch."
    fi

    # 3. process.env poza env.ts
    case "$file" in
        *env.ts) ;;
        *)
            ENV_HITS=$(grep -n 'process\.env\.' "$PROJECT_DIR/$file" | grep -v 'NODE_ENV' || true)
            if [ -n "$ENV_HITS" ]; then
                LINES=$(echo "$ENV_HITS" | cut -d: -f1 | tr '\n' ' ')
                add_warning "${file} — process.env poza env.ts, linie: ${LINES}"
                WARNINGS="${WARNINGS}\n     Uzyj env z env.ts (@t3-oss/env-nextjs) — inaczej brak walidacji Zod i ryzyko undefined na produkcji."
            fi
            ;;
    esac

    # 4. Server Action bez walidacji Zod
    if grep -qE "^['\"]use server['\"]" "$PROJECT_DIR/$file"; then
        if ! grep -qE 'safeParse|\.parse\(|zodResolver' "$PROJECT_DIR/$file"; then
            add_warning "${file} — 'use server' bez walidacji Zod (safeParse/parse)"
            WARNINGS="${WARNINGS}\n     Server Action to publiczny endpoint POST: waliduj wejscie schema Zod PRZED dotknieciem bazy."
        fi
    fi
done

if [ "$WARNING_COUNT" -gt 0 ]; then
    {
        echo ""
        echo "ERROR HANDLING CHECK: ${WARNING_COUNT} ostrzezen"
        echo ""
        echo -e "$WARNINGS"
        echo ""
        echo "Wzorce: .claude/skills/nextjs-stack-guidelines/SKILL.md oraz .claude/skills/security/SKILL.md"
        echo "Zapytaj uzytkownika: Czy chcesz, zebym naprawil powyzsze ostrzezenia? (tak/nie)"
        echo ""
    } >&2
    exit 2
fi

exit 0
