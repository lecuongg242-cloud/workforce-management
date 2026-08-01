#!/usr/bin/env node
/**
 * Tao 10 tai khoan dang nhap that qua Supabase Auth Admin API (khong bao gio
 * INSERT thang vao auth.users — insert SQL thang khong tao auth.identities
 * nen tai khoan khong dang nhap duoc, xem 02-RESEARCH.md Pattern 7 va D-15).
 *
 * Voi moi doanh nghiep (cty-01, cty-02): chon 5 nhan vien active dau tien
 * theo `code` tang dan, gan vai tro membership owner/admin/manager/employee/
 * employee (D-14). 30 nhan vien con lai giu user_id = null — day la trang
 * thai san xuat that, khong phai du lieu thieu.
 *
 * Chay lai duoc nhieu lan: email da co tai khoan thi tra ve user id cu, KHONG
 * dat lai mat khau (T-02-03-05).
 *
 * Mat khau tam CHI xuat hien tren stdout, dung mot lan, khong bao gio ghi ra
 * file/DB/audit (T-02-03-02) — script nay tuyet doi khong duoc dung module
 * `node:fs` (hay bat ky co che ben vung nao khac) de luu lai mat khau.
 *
 * Lenh: node --env-file=.env.local scripts/seed-auth.mjs  (npm run seed:auth)
 */

import { randomBytes } from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const COMPANIES = ["cty-01", "cty-02"];
const ROLE_ORDER = ["owner", "admin", "manager", "employee", "employee"];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`Thieu bien moi truong: ${name}`);
    process.exit(1);
  }
  return value;
}

function generateTempPassword() {
  return randomBytes(18).toString("base64url");
}

/**
 * Tim user id theo email bang cach quet listUsers qua cac trang — Admin API
 * khong co endpoint "tim theo email" truc tiep.
 */
async function findUserIdByEmail(admin, email) {
  const perPage = 1000;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`Loi khi liet ke nguoi dung de tim "${email}": ${error.message}`);
      process.exit(1);
    }
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });

  const rows = [];
  let createdCount = 0;
  let existingCount = 0;
  /** @type {{ email: string; password: string } | null} */
  let firstNewAccount = null;

  for (const companyId of COMPANIES) {
    const { data: employees, error: selectError } = await admin
      .from("employees")
      .select("id, code, email, full_name")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("code", { ascending: true })
      .limit(5);

    if (selectError) {
      console.error(`Loi khi doc employees cua ${companyId}: ${selectError.message}`);
      process.exit(1);
    }
    if (!employees || employees.length < 5) {
      console.error(
        `Doanh nghiep ${companyId} chi co ${employees ? employees.length : 0} nhan vien active — can it nhat 5.`,
      );
      process.exit(1);
    }

    for (let i = 0; i < 5; i += 1) {
      const employee = employees[i];
      const role = ROLE_ORDER[i];
      const password = generateTempPassword();

      let userId = null;
      let alreadyExisted = false;

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: employee.email,
        password,
        email_confirm: true,
        app_metadata: { must_change_password: true },
      });

      if (createError) {
        const isEmailExists =
          createError.status === 422 ||
          createError.code === "email_exists" ||
          /already.*registered|already.*exists/i.test(createError.message ?? "");

        if (!isEmailExists) {
          console.error(
            `Loi khi tao tai khoan cho "${employee.email}": ${createError.message}`,
          );
          process.exit(1);
        }

        userId = await findUserIdByEmail(admin, employee.email);
        if (!userId) {
          console.error(
            `Tao tai khoan "${employee.email}" bao da ton tai nhung khong tim thay qua listUsers.`,
          );
          process.exit(1);
        }
        alreadyExisted = true;
        existingCount += 1;
      } else {
        userId = created.user.id;
        createdCount += 1;
        if (!firstNewAccount) {
          firstNewAccount = { email: employee.email, password };
        }
      }

      const { error: membershipError } = await admin
        .from("memberships")
        .upsert(
          {
            user_id: userId,
            company_id: companyId,
            role,
            status: "active",
            last_accessed_at: null,
          },
          { onConflict: "user_id,company_id" },
        );
      if (membershipError) {
        console.error(
          `Loi khi ghi membership cho "${employee.email}": ${membershipError.message}`,
        );
        process.exit(1);
      }

      const { error: employeeUpdateError } = await admin
        .from("employees")
        .update({ user_id: userId, system_role: role })
        .eq("id", employee.id);
      if (employeeUpdateError) {
        console.error(
          `Loi khi cap nhat employees.user_id cho "${employee.email}": ${employeeUpdateError.message}`,
        );
        process.exit(1);
      }

      rows.push({
        email: employee.email,
        company: companyId,
        role,
        password: alreadyExisted ? "(đã tồn tại — không đổi mật khẩu)" : password,
      });
    }
  }

  // (e2) Mot nguoi thuoc HAI doanh nghiep — de AUTH-05 kiem duoc.
  //
  // Truoc buoc nay, moi tai khoan chi thuoc dung mot doanh nghiep, nen tieu chi
  // "nguoi thuoc nhieu doanh nghiep doi duoc noi lam viec va du lieu doi theo"
  // khong the nghiem thu bang du lieu mau — khong phai chua kiem, ma la KHONG
  // CO GI DE KIEM. Day la thieu sot cua bo seed, khong phai cua ma nguon.
  //
  // Schema cho phep: `memberships` unique theo (user_id, company_id) chu khong
  // theo user_id, va `employees.user_id` khong co rang buoc unique. Mot nguoi
  // lam o hai cong ty lien quan la tinh huong that, khong phai truong hop bia.
  //
  // Cach lam: lay tai khoan manager cua doanh nghiep dau, gan them mot
  // membership o doanh nghiep thu hai va noi vao mot dong employees con trong
  // o do. Khong tao tai khoan moi — van dung 10 tai khoan.
  const dualEmail = rows.find((r) => r.company === COMPANIES[0] && r.role === "manager")?.email;

  if (dualEmail) {
    const { data: dualEmp } = await admin
      .from("employees")
      .select("user_id")
      .eq("email", dualEmail)
      .maybeSingle();

    const dualUserId = dualEmp?.user_id ?? null;

    // Da gan lan truoc chua? Phai hoi truoc khi chiem them mot dong employees,
    // neu khong thi moi lan chay lai script se an them mot suat nhan vien o
    // doanh nghiep thu hai — chay ba lan la mat ba dong, va khong ai nhan ra
    // vi so tong ket van "gan dung".
    const { data: already } = dualUserId
      ? await admin
          .from("employees")
          .select("id, code")
          .eq("company_id", COMPANIES[1])
          .eq("user_id", dualUserId)
          .maybeSingle()
      : { data: null };

    // Chi tim dong trong khi chua gan bao gio.
    const { data: freeSlots } = already
      ? { data: null }
      : await admin
          .from("employees")
          .select("id, code, email")
          .eq("company_id", COMPANIES[1])
          .eq("status", "active")
          .is("user_id", null)
          .order("code", { ascending: true })
          .limit(1);

    const slot = already ?? (freeSlots && freeSlots.length > 0 ? freeSlots[0] : null);

    if (dualUserId && slot) {
      const { error: memErr } = await admin.from("memberships").upsert(
        {
          user_id: dualUserId,
          company_id: COMPANIES[1],
          role: "manager",
          status: "active",
        },
        { onConflict: "user_id,company_id" },
      );

      const { error: empErr } = await admin
        .from("employees")
        .update({ user_id: dualUserId, system_role: "manager" })
        .eq("id", slot.id);

      if (memErr || empErr) {
        console.error(
          `Canh bao: khong gan duoc thanh vien thu hai cho "${dualEmail}": ${
            memErr?.message ?? empErr?.message
          }`,
        );
      } else {
        console.log(
          `Thanh vien hai doanh nghiep: ${dualEmail} nay thuoc ca ${COMPANIES[0]} va ${COMPANIES[1]} (AUTH-05).`,
        );
      }
    } else {
      console.error(
        "Canh bao: khong dung duoc tai khoan thuoc hai doanh nghiep — " +
          (dualUserId ? "khong con dong employees trong o doanh nghiep thu hai." : "khong tim thay user_id cua manager."),
      );
    }
  }

  // (f) Kiem chung dang nhap that bang tai khoan vua tao moi.
  if (firstNewAccount) {
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: firstNewAccount.email,
      password: firstNewAccount.password,
    });
    if (signInError) {
      console.error(
        `Kiem chung dang nhap that bai cho "${firstNewAccount.email}": ${signInError.message}`,
      );
      process.exit(1);
    }
    await anon.auth.signOut();
    console.log(`Da kiem chung dang nhap that: ${firstNewAccount.email}`);
  } else {
    console.log(
      "Bo qua kiem chung dang nhap: tat ca 10 tai khoan da ton tai tu truoc, khong co mat khau nao trong tay script nay.",
    );
  }

  const { count: nullUserIdCount, error: countError } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .is("user_id", null);
  if (countError) {
    console.error(`Loi khi dem employees.user_id = null: ${countError.message}`);
    process.exit(1);
  }

  console.log("");
  console.log("email | doanh nghiep | vai tro | mat khau tam");
  console.log("-----------------------------------------------------------");
  for (const row of rows) {
    console.log(`${row.email} | ${row.company} | ${row.role} | ${row.password}`);
  }
  console.log("-----------------------------------------------------------");
  // Ky vong 29 chu khong phai 30: 40 nhan vien tru 10 dong duoc gan o vong lap
  // chinh, tru them 1 dong o doanh nghiep thu hai danh cho nguoi thuoc ca hai
  // doanh nghiep (buoc e2, phuc vu AUTH-05).
  console.log(
    `Tong ket: ${createdCount} tai khoan tao moi, ${existingCount} tai khoan da ton tai, ${rows.length} tai khoan (ky vong 10), ${nullUserIdCount} dong employees con user_id = null (ky vong 29).`,
  );
}

main();
