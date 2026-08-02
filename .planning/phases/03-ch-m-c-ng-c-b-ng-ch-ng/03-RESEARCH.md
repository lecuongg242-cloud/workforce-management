# Phase 3: Chấm công có bằng chứng - Research

**Researched:** 2026-08-02
**Domain:** Live-camera capture (`getUserMedia`), browser Geolocation, Supabase Storage (private bucket, first use in this project), server-side distance calculation
**Confidence:** MEDIUM — camera/geolocation web-platform behavior is HIGH confidence (MDN + cross-checked); Supabase Storage signed-URL leak behavior is HIGH confidence (official Supabase discussion, load-bearing finding below); schema-gap findings are HIGH confidence (read directly from migration files this session); haversine-vs-PostGIS and testing-infra recommendations are MEDIUM (web-sourced, cross-checked, judged against this project's actual scale)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-20:** Ngoài bán kính **không phải lý do từ chối**. Server vẫn nhận bản ghi, tính và
  lưu khoảng cách thật, gắn cờ để quản trị xem lại. Màn hình nhân viên hiện cảnh báo kèm
  khoảng cách, không hiện lỗi.
  *Lý do:* GPS trong nhà xưởng sai 20–50m, có khi hơn. Chặn cứng nghĩa là người đứng đúng
  chỗ vẫn không chấm công được và không có đường nào đi tiếp.
  — **Reversibility:** costly.

- **D-20a:** "Trong bán kính" từ **điều kiện bắt buộc** trở thành **ghi chú**. GPS không còn
  chặn được ai — nó chỉ còn làm chứng. `ROADMAP.md` tiêu chí 1 và `REQUIREMENTS.md` ATT-02/
  ATT-08 đã sửa cho khớp.

- **D-20b:** Lý do **từ chối** còn đúng ba: thiếu ảnh, ngoài ca, mất mạng. Ba lý do này server
  quyết, client chỉ hiển thị.

- **D-21:** Gắn cờ đáng ngờ khi lần chấm công **cách tâm `work_site` quá xa** — ngưỡng cấu
  hình được, mặc định **5 lần bán kính**. Không dùng phép tính tốc độ di chuyển.
  — **Reversibility:** reversible.

- **D-21a:** Ngưỡng **không được nhúng cứng**. Hằng số mặc định đặt ở một chỗ, đọc được từ
  cấu hình doanh nghiệp khi Phase 4 dựng trang cài đặt.

- **D-21b:** Ảnh hiện trường + GPS chứng minh *"một thiết bị đã ở đúng nơi"*, **không**
  chứng minh *"đúng người"*. Sau D-20, lớp cách-tâm-quá-xa là **lớp phát hiện chính**, không
  còn là lớp phụ.

- **D-22:** Ảnh chấm công **không tự xoá**. Không dựng job dọn theo lịch ở phase này.
  — **Reversibility:** reversible về kỹ thuật, **không thu hồi được về mặt dữ liệu**.

- **D-22a:** Ghi nhận rủi ro có ý thức — NĐ 13/2023, nhóm PRIV hoãn sang V3. Cộng hưởng D-18a:
  `audit_log` lưu nguyên dòng nên từ phase này thành bản sao thứ hai của cùng dữ liệu cá nhân.

- **D-23:** **Không có hàng đợi offline.** Mất mạng lúc bấm thì báo lỗi và bắt bấm lại. Một
  bản ghi chờ gửi sau sẽ mang giờ **gửi** chứ không phải giờ **bấm** — phá vỡ ATT-06.
  — **Reversibility:** reversible, nhưng phải trả lời "ghi giờ nào" nếu thêm lại.

### Claude's Discretion

- Hình dạng bảng `work_sites` và cách gắn nhân viên vào điểm làm việc
- Cách tính khoảng cách (haversine trong SQL hay trong TypeScript) — miễn ở **server**
- Tên bucket Storage, cấu trúc thư mục, thời hạn liên kết ký
- Định dạng và mức nén ảnh trước khi tải lên
- Cách tổ chức màn hình quản trị xem lại ảnh + vị trí
- Cách hiển thị bản đồ (hoặc không hiển thị bản đồ) trên màn hình nhân viên
- Bố cục danh sách "cần xem lại"

### Deferred Ideas (OUT OF SCOPE)

- Xoá ảnh theo lịch / theo vòng đời kỳ công (D-22 chốt giữ vĩnh viễn)
- Quyền riêng tư nâng cao (rút lại đồng ý, tự xuất dữ liệu, nhật ký ai xem ảnh của ai) — PRIV, V3
- Hàng đợi chấm công offline — cân nhắc và bỏ (D-23)
- Nhiều điểm làm việc + gán nhân viên theo điểm (theo dõi vận hành) — SITE, V3
- Ngưỡng đáng ngờ cấu hình từ giao diện — Phase 4
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATT-01 | Chấm công bắt buộc kèm ảnh chụp trực tiếp bằng camera; không chọn được ảnh có sẵn | §"Camera capture", §Pitfall 1 — xác nhận `<input capture>` không đủ, `getUserMedia()` là bắt buộc |
| ATT-02 | Chấm công bắt buộc kèm GPS; server tính khoảng cách, ghi lại; ngoài bán kính không chặn | §"Geolocation", §"Distance on a sphere", §Schema Gap — cột `distance_meters` chưa tồn tại, phải thêm |
| ATT-03 | Quản trị khai báo điểm làm việc: tên, toạ độ, bán kính | §Architecture Patterns — lát cắt `work_sites` theo khuôn `ShiftsView` |
| ATT-04 | Quản trị xem lại ảnh + vị trí của từng bản ghi | §"Supabase Storage" — kiến trúc broker route |
| ATT-05 | Ảnh lưu bucket riêng tư, mở qua liên kết ký hạn ngắn, chỉ người cùng doanh nghiệp | §"Supabase Storage" — phát hiện trọng yếu về rò rỉ signed URL |
| ATT-06 | Dấu thời gian do server cấp, không lấy đồng hồ thiết bị | §"Server-authoritative timestamps" — mở rộng `tf_server_now()` đã có |
| ATT-07 | Đánh dấu đáng ngờ khi cách tâm work_site quá xa (mặc định 5× bán kính) | §"Distance on a sphere", §Schema Gap |
| ATT-08 | Nhân viên thấy rõ lý do từ chối (3 lý do) và cảnh báo khi được nhận nhưng ở xa | §Copywriting đã khoá ở UI-SPEC; đây chỉ xác nhận nguồn lỗi phía server |
</phase_requirements>

## Summary

Phase 3 thêm ba năng lực mới hoàn toàn cho dự án — camera trực tiếp qua `getUserMedia()`,
Geolocation trình duyệt, và Supabase Storage — trên nền một kiến trúc đã ổn định từ Phase 2
(Route Handler GET-only / Server Action ghi, `getSessionContext()` là điểm kiểm danh tính duy
nhất, `tf_server_now()` là đồng hồ duy nhất). Rủi ro kỹ thuật lớn nhất **không** nằm ở việc
"camera có chạy không" — đó là hành vi trình duyệt đã tài liệu hoá rõ ràng — mà nằm ở hai chỗ cụ
thể: (1) **`work_sites` và `attendance_photos` — hai bảng đã tồn tại từ Phase 1 — thiếu đúng
những cột mà D-20/D-21/ATT-02/ATT-07 cần** (không có `distance_meters`, không có
`accuracy_meters`, không có cột nào tham chiếu `work_site_id`), và (2) **một liên kết ký hạn
ngắn của Supabase Storage, một khi đã phát hành, hoạt động cho BẤT KỲ AI cầm đúng liên kết đó
tới khi hết hạn — không tái kiểm tra RLS theo từng lần tải** — nghĩa là cách làm "tạo signed URL
rồi trả thẳng cho trình duyệt" mà nghiên cứu milestone (`STACK.md`) đề xuất **không** tự động
thoả tiêu chí 4 của ROADMAP ("người ở doanh nghiệp khác cầm đúng liên kết vẫn không xem được").
Phải brokered: một Route Handler GET riêng tự kiểm `company_id` **trên mỗi lần gọi** rồi tải
byte ảnh về bằng `.storage.from(bucket).download()` và trả thẳng cho trình duyệt — không bao giờ
phát hành URL ký thô ra ngoài server.

Camera: `<input type="file" accept="image/*" capture>` **xác nhận không đủ** — trên Android nó
mở thẳng app camera hệ thống (tốt), nhưng trên iOS Safari, hệ điều hành **luôn** hiện cả bộ chọn
thư viện ảnh cạnh camera bất kể thuộc tính `capture` — đúng như ATT-01 lo ngại. `getUserMedia()`
là con đường bắt buộc duy nhất loại trừ hoàn toàn đường vòng thư viện ảnh. Vì ảnh được chụp bằng
`canvas.toBlob()` từ khung hình video trực tiếp (không phải file JPEG do app camera hệ thống
sinh ra), ảnh **không mang EXIF** ngay từ đầu — không cần thêm bước tách EXIF riêng, đây là hệ
quả cấu trúc của chính kiến trúc ATT-01 đòi hỏi, không phải một biện pháp phải tự dựng thêm.

Khoảng cách nên tính bằng một hàm SQL haversine đơn giản (cùng họ với `tf_work_date`/
`tf_server_now` đã có), **không** cần PostGIS ở quy mô này (so sánh một toạ độ với vài điểm làm
việc mỗi lần chấm công — không phải một truy vấn không gian cần chỉ mục GiST).

**Primary recommendation:** Thêm migration mới bổ sung `accuracy_meters`, `work_site_id`,
`distance_meters` vào `attendance_photos`; viết `tf_distance_meters()` bằng SQL thuần; dựng
bucket Storage riêng tư + broker Route Handler GET tự kiểm `company_id` mỗi lần tải (không phát
hành signed URL thô); bắt buộc `getUserMedia()` với `facingMode: { ideal: "environment" }`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mở camera, hiển thị viewfinder, chụp khung hình → Blob | Browser / Client | — | `getUserMedia()`/`canvas` là API trình duyệt thuần, không có tương đương server |
| Nén ảnh trước khi tải lên | Browser / Client | — | Giảm băng thông trên mạng di động yếu trước khi rời thiết bị; làm ở server thì đã tốn băng thông rồi |
| Lấy toạ độ GPS | Browser / Client | — | `navigator.geolocation` chỉ tồn tại ở trình duyệt |
| Tính khoảng cách tới `work_site`, quyết định cờ đáng ngờ | API / Backend | Database (hàm SQL) | ATT-02 yêu cầu tường minh "server tính", client không tự quyết |
| Cấp dấu thời gian chấm công | Database | API / Backend (gọi qua RPC) | Nối tiếp mẫu `tf_server_now()` đã khoá ở Phase 2 — DB là đồng hồ duy nhất |
| Ghi ảnh vào Storage | API / Backend (Server Action) | Database / Storage (RLS trên `storage.objects`) | D-12c: mọi thao tác ghi đi qua Server Action, không phải Route Handler POST |
| Phát ảnh cho quản trị xem lại | API / Backend (Route Handler GET, broker) | Database / Storage | Không bao giờ để URL ký thô chạm trình duyệt — xem phát hiện trọng yếu §"Supabase Storage" |
| Quyết định điểm làm việc gần nhất, ngưỡng đáng ngờ | API / Backend | Database (hằng số/cột cấu hình) | Ngưỡng đọc từ một chỗ (D-21a), không nhúng cứng ở client |
| Hiển thị ba lý do từ chối / cảnh báo ngoài bán kính | Browser / Client | API / Backend (nguồn sự thật) | Client chỉ hiển thị, không tự quyết định — D-20b |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `browser-image-compression` | 2.0.2 [ASSUMED — tên gói phát hiện qua WebSearch, không phải tài liệu chính thức; verdict `OK` qua cổng package-legitimacy] | Nén ảnh phía client trước khi tải lên | 1.43M lượt tải/tuần, repo GitHub thật (`Donaldcwl/browser-image-compression`), không có `postinstall`; đã dùng canvas nội bộ nên **tự động không giữ EXIF** khi re-encode |

Không cần thêm thư viện nào khác cho camera/GPS/Storage — `getUserMedia()`, `navigator.geolocation`,
và `@supabase/supabase-js` (đã có, 2.111.0, pin cứng) đủ cho toàn bộ phase. Không cần cài đặt
PostGIS (xem §"Distance on a sphere"), không cần thư viện tách EXIF riêng (xem §"Image handling"),
không cần Playwright ở phase này (xem §"Testing").

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `getUserMedia()` + canvas capture | `<input type="file" accept="image/*" capture>` | **Loại trừ** — trên iOS Safari, OS luôn hiện cả bộ chọn thư viện cạnh camera bất kể `capture`, vi phạm trực tiếp ATT-01 [CITED: MDN `capture` attribute] |
| `canvas.toBlob()` | `ImageCapture.takePhoto()` | Độ phân giải cao hơn nhưng **chỉ chạy trên trình duyệt gốc Chromium** — Safari (mọi phiên bản iOS/iPadOS/macOS tính đến bản ổn định hiện tại) không hỗ trợ, và pilot của dự án chắc chắn có thiết bị iOS. Canvas là lựa chọn duy nhất chạy được trên cả hai nền tảng [CITED: MDN ImageCapture, testmuai.com browser support] |
| Hàm SQL haversine thuần | PostGIS (`ST_DistanceSphere`) | PostGIS thắng về hiệu năng khi có **chỉ mục không gian trên tập dữ liệu lớn**; ở quy mô so một toạ độ với vài `work_sites` mỗi lần chấm công (không phải quét không gian), lợi ích không bù được chi phí bật một extension mới mà dự án chưa từng dùng [CITED: nhiều nguồn web cross-checked, xem Sources] |
| Broker Route Handler (`.download()` + stream) | `createSignedUrl()` trả thẳng cho client | Xem phát hiện trọng yếu §"Supabase Storage" — signed URL không tái kiểm theo từng lần tải, không tự thoả tiêu chí 4 |

**Installation:**
```bash
npm install browser-image-compression
```

**Version verification:** `npm view browser-image-compression version` → `2.0.2`, phát hành lần
cuối 2023-03-06 [VERIFIED: npm registry]. Gói không cập nhật 3 năm nhưng vẫn là gói được dùng
rộng rãi nhất cho tác vụ này (1.43M tải/tuần) và API bề mặt (`imageCompression(file, options)`)
đủ ổn định, không phụ thuộc hành vi trình duyệt mới nào.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `browser-image-compression` | npm | phát hành lần đầu nhiều năm trước, bản mới nhất 2023-03-06 | 1,431,223/tuần | `github.com/Donaldcwl/browser-image-compression` | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*`browser-image-compression` được phát hiện qua WebSearch (không phải tài liệu chính thức) nên
vẫn mang thẻ `[ASSUMED]` cho nguồn gốc tên gói dù cổng package-legitimacy trả `OK` — planner nên
xác nhận lại bằng một lần `npm install` thật + kiểm tra kích thước bundle trước khi coi là khoá.*

## Architecture Patterns

### System Architecture Diagram

```
Employee (mobile browser)
  │
  │ 1. Tap "Vào ca"/"Tan ca" → mở Sheet toàn màn hình
  ▼
Camera Sheet (Client Component, "use client")
  │  getUserMedia({video:{facingMode:{ideal:"environment"}}})
  │  → viewfinder <video> → tap chụp → canvas.drawImage → canvas.toBlob()
  │  → stop mọi track (đèn camera tắt)
  │  → browser-image-compression(blob, {maxSizeMB:1, maxWidthOrHeight:1600})
  │  navigator.geolocation.getCurrentPosition({enableHighAccuracy:true, timeout:15000, maximumAge:0})
  │  → {latitude, longitude, accuracy}
  ▼
  2. Tap "Gửi chấm công" → gọi Server Action checkIn()/checkOut() với (photo: File, coords)
  ▼
Server Action (mutations/attendance.ts) — "use server"
  │  getSessionContext() → companyId, employeeId, role (không tin bất kỳ tham số nào từ client)
  │  supabase.rpc("tf_server_now") → dấu thời gian DUY NHẤT được dùng (ATT-06)
  │  Đọc work_sites đang active của companyId
  │  supabase.rpc("tf_distance_meters", {...}) cho từng work_site → chọn khoảng cách NHỎ NHẤT
  │  So khoảng cách với radius_meters × ngưỡng (D-21, mặc định 5) → is_suspicious (tính, không lưu cứng)
  │  supabase.storage.from("attendance-photos").upload(`${companyId}/${employeeId}/${recordId}-${kind}.jpg`, buffer)
  │  insert/update attendance_photos (kind, storage_path, captured_at=tf_server_now(), latitude, longitude,
  │    accuracy_meters, work_site_id, distance_meters)
  │  Ba lý do từ chối (D-20b): thiếu ảnh / ngoài ca / mất mạng → throw Error, KHÔNG chặn theo khoảng cách
  │  logMutation(...) — audit_log nguyên dòng (D-17/D-18)
  ▼
Postgres (Supabase) — attendance_records, attendance_photos, work_sites, storage.objects
  │  RLS: <bảng>_<lệnh>_member (đã có từ Phase 1) + storage.objects policy mới (company_id qua path)
  ▼
Admin (desktop browser) — mở bản ghi bất kỳ để xem lại
  │  GET /api/attendance-photos/[photoId]  (Route Handler GET-only, D-12c)
  │  → getSessionContext() → so company_id của photo với session — KHÔNG dùng tham số URL để định phạm vi
  │  → supabase.storage.from("attendance-photos").download(path)  [KHÔNG bao giờ createSignedUrl() trả cho client]
  │  → NextResponse(blob, {headers:{content-type, cache-control:"private, no-store"}})
  ▼
<img src="/api/attendance-photos/[photoId]"> trong Dialog xem lại — mọi request qua route này đều
tái kiểm quyền, không có "liên kết" nào có thể bị sao chép và dùng lại ở doanh nghiệp khác.
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── data/
│   │   ├── mutations/
│   │   │   └── attendance.ts        # SỬA: checkIn/checkOut nhận thêm photo+coords, bỏ date/time
│   │   ├── work-sites.ts            # MỚI: đọc phía client (fetchJson tới GET /api/work-sites)
│   │   └── mutations/work-sites.ts  # MỚI: createWorkSite/updateWorkSite (Server Action)
│   ├── storage/
│   │   └── attendance-photos.ts     # MỚI: đường dẫn chuẩn hoá, hằng số bucket, MIME cho phép
│   └── validation/api/
│       ├── attendance.ts            # SỬA: thêm schema toạ độ + ảnh
│       └── work-sites.ts            # MỚI
├── app/
│   ├── api/
│   │   ├── work-sites/route.ts              # GET-only (D-12c)
│   │   └── attendance-photos/[id]/route.ts  # GET-only, broker — KHÔNG trả JSON chứa URL, trả byte ảnh
│   ├── admin/
│   │   ├── work-sites/                      # MỚI, khuôn ShiftsView
│   │   └── attendance/review/               # MỚI, danh sách "cần xem lại"
│   └── employee/
│       └── (camera Sheet gắn vào employee-home-view.tsx hiện có)
└── components/
    ├── employee-app/
    │   └── camera-sheet.tsx          # MỚI — state machine: idle→requesting→streaming→captured→submitting→error
    └── work-sites/
        ├── work-site-card.tsx        # MỚI, khuôn ShiftCard
        └── work-site-dialog.tsx      # MỚI, khuôn ShiftDialog

supabase/migrations/
└── 0011_attendance_evidence.sql     # MỚI — xem "Schema Gap" bên dưới; KHÔNG được bỏ qua bước này
```

### Pattern 1: `getUserMedia()` với ràng buộc camera sau, xử lý đủ 4 lỗi

**What:** Yêu cầu camera sau bằng `facingMode`, xử lý từng loại lỗi riêng biệt thay vì một
thông báo "có lỗi xảy ra" chung chung.

**When to use:** Mở Camera Sheet, ngay khi component gắn vào DOM (không gọi trong `useEffect`
không cleanup — phải dừng track khi đóng Sheet).

```typescript
// Source: MDN MediaDevices.getUserMedia(), cross-checked qua nhiều bài viết độc lập (CITED)
async function openCamera(): Promise<MediaStream> {
  // "ideal" (không phải "exact") — nếu thiết bị chỉ có một camera (hiếm nhưng có),
  // "exact" sẽ ném OverconstrainedError ngay cả khi camera đó dùng được.
  const constraints: MediaStreamConstraints = {
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
    audio: false,
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (cause) {
    if (!(cause instanceof DOMException)) throw cause;
    switch (cause.name) {
      case "NotAllowedError":
        // Người dùng từ chối quyền, hoặc trang không chạy trong secure context (HTTP).
        throw new CameraPermissionDeniedError();
      case "NotFoundError":
      case "OverconstrainedError":
        // Không có camera nào khớp — KHÔNG có lối thoát trong phạm vi phase này (xem UI-SPEC,
        // hàng "No-camera-device" — chưa giải quyết, cần xác nhận ở plan time).
        throw new NoCameraDeviceError();
      case "NotReadableError":
        // Camera đang bị app khác giữ (hiếm, backstop theo UI-SPEC).
        throw new CameraInUseError();
      default:
        throw cause;
    }
  }
}

// Tắt đèn camera thật sự — phải dừng TỪNG track, không chỉ bỏ tham chiếu stream.
function closeCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
```

Ghi chú thêm [CITED: MDN, addpipe.com]: `NotAllowedError` cũng là lỗi ném ra khi trang chạy
trong **insecure context** (HTTP, không phải HTTPS/localhost) — vì dự án dùng Vercel/HTTPS ở
production và `localhost` được trình duyệt coi là secure context, việc này thường không phát
sinh, nhưng nếu QA thử qua một IP LAN không phải `localhost` (ví dụ `192.168.x.x` để test trên
điện thoại thật), `getUserMedia()` sẽ thất bại với `NotAllowedError` dù người dùng chưa từng được
hỏi quyền — dễ nhầm là bug quyền trong khi là do giao thức. Ghi lại làm cảnh báo cho việc QA thủ
công trên thiết bị thật.

### Pattern 2: Chụp khung hình → Blob bằng canvas (không dùng ImageCapture)

```typescript
// Source: MDN "Taking still photos with getUserMedia()" (CITED)
function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không tạo được canvas.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không chụp được ảnh."))),
      "image/jpeg",
      0.9,
    );
  });
}
```

Blob này **không mang EXIF** — không cần bước tách EXIF riêng cho ảnh chụp trực tiếp qua luồng
này (khác với ảnh người dùng chọn từ thư viện, vốn có thể mang EXIF GPS từ app camera hệ thống —
nhưng ATT-01 đã loại trừ hoàn toàn đường đó).

### Pattern 3: Geolocation với timeout phù hợp môi trường trong nhà

```typescript
// Source: MDN Geolocation.getCurrentPosition(), khuyến nghị timeout điều chỉnh theo
// khoảng trống SUMMARY.md đã nêu (độ chính xác GPS trong nhà xưởng thật) — CITED cho API,
// [ASSUMED] cho con số 15000ms cụ thể (chưa đo thực địa, xem Open Questions)
function acquireLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000, // Cold GPS fix trong nhà có thể mất 10-20s; 5s (mặc định phổ biến
                        // trong ví dụ tài liệu) gây thất bại giả trên chính kịch bản D-20 lo ngại.
      maximumAge: 0,    // Không dùng vị trí cache — mỗi lần chấm công phải là một phép đo mới.
    });
  });
}
```

`position.coords.accuracy` là bán kính (mét) của vòng tròn tin cậy 95% quanh toạ độ trả về — một
giá trị `accuracy` là 50 nghĩa là vị trí thật có thể lệch tới 50m theo bất kỳ hướng nào [CITED:
MDN GeolocationCoordinates.accuracy]. **Khuyến nghị lưu `accuracy` cùng `latitude`/`longitude`**
(xem Schema Gap) — nếu không, người quản trị xem "cách xa 620m" trong danh sách cần xem lại không
có cách nào phân biệt "GPS đo sai" với "thực sự đứng cách xa 620m", đúng chính rủi ro mà D-20
dùng làm lý do đổi từ chặn cứng sang ghi nhận.

### Pattern 4: Hàm khoảng cách haversine bằng SQL thuần (không PostGIS)

```sql
-- Source: công thức haversine chuẩn, cross-checked qua nhiều bài viết độc lập (CITED).
-- Đặt cùng họ với tf_server_now()/tf_local_instant() (migration 0010) để giữ MỘT quy ước
-- "mọi phép tính thời gian/không gian đi qua RPC, không tự viết lại ở tầng ứng dụng".
create function public.tf_distance_meters(
  p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric
)
returns numeric
language sql
immutable
as $$
  select 6371000 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(p_lat1)) * cos(radians(p_lat2)) * cos(radians(p_lng2) - radians(p_lng1))
      + sin(radians(p_lat1)) * sin(radians(p_lat2))
    ))
  );
$$;
```

`least(1.0, greatest(-1.0, ...))` là bước bắt buộc: sai số dấu phẩy động có thể đẩy giá trị vào
`acos()` ra ngoài `[-1, 1]` khi hai toạ độ gần như trùng nhau (khoảng cách ~0m, chính là trường
hợp phổ biến nhất — nhân viên đứng đúng tại điểm làm việc), khiến `acos()` trả về `NaN` thay vì
`0`. Bỏ qua bước này là lỗi âm thầm chỉ lộ ra khi khoảng cách rất nhỏ, tức là đúng lúc hệ thống
hoạt động đúng nhất.

### Pattern 5: Broker Route Handler cho ảnh — KHÔNG bao giờ trả signed URL cho client

```typescript
// src/app/api/attendance-photos/[id]/route.ts — Source: kết hợp yêu cầu D-12c (GET-only,
// đã có cổng cơ học src/__tests__/route-handlers-get-only.test.ts) với phát hiện trọng yếu
// về hành vi signed URL bên dưới. [VERIFIED: src/__tests__/lib/route-handler-check.ts:13-15]
// — cổng chỉ chấp nhận `export function GET`/`export const GET`, không có export nào khác.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { companyId, role } = await getSessionContext();
  const { id } = await params;

  const supabase = await createServerSupabase();
  const { data: photo } = await supabase
    .from("attendance_photos")
    .select("storage_path, company_id")
    .eq("id", id)
    .eq("company_id", companyId) // KHÔNG dựa duy nhất vào RLS — kiểm tường minh ở đây (D-12b khuôn cũ)
    .maybeSingle();

  if (!photo) return new Response("Không tìm thấy.", { status: 404 });
  requireRole(role, ["owner", "admin"]); // ATT-04: chỉ quản trị xem lại

  const { data: blob, error } = await supabase.storage
    .from("attendance-photos")
    .download(photo.storage_path); // .download(), KHÔNG PHẢI .createSignedUrl()
  if (error || !blob) return new Response("Không tải được ảnh.", { status: 502 });

  return new Response(blob, {
    headers: {
      "content-type": blob.type || "image/jpeg",
      "cache-control": "private, no-store", // không cho trình duyệt/CDN cache lại
    },
  });
}
```

## Schema Gap — điều CONTEXT.md yêu cầu xác minh cụ thể

`work_sites` và `attendance_photos` **đã tồn tại** từ Phase 1
[VERIFIED: supabase/migrations/0005_v2_tables.sql:23-55]:

```sql
create table work_sites (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  name text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  radius_meters int not null check (radius_meters > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table attendance_photos (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies (id) on delete cascade,
  attendance_record_id text not null references attendance_records (id) on delete cascade,
  kind text not null check (kind in ('check_in', 'check_out')),
  storage_path text not null,
  captured_at timestamptz not null,
  latitude numeric(9, 6) null,
  longitude numeric(9, 6) null,
  review_status photo_review_status not null default 'pending',
  reviewed_by uuid null references auth.users (id),
  reviewed_at timestamptz null,
  unique (attendance_record_id, kind),
  check (storage_path like company_id || '/%')
);
```

**Kết luận sau khi đọc trực tiếp: hai bảng này KHÔNG ĐỦ cột cho D-20/D-21/ATT-02/ATT-07.**
Cụ thể thiếu:

1. **`distance_meters`** — ATT-02 yêu cầu "server tính khoảng cách tới điểm làm việc **và ghi
   lại kết quả cùng bản ghi**". Không có cột nào lưu con số này ở cả `attendance_photos` lẫn
   `attendance_records` [VERIFIED: supabase/migrations/0004_core_entities.sql:90-110 — không có
   cột `distance`/`location`-số nào ngoài `location text` (địa chỉ hiển thị, không phải toạ độ)].
2. **`accuracy_meters`** — không có cột lưu `position.coords.accuracy`. Không lưu accuracy nghĩa
   là chính lý do D-20 đưa ra ("GPS trong nhà xưởng sai 20–50m") không thể được đối chiếu lại sau
   này khi quản trị xem danh sách "cần xem lại".
3. **`work_site_id`** (tham chiếu điểm làm việc nào được dùng làm mốc) — không có, nên không thể
   trả lời "khoảng cách này tính so với điểm nào" một cách ổn định nếu công ty sau này thêm điểm
   làm việc mới ở gần hơn.

**Khuyến nghị:** thêm một migration mới (`0011_attendance_evidence.sql`), KHÔNG sửa lại
`0005_v2_tables.sql` đã áp dụng:

```sql
alter table attendance_photos
  add column accuracy_meters numeric(7, 2) null,
  add column work_site_id text null references work_sites (id) on delete set null,
  add column distance_meters numeric(10, 2) null;

create index attendance_photos_work_site_id_idx on attendance_photos (work_site_id);
```

Khuyến nghị **không** thêm một cột boolean `is_suspicious` cứng: tính "cách tâm quá xa" tại thời
điểm truy vấn danh sách "cần xem lại" (so `distance_meters` với `radius_meters` của
`work_site_id` × ngưỡng hiện hành), để khi Phase 4 đổi ngưỡng từ hằng số sang cấu hình doanh
nghiệp (D-21a), danh sách tự cập nhật mà không cần chạy lại một lượt ghi đè hàng loạt lên dữ liệu
lịch sử.

`review_status` (`pending`/`approved`/`rejected`) **đã đủ dùng nguyên trạng** cho hành động
"Đánh dấu đã xem xét" của quản trị (UI-SPEC) — đây là trạng thái xem xét thủ công, khác với cờ
"cách xa" tính tự động ở trên; không cần đổi enum này.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Nén ảnh trước khi tải lên | Tự viết canvas resize + quality loop | `browser-image-compression` | Đã xử lý sẵn worker thread (không đứng hình UI khi nén ảnh lớn), EXIF orientation, và có 1.4M lượt tải/tuần đã kiểm chứng qua nhiều trình duyệt |
| Phát hành liên kết ảnh có kiểm soát doanh nghiệp | Tự nghĩ một cơ chế token riêng | Broker Route Handler dùng `getSessionContext()` (đã có từ Phase 2) + `.storage.from().download()` | Không phát minh một lớp bảo mật thứ hai song song với RLS/session đã có — chỉ tái dùng đúng điểm kiểm danh tính duy nhất |
| Tính khoảng cách hai điểm trên mặt cầu | Tự suy công thức hoặc dùng xấp xỉ Euclid (Pythagoras trên độ kinh/vĩ) | Hàm SQL haversine chuẩn (Pattern 4) | Xấp xỉ Euclid trên độ kinh/vĩ sai lệch càng lớn càng xa xích đạo và khi khoảng cách lớn — sai ngay từ vài trăm mét đã đáng kể ở vĩ độ Việt Nam (~10-21°N) |
| Phát hiện gian lận vị trí | Tự dựng logic phát hiện giả lập GPS (mock-location flag) | Không làm ở phase này — đã được `PITFALLS.md` Pitfall 14 xác định là ngoài khả năng của web (không có API lộ ra cho trang web), và D-21b đã chỉ định lớp cách-tâm-quá-xa là lớp phát hiện chính thay thế | Web Geolocation API không có tín hiệu chống giả lập nào lộ ra cho JavaScript — đầu tư vào đây là lãng phí, đúng như milestone research đã cảnh báo |

**Key insight:** phần lớn "vấn đề khó" của phase này đã có nghiệm sẵn trong chính codebase
(`tf_server_now`, `getSessionContext`, khuôn Route Handler/Server Action) — rủi ro thật sự là
*quên áp dụng lại đúng những nghiệm đó* cho hai luồng mới (camera, Storage), không phải thiếu
công cụ.

## Common Pitfalls

### Pitfall 1: `<input capture>` tưởng đủ nhưng không đủ trên iOS

**What goes wrong:** Một lập trình viên quen tay dùng `<input type="file" accept="image/*"
capture>` vì nó đơn giản hơn nhiều so với `getUserMedia()`, và trên Android nó có vẻ hoạt động
đúng (mở thẳng app camera).

**Why it happens:** Hành vi này **khác nhau giữa hai hệ điều hành**: trên Android, thêm
`capture` khiến trình duyệt ưu tiên mở app camera thay vì bộ chọn ảnh; nhưng trên iOS Safari, hệ
điều hành **luôn** hiện cả bộ chọn thư viện ảnh cạnh camera **bất kể** thuộc tính `capture` có
mặt hay không [CITED: MDN `capture` attribute]. Test trên máy Android của lập trình viên sẽ
"trông như đạt" ATT-01 trong khi iPhone của nhân viên thật thì không.

**How to avoid:** Dùng `getUserMedia()` (Pattern 1) — không có đường vòng nào trên bất kỳ nền
tảng nào. Không coi `<input capture>` là "đơn giản hơn, cứ dùng tạm".

**Warning signs:** Bất kỳ đâu trong code xuất hiện `<input type="file" accept="image/*"
capture`> trong luồng chấm công.

**Phase to address:** Phase 3, ngay từ thiết kế Camera Sheet.

---

### Pitfall 2: Signed URL bị coi là "đã tự hết hạn nên an toàn"

**What goes wrong:** Team dựng luồng: Server Action tạo `createSignedUrl()` với TTL 5 phút, trả
URL đó trong JSON response, client gán vào `<img src>`. Test thủ công "trông như đạt" tiêu chí 4
vì không ai thực sự thử sao chép URL đó sang một phiên đăng nhập khác trước khi hết hạn.

**Why it happens:** Trực giác thường gặp là "URL ký + TTL ngắn = an toàn tương đương RLS". Thực
tế, theo chính thảo luận chính thức của Supabase: **"Signed URLs remain valid until their expiry
time regardless of any Auth key changes"** — tức là bất kỳ ai (đúng doanh nghiệp hay không) cầm
được URL đó trong cửa sổ TTL đều tải được ảnh, vì không có bước tái kiểm quyền nào xảy ra ở lần
tải — quyền chỉ được kiểm **một lần, tại thời điểm ký** [VERIFIED: WebSearch → GitHub Discussion
chính thức của Supabase, xem Sources]. TTL ngắn giảm **cửa sổ thời gian** rò rỉ, nhưng không xoá
bỏ khả năng rò rỉ — và tiêu chí 4 của ROADMAP viết rất chặt: "**cầm đúng liên kết** vẫn không xem
được", nghĩa là ngay cả trong cửa sổ TTL, việc "cầm đúng liên kết" (ví dụ URL bị dán vào một tin
nhắn nội bộ, log, hay DevTools Network tab rồi chuyển tay) không được phép thành công.

**How to avoid:** Không dùng `createSignedUrl()` cho luồng phát ảnh cho client. Dùng kiến trúc
broker (Pattern 5): Route Handler GET tự kiểm `company_id` **trên mỗi lần gọi**, tải byte ảnh
bằng `.download()` ở phía server, trả thẳng byte đó — không có "liên kết" (bearer token) nào tồn
tại độc lập với phiên đăng nhập để có thể bị sao chép và dùng lại.

**Warning signs:** Bất kỳ response JSON nào của API chứa một trường `url`/`signedUrl` trỏ tới
`*.supabase.co/storage/v1/object/sign/...`.

**Phase to address:** Phase 3 — đây là phase đầu tiên và duy nhất phát ảnh cho quản trị xem, nên
không có "phase sau sửa lại" nếu bỏ sót ở đây; kiểu rò rỉ này im lặng vì demo tay vẫn "trông như
đạt".

---

### Pitfall 3: pgTAP không kiểm được policy trên `storage.objects` với hạ tầng test hiện có

**What goes wrong:** Viết policy RLS mới trên `storage.objects` (theo mẫu `tf_is_member` đã dùng
cho mọi bảng khác), rồi cố viết pgTAP test cho nó trong `supabase/tests/` như mọi bảng khác, kỳ
vọng `npm run test:db` xanh.

**Why it happens:** `npm run test:db`/`test:rls` chạy trên một **Postgres tạm thuần**, không phải
một stack Supabase đầy đủ [VERIFIED: scripts/db.mjs:136-137 — "Trên Postgres tạm của CI... chỉ là
bảng tương thích do `0001_supabase_compat.sql` tạo, không có GoTrue nào đọc nó"]. Đọc trực tiếp
`0001_supabase_compat.sql` xác nhận file này **chỉ** dựng bảng tương thích cho `auth.users`, không
hề dựng schema `storage` (không có `storage.objects`, không có `storage.buckets`)
[VERIFIED: supabase/migrations/0001_supabase_compat.sql — không có kết quả khớp `storage` trong
toàn file]. Nghĩa là bất kỳ file pgTAP nào `select * from storage.objects` sẽ báo lỗi "relation
does not exist" trên chính hạ tầng test mà `check:assertions` dùng để đếm — không phải vì policy
sai, mà vì bảng đó không tồn tại ở môi trường đó.

**How to avoid:** Không đặt mục tiêu pgTAP-hoá policy `storage.objects` trong phase này. Coi
policy đó là lớp phòng thủ **thứ hai** (RLS trên `storage.objects`), trong khi lớp phòng thủ
**chính** là kiểm tra `company_id` tường minh trong chính broker Route Handler (Pattern 5) — lớp
đó là code TypeScript bình thường, kiểm được đầy đủ bằng Vitest + một Postgres thật (dev/staging)
không cần schema `storage` giả lập. Các cột MỚI thêm vào `attendance_photos`/`work_sites` (bảng
`public` bình thường) vẫn kiểm bằng pgTAP như mọi bảng khác — chỉ riêng `storage.objects` là
ngoại lệ.

**Warning signs:** File pgTAP mới tham chiếu `storage.objects`/`storage.buckets` và
`npm run test:db` báo lỗi "relation ... does not exist" thay vì lỗi assertion thật.

**Phase to address:** Phase 3 — cần quyết định tường minh ở bước lập kế hoạch, không phát hiện
giữa chừng lúc thực thi.

---

### Pitfall 4: `canCheckInRemotely` — một trường V1 đã có, chưa ai nối với D-20/D-21

**What goes wrong:** `Employee.canCheckInRemotely` là một trường **đã tồn tại từ V1**
[VERIFIED: src/lib/types/domain.ts:136] và đã hiển thị trên UI hiện tại: "Bạn được phép chấm công
ngoài địa điểm làm việc." [VERIFIED: src/components/employee-app/attendance-status-card.tsx:192-194].
Nếu Phase 3 triển khai D-21 (gắn cờ đáng ngờ khi cách tâm work_site quá xa) mà không xét trường
này, MỌI lần chấm công của một nhân viên hợp lệ được phép làm việc từ xa sẽ **luôn** rơi vào danh
sách "cần xem lại" — biến một danh sách vốn để bắt gian lận thành một danh sách toàn nhiễu, làm
quản trị mất niềm tin và bỏ qua nó (đúng loại rủi ro D-21b cảnh báo: "một luật không bao giờ đúng
thì tệ hơn không có luật").

**Why it happens:** CONTEXT.md's D-20/D-21 được viết trước khi đối chiếu lại với trường V1 này —
`canCheckInRemotely` không nằm trong bốn quyết định D-20…D-23, và cũng không nằm trong "Claude's
Discretion" liệt kê. Đây là một khoảng trống thật sự giữa hành vi V1 sẵn có và thiết kế mới của
Phase 3.

**How to avoid:** Đưa quyết định này vào bước lập kế hoạch tường minh (xem Open Questions):
khuyến nghị — nhân viên có `canCheckInRemotely = true` vẫn được ghi `distance_meters` bình thường
(vẫn là bằng chứng hữu ích), nhưng **loại khỏi** điều kiện lọc danh sách "cần xem lại" (D-21) vì
với họ, khoảng cách xa là kỳ vọng bình thường chứ không phải bất thường.

**Warning signs:** Danh sách "cần xem lại" ở môi trường thử nghiệm bị áp đảo bởi đúng những nhân
viên đã được đánh dấu làm việc từ xa.

**Phase to address:** Phase 3 — phải quyết định trước khi viết truy vấn danh sách "cần xem lại",
không phải một điều chỉnh UI sau này.

---

### Pitfall 5: Server Action mặc định giới hạn 1MB — ảnh nén xong vẫn có thể vượt

**What goes wrong:** Next.js 15 Server Actions có giới hạn kích thước body **mặc định 1MB**, và
`next.config.ts` của dự án hiện **không** ghi đè giá trị này [VERIFIED:
E:/externalProjects/workforce-management/next.config.ts:1-11 — không có khối `experimental.serverActions`].
Một ảnh JPEG nén ở chất lượng vừa phải (0.8-0.9) từ camera điện thoại hiện đại, ngay cả sau khi
`browser-image-compression` giảm kích thước, có thể vẫn vượt 1MB tuỳ độ phân giải mục tiêu — lúc
đó Server Action ném lỗi kích thước, và vì D-23 cấm hàng đợi/retry tự động, người dùng thấy một
lỗi khó hiểu (không phải "mất mạng", không phải một trong ba lý do D-20b) ngay cả khi mạng và
camera đều hoạt động bình thường.

**Why it happens:** Giới hạn này là mặc định ẩn của framework, không liên quan gì tới các quyết
định D-20…D-23 — dễ bị bỏ sót vì không nằm trong luồng nghiệp vụ mà nằm trong cấu hình hạ tầng.

**How to avoid:** Hai việc cùng lúc: (1) đặt mục tiêu nén rõ ràng ở client (`maxSizeMB: 1` trong
`browser-image-compression`, thực tế thường ra ảnh nhỏ hơn nhiều nhờ giảm cả kích thước lẫn chất
lượng), và (2) vẫn nới giới hạn trong `next.config.ts` lên một mức có biên an toàn
(`experimental.serverActions.bodySizeLimit: "4mb"`) — không dựa vào đúng một trong hai biện pháp.

**Warning signs:** Lỗi "Body exceeded 1 MB limit" xuất hiện trong log server khi gửi ảnh có độ
phân giải cao trên thiết bị đời mới.

**Phase to address:** Phase 3 — nên là một dòng cấu hình được thêm cùng lúc với việc viết
`checkIn`/`checkOut` mới, không phải một bản vá phát hiện sau khi QA trên thiết bị thật.

## Testing

### Camera/Geolocation trong Vitest (jsdom)

`jsdom` không triển khai `navigator.mediaDevices`/`navigator.geolocation` — phải tự gán
(`Object.defineProperty`) trước khi test, không cần thư viện ngoài cho mức đơn giản của phase này:

```typescript
// Source: mẫu tổng hợp cross-checked từ nhiều bài viết độc lập (CITED)
beforeEach(() => {
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  });
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success) =>
        success({ coords: { latitude: 21.0285, longitude: 105.8542, accuracy: 12 } }),
      ),
    },
  });
});
```

Dùng cho: test state machine của Camera Sheet (idle→requesting→streaming→captured→submitting→
error) và test riêng từng nhánh lỗi (`NotAllowedError`, `NotFoundError`, `NotReadableError`,
`OverconstrainedError`) bằng cách cho `getUserMedia` mock reject với `DOMException` tương ứng.
Không cần Playwright cho mức test này.

### Tích hợp thật (Postgres/Storage) — không thể mock ở tầng đơn vị

- `tf_distance_meters()` và cột mới trên `attendance_photos`/`work_sites`: pgTAP trên Postgres
  tạm, **cùng khuôn** với mọi bảng `public` khác — không có ngoại lệ ở đây (khác `storage.objects`,
  xem Pitfall 3).
- Broker Route Handler (`/api/attendance-photos/[id]`): test tích hợp Vitest gọi thẳng handler
  đã export với một request giả lập, chạy trên một Postgres dev thật đã seed dữ liệu hai doanh
  nghiệp — khẳng định request từ session Ngọc Phát không tải được ảnh của Bình Minh (đối xứng với
  bài kiểm cô lập RLS đã có từ Phase 1).
- `checkIn`/`checkOut` mới: test tích hợp gọi trực tiếp hàm Server Action (import module, không
  qua HTTP) trên Postgres dev thật — xác nhận `distance_meters`/`accuracy_meters`/`work_site_id`
  được ghi đúng, và ba lý do từ chối (D-20b) ném đúng loại lỗi.

### `scripts/e2e-auth.mjs` — mở rộng được, nhưng CHỈ cho phần Route Handler GET

Server Action **không phải** một `route.ts` — nó được Next.js gọi qua giao thức RSC nội bộ
(`Next-Action` header + id hành động phụ thuộc bản build), không có cách thực tế nào để một script
shell gọi thẳng `checkIn()`/`checkOut()` qua HTTP giống cách `e2e-auth.mjs` hiện đang gọi các
route GET. **Khuyến nghị:** không cố mở rộng `e2e-auth.mjs` để "chấm công qua HTTP thật" theo
nghĩa đen; thay vào đó mở rộng nó (hoặc một script chị em) để kiểm phần **có thể** kiểm qua HTTP
thật — chính là broker Route Handler mới (`GET /api/attendance-photos/[id]`): đăng nhập bằng
cookie thật của một tài khoản Ngọc Phát, thử tải ảnh của Bình Minh, khẳng định 403/404 — đây mới
đúng là phần có nguy cơ rò rỉ xuyên doanh nghiệp cần bằng chứng qua HTTP thật, và nó nằm đúng
trong khả năng của khuôn `e2e-auth.mjs` hiện có.

Camera/GPS trên **thiết bị thật** vẫn nằm ngoài khả năng của mọi test tự động ở phase này — đây là
khoảng trống đã được `SUMMARY.md` nêu đích danh ("độ phủ thiết bị cho `getUserMedia()`") và vẫn
là một mục QA thủ công bắt buộc, không phải một khoảng trống có thể đóng bằng công cụ.

### `check:assertions` — sàn hiện tại và điều KHÔNG được làm

Sàn hiện tại là **191** [VERIFIED: STATE.md progress log 02-02 "184 assertions" + các plan sau —
xác nhận số chính xác tại thời điểm lập kế hoạch bằng `npm run check:assertions` trước khi thêm
test mới, vì con số này chỉ được TĂNG, không bao giờ được hạ (`scripts/check-pgtap-assertions.mjs`
tự chặn nếu tổng giảm dưới `MIN_ASSERTIONS`)]. Test pgTAP mới cho các cột thêm ở
`0011_attendance_evidence.sql` phải cộng thêm vào file test hiện có cho `attendance_photos`/
`work_sites` (hoặc một file mới được thêm vào `run-all.sql` qua `\ir`), không được tạo file đứng
độc lập ngoài `run-all.sql` — nếu không, `check-pgtap-assertions.mjs` sẽ không đếm được các
assertion đó (nó chỉ đếm theo đúng danh sách `\ir`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `ImageCapture.takePhoto()` cho ảnh độ phân giải cao | `canvas.drawImage()` + `toBlob()` | Không đổi gần đây — Safari (mọi nền tảng Apple) chưa từng hỗ trợ `ImageCapture` tính đến bản ổn định hiện tại | Với một pilot chắc chắn có thiết bị iOS, `ImageCapture` không phải một lựa chọn khả thi, không phải một lựa chọn "cũ hơn" — canvas là con đường duy nhất |
| Signed URL trả trực tiếp cho client (khuyến nghị của `STACK.md` — nghiên cứu milestone) | Broker Route Handler tự kiểm quyền mỗi lần tải | Phát hiện của nghiên cứu phase này | `STACK.md` (nghiên cứu ở mức milestone, trước khi có tiêu chí 4 cụ thể của ROADMAP) đề xuất signed URL như một giải pháp đủ dùng; đọc lại đúng ngữ nghĩa của tiêu chí 4 ("cầm đúng liên kết vẫn không xem được") cho thấy nó không đủ — Phase 3 cần đi xa hơn khuyến nghị milestone một bước |

**Deprecated/outdated:** không có mục nào trong phạm vi phase này bị coi là lỗi thời — đây là lần
đầu dự án chạm các API này.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Tên gói `browser-image-compression` — phát hiện qua WebSearch, không phải tài liệu chính thức | Standard Stack | Nếu tên gói bị nhầm/slopsquat, cài sai gói — đã giảm thiểu bằng cổng package-legitimacy trả `OK` + xác nhận `npm view` trực tiếp, nhưng vẫn nên `npm install` thật và đọc `package.json` của gói trước khi khoá vào PLAN |
| A2 | Timeout GPS 15 giây là con số phù hợp cho môi trường trong nhà xưởng Việt Nam thật | Pattern 3, Geolocation | Chưa đo thực địa — nếu 15s vẫn quá ngắn cho một số nhà xưởng, nhân viên gặp timeout thường xuyên; nếu quá dài, trải nghiệm chấm công chậm. UI-SPEC đã gắn cờ đúng con số này là "unresolved", nghiên cứu này chỉ đưa ra khuyến nghị có lý do, chưa phải xác nhận thực địa |
| A3 | Server Action (`"use server"`) nhận trực tiếp một `File` làm tham số khi gọi từ client (không qua `<form action>`) hoạt động đúng như hàm bất đồng bộ thông thường | Architecture Patterns | Đây là hành vi đã biết của Next.js App Router nhưng CHƯA được xác minh bằng cách chạy thật trong dự án này — nếu sai, cần đổi cách gọi (ví dụ đóng gói `FormData` tường minh) trước khi viết phần lớn còn lại của `checkIn`/`checkOut` mới; khuyến nghị xác nhận sớm bằng một task nhỏ độc lập đầu wave |
| A4 | `canCheckInRemotely` nên bị loại khỏi điều kiện lọc "cần xem lại" (D-21) thay vì vẫn tính vào | Pitfall 4 | Đây là một khuyến nghị kỹ thuật hợp lý nhưng là quyết định SẢN PHẨM chưa được chủ dự án xác nhận — nếu chủ dự án muốn vẫn xem lại cả nhân viên làm việc từ xa (ví dụ để phát hiện lạm dụng chính cờ này), khuyến nghị này cần đảo ngược trước khi lập kế hoạch chi tiết |

## Open Questions

1. **`canCheckInRemotely` có nên loại khỏi lọc "cần xem lại" (D-21) không?**
   - What we know: trường này đã tồn tại từ V1, hiển thị trên UI hiện tại, và nếu không xử lý sẽ
     làm nhiễu toàn bộ danh sách cần xem lại cho những nhân viên hợp lệ.
   - What's unclear: đây có phải điều chủ dự án đã ngầm định khi chốt D-20/D-21 hay chưa từng
     được cân nhắc.
   - Recommendation: nêu tường minh ở bước lập kế hoạch/thảo luận trước khi viết truy vấn danh
     sách "cần xem lại"; mặc định đề xuất — loại khỏi lọc.

2. **Timeout GPS 15 giây — con số cuối cùng?**
   - What we know: UI-SPEC đã để "unresolved" đúng mục này; nghiên cứu này khuyến nghị 15s dựa
     trên lý do "cold GPS fix trong nhà mất 10-20s", nhưng chưa đo trên văn phòng thật của khách
     hàng pilot.
   - What's unclear: hành vi chính xác trên các dòng máy Android tầm trung phổ biến ở Việt Nam.
   - Recommendation: khoá 15s làm giá trị khởi điểm ở PLAN, nhưng đặt nó thành một hằng số dễ
     chỉnh (không nhúng rải rác), và ghi lại thành một mục UAT thủ công cần đo tại văn phòng thật
     trước khi coi phase hoàn tất.

3. **Có nên hiển thị `accuracy_meters` trực tiếp cho nhân viên (không chỉ cho quản trị) không?**
   - What we know: CONTEXT.md để "cách hiển thị bản đồ (hoặc không hiển thị)" ở Claude's
     Discretion; UI-SPEC không đề cập `accuracy` ở màn hình nhân viên.
   - What's unclear: liệu hiển thị độ chính xác GPS cho nhân viên (ví dụ "vị trí có thể lệch tới
     ~40m") có giúp giảm hoang mang khi thấy cảnh báo "cách xa điểm làm việc" hay không, hay chỉ
     gây rối thêm.
   - Recommendation: để planner quyết theo đúng phạm vi "Claude's Discretion" đã trao; nghiêng về
     KHÔNG hiển thị ở màn hình nhân viên (giữ copy đơn giản đã khoá ở UI-SPEC), chỉ hiển thị ở
     màn hình quản trị nơi con số này có giá trị điều tra thực sự.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Supabase Storage (dự án Supabase hiện có) | ATT-05 | ✓ (cùng dự án Supabase đã dùng cho Auth/DB từ Phase 1-2) | — | — |
| `browser-image-compression` | Nén ảnh trước upload | ✗ (chưa cài) | 2.0.2 [VERIFIED: npm registry] | không có — cài mới, rủi ro thấp (gói thuần, không phụ thuộc native) |
| Docker / `supabase start` (stack local đầy đủ, có schema `storage`) | Test pgTAP cho `storage.objects` (nếu muốn làm đầy đủ) | không kiểm tra được từ phiên nghiên cứu này | — | Không cần — kiến trúc khuyến nghị (Pattern 5) đặt lớp kiểm chính ở Route Handler TypeScript, kiểm được bằng Vitest + Postgres dev thường, không cần schema `storage` giả lập |
| Camera vật lý trên thiết bị QA (Android + iOS thật) | ATT-01, kiểm thủ công bắt buộc | không kiểm tra được từ phiên nghiên cứu này | — | Không có fallback tự động — đây là khoảng trống đã nêu ở `SUMMARY.md`, chỉ đóng được bằng QA thiết bị thật |

**Missing dependencies with no fallback:** thiết bị camera thật cho QA thủ công (ATT-01) — không
phải một "dependency cài đặt được", mà là một bước kiểm thủ công bắt buộc trước khi coi phase
hoàn tất.

**Missing dependencies with fallback:** `browser-image-compression` (cài mới, không rủi ro);
Docker/`supabase start` cho test storage đầy đủ (có fallback kiến trúc, không bắt buộc).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: package.json:59] + pgTAP (qua `scripts/db.mjs test`/`testdb`) |
| Config file | `vitest.config.ts` (đã có từ Phase 2); `supabase/tests/run-all.sql` cho pgTAP |
| Quick run command | `npm test` (Vitest) |
| Full suite command | `npm test && npm run check:assertions && npm run typecheck && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| ATT-01 | Camera Sheet không có đường chọn ảnh thư viện; 4 nhánh lỗi `getUserMedia` xử lý riêng | unit (Vitest, mock `navigator.mediaDevices`) | `npx vitest run src/components/employee-app/__tests__/camera-sheet.test.tsx` | ❌ Wave 0 |
| ATT-02 | `checkIn`/`checkOut` ghi `distance_meters`/`accuracy_meters`/`work_site_id`; ngoài bán kính vẫn được nhận | integration (gọi thẳng module, Postgres dev thật) | `npx vitest run src/lib/data/mutations/__tests__/attendance.test.ts` | ❌ Wave 0 |
| ATT-03 | CRUD `work_sites`, soft-delete qua `is_active` | pgTAP + integration | `npm run test:db` | ❌ Wave 0 (file mới) |
| ATT-04 | Quản trị mở bất kỳ bản ghi nào xem ảnh + vị trí | integration (Route Handler broker) | `npx vitest run src/app/api/attendance-photos/__tests__/route.test.ts` | ❌ Wave 0 |
| ATT-05 | Ảnh riêng tư; doanh nghiệp khác cầm đúng liên kết vẫn không xem được | integration qua HTTP thật (mở rộng khuôn `e2e-auth.mjs`) | `npm run test:e2e -- <email> <matkhau>` (mở rộng script) | ❌ Wave 0 (mở rộng script) |
| ATT-06 | Dấu thời gian luôn là `tf_server_now()`, không nhận tham số client | pgTAP (đã có khuôn từ 02-08) + integration | `npm run test:db` | ✅ (mở rộng test hiện có) |
| ATT-07 | Cách tâm > 5× bán kính → xuất hiện đúng trong danh sách cần xem lại; `canCheckInRemotely` được loại trừ (nếu chốt theo khuyến nghị A4) | integration | `npx vitest run src/lib/data/__tests__/attendance-review.test.ts` | ❌ Wave 0 |
| ATT-08 | Ba lý do từ chối phân biệt được; cảnh báo ngoài bán kính không phải lỗi | unit (đã có khuôn copy từ UI-SPEC) | `npx vitest run` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (Vitest, nhanh, không chạm Postgres thật cho phần unit)
- **Per wave merge:** `npm run test:db && npm run check:assertions && npm run typecheck && npm run lint`
- **Phase gate:** Toàn bộ lệnh trên xanh, cộng một lượt QA thủ công camera+GPS trên thiết bị
  Android thật và iOS thật (không thể tự động hoá — xem Environment Availability)

### Wave 0 Gaps

- [ ] `supabase/migrations/0011_attendance_evidence.sql` — thêm `accuracy_meters`, `work_site_id`,
      `distance_meters`; `tf_distance_meters()`
- [ ] `supabase/tests/0X_attendance_evidence.sql` — pgTAP cho cột mới + `tf_distance_meters()`,
      thêm vào `run-all.sql` qua `\ir` (bắt buộc để `check:assertions` đếm được)
- [ ] Bucket Storage riêng tư `attendance-photos` + policy `storage.objects` (không pgTAP-hoá
      được, xem Pitfall 3 — kiểm bằng test tích hợp broker route thay thế)
- [ ] `src/lib/data/mutations/__tests__/attendance.test.ts` — test tích hợp cho `checkIn`/
      `checkOut` mới (ba lý do từ chối, khoảng cách, dấu thời gian)
- [ ] `src/app/api/attendance-photos/[id]/__tests__/route.test.ts` — test cô lập xuyên doanh
      nghiệp cho broker route
- [ ] `next.config.ts` — `experimental.serverActions.bodySizeLimit` (xem Pitfall 5)
- [ ] Mở rộng `scripts/e2e-auth.mjs` (hoặc script chị em) cho phần ATT-05 qua HTTP thật

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | không đổi trong phase này | `getSessionContext()` đã có từ Phase 2 |
| V3 Session Management | không đổi | cookie-bound `@supabase/ssr`, đã khoá từ Phase 2 |
| V4 Access Control | có, trọng yếu | Broker Route Handler tự kiểm `company_id` + `role` mỗi lần tải ảnh (Pattern 5) — KHÔNG dựa vào RLS/signed URL làm lớp duy nhất |
| V5 Input Validation | có | Zod cho toạ độ (`latitude`/`longitude` trong khoảng hợp lệ, khớp CHECK của `work_sites`), giới hạn MIME/kích thước file ở cả client (`accept="image/*"`) lẫn server (`allowed_mime_types` của bucket Storage — Storage tự chặn, không tin `Content-Type` client gửi) |
| V6 Cryptography | có, gián tiếp | Không tự ký/mã hoá gì thêm — tránh dùng `createSignedUrl()` (một dạng bearer token tự ký của Supabase) cho luồng đọc chính là quyết định giảm thiểu rủi ro V6/V4, không phải một khoảng trống cần vá bằng crypto tự viết |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Signed URL bị sao chép và dùng lại bởi tài khoản doanh nghiệp khác | Information Disclosure | Broker Route Handler (Pattern 5) — không phát hành bearer token nào ra ngoài server |
| Client giả mạo `distance_meters`/toạ độ gửi lên | Tampering | Server luôn tự tính lại bằng `tf_distance_meters()` từ toạ độ nhận được; không bao giờ nhận `distance_meters` như một trường input từ client |
| Client giả mạo dấu thời gian chấm công | Tampering | `tf_server_now()` — không tham số, không đường nào nhận giờ từ client (đã khoá từ D-19/Phase 2, chỉ mở rộng không sửa lại) |
| Upload file không phải ảnh giả dạng ảnh (né kiểm `accept="image/*"` phía client) | Tampering / DoS | `allowed_mime_types` ở cấu hình bucket Storage (server-side, không tin client) + `file_size_limit` của bucket |
| Ảnh của nhân viên/doanh nghiệp bị liệt kê qua đoán `storage_path` | Information Disclosure | `storage_path` dùng `uuid` của `attendance_photos.id` (không phải số thứ tự đoán được) làm phần cuối đường dẫn, cộng policy `storage.objects` theo tiền tố `company_id` làm lớp phòng thủ thứ hai |

## Sources

### Primary (HIGH confidence)

- [MediaDevices: getUserMedia() method - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — constraint object, error taxonomy
- [Geolocation: getCurrentPosition() method - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) — options, `coords.accuracy`
- [Taking still photos with getUserMedia() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Taking_still_photos) — canvas capture pattern
- [`capture` HTML attribute - MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) — hành vi khác biệt Android/iOS, xác nhận Pitfall 1
- [URLs from storage that don't expire — Supabase GitHub Discussion #7626](https://github.com/orgs/supabase/discussions/7626) — nguồn cho phát hiện trọng yếu về signed URL không tái kiểm theo lượt tải
- Codebase đọc trực tiếp phiên này: `supabase/migrations/0001_supabase_compat.sql`,
  `0004_core_entities.sql`, `0005_v2_tables.sql`, `0010_check_in_time_functions.sql`,
  `src/lib/auth/session-context.ts`, `src/lib/data/mutations/attendance.ts`,
  `src/lib/data/audit.ts`, `src/lib/today.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`,
  `src/__tests__/lib/route-handler-check.ts`, `scripts/db.mjs`, `scripts/e2e-auth.mjs`,
  `next.config.ts`, `src/lib/types/domain.ts`, `src/components/employee-app/attendance-status-card.tsx`,
  `eslint-rules/no-date-in-client.mjs`, `eslint.config.mjs`

### Secondary (MEDIUM confidence)

- [ImageCapture API: Browser Support - TestMu AI](https://www.testmuai.com/learning-hub/image-capture-api-browser-support/) — xác nhận Safari không hỗ trợ `ImageCapture`
- Haversine vs PostGIS: tổng hợp cross-checked từ Medium/dev.to/PostgreSQL mailing list (xem
  Standard Stack §Alternatives Considered)
- Vitest mock cho `navigator.mediaDevices`/`navigator.geolocation`: tổng hợp cross-checked từ
  nhiều repo GitHub công khai (`@eatsjobs/media-mock`, `get-user-media-mock`, `mock-geolocation`)
- EXIF stripping qua canvas re-encode: tổng hợp WebSearch, cross-checked nhiều nguồn độc lập cùng
  kết luận

### Tertiary (LOW confidence)

- `browser-image-compression` là tên gói/API cụ thể — phát hiện qua WebSearch, chưa đối chiếu tài
  liệu chính thức của gói (gói không có trang docs chính thức ngoài README trên GitHub); xác nhận
  tồn tại + phiên bản qua `npm view` trực tiếp (VERIFIED registry), nhưng vẫn giữ thẻ `[ASSUMED]`
  cho lựa chọn API theo đúng quy tắc provenance của package name

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — web platform APIs (camera/geo) đã HIGH confidence qua MDN; một gói npm
  duy nhất chưa xác nhận qua tài liệu chính thức
- Architecture: HIGH cho phần đọc trực tiếp codebase (schema gap, route-handler gate, Server
  Action body limit); MEDIUM cho khuyến nghị broker route (suy luận có căn cứ từ hành vi Supabase
  đã xác nhận, chưa triển khai thật trong dự án này để kiểm chứng thực nghiệm)
- Pitfalls: HIGH — phần lớn xác nhận trực tiếp bằng cách đọc file nguồn trong phiên này, không
  chỉ suy đoán

**Research date:** 2026-08-02
**Valid until:** 30 ngày cho phần API nền tảng trình duyệt (ổn định, ít đổi); 7 ngày cho phiên bản
gói npm cụ thể nếu việc lập kế hoạch bị trì hoãn lâu
