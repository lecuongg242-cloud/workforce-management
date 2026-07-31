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

function main() {
  const [, , command] = process.argv;

  if (!command || !COMMANDS.includes(command)) {
    console.error(`Su dung: node scripts/db.mjs <${COMMANDS.join("|")}>`);
    process.exit(1);
  }

  const url = requireConnectionUrl();

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
