import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const base = read("supabase/migrations/20261017000000_instituteos_complete_schema.sql");
const rolePolicies = read("supabase/migrations/20261017000001_fix_rls_policies.sql");
const hardening = read("supabase/migrations/20261017000002_remove_legacy_permissive_policies.sql");
const tenant = read("supabase/migrations/20261017000003_enforce_tenant_identity_and_rls.sql");
const seed = read("supabase/seed.sql");
const schema = read("supabase/schema.sql");
const setupPolicies = read("supabase/policies.sql");
const storageService = read("src/services/storage.service.js");
const server = read("server/index.js");
const serverTests = read("server/server.test.js");
const database = read("src/lib/database.js");
const api = read("src/services/api.js");
const attendancePage = read("src/features/attendance/AttendancePage.jsx");
const studentPage = read("src/pages/StudentsPage.jsx");
const adminPages = read("src/features/admin/AdminPages.jsx");
const envExample = read(".env.example");
const roleTestTemplate = read("supabase/tests/rls_behavior.template.sql");
const nullIdentityTest = read("supabase/tests/database/002_null_identity_safety_test.sql");
const seedIdempotence = read("supabase/tests/seed_idempotence.psql");
const firstOwnerTemplate = read("supabase/provisioning/01_first_owner.template.sql");
const legacyMappingReport = read("supabase/provisioning/02_legacy_mapping_report.sql");
const combinedSetupScript = read("InstituteOS_Complete_Setup.sql");
const defaultPrivilegesMigration = tenant;
const manualRunRoot = new URL("supabase/manual-run/", root);

function policyOperations(sql) {
  const operations = [];
  const pattern = /\b(create|drop)\s+policy\s+(?:if\s+exists\s+)?(?:"([^"]+)"|([a-z_][a-z_0-9]*))/gi;
  for (const match of sql.matchAll(pattern)) {
    operations.push({ action: match[1].toLowerCase(), name: match[2] || match[3], index: match.index });
  }
  return operations;
}

function removeComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "");
}

function viewProjection(sql, relation) {
  const match = sql.match(new RegExp(
    `create\\s+or\\s+replace\\s+view\\s+public\\.${relation}\\b[\\s\\S]*?\\bas\\s+select\\s+([\\s\\S]*?)\\s+from\\b`,
    "i"
  ));
  return match?.[1].replace(/\s+/g, " ").trim();
}

describe("Supabase migration ordering and policy safety", () => {
  it("replaces each explicit policy name it creates in all four migrations", () => {
    for (const sql of [base, rolePolicies, hardening, tenant]) {
      const operations = policyOperations(sql);
      for (const created of operations.filter((operation) => operation.action === "create")) {
        const precedingDrop = operations.some((operation) =>
          operation.action === "drop" && operation.name === created.name && operation.index < created.index
        );
        expect(precedingDrop, `missing matching drop for ${created.name}`).toBe(true);
      }
    }
  });

  it("only drops known repository-owned or explicitly legacy policy names", () => {
    const owned = new Set(
      [base, rolePolicies, hardening, setupPolicies]
        .flatMap((sql) => policyOperations(sql))
        .filter((operation) => operation.action === "create")
        .map((operation) => operation.name)
    );
    const legacy = new Set([
      "Allow read on users", "Allow read on catalog", "Allow read on rooms", "Allow read on trainers",
      "students_owner", "batches_read", "sessions_read", "attendance_read", "fee_plans_read",
      "instalments_read", "payments_read", "approvals_read", "audit_log_read",
      "audit: server append", "documents: auth read", "documents: auth upload",
      "audit_log: authenticated append",
      "audit_insert_authenticated", "approvals_owner_accounts",
    ]);
    for (const sql of [rolePolicies, hardening]) {
      for (const dropped of policyOperations(sql).filter((operation) => operation.action === "drop")) {
        expect(owned.has(dropped.name) || legacy.has(dropped.name), `unowned policy drop: ${dropped.name}`).toBe(true);
      }
    }
  });

  it("removes base FOR ALL policies before installing narrower role policies", () => {
    for (const [name, table] of [
      ["availability: owner write", "trainer_availability"],
      ["fee_plans: finance only", "fee_plans"],
      ["instalments: finance only", "instalments"],
    ]) {
      expect(rolePolicies).toMatch(new RegExp(
        `drop policy if exists "${name}" on public\\.${table}`,
        "i"
      ));
    }
  });

  it("does not contain active always-true policies or a role-less Owner default", () => {
    for (const sql of [base, rolePolicies, hardening]) {
      expect(removeComments(sql)).not.toMatch(/\bor\s+true\b/i);
    }
    expect(base).not.toMatch(/coalesce\s*\(\s*auth\.jwt\(\).*'owner'/is);
    expect(base).toMatch(/else\s+''\s+end/i);
  });

  it("requires USING and WITH CHECK on every final UPDATE or FOR ALL policy", () => {
    const policyBlocks = tenant.matchAll(
      /create\s+policy\s+(?:"([^"]+)"|([a-z_][a-z_0-9]*))[^;]*;/gi
    );
    const updateBlocks = [...policyBlocks].filter((match) => /\bfor\s+(?:update|all)\b/i.test(match[0]));
    expect(updateBlocks.length).toBeGreaterThan(0);
    for (const block of updateBlocks) {
      const name = block[1] || block[2];
      expect(block[0], `${name} needs USING`).toMatch(/\busing\s*\(/i);
      expect(block[0], `${name} needs WITH CHECK`).toMatch(/\bwith\s+check\s*\(/i);
    }
    expect(tenant).toMatch(/tg_table_name in \('sessions','assignments'\)[\s\S]*v_new -> 'batch_id' is distinct from v_old -> 'batch_id'/i);
    expect(tenant).toMatch(/tg_table_name = 'submissions'[\s\S]*assignment_id[\s\S]*student_id/i);
    expect(tenant).toMatch(/trainers cannot reassign records to another batch/i);
    expect(tenant).toMatch(/trainers cannot move attendance records between students, sessions, or institutes/i);
    const attendanceWrites = tenant.match(/create policy "attendance: authorized (?:insert|update)"[\s\S]*?\n  \);/gi) || [];
    expect(attendanceWrites).toHaveLength(2);
    for (const policy of attendanceWrites) {
      expect(policy).toMatch(/public\.institute_role\(\) = 'owner'/i);
      expect(policy).not.toMatch(/trainer_owns_batch/i);
    }
    expect(server).toMatch(/app\.post\("\/api\/attendance", requireAuth, requireRole\("owner"\)/);
    expect(server).toMatch(/records\.length !== 1[\s\S]*bulk attendance must use the approval workflow/i);
    expect(server).toMatch(/writeRequiredAudit\(req, res, "attendance\.mark_attempt"/);
  });

  it("keeps the database views expected by the role-scoped Supabase client", () => {
    for (const relation of ["student_profiles", "trainer_students", "account_students", "counselor_fee_summary", "course_catalog", "course_finance"]) {
      expect(hardening).toMatch(new RegExp(`create or replace view public\\.${relation}\\b`, "i"));
    }
    expect(hardening).toMatch(/grant select \(id, name\) on table public\.students to authenticated/i);
    expect(hardening).not.toMatch(/grant select \(id, name, batch_id, status\) on table public\.students/i);
    for (const relation of ["student_profiles", "trainer_students"]) {
      expect(viewProjection(hardening, relation), `${relation} projection must preserve the base view signature`)
        .toBe(viewProjection(base, relation));
      expect(viewProjection(tenant, relation), `${relation} tenant projection must preserve the base view signature`)
        .toBe(viewProjection(base, relation));
    }
  });

  it("enables RLS on all sensitive base tables and revokes browser RPC access", () => {
    const combined = `${base}\n${rolePolicies}\n${hardening}\n${tenant}`;
    for (const table of ["users", "students", "batches", "attendance", "sessions", "fee_plans", "instalments", "payments", "approvals", "audit_log", "institute_members"]) {
      expect(combined).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
    for (const sql of [base, hardening]) {
      expect(sql).toMatch(/revoke all on table public\.institute_members from anon, authenticated/i);
      expect(removeComments(sql)).not.toMatch(/create\s+policy[^;]*on\s+public\.institute_members\b/i);
    }
    expect(base).toMatch(/revoke all on function public\.get_dashboard_telemetry\(\) from public, anon, authenticated/i);
    expect(combined).toMatch(/revoke all on function public\.get_dashboard_telemetry\(\) from public, anon, authenticated/i);
    expect(combined).toMatch(/revoke all on function public\.trainer_owns_batch\(text\) from public, anon/i);
    for (const sql of [schema, base, rolePolicies, hardening, setupPolicies]) {
      expect(removeComments(sql)).not.toMatch(/create\s+policy[^;]*audit[^;]*for\s+insert/i);
      expect(sql).toMatch(/revoke insert on public\.audit_log from anon, authenticated/i);
    }
    for (const sql of [schema, base, hardening]) {
      expect(removeComments(sql)).not.toMatch(/create\s+policy\s+"documents: auth (?:read|upload)"/i);
      expect(sql).toMatch(/create policy "documents: scoped read"[\s\S]*public\.trainer_owns_batch/i);
    }
    expect(tenant).toMatch(/revoke insert, update, delete on public\.audit_log from public, anon, authenticated, service_role/i);
    expect(tenant).toMatch(/revoke all on public\.student_profiles[\s\S]*from public, anon, authenticated/i);
    expect(tenant).toMatch(/create policy "documents: tenant read"[\s\S]*bucket_id = 'documents'[\s\S]*id_proof/i);
    expect(storageService).toMatch(/upsert:\s*false/);
    expect(storageService).toMatch(/auth\.getUser\(\)/);
    expect(tenant).toMatch(/create policy "avatars: own upload"[\s\S]*\[1\] = auth\.uid\(\)::text/i);
    expect(storageService).toMatch(/\$\{studentId\}\/\$\{category\}\/\$\{item\.name\}/);
  });

  it("closes tenant identity and relationship paths in the final migration", () => {
    const sql = removeComments(`${base}\n${schema}\n${tenant}`);
    expect(sql).not.toMatch(/lower\s*\(\s*u\.name\s*\)\s*=\s*lower\s*\(\s*t\.name\s*\)/i);
    expect(tenant).toMatch(/t\.auth_user_id\s*=\s*auth\.uid\(\)/i);
    expect(tenant).toMatch(/u\.auth_user_id\s*=\s*target_auth_user_id/i);
    expect(tenant).toMatch(/alter table public\.institute_members enable row level security/i);
    expect(sql).not.toMatch(/create\s+policy[^;]*on\s+public\.institute_members\b/i);
    expect(tenant).toMatch(/create policy "attendance: authorized insert"[\s\S]*attendance_matches_session_batch/i);
    expect(tenant).toMatch(/create trigger attendance_batch_match[\s\S]*before insert or update of institute_id, student_id, session_id/i);
    expect(tenant).toMatch(/create trigger trainer_relationships_immutable before update of batch_id on public\.sessions/i);
    expect(tenant).toMatch(/create trigger trainer_relationships_immutable before update of assignment_id, student_id on public\.submissions/i);
    expect(tenant).toMatch(/revoke all on function public\.current_user_context\(\) from public, anon, authenticated/i);
    expect(tenant).toMatch(/revoke all on function public\.record_payment\(text,text,text,numeric,text,text,text\) from public, anon, authenticated/i);
    expect(tenant).toMatch(/set search_path = pg_catalog/i);
    expect(tenant.match(/^begin;$/gim)).toHaveLength(1);
    expect(tenant.match(/^commit;$/gim)).toHaveLength(1);
    for (const guard of seed.matchAll(/do \$seed_guard\$[\s\S]*?\$seed_guard\$;/gi)) {
      expect(guard[0]).toMatch(/end;\s*\$seed_guard\$;/i);
    }
  });

  it("wraps all replacing migrations in one transaction", () => {
    for (const sql of [base, rolePolicies, hardening, tenant]) {
      expect(sql.match(/^begin;$/gim)).toHaveLength(1);
      expect(sql.match(/^commit;$/gim)).toHaveLength(1);
    }
  });

  it("seeds the institute and all parents before their foreign-key children without overwriting data", () => {
    const firstInsert = (table) => seed.search(new RegExp(`insert\\s+into\\s+public\\.${table}\\b`, "i"));
    const orderedTables = [
      "institutes", "users", "institute_members", "courses", "trainers", "trainer_availability",
      "rooms", "batches", "students", "sessions", "attendance", "assignments", "submissions",
      "recordings", "fee_plans", "instalments", "payments", "approvals",
    ];
    const positions = orderedTables.map(firstInsert);
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(removeComments(seed)).not.toMatch(/\b(delete\s+from|truncate\s+)/i);
    expect(seed).not.toMatch(/on\s+conflict\s*\([^)]*\)\s*do\s+update/i);
    expect(seed).toMatch(/'INST-MAIN'.*?\n.*?insert into public\.users/is);
    expect(seed).not.toMatch(/@[a-z0-9.-]+\.(?:com|org|net|in)\b/i);
    for (const email of seed.matchAll(/'[^']+@[^']+'/g)) {
      expect(email[0]).toMatch(/\.invalid'/i);
    }
  });

  it("guards every demo fixture ID with a post-insert conflict check", () => {
    const guardedTables = [
      "institutes", "users", "institute_members", "courses", "trainers",
      "trainer_availability", "rooms", "batches", "students", "sessions",
      "attendance", "assignments", "submissions", "recordings", "fee_plans",
      "instalments", "payments", "approvals",
    ];
    const guardedBefore = {
      courses: "trainers",
      trainers: "trainer_availability",
      trainer_availability: "rooms",
      rooms: "batches",
    };
    for (const table of guardedTables) {
      const insertPosition = seed.search(new RegExp(`insert\\s+into\\s+public\\.${table}\\b`, "i"));
      expect(insertPosition, `missing demo insert for ${table}`).toBeGreaterThanOrEqual(0);
      const guardPosition = seed.indexOf("do $seed_guard$", insertPosition);
      const dependentTable = guardedBefore[table];
      const nextInsertOffset = seed.slice(insertPosition + 1).search(/insert\s+into\s+public\./i);
      const nextInsertPosition = nextInsertOffset < 0 ? seed.length : insertPosition + 1 + nextInsertOffset;
      const guardLimit = dependentTable
        ? seed.search(new RegExp(`insert\\s+into\\s+public\\.${dependentTable}\\b`, "i"))
        : nextInsertPosition;
      expect(guardPosition, `missing post-insert conflict guard for ${table}`).toBeGreaterThan(insertPosition);
      expect(guardPosition).toBeLessThan(guardLimit);
    }
  });

  it("routes remote approval mutations and sensitive exports through the audited server", () => {
    expect(database).toMatch(/createApproval as createRemoteApproval/);
    expect(database).toMatch(/decideApproval as decideRemoteApproval/);
    expect(database).not.toMatch(/insertSupabaseRow\(\s*["']approvals/);
    expect(database).not.toMatch(/updateSupabaseApproval\(/);
    expect(server).toMatch(/const audit = createAuditWriter\(supabaseServiceRole\)/);
    expect(server).toMatch(/req\.authContext\.instituteId/);
    expect(server).toMatch(/writeRequiredAudit\(req, res, "fee\.payment_attempt"/);
    expect(server).toMatch(/writeRequiredAudit\(req, res, "data\.export_attempt"/);
    expect(server).toMatch(/res\.attachment\("instituteos-audit-log\.csv"\)/);
    expect(server).toMatch(/\.select\("id,at,user_id,role,event,detail,institute_id"\)/);
    expect(server).toMatch(/req\.authContext\.role !== "owner"/);
    expect(api).toMatch(/export async function requestAuditExport/);
    for (const source of [attendancePage, studentPage, adminPages]) {
      expect(source).toMatch(/requestAuditExport\(/);
    }
    expect(envExample).toMatch(/SUPABASE_SERVICE_ROLE_KEY=\s*$/m);
    expect(envExample).not.toMatch(/VITE_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("tests the trusted audit writer and owner-only student deletion", () => {
    expect(server).toMatch(/export function createAuditWriter/);
    expect(server).toMatch(/const context = req\?\.authContext/);
    expect(server).toMatch(/export const studentDeleteRoleGuard = requireRole\("owner"\)/);
    expect(serverTests).toMatch(/writes audit identity only from the verified server context/);
    expect(serverTests).toMatch(/fails closed when the append-only audit insert fails/);
    expect(serverTests).toMatch(/restricts the student delete route to owners/);
    expect(server).toMatch(/status === "approved"[\s\S]*approval\.execution_blocked[\s\S]*res\.status\(501\)/);
  });

  it("provides a verified unlinked identity endpoint, bounded API bodies, and request rate limits", () => {
    expect(server).toMatch(/express\.json\(\{ limit: "256kb", strict: true \}\)/);
    expect(server).toMatch(/export function createRateLimiter/);
    expect(server).toMatch(/limit: 12,[\s\S]*windowMs: 15 \* 60 \* 1000/);
    expect(server).toMatch(/limit: 120,[\s\S]*windowMs: 60 \* 1000/);
    expect(server).toMatch(/app\.get\("\/api\/me", requireAuthAllowUnlinked, userApiRateLimit/);
    expect(server).toMatch(/linked: false, userId: req\.user\.id/);
    expect(server).toMatch(/Request body exceeds the 256 KB limit/);
    expect(serverTests).toMatch(/report an authenticated identity with no membership/);
    expect(serverTests).toMatch(/rate limits per caller key/);
  });

  it("keeps monetary mutation input as a validated decimal string", () => {
    expect(server).toMatch(/export function normalizePaymentAmount/);
    expect(server).toMatch(/p_amount: amountDecimal/);
    expect(server).not.toMatch(/p_amount: Number\(amount\)/);
    expect(serverTests).toMatch(/floating-point values/);
  });

  it("has a runnable no-membership pgTAP check separate from role fixtures", () => {
    expect(nullIdentityTest).toMatch(/set local request\.jwt\.claims = '\{\}'/i);
    expect(nullIdentityTest).toMatch(/set local role authenticated/i);
    expect(nullIdentityTest).toMatch(/public\.current_institute_id\(\) is null/i);
    expect(nullIdentityTest).toMatch(/rollback;/i);
    expect(nullIdentityTest).toMatch(/No Auth rows are created/i);
  });

  it("includes JWT role behavior coverage separately from static checks", () => {
    expect(roleTestTemplate).toMatch(/set local role authenticated/i);
    expect(roleTestTemplate).toMatch(/request\.jwt\.claims/i);
    expect(roleTestTemplate).toMatch(/IOS-RLS-A/);
    expect(roleTestTemplate).toMatch(/IOS-RLS-B/);
    for (const role of ["owner", "counselor", "trainer", "accounts"]) {
      expect(roleTestTemplate).toMatch(new RegExp(`['"]${role}['"]`));
    }
    expect(roleTestTemplate).toMatch(/rollback;/i);
    expect(roleTestTemplate).toMatch(/never creates Auth users/i);
    expect(roleTestTemplate).toMatch(/trainer cannot directly update attendance or reassign its session/i);
    expect(seedIdempotence.match(/\\ir \.\.\/seed\.sql/g)).toHaveLength(2);
    expect(seedIdempotence).toMatch(/seed changed or duplicated a fixture row/i);
    expect(firstOwnerTemplate).toMatch(/auth\.users/i);
    expect(firstOwnerTemplate).toMatch(/never creates[\s\S]*an Auth account/i);
    expect(firstOwnerTemplate).toMatch(/begin;[\s\S]*commit;/i);
    expect(legacyMappingReport).toMatch(/select missing\.relation_name/i);
    expect(legacyMappingReport).toMatch(/where t\.auth_user_id is null/i);
  });

  it("removes broad default grants for future API objects and public schema creation", () => {
    expect(defaultPrivilegesMigration).toMatch(/alter default privileges for role postgres revoke execute on functions from public/i);
    expect(defaultPrivilegesMigration).toMatch(/alter default privileges for role postgres in schema public\s+revoke execute on functions from anon, authenticated/i);
    expect(defaultPrivilegesMigration).toMatch(/alter default privileges for role postgres in schema public\s+revoke all on tables from anon, authenticated/i);
    expect(defaultPrivilegesMigration).toMatch(/alter default privileges for role postgres in schema public\s+revoke all on sequences from anon, authenticated/i);
    expect(defaultPrivilegesMigration).toMatch(/revoke create on schema public from public, anon, authenticated, service_role/i);
    expect(read("supabase/tests/migration_contract_test.sql")).toMatch(/pg_default_acl/i);
  });

  it("provides a manual-run script whose SQL bodies exactly match each source", () => {
    const pairs = [
      ["01_base_schema.sql", "supabase/migrations/20261017000000_instituteos_complete_schema.sql"],
      ["02_fix_rls.sql", "supabase/migrations/20261017000001_fix_rls_policies.sql"],
      ["03_remove_legacy_policies.sql", "supabase/migrations/20261017000002_remove_legacy_permissive_policies.sql"],
      ["04_tenant_identity_and_rls.sql", "supabase/migrations/20261017000003_enforce_tenant_identity_and_rls.sql"],
      ["05_seed_demo.sql", "supabase/seed.sql"],
    ];
    for (const [manualName, sourceName] of pairs) {
      const manualSql = read(`supabase/manual-run/${manualName}`);
      const marker = "-- BEGIN EXACT SOURCE CONTENT\n";
      expect(manualSql, `${manualName} header marker`).toContain(marker);
      expect(manualSql.slice(manualSql.indexOf(marker) + marker.length), `${manualName} source copy`)
        .toBe(read(sourceName));
    }
    for (const name of [
      "00_preflight_readonly.sql", "01_verify_readonly.sql", "02_verify_readonly.sql",
      "03_verify_readonly.sql", "04_verify_readonly.sql", "05_verify_readonly.sql",
      "99_final_security_checks_readonly.sql", "10_copilet_decision_TEMPLATE.sql", "ZZ_cleanup_DESTRUCTIVE.sql",
    ]) {
      expect(readdirSync(manualRunRoot)).toContain(name);
    }
    const readOnlyFiles = [
      "00_preflight_readonly.sql", "01_verify_readonly.sql", "02_verify_readonly.sql",
      "03_verify_readonly.sql", "04_verify_readonly.sql", "05_verify_readonly.sql",
      "99_final_security_checks_readonly.sql",
    ];
    for (const name of readOnlyFiles) {
      const sql = read(`supabase/manual-run/${name}`);
      expect(sql).toMatch(/begin;[\s\S]*set transaction read only;/i);
      expect(sql).toMatch(/commit;\s*$/i);
      expect(sql).not.toMatch(/\\(?:ir|i|copy)\b/i);
    }
    const cleanup = read("supabase/manual-run/ZZ_cleanup_DESTRUCTIVE.sql");
    expect(cleanup).toMatch(/drop-instituteos-local-only/);
    expect(cleanup).toMatch(/drop table if exists public\.institutes/i);
    expect(cleanup).not.toMatch(/drop table if exists public\.copilet/i);
    expect(removeComments(cleanup)).not.toMatch(/\bcascade\b/i);
  });

  it("keeps the root combined setup script synchronized with the five ordered sources", () => {
    const pairs = [
      ["supabase/migrations/20261017000000_instituteos_complete_schema.sql", "supabase/migrations/20261017000000_instituteos_complete_schema.sql"],
      ["supabase/migrations/20261017000001_fix_rls_policies.sql", "supabase/migrations/20261017000001_fix_rls_policies.sql"],
      ["supabase/migrations/20261017000002_remove_legacy_permissive_policies.sql", "supabase/migrations/20261017000002_remove_legacy_permissive_policies.sql"],
      ["supabase/migrations/20261017000003_enforce_tenant_identity_and_rls.sql", "supabase/migrations/20261017000003_enforce_tenant_identity_and_rls.sql"],
      ["supabase/seed.sql", "supabase/seed.sql"],
    ];
    let previousEnd = -1;
    for (const [markerName, sourceName] of pairs) {
      const startMarker = `-- BEGIN SOURCE FILE: ${markerName}`;
      const endMarker = `-- END SOURCE FILE: ${markerName}`;
      const start = combinedSetupScript.indexOf(startMarker);
      const bodyStart = combinedSetupScript.indexOf("\n", start) + 1;
      const end = combinedSetupScript.indexOf(endMarker, bodyStart);
      expect(start, `${markerName} section`).toBeGreaterThan(previousEnd);
      expect(end).toBeGreaterThan(bodyStart);
      const actual = combinedSetupScript.slice(bodyStart, end).replace(/^\r?\n/, "");
      expect(actual.replace(/\r\n/g, "\n"), `${markerName} body`)
        .toBe(read(sourceName).replace(/\r\n/g, "\n"));
      previousEnd = end + endMarker.length;
    }
  });

  it("keeps the pgTAP contract in Supabase's database test directory", () => {
    expect(read("supabase/tests/database/001_migration_contract_test.sql"))
      .toBe(read("supabase/tests/migration_contract_test.sql"));
  });
});
