// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT (khuon `holidays-mutations.test.ts` cua
// 04-03): `createServerSupabase` mock ve client dung `SUPABASE_SECRET_KEY`,
// `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { reviewRequest } from "@/lib/data/mutations/requests";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Sau hanh vi cua `<behavior>` Task 3 (05-01-PLAN.md) tren du lieu that. Hai
 * bai quan trong nhat:
 *   - GOI HAI LAN: lan hai bi tu choi va lich su van DUNG MOT DONG. Tu 05-02,
 *     mot lan xu ly thu hai se la mot lan tru cong thu hai — luc do loi hien
 *     ra duoi dang so lieu sai, khong phai mot thong bao loi.
 *   - TU CHOI THIEU LY DO bi chan o TANG SERVER, va chan TRUOC khi cham
 *     database (dong yeu cau van `pending`, khong co dong lich su nao).
 *
 * DON DEP: `request_reviews` la append-only o tang database (trigger 0017) nen
 * dong lich su do test sinh ra KHONG XOA DUOC — keo theo ca dong
 * `work_requests` tuong ung (cascade cung bi trigger chan). Nhung dong con lai
 * mang tien to id `wr-t0501-` va ly do "[test 05-01]" de nhan ra; mot lan
 * `npm run db:seed` (truncate ... cascade — truncate KHONG bi trigger chan)
 * don sach. Cung tinh chat da duoc ghi nhan o 04-06 voi `overtime_rules`.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return {
    ...actual,
    getSessionContext: vi.fn(),
  };
});

const COMPANY_ID = "cty-01";
const OTHER_COMPANY_ID = "cty-02";
const EMPLOYEE_ID = "nv-01a";
const OTHER_EMPLOYEE_ID = "nv-02a";

/** Ngay co dinh trong qua khu — khong dung chung voi bat ky fixture nao khac. */
const PAST_FROM = "2019-04-08";
const PAST_TO = "2019-04-09";

/**
 * Dinh danh DUY NHAT theo tung lan chay. Bat buoc, khong phai cho gon: mot
 * dong `request_reviews` khong xoa duoc (trigger append-only cua 0017), nen
 * neu tai dung id co dinh thi lan chay thu hai se thay yeu cau da o trang
 * thai `approved` va lich su da co san — test se do vi du lieu cu chu khong
 * vi ma sai. Tien to `wr-t0501-` giu nguyen de nhan ra va don duoc.
 */
const RUN = randomUUID().slice(0, 8);
const REQUEST_APPROVE = `wr-t0501-${RUN}-approve`;
const REQUEST_REJECT = `wr-t0501-${RUN}-reject`;
const REQUEST_NO_NOTE = `wr-t0501-${RUN}-no-note`;
const REQUEST_TWICE = `wr-t0501-${RUN}-twice`;
const REQUEST_FORBIDDEN = `wr-t0501-${RUN}-forbidden`;
const REQUEST_CROSS = `wr-t0501-${RUN}-cross`;

/** Chi nhung yeu cau KHONG sinh dong lich su moi xoa duoc khi don dep. */
const DELETABLE_REQUEST_IDS = [REQUEST_NO_NOTE, REQUEST_FORBIDDEN, REQUEST_CROSS];

describe("Duyệt / từ chối yêu cầu — reviewRequest (APRV-01, APRV-02, APRV-04)", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SECRET_KEY — test này chạy trên Postgres dev thật đã seed, cần .env.local.",
    );
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let actorUserId = "";
  let actorEmail = "";

  function session(role: "owner" | "admin" | "manager" | "employee") {
    return {
      userId: actorUserId,
      email: actorEmail,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  function pendingRow(id: string, companyId: string, employeeId: string) {
    return {
      id,
      company_id: companyId,
      employee_id: employeeId,
      type: "leave" as const,
      status: "pending" as const,
      from_date: PAST_FROM,
      to_date: PAST_TO,
      from_time: null,
      to_time: null,
      reason: "[test 05-01] Yêu cầu dựng cho test duyệt.",
    };
  }

  beforeAll(async () => {
    actorEmail = `test-05-01-${randomUUID()}@timeflow.test`;
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: actorEmail,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    // Don du lieu con sot cua CAC LAN CHAY TRUOC: chi nhung dong chua sinh
    // lich su moi xoa duoc (xem khoi chu thich dau file). Loi tra ve duoc bo
    // qua co y — mot lan don khong thanh cong khong duoc lam hong ca bo test.
    await admin.from("work_requests").delete().like("id", "wr-t0501-%");

    const { error: insertError } = await admin
      .from("work_requests")
      .insert(
        [
          pendingRow(REQUEST_APPROVE, COMPANY_ID, EMPLOYEE_ID),
          pendingRow(REQUEST_REJECT, COMPANY_ID, EMPLOYEE_ID),
          pendingRow(REQUEST_NO_NOTE, COMPANY_ID, EMPLOYEE_ID),
          pendingRow(REQUEST_TWICE, COMPANY_ID, EMPLOYEE_ID),
          pendingRow(REQUEST_FORBIDDEN, COMPANY_ID, EMPLOYEE_ID),
          pendingRow(REQUEST_CROSS, OTHER_COMPANY_ID, OTHER_EMPLOYEE_ID),
        ],
      );
    if (insertError) {
      throw new Error(`Không tạo được work_requests test: ${insertError.message}`);
    }

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));
  });

  afterAll(async () => {
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    // Tu 05-02, duyet mot yeu cau nghi phep SINH ban ghi cong that — don lai
    // dung khoang ngay cua fixture nay (2019, chi cua nhan vien nay).
    await admin
      .from("attendance_records")
      .delete()
      .eq("employee_id", EMPLOYEE_ID)
      .gte("work_date", PAST_FROM)
      .lte("work_date", PAST_TO);
    // Chi cac dong KHONG co lich su moi xoa duoc (xem khoi chu thich dau file).
    await admin.from("work_requests").delete().in("id", DELETABLE_REQUEST_IDS);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. duyệt thành công: trạng thái đổi, ba cột ảnh chụp được cập nhật, lịch sử một dòng, audit một dòng", async () => {
    const result = await reviewRequest(REQUEST_APPROVE, {
      decision: "approved",
      note: "Đã sắp xếp người thay ca.",
    });

    expect(result.request.status).toBe("approved");
    expect(result.request.reviewerId).toBe(EMPLOYEE_ID);
    expect(result.request.reviewNote).toBe("Đã sắp xếp người thay ca.");

    // Anh chup trang thai tren chinh dong yeu cau (D-33: ba cot cu giu nguyen)
    const { data: row } = await admin
      .from("work_requests")
      .select("status, reviewer_id, review_note, reviewed_at")
      .eq("id", REQUEST_APPROVE)
      .single();
    expect(row?.status).toBe("approved");
    expect(row?.reviewed_at).not.toBeNull();

    // Lich su — dung mot dong, mang du ai/luc nao/quyet dinh gi/ly do gi
    const { data: reviews } = await admin
      .from("request_reviews")
      .select("decision, note, reviewer_user_id, reviewer_employee_id, created_at")
      .eq("request_id", REQUEST_APPROVE);
    expect(reviews).toHaveLength(1);
    expect(reviews?.[0].decision).toBe("approved");
    expect(reviews?.[0].reviewer_user_id).toBe(actorUserId);
    expect(reviews?.[0].reviewer_employee_id).toBe(EMPLOYEE_ID);
    // Mot lan xu ly, MOT dau thoi gian: `reviewed_at` cua yeu cau lay tu
    // `created_at` cua dong lich su, khong phai mot lan doc dong ho thu hai.
    expect(row?.reviewed_at).toBe(reviews?.[0].created_at);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, entity_table, entity_id, before, after")
      .eq("actor_user_id", actorUserId)
      .eq("entity_id", REQUEST_APPROVE);
    expect(audit).toHaveLength(1);
    expect(audit?.[0].action).toBe("update");
    expect(audit?.[0].entity_table).toBe("work_requests");
    // before/after la NGUYEN DONG truoc va sau (D-18), khong phai delta
    expect((audit?.[0].before as { status: string }).status).toBe("pending");
    expect((audit?.[0].after as { status: string }).status).toBe("approved");
  });

  it("2. từ chối KHÔNG lý do bị chặn ở tầng server, và chặn TRƯỚC khi chạm database", async () => {
    await expect(
      reviewRequest(REQUEST_NO_NOTE, { decision: "rejected", note: "   " }),
    ).rejects.toThrow(/lý do/);
    await expect(
      reviewRequest(REQUEST_NO_NOTE, { decision: "rejected" }),
    ).rejects.toThrow(/lý do/);

    // Khong cham database: yeu cau van pending va khong co dong lich su nao
    const { data: row } = await admin
      .from("work_requests")
      .select("status")
      .eq("id", REQUEST_NO_NOTE)
      .single();
    expect(row?.status).toBe("pending");

    const { count } = await admin
      .from("request_reviews")
      .select("id", { count: "exact", head: true })
      .eq("request_id", REQUEST_NO_NOTE);
    expect(count).toBe(0);
  });

  it("3. từ chối CÓ lý do: trạng thái rejected và lý do được lưu ở cả hai nơi", async () => {
    const result = await reviewRequest(REQUEST_REJECT, {
      decision: "rejected",
      note: "Trùng lịch kiểm kê cuối quý.",
    });

    expect(result.request.status).toBe("rejected");
    expect(result.request.reviewNote).toBe("Trùng lịch kiểm kê cuối quý.");

    const { data: reviews } = await admin
      .from("request_reviews")
      .select("decision, note")
      .eq("request_id", REQUEST_REJECT);
    expect(reviews).toHaveLength(1);
    expect(reviews?.[0].decision).toBe("rejected");
    expect(reviews?.[0].note).toBe("Trùng lịch kiểm kê cuối quý.");
  });

  it("4. requestId của doanh nghiệp KHÁC -> báo không tìm thấy, dòng đó không đổi", async () => {
    await expect(
      reviewRequest(REQUEST_CROSS, { decision: "approved" }),
    ).rejects.toThrow("Không tìm thấy yêu cầu.");

    const { data: row } = await admin
      .from("work_requests")
      .select("status, reviewer_id")
      .eq("id", REQUEST_CROSS)
      .single();
    expect(row?.status).toBe("pending");
    expect(row?.reviewer_id).toBeNull();

    const { count } = await admin
      .from("request_reviews")
      .select("id", { count: "exact", head: true })
      .eq("request_id", REQUEST_CROSS);
    expect(count).toBe(0);
  });

  it("5. gọi hai lần liên tiếp: lần hai bị từ chối và lịch sử vẫn đúng một dòng", async () => {
    await reviewRequest(REQUEST_TWICE, { decision: "approved" });

    await expect(
      reviewRequest(REQUEST_TWICE, { decision: "rejected", note: "Đổi ý." }),
    ).rejects.toThrow(/đã được xử lý/);

    const { count } = await admin
      .from("request_reviews")
      .select("id", { count: "exact", head: true })
      .eq("request_id", REQUEST_TWICE);
    expect(count).toBe(1);
  });

  it("6. vai trò employee/manager gọi thẳng Server Action bị từ chối (403), không chỉ bị ẩn nút", async () => {
    for (const role of ["employee", "manager"] as const) {
      vi.mocked(getSessionContext).mockResolvedValue(session(role));
      await expect(
        reviewRequest(REQUEST_FORBIDDEN, { decision: "approved" }),
      ).rejects.toThrow(ForbiddenError);
    }
    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));

    const { data: row } = await admin
      .from("work_requests")
      .select("status")
      .eq("id", REQUEST_FORBIDDEN)
      .single();
    expect(row?.status).toBe("pending");
  });

  it("7. lịch sử xử lý không sửa và không xoá được, kể cả bằng khoá secret (trigger 0017)", async () => {
    const { error: updateError } = await admin
      .from("request_reviews")
      .update({ note: "sửa lại lý do sau khi bị chất vấn" })
      .eq("request_id", REQUEST_REJECT);
    expect(updateError).not.toBeNull();
    expect(updateError?.message).toContain("append-only");

    const { error: deleteError } = await admin
      .from("request_reviews")
      .delete()
      .eq("request_id", REQUEST_REJECT);
    expect(deleteError).not.toBeNull();

    const { data: reviews } = await admin
      .from("request_reviews")
      .select("note")
      .eq("request_id", REQUEST_REJECT);
    expect(reviews).toHaveLength(1);
    expect(reviews?.[0].note).toBe("Trùng lịch kiểm kê cuối quý.");
  });
});
