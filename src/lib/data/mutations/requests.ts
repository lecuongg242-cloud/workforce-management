"use server";

import { randomUUID } from "node:crypto";

import {
  ForbiddenError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  requestEffectRowSchema,
  reviewRequestInputSchema,
  workRequestInputSchema,
  workRequestSchema,
} from "@/lib/validation/api/requests";
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type {
  RequestEffect,
  RequestStatus,
  ReviewDecision,
  ReviewRequestInput,
  ReviewRequestResult,
  WorkRequest,
  WorkRequestInput,
} from "@/lib/types/domain";

/** Khong tac dong nao — hinh dang tra ve cho mot lan tu choi (D-31 cho tang ca). */
const NO_EFFECT: RequestEffect = {
  insertedCount: 0,
  updatedCount: 0,
  skippedCount: 0,
  skippedDates: [],
};

const WORK_REQUEST_COLUMNS =
  "id, company_id, employee_id, type, status, from_date, to_date, from_time, to_time, reason, created_at, reviewer_id, review_note";

const DATE_RANGE_MESSAGE = "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.";

/**
 * Giu NGUYEN chu ky cu tu `mock/service.ts` (call site khong phai sua).
 * Khuon giong `mutations/attendance.ts`/`mutations/employees.ts`:
 * `getSessionContext()` -> kiem quyen -> doc/ghi voi `company_id` tu session
 * (khong tu tham so client — D-12b) -> `logMutation` NGAY TRONG cung ham
 * (D-17), before/after la nguyen dong (D-18).
 *
 * T-02-09-02: trang thai/nguoi duyet/ghi chu duyet LUON duoc dat cung dinh
 * o day (cho vao pending, rong), KHONG BAO GIO doc tu `input` — schema dau
 * vao (`workRequestInputSchema`) da khong khai bon truong nay nen client
 * khong the gui len duoc.
 */
export async function createRequest(
  companyId: string,
  employeeId: string,
  input: WorkRequestInput,
): Promise<WorkRequest> {
  void companyId;

  const {
    companyId: activeCompanyId,
    userId,
    role,
    employeeId: sessionEmployeeId,
  } = await getSessionContext();

  // T-02-09-01: employee/manager chi tao duoc yeu cau cho CHINH MINH;
  // owner/admin tao duoc cho moi nhan vien trong doanh nghiep. Tham so
  // `employeeId` ma noi goi truyen vao chi duoc DOI CHIEU, khong duoc tin.
  const isAdminRole = role === "owner" || role === "admin";
  if (!isAdminRole && employeeId !== sessionEmployeeId) {
    throw new ForbiddenError();
  }

  // Kiem `toDate >= fromDate` o tang ung dung TRUOC — rang buoc `check` cua
  // database la lop hai, bat rieng ma loi va doi thanh CUNG thong diep nay.
  if (input.toDate < input.fromDate) {
    throw new Error(DATE_RANGE_MESSAGE);
  }

  const supabase = await createServerSupabase();

  // employeeId phai thuoc doanh nghiep hien hanh — khong the tao yeu cau
  // dung ten mot nhan vien cua doanh nghiep khac (cung khuon voi
  // `bulkMoveDepartment`/`checkIn` doi chieu department/employee truoc khi ghi).
  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("company_id", activeCompanyId)
    .maybeSingle();
  if (employeeError || !employeeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const id = randomUUID();
  const writeRow = workRequestInputSchema.parse(input);

  const { data: inserted, error } = await supabase
    .from("work_requests")
    .insert({
      id,
      company_id: activeCompanyId,
      employee_id: employeeId,
      ...writeRow,
      status: "pending",
      reviewer_id: null,
      review_note: null,
    })
    .select(WORK_REQUEST_COLUMNS)
    .single();

  if (error || !inserted) {
    // Lop HAI: rang buoc `check (to_date >= from_date)` cua database
    // (23514 — check_violation) van co the bi cham trong mot truong hop
    // rieng (race hoac du lieu khong qua duong client) — doi thanh CUNG
    // thong diep tieng Viet o tren, khong de loi Postgres tho lot len giao dien.
    if (error?.code === "23514") {
      throw new Error(DATE_RANGE_MESSAGE);
    }
    throw new Error("Không thể tạo yêu cầu.");
  }

  await logMutation({
    companyId: activeCompanyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "work_requests",
    entityId: id,
    before: null,
    after: inserted,
    reason: null,
  });

  return workRequestSchema.parse(inserted);
}

/* -------------------------------------------------------------------------- */
/* Duyet / tu choi (APRV-01, APRV-02, APRV-04 — plan 05-01)                    */
/* -------------------------------------------------------------------------- */

/**
 * Xu ly mot yeu cau: duyet hoac tu choi, kem lich su.
 *
 * THU TU CUA CAC BUOC O DAY LA MOT PHAN CUA HANH VI, khong phai mot chi tiet
 * cai dat:
 *
 *   1. Quyen (D-30: chi `owner`/`admin`) — truoc khi cham database.
 *   2. Ly do bat buoc khi tu choi — truoc khi cham database. Form co the bi
 *      sua o client; kiem o day la cho duy nhat tinh (T-05-01-05).
 *   3. KIEM TRANG THAI. Buoc nay phai dung TRUOC moi thao tac ghi va khong
 *      bao gio duoc doi cho xuong duoi. Plan 05-02 se noi TAC DONG LEN DU
 *      LIEU CONG vao dung ham nay — tu luc do, xu ly mot yeu cau hai lan
 *      khong con la mot dong thua trong lich su ma la HAI LAN TRU CONG cua
 *      cung mot ky nghi phep, va loi se hien ra duoi dang so lieu sai chu
 *      khong phai mot thong bao loi (T-05-01-03).
 *   4. Ghi lich su TRUOC, cap nhat `work_requests` SAU.
 *
 * VI SAO THU TU (4) CHU KHONG NGUOC LAI: PostgREST khong cho hai lenh ghi
 * nam trong mot transaction o tang nay, nen phai chon huong hong an toan
 * hon. Cap nhat truoc ma lich su hong -> mot quyet dinh KHONG CO vet, va yeu
 * cau da roi khoi `pending` nen khong lam lai duoc. Ghi lich su truoc ma cap
 * nhat hong -> yeu cau van `pending`, thao tac lam lai duoc, va dong lich su
 * thua chinh la vet cua lan that bai do — mot so ghi chep trung thuc.
 * (05-02 chuyen phan ghi vao `tf_apply_approved_request()` theo D-32a; luc do
 * ca hai lenh nam trong CUNG mot transaction cua database va van de nay bien
 * mat.)
 */
export async function reviewRequest(
  requestId: string,
  input: ReviewRequestInput,
): Promise<ReviewRequestResult> {
  const { companyId, userId, role, employeeId: reviewerEmployeeId } =
    await getSessionContext();

  // (1) D-30: chi owner/admin duyet. Vai tro khac nhan 403 ngay ca khi goi
  // thang Server Action — nut bi an chi la lop trinh bay.
  requireRole(role, ["owner", "admin"]);

  // (2) Ly do bat buoc khi tu choi — TRUOC khi cham database.
  const parsed = reviewRequestInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Dữ liệu xử lý yêu cầu không hợp lệ.",
    );
  }
  const decision = parsed.data.decision;
  // Chuoi rong va chuoi toan khoang trang deu ve `null`: mot ghi chu rong
  // khong phai mot ghi chu, va rang buoc CHECK cua 0017 cung nghi vay.
  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

  const supabase = await createServerSupabase();

  // Dong TRUOC — cung la buoc kiem ranh gioi doanh nghiep (T-05-01-02):
  // `requestId` cua doanh nghiep khac khong khop `.eq("company_id", ...)` nen
  // ra "khong tim thay", va dong do khong bi cham toi.
  const { data: beforeRow, error: beforeError } = await supabase
    .from("work_requests")
    .select(WORK_REQUEST_COLUMNS)
    .eq("id", requestId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy yêu cầu.");
  }

  // (3) Kiem trang thai — dung TRUOC moi thao tac ghi. Xem khoi chu thich
  // tren ham ve vi sao vi tri cua buoc nay khong duoc xe dich.
  const currentStatus = (beforeRow as { status: RequestStatus }).status;
  if (currentStatus !== "pending") {
    throw new Error(
      `Yêu cầu này đã được xử lý (${REQUEST_STATUS_LABEL[currentStatus]}) nên không xử lý lại được.`,
    );
  }

  // (4a) Lich su TRUOC. `created_at` do database cap (D-19) va duoc dung lai
  // lam `reviewed_at` cua dong yeu cau, de hai bang khong bao gio noi hai gio
  // khac nhau cho cung mot lan xu ly.
  const { data: reviewRow, error: reviewError } = await supabase
    .from("request_reviews")
    .insert({
      company_id: companyId,
      request_id: requestId,
      decision,
      note,
      reviewer_user_id: userId,
      reviewer_employee_id: reviewerEmployeeId,
    })
    .select("id, created_at")
    .single();

  if (reviewError || !reviewRow) {
    throw new Error("Không ghi được lịch sử xử lý — thao tác đã bị huỷ.");
  }

  // (4b) Anh chup trang thai hien tai tren chinh dong yeu cau (D-33: ba cot
  // nay KHONG bi bang lich su thay the — moi man hinh dang doc chung).
  const { data: afterRow, error: updateError } = await supabase
    .from("work_requests")
    .update({
      status: decision,
      reviewer_id: reviewerEmployeeId,
      review_note: note,
      reviewed_at: (reviewRow as { created_at: string }).created_at,
    })
    .eq("id", requestId)
    .eq("company_id", companyId)
    .eq("status", "pending")
    .select(WORK_REQUEST_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw new Error(
      "Không cập nhật được trạng thái yêu cầu. Lịch sử đã ghi lại lần thử này; hãy thử lại.",
    );
  }

  // (4c) TAC DONG LEN DU LIEU CONG (APRV-03, plan 05-02).
  //
  // Mot loi goi RPC, khong phai mot chuoi lenh chen/sua o day. Toan bo phan
  // ghi nam trong `tf_apply_approved_request()` vi co bao ve ky da chot
  // (`tf.applying_approved_request`) la TRANSACTION-LOCAL: PostgREST chay moi
  // lenh trong mot transaction rieng, nen mot chuoi lenh roi rac o tang nay se
  // khong bao gio di qua duoc trigger cua 05-05 (D-32a).
  //
  // Tu choi thi KHONG goi — mot yeu cau bi tu choi khong dong toi du lieu cong.
  let effect: RequestEffect = NO_EFFECT;
  let effectRowForAudit: unknown = afterRow;

  if (decision === "approved") {
    const { data: effectRow, error: applyError } = await supabase.rpc(
      "tf_apply_approved_request",
      { p_request_id: requestId },
    );

    if (applyError || !effectRow) {
      throw new Error(
        `Đã ghi nhận quyết định nhưng không áp dụng được vào dữ liệu công: ${
          applyError?.message ?? "không rõ nguyên nhân"
        }`,
      );
    }
    effect = requestEffectRowSchema.parse(effectRow);

    // Doc lai dong SAU khi ap dung de `audit_log.after` mang ca `applied_at`,
    // khong phai anh chup nua chung truoc do.
    const { data: appliedRow } = await supabase
      .from("work_requests")
      .select(WORK_REQUEST_COLUMNS)
      .eq("id", requestId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (appliedRow) effectRowForAudit = appliedRow;
  }

  // (4d) THONG BAO cho nguoi gui yeu cau (APRV-05, plan 05-04).
  //
  // Day KHONG phai mot buoc "best effort". Neu no that bai, nguoi bi anh huong
  // khong biet cong cua minh vua doi — va do la chinh dieu APRV-05 ton tai de
  // ngan (T-05-04-03). Loi o day lam ca thao tac that bai va nguoi duyet biet
  // de lam lai.
  //
  // Ngoai le duy nhat: nhan vien CHUA co tai khoan dang nhap. Luc do khong co
  // ai de nhan, va mot dong mo coi se khong bao gio duoc doc — bo qua, thao
  // tac van thanh cong.
  await notifyRequestOwner({
    supabase,
    companyId,
    requestId,
    employeeId: (beforeRow as { employee_id: string }).employee_id,
    request: workRequestSchema.parse(afterRow),
    decision,
    note,
  });

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "work_requests",
    entityId: requestId,
    before: beforeRow,
    after: effectRowForAudit,
    // Vet audit mang CA ly do CA he qua: sau nay doc lai mot dong audit phai
    // tra loi duoc "quyet dinh nay da doi bao nhieu ngay cong".
    reason: [note, effectSummary(effect)].filter(Boolean).join(" — ") || null,
  });

  return { request: workRequestSchema.parse(afterRow), effect };
}

/**
 * Sinh dong `notifications` cho nguoi da gui yeu cau.
 *
 * Doc `employees.user_id` truoc: bang thong bao tro toi `auth.users` chu khong
 * toi `employees` — mot thong bao chi co nghia khi co ai do dang nhap duoc de
 * doc no.
 */
async function notifyRequestOwner({
  supabase,
  companyId,
  requestId,
  employeeId,
  request,
  decision,
  note,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  companyId: string;
  requestId: string;
  employeeId: string;
  request: WorkRequest;
  decision: ReviewDecision;
  note: string | null;
}): Promise<void> {
  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (employeeError) {
    throw new Error("Không gửi được thông báo cho người gửi yêu cầu — thao tác đã bị huỷ.");
  }

  const recipientUserId = (employeeRow as { user_id: string | null } | null)?.user_id;
  if (!recipientUserId) return;

  const range =
    request.fromDate === request.toDate
      ? formatDate(request.fromDate)
      : `${formatDate(request.fromDate)} – ${formatDate(request.toDate)}`;

  const approved = decision === "approved";
  // Noi du de hieu MA KHONG PHAI BAM VAO: loai yeu cau, khoang ngay, quyet
  // dinh, va ly do khi bi tu choi.
  const body = [
    `${REQUEST_TYPE_LABEL[request.type]} (${range}) ${
      approved ? "đã được duyệt" : "đã bị từ chối"
    }.`,
    note ? `Lý do: ${note}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const { error } = await supabase.from("notifications").insert({
    company_id: companyId,
    user_id: recipientUserId,
    kind: "request_reviewed",
    title: approved ? "Yêu cầu của bạn đã được duyệt" : "Yêu cầu của bạn bị từ chối",
    body,
    request_id: requestId,
  });

  if (error) {
    throw new Error("Không gửi được thông báo cho người gửi yêu cầu — thao tác đã bị huỷ.");
  }
}

/** Mot cau ngan ve he qua, `null` khi khong co he qua nao (tu choi, tang ca). */
function effectSummary(effect: RequestEffect): string | null {
  const parts: string[] = [];
  if (effect.insertedCount > 0) parts.push(`tạo ${effect.insertedCount} bản ghi công`);
  if (effect.updatedCount > 0) parts.push(`sửa ${effect.updatedCount} bản ghi công`);
  if (effect.skippedCount > 0) {
    parts.push(
      `bỏ qua ${effect.skippedCount} ngày đã có chấm công (${effect.skippedDates.join(", ")})`,
    );
  }
  return parts.length > 0 ? parts.join("; ") : null;
}
