import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase dung KHOA CONG KHAI, KHONG rang buoc cookie va KHONG giu
 * phien — chi de XAC MINH mot mat khau bang `signInWithPassword` roi bo di.
 *
 * Ton tai vi mot ly do cu the: `signInWithPassword` goi tren client
 * cookie-bound (`createServerSupabase()`) se GHI DE cookie phien. Nguoi dung
 * go dung mat khau cu thi bi cap lai phien moi giua chung, go sai thi co the
 * mat phien dang co — dang muon xac minh lai thanh ra dang nhap lai.
 *
 * KHONG bao gio goi `signOut()` tren client nay de "don dep" phien vua tao:
 * `signOut` pham vi toan cuc se giet luon phien nguoi dung dang dung. Phien
 * dung mot lan nay nam trong bo nho cua request roi bi bo, va tu het han.
 *
 * Khong dung khoa bi mat (`admin.ts`): xac minh mat khau PHAI di qua duong
 * dang nhap that de con an theo moi gioi han va kiem soat cua GoTrue.
 */
export function createVerificationSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Thiếu biến môi trường: NEXT_PUBLIC_SUPABASE_URL");
  }

  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Thiếu biến môi trường: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
