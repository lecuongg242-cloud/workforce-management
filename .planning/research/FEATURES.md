# Feature Research

**Domain:** Multi-tenant workforce attendance / time-tracking SaaS (Vietnam SMB market)
**Researched:** 2026-07-31
**Confidence:** MEDIUM (Vietnam labor-law figures cross-checked across multiple independent sources = MEDIUM; competitor feature claims from single web-search passes, unverified against vendor docs = LOW; synthesis and judgment calls = HIGH from direct product reasoning)

This research covers four V2 areas only, per milestone scope: (1) proof-of-presence check-in, (2) company settings, (3) request approval workflow, (4) super admin console. It assumes the V1 baseline already shipped (login, onboarding, employee/department/shift CRUD, dashboard, mobile check-in UI, attendance history, request *creation*) — see `.planning/PROJECT.md`.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a Vietnamese SMB owner or HR admin assumes exist. Missing these makes the product feel unfinished or untrustworthy for a *paid* pilot.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Photo-on-punch (live camera capture, no gallery picker) | Baseline anti-buddy-punching move shipped by every VN vendor (MISA AMIS, TanCa) and every international one (Homebase, Buddy Punch, Deputy). Already decided in PROJECT.md. | LOW–MEDIUM | Enforce via `capture="user"` on file input at minimum; true "no gallery pick" needs a custom camera UI since native `<input capture>` can still be bypassed on some browsers — flag as a phase-specific research item. |
| GPS geofence around a configured work location | Same — universal baseline (Deputy 100–1000m, Buddy Punch 50–1500m radius). Employers expect to define "where work happens." | MEDIUM | Requires haversine distance calc, per-location radius config, and handling GPS accuracy/permission-denied gracefully (see Anti-Features). |
| Admin review of check-in photo + location per record | HR/owners in VN routinely spot-check attendance manually; if the evidence isn't reviewable it isn't trustworthy. Already in PROJECT.md scope. | LOW | Just a detail view — photo + map pin + accuracy radius on the existing attendance record screen. |
| Configurable work hours per shift (start/end, grace period) | Every attendance product (JustLogin, greytHR, Dayforce, Paybooks) treats grace period as a first-class setting because "5 minutes late" policies vary by company culture. V1 already has shifts; this is the missing settings layer. | LOW–MEDIUM | Grace period industry norm is 5–15 minutes. Should be configurable per shift, with a sane company-wide default. |
| Public holiday calendar (VN statutory + company-added) | VN has a specific 2026 holiday set (New Year, Tet ~9 days, Hùng Kings, Reunification/Labor Day, National Day, new Culture Day Nov 24) that directly changes OT multiplier (300% vs 150%/200%) and whether attendance on that day even counts as OT. Getting this wrong on a real pilot means wrong pay data — the whole point of V2. | LOW–MEDIUM | CRUD list of holiday dates + names; must feed into the OT-rate calculation, not just be decorative. Vietnamese "compensatory weekday" pattern is a nuance worth a toggle/note, not full automation for V2. |
| Overtime rate rules by day-type (weekday 150% / weekly day-off 200% / holiday 300%) + night allowance (22:00–06:00, +30%) | This is Vietnam Labor Code, not a nice-to-have — every VN payroll-adjacent tool (Talentnet, MISA, Base) encodes it because it's legally mandated recordkeeping even before payroll is computed. V2 explicitly defers payroll (V3) but still needs correct OT *classification* so V3 isn't built on wrong data. | MEDIUM | V2 doesn't need to *pay* OT, just correctly *tag/compute hours* by type so a future payroll module (or manual export) is trustworthy. This is a strong argument for treating "OT rule configuration" as a settings feature now even without payroll. |
| OT hour caps (4h/day, 40h/month, 200h/year, 300h/year exempted sectors) | Legal compliance expectation — Vietnamese employers already track this manually in spreadsheets; a system that doesn't at least surface "over cap" is a downgrade from what they do today. | MEDIUM | Soft-warn on approval ("this exceeds the monthly OT cap"), don't hard-block — caps have legal exceptions the system can't fully model. |
| Role-based access (employee / manager / admin / super admin) | Already promised in PROJECT.md; standard SaaS expectation once you have RLS and multiple people touching the system. | MEDIUM–HIGH | Ties directly to Supabase RLS work — this is as much a data-model decision as a settings UI. |
| Member invitation flow (invite by email/phone, assign role) | Company onboarding already exists (V1); the missing piece is *adding people after day one* without a developer reseeding data. Every competitor (Deputy, Homebase, MISA) has "invite teammate." | LOW–MEDIUM | Needs an invite-accept flow tied to Supabase Auth; decide phone vs. email invite (VN SMBs skew toward phone/Zalo, but email is simpler for MVP — flag as open question). |
| Approve / reject with a required reason on reject | Universal HR software pattern (Cflow, Nintex, MiHCM) — a bare reject with no reason is a support/trust problem ("why was I denied?"). Already scoped in PROJECT.md. | LOW | Reason is free text; required only on reject, optional on approve. |
| Request → attendance data linkage (approved leave/OT actually changes the record) | This is the actual point of the approval workflow per PROJECT.md — "yêu cầu được duyệt tác động đúng vào dữ liệu công của kỳ." Every payroll-adjacent system in the research (multiple university/HR systems) confirms: approved requests must reconcile into the timesheet before a period closes, or payroll is wrong. | MEDIUM–HIGH | This is the highest-complexity item in the whole set — see Feature Dependencies below. Needs a clear state machine: request approved → attendance record(s) created/modified → marked as "adjusted by request #X" for traceability. |
| Audit history of who approved/rejected and when | Table stakes per HR software research ("immutable log of all leave transactions... satisfies regulatory audits") and explicitly requested in PROJECT.md. | LOW | Append-only log table; render as a timeline on the request detail view. |
| Notification to employee on request decision | Universal expectation — "automated notifications inform both employee and manager about status." Already scoped. | LOW–MEDIUM | In-app notification (bell icon / list) is sufficient for V2 pilot scale; push/SMS/Zalo is a differentiator, not table stakes, at 1-2 companies. |
| Super admin: list all tenants + drill into one company's status | Baseline of any multi-tenant operator console — "tenant provisioning/listing, per-tenant status view" is the minimum viable support tool. Explicitly scoped in PROJECT.md as "xem và quản lý toàn bộ doanh nghiệp." | MEDIUM | Cross-tenant queries necessarily bypass normal RLS scoping — needs its own carefully-audited access path (service role or a dedicated super-admin RLS policy), not a bolt-on to the regular admin UI. |

### Differentiators (Competitive Advantage)

Not required to look "finished," but this is where TimeFlow can beat both cheap VN attendance apps and generic international tools for its specific niche (VN SMB, shift-based, pilot-scale trust).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Physics-based GPS-spoof detection (accuracy jitter pattern, impossible-speed check) | Most VN competitors (MISA, TanCa) stop at "GPS + photo"; they don't visibly defend against the trivial free spoofing apps (Fake GPS Location, GPS Joystick) that are common knowledge. Layering a cheap physics check (real GPS accuracy is noisy 5–30m and fluctuates; spoofed GPS is often suspiciously clean/constant) costs little and is a genuine trust differentiator for owners worried about remote-working fraud. | LOW–MEDIUM | Can ship with almost no cost: read `coords.accuracy` from the Geolocation API, flag suspiciously perfect/static values, no native app or root-detection SDK needed (that requires native mobile, out of scope — see anti-features). This is the realistic version of "beyond photo + GPS" for a web app. |
| Root/mock-location Android flag surfacing | The dev.to/WappBlaster research shows real anti-fraud stacks check the Android "Allow mock locations" developer flag. A PWA/web app *cannot* read this directly (browser sandboxing), so this is a genuine web-app limitation — flag honestly as a known ceiling, not a roadmap item, unless a native wrapper is added later. | N/A (blocked by platform) | Document as a deliberate limitation in the requirements, not a silent gap — sets correct expectations with the business owner. |
| OT cap soft-warnings at approval time ("this pushes the employee over 40h/month") | Turns Vietnam Labor Code compliance from a background data model into a visible manager aid — no VN competitor prominently surfaces this at the point of approval; MISA/TanCa treat it as a report you check later. | LOW–MEDIUM | Pure UI/logic on top of the OT-rule settings already built for table stakes; high value, low incremental cost — a strong second-phase win. |
| Vietnamese-holiday-aware attendance classification (auto-tag a check-in that falls on a statutory holiday as 300%-tier before payroll exists) | Directly serves the stated Core Value ("đúng giờ, đúng nơi" data owners can trust). Competing international tools (Deputy, Homebase, Buddy Punch) have zero VN-holiday awareness out of the box — an actual gap the localized product can win on. | MEDIUM | Requires holiday calendar (table stakes) + shift/attendance calculation to consult it — natural second-phase feature once holidays exist. |
| Support/operator "look at exactly what this company sees" via audited impersonation | Standard for mature multi-tenant SaaS (WorkOS/Medium research: "support agent needs to see exactly what customer sees... complete audit trail") but most VN SMB tools skip it, forcing support to ask for screenshots over Zalo. Differentiates the *support experience* at pilot scale — literally what "super admin hỗ trợ khách hàng" in PROJECT.md is asking for. | MEDIUM–HIGH | Must be time-boxed, logged, and visibly bannered while active (an un-audited impersonation feature is a security liability, see anti-features and Pitfalls). Only worth building if pilot support load justifies it — otherwise a read-only "view tenant data" mode is enough for 1-2 companies. |
| Request timeline showing exact attendance-record diff (before/after the approval touched the data) | Goes one step past a generic audit log — shows the employee *and* the admin precisely which day's hours changed and why, closing the "why does my timesheet look different" support loop before it starts. | MEDIUM | Natural extension of the audit-history table-stakes item; render a small diff on the request detail page. |

### Anti-Features (Commonly Requested, Often Problematic)

Already partly pre-decided in PROJECT.md's "Out of Scope" — reinforced and extended here with the research rationale.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| QR-code check-in | Looks cheap and fast to build; common in cheap VN kiosk-style tools | A photographed/screenshotted QR code can be scanned from home — proves nothing about presence. Already correctly excluded in PROJECT.md. | Photo + GPS, as scoped. |
| Device-locking (one employee = one registered device) | Feels like an obvious anti-fraud lever | Creates a support burden (lost/broken/shared phones are common in VN SMB blue-collar/retail contexts) disproportionate to the fraud it actually prevents once photo+GPS exist. Already correctly excluded. | Photo + GPS + (differentiator) physics-based GPS jitter check covers the realistic fraud surface for a pilot. |
| Native biometric face-match / face recognition (TanCa/Deputy-style) | Seen in VN market leaders (TanCa AI camera kiosk, Deputy facial recognition) and feels like the "premium" anti-fraud tier | Needs a biometric ML pipeline, storage/consent handling for biometric data (heavier PDPA-style legal exposure in Vietnam than a plain photo), and hardware/kiosk assumptions that don't fit a 1-2 company web-first pilot. Already correctly excluded ("máy chấm công phần cứng, nhận diện khuôn mặt"). | Live photo + admin visual spot-check is sufficient trust for pilot scale; revisit face-match only if fraud is observed in practice. |
| Continuous real-time GPS tracking through the workday (Buddy Punch breadcrumb trail) | Some international tools offer it and it "sounds more thorough" | For office/shift-based VN SMB staff (not field service), continuous tracking is a privacy overreach that will alarm employees and likely violates reasonable expectations under VN labor practice for non-field roles — high cost, low relevant value versus the stated Core Value (accurate check-in/out, not surveillance). | GPS captured only at check-in/out (already scoped), matching Homebase's lighter-touch model rather than Buddy Punch's continuous tracking. |
| Full automatic legal enforcement of OT caps (hard-block requests over 200h/year) | Feels like "the system should just enforce the law" | VN OT caps have real legal exceptions (300h/year for exempted sectors, government-defined cases) the system cannot fully encode without becoming a legal-interpretation engine — a hard block will be wrong often enough to erode trust and force workarounds. | Soft warning at approval time (differentiator above), let the human admin make the compliance call — matches how VN HR admins already operate. |
| Multi-level/conditional approval chains (manager → HR → benefits specialist, per Nintex/Cflow "best practice") | Shows up in generic HR-software best-practice writeups as the gold standard | Massive overbuild for a 1-2 company pilot with (per PROJECT.md) a flat employee/manager/admin/super-admin role set — no evidence in the requirements of multi-step organizational approval needs yet. | Single-level approval (manager or admin approves/rejects) as already scoped; revisit only if a pilot customer's org chart demands it. |
| Full impersonation-as-login (support silently becomes the user with no trace) | Fastest way to build "see what the customer sees" | Security/compliance liability flagged directly in the research (OWASP multi-tenant cheat sheet, impersonation-risk articles): unaudited impersonation is a textbook cross-tenant breach vector, especially dangerous given this project's own stated open risk around the Supabase service-role key. | If built at all, must be time-boxed, fully audit-logged, and visibly bannered — or ship as read-only "view as" instead of true impersonation for V2. |
| Push/SMS/Zalo notifications for every request event | Feels "more complete" than in-app notifications and Zalo is the dominant VN messaging channel | Adds a third-party integration (Zalo OA API or SMS gateway) and real cost/complexity for a 1-2 company pilot where users are already in the app daily; PROJECT.md explicitly avoids adding new providers beyond Supabase. | In-app notification list (table stakes) for V2; note Zalo/SMS as a clearly-flagged V3+ differentiator once billing/scale is real. |

---

## Feature Dependencies

```
[Company settings: work hours + grace period]
    └──requires──> [Shift management] (V1, already done)

[Company settings: OT rate rules by day-type]
    └──requires──> [Public holiday calendar]  (day-type classification needs holiday dates)
    └──enables───> [OT cap soft-warning at approval] (differentiator)
    └──enables───> [Holiday-aware attendance classification] (differentiator)

[Public holiday calendar]
    └──requires──> [Company settings page] (same admin surface, same phase)

[Member invitation + role assignment]
    └──requires──> [Role-based access model / RLS] (platform-data-layer work, likely earlier phase per PROJECT.md's "Nền tảng dữ liệu thật")
    └──enables───> [Request approval routing] (need to know who is "the manager/admin" to notify/approve)

[Request approval workflow: approve/reject]
    └──requires──> [Member invitation + roles] (need a real approver identity, not mock data)
    └──requires──> [Request creation] (V1, already done)
    └──enables───> [Request → attendance data linkage] (only approved requests should mutate attendance)

[Request → attendance data linkage]
    └──requires──> [Request approval workflow]
    └──requires──> [Company settings: OT rules + holiday calendar] (so an approved OT/leave request is tagged with the correct rate/day-type when it writes into attendance)
    └──enables───> [Audit history / request timeline diff]

[Proof-of-presence check-in: photo + GPS]
    └──requires──> [Company settings: work location + geofence radius] (admin must configure the point/radius before employees can be geofenced)
    └──enables───> [Admin review of photo + location per record]
    └──enables───> [Physics-based GPS-spoof detection] (differentiator, layers on top of raw GPS capture)

[Super admin console: tenant list + drill-in]
    └──requires──> [Role-based access model] (super admin is a role tier above company admin)
    └──conflicts-with──> [Standard RLS company_id scoping] (super admin necessarily needs a bypass path — must be a deliberately separate, audited code path, not a leaky RLS policy)

[Super admin: audited impersonation / "view as"]
    └──requires──> [Super admin console: tenant list] 
    └──requires──> [Audit logging infrastructure] (shared with request audit history — same underlying pattern, worth building once and reusing)
```

### Dependency Notes

- **OT rate rules require the holiday calendar first:** classifying an hour as 150%/200%/300% depends on knowing whether the date is a weekday, weekly day-off, or statutory holiday — building rate rules before holidays exist means reworking the classification logic later. Sequence holidays before (or same-phase as) OT rules.
- **Request → attendance linkage requires both approval workflow AND settings:** this is the riskiest, highest-value item in the whole set. It cannot be built until (a) approve/reject exists, and (b) the OT/holiday rules exist to correctly tag what the approved request changes. Treat it as a phase that comes *after* both, not in parallel.
- **Member invitation requires the role model, and approval workflow requires member invitation:** you cannot have a real "manager approves employee's leave" flow on mock/seeded users — someone has to actually be invited and assigned the manager role first. This is a strict ordering constraint for roadmap phasing.
- **Super admin conflicts with (must not leak into) standard RLS:** this is a genuine architectural tension, not just a feature note — cross-tenant visibility for the super admin is the *one* legitimate reason to bypass `company_id` RLS in this codebase, so it needs its own reviewed access path (e.g., a dedicated Postgres role + explicit server-side checks), echoing the project's own "Rủi ro bảo mật đang mở" concern about the service-role key.
- **Physics-based GPS-spoof detection enhances but does not require photo/GPS to already be "proof-of-presence-complete":** it can be added incrementally after the base geofence+photo ships, as a follow-up hardening pass, without changing the check-in UX.

---

## MVP Definition

Given the milestone scope is already narrowly V2 (not a greenfield MVP), "Launch With" here means *the smallest correct version of each of the four in-scope areas* that satisfies PROJECT.md's Active requirements and success metric ("1-2 doanh nghiệp chạy thật trọn một kỳ công mà không phải sửa tay dữ liệu chấm công").

### Launch With (V2 core)

- [ ] Photo (live camera only) + GPS geofence check-in, checked against admin-configured work location/radius — the Core Value depends on this being real
- [ ] Admin can view photo + location per attendance record — trust requires reviewability, not just capture
- [ ] Admin can configure work location + geofence radius per company (minimum: one location; per-department/multi-site is a V2.x extension)
- [ ] Company settings: work hours, grace period, OT rate rules (150/200/300%), OT hour caps as soft warnings
- [ ] Public holiday calendar (VN 2026 statutory dates pre-seeded, admin can add/edit)
- [ ] Member invitation + role assignment (employee/manager/admin) — required to make approval workflow real, not mocked
- [ ] Request approve/reject with required reason on reject
- [ ] Approved request correctly writes/adjusts the underlying attendance record for that pay period
- [ ] Audit history (who approved/rejected, when, why) visible on each request
- [ ] In-app notification to employee when their request is decided
- [ ] Super admin: list of all companies + ability to view one company's data/status for support

### Add After Validation (V2.x, once the 1-2 pilot companies are live)

- [ ] Physics-based GPS-spoof detection (accuracy jitter / impossible-speed flag) — trigger: any observed or suspected spoofing incident during pilot
- [ ] Holiday-aware automatic attendance-record tagging (300% classification surfaced before payroll exists) — trigger: pilot company asks "how do I know which days were holiday OT"
- [ ] OT cap warning surfaced at approval time (not just in settings/reports) — trigger: pilot admin approves an over-cap OT request without noticing
- [ ] Multi-location / per-department geofence config — trigger: a pilot company has more than one work site
- [ ] Audited "view as" for super admin support — trigger: support requests from pilot companies become frequent enough that screenshot-based support is a bottleneck

### Future Consideration (V3+)

- [ ] Zalo/SMS notifications for request decisions — defer until billing/scale (V3, per PROJECT.md's deferred Stripe design) makes multi-channel notification cost-justified
- [ ] Native mobile wrapper to enable OS-level mock-location flag detection — defer until web-based physics checks prove insufficient in practice
- [ ] Face-recognition check-in — defer indefinitely per PROJECT.md's explicit exclusion; revisit only if photo+GPS proves insufficient at meaningfully larger scale
- [ ] Full payroll computation (gross-net, personal income tax, social insurance) — explicitly deferred to V3 in PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Photo + GPS geofence check-in | HIGH | MEDIUM | P1 |
| Admin photo/location review | HIGH | LOW | P1 |
| Work location + geofence radius setting | HIGH | LOW–MEDIUM | P1 |
| Work hours + grace period settings | MEDIUM | LOW | P1 |
| OT rate rules (150/200/300%) | HIGH | MEDIUM | P1 |
| Public holiday calendar | HIGH | LOW–MEDIUM | P1 |
| Member invitation + role assignment | HIGH | MEDIUM | P1 |
| Approve/reject with reason | HIGH | LOW | P1 |
| Request → attendance data linkage | HIGH | HIGH | P1 |
| Audit history of request decisions | MEDIUM | LOW | P1 |
| In-app notification on decision | MEDIUM | LOW–MEDIUM | P1 |
| Super admin tenant list + drill-in | MEDIUM | MEDIUM | P1 |
| OT cap soft-warning at approval | MEDIUM | LOW | P2 |
| Physics-based GPS-spoof detection | MEDIUM | LOW–MEDIUM | P2 |
| Holiday-aware auto-classification | MEDIUM | MEDIUM | P2 |
| Audited super-admin impersonation/"view as" | LOW–MEDIUM | MEDIUM–HIGH | P2 |
| Multi-location geofence config | LOW (at pilot scale) | MEDIUM | P3 |
| Zalo/SMS notifications | LOW (at pilot scale) | MEDIUM | P3 |
| Native mock-location flag detection | LOW (unproven need) | HIGH (needs native wrapper) | P3 |
| Face recognition check-in | LOW (explicitly excluded) | HIGH | P3 (do not build) |

**Priority key:**
- P1: Must have for the V2 pilot milestone
- P2: Should have, add once pilot is live and validated
- P3: Nice to have / explicitly deferred, revisit only if a concrete trigger occurs

---

## Competitor Feature Analysis

| Feature | MISA AMIS / TanCa (Vietnam) | Deputy / Buddy Punch / Homebase (International) | TimeFlow V2 Approach |
|---------|------------------------------|---------------------------------------------------|------------------------|
| Check-in verification | Fingerprint, card, face recognition, GPS — multi-mode, hardware-leaning (TanCa AI kiosk) | GPS geofence + photo-on-punch baseline; Deputy/Buddy Punch add real facial-recognition matching | Photo (live camera) + GPS geofence only — matches the lighter, web-first international baseline (Homebase-style), deliberately skips biometric/hardware per PROJECT.md |
| Geofence config | Present but not prominently documented as configurable radius | Configurable radius, 50–1500m depending on vendor | Configurable radius + location per company, single-location for V2 MVP |
| Anti-spoofing beyond GPS | Not clearly differentiated beyond "GPS + photo" | Not clearly differentiated beyond photo/biometric | Physics-based jitter/speed check as differentiator (P2) — a gap both VN and international competitors leave visible in this research |
| OT rate/holiday awareness | Embedded in payroll modules (MISA AMIS is part of a full accounting suite) | Largely absent — US/AU/UK-centric OT rules baked in, not VN-aware | VN-specific OT tiers (150/200/300%) + statutory holiday calendar built in from V2, ahead of payroll — direct localization advantage |
| Approval workflow | Present, embedded in broader HRM suite (multi-module, higher cost/complexity for an SMB) | Present, generic (not VN-labor-law-aware) | Single-level approve/reject with reason + attendance linkage, scoped to what a 1-2 company pilot actually needs, not a full HRM suite |
| Multi-tenant support console | Not applicable — most VN vendors are single-tenant per-customer deployments or SaaS without an exposed operator layer in public materials | Standard SaaS practice (tenant provisioning, admin APIs) per general multi-tenant SaaS research, though these tools are single-tenant-per-customer from the buyer's perspective (not itself a multi-tenant *platform-you-resell* pattern) | Built explicitly because TimeFlow itself is the multi-tenant platform operator — a genuine architectural differentiator vs. VN incumbents that don't need this layer |
| Pricing model context | Typically bundled in larger HRM/accounting suites (MISA) or per-seat SaaS (TanCa) | Per-seat SaaS, geofencing/photo often gated behind higher tiers (e.g., Buddy Punch, Deputy premium tiers) | Not yet priced (Stripe design deferred per PROJECT.md) — but worth noting for later that "photo+GPS is often a paid tier elsewhere" is a fact to inform future pricing, not a V2 feature decision |

---

## Sources

**Proof-of-presence / anti-fraud:**
- [Anti Fake-GPS: How Modern Attendance & Field Apps Block Mock Location (2026) — WappBlaster](https://wappblaster.com/blog/anti-fake-gps-tech-explained/) (LOW confidence — vendor blog, single source, cross-checked against general pattern only)
- [Liveness detection — Fraud.com](https://www.fraud.com/post/liveness-detection) (LOW)
- [Facial Liveness Detection — Mitek](https://www.miteksystems.com/blog/facial-liveness-detection) (LOW)
- [PeopleX Help Center — GPS spoofing apps](https://help.peoplex.ai/hc/en-us/articles/4416587381140-Is-it-possible-for-users-to-fake-their-attendance-using-GPS-spoofing-apps) (LOW)
- [How to Prevent GPS Spoofing on Mobile Time Clocks — Open Time Clock](https://www.opentimeclock.com/docs/blog1/january-2026/how-to-prevent-gps-spoofing-on-mobile-time-clocks-using-practical-steps.) (LOW)
- [Clock In/Out GPS Spoofing Detection and Audit Guide — DATABASICS](https://blog.data-basics.com/clock-in/out-gps-spoofing-detection-and-audit-guide-1) (LOW)

**Vietnam labor law:**
- [Vietnam Working Hours & Overtime Regulations — Playroll](https://www.playroll.com/working-hours/vietnam) (MEDIUM — figures consistent across multiple independent sources)
- [Overtime Pay Calculation Guide 2026 — Talentnet Vietnam](https://www.talentnetgroup.com/vn/featured-insights/hr-operations/overtime-pay-calculation-guide-vietnam) (MEDIUM)
- [Vietnam Overtime & Work Hour Rules for Employers — ASEAN Briefing](https://www.aseanbriefing.com/news/working-hours-and-overtime-regulations-in-vietnam-what-foreign-employers-must-know/) (MEDIUM)
- [Overtime Regulations and Compensation in Vietnam — Vietnam Briefing](https://www.vietnam-briefing.com/news/overtime-regulations-compensation-vietnam.html/) (MEDIUM)
- [Vietnam Expands Public Holiday List In 2026 — Vietcetera](https://vietcetera.com/en/vietnam-expands-public-holiday-list-in-2026) (MEDIUM)
- [2026 Vietnam Public Holiday Schedule — Vietnam Briefing](https://www.vietnam-briefing.com/news/2026-vietnam-public-holiday-schedule-tet-national-day-holidays.html/) (MEDIUM)
- [2026 Vietnam Public Holiday Calendar — NetViet HRS](https://netviet.com.vn/2026-vietnam-public-holidays-calendar/) (MEDIUM)

**Vietnamese competitor products:**
- [MISA AMIS — Tính năng chấm công GPS](https://amis.misa.vn/95758/tinh-nang-cham-cong-gps/) (LOW)
- [MISA AMIS — Top 10 app chấm công 2026](https://amis.misa.vn/114487/app-cham-cong-tren-dien-thoai/) (LOW)
- [TanCa — Phần mềm chấm công tính lương](https://tanca.io/blog/phan-mem-cham-cong-tinh-luong-tanca-co-gi-noi-bat) (LOW)

**International competitor products:**
- [Homebase vs. Deputy — Connecteam](https://connecteam.com/homebase-vs-deputy/) (LOW)
- [Buddy Punch vs. Deputy — Buddy Punch](https://buddypunch.com/time-clock-software/comparisons/buddy-punch-vs-deputy/) (LOW)
- [Buddy Punch vs. Homebase — Buddy Punch](https://buddypunch.com/compare/buddy-punch-vs-homebase/) (LOW)

**Approval workflow / audit / notifications:**
- [Leave Request Approval Workflow: 13 Best Practices — Cflow](https://www.cflowapps.com/leave-request-approval-workflow-best-practices/) (LOW)
- [How to automate employee leave requests — Nintex](https://www.nintex.com/learn/workflow-automation/automate-employee-leave-requests/) (LOW)
- [Complete guide to leave management software — MiHCM](https://mihcm.com/resources/blog/a-complete-guide-to-leave-and-holiday-management-software/) (LOW)
- [How approved requests affect timesheets — general HR system documentation aggregate (GSA, university HR policies)](https://www.gsa.gov/buy-through-us/shared-services/support-services-for-commissions-and-boards/hr-links-user-guides/time-and-leave/create-a-timesheet) (LOW)

**Company settings / grace period:**
- [Grace Time in Attendance — TimeChamp](https://www.timechamp.io/glossary/grace-time) (LOW)
- [Attendance Configuration Guide — JustLogin](https://support.justlogin.com/hc/en-us/articles/360034328452-Attendance-Configuration-Guide) (LOW)
- [How to Configure Attendance Rules — Paybooks](https://support.paybooks.in/support/solutions/articles/4000193803-how-to-configure-attendance-rules) (LOW)
- [Create attendance policy — greytHR](https://admin-help.greythr.com/admin/answers/143354858/) (LOW)

**Multi-tenant SaaS operator console:**
- [Multi Tenant Security — OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) (LOW–MEDIUM, reputable source but single pass)
- [How to Build Secure User Impersonation for SaaS — Medium](https://medium.com/@pushkar.meclpu/how-to-build-secure-user-impersonation-for-saas-lessons-from-aws-next-js-a2c80644bffe) (LOW)
- [Building a Secure User Impersonation Feature for Multi-Tenant Enterprise Applications — Medium](https://medium.com/@codebyzarana/building-a-secure-user-impersonation-feature-for-multi-tenant-enterprise-applications-21e79476240c) (LOW)
- [The developer's guide to SaaS multi-tenant architecture — WorkOS](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) (LOW)

---

*Feature research for: Multi-tenant workforce attendance / time-tracking SaaS (Vietnam SMB)*
*Researched: 2026-07-31*
