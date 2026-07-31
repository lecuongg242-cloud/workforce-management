#!/usr/bin/env node
/**
 * Quet artifact build (.next/static, .next/server/app neu co) tim khoa bi mat
 * lo xuong client. Chi dung built-in Node 22 (node:fs, node:path,
 * node:process), khong them dependency nao (D-03, threat T-01-SC).
 *
 * Danh sach chuoi cam gom hai loai:
 *   (a) GIA TRI cua moi bien trong .env.local khong mang tien to NEXT_PUBLIC_
 *       va dai hon 12 ky tu — day la khoa bi mat thuc su dang dung.
 *   (b) TIEN TO co dinh cua khoa bi mat Supabase (sb_secret_) cong ten cac
 *       bien khoa legacy (SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *       SUPABASE_JWT_SECRET) — bat duoc ca truong hop mot dong code vo tinh
 *       nhung ten bien nay vao bundle truoc khi doc gia tri.
 *
 * Thoat 1 (do) trong ba truong hop: tim thay chuoi cam trong artifact, chua
 * co artifact de quet (.next/static khong ton tai), hoac quet duoc 0 file —
 * mot cong quet 0 file va bao "khong tim thay gi" la mot cong do luong so
 * khong, khong duoc coi la xanh.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ENV_LOCAL_PATH = ".env.local";
const SCAN_ROOTS = [path.join(".next", "static"), path.join(".next", "server", "app")];

// Duoi file duoc coi la nhi phan / khong doc duoc dang van ban -> bo qua khi
// quet, tranh loi doc UTF-8 tren font/anh va tranh false-positive vo nghia.
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
]);

function loadSecretValuesFromEnvLocal() {
  if (!existsSync(ENV_LOCAL_PATH)) {
    console.error(`Khong tim thay ${ENV_LOCAL_PATH} — can co file nay de biet gia tri bi mat can quet.`);
    process.exit(1);
  }

  // Doc .env.local qua process.loadEnvFile de nap vao process.env, dong thoi
  // doc lai noi dung tho de biet CHINH XAC ten bien nao dinh nghia trong file
  // nay (khong lay lan bien moi truong khac cua he dieu hanh).
  process.loadEnvFile(ENV_LOCAL_PATH);
  const raw = readFileSync(ENV_LOCAL_PATH, "utf8");
  const definedKeys = [...raw.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)].map((m) => m[1]);

  const forbidden = [];
  for (const key of definedKeys) {
    if (key.startsWith("NEXT_PUBLIC_")) continue;
    const value = process.env[key];
    if (typeof value === "string" && value.length > 12) {
      forbidden.push({ label: `gia tri cua bien ${key}`, needle: value });
    }
  }
  return forbidden;
}

const FIXED_SECRET_MARKERS = [
  "sb_secret_",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
];

function buildForbiddenList() {
  const forbidden = loadSecretValuesFromEnvLocal();
  for (const marker of FIXED_SECRET_MARKERS) {
    forbidden.push({ label: marker, needle: marker });
  }
  return forbidden;
}

function walk(dir, onFile) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, onFile);
      continue;
    }
    if (!entry.isFile()) continue;
    if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    onFile(full);
  }
}

function main() {
  const staticRoot = SCAN_ROOTS[0];
  if (!existsSync(staticRoot)) {
    console.error(
      `Khong tim thay ${staticRoot} — chay \`npm run build\` truoc khi chay check:secrets.`,
    );
    process.exit(1);
  }

  const forbidden = buildForbiddenList();
  if (forbidden.length === 0) {
    console.error("Danh sach chuoi cam rong bat thuong — kiem tra lai .env.local.");
    process.exit(1);
  }

  let scannedCount = 0;
  let leakFound = false;

  for (const root of SCAN_ROOTS) {
    if (!existsSync(root)) continue;
    if (statSync(root).isDirectory() !== true) continue;
    walk(root, (filePath) => {
      let content;
      try {
        content = readFileSync(filePath, "utf8");
      } catch {
        // Doc that bai (vi du file nhi phan lot qua bo loc duoi) -> bo qua,
        // khong tinh vao so file da quet.
        return;
      }
      scannedCount += 1;
      for (const { label, needle } of forbidden) {
        if (content.includes(needle)) {
          console.error(`RO RI: ${filePath} chua "${label}"`);
          leakFound = true;
        }
      }
    });
  }

  if (scannedCount === 0) {
    console.error(
      "Quet duoc 0 file — cong nay khong duoc coi la xanh khi khong quet gi ca. Kiem tra lai artifact build.",
    );
    process.exit(1);
  }

  if (leakFound) {
    process.exit(1);
  }

  console.log(`check:secrets OK — da quet ${scannedCount} file, khong tim thay khoa bi mat nao.`);
  process.exit(0);
}

main();
