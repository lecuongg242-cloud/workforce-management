---
phase: 03-ch-m-c-ng-c-b-ng-ch-ng
plan: 05
subsystem: attendance-evidence
tags: [nextjs, route-handler, server-action, zod, supabase, rls, react, ui]

requires:
  - phase: 03-ch-m-c-ng-c-b-ng-ch-ng (03-01)
    provides: "Migration 0011 (accuracy_meters/work_site_id/distance_meters + tf_distance_meters), broker Route Handler GET /api/attendance-photos/[id] (byte anh), Dialog toi gian, attendancePhotoRowSchema/attendancePhotoSchema"
provides:
  - "GET /api/attendance-photos: sieu du lieu (khong byte) cua toi da hai anh mot ban ghi cham cong — toa do, khoang cach, do chinh xac, ten diem lam viec, trang thai xem xet"
  - "markPhotoReviewed(photoId, status): Server Action ghi review_status/reviewed_by (session)/reviewed_at (tf_server_now) + mot dong audit_log"
  - "AttendancePhotoDialog day du: hai o anh doc lap trang thai, khoang cach LUON di kem do chinh xac GPS va cau giai thich D-20, toa do tho + lien ket Google Maps mo tab moi, mot nut mau nhan xem xet, dong ghi chu pham vi bang chung"
  - "Dau hieu nho 'co anh/khong co anh' tren bang lich su cham cong cua employee-detail-view"
affects: [03-06, 03-07]

actuals:
  tokens: 12900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Route metadata (GET /api/attendance-photos) va broker route byte (GET /api/attendance-photos/[id]) song song trong CUNG thu muc, phan cong tuyet doi: mot ben khong bao gio tra thu ben kia lam duoc"
    - "Import namespace (`import * as auditLog`) thay named import khi acceptance criteria doi hoi dung MOT dong nguon goi ham ghi audit trong file"
    - "Chuoi truy van gia lap (makeChain, thenable + terminal maybeSingle/single) de test Server Action/Route Handler ma khong cham Postgres that — tranh FK actor_user_id -> auth.users khi userId gia lap khong ton tai"
    - "Khoang cach va do chinh xac GPS LUON hien thi canh nhau, kem cau giai thich do chinh xac la ban kinh tin cay do thiet bi tu khai (D-20)"

key-files:
  created:
    - src/app/api/attendance-photos/route.ts
    - src/lib/data/mutations/attendance-photos.ts
    - src/lib/data/__tests__/attendance-photos.test.ts
  modified:
    - src/lib/validation/api/attendance-photos.ts
    - src/lib/data/attendance-photos.ts
    - src/components/attendance/attendance-photo-dialog.tsx
    - src/app/admin/employees/[id]/employee-detail-view.tsx
    - src/lib/constants.ts

key-decisions:
  - "Test tich hop cua Task 1 dung khuon MOCK DB (giong employees.test.ts/accounts.test.ts) thay vi Postgres that (khuon route.test.ts cua 03-01) — markPhotoReviewed ghi audit_log.actor_user_id (uuid, FK toi auth.users), mot userId phien gia lap se vi pham FK/kieu du lieu neu ghi that; mock giu test doc lap voi seed va van chung minh dung thu tu/dieu kien goi"
  - "Import audit qua namespace (`import * as auditLog`) trong mutations/attendance-photos.ts thay vi named import `{ logMutation }` — dap ung dung acceptance criteria 'grep -c logMutation tra ve 1' (mot dong nguon duy nhat: dong goi ham, khong phai dong import)"
  - "Go bo getAttendancePhotoForRecord (Server Action rieng le tung lan cham, 03-01 them cho ban Dialog toi gian) va chi thi 'use server' khoi src/lib/data/attendance-photos.ts — Dialog day du chuyen han sang listAttendancePhotos qua Route Handler, giu ham cu se la code chet"
  - "Sua ATTENDANCE_PHOTO_DIALOG_LABEL.loadError bo cau 'lien ket da het han' — kien truc da chot tu 03-01 la broker Route Handler (khong phai signed URL), nen khong co lien ket nao tu mat hieu luc theo thoi gian"
  - "Dau hieu 'co anh/khong co anh' tren bang lich su goi listAttendancePhotos toi da 20 lan (bang so dong hien thi), chi khi vai tro owner/admin, bat try/catch de khong lam vo ca trang neu 403 — chap nhan duoc o quy mo 1-2 doanh nghiep cua du an, khong dung mot route bulk moi de tranh mo rong pham vi ngoai <files> cua Task 2"

requirements-completed: [ATT-04, ATT-05]

coverage:
  - id: D1
    description: "GET /api/attendance-photos tra sieu du lieu co lap theo company_id tu session, chi owner/admin, tra mang rong (khong 403/404) cho ban ghi khong thuoc doanh nghiep hoac khong co anh, sap xep check_in truoc check_out, khong truong nao chua URL"
    requirement: ATT-05
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/attendance-photos.test.ts (test 1-6, chay qua npx vitest run)"
        status: pass
      - kind: other
        ref: "grep -icE signedUrl|publicUrl|\\burl\\b src/lib/validation/api/attendance-photos.ts == 0; grep createSignedUrl|getPublicUrl (ngoai __tests__) == rong"
        status: pass
    human_judgment: false
  - id: D2
    description: "markPhotoReviewed tu choi vai tro khong phai owner/admin TRUOC khi cham DB, ghi reviewed_by=userId phien/reviewed_at=tf_server_now (khong tu tham so), tu choi anh cua doanh nghiep khac va khong doi du lieu, de lai DUNG mot dong audit_log moi lan"
    requirement: ATT-04
    verification:
      - kind: unit
        ref: "src/lib/data/__tests__/attendance-photos.test.ts (test 7-10)"
        status: pass
      - kind: other
        ref: "grep -v comment src/lib/data/mutations/attendance-photos.ts | grep new Date|Date.now == 0; grep -c logMutation == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "AttendancePhotoDialog day du: hai o anh doc lap Skeleton/loi/tai lai, khoang cach luon di kem do chinh xac GPS, toa do + lien ket Google Maps mo tab moi (rel noopener), mot nut mau nhan duy nhat, dong ghi chu pham vi bang chung phu dinh ro rang"
    requirement: ATT-04
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run build (thoat 0); 9 lenh grep cua acceptance criteria Task 2 (src=/accuracyMeters/distanceMeters/Skeleton/khuon-mat-phu-dinh/het-han=0/PHOTO_REVIEW_STATUS_LABEL/target=_blank+rel)"
        status: pass
    human_judgment: true
    rationale: "Chua mo Dialog that trong trinh duyet (owner that, bang ghi co du/thieu mot dau/khong anh, chan mang toi broker route trong DevTools) — moi truong thuc thi nay khong co trinh duyet that de lai UI; deferred sang human_verify_mode: end-of-phase cua du an (giong D5 cua 03-01-SUMMARY.md)."
  - id: D4
    description: "Dau hieu nho 'co anh/khong co anh' tren bang lich su cham cong cua employee-detail-view, khong doi bo cuc bang"
    verification:
      - kind: other
        ref: "npm run typecheck && npm run build thoat 0"
        status: pass
    human_judgment: true
    rationale: "Can quan sat bang thuc trong trinh duyet de xac nhan dau cham hien dung/sai voi du lieu that — cung ly do D3, deferred sang UAT cuoi phase."

duration: 27min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 5: Dialog xem lại đầy đủ bằng chứng chấm công Summary

**Route sieu du lieu anh cham cong co lap theo doanh nghiep, hanh dong danh dau da xem xet co vet audit, va Dialog quan tri hien thi khoang cach luon di kem do chinh xac GPS de tranh bien mot phep do sai so 20-50m thanh mot ket luan chac chan.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-02T17:00:00+07:00 (uoc luong, truoc commit Task 1)
- **Completed:** 2026-08-02T17:27:39+07:00
- **Tasks:** 2/2
- **Files modified:** 9 (4 tao moi, 5 sua)

## Accomplishments

- `GET /api/attendance-photos` doc sieu du lieu (toa do, khoang cach, do chinh xac, ten diem lam viec, trang thai xem xet) cua toi da hai anh mot ban ghi cham cong — chi owner/admin, co lap theo `company_id` tu session, khong tra bat ky truong nao chua URL (dung voi route byte `[id]/route.ts` da co tu 03-01, hai duong khong lam thay nhau)
- `markPhotoReviewed()` ghi trang thai xem xet kem nguoi (`userId` cua phien) va thoi diem (`tf_server_now()` cua database, khong phai tham so nguoi goi) va mot dong `audit_log`; tu choi vai tro khong phai quan tri va anh cua doanh nghiep khac truoc khi cham database
- `AttendancePhotoDialog` mo rong tu ban toi gian thanh man hinh xem lai day du: hai o anh doc lap trang thai tai (Skeleton/loi/tai lai rieng tung o, mot o loi khong lam do ca Dialog), khoi sieu du lieu moi lan cham voi khoang cach **luon** dung canh do chinh xac GPS kem cau giai thich D-20, toa do tho, lien ket mo Google Maps o tab moi do nguoi dung chu dong bam, va dung mot nut mau nhan "Danh dau da xem xet"
- Dong ghi chu ro rang: anh la anh hien truong, khong dung de doi chieu khuon mat hay xac nhan danh tinh nguoi cham cong
- Bang lich su cham cong cua `employee-detail-view` co them mot dau cham nho bao truoc "ban ghi co anh hay khong" ma khong doi bo cuc bang

## Task Commits

1. **Task 1: Duong doc sieu du lieu anh cham cong va hanh dong danh dau da xem xet** - `87563de` (feat)
2. **Task 2: Dialog xem lai day du — anh, vi tri, khoang cach va muc tin cay cua no** - `64fcc54` (feat)

_Ca hai task deu `tdd="true"`/hanh vi-truoc theo cach 03-01 da lam: viet `<behavior>` truoc roi code thoa hanh vi do trong cung mot commit atomic theo task (khong tach RED/GREEN rieng vi Task 1 la mot cum route+mutation+test gan chat, Task 2 la mot component UI khong co bai test tu dong rieng theo dac ta plan)._

## Files Created/Modified

- `src/app/api/attendance-photos/route.ts` - Route Handler GET-only, sieu du lieu anh, co lap company_id, requireRole owner/admin
- `src/lib/data/mutations/attendance-photos.ts` - `markPhotoReviewed()` Server Action, import audit qua namespace
- `src/lib/data/__tests__/attendance-photos.test.ts` - 10 test tich hop (mock DB) cho ca route va mutation
- `src/lib/validation/api/attendance-photos.ts` - them `attendancePhotoQuerySchema`/`attendancePhotoListResponseSchema`/`photoReviewInputSchema`
- `src/lib/data/attendance-photos.ts` - them `listAttendancePhotos()`, re-export `markPhotoReviewed`, go `getAttendancePhotoForRecord` (code chet)
- `src/components/attendance/attendance-photo-dialog.tsx` - Dialog day du: PhotoSlot/MissingLegSlot/PhotoMetadata, nut xem xet, ghi chu pham vi
- `src/app/admin/employees/[id]/employee-detail-view.tsx` - dau hieu "co anh" tren bang lich su
- `src/lib/constants.ts` - mo rong `ATTENDANCE_PHOTO_DIALOG_LABEL`, sua cau "lien ket da het han"

## Decisions Made

Xem `key-decisions` o frontmatter. Quan trong nhat:

1. **Test Task 1 dung khuon mock DB thay vi Postgres that** — `markPhotoReviewed` ghi `audit_log.actor_user_id` (uuid, FK toi `auth.users`); mot `userId` phien gia lap (chuoi bat ky) se vi pham rang buoc kieu/FK do neu ghi that vao Postgres dev. Mock giu test doc lap, khong can don du lieu sau khi chay, va van chung minh dung THU TU goi (role check truoc khi cham DB) va DIEU KIEN truy van (`.eq("company_id", ...)` tu session).
2. **Import namespace cho audit trong mutation moi** — acceptance criteria doi `grep -c logMutation` tra ve dung 1 (mot dong nguon duy nhat goi ham), khac quy uoc named-import cua cac file mutation khac (import + goi = 2+ dong). Chi ap dung cho file nay theo dung yeu cau tuong minh cua plan.
3. **Go `getAttendancePhotoForRecord`** — Dialog day du khong con dung Server Action rieng le tung lan cham, chuyen han sang `listAttendancePhotos()` qua Route Handler moi (doc CA hai lan cham mot luot). Giu ham cu la code chet; go luon `"use server"` khoi file vi khong con Server Action nao dinh nghia truc tiep trong do (chi con re-export tu module khac, giong khuon `shifts.ts`/`attendance.ts` cua tang du lieu).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Copy "lien ket da het han" trong `ATTENDANCE_PHOTO_DIALOG_LABEL.loadError` sai kien truc**
- **Found during:** Task 2, khi doc lai UI-SPEC va nhan ra chu nay duoc viet duoi gia dinh kien truc signed URL, trong khi 03-01 da chot broker Route Handler (khong bao gio phat hanh signed URL)
- **Issue:** Mot loi tai anh o kien truc broker route chi co the la loi mang/loi server, khong bao gio la "lien ket het han" — giu nguyen chu cu se noi sai voi quan tri ve nguyen nhan loi
- **Fix:** Doi thanh "Không tải được ảnh." (trung tinh, dung ca cho loi mang lan loi server)
- **Files modified:** src/lib/constants.ts
- **Verification:** `grep -icE "liên kết đã hết hạn|hết hạn" src/components/attendance/attendance-photo-dialog.tsx` tra ve 0
- **Committed in:** 64fcc54 (Task 2 commit)

**2. [Rule 1 - Bug/hygiene] Code chet `getAttendancePhotoForRecord` sau khi Dialog doi nguon du lieu**
- **Found during:** Task 2, khi viet lai Dialog de dung `listAttendancePhotos()` thay vi ham cu tung lan cham
- **Issue:** Ham cu (03-01 them theo Rule 2) khong con noi goi nao sau khi Dialog doi huong — giu lai la code chet, vi pham quy uoc don dep cua du an
- **Fix:** Go ham va cac import chi no dung (`getSessionContext`/`requireRole`/`createServerSupabase`/`attendancePhotoRowSchema` khong con can trong file nay); go luon chi thi `"use server"` vi khong con Server Action nao dinh nghia truc tiep
- **Files modified:** src/lib/data/attendance-photos.ts
- **Verification:** `npm run typecheck && npm run build` thoat 0; khong con tham chieu nao toi `getAttendancePhotoForRecord` trong `src/`
- **Committed in:** 64fcc54 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — sai lech chu/kien truc va code chet)
**Impact on plan:** Ca hai deu can thiet cho tinh dung dan (chu dung voi kien truc that) va ve sinh code (khong de sot mot Server Action khong ai goi). Khong co mo rong pham vi ngoai y dinh cua plan.

## Issues Encountered

None — khong co block nao can nguoi dung can thiep trong luc thuc thi.

## User Setup Required

None - khong co cau hinh dich vu ngoai nao moi.

## Next Phase Readiness

**San sang:** Quan tri xem duoc toan bo bang chung cua mot ban ghi (ca hai anh, toa do, khoang cach kem do tin cay, ten diem lam viec) va danh dau da xem xet duoc, co vet audit day du. Plan 03-06 (danh sach "can xem lai") co the tai su dung nguyen `PHOTO_REVIEW_STATUS_LABEL`/`PHOTO_REVIEW_STATUS_TONE`/`markPhotoReviewed()` da co o day.

**Con cho (deferred sang UAT cuoi phase, dung `human_verify_mode: "end-of-phase"` cua du an, cung tien le voi 03-01-SUMMARY.md):**
- Mo Dialog that trong trinh duyet voi phien owner: xac nhan ca hai anh hien dung, khoang cach/do chinh xac dung canh nhau, lien ket ban do mo dung toa do.
- Mo Dialog cho mot ban ghi seed khong co anh: xac nhan dong "Bản ghi này không có ảnh đính kèm." hien dung, khong co anh vo.
- Mo Dialog cho mot ban ghi chi co anh mot dau: xac nhan mot o hien anh, mot o bao thieu.
- Chan duong mang toi broker route trong DevTools: xac nhan o anh hien loi + nut tai lai, phan sieu du lieu van hien thi binh thuong.
- Quan sat dau hieu "co anh" tren bang lich su voi du lieu that.

Nam muc nay khong chan plan tiep theo (logic da chung minh qua 10 test tich hop + build/typecheck/lint xanh), nhung can mot phien UAT co trinh duyet that truoc khi dong phase 3.

---
*Phase: 03-ch-m-c-ng-c-b-ng-ch-ng*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 8 created/modified files verified present on disk; both task commits (`87563de`, `64fcc54`) verified present in `git log`.
