#!/usr/bin/env node
/**
 * Tao MOT tai khoan platform admin that (doi van hanh TimeFlow) qua Supabase
 * Auth Admin API va ghi ten no vao `platform_admins`.
 *
 * Vi sao phai co script rieng thay vi mot dong trong seed.sql: `platform_admins`
 * tham chieu `auth.users`, ma duong DUY NHAT tao tai khoan dang nhap duoc la
 * Admin API (insert SQL thang khong tao `auth.identities` nen tai khoan khong
 * dang nhap duoc — D-15, 02-RESEARCH.md Pattern 7). Cung ly do khien
 * `scripts/seed-auth.mjs` ton tai tach khoi `supabase/seed.sql`.
 *
 * Nguoi nay KHONG co membership o doanh nghiep nao — do la dinh nghia cua vai
 * tro (0006_platform_admins.sql): platform admin la nguoi van hanh TimeFlow,
 * khong phai thanh vien mot doanh nghiep khach hang.
 *
 * Chay lai duoc nhieu lan: email da co tai khoan thi giu nguyen mat khau cu va
 * chi bao dam dong `platform_admins` co mat.
 *
 * Mat khau CHI xuat hien tren stdout, dung mot lan — script nay tuyet doi
 * khong duoc dung `node:fs` de luu lai (cung rang buoc voi seed-auth.mjs).
 *
 * Lenh: node --env-file=.env.local scripts/seed-platform-admin.mjs
 *       (npm run seed:platform-admin)
 */

import { randomBytes } from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const PLATFORM_ADMIN_EMAIL = process.env.TF_PLATFORM_ADMIN_EMAIL ?? "ops@timeflow.vn";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`Thieu bien moi truong: ${name}`);
    process.exit(1);
  }
  return value;
}

/**
 * Admin API khong co endpoint "tim theo email" — quet listUsers theo trang,
 * dung khuon findUserIdByEmail() cua seed-auth.mjs.
 */
async function findUserIdByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`Loi khi liet ke nguoi dung: ${error.message}`);
      process.exit(1);
    }
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = await findUserIdByEmail(admin, PLATFORM_ADMIN_EMAIL);
  let password = null;

  if (userId === null) {
    password = randomBytes(18).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email: PLATFORM_ADMIN_EMAIL,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`Khong tao duoc tai khoan "${PLATFORM_ADMIN_EMAIL}": ${error?.message}`);
      process.exit(1);
    }
    userId = data.user.id;
  }

  const { error: insertError } = await admin
    .from("platform_admins")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (insertError) {
    console.error(`Khong ghi duoc platform_admins: ${insertError.message}`);
    process.exit(1);
  }

  console.log("");
  console.log("Platform admin da san sang:");
  console.log(`  email   : ${PLATFORM_ADMIN_EMAIL}`);
  console.log(`  user_id : ${userId}`);
  if (password === null) {
    console.log("  mat khau: (tai khoan da co tu truoc — khong dat lai)");
  } else {
    console.log(`  mat khau: ${password}`);
    console.log("");
    console.log("  Mat khau nay KHONG hien lai lan nao nua — chep ngay.");
  }
  console.log("");
}

await main();
