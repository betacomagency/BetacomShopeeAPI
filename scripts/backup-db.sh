#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Supabase Database Backup Script
# Creates: roles.sql, schema.sql, data.sql
# ─────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# ── Check prerequisites ──────────────────────
info "Checking prerequisites..."

if ! command -v supabase &>/dev/null; then
  fail "Supabase CLI is not installed. Install it: https://supabase.com/docs/guides/cli"
fi
ok "Supabase CLI found: $(supabase --version 2>/dev/null || echo 'unknown version')"

if ! command -v psql &>/dev/null; then
  fail "psql is not installed. Install PostgreSQL client first."
fi
ok "psql found: $(psql --version 2>/dev/null | head -1)"

# ── Get connection string ─────────────────────
DB_URL="${1:-${DATABASE_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo ""
  echo -e "${CYAN}Enter your Supabase database connection string:${NC}"
  echo -e "${YELLOW}(format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres)${NC}"
  read -rsp "Connection string (input hidden): " DB_URL
  echo ""
fi

if [ -z "$DB_URL" ]; then
  fail "No connection string provided. Pass it as argument or set DATABASE_URL env var."
fi

# ── Validate connection ──────────────────────
info "Testing database connection..."
if ! psql "$DB_URL" -c "SELECT 1;" &>/dev/null; then
  fail "Cannot connect to database. Check your connection string."
fi
ok "Database connection successful"

# ── Create backup directory ──────────────────
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"
info "Backup directory: ${CYAN}${BACKUP_DIR}${NC}"
echo ""

# ── Step 1: Dump roles ───────────────────────
info "[1/3] Dumping roles..."
if supabase db dump --db-url "$DB_URL" -f "${BACKUP_DIR}/roles.sql" --role-only; then
  ok "Roles dumped successfully"
else
  fail "Failed to dump roles"
fi

# ── Step 2: Dump schema ──────────────────────
info "[2/3] Dumping schema..."
if supabase db dump --db-url "$DB_URL" -f "${BACKUP_DIR}/schema.sql"; then
  ok "Schema dumped successfully"
else
  fail "Failed to dump schema"
fi

# ── Step 3: Dump data ────────────────────────
info "[3/3] Dumping data..."
if supabase db dump --db-url "$DB_URL" -f "${BACKUP_DIR}/data.sql" --use-copy --data-only; then
  ok "Data dumped successfully"
else
  fail "Failed to dump data"
fi

# ── Summary ──────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  Backup completed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "  Directory: ${CYAN}${BACKUP_DIR}/${NC}"
echo ""

printf "  %-15s %s\n" "File" "Size"
printf "  %-15s %s\n" "───────────────" "──────────"
for f in roles.sql schema.sql data.sql; do
  filepath="${BACKUP_DIR}/${f}"
  if [ -f "$filepath" ]; then
    size=$(du -h "$filepath" | cut -f1 | xargs)
    printf "  %-15s %s\n" "$f" "$size"
  fi
done

echo ""
TOTAL=$(du -sh "$BACKUP_DIR" | cut -f1 | xargs)
echo -e "  Total: ${CYAN}${TOTAL}${NC}"
echo ""
