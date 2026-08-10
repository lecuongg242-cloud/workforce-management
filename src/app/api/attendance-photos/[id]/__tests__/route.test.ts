import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { ATTENDANCE_PHOTO_BUCKET } from "@/lib/storage/attendance-photos";

import { GET } from "../route";

/**
 * Test TICH HOP cho co lap anh xuyen doanh nghiep (T-03-01/T-03-02), chay
 * TREN POSTGRES DEV THAT DA SEED (khong phai mock in-memory) — pgTAP khong
 * dung duoc schema `storage` tren Postgres tam cua CI, nen day la LOP KIEM
 * CHUNG chinh cho ranh gioi ma tieu chi 4 cua ROADMAP noi toi. Backstop:
 * policy `storage.objects` chua co cong tu dong.
 *
 * `getSessionContext` duoc mock de lan luot dong vai phien cty-01/cty-02 va
 * cac vai tro khac nhau (khuon `employees.test.ts`, giu nguyen
 * `requireRole`/loi that qua `importOriginal`). `createServerSupabase` duoc
 * mock de tra ve mot client THAT, dung `SUPABASE_SECRET_KEY` (bo qua RLS —
 * dung y: test nay do LOP UNG DUNG (`.eq("company_id", ...)` trong route.ts),
 * khong do lai RLS ma 01-01/01-04 da chung minh).
 */

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return {
    ...actual,
    getSessionContext: vi.fn(),
  };
});

const SESSION_CTY01_OWNER = {
  userId: "user-route-test-cty01-owner",
  email: "owner-route-test@timeflow.test",
  companyId: "cty-01",
  role: "owner" as const,
  employeeId: null,
  isPlatformAdmin: false,
  mustChangePassword: false,
};

const SESSION_CTY01_EMPLOYEE = {
  ...SESSION_CTY01_OWNER,
  role: "employee" as const,
};

const SESSION_CTY01_MANAGER = {
  ...SESSION_CTY01_OWNER,
  role: "manager" as const,
};

const SESSION_CTY02_OWNER = {
  ...SESSION_CTY01_OWNER,
  userId: "user-route-test-cty02-owner",
  email: "owner-route-test-2@timeflow.test",
  companyId: "cty-02",
};

// Anh JPEG toi thieu hop le (SOI + EOI marker) — du de bucket chap nhan MIME
// va de .download() tra ve mot Blob khong rong.
const FAKE_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function fakeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/attendance-photos/[id] (broker route, D-12c)", () => {
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

  const photoId = randomUUID();
  // kind = 'check_out' (khong phai 'check_in') de khong dung rang buoc
  // unique(attendance_record_id, kind) voi dong seed 'check_in' co san cua
  // att-01a.
  const storagePath = `cty-01/nv-01a/route-test-${photoId}.jpg`;
  const nonExistentId = randomUUID();

  beforeAll(async () => {
    const { error: uploadError } = await admin.storage
      .from(ATTENDANCE_PHOTO_BUCKET)
      .upload(storagePath, FAKE_JPEG_BYTES, { contentType: "image/jpeg", upsert: true });
    if (uploadError) {
      throw new Error(`Không tải được ảnh test lên bucket: ${uploadError.message}`);
    }

    const { error: insertError } = await admin.from("attendance_photos").insert({
      id: photoId,
      company_id: "cty-01",
      attendance_record_id: "att-01a",
      kind: "check_out",
      storage_path: storagePath,
      captured_at: new Date().toISOString(),
      latitude: 10.7823,
      longitude: 106.6958,
    });
    if (insertError) {
      throw new Error(`Không tạo được dòng attendance_photos test: ${insertError.message}`);
    }
  });

  afterAll(async () => {
    await admin.from("attendance_photos").delete().eq("id", photoId);
    await admin.storage.from(ATTENDANCE_PHOTO_BUCKET).remove([storagePath]);
  });

  beforeEach(() => {
    vi.mocked(getSessionContext).mockReset();
    vi.mocked(createServerSupabase).mockReset();
    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
  });

  it("1. phien cung doanh nghiep (owner) -> 200", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    expect(response.status).toBe(200);
  });

  it("2. phan hoi 200 mang content-type kieu anh", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    expect(response.headers.get("content-type")).toMatch(/^image\//);
  });

  it("3. phan hoi 200 co than khac rong", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("4. phan hoi 200 mang cache-control chua no-store", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("5. phien doanh nghiep KHAC (cty-02) cam dung id anh cua cty-01 -> 404, KHONG PHAI 403, KHONG PHAI 200", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY02_OWNER);
    const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    expect(response.status).toBe(404);
  });

  it("6. id khong ton tai -> 404, CUNG mot than phan hoi voi truong hop xuyen doanh nghiep (khong phan biet duoc 'id sai' voi 'id dung nhung khac doanh nghiep')", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const crossCompanyResponse = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    // doi phien sang cty-02 de tao dung tinh huong xuyen doanh nghiep
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY02_OWNER);
    const crossCompanyBody = await (
      await GET(new Request("http://localhost/x"), fakeParams(photoId))
    ).text();

    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
    const notFoundResponse = await GET(new Request("http://localhost/x"), fakeParams(nonExistentId));
    const notFoundBody = await notFoundResponse.text();

    expect(notFoundResponse.status).toBe(404);
    expect(notFoundBody).toBe(crossCompanyBody);
    void crossCompanyResponse;
  });

  it("7. vai tro employee (cung doanh nghiep, dung id) -> 403 (ATT-04: chi quan tri xem lai)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_EMPLOYEE);
    const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    expect(response.status).toBe(403);
  });

  it("8. vai tro manager (cung doanh nghiep, dung id) -> 403 (ATT-04: chi owner/admin, khong phai moi vai tro quan ly)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_MANAGER);
    const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
    expect(response.status).toBe(403);
  });

  it("9. dong ton tai nhung KHONG co tep anh (cham trong nguong cho phep) -> 404 voi CUNG than phan hoi nhu id khong ton tai", async () => {
    // Dong bang chung khong anh (migration 0032): co day du toa do, chi thieu
    // storage_path. Route nay chi phat BYTE ANH — khong co byte nao thi 404,
    // va khong duoc phan biet duoc voi mot id sai.
    //
    // Bo di storage_path cua CHINH dong test nay roi tra lai, thay vi them
    // mot dong thu hai: `unique (attendance_record_id, kind)` chi cho dung hai
    // dong tren att-01a va ca hai da co chu (seed giu 'check_in', dong test
    // giu 'check_out').
    const { error: nullError } = await admin
      .from("attendance_photos")
      .update({ storage_path: null })
      .eq("id", photoId);
    expect(nullError).toBeNull();

    try {
      vi.mocked(getSessionContext).mockResolvedValue(SESSION_CTY01_OWNER);
      const response = await GET(new Request("http://localhost/x"), fakeParams(photoId));
      expect(response.status).toBe(404);

      const notFoundBody = await (
        await GET(new Request("http://localhost/x"), fakeParams(nonExistentId))
      ).text();
      expect(await response.text()).toBe(notFoundBody);
    } finally {
      await admin
        .from("attendance_photos")
        .update({ storage_path: storagePath })
        .eq("id", photoId);
    }
  });
});
