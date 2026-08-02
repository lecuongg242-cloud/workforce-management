#!/usr/bin/env node
/**
 * Tao (hoac cap nhat) bucket Storage rieng tu chua anh cham cong, theo dung
 * khuon cua `scripts/seed-auth.mjs`: doc `SUPABASE_SECRET_KEY` va
 * `NEXT_PUBLIC_SUPABASE_URL`, thieu thi in thong diep tieng Viet roi
 * `process.exit(1)`.
 *
 * Ten bucket va gioi han MIME/kich thuoc o day PHAI KHOP voi
 * `src/lib/storage/attendance-photos.ts` (nguon su that phia ung dung) —
 * script nay khong import duoc file .ts do o moi truong Node thuan (khong co
 * ts-node/tsx trong devDependencies, D-03), nen gia tri duoc chep lai o day
 * co chu dich, kem comment nay de nguoi doc sau biet phai doi ca hai noi.
 *
 * `public: false` va `allowedMimeTypes`/`fileSizeLimit` dat o CAU HINH BUCKET
 * PHIA SERVER vi day la cho DUY NHAT khong tin loi khai cua client ve kieu
 * noi dung (T-03-07). `bodySizeLimit` cua Next (next.config.ts) la bien an
 * toan thu hai, khong thay the buoc nay.
 *
 * Chay lai duoc nhieu lan: bucket da ton tai thi CAP NHAT cau hinh thay vi
 * loi.
 *
 * Lenh: node --env-file=.env.local scripts/storage-bucket.mjs  (npm run db:bucket)
 */

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "attendance-photos";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const FILE_SIZE_LIMIT_BYTES = 4 * 1024 * 1024; // 4 MB

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`Thieu bien moi truong: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bucketOptions = {
    public: false,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    fileSizeLimit: FILE_SIZE_LIMIT_BYTES,
  };

  const { data: created, error: createError } = await admin.storage.createBucket(
    BUCKET_NAME,
    bucketOptions,
  );

  if (!createError) {
    console.log(`Da tao bucket "${BUCKET_NAME}" (${created?.name ?? BUCKET_NAME}).`);
    console.log(`  public: false, allowedMimeTypes: ${ALLOWED_MIME_TYPES.join(", ")}, fileSizeLimit: ${FILE_SIZE_LIMIT_BYTES} bytes`);
    return;
  }

  const alreadyExists =
    createError.message?.toLowerCase().includes("already exists") ||
    createError.message?.toLowerCase().includes("duplicate");

  if (!alreadyExists) {
    console.error(`Loi khi tao bucket "${BUCKET_NAME}": ${createError.message}`);
    process.exit(1);
  }

  const { error: updateError } = await admin.storage.updateBucket(BUCKET_NAME, bucketOptions);
  if (updateError) {
    console.error(`Loi khi cap nhat cau hinh bucket "${BUCKET_NAME}": ${updateError.message}`);
    process.exit(1);
  }

  console.log(`Bucket "${BUCKET_NAME}" da ton tai — da cap nhat cau hinh (public: false, allowedMimeTypes, fileSizeLimit).`);
}

main();
