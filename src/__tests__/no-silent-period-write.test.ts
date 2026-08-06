import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PERIOD_WRITE_EXEMPTIONS,
  isPeriodWriteExempt,
  scanPeriodWriteSource,
} from "@/__tests__/lib/period-write-scan";

/**
 * CONG CHAN "KHONG DUONG GHI THANG NAO VAO DU LIEU CHAM CONG" (Phase 5, plan
 * 05-06).
 *
 * Nam plan truoc moi plan co grep gate rieng trong acceptance criteria, nhung
 * acceptance criteria chi chay MOT LAN luc thuc thi plan do. Dieu de mat nhat
 * cua phase nay la bat bien "moi thay doi vao du lieu cong di qua mot duong co
 * kiem soat" — no chet lang le, duoi dang mot `insert` tien tay o mot plan
 * tuong lai. Cong nay la thu DUY NHAT cua Phase 5 con song sau khi phase ket
 * thuc.
 *
 * Cong CHI quet `src/lib/data/mutations/` — do la noi duy nhat cua du an duoc
 * phep ghi (D-12c: Route Handler chi `GET`). Mot lenh ghi xuat hien o cho
 * khac se bi cong `route-handlers-get-only` cua 02-04 bat truoc.
 */

const ROOT = process.cwd();
const MUTATIONS_DIR = path.join("src", "lib", "data", "mutations");

function mutationFiles(): string[] {
  return readdirSync(path.join(ROOT, MUTATIONS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(MUTATIONS_DIR, entry.name));
}

const files = mutationFiles();

describe("no-silent-period-write (Phase 5)", () => {
  it("quet duoc it nhat 5 file mutation — mot cong dem 0 file khong phai bang chung khong vi pham", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it("danh sach mien tru la tuong minh, moi muc co ly do, va khong qua 3 muc", () => {
    expect(PERIOD_WRITE_EXEMPTIONS.length).toBeLessThanOrEqual(3);
    for (const item of PERIOD_WRITE_EXEMPTIONS) {
      expect(item.reason.length).toBeGreaterThan(20);
    }
  });

  it("khong file mutation nao ngoai danh sach mien tru ghi thang vao attendance_records", () => {
    const failures: string[] = [];

    for (const file of files) {
      if (isPeriodWriteExempt(file)) continue;
      const source = readFileSync(path.join(ROOT, file), "utf8");
      for (const violation of scanPeriodWriteSource(source)) {
        failures.push(
          `${file}:${violation.line} ${violation.text}\n` +
            "  -> Cach sua dung: dua phan ghi vao `tf_apply_approved_request()` " +
            "(migration 0018) va goi mot RPC. Co bao ve ky da chot la " +
            "transaction-local (D-32a), nen mot lenh PostgREST roi rac se KHONG " +
            "bao gio di qua duoc ky da chot.",
        );
      }
    }

    expect(failures.join("\n")).toBe("");
  });

  /* ---------------------------------------------------------------------- */
  /* CONG CO RANG: mau vi pham gia lap phai bi bat                           */
  /* ---------------------------------------------------------------------- */

  it("CO RANG 1: insert thang vao attendance_records bi bat", () => {
    const violating = `
      const { error } = await supabase.from("attendance_records").insert({ id });
    `;
    expect(scanPeriodWriteSource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 2: chuoi lenh xuong dong (khuon that cua PostgREST) van bi bat", () => {
    const violating = `
      const { data } = await supabase
        .from("attendance_records")
        .update({ worked_minutes: 0 })
        .eq("id", recordId);
    `;
    expect(scanPeriodWriteSource(violating)).not.toHaveLength(0);
  });

  it("CO RANG 3: delete va upsert cung bi bat", () => {
    expect(
      scanPeriodWriteSource(`await supabase.from("attendance_records").delete().eq("id", x);`),
    ).not.toHaveLength(0);
    expect(
      scanPeriodWriteSource(`await supabase.from("attendance_records").upsert(row);`),
    ).not.toHaveLength(0);
  });

  it("KHONG BAT NHAM: phep DOC, comment va chuoi hien thi khong bi coi la ghi", () => {
    const legitimate = `
      // Khong duoc goi .insert() tren attendance_records o day.
      /* Vi du: supabase.from("attendance_records").insert(...) la dieu CAM. */
      const label = "attendance_records";
      const { data } = await supabase
        .from("attendance_records")
        .select("id, work_date")
        .eq("company_id", companyId);
    `;
    expect(scanPeriodWriteSource(legitimate)).toHaveLength(0);
  });

  it("KHONG BAT NHAM: ghi vao mot bang KHAC khong bi coi la vi pham", () => {
    const legitimate = `
      await supabase.from("request_reviews").insert({ request_id: requestId });
      await supabase.from("notifications").insert({ user_id: userId });
    `;
    expect(scanPeriodWriteSource(legitimate)).toHaveLength(0);
  });

  it("duong yeu cau duoc duyet KHONG ghi thang — no goi RPC (D-32a)", () => {
    const source = readFileSync(
      path.join(ROOT, MUTATIONS_DIR, "requests.ts"),
      "utf8",
    );

    expect(scanPeriodWriteSource(source)).toHaveLength(0);
    expect(source).toContain("tf_apply_approved_request");
  });
});
