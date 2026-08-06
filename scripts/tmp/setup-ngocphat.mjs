/**
 * Dung lai du lieu cua `cty-01` (Cong ty TNHH Thuong mai Ngoc Phat) de kiem
 * thu phan TINH LUONG:
 *   - giam tu 28 xuong 5 nhan vien, phu du phong ban / chuc vu / ca / don vi luong
 *   - khai du cau hinh luong (mau so quy doi, he so tang ca)
 *   - khai muc luong cho ca 5 nguoi
 *   - khai 3 khoan phu cap / khau tru co pham vi khac nhau
 *   - dung lai cham cong thang 07/2026
 *
 * KHOI PHUC: `npm run db:seed` truncate va nap lai toan bo du lieu goc.
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const C = "cty-01";
const MONTH = "2026-07";

/* -------------------------------------------------------------------------- */
/* Nam nguoi duoc giu — phu 5 phong ban, 3 ca, 3 don vi luong, 4 vai tro       */
/* -------------------------------------------------------------------------- */

const KEEP = [
  { code: "NV001", unit: "month", amount: 18_000_000 },
  { code: "NV002", unit: "month", amount: 45_000_000 },
  { code: "NV003", unit: "month", amount: 15_000_000 },
  { code: "NV004", unit: "day", amount: 450_000 },
  { code: "NV022", unit: "hour", amount: 55_000 },
];

function log(msg) {
  console.log(msg);
}

/** So thu tu ngay trong tuan theo ISO: 1 = Thu Hai ... 7 = Chu Nhat. */
function isoWeekday(date) {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return next.toISOString().slice(0, 10);
}

function daysOfMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: total },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

async function main() {
  /* ====================================================================== */
  log("\n=== 1. Doi chieu nhan vien va giai phong khoa ngoai quan ly ===");

  const { data: emps } = await admin
    .from("employees")
    .select("id, code, full_name, position, department_id, shift_id, user_id")
    .eq("company_id", C);

  const byCode = new Map(emps.map((e) => [e.code, e]));
  const keepIds = KEEP.map((k) => {
    const e = byCode.get(k.code);
    if (!e) throw new Error(`Khong tim thay ${k.code}`);
    return e.id;
  });
  const dropped = emps.filter((e) => !keepIds.includes(e.id));

  log(`Giu ${keepIds.length}, xoa ${dropped.length}`);

  // `departments.manager_id` va `employees.manager_id` deu tro toi `employees`.
  // Tro lai ve nguoi DUOC GIU cua chinh phong ban do truoc khi xoa, neu khong
  // khoa ngoai se chan.
  const keptByDept = new Map();
  for (const k of KEEP) {
    const e = byCode.get(k.code);
    keptByDept.set(e.department_id, e.id);
  }
  for (const [deptId, managerId] of keptByDept) {
    await admin
      .from("departments")
      .update({ manager_id: managerId })
      .eq("company_id", C)
      .eq("id", deptId);
  }
  // Phong ban khong con ai duoc giu -> khong con dung toi, nhung van phai go
  // manager_id de xoa duoc nguoi cu.
  await admin
    .from("departments")
    .update({ manager_id: null })
    .eq("company_id", C)
    .not("id", "in", `(${[...keptByDept.keys()].map((d) => `"${d}"`).join(",")})`);

  // `employees.manager_id` cua nguoi duoc giu: tro het ve Giam doc dieu hanh.
  const ceoId = byCode.get("NV002").id;
  for (const id of keepIds) {
    await admin
      .from("employees")
      .update({ manager_id: id === ceoId ? null : ceoId })
      .eq("id", id);
  }
  // Nguoi sap bi xoa cung phai go manager_id de thu tu xoa khong bi ket.
  await admin
    .from("employees")
    .update({ manager_id: null })
    .eq("company_id", C)
    .in(
      "id",
      dropped.map((e) => e.id),
    );

  /* ====================================================================== */
  log("\n=== 2. Go rang buoc cua `work_requests` ===");

  // `work_requests.employee_id` cascade khi xoa nhan vien, va cascade do keo
  // xuong `request_reviews` — noi co trigger append-only chan `DELETE` (0017).
  // Da doi chieu: KHONG yeu cau nao cua 23 nguoi nay tung duoc duyet, nen
  // khong dong `request_reviews` nao bi dong toi. Xoa truoc cho tuong minh.
  const droppedIds = dropped.map((e) => e.id);
  const { data: wrOfDropped } = await admin
    .from("work_requests")
    .select("id")
    .eq("company_id", C)
    .in("employee_id", droppedIds);
  if (wrOfDropped.length > 0) {
    const { error } = await admin
      .from("work_requests")
      .delete()
      .in(
        "id",
        wrOfDropped.map((r) => r.id),
      );
    if (error) throw new Error(`Khong xoa duoc yeu cau: ${error.message}`);
    log(`  xoa ${wrOfDropped.length} yeu cau cua nguoi bi xoa`);
  }

  // `work_requests.reviewer_id` la khoa ngoai TRAN (khong cascade, khong set
  // null) — no chinh la thu da chan lan chay truoc. Go ve `null`; lich su
  // "ai da duyet" van con nguyen o `request_reviews` (bang append-only).
  const { data: reviewedByDropped } = await admin
    .from("work_requests")
    .select("id")
    .eq("company_id", C)
    .in("reviewer_id", droppedIds);
  if (reviewedByDropped.length > 0) {
    const { error } = await admin
      .from("work_requests")
      .update({ reviewer_id: null })
      .in(
        "id",
        reviewedByDropped.map((r) => r.id),
      );
    if (error) throw new Error(`Khong go duoc reviewer_id: ${error.message}`);
    log(`  go reviewer_id khoi ${reviewedByDropped.length} yeu cau`);
  }

  log("\n=== 3. Xoa 23 nhan vien (cham cong cua ho di theo cascade) ===");

  for (const e of dropped) {
    const { error } = await admin.from("employees").delete().eq("id", e.id);
    if (error) throw new Error(`Khong xoa duoc ${e.code}: ${error.message}`);
  }

  // Tai khoan dang nhap cua nguoi da bi xoa: go membership de ho khong con vao
  // duoc khu quan tri cua doanh nghiep nay. Tai khoan auth giu nguyen.
  for (const e of dropped) {
    if (e.user_id) {
      await admin
        .from("memberships")
        .delete()
        .eq("company_id", C)
        .eq("user_id", e.user_id);
      log(`  go membership cua ${e.code}`);
    }
  }

  const { count: remain } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", C);
  log(`Con lai: ${remain} nhan vien`);

  // Phong ban rong -> xoa cho gon (khong phong nao trong 5 nguoi dung toi).
  const usedDepts = new Set([...keptByDept.keys()]);
  const { data: allDepts } = await admin
    .from("departments")
    .select("id, name")
    .eq("company_id", C);
  for (const d of allDepts) {
    if (!usedDepts.has(d.id)) {
      await admin.from("departments").delete().eq("id", d.id);
      log(`  xoa phong ban rong: ${d.name}`);
    }
  }

  /* ====================================================================== */
  log("\n=== 4. Cau hinh tinh luong cua doanh nghiep ===");

  // D-38: hai MAU SO quy doi. Khong co chung thi luong thang khong ra duoc don
  // gia ngay, va luong ngay/gio khong quy doi qua lai duoc.
  await admin
    .from("company_settings")
    .update({
      work_mode: "shift",
      standard_hours_per_day: 8,
      standard_days_per_month: 26,
    })
    .eq("company_id", C);
  log("work_mode=shift | 8 gio chuan/ngay | 26 ngay cong chuan/thang");

  // D-26: he so tang ca phai duoc khai het, neu khong thi ngay nao roi vao loai
  // chua khai se lam ca dong luong tra `null`.
  const { data: haveOt } = await admin
    .from("overtime_rules")
    .select("rule_key")
    .eq("company_id", C);
  const declared = new Set(haveOt.map((r) => r.rule_key));
  const wanted = [
    { rule_key: "weekday", multiplier: 1.5 },
    { rule_key: "weekend", multiplier: 2.0 },
    { rule_key: "holiday", multiplier: 3.0 },
    { rule_key: "night", multiplier: 0.3 },
  ];
  for (const r of wanted) {
    if (declared.has(r.rule_key)) {
      log(`  ${r.rule_key}: da khai, giu nguyen`);
      continue;
    }
    await admin.from("overtime_rules").insert({
      company_id: C,
      rule_key: r.rule_key,
      multiplier: r.multiplier,
      effective_from: "2026-01-01",
    });
    log(`  ${r.rule_key} = ${r.multiplier} tu 2026-01-01`);
  }

  /* ====================================================================== */
  log("\n=== 5. Muc luong cua tung nguoi (D-37: don vi khai theo tung nguoi) ===");

  for (const k of KEEP) {
    const e = byCode.get(k.code);
    const { data: exist } = await admin
      .from("employee_pay_rates")
      .select("id")
      .eq("employee_id", e.id)
      .eq("effective_from", "2026-01-01")
      .maybeSingle();
    if (exist) {
      log(`  ${k.code}: da co muc luong hieu luc 2026-01-01, giu nguyen`);
      continue;
    }
    const { error } = await admin.from("employee_pay_rates").insert({
      company_id: C,
      employee_id: e.id,
      unit: k.unit,
      amount: k.amount,
      effective_from: "2026-01-01",
    });
    if (error) throw new Error(`Khong khai duoc luong ${k.code}: ${error.message}`);
    const label = { month: "thang", day: "ngay", hour: "gio" }[k.unit];
    log(`  ${k.code} ${e.full_name}: ${k.amount.toLocaleString("vi-VN")} d/${label}`);
  }

  /* ====================================================================== */
  log("\n=== 6. Phu cap va khau tru (D-40: pham vi + loai tru) ===");

  await admin.from("pay_adjustments").delete().eq("company_id", C);

  const khoVanDept = byCode.get("NV004").department_id;
  const sanXuatDept = byCode.get("NV022").department_id;

  async function addAdjustment(row, scopes) {
    const { data, error } = await admin
      .from("pay_adjustments")
      .insert({ company_id: C, ...row })
      .select("id")
      .single();
    if (error) throw new Error(`Khong tao duoc khoan ${row.name}: ${error.message}`);
    await admin.from("pay_adjustment_scopes").insert(
      scopes.map((s) => ({ company_id: C, adjustment_id: data.id, ...s })),
    );
    log(`  ${row.name}`);
  }

  // Toan cong ty.
  await addAdjustment(
    {
      name: "Phụ cấp ăn trưa",
      kind: "allowance",
      value_type: "fixed_amount",
      value: 730_000,
    },
    [{ mode: "include", scope_type: "company", scope_value: null }],
  );

  // Theo PHONG BAN: chi Kho van va San xuat.
  await addAdjustment(
    {
      name: "Phụ cấp độc hại",
      kind: "allowance",
      value_type: "fixed_amount",
      value: 500_000,
    },
    [
      { mode: "include", scope_type: "department", scope_value: khoVanDept },
      { mode: "include", scope_type: "department", scope_value: sanXuatDept },
    ],
  );

  // % LUONG NGAY, toan cong ty TRU Giam doc dieu hanh — de thay ca hai chieu
  // cua pham vi (D-40) tren cung mot khoan.
  await addAdjustment(
    {
      name: "Phụ cấp trách nhiệm",
      kind: "allowance",
      value_type: "percent_of_daily_wage",
      value: 20,
    },
    [
      { mode: "include", scope_type: "company", scope_value: null },
      { mode: "exclude", scope_type: "employee", scope_value: ceoId },
    ],
  );

  // D-41: phat di muon nhan voi SO LAN di muon.
  await addAdjustment(
    {
      name: "Phạt đi muộn",
      kind: "deduction",
      value_type: "fixed_amount",
      value: 100_000,
      basis: "per_late",
    },
    [{ mode: "include", scope_type: "company", scope_value: null }],
  );

  /* ====================================================================== */
  log(`\n=== 7. Cham cong thang ${MONTH} ===`);

  // Xoa cham cong thang 7 cua 5 nguoi con lai roi dung lai cho sach.
  await admin
    .from("attendance_records")
    .delete()
    .eq("company_id", C)
    .gte("work_date", `${MONTH}-01`)
    .lt("work_date", "2026-08-01");

  const { data: shifts } = await admin
    .from("shifts")
    .select("id, start_time, end_time, break_minutes, working_days")
    .eq("company_id", C);
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const allDays = daysOfMonth(MONTH);

  /** Mot ngay lam viec that: vao `checkIn`, ra `checkOut` (co the sang hom sau). */
  async function punch(emp, date, checkIn, checkOut, opts = {}) {
    const shift = shiftById.get(emp.shift_id);
    // Ca qua dem: gio ra thuoc NGAY HOM SAU, nhung `work_date` van la ngay bat
    // dau (D-08).
    const overnight = checkOut <= checkIn;
    const { data: inAt } = await admin.rpc("tf_local_instant", {
      p_date: date,
      p_time: `${checkIn}:00`,
    });
    const { data: outAt } = await admin.rpc("tf_local_instant", {
      p_date: overnight ? addDays(date, 1) : date,
      p_time: `${checkOut}:00`,
    });
    const { data: worked } = await admin.rpc("tf_worked_minutes", {
      p_check_in: inAt,
      p_check_out: outAt,
      p_break_minutes: 0, // gio nghi duoc tru MOT LAN cho ca ngay o tang doc
    });
    return {
      id: `att-jul26-${emp.code}-${date}`,
      company_id: C,
      employee_id: emp.id,
      work_date: date,
      shift_id: emp.shift_id,
      check_in_at: inAt,
      check_out_at: outAt,
      worked_minutes: worked,
      late_minutes: opts.lateMinutes ?? 0,
      early_leave_minutes: 0,
      status: opts.status ?? "on_time",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    };
  }

  function leave(emp, date, status) {
    return {
      id: `att-jul26-${emp.code}-${date}`,
      company_id: C,
      employee_id: emp.id,
      work_date: date,
      shift_id: emp.shift_id,
      check_in_at: null,
      check_out_at: null,
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      status,
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    };
  }

  /**
   * Lich cua tung nguoi. `plan(date, index)` tra ve mo ta ngay do, hoac null
   * khi hom do khong lam.
   */
  const SCHEDULES = {
    // Ca hanh chinh 08:00-17:30 (nghi 90p -> 480 phut cong).
    NV001: {
      plan(date, i) {
        // 2 ngay tang ca den 19:30, 1 lan di muon, 1 ngay nghi phep.
        if (i === 2) return { kind: "punch", in: "08:00", out: "19:30" };
        if (i === 9) return { kind: "punch", in: "08:00", out: "19:30" };
        if (i === 5) return { kind: "punch", in: "08:30", out: "17:30", late: 30 };
        if (i === 12) return { kind: "leave", status: "leave_paid" };
        return { kind: "punch", in: "08:00", out: "17:30" };
      },
    },
    NV002: {
      // Giam doc: di lam deu, khong tang ca, khong muon.
      plan: () => ({ kind: "punch", in: "08:00", out: "17:30" }),
    },
    NV003: {
      plan(date, i) {
        // 2 lan di muon, 1 ngay nghi KHONG phep (D-43: bi tru mot ngay cong).
        if (i === 3) return { kind: "punch", in: "08:20", out: "17:30", late: 20 };
        if (i === 11) return { kind: "punch", in: "08:45", out: "17:30", late: 45 };
        if (i === 7) return { kind: "leave", status: "leave_unpaid" };
        return { kind: "punch", in: "08:00", out: "17:30" };
      },
    },
    // Ca sang 06:00-14:00 (nghi 30p -> 450 phut cong), Thu Hai-Thu Bay.
    NV004: {
      plan(date, i) {
        if (i === 4) return { kind: "punch", in: "06:00", out: "16:00" }; // tang ca 2h
        if (i === 15) return { kind: "punch", in: "06:25", out: "14:00", late: 25 };
        return { kind: "punch", in: "06:00", out: "14:00" };
      },
    },
    // Ca dem 22:00-06:00 hom sau (nghi 45p -> 435 phut cong).
    NV022: {
      plan(date, i) {
        // Ca dem khai working_days ca 7 ngay, nhung nguoi that van nghi Chu
        // Nhat — ngay khong co ban ghi don gian la khong co ngay cong.
        if (isoWeekday(date) === 7) return null;
        if (i === 6) return { kind: "punch", in: "22:00", out: "08:00" }; // tang ca 2h
        if (i === 13) return { kind: "punch", in: "22:00", out: "08:00" };
        return { kind: "punch", in: "22:00", out: "06:00" };
      },
    },
  };

  const rows = [];
  for (const k of KEEP) {
    const emp = byCode.get(k.code);
    const shift = shiftById.get(emp.shift_id);
    const workingDays = shift.working_days;
    const schedule = SCHEDULES[k.code];

    let index = 0;
    for (const date of allDays) {
      if (!workingDays.includes(isoWeekday(date))) continue;
      const spec = schedule.plan(date, index);
      index += 1;
      if (!spec) continue;
      if (spec.kind === "leave") {
        rows.push(leave(emp, date, spec.status));
      } else {
        rows.push(
          await punch(emp, date, spec.in, spec.out, {
            lateMinutes: spec.late,
            status: spec.late ? "late" : "on_time",
          }),
        );
      }
    }
  }

  // Chen theo lo de khong vuot gioi han cua PostgREST.
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await admin
      .from("attendance_records")
      .insert(rows.slice(i, i + 100));
    if (error) throw new Error(`Khong chen duoc cham cong: ${error.message}`);
  }
  log(`Da tao ${rows.length} ban ghi cham cong`);

  for (const k of KEEP) {
    const emp = byCode.get(k.code);
    const mine = rows.filter((r) => r.employee_id === emp.id);
    const lates = mine.filter((r) => r.status === "late").length;
    const leaves = mine.filter((r) => r.status.startsWith("leave")).length;
    log(
      `  ${k.code} ${emp.full_name}: ${mine.length} ngay | ${lates} lan muon | ${leaves} ngay nghi`,
    );
  }

  /* ====================================================================== */
  log("\n=== 8. Ky cong thang 7 de mo (chua chot) ===");
  const { data: period } = await admin
    .from("periods")
    .select("start_date, status")
    .eq("company_id", C)
    .eq("start_date", `${MONTH}-01`)
    .maybeSingle();
  log(`Ky ${MONTH}: ${period?.status ?? "chua ton tai"} — chot o /admin/periods khi muon chot luong`);

  log("\nXONG.");
}

main().catch((cause) => {
  console.error(`\nLOI: ${cause instanceof Error ? cause.message : cause}`);
  process.exit(1);
});
