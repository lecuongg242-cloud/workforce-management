#!/usr/bin/env node
/**
 * Trinh chay migration / seed / pgTAP cho Supabase, chi dung built-in Node 22.
 * Khong them dependency npm nao (D-03, threat T-01-SC).
 *
 * Lenh:
 *   push   - `npx supabase db push --db-url <url> --include-all --yes`
 *   seed   - nap `supabase/seed.sql` bang psql
 *   test   - cai pgTAP, chay cong RLS, roi chay bo test co lap
 *   testdb - seed roi test (dung lai tu migration + seed, khong dua vao state cu)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const COMMANDS = ["push", "seed", "test", "testdb"];

/**
 * Tim `psql`. Tren Windows, trinh cai PostgreSQL ghi PATH o muc may — shell nao
 * mo truoc luc cai se khong thay `psql`, nen `npm run test:rls` hong o terminal
 * khac voi terminal da cai. Do bien PATH truoc, roi soi cac thu muc cai mac dinh.
 * Tren Linux/CI, `psql` luon nam san tren PATH nen nhanh dau tra ve ngay.
 */
function resolvePsql() {
  if (process.env.PSQL_PATH && existsSync(process.env.PSQL_PATH)) {
    return process.env.PSQL_PATH;
  }

  const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["psql"], {
    encoding: "utf8",
    shell: false,
  });
  if (probe.status === 0) {
    const hit = String(probe.stdout || "").split(/\r?\n/).find((line) => line.trim() !== "");
    if (hit) return hit.trim();
  }

  if (process.platform === "win32") {
    for (const root of ["C:\\Program Files\\PostgreSQL", "C:\\Program Files (x86)\\PostgreSQL"]) {
      if (!existsSync(root)) continue;
      const versions = readdirSync(root)
        .filter((name) => /^\d+$/.test(name))
        .sort((a, b) => Number(b) - Number(a));
      for (const version of versions) {
        const candidate = path.join(root, version, "bin", "psql.exe");
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  console.error(
    "Khong tim thay `psql`. Cai PostgreSQL client roi mo lai terminal, hoac dat bien PSQL_PATH tro toi psql.exe.",
  );
  process.exit(1);
}

function requireConnectionUrl() {
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url || url.trim() === "") {
    console.error("Thieu bien moi truong: POSTGRES_URL_NON_POOLING");
    process.exit(1);
  }
  return url;
}

/**
 * Chay mot lenh, ke thua stdio; tra ve exit code (khong nem exception khi != 0).
 * Tren Windows, `npx` phan giai thanh `npx.cmd` — spawnSync voi shell:false
 * khong tim thay file .cmd nay, nen phai bat shell:true tren nen tang do.
 */
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(`Loi khi chay ${command}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

let psqlBin = null;

function runPsqlFile(url, file) {
  if (psqlBin === null) psqlBin = resolvePsql();
  return run(`"${psqlBin}"`, [url, "-v", "ON_ERROR_STOP=1", "-f", file]);
}

/**
 * Chay mot cau lenh SQL va tra ve stdout da cat khoang trang. Khac `run()` o
 * cho khong ke thua stdio — cong `assertNoRealCompanies()` can DOC ket qua chu
 * khong chi in no ra.
 */
function psqlQuery(url, sql) {
  if (psqlBin === null) psqlBin = resolvePsql();
  const result = spawnSync(`"${psqlBin}"`, [url, "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  return String(result.stdout || "").trim();
}

/**
 * Cong chan D-06b: `seed` TU CHOI chay khi database co du lieu doanh nghiep
 * THAT.
 *
 * `supabase/seed.sql` mo dau bang `truncate ... companies, employees ...
 * cascade`. Do la hanh vi dung cho mot database chi chua du lieu mau — va la
 * mot tham hoa im lang cho mot database co doanh nghiep dang chay that. Khong
 * co canh bao, khong co ban sao, khong hoan tac duoc.
 *
 * Tu 2026-08-13, dieu do khong con la gia dinh: Vinh Yen Food (`cty-vinhyen`)
 * song trong CHINH database dev, canh hai doanh nghiep mau. `.planning/STATE.md`
 * khuyen chay `npm run db:seed` o bon cho khac nhau de don fixture test con
 * sot — moi lan nhu vay tu day tro di la mot lan suyt xoa mat du lieu that.
 *
 * Nen bat bien "seed chi cham vao du lieu mau" duoc cuong che bang MAY, cung
 * khuon voi `assertNotCloud()` ngay ben duoi. `TF_SEED_WIPE_REAL_DATA=1` la
 * duong thoat co y thuc, khong phai mot co tien tay.
 *
 * Khong doc duoc danh sach doanh nghiep (chua chay migration, database rong,
 * psql hong) thi KHONG chan: mot cong khong tra loi duoc cau hoi thi khong duoc
 * quyen tu tra loi "co" — buoc `psql -f seed.sql` ngay sau do se bao loi that.
 */
const SEED_SAFE_COMPANY_IDS = ["cty-01", "cty-02"];

function assertNoRealCompanies(url) {
  if (process.env.TF_SEED_WIPE_REAL_DATA === "1") {
    console.error(
      "CANH BAO: TF_SEED_WIPE_REAL_DATA=1 — `seed` se XOA moi doanh nghiep,\n" +
        "ke ca du lieu that, truoc khi nap lai bo mau.",
    );
    return;
  }

  const safeList = SEED_SAFE_COMPANY_IDS.map((id) => `'${id}'`).join(", ");
  const rows = psqlQuery(
    url,
    `select id || ' — ' || name from public.companies where id not in (${safeList}) order by id;`,
  );

  // `null` = khong hoi duoc (bang chua ton tai, psql hong). Khong chan.
  if (rows === null || rows === "") return;

  const names = rows.split(/\r?\n/).filter((line) => line.trim() !== "");

  // Database dev dang mang ~950 doanh nghiep, gan het la fixture cua test tich
  // hop khong xoa duoc (xem .planning/STATE.md, cac muc 04-06 / 05-06 /
  // 05-2-06). In het ra se lam thong diep dai toi muc khong ai doc — va mot
  // canh bao khong ai doc thi khong khac gi khong co canh bao.
  const PREVIEW = 10;
  const preview = names.slice(0, PREVIEW).map((name) => `    ${name}`).join("\n");
  const rest =
    names.length > PREVIEW
      ? `\n    … và ${names.length - PREVIEW} doanh nghiệp nữa`
      : "";

  console.error(
    "TU CHOI: `seed` se XOA SACH du lieu that.\n" +
      "\n" +
      "`supabase/seed.sql` bat dau bang `truncate companies, employees, ...\n" +
      "cascade`. Database nay dang co " +
      names.length +
      " doanh nghiep KHONG thuoc\nbo du lieu mau:\n" +
      "\n" +
      preview +
      rest +
      "\n\n" +
      "Cascade se keo theo toan bo nhan vien, cham cong, muc luong va bang luong\n" +
      "cua ho. Khong co ban sao va khong hoan tac duoc.\n" +
      "\n" +
      "Neu chi can don fixture test con sot, hay xoa dung nhung dong do thay vi\n" +
      "nap lai ca bo seed.\n" +
      "\n" +
      "Neu THAT SU muon xoa het va nap lai du lieu mau:\n" +
      "    TF_SEED_WIPE_REAL_DATA=1 npm run db:seed",
  );
  process.exit(1);
}

function cmdPush(url) {
  return run("npx", [
    "supabase",
    "db",
    "push",
    "--db-url",
    url,
    "--include-all",
    "--yes",
  ]);
}

function cmdSeed(url) {
  // Chan TRUOC khi cham vao `psql -f`: mot khi `truncate` da chay thi khong con
  // gi de bao ve. Dat o day chu khong o `main()` de `testdb` — von goi lai
  // `cmdSeed()` — duoc bao boi cung mot cong, khong phai nho ai do nho them.
  assertNoRealCompanies(url);
  return runPsqlFile(url, "supabase/seed.sql");
}

function cmdTest(url) {
  const files = [
    "supabase/tests/00_install_pgtap.sql",
    "supabase/tests/00_rls_coverage.sql",
    "supabase/tests/run-all.sql",
  ];
  for (const file of files) {
    // Bo qua file chua ton tai: cong quet RLS toan schema
    // (00_rls_coverage.sql) do plan 01-01 Task 2 tao ra sau Task 1 trong
    // cung mot plan — bo qua o day de `test`/`testdb` chay duoc ngay sau
    // Task 1 ma khong doi Task 2. Khi Task 2 hoan tat, file luon ton tai nen
    // nhanh nay tro thanh vo hieu (luon chay ca 3 file, dung nhu thiet ke).
    if (!existsSync(file)) {
      console.error(`Bo qua (chua ton tai): ${file}`);
      continue;
    }
    const code = runPsqlFile(url, file);
    if (code !== 0) {
      return code;
    }
  }
  return 0;
}

/**
 * Cong chan D-15: `test` va `testdb` nap `supabase/tests/00_fixture_users.sql`,
 * file nay chen thang 4 uuid tong hop vao `auth.users` — bang do Supabase quan ly.
 *
 * Tren Postgres tam cua CI dieu do vo hai: `auth.users` o day chi la bang tuong
 * thich do `0001_supabase_compat.sql` tao, khong co GoTrue nao doc no.
 *
 * Tren project cloud that thi khac han. Cac dong fixture thieu `encrypted_password`,
 * `confirmation_token`, `recovery_token`, `email_change`, `created_at` — GoTrue quet
 * TOAN BO bang khi liet ke nguoi dung, gap NULL o cot no khai la khong-null thi ca
 * truy van sap. Ket qua da xay ra that: `GET /auth/v1/admin/users` tra 500
 * "Database error finding users", tuc la 4 dong rac lam hong duong di cua moi tai
 * khoan that. Xem CONTEXT.md cua phase 2, muc D-15.
 *
 * Bat bien "uuid tong hop khong bao gio cham cloud" tu day duoc cuong che bang may,
 * khong con dua vao viec nho don tay.
 */
function assertNotCloud(url, command) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // Chuoi ket noi dang key=value khong parse duoc thanh URL — do tho bang chuoi.
    host = String(url).toLowerCase();
  }

  const looksLikeCloud =
    host.includes("supabase.co") ||
    host.includes("supabase.com") ||
    host.includes("supabase.in");

  if (!looksLikeCloud) return;

  if (process.env.TF_ALLOW_CLOUD_TESTS === "1") {
    console.error(
      `CANH BAO: chay \`${command}\` len project cloud vi TF_ALLOW_CLOUD_TESTS=1.\n` +
        "Sau khi chay xong, PHAI xoa 4 dong fixture khoi auth.users, neu khong\n" +
        "GoTrue Admin API se tra 500 tren moi truy van nguoi dung.",
    );
    return;
  }

  console.error(
    `TU CHOI: \`${command}\` nap fixture pgTAP vao \`auth.users\`, va dich den la project cloud (${host}).\n` +
      "\n" +
      "Bon uuid tong hop trong `supabase/tests/00_fixture_users.sql` thieu cac cot\n" +
      "GoTrue bat buoc. Ghi chung len cloud lam `GET /auth/v1/admin/users` tra 500\n" +
      "cho MOI nguoi dung, ke ca cac tai khoan that hoan toan hop le.\n" +
      "\n" +
      "Chay bo test tren Postgres tam thay vi cloud (dung nhu CI lam).\n" +
      "Neu that su can chay len cloud: dat TF_ALLOW_CLOUD_TESTS=1 va tu don sach sau do.",
  );
  process.exit(1);
}

function main() {
  const [, , command] = process.argv;

  if (!command || !COMMANDS.includes(command)) {
    console.error(`Su dung: node scripts/db.mjs <${COMMANDS.join("|")}>`);
    process.exit(1);
  }

  const url = requireConnectionUrl();

  if (command === "test" || command === "testdb") {
    assertNotCloud(url, command);
  }

  let exitCode = 1;
  switch (command) {
    case "push":
      exitCode = cmdPush(url);
      break;
    case "seed":
      exitCode = cmdSeed(url);
      break;
    case "test":
      exitCode = cmdTest(url);
      break;
    case "testdb": {
      const seedCode = cmdSeed(url);
      if (seedCode !== 0) {
        exitCode = seedCode;
        break;
      }
      exitCode = cmdTest(url);
      break;
    }
    default:
      exitCode = 1;
  }

  process.exit(exitCode);
}

main();
