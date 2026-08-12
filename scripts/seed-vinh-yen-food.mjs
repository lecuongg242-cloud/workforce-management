#!/usr/bin/env node
/**
 * Nap du lieu THAT cua doanh nghiep Vinh Yen Food (1 chu + 10 nhan vien) vao
 * database dang chay. Thiet ke:
 *   docs/superpowers/specs/2026-08-13-du-lieu-vinh-yen-food-design.md
 *
 * Khac han `seed-auth.mjs` va `seed.sql` o MOT diem quyet dinh moi dong lenh
 * ben duoi: day la du lieu THAT, khong phai fixture. Khong mot buoc nao duoc
 * xoa, truncate, hay ghi de mot con so tien da ton tai.
 *
 * CHAY LAI DUOC NHIEU LAN, va do la mot yeu cau chu khong phai mot tien ich:
 * lan chay dau co the dut giua chung (mang, gioi han mat khau cua Supabase),
 * va lan chay thu hai phai HOI TU chu khong duoc nhan doi doanh nghiep. Vi vay
 * moi id o day la ID CO DINH — `randomUUID()` se tao mot ban sao thu hai cua ca
 * doanh nghiep o moi lan chay.
 *
 * HAI BANG KHONG BAO GIO DUOC `upsert`: `employee_pay_rates` va
 * `employee_overtime_rates` la append-only co trigger cuong che o database
 * (migration 0022/0026). Script DOC TRUOC KHI GHI va bo qua neu da co dong cho
 * moc hieu luc do. Mot `upsert` o day se bi trigger tu choi — va neu vi mot ly
 * do nao do no khong bi tu choi, no se lam tien da tra cua ky truoc tinh lai ra
 * mot con so khac.
 *
 * Mat khau ban dau la mot con so CO DINH do chu doanh nghiep chon (12345678,
 * khong bat doi o lan dang nhap dau). Day la mot danh doi co y thuc da ghi o
 * §V-05 cua thiet ke: ai biet ten dang nhap deu vao duoc tai khoan nguoi khac.
 * Tai khoan DA TON TAI thi KHONG bao gio bi dat lai mat khau — cung quy tac voi
 * `seed-auth.mjs` (T-02-03-05): mot nguoi da tu doi mat khau khong bi script
 * nay day nguoc ve 12345678.
 *
 * Lenh: node --env-file=.env.local scripts/seed-vinh-yen-food.mjs
 *       (npm run seed:vinhyen)
 */

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/* Hang so cua doanh nghiep                                                    */
/* -------------------------------------------------------------------------- */

const COMPANY_ID = "cty-vinhyen";
const SHIFT_ID = "sft-vinhyen-lh";
const EMAIL_DOMAIN = "vinhyenfood.com";
const INITIAL_PASSWORD = "12345678";

/** Moc hieu luc cua MOI muc luong va MOI muc tang ca (§V-06). */
const EFFECTIVE_FROM = "2026-08-01";
/** Ngay bat dau lam viec tren ho so — cung moc, chua ai khai ngay that. */
const START_DATE = "2026-08-01";

/** 9,5 tieng, tinh bang phut. Vua la do dai ca, vua la mau so quy mot cong. */
const SHIFT_DURATION_MINUTES = 570;
const STANDARD_HOURS_PER_DAY = 9.5;

/**
 * Muoi nguoi an luong ngay. `otHourly` la SO TIEN mot gio tang ca (dong),
 * khong phai he so — xem migration 0026 §B.
 *
 * Email theo quy tac "ten + viet tat ho dem", ap cho CA MUOI NGUOI chu khong
 * chi hai cho trung (Tran Thi Anh / Ha Viet Anh, Nguyen Thi Yen / chu Yen).
 * Mot quy tac co hai ngoai le la quy tac nguoi ta go sai.
 */
const EMPLOYEES = [
  { code: "NV001", name: "Nguyễn Thị Hiền", local: "hien.nt", dayRate: 250000, otHourly: 40000 },
  { code: "NV002", name: "Trần Thị Anh", local: "anh.tt", dayRate: 270000, otHourly: 40000 },
  { code: "NV003", name: "Nguyễn Văn Thái", local: "thai.nv", dayRate: 300000, otHourly: 40000 },
  { code: "NV004", name: "Nguyễn Thị Minh Thu", local: "thu.ntm", dayRate: 270000, otHourly: 40000 },
  { code: "NV005", name: "Lê Thị Hiếu", local: "hieu.lt", dayRate: 250000, otHourly: 40000 },
  { code: "NV006", name: "Nguyễn Thị Yên", local: "yen.nt", dayRate: 270000, otHourly: 40000 },
  { code: "NV007", name: "Đinh Thị Mười", local: "muoi.dt", dayRate: 250000, otHourly: 40000 },
  { code: "NV008", name: "Hà Việt Anh", local: "vietanh.hv", dayRate: 220000, otHourly: 40000 },
  { code: "NV009", name: "Nguyễn Thị Sáu", local: "sau.nt", dayRate: 270000, otHourly: 40000 },
  { code: "NV010", name: "Đường Văn Hưng", local: "hung.dv", dayRate: 200000, otHourly: 40000 },
];

/**
 * Chu doanh nghiep. KHONG co muc luong: chi khong an luong ngay trong danh
 * sach tren. Bang luong se hien dong cua chi la "chua khai muc luong" chu
 * khong phai so 0 — dung y D-26, va o day su khac biet do la su that.
 */
const OWNER = {
  code: "QL01",
  name: "Nguyễn Yến",
  local: "yen",
  role: "owner",
};

/* -------------------------------------------------------------------------- */
/* Tien ich                                                                    */
/* -------------------------------------------------------------------------- */

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`Thieu bien moi truong: ${name}`);
    process.exit(1);
  }
  return value;
}

/** Dung ngay o loi dau tien: mot doanh nghiep nap do dang kho doc hon la khong nap gi. */
function fail(step, error) {
  console.error(`\nDUNG o buoc "${step}": ${error?.message ?? error}`);
  if (error?.details) console.error(`  chi tiet: ${error.details}`);
  if (error?.hint) console.error(`  goi y: ${error.hint}`);
  process.exit(1);
}

function emailOf(local) {
  return `${local}@${EMAIL_DOMAIN}`;
}

function employeeIdOf(code) {
  return `nv-vinhyen-${code.toLowerCase()}`;
}

/**
 * Tim user id theo email bang cach quet listUsers qua cac trang — Admin API
 * khong co endpoint "tim theo email" truc tiep. Cung khuon `seed-auth.mjs`.
 */
async function findUserIdByEmail(admin, email) {
  const perPage = 1000;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) fail(`tim tai khoan "${email}"`, error);
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

/**
 * Tao tai khoan neu chua co; tra ve `{ userId, created }`.
 *
 * Tai khoan DA TON TAI thi tra id cu va KHONG dong toi mat khau (T-02-03-05).
 */
async function ensureUser(admin, email) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: INITIAL_PASSWORD,
    email_confirm: true,
    // §V-05: chu doanh nghiep chon KHONG bat doi mat khau o lan dau. Co nay
    // duoc khai TUONG MINH thay vi bo trong, de y dinh doc duoc ngay tai cho.
    app_metadata: { must_change_password: false },
  });

  if (!error) return { userId: created.user.id, created: true };

  const isEmailExists =
    error.status === 422 ||
    error.code === "email_exists" ||
    /already.*registered|already.*exists/i.test(error.message ?? "");

  if (!isEmailExists) {
    // Truong hop dang gap nhat o day KHONG phai loi mang: nhieu project
    // Supabase bat "leaked password protection", va 12345678 nam trong moi
    // danh sach mat khau ro ri tren doi. Noi thang ra thay vi de nguoi chay
    // doan tu mot thong diep tieng Anh chung chung.
    if (/weak|leaked|pwned|breach|password/i.test(error.message ?? "")) {
      console.error(
        `\nSupabase TU CHOI mat khau "${INITIAL_PASSWORD}" cho ${email}:\n` +
          `  ${error.message}\n\n` +
          "Nguyen nhan gan nhu chac chan la project dang bat bao ve mat khau ro ri\n" +
          "(Authentication > Policies). Hai duong di tiep:\n" +
          "  1. Tat bao ve do trong Dashboard roi chay lai script nay.\n" +
          "  2. Doi mat khau ban dau sang mot chuoi khac va sua INITIAL_PASSWORD.\n",
      );
      process.exit(1);
    }
    fail(`tao tai khoan "${email}"`, error);
  }

  const userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    fail(
      `tao tai khoan "${email}"`,
      new Error("Supabase bao email da ton tai nhung khong tim thay qua listUsers."),
    );
  }
  return { userId, created: false };
}

/* -------------------------------------------------------------------------- */
/* Cac buoc                                                                    */
/* -------------------------------------------------------------------------- */

async function upsertCompany(admin) {
  const { error } = await admin.from("companies").upsert(
    {
      id: COMPANY_ID,
      name: "Vinh Yến Food",
      code: "VINHYEN",
      industry: "fnb",
      size: "11-30",
      // Hai cot NOT NULL ma chu doanh nghiep chua co gia tri that. Chung duoc
      // dat sao cho DOC RA LA CHUA KHAI, khong phai sao cho trong nhu that —
      // day chinh la lap luan cua migration 0028: mot gia tri dai dien trong
      // giong du lieu that thi khong ai phan biet duoc, nen khong ai sua.
      phone: "0000000000",
      address: "Chưa khai địa chỉ",
      accent: "indigo",
    },
    { onConflict: "id" },
  );
  if (error) fail("tao doanh nghiep", error);
}

async function upsertSettings(admin) {
  const { error } = await admin.from("company_settings").upsert(
    {
      company_id: COMPANY_ID,
      // §V-03: thieu gio thi tru theo ti le, doi xung voi cach tang ca tinh
      // theo gio. Che do `shift` se tra du mot cong cho nguoi ve som.
      work_mode: "daily_hours",
      standard_hours_per_day: STANDARD_HOURS_PER_DAY,
      // KHONG khai: khong ai o day an luong thang, nen mau so nay khong tham
      // gia phep tinh nao. `null` = chua khai (D-38), khong phai 22 hay 26.
      standard_days_per_month: null,
    },
    { onConflict: "company_id" },
  );
  if (error) fail("khai cau hinh doanh nghiep", error);
}

async function upsertShift(admin) {
  const { error } = await admin.from("shifts").upsert(
    {
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca linh hoạt",
      code: "CA-LH",
      // Hinh dang bat buoc cua ca linh hoat theo `shifts_shape_check` (0027):
      // co `duration_minutes`, KHONG co gio vao/ra, khong gio nghi, khong bien
      // do tre gio. Ca nay khong tinh di muon, ve som hay "ngoai khung gio ca".
      kind: "hours",
      duration_minutes: SHIFT_DURATION_MINUTES,
      start_time: null,
      end_time: null,
      break_start_time: null,
      break_end_time: null,
      break_minutes: 0,
      late_tolerance_minutes: 0,
      // §V-08 — DAY LA MOT CON SO RA TIEN. Ngay nam ngoai danh sach nay bi
      // `classifyWorkDay()` xep la `weekend`, va khi do TOAN BO gio lam cua
      // ngay thanh tang ca: mot chu nhat cua nguoi an 250k se ra 380k.
      working_days: [1, 2, 3, 4, 5, 6, 7],
      status: "active",
    },
    { onConflict: "id" },
  );
  if (error) fail("tao ca linh hoat", error);
}

async function upsertMembership(admin, userId, role) {
  const { error } = await admin.from("memberships").upsert(
    { user_id: userId, company_id: COMPANY_ID, role, status: "active" },
    { onConflict: "user_id,company_id" },
  );
  if (error) fail(`gan quyen ${role}`, error);
}

async function upsertEmployee(admin, { id, code, name, email, userId, systemRole }) {
  const { error } = await admin.from("employees").upsert(
    {
      id,
      company_id: COMPANY_ID,
      code,
      full_name: name,
      email,
      // SAU TRUONG DE `null` = CHUA KHAI (migration 0028). Khong dien gia tri
      // dai dien: mot ngay sinh bia ra khong phan biet duoc voi ngay sinh that.
      phone: null,
      date_of_birth: null,
      gender: null,
      department_id: null,
      position: null,
      contract_type: null,
      manager_id: null,
      avatar_url: null,
      start_date: START_DATE,
      shift_id: SHIFT_ID,
      // KHONG lay tu `companies.address` (dang la cho trong) — day la mot su
      // that, khong phai mot cho trong thu hai.
      work_location: "Vinh Yến Food",
      status: "active",
      system_role: systemRole,
      invitation_sent: false,
      // Ca hai co chon chieu TAT cho nhan vien, bat lai bang mot cu bam o tung
      // ho so. Bat nham thi nguoi lao dong da nhin thay luong roi, khong thu
      // lai duoc; va bat buoc co mat tai quan chinh la gia tri loi cua san pham.
      can_view_payslip: systemRole === "owner",
      can_check_in_remotely: systemRole === "owner",
      user_id: userId,
    },
    { onConflict: "id" },
  );
  if (error) fail(`tao ho so nhan vien ${code}`, error);
}

/**
 * Ghi mot dong vao mot bang APPEND-ONLY, va chi khi moc hieu luc do chua co.
 *
 * DOC TRUOC KHI GHI la bat buoc chu khong phai toi uu: trigger cua 0022/0026
 * tu choi moi UPDATE/DELETE, nen mot `upsert` gap dong cu se hong ca lan chay.
 * Tra ve `true` neu vua chen, `false` neu da co tu truoc.
 */
async function insertRateIfAbsent(admin, table, row, label) {
  const { data: existing, error: readError } = await admin
    .from(table)
    .select("id, effective_from")
    .eq("employee_id", row.employee_id)
    .eq("effective_from", row.effective_from)
    .maybeSingle();
  if (readError) fail(`doc ${label}`, readError);
  if (existing) return false;

  const { error } = await admin.from(table).insert(row);
  if (error) fail(`khai ${label}`, error);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Chuong trinh chinh                                                          */
/* -------------------------------------------------------------------------- */

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

  console.log("Vinh Yến Food — nạp dữ liệu thật\n");

  await upsertCompany(admin);
  console.log("  [1/7] doanh nghiệp .............. Vinh Yến Food (VINHYEN)");

  await upsertSettings(admin);
  console.log(
    `  [2/7] cấu hình .................. daily_hours, ${STANDARD_HOURS_PER_DAY} giờ/công`,
  );

  await upsertShift(admin);
  console.log("  [3/7] ca làm việc ............... Ca linh hoạt 9,5 tiếng, cả 7 ngày");

  /* Tai khoan + membership + ho so, cho ca 11 nguoi. */
  const people = [
    { ...OWNER, id: employeeIdOf(OWNER.code), systemRole: "owner" },
    ...EMPLOYEES.map((e) => ({ ...e, id: employeeIdOf(e.code), systemRole: "employee" })),
  ];

  const report = [];
  let createdAccounts = 0;
  /** @type {{ email: string } | null} */
  let firstNewAccount = null;

  for (const person of people) {
    const email = emailOf(person.local);
    const { userId, created } = await ensureUser(admin, email);
    if (created) {
      createdAccounts += 1;
      if (!firstNewAccount) firstNewAccount = { email };
    }
    await upsertMembership(admin, userId, person.systemRole);
    await upsertEmployee(admin, {
      id: person.id,
      code: person.code,
      name: person.name,
      email,
      userId,
      systemRole: person.systemRole,
    });
    report.push({ ...person, email, created });
  }

  console.log(
    `  [4/7] tài khoản ................. ${createdAccounts} tạo mới, ${people.length - createdAccounts} đã có`,
  );
  console.log("  [5/7] quyền truy cập ............ 1 owner, 10 employee");
  console.log("  [6/7] hồ sơ nhân viên ........... 11 người");

  /* Muc luong va muc tang ca — chi cho 10 nguoi an luong ngay. */
  let newRates = 0;
  let skippedRates = 0;
  for (const employee of EMPLOYEES) {
    const employeeId = employeeIdOf(employee.code);

    const payInserted = await insertRateIfAbsent(
      admin,
      "employee_pay_rates",
      {
        company_id: COMPANY_ID,
        employee_id: employeeId,
        unit: "day",
        amount: employee.dayRate,
        effective_from: EFFECTIVE_FROM,
      },
      `mức lương ${employee.code}`,
    );

    const otInserted = await insertRateIfAbsent(
      admin,
      "employee_overtime_rates",
      {
        company_id: COMPANY_ID,
        employee_id: employeeId,
        // SO TIEN mot gio, khong phai he so. Doi luong goc KHONG lam doi con
        // so nay cho toi khi ai do khai mot phien ban moi (0026 §B).
        value_type: "fixed_hourly",
        value: employee.otHourly,
        effective_from: EFFECTIVE_FROM,
      },
      `tiền tăng ca ${employee.code}`,
    );

    for (const inserted of [payInserted, otInserted]) {
      if (inserted) newRates += 1;
      else skippedRates += 1;
    }
  }

  console.log(
    `  [7/7] lương & tăng ca ........... ${newRates} dòng mới, ${skippedRates} đã có (hiệu lực ${EFFECTIVE_FROM})`,
  );

  /* Kiem chung dang nhap that — bang tai khoan chu, va chi khi vua tao no. */
  if (firstNewAccount) {
    const { error } = await anon.auth.signInWithPassword({
      email: firstNewAccount.email,
      password: INITIAL_PASSWORD,
    });
    if (error) {
      fail(`kiểm chứng đăng nhập "${firstNewAccount.email}"`, error);
    }
    await anon.auth.signOut();
    console.log(`\nĐã kiểm chứng đăng nhập thật: ${firstNewAccount.email}`);
  } else {
    console.log("\nMọi tài khoản đã tồn tại từ trước — không đặt lại mật khẩu nào.");
  }

  /* -------------------------------------------------------------------- */
  console.log("\n11 tài khoản (mật khẩu ban đầu: " + INITIAL_PASSWORD + ")\n");
  console.log("mã     | họ tên                | email                          | vai trò  | lương/ngày | tăng ca/giờ");
  console.log("-".repeat(112));
  for (const row of report) {
    const rate = row.dayRate ? row.dayRate.toLocaleString("vi-VN") : "—";
    const ot = row.otHourly ? row.otHourly.toLocaleString("vi-VN") : "—";
    console.log(
      `${row.code.padEnd(6)} | ${row.name.padEnd(21)} | ${row.email.padEnd(30)} | ${row.systemRole.padEnd(8)} | ${rate.padStart(10)} | ${ot.padStart(11)}`,
    );
  }
  console.log("-".repeat(112));

  console.log("\nCòn phải tự khai trên giao diện:");
  console.log("  • Số điện thoại và địa chỉ thật  → /admin/settings");
  console.log("  • Điểm làm việc + toạ độ GPS     → /admin/work-sites");
  console.log("  • Ngày lễ (nếu muốn)             → /admin/settings");
  console.log(
    "\nLƯU Ý: tiền tăng ca khai theo từng người THAY CHO hệ số ngày lễ của doanh\n" +
      "nghiệp — mười người này không được nhân 300% ngày lễ theo Điều 98 BLLĐ.",
  );
}

main();
