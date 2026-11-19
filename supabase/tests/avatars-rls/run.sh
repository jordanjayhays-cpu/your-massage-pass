#!/usr/bin/env bash
# Local RLS test for 20261119120200_scope_avatars_storage_policies.sql.
# Needs a throwaway Postgres 16 you can trash, reachable as superuser `postgres` (no password)
# at PGHOST:PGPORT (default 127.0.0.1:54329). Never point this at production: it drops databases.
# Each scenario gets a fresh database built from a replica of production storage.objects
# (00_replica.sql) and today's production policies (01_prod_policies_today.sql).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261119120200_scope_avatars_storage_policies.sql"
STUDIO_NAME="supabase/migrations/20261119120000_scope_studio_photos_storage_policies.sql"
STUDIO="$(mktemp)"; trap 'rm -f "$STUDIO" "$DIR"/.fail_*' EXIT
if [ -f "$ROOT/$STUDIO_NAME" ]; then cp "$ROOT/$STUDIO_NAME" "$STUDIO"
else git -C "$ROOT" show "origin/claude/zen-newton-cn8xqc:$STUDIO_NAME" > "$STUDIO"; fi
PSQL=(psql -h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-54329}" -U postgres -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then create role supabase_storage_admin nologin; end if;
end $$;
SQL

fresh() {
  "${PSQL[@]}" -d postgres -c "drop database if exists $1" -c "create database $1"
  "${PSQL[@]}" -d "$1" -f "$DIR/00_replica.sql" -f "$DIR/01_prod_policies_today.sql"
}
helpers() { "${PSQL[@]}" -d "$1" -f "$DIR/02_helpers.sql"; }
report() {
  "${PSQL[@]}" -d "$1" -P pager=off -c \
    "select case when pass then 'PASS' else 'FAIL' end as r, scenario, label, got, want from t.results order by id"
  "${PSQL[@]}" -d "$1" -At -c "select count(*) filter (where not pass) from t.results" > "$DIR/.fail_$1"
}

# A: production today. Attacker can overwrite and plant; remove works via studio-photos policy.
fresh sc_a; helpers sc_a
"${PSQL[@]}" -d sc_a -v sc=A_prod_today -v want_overwrite=evil -v want_newfile=evil -v want_remove='ok:1' -f "$DIR/10_bug_probe.sql"
report sc_a

# B: avatars migration only. Still open: the studio-photos policies grant write on every bucket.
fresh sc_b; "${PSQL[@]}" -d sc_b -f "$MIG"; helpers sc_b
"${PSQL[@]}" -d sc_b -v sc=B_avatars_only -v want_overwrite=evil -v want_newfile=evil -v want_remove='ok:1' -f "$DIR/10_bug_probe.sql"
report sc_b

# C: studio-photos migration only. Still open, and owner remove() deletes nothing.
fresh sc_c; "${PSQL[@]}" -d sc_c -f "$STUDIO"; helpers sc_c
"${PSQL[@]}" -d sc_c -v sc=C_studio_only -v want_overwrite=evil -v want_newfile=evil -v want_remove='ok:0' -f "$DIR/10_bug_probe.sql"
report sc_c

# D1: studio-photos then avatars (timestamp order). Probe, then the strict suite on a clean table.
fresh sc_d1; "${PSQL[@]}" -d sc_d1 -f "$STUDIO" -f "$MIG"; helpers sc_d1
"${PSQL[@]}" -d sc_d1 -v sc=D1_probe -v want_overwrite=v1 -v want_newfile=absent -v want_remove='ok:1' -f "$DIR/10_bug_probe.sql"
"${PSQL[@]}" -d sc_d1 -c "set storage.allow_delete_query = 'true'; delete from storage.objects;"
"${PSQL[@]}" -d sc_d1 -v sc=D1_suite -f "$DIR/20_full_suite.sql"
report sc_d1

# D2: avatars then studio-photos (reverse order).
fresh sc_d2; "${PSQL[@]}" -d sc_d2 -f "$MIG" -f "$STUDIO"; helpers sc_d2
"${PSQL[@]}" -d sc_d2 -v sc=D2_suite -f "$DIR/20_full_suite.sql"
report sc_d2

# D3: studio-photos, avatars, avatars again (idempotent re-run).
fresh sc_d3; "${PSQL[@]}" -d sc_d3 -f "$STUDIO" -f "$MIG" -f "$MIG"; helpers sc_d3
"${PSQL[@]}" -d sc_d3 -v sc=D3_rerun_suite -f "$DIR/20_full_suite.sql"
report sc_d3

total=0; for f in "$DIR"/.fail_*; do total=$((total + $(cat "$f"))); done
echo "TOTAL FAILURES: $total"
[ "$total" -eq 0 ]
