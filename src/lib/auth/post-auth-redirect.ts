/**
 * Dieu huong SAU KHI phien thay doi: dang nhap, dang xuat, doi doanh nghiep
 * hien hanh, doi mat khau bat buoc, tao doanh nghiep dau tien.
 *
 * PHAI tai lai ca tai lieu, TUYET DOI khong dung `router.push()`:
 * `src/app/layout.tsx` la Server Component doc phien DUNG MOT LAN roi truyen
 * xuong `SessionProvider` qua prop `initialSession`. Dieu huong phia client
 * giu nguyen layout goc da render, nen prop do van la gia tri cua lan tai
 * truoc — vua dang nhap xong thi no van la `null`, `AdminShell` thay
 * `status === "guest"` va dung lai o khung xuong (man hinh trang), roi day
 * nguoc ve `/login` trong khi middleware lai day tro lai `/admin/dashboard`.
 * Do la ly do truoc day "phai reload lai thi moi hien".
 *
 * Tai lai ca tai lieu buoc layout goc chay lai tren server voi cookie phien
 * moi nhat, nen `initialSession` luon dung ngay o lan render dau.
 */
export function redirectAfterSessionChange(path: string): void {
  window.location.assign(path);
}
