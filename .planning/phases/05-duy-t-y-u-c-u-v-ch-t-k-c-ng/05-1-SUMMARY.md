---
phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng
plan: "5.1 (INSERTED)"
subsystem: admin-timesheet-payroll
tags: [nextjs, route-handler, zod, vitest, react, ui, admin, csv]

requires:
  - phase: 04-quy-t-c-c-ng-do-doanh-nghi-p-t-khai (04-05)
    provides: "mo-dun phan loai cong — nguon duy nhat cua gio tang ca"
  - phase: 05-duy-t-y-u-c-u-v-ch-t-k-c-ng (05-05)
    provides: "trang thai chot ky, de bang luong noi duoc so lieu da khoa hay chua"
provides:
  - "src/lib/attendance/month-context.ts — loadMonthContext() + summarizeMonth(), NGUON DUY NHAT cua phep tong hop thang"
  - "GET /api/payroll/summary + getPayrollPrep()"
  - "/admin/attendance — tab luoi thang + tab danh sach luot"
  - "/admin/payroll — bang chuan bi luong + xuat CSV"
affects: ["phase-06"]

actuals:
  tasks: 4
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Phep tong hop thang tach thanh mot module server-only dung chung, thay vi chep chuoi 'doc ca -> gop ngay -> phan loai -> cong lai' vao Route Handler thu hai"
    - "Giao dien dung LAI `groupAttendanceByDay()` + `shiftBreakInfoById()` cua tang doc thay vi tu cong `workedMinutes` tung dong — tu migration 0014 phep cong tay se ra so LON HON so gio duoc tinh cong"
    - "CSV cho Excel vi-VN: dau cham phay, BOM UTF-8, so thap phan dau phay — ba quyet dinh, mot ly do (tep duoc mo bang Excel chu khong bang trinh doc CSV chuan)"

key-files:
  created:
    - src/lib/attendance/month-context.ts
    - src/lib/validation/api/payroll.ts
    - src/app/api/payroll/summary/route.ts
    - src/lib/data/payroll.ts
    - src/lib/payroll/csv.ts
    - src/lib/payroll/__tests__/csv.test.ts
    - src/components/attendance/attendance-month-grid.tsx
    - src/components/attendance/attendance-record-table.tsx
    - src/app/admin/attendance/page.tsx
    - src/app/admin/attendance/attendance-view.tsx
    - src/app/admin/payroll/page.tsx
    - src/app/admin/payroll/payroll-view.tsx
    - src/lib/data/__tests__/payroll-summary.test.ts
  modified:
    - src/app/api/attendance/summary/route.ts
    - src/lib/types/domain.ts
    - src/lib/constants.ts
    - src/lib/nav.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "**Bang luong KHONG co con so tien nao.** Chu du an chon muc nay ngay 2026-08-06 sau khi duoc trinh bay ba muc (chuan bi luong / them luong co ban / gross-net day du). Nhom PAY van thuoc V3 — kieu `PayrollPrepRow` va nhan man hinh deu noi thang dieu do thay vi de nguoi dung suy ra tu mot bang thieu cot."
  - "**Tach `month-context.ts` TRUOC khi viet duong doc moi.** Chuoi tong hop thang dang nam nguyen van trong `GET /api/attendance/summary`; chep no sang mot Route Handler thu hai la tao hai duong tinh cung mot con so. Test tich hop khang dinh hai duong tra KHOP TUNG TRUONG."
  - "**Ai co mat trong bang:** khong phai nguoi da nghi viec, HOAC co ban ghi trong thang. Nghi viec giua thang khong xoa di nhung ngay da lam; bo ho khoi bang la mot cach im lang de mot nguoi khong duoc tra cong. Quy tac nay dung CHUNG o ca `/admin/attendance` lan `/api/payroll/summary`."
  - "**Ky hieu trong luoi thang la CHU, mau chi la lop thu hai** (✓ M S ! P K ·). Mot o chi to mau vo nghia voi nguoi mu mau va bien mat khi in ra giay — ma bang cong thi hay duoc in ra de ky. Moi o con mang `title` day du cho trinh doc man hinh."
  - "**Thieu he so xuat ra CSV thanh CHU, khong thanh 0** (D-26). Mot o `0` trong tep gui cho ke toan la mot lo lang khong ai doc ra; o chua chu buoc nguoi nhan phai hoi lai."
  - "Man hinh bang luong mac dinh mo THANG TRUOC: bang luong duoc lam sau khi thang da qua, va thang hien tai thi chua co gi de ban giao."

requirements-completed: [VIEW-01, VIEW-02, VIEW-03]
---

# 5.1: Bang cong cua quan tri va ban giao cho ke toan

## Boi canh

Hai muc nav `comingSoon` con sot tu V1 (`/admin/attendance`, `/admin/payroll`) **chua tung
duoc map vao requirement nao** — bang phu cua REQUIREMENTS.md van bao "unmapped: 0" trong khi
khu quan tri khong co cho xem cong. Chu du an yeu cau lap ngay 2026-08-06.

Da kiem truoc khi lam: V1 **chua tung** co hai man hinh nay (khong co gi trong lich su git de
khoi phuc), va ho so nhan vien **khong co mot truong luong nao** — chi co co `canViewPayslip`.

## Da lam

**1. Tach nguon tong hop thang.** `src/lib/attendance/month-context.ts`:
`loadMonthContext()` (doc ca + quy tac cong mot lan cho ca thang) va `summarizeMonth()` (gop
ngay -> phan loai -> cong lai). `GET /api/attendance/summary` duoc rut gon de goi chinh hai ham
do — chuoi logic cu bi xoa khoi Route Handler chu khong duoc chep them lan nao.

**2. Duong doc bang luong.** `GET /api/payroll/summary?month=` (chi `owner`/`admin`): mot dong
cho moi nhan vien, kem `periodStatus` cua thang do. Ban ghi duoc gom theo NHAN VIEN truoc khi
tong hop — `groupAttendanceByDay()` gop theo NGAY, nen dua ca tap nhieu nguoi vao se tron cac
luot cua ho.

**3. `/admin/attendance` — hai tab.** Luoi thang (mac dinh): mot dong moi nhan vien, mot cot
moi ngay, ky hieu chu + chu giai, bam mot o mo `AttendancePhotoDialog` co san cua 03-05. Tab
danh sach: tung luot cham cong. Bo loc phong ban + tim theo ten/ma, chon thang bang hai nut
lui/toi. Giao dien dung LAI dung hai ham gop ngay cua tang doc.

**4. `/admin/payroll` — bang chuan bi luong.** Tam cot so lieu, huy hieu trang thai ky, thanh
tong o dau, nut xuat CSV. Cot "Gio quy doi" hien chu **"chưa khai hệ số"** khi doanh nghiep
chua khai (D-26) kem chu tro giup chi duong sang tab Tang ca.

## Kiem chung

| Cong | Ket qua |
|---|---|
| `npm run typecheck` | thoat 0 |
| `npm run lint` | thoat 0 |
| `npm run build` | thoat 0; `/admin/attendance`, `/admin/payroll`, `/api/payroll/summary` co trong output |
| `npx vitest run` | 43 file, **441 test xanh** (truoc: 420) |
| `csv.test.ts` | 11 test thuan |
| `payroll-summary.test.ts` | 8 test tich hop tren database dev that |
| Smoke qua HTTP that (server dev cong 3009, cookie owner that) | 8/8 khang dinh xanh |

**Bai kiem quan trong nhat** (`payroll-summary.test.ts` #1): voi cung mot nhan vien va cung
mot thang, **moi truong** cua `/api/payroll/summary` trung khit voi `/api/attendance/summary` —
`workedDays`, `totalMinutes`, `leaveDays`, `lateCount`, `overtimeMinutes`,
`convertedOvertimeHours`. Bai #2 khang dinh do khong phai su trung khop vo nghia cua hai so 0:
2 ngay cong, 1080 phut, 120 phut tang ca, 3 gio quy doi.

Hai quy tac de mat nhat cung co bai rieng: nguoi khong co ban ghi van co mot dong toan so 0
(#3), va nguoi da nghi viec van co mat neu thang do ho co lam (#4).

Smoke qua HTTP that xac nhan ca hai trang tra **200** voi cookie quan tri that, trang bang
luong render dung cau "khong tinh tien", va duong doc tra du lieu that (1 ngay cong, 600 phut,
120 phut tang ca, `convertedOvertimeHours` **null** vi doanh nghiep smoke chua khai he so).

## Chua lam / gioi han da biet

1. **Chua ai bam tay tren trinh duyet.** Smoke chi chung minh HTML dau tien tra ve khong loi;
   phan luoi thang va bang duoc render **o client sau khi du lieu ve**, nen mat nguoi van chua
   nhin thay chung. Cung tinh chat voi ba man hinh cua Phase 5 (xem `05-UAT.md` §Gioi han 4).
2. **Bang luong khong tinh tien** — co y (xem key-decisions). Nhom PAY-01…05 van o V3.
3. **Khong them test pgTAP** o lan nay: khong migration nao duoc them, khong bat bien database
   nao moi. San `check:assertions` giu nguyen 250.
4. **Chua co phan trang.** Luoi thang render moi nhan vien cua doanh nghiep trong mot bang;
   voi quy mo pilot (1-2 doanh nghiep, ~40 nguoi) thi day la lua chon dung, nhung mot doanh
   nghiep vai tram nguoi se can phan trang hoac cuon ao.
5. **CSV chua duoc mo thu bang Excel that.** Ba quyet dinh dinh dang (dau cham phay, BOM,
   so thap phan dau phay) duoc kiem bang test tren CHUOI, khong bang mot lan mo tep that tren
   may co Excel tieng Viet. Day la thu dang thu mot lan truoc khi ban giao cho ke toan that.
