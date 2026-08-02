import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import { GET } from "@/app/api/attendance/review/route";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Muoi hanh vi cua `<behavior>` (03-06-PLAN.md Task 2). Dung khuon mock DB
 * cua `attendance-photos.test.ts` (03-05) — chuoi truy van gia lap, khong
 * cham Postgres that. Ba truong hop LOC (khoang cach null; duoc phep lam
 * viec tu xa; ngoai ban kinh nhung chua toi nguong) la nhung bai kiem QUAN
 * TRONG NHAT cua file nay — chung la ba cach danh sach nay co the lang le
 * tro thanh vo dung (03-06-PLAN.md action (d)).
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

type FakeServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

interface QueryResult {
  data: unknown;
  error: unknown;
}

/** Chuoi truy van gia lap: moi buoc tra ve chinh no; `.then` la buoc CUOI (route await truc tiep chuoi, khong goi maybeSingle/single). */
function makeChain(result: QueryResult): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function throwingClient(): FakeServerClient {
  return {
    from: vi.fn(() => {
      throw new Error("Nhánh này không được phép chạm database.");
    }),
  } as unknown as FakeServerClient;
}

/** Client hai bang: `attendance_photos` (buoc 1) va `attendance_records` (buoc 2), phan biet theo TEN BANG, khong theo thu tu goi. */
function twoTableClient(
  photoResult: QueryResult,
  recordResult: QueryResult,
): { client: FakeServerClient; photoChain: Record<string, unknown>; recordChain: Record<string, unknown> } {
  const photoChain = makeChain(photoResult);
  const recordChain = makeChain(recordResult);
  const from = vi.fn((table: string) => {
    if (table === "attendance_photos") return photoChain;
    if (table === "attendance_records") return recordChain;
    throw new Error(`Bang khong mong doi trong test: ${table}`);
  });
  return { client: { from } as unknown as FakeServerClient, photoChain, recordChain };
}

beforeEach(() => {
  vi.mocked(getSessionContext).mockReset();
  vi.mocked(createServerSupabase).mockReset();
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

function fakeGetRequest(query: Record<string, string> = {}): Request {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  return new Request(`http://localhost/api/attendance/review${suffix ? `?${suffix}` : ""}`);
}

function rawPhotoRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "photo-01",
    attendance_record_id: "att-01a",
    kind: "check_in",
    captured_at: "2026-08-02T01:00:00+00:00",
    distance_meters: 620.4,
    accuracy_meters: 15.2,
    review_status: "pending",
    work_sites: { name: "Văn phòng chính", radius_meters: 100 },
    ...overrides,
  };
}

function rawRecordRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "att-01a",
    employee_id: "emp-01",
    employees: { full_name: "Nguyễn Minh Anh", can_check_in_remotely: false },
    ...overrides,
  };
}

describe("GET /api/attendance/review (plan 03-06)", () => {
  it("1. vai tro khong phai owner/admin -> 403, khong cham database", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_EMPLOYEE);
    vi.mocked(createServerSupabase).mockResolvedValue(throwingClient());

    const response = await GET(fakeGetRequest());

    expect(response.status).toBe(403);
  });

  it("2. khoang cach vuot nguong VA khong duoc phep lam viec tu xa -> xuat hien DUNG mot lan mang du truong", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client } = twoTableClient(
      { data: [rawPhotoRow()], error: null },
      { data: [rawRecordRow()], error: null },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET(fakeGetRequest());
    const body = (await response.json()) as Record<string, unknown>[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      photoId: "photo-01",
      attendanceRecordId: "att-01a",
      employeeName: "Nguyễn Minh Anh",
      workSiteName: "Văn phòng chính",
      distanceMeters: 620.4,
      multiplier: 6.2,
      capturedAt: "2026-08-02T01:00:00+00:00",
      kind: "check_in",
      reviewStatus: "pending",
    });
  });

  it("3. canCheckInRemotely=true -> KHONG xuat hien du khoang cach rat lon", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client } = twoTableClient(
      { data: [rawPhotoRow({ distance_meters: 50_000 })], error: null },
      {
        data: [rawRecordRow({ employees: { full_name: "Trần Bảo Long", can_check_in_remotely: true } })],
        error: null,
      },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET(fakeGetRequest());
    const body = (await response.json()) as unknown[];

    expect(body).toHaveLength(0);
  });

  it("4. distance_meters=null lot qua buoc loc SQL (mo phong DB khong loc) -> van bi loai o tang ung dung (isSuspiciousPunch tra false khi thieu khoang cach)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client } = twoTableClient(
      { data: [rawPhotoRow({ distance_meters: null })], error: null },
      { data: [rawRecordRow()], error: null },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET(fakeGetRequest());
    const body = (await response.json()) as unknown[];

    expect(body).toHaveLength(0);
  });

  it("5. khoang cach LON HON ban kinh nhung NHO HON ban kinh nhan nguong -> KHONG xuat hien (D-20: ngoai ban kinh khong du de dang ngo)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client } = twoTableClient(
      {
        data: [
          rawPhotoRow({
            distance_meters: 150, // > 100 (ban kinh) nhung < 500 (100 * nguong 5)
            work_sites: { name: "Văn phòng chính", radius_meters: 100 },
          }),
        ],
        error: null,
      },
      { data: [rawRecordRow()], error: null },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET(fakeGetRequest());
    const body = (await response.json()) as unknown[];

    expect(body).toHaveLength(0);
  });

  it("6. sap xep XAC DINH: khoang cach giam dan, roi thoi diem giam dan, roi dinh danh tang dan", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client } = twoTableClient(
      {
        data: [
          rawPhotoRow({ id: "photo-b", attendance_record_id: "att-02a", distance_meters: 600 }),
          rawPhotoRow({ id: "photo-a", attendance_record_id: "att-01a", distance_meters: 900 }),
          rawPhotoRow({ id: "photo-c", attendance_record_id: "att-03a", distance_meters: 600, captured_at: "2026-08-02T02:00:00+00:00" }),
        ],
        error: null,
      },
      {
        data: [
          rawRecordRow({ id: "att-01a" }),
          rawRecordRow({ id: "att-02a" }),
          rawRecordRow({ id: "att-03a" }),
        ],
        error: null,
      },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET(fakeGetRequest());
    const body = (await response.json()) as { photoId: string }[];

    expect(body.map((item) => item.photoId)).toEqual(["photo-a", "photo-c", "photo-b"]);
  });

  it("7. dieu kien company_id LUON lay tu session, ca hai buoc truy van", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY02_OWNER);
    const { client, photoChain, recordChain } = twoTableClient(
      { data: [rawPhotoRow()], error: null },
      { data: [rawRecordRow()], error: null },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    await GET(fakeGetRequest());

    expect(photoChain.eq).toHaveBeenCalledWith("company_id", "cty-02");
    expect(recordChain.eq).toHaveBeenCalledWith("company_id", "cty-02");
  });

  it("8. doanh nghiep khong co ban ghi nao vuot nguong -> mang rong voi ma 200", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client } = twoTableClient({ data: [], error: null }, { data: [], error: null });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET(fakeGetRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("9. tham so truy van tuy chon (from/to/reviewStatus) duoc chuyen thanh dieu kien loc, khong tham so nao la dinh danh doanh nghiep", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client, photoChain } = twoTableClient(
      { data: [], error: null },
      { data: [], error: null },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    await GET(
      fakeGetRequest({ from: "2026-08-01T00:00:00Z", to: "2026-08-02T23:59:59Z", reviewStatus: "pending" }),
    );

    expect(photoChain.gte).toHaveBeenCalledWith("captured_at", "2026-08-01T00:00:00Z");
    expect(photoChain.lte).toHaveBeenCalledWith("captured_at", "2026-08-02T23:59:59Z");
    expect(photoChain.eq).toHaveBeenCalledWith("review_status", "pending");
  });

  it("10. loi khi doc attendance_photos -> 500, khong cham buoc doc nhan vien", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const { client, recordChain } = twoTableClient(
      { data: null, error: { message: "boom" } },
      { data: [], error: null },
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET(fakeGetRequest());

    expect(response.status).toBe(500);
    expect(recordChain.select).not.toHaveBeenCalled();
  });

  it("11. thieu vai tro xac thuc (chua dang nhap) -> 401", async () => {
    vi.mocked(getSessionContext).mockRejectedValue(
      new (await import("@/lib/auth/session-context")).UnauthenticatedError(),
    );
    vi.mocked(createServerSupabase).mockResolvedValue(throwingClient());

    const response = await GET(fakeGetRequest());

    expect(response.status).toBe(401);
  });
});
