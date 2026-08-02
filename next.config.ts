import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Thu muc cha co lockfile rieng nen Next doan sai goc workspace — chi ro o day
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Mac dinh Next la 1mb; mot anh JPEG chup tu camera dien thoai doi moi de
    // vuot muc do — khi do nguoi dung thay mot loi KHONG thuoc ba ly do cua
    // D-20b trong khi mang va camera deu binh thuong. Day la mot bien an toan
    // di kem muc tieu nen anh phia client (plan 03-03), khong thay the no.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
