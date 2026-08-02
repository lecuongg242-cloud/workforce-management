import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import { GET } from "@/app/api/attendance-photos/route";
import { logMutation } from "@/lib/data/audit";
import { markPhotoReviewed } from "@/lib/data/mutations/attendance-photos";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Muoi khang dinh cua `<behavior>` (03-05-PLAN.md Task 1). Dung khuon mock
 * DB cua `employees.test.ts`/`accounts.test.ts` (khong phai khuon Postgres
 * that cua `[id]/__tests__/route.test.ts` — file do can Storage that, con
 * `audit_log.actor_user_id` co FK toi `auth.users` nen mot userId gia lap
 * se vi pham rang buoc do neu ghi that; mock giu test doc lap voi du lieu
 * seed va van chung minh dung THU TU/DIEU KIEN goi).
 *
 * `getSessionContext` mock, giu nguyen `requireRole`/loi that qua
 * `importOriginal`. `logMutation` mock hoan toan de kiem duoc SO LAN goi
 * (dung 1) ma khong can dem dong trong bang audit_log that.
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

vi.mock("@/lib/data/audit", () => ({
  logMutation: vi.fn().mockResolvedValue(undefined),
}));

type FakeServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

interface QueryResult {
  data: unknown;
  error: unknown;
}

/**
 * Chuoi truy van gia lap: moi buoc (`select`/`eq`/`order`/`update`) tra ve
 * chinh no de chuoi tiep tuc; `maybeSingle`/`single` la buoc CUOI tra ve
 * ket qua; `then` cho phep `await` truc tiep chuoi (khong goi buoc cuoi
 * nao) van nhan duoc ket qua — khop dung cach `supabase-js` "thenable".
 */
function makeChain(result: QueryResult): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  chain.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

/** Client nem loi ngay khi cham database — dung de chung minh mot nhanh KHONG cham DB. */
function throwingClient(): FakeServerClient {
  return {
    from: vi.fn(() => {
      throw new Error("Nhánh này không được phép chạm database.");
    }),
  } as unknown as FakeServerClient;
}

beforeEach(() => {
  vi.mocked(getSessionContext).mockReset();
  vi.mocked(createServerSupabase).mockReset();
  vi.mocked(logMutation).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const SESSION_CTY01_OWNER = {
  userId: "user-cty01-owner",
  email: "owner1@timeflow.test",
  companyId: "cty-01",
  role: "owner" as const,
  employeeId: null,
  isPlatformAdmin: false,
  mustChangePassword: false,
};

const SESSION_CTY01_EMPLOYEE = { ...SESSION_CTY01_OWNER, role: "employee" as const };

const SESSION_CTY02_OWNER = {
  ...SESSION_CTY01_OWNER,
  userId: "user-cty02-owner",
  companyId: "cty-02",
};

function fakeGetRequest(query: Record<string, string>): Request {
  const params = new URLSearchParams(query);
  return new Request(`http://localhost/api/attendance-photos?${params.toString()}`);
}

function rawPhotoRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "photo-check-in-1",
    company_id: "cty-01",
    attendance_record_id: "att-01a",
    kind: "check_in",
    captured_at: "2026-08-02T01:00:00+00:00",
    latitude: 10.7823,
    longitude: 106.6958,
    accuracy_meters: 12.5,
    work_site_id: "ws-01",
    distance_meters: 15.2,
    review_status: "pending",
    work_sites: { name: "Văn phòng chính" },
    ...overrides,
  };
}

describe("GET /api/attendance-photos (plan 03-05)", () => {
  it("1. khong kem attendanceRecordId -> 400 voi thong diep tieng Viet, khong cham database", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    vi.mocked(createServerSupabase).mockResolvedValue(throwingClient());

    const response = await GET(fakeGetRequest({}));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Thiếu tham số bản ghi chấm công.");
  });

  it("2. phien doanh nghiep KHAC -> mang rong (KHONG PHAI 403), va dieu kien company_id lay tu session", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY02_OWNER);
    const chain = makeChain({ data: [], error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      from: vi.fn(() => chain),
    } as unknown as FakeServerClient);

    const response = await GET(fakeGetRequest({ attendanceRecordId: "att-01a" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(chain.eq).toHaveBeenCalledWith("company_id", "cty-02");
  });

  it("3. vai tro khong phai owner/admin -> 403, khong cham database", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_EMPLOYEE);
    vi.mocked(createServerSupabase).mockResolvedValue(throwingClient());

    const response = await GET(fakeGetRequest({ attendanceRecordId: "att-01a" }));

    expect(response.status).toBe(403);
  });

  it("4. toi da hai phan tu, sap xep check_in TRUOC check_out", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const rows = [
      rawPhotoRow({ id: "photo-in", kind: "check_in" }),
      rawPhotoRow({
        id: "photo-out",
        kind: "check_out",
        accuracy_meters: 8.4,
        distance_meters: 630.4,
      }),
    ];
    const chain = makeChain({ data: rows, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      from: vi.fn(() => chain),
    } as unknown as FakeServerClient);

    const response = await GET(fakeGetRequest({ attendanceRecordId: "att-01a" }));
    const body = (await response.json()) as { kind: string }[];

    expect(body).toHaveLength(2);
    expect(body[0].kind).toBe("check_in");
    expect(body[1].kind).toBe("check_out");
  });

  it("5. moi phan tu mang du truong sieu du lieu va KHONG mang truong nao chua URL", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const chain = makeChain({ data: [rawPhotoRow()], error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      from: vi.fn(() => chain),
    } as unknown as FakeServerClient);

    const response = await GET(fakeGetRequest({ attendanceRecordId: "att-01a" }));
    const body = (await response.json()) as Record<string, unknown>[];

    expect(body[0]).toMatchObject({
      id: "photo-check-in-1",
      kind: "check_in",
      latitude: 10.7823,
      longitude: 106.6958,
      accuracyMeters: 12.5,
      workSiteId: "ws-01",
      workSiteName: "Văn phòng chính",
      distanceMeters: 15.2,
      reviewStatus: "pending",
    });
    for (const item of body) {
      for (const key of Object.keys(item)) {
        expect(key.toLowerCase()).not.toContain("url");
      }
    }
  });

  it("6. ban ghi khong co anh nao -> mang rong voi ma 200 (khong phai 404)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const chain = makeChain({ data: [], error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      from: vi.fn(() => chain),
    } as unknown as FakeServerClient);

    const response = await GET(
      fakeGetRequest({ attendanceRecordId: "att-khong-ton-tai" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe("markPhotoReviewed (plan 03-05)", () => {
  it("7. vai tro khong phai owner/admin -> ForbiddenError TRUOC khi cham database", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_EMPLOYEE);
    vi.mocked(createServerSupabase).mockResolvedValue(throwingClient());

    await expect(markPhotoReviewed("photo-1", "approved")).rejects.toThrow(
      "Bạn không có quyền thực hiện thao tác này.",
    );
    expect(logMutation).not.toHaveBeenCalled();
  });

  it("8. dat review_status/reviewed_by=userId cua phien, reviewed_at tu RPC server (khong tu tham so)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const beforeRow = {
      id: "photo-1",
      company_id: "cty-01",
      attendance_record_id: "att-01a",
      kind: "check_out",
      review_status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    };
    const afterRow = {
      ...beforeRow,
      review_status: "approved",
      reviewed_by: SESSION_CTY01_OWNER.userId,
      reviewed_at: "2026-08-02T10:00:00.000Z",
    };
    const beforeChain = makeChain({ data: beforeRow, error: null });
    const afterChain = makeChain({ data: afterRow, error: null });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(beforeChain)
      .mockReturnValueOnce(afterChain);
    vi.mocked(createServerSupabase).mockResolvedValue({
      from: fromMock,
      rpc: vi.fn().mockResolvedValue({ data: "2026-08-02T10:00:00.000Z", error: null }),
    } as unknown as FakeServerClient);

    await markPhotoReviewed("photo-1", "approved");

    expect(afterChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        review_status: "approved",
        reviewed_by: SESSION_CTY01_OWNER.userId,
        reviewed_at: "2026-08-02T10:00:00.000Z",
      }),
    );
    expect(logMutation).toHaveBeenCalledTimes(1);
    expect(logMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entityTable: "attendance_photos",
        entityId: "photo-1",
        actorUserId: SESSION_CTY01_OWNER.userId,
      }),
    );
  });

  it("9. anh cua doanh nghiep khac -> nem loi TRUOC khi update, khong doi du lieu", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY02_OWNER);
    const beforeChain = makeChain({ data: null, error: { message: "not found" } });
    const fromMock = vi.fn().mockReturnValue(beforeChain);
    vi.mocked(createServerSupabase).mockResolvedValue({
      from: fromMock,
      rpc: vi.fn(),
    } as unknown as FakeServerClient);

    await expect(markPhotoReviewed("photo-cty01-only", "approved")).rejects.toThrow(
      "Không tìm thấy ảnh chấm công.",
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(logMutation).not.toHaveBeenCalled();
  });

  it("10. moi lan danh dau xem xet goi DUNG mot lan logMutation (mot dong audit_log)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const beforeRow = {
      id: "photo-2",
      company_id: "cty-01",
      attendance_record_id: "att-01a",
      kind: "check_in",
      review_status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    };
    const afterRow = {
      ...beforeRow,
      review_status: "approved",
      reviewed_by: SESSION_CTY01_OWNER.userId,
      reviewed_at: "2026-08-02T10:05:00.000Z",
    };
    const beforeChain = makeChain({ data: beforeRow, error: null });
    const afterChain = makeChain({ data: afterRow, error: null });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(beforeChain)
      .mockReturnValueOnce(afterChain);
    vi.mocked(createServerSupabase).mockResolvedValue({
      from: fromMock,
      rpc: vi.fn().mockResolvedValue({ data: "2026-08-02T10:05:00.000Z", error: null }),
    } as unknown as FakeServerClient);

    await markPhotoReviewed("photo-2", "approved");

    expect(logMutation).toHaveBeenCalledTimes(1);
  });
});
