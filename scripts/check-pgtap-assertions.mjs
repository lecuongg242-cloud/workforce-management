#!/usr/bin/env node
/**
 * Cong co hoc D-15a: dem tong so assertion pgTAP theo DUNG thu tu thuc thi
 * that cua `scripts/db.mjs` lenh `test`/`testdb`, roi so voi moc toi thieu.
 * Chi dung built-in Node 22 (node:fs, node:path, node:process), khong them
 * dependency (D-03, cung rang buoc ma scripts/db.mjs da ghi).
 *
 * Vi sao phai dung lai thu tu thuc thi thay vi cong don thu muc:
 * `scripts/db.mjs` cmdTest() chay `00_rls_coverage.sql` MOT LAN DUNG RIENG,
 * roi chay `run-all.sql` — ma ban than run-all.sql lai `\ir` mot lan nua
 * `00_rls_coverage.sql`. Neu chi cong tong plan() cua tung file trong thu
 * muc mot lan, con so se lech dung 4 (so assertion cua 00_rls_coverage.sql)
 * so voi thuc te chay.
 *
 * MIN_ASSERTIONS = 199 la con so do duoc ngay 2026-08-02 tren cay Phase 3
 * (plan 03-01 Task 1, sau khi them 09_attendance_evidence.sql): 4
 * (00_rls_coverage.sql chay rieng) + 4 (00_rls_coverage.sql qua run-all.sql)
 * + 18 (01_isolation_companies.sql) + 53 (02_time_overnight.sql) + 41
 * (03_isolation_core.sql) + 15 (04_isolation_v2.sql) + 35 (05_seed_fixture.sql)
 * + 8 (06_platform_admins.sql) + 6 (07_search_normalize.sql) + 7
 * (08_role_write_scope.sql) + 8 (09_attendance_evidence.sql) = 199.
 *
 * Nang len 205 ngay 2026-08-06 (plan 04-01 Task 1): + 6
 * (10_company_settings.sql). Nang len 212 cung ngay (plan 04-04 Task 1): + 7
 * (11_overtime_rules_append_only.sql). Nang len 220 ngay 2026-08-06 (plan
 * 05-01 Task 1): + 8 (12_request_reviews.sql). Nang len 233 cung ngay (plan
 * 05-02 Task 1): + 13 (13_apply_approved_request.sql). Nang len 239 cung ngay
 * (plan 05-04 Task 1): + 6 (14_notifications.sql). Nang len 250 cung ngay
 * (plan 05-05 Task 1): + 11 (15_period_close.sql). Nang len 262 cung ngay
 * (plan 05-2-01 Task 1): + 12 (16_employee_pay_rates.sql). Nang len 272 cung
 * ngay (plan 05-2-03 Task 1): + 10 (17_pay_adjustments.sql). Nang len 283
 * cung ngay (plan 05-2-05 Task 1): + 11 (18_payroll_runs.sql). Nang len 292
 * ngay 2026-08-07 (PAY-05, migration 0029): + 9 (19_payslip_rls.sql). Nang len
 * 300 ngay 2026-08-10 (Phase 6, plan Task 1, migration 0033): + 8
 * (20_support_sessions.sql), roi 306 cung ngay (Task 2, migration 0034): + 6
 * (cung file, 8 -> 14 assertion). Moc nay
 * CHI DUOC NANG LEN, khong bao gio ha xuong — ha moc la cach am tham bien
 * mot bo test dang co lai thanh mot cong van bao xanh (xem <prohibitions>
 * cua 02-02-PLAN.md).
 *
 * NGOAI LE DUY NHAT, 2026-08-12: ha 306 -> 305. Day KHONG phai bo bot test.
 * `18_payroll_runs.sql` khai `plan(11)` trong khi file chi co 10 khang dinh
 * (dung bang tong bon tieu de muc cua chinh no). Cong nay cong cac con so
 * `plan()` lai, nen no thua 1 ngay tu dau — moc 306 chua bao gio la mot con so
 * do duoc. Loi lo ra khi cong `db-ci` chay tron ven lan dau (truoc do no chet
 * o buoc RLS vi pgTAP nam trong schema `extensions` ma khong ai dat
 * search_path, nen buoc chay `run-all.sql` luon bi skip).
 *
 * So khang dinh THAT chay duoc khong he giam: van la 305 truoc va sau. Cai
 * duoc sua la SO SACH.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const MIN_ASSERTIONS = 305;

const TESTS_DIR = path.join("supabase", "tests");
const RUN_ALL_PATH = path.join(TESTS_DIR, "run-all.sql");
const STANDALONE_RLS_GATE = "00_rls_coverage.sql";

/** Doc danh sach ten file tu cac dong `\ir <file>` trong run-all.sql, dung thu tu. */
function readIrList(runAllPath) {
  if (!existsSync(runAllPath)) {
    return null;
  }
  const content = readFileSync(runAllPath, "utf8");
  const files = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^\\ir\s+(\S+)$/);
    if (match) {
      files.push(match[1]);
    }
  }
  return files;
}

/** Trich so trong `select plan(N)`. Tra ve null neu file khong co plan() (fixture/helper). */
function extractPlanCount(fileContent) {
  const match = fileContent.match(/select\s+plan\s*\(\s*(\d+)\s*\)/i);
  return match ? Number(match[1]) : null;
}

function main() {
  const irList = readIrList(RUN_ALL_PATH);

  if (irList === null) {
    console.error(`Khong doc duoc ${RUN_ALL_PATH} — cong khong the dung lai thu tu thuc thi.`);
    process.exit(1);
  }

  if (irList.length === 0) {
    console.error(
      `Danh sach \\ir trong ${RUN_ALL_PATH} rong — mot cong dem duoc 0 file khong duoc coi la xanh.`,
    );
    process.exit(1);
  }

  // Dung lai dung thu tu thuc thi that cua `node scripts/db.mjs test`
  // (xem cmdTest trong scripts/db.mjs): 00_rls_coverage.sql chay rieng MOT
  // LAN, roi toan bo danh sach \ir cua run-all.sql (ban than danh sach do
  // lai chay 00_rls_coverage.sql mot lan nua qua \ir).
  const executionOrder = [STANDALONE_RLS_GATE, ...irList];

  let total = 0;
  const rows = [];

  for (const fileName of executionOrder) {
    const filePath = path.join(TESTS_DIR, fileName);
    if (!existsSync(filePath)) {
      console.error(`Khong tim thay file test: ${filePath}`);
      process.exit(1);
    }
    const content = readFileSync(filePath, "utf8");
    const count = extractPlanCount(content);
    if (count === null) {
      rows.push({ file: fileName, count: 0, note: "fixture/helper (khong co plan())" });
    } else {
      total += count;
      rows.push({ file: fileName, count, note: "" });
    }
  }

  console.log("Bang chi tiet assertion theo dung thu tu thuc thi cua `scripts/db.mjs test`:");
  console.log("");
  for (const row of rows) {
    const label = row.note ? `${row.file} (${row.note})` : row.file;
    console.log(`  ${String(row.count).padStart(4, " ")}  ${label}`);
  }
  console.log("");
  console.log(`Tong: ${total} (moc toi thieu: ${MIN_ASSERTIONS})`);

  if (total < MIN_ASSERTIONS) {
    console.error("");
    console.error(
      `check:assertions THAT BAI — tong assertion hien tai (${total}) nho hon moc toi thieu (${MIN_ASSERTIONS}). ` +
        "Bo pgTAP dang co lai. Khong duoc ha MIN_ASSERTIONS de lam cong nay xanh.",
    );
    process.exit(1);
  }

  console.log("check:assertions OK");
  process.exit(0);
}

main();
