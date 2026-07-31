import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AppLogo } from "@/components/brand/app-logo";
import { DashboardMockup } from "@/components/brand/dashboard-mockup";
import { GradientMesh } from "@/components/brand/gradient-mesh";
import { LoginForm } from "@/app/(auth)/login/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

const highlights = [
  "Chấm công theo ca, kể cả ca qua đêm",
  "Quản lý nhân viên và phòng ban tập trung",
  "Dữ liệu sẵn sàng cho kỳ tính lương",
];

export default function LoginPage(): React.ReactElement {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Cot trai — chi hien day du tren man hinh rong */}
      <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <GradientMesh />

        <div className="relative">
          <AppLogo variant="light" size="lg" />
        </div>

        <div className="relative max-w-xl">
          <h1 className="display-xl text-white">
            Quản lý thời gian làm việc
            <br />
            rõ ràng và chính xác hơn.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/85">
            Chấm công, quản lý nhân viên và chuẩn bị dữ liệu tính lương trong một
            hệ thống duy nhất.
          </p>

          <ul className="mt-7 grid gap-2.5">
            {highlights.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-[14px] text-white/85"
              >
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10">
          <DashboardMockup />
        </div>
      </section>

      {/* Cot phai — bieu mau dang nhap */}
      <section className="flex flex-col">
        {/* Dai gradient mong phia tren cho dien thoai */}
        <div className="relative h-32 overflow-hidden sm:h-40 lg:hidden">
          <GradientMesh variant="band" />
          <div className="relative flex h-full items-center px-5">
            <AppLogo variant="light" size="md" />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-7">
              <h2 className="display-md text-ink">Đăng nhập</h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                Nhập thông tin tài khoản để vào hệ thống quản lý chấm công.
              </p>
            </div>

            <LoginForm />

            <p className="mt-8 text-center text-xs leading-relaxed text-ink-muted">
              Bằng việc đăng nhập, bạn đồng ý với điều khoản sử dụng và chính
              sách bảo mật của TimeFlow.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
