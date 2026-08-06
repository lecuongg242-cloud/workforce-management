---
phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng
plan: 01
subsystem: request-review
tags: [postgres, rls, pgtap, trigger, nextjs, route-handler, server-action, zod, vitest, react, ui, admin]

requires:
  - phase: 02-phi-n-th-t-v-c-t-t-ng-d-li-u-gi (02-09)
    provides: "work_requests + createRequest() + GET /api/requests"
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-01, 04-03, 04-04)
    provides: "khuon Server Action + logMutation (04-03), khuon trigger cuong che append-only (04-04), khuon man hinh quan tri (04-01)"
provides:
  - "request_reviews (migration 0017) — lich su xu ly append-only, 4 policy RLS, CHECK 'tu choi phai co ly do'"
  - "reviewRequest(requestId, {decision, note}) — Server Action duyet/tu choi kem audit"
  - "GET /api/requests/[id]/reviews — lich su xu ly cua mot yeu cau"
  - "GET /api/requests — them ngu canh nguoi gui (ten/ma nhan vien, phong ban), hang doi pending xep nguoi-cho-lau-nhat-truoc"
  - "/admin/requests — man hinh duyet cua quan tri (bo loc trang thai, ReviewDialog, RequestHistory)"
affects: ["05-02", "05-03", "05-04", "05-05", "05-06"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Truy van HAI BUOC cho ngu canh nguoi gui thay vi embed PostgREST: `work_requests` co HAI khoa ngoai tro toi `employees` (`employee_id` va `reviewer_id`) nen PostgREST khong tu suy dien duoc quan he nao — cung ly do da dan toi truy van hai buoc o `GET /api/attendance/review` (03-06)"
    - "Chieu sap xep phu thuoc bo loc: `status=pending` la HANG DOI (created_at tang dan, nguoi cho lau nhat truoc), moi nhanh con lai la LICH SU (giam dan). Tiebreaker `id` giu nguyen o ca hai (T-02-09-06)"
    - "`reviewed_at` cua `work_requests` lay tu `created_at` cua dong lich su vua chen, khong phai mot lan doc dong ho thu hai — mot lan xu ly, MOT dau thoi gian"
    - "Test tich hop dung dinh danh duy nhat theo lan chay (`wr-t0501-<run>-*`): bang append-only khong xoa duoc nen id co dinh se lam lan chay thu hai do vi du lieu cu chu khong vi ma sai"

key-files:
  created:
    - supabase/migrations/0017_request_reviews.sql
    - supabase/tests/12_request_reviews.sql
    - src/app/api/requests/[id]/reviews/route.ts
    - src/app/admin/requests/page.tsx
    - src/app/admin/requests/requests-review-view.tsx
    - src/components/requests/review-dialog.tsx
    - src/components/requests/request-history.tsx
    - src/lib/data/__tests__/request-review.test.ts
  modified:
    - supabase/tests/run-all.sql
    - scripts/check-pgtap-assertions.mjs
    - src/lib/types/domain.ts
    - src/lib/validation/api/requests.ts
    - src/lib/data/requests.ts
    - src/lib/data/mutations/requests.ts
    - src/app/api/requests/route.ts
    - src/lib/nav.ts
    - src/lib/constants.ts
    - src/components/dashboard/pending-requests-card.tsx

key-decisions:
  - "Thu tu ghi trong `reviewRequest()`: LICH SU TRUOC, cap nhat `work_requests` SAU. PostgREST khong cho hai lenh ghi nam trong mot transaction o tang nay nen phai chon huong hong an toan hon. Cap nhat truoc ma lich su hong -> mot quyet dinh KHONG CO vet va yeu cau da roi khoi `pending` nen khong lam lai duoc. Ghi lich su truoc ma cap nhat hong -> yeu cau van `pending`, thao tac lam lai duoc, va dong lich su thua chinh la vet cua lan that bai. (05-02 chuyen phan ghi vao `tf_apply_approved_request()` theo D-32a; luc do van de nay bien mat.)"
  - "Chieu sap xep cua `GET /api/requests` doi theo bo loc thay vi doi dong loat sang tang dan: man hinh nhan vien la LICH SU ca nhan (moi nhat truoc van dung), chi HANG DOI DUYET moi can nguoi-cho-lau-nhat-truoc."
  - "Ba truong ngu canh moi cua `workRequestPlainSchema` dung `.default(null)` chu khong `not null` — phan hoi khong mang ngu canh (man hinh nhan vien, hoac test cu) van parse duoc ma khong phai bia chuoi rong."
  - "`decision` la `text` + CHECK chu khong phai enum moi, theo tien le `attendance_photos.kind` (0005) — chi hai gia tri va khong dung chung voi enum `request_status` (`pending` khong phai mot quyet dinh)."
  - "Test 7 khang dinh trigger append-only co rang KE CA voi khoa `service_role`: khoa do bo qua RLS nhung KHONG bo qua trigger. Day la cach kiem `update request_reviews ...` cua acceptance criteria khi may khong co `psql`."

requirements-completed: [APRV-01, APRV-02, APRV-04]
---

# 05-01: Tracer duyet yeu cau — lich su, Server Action, man hinh quan tri

## Da lam

**Task 1 — bang lich su.** `request_reviews` (migration 0017): `id` uuid, `company_id`,
`request_id` (FK `work_requests`, cascade), `decision` (text + CHECK `approved`/`rejected`),
`note`, `reviewer_user_id` (auth.users), `reviewer_employee_id` (employees, null duoc),
`created_at`. Rang buoc `request_reviews_rejected_needs_note`: tu choi thi `note` phai khac
null va khac rong sau `btrim`. Trigger `request_reviews_append_only` chan `UPDATE`/`DELETE`
(khuon D-25a cua 0016), kem thu tuc go co y thuc ghi ngay trong khoi comment. Bon policy RLS
dieu kien duy nhat `tf_is_member(company_id)`. Hai index (`company_id`, va
`(request_id, created_at desc)` cho truy van nong duy nhat).

Test pgTAP `12_request_reviews.sql` — 8 khang dinh: duyet khong ghi chu chen duoc, tu choi co
ly do chen duoc, tu choi `note` NULL bi chan, tu choi `note` toan khoang trang bi chan,
`UPDATE` bi chan (23001), `DELETE` bi chan (23001), doc cheo tra 0 dong, ghi cheo bi tu choi
(42501). San assertion nang 212 -> 220.

Khoi comment dau migration noi ro **vi sao co bang nay trong khi da co ba cot review**: ba cot
giu duoc dung lan xu ly cuoi, con APRV-04 hoi *lich su*; va ba cot do **khong bi bo** — chung
van la anh chup trang thai hien tai cho moi man hinh dang doc chung (D-33).

**Task 2 — duong doc.** `RequestReview`/`ReviewDecision`/`ReviewRequestInput` vao `domain.ts`;
`requestReviewRowSchema` (transform + embed `employees(full_name)`) va
`requestReviewPlainSchema` (D-12d) vao `validation/api/requests.ts`; `listRequestReviews()`
vao `data/requests.ts`; route `GET /api/requests/[id]/reviews` (moi nhat truoc, tiebreaker
`id`; vai tro khong phai `owner`/`admin` chi doc duoc lich su cua yeu cau CUA CHINH MINH; yeu
cau cua doanh nghiep khac tra mang rong 200, khong phai 404).

`GET /api/requests` gan them `employeeName` / `employeeCode` / `departmentName` bang mot truy
van thu hai tren `employees` (van `.eq("company_id", companyId)` tu phien), va doi chieu sap
xep theo bo loc nhu ghi o `key-decisions`. Dong thieu ngu canh **khong bi loai** khoi danh
sach — mot yeu cau cho xu ly khong duoc bien mat chi vi ho so nhan vien co van de.

**Task 3 — Server Action.** `reviewRequest(requestId, {decision, note})`:
`requireRole(role, ["owner","admin"])` (D-30) -> kiem ly do bat buoc khi tu choi (TRUOC khi
cham database) -> doc dong truoc kem `.eq("company_id", ...)` -> **kiem trang thai** -> chen
lich su -> cap nhat ba cot anh chup + `status` (voi `.eq("status","pending")` lam chot cuoi) ->
`logMutation` (action `update`, before/after nguyen dong). Comment tai cho ghi ro vi tri buoc
kiem trang thai khong duoc xe dich vi 05-02 se noi tac dong len du lieu cong vao dung ham nay.

Test tich hop `request-review.test.ts` tren database dev that — 7 test: (1) duyet thanh cong
(trang thai, ba cot, mot dong lich su, mot dong audit, `reviewed_at` == `created_at` cua lich
su), (2) tu choi khong ly do bi chan **truoc khi cham database** (yeu cau van `pending`, 0 dong
lich su), (3) tu choi co ly do luu dung o ca hai noi, (4) id cheo doanh nghiep -> "Khong tim
thay yeu cau" va dong do khong doi, (5) **goi hai lan** -> lan hai nem loi va lich su van dung
mot dong, (6) `employee`/`manager` nhan `ForbiddenError`, (7) lich su khong sua/khong xoa duoc
ke ca bang khoa `service_role`.

**Task 4 — man hinh duyet.** `/admin/requests` (Server Component + `RequestsReviewView`): bo
loc trang thai mac dinh `pending`; bang 7 cot (nhan vien kem ma + phong ban, loai yeu cau,
khoang ngay, ly do, gui luc, trang thai, hanh dong); **Duyet** la nut chinh, **Tu choi** la nut
phu (`destructive-outline`) — mot nut mau nhan cho khu vuc. `ReviewDialog` doi schema
`zodResolver` theo quyet dinh (tu choi: `note` bat buoc; duyet: tuy chon) va hien lai ngu canh
yeu cau. Yeu cau da xu ly hien nut "Lich su xu ly" mo `RequestHistory`. Trang thai rong noi
dung su that: khong co yeu cau cho xu ly la **tin tot**. Trang thai phan biet bang
`StatusBadge` (bieu tuong + nhan chu). `nav.ts` them muc "Yeu cau" + `BREADCRUMB_LABELS.requests`;
`constants.ts` them `REQUEST_REVIEW_LABEL` / `REQUEST_DECISION_LABEL`;
`pending-requests-card.tsx` doi ca hai lien ket sang `/admin/requests`.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0; `/admin/requests` va `/api/requests/[id]/reviews` co trong output |
| `npx vitest run` | 34 file, **355 test xanh** (truoc plan: 348) |
| `npm run check:assertions` | 220 assertion, sang moc 220 |
| `npm run db:push` | 0017 da ap len database dev (Supabase cloud) |
| `grep -c "/admin/requests" src/lib/nav.ts src/components/dashboard/pending-requests-card.tsx` | 1 va 3 |
| `grep -c "/employee/requests" src/components/dashboard/pending-requests-card.tsx` | **0** |
| `grep -c "RequestHistory" .../requests-review-view.tsx` | 2 |
| `grep -c "logMutation" src/lib/data/mutations/requests.ts` | 4 (truoc plan 3) — **tang dung 1** |
| `grep -c "requireRole" src/lib/data/mutations/requests.ts` | 2 |
| `companyId` trong `validation/api/requests.ts` | chi o schema **dau ra** (row transform + plain shape); **khong** o `requestQuerySchema`, `workRequestInputSchema` hay `reviewRequestInputSchema` |

**Chay lai hai lan lien tiep** (`npx vitest run` ngay sau mot lan chay day du): xanh — dinh
danh duy nhat theo lan chay lam bo test khong phu thuoc vao du lieu con sot.

## Khong lam duoc trong moi truong nay

- `npm run test:db` / `npm run db:seed`: **khong chay duoc** (khong co `psql`, database dev la
  Supabase cloud) — nguyen van blocker da ghi o 04-06. `12_request_reviews.sql` da viet va da
  vao cong `check:assertions` nhung **chua chay that lan nao**; can Postgres tam cua CI. Ba
  khang dinh quan trong nhat cua no (append-only `UPDATE`/`DELETE`, tu choi thieu ly do) **da**
  duoc chung minh doc lap bang test tich hop Vitest tren database that (test 7 va test 2).
- **Quan sat tay tren trinh duyet** cua acceptance criteria Task 4 (tu choi khong ly do ->
  khong gui duoc; nhap ly do -> gui duoc, dong bien khoi danh sach cho; mo lai thay lich su
  dung mot dong): **chua lam**. Hanh vi tuong duong o tang server da duoc phu boi test 2 / 1 /
  5. Duong ghi la Server Action nen khong goi duoc tu script ngoai (gioi han da ghi o 04-06);
  e2e vong doi day du thuoc pham vi 05-06.

## Du lieu con sot tren database dev

Moi lan chay `request-review.test.ts` de lai **3 dong `work_requests`** (tien to
`wr-t0501-`, ly do bat dau bang `[test 05-01]`, ngay 2019) cong **3 dong `request_reviews`**
tuong ung — trigger append-only chan xoa nen chung khong don duoc bang duong ghi thong thuong.
Chung nam o `cty-01` voi ngay trong qua khu xa nen khong cham vao man hinh nao dang dung. Mot
lan `npm run db:seed` don sach (`truncate ... cascade` **khong** bi trigger chan). Cung tinh
chat da ghi nhan o 04-06 voi `overtime_rules`.
