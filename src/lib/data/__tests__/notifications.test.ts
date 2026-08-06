// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_NOTIFICATIONS } from "@/app/api/notifications/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { markNotificationsRead } from "@/lib/data/mutations/notifications";
import { reviewRequest } from "@/lib/data/mutations/requests";
import { createServerSupabase } from "@/lib/supabase/server";
import type { NotificationFeed } from "@/lib/types/domain";

/**
 * APRV-05 tren du lieu that.
 *
 * Hai bai quan trong nhat:
 *   - NHAN VIEN CHUA CO TAI KHOAN: khong sinh dong nao, va thao tac duyet VAN
 *     THANH CONG. Khong co ai de nhan thi khong phai mot loi — nhung mot dong
 *     mo coi thi khong bao gio duoc doc.
 *   - DANH DAU DA DOC CUA NGUOI KHAC: khong cham duoc dong nao, va ham tra ve
 *     dung con so 0 thay vi gia vo thanh cong (T-05-04-02).
 *
 * Fixture dung doanh nghiep rieng mang dinh danh ngau nhien: `request_reviews`
 * la append-only nen yeu cau da xu ly khong xoa duoc.
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

const PAST_DATE = "2016-06-13"; // Thu Hai

describe("Thông báo trong ứng dụng khi yêu cầu được xử lý (APRV-05)", () => {
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

  const suffix = randomUUID().slice(0, 8);
  const COMPANY_ID = `cty-0504-${suffix}`;
  const DEPARTMENT_ID = `dept-0504-${suffix}`;
  const SHIFT_ID = `sft-0504-${suffix}`;
  /** Nhan vien CO tai khoan dang nhap. */
  const EMPLOYEE_WITH_ACCOUNT = `emp-0504-${suffix}-a`;
  /** Nhan vien CHUA co tai khoan (`user_id` null). */
  const EMPLOYEE_NO_ACCOUNT = `emp-0504-${suffix}-b`;

  const REQUEST_APPROVE = `wr-0504-${suffix}-approve`;
  const REQUEST_REJECT = `wr-0504-${suffix}-reject`;
  const REQUEST_NO_ACCOUNT = `wr-0504-${suffix}-noacct`;

  /** Tai khoan cua NGUOI DUYET (owner). */
  let reviewerUserId = "";
  /** Tai khoan cua NGUOI NHAN thong bao (nhan vien). */
  let employeeUserId = "";
  /** Tai khoan cua mot NGUOI THU BA cung doanh nghiep. */
  let bystanderUserId = "";

  function session(userId: string, role: "owner" | "employee", employeeId: string | null) {
    return {
      userId,
      email: `test-05-04-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  function reviewerSession() {
    return session(reviewerUserId, "owner", null);
  }

  async function readFeed(): Promise<NotificationFeed> {
    const response = await GET_NOTIFICATIONS();
    expect(response.status).toBe(200);
    return (await response.json()) as NotificationFeed;
  }

  async function createUser(label: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
      email: `test-05-04-${suffix}-${label}@timeflow.test`,
      password: randomUUID(),
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Không tạo được auth user ${label}: ${error?.message}`);
    }
    return data.user.id;
  }

  beforeAll(async () => {
    reviewerUserId = await createUser("reviewer");
    employeeUserId = await createUser("employee");
    bystanderUserId = await createUser("bystander");

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test 05-04 ${suffix}`,
      code: `T0504${suffix.slice(0, 4).toUpperCase()}`,
      industry: "services",
      size: "1-10",
      phone: "0900000000",
      address: "Test",
      accent: "indigo",
    });
    if (companyError) {
      throw new Error(`Không tạo được doanh nghiệp test: ${companyError.message}`);
    }
    await admin.from("company_settings").insert({ company_id: COMPANY_ID });

    // Ca ba tai khoan deu la THANH VIEN cua doanh nghiep nay — dieu kien
    // `tf_is_member` cua policy khong duoc la thu chan ho lai; thu chan phai la
    // `user_id = auth.uid()`.
    await admin.from("memberships").insert([
      { user_id: reviewerUserId, company_id: COMPANY_ID, role: "owner", status: "active" },
      { user_id: employeeUserId, company_id: COMPANY_ID, role: "employee", status: "active" },
      { user_id: bystanderUserId, company_id: COMPANY_ID, role: "employee", status: "active" },
    ]);

    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test",
      description: "Test 05-04",
      manager_id: null,
      status: "active",
    });

    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test 05-04",
      code: "T0504",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
      status: "active",
    });

    const baseEmployee = {
      company_id: COMPANY_ID,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male" as const,
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time" as const,
      start_date: "2015-01-01",
      manager_id: null,
      shift_id: SHIFT_ID,
      work_location: "Văn phòng chính",
      status: "active" as const,
      system_role: "employee" as const,
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
    };

    await admin.from("employees").insert([
      {
        ...baseEmployee,
        id: EMPLOYEE_WITH_ACCOUNT,
        code: "T0504A",
        full_name: "Nhân viên có tài khoản",
        email: `${EMPLOYEE_WITH_ACCOUNT}@timeflow.test`,
        user_id: employeeUserId,
      },
      {
        ...baseEmployee,
        id: EMPLOYEE_NO_ACCOUNT,
        code: "T0504B",
        full_name: "Nhân viên chưa có tài khoản",
        email: `${EMPLOYEE_NO_ACCOUNT}@timeflow.test`,
        user_id: null,
      },
    ]);

    await admin.from("work_requests").insert([
      {
        id: REQUEST_APPROVE,
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_WITH_ACCOUNT,
        type: "overtime",
        status: "pending",
        from_date: PAST_DATE,
        to_date: PAST_DATE,
        from_time: null,
        to_time: null,
        reason: "[test 05-04] Đăng ký tăng ca.",
      },
      {
        id: REQUEST_REJECT,
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_WITH_ACCOUNT,
        type: "leave",
        status: "pending",
        from_date: "2016-06-20",
        to_date: "2016-06-20",
        from_time: null,
        to_time: null,
        reason: "[test 05-04] Xin nghỉ.",
      },
      {
        id: REQUEST_NO_ACCOUNT,
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_NO_ACCOUNT,
        type: "overtime",
        status: "pending",
        from_date: PAST_DATE,
        to_date: PAST_DATE,
        from_time: null,
        to_time: null,
        reason: "[test 05-04] Nhân viên chưa có tài khoản.",
      },
    ]);

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(reviewerSession());
  });

  afterAll(async () => {
    await admin.from("notifications").delete().eq("company_id", COMPANY_ID);
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("actor_user_id", reviewerUserId);
    await admin.auth.admin.deleteUser(reviewerUserId);
    await admin.auth.admin.deleteUser(employeeUserId);
    await admin.auth.admin.deleteUser(bystanderUserId);
  });

  it("1. duyệt một yêu cầu -> đúng MỘT thông báo cho người gửi, nội dung đủ hiểu mà không phải bấm vào", async () => {
    await reviewRequest(REQUEST_APPROVE, { decision: "approved" });

    const { data: rows } = await admin
      .from("notifications")
      .select("user_id, kind, title, body, request_id, read_at")
      .eq("request_id", REQUEST_APPROVE);

    expect(rows).toHaveLength(1);
    expect(rows?.[0].user_id).toBe(employeeUserId);
    expect(rows?.[0].kind).toBe("request_reviewed");
    expect(rows?.[0].title).toContain("đã được duyệt");
    // Loai yeu cau + khoang ngay + quyet dinh, ngay trong noi dung.
    expect(rows?.[0].body).toContain("Đăng ký tăng ca");
    expect(rows?.[0].body).toContain("13/06/2016");
    expect(rows?.[0].body).toContain("đã được duyệt");
    // Chua doc: `read_at` la NULL, khong phai mot boolean false.
    expect(rows?.[0].read_at).toBeNull();
  });

  it("2. từ chối -> thông báo mang LÝ DO từ chối", async () => {
    await reviewRequest(REQUEST_REJECT, {
      decision: "rejected",
      note: "Trùng lịch kiểm kê cuối quý.",
    });

    const { data: rows } = await admin
      .from("notifications")
      .select("title, body")
      .eq("request_id", REQUEST_REJECT);

    expect(rows).toHaveLength(1);
    expect(rows?.[0].title).toContain("bị từ chối");
    expect(rows?.[0].body).toContain("Lý do: Trùng lịch kiểm kê cuối quý.");
  });

  it("3. nhân viên CHƯA có tài khoản -> KHÔNG sinh thông báo, và thao tác duyệt vẫn thành công", async () => {
    const result = await reviewRequest(REQUEST_NO_ACCOUNT, { decision: "approved" });
    expect(result.request.status).toBe("approved");

    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("request_id", REQUEST_NO_ACCOUNT);
    expect(count).toBe(0);
  });

  it("4. GET /api/notifications trả thông báo của CHÍNH PHIÊN kèm số chưa đọc", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(
      session(employeeUserId, "employee", EMPLOYEE_WITH_ACCOUNT),
    );
    const feed = await readFeed();

    expect(feed.items).toHaveLength(2);
    expect(feed.unreadCount).toBe(2);
    // Moi nhat truoc.
    expect(feed.items[0].requestId).toBe(REQUEST_REJECT);
    expect(feed.items.every((item) => item.userId === employeeUserId)).toBe(true);

    // Nguoi thu ba CUNG doanh nghiep khong thay gi — day la ranh gioi CON
    // NGUOI, khong phai ranh gioi doanh nghiep (T-05-04-01).
    vi.mocked(getSessionContext).mockResolvedValue(
      session(bystanderUserId, "employee", null),
    );
    const bystanderFeed = await readFeed();
    expect(bystanderFeed.items).toHaveLength(0);
    expect(bystanderFeed.unreadCount).toBe(0);

    vi.mocked(getSessionContext).mockResolvedValue(reviewerSession());
  });

  it("5. đánh dấu đã đọc: chỉ dòng của chính mình, số chưa đọc về 0", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(
      session(employeeUserId, "employee", EMPLOYEE_WITH_ACCOUNT),
    );

    const before = await readFeed();
    const changed = await markNotificationsRead(before.items.map((item) => item.id));
    expect(changed).toBe(2);

    const after = await readFeed();
    expect(after.unreadCount).toBe(0);
    expect(after.items.every((item) => item.readAt !== null)).toBe(true);

    // Goi lai voi cung danh sach: 0 dong doi (dieu kien `read_at is null`),
    // khong nem loi.
    expect(await markNotificationsRead(before.items.map((item) => item.id))).toBe(0);

    vi.mocked(getSessionContext).mockResolvedValue(reviewerSession());
  });

  it("6. đánh dấu đã đọc thông báo của NGƯỜI KHÁC -> 0 dòng bị tác động, dòng đó không đổi (T-05-04-02)", async () => {
    // Mot thong bao moi cho nhan vien, de co dong CHUA DOC de thu cham vao.
    const { data: inserted } = await admin
      .from("notifications")
      .insert({
        company_id: COMPANY_ID,
        user_id: employeeUserId,
        kind: "request_reviewed",
        title: "Thông báo test 6",
        body: "Không ai khác được đánh dấu đã đọc dòng này.",
        request_id: null,
      })
      .select("id")
      .single();
    const targetId = (inserted as { id: string }).id;

    // Nguoi thu ba (cung doanh nghiep) thu danh dau da doc dong cua nguoi khac.
    vi.mocked(getSessionContext).mockResolvedValue(
      session(bystanderUserId, "employee", null),
    );
    expect(await markNotificationsRead([targetId])).toBe(0);

    const { data: still } = await admin
      .from("notifications")
      .select("read_at")
      .eq("id", targetId)
      .single();
    expect(still?.read_at).toBeNull();

    // Chinh chu thi danh dau duoc.
    vi.mocked(getSessionContext).mockResolvedValue(
      session(employeeUserId, "employee", EMPLOYEE_WITH_ACCOUNT),
    );
    expect(await markNotificationsRead([targetId])).toBe(1);

    vi.mocked(getSessionContext).mockResolvedValue(reviewerSession());
  });

  it("7. danh sách rỗng không chạm database và trả 0", async () => {
    expect(await markNotificationsRead([])).toBe(0);
  });
});
