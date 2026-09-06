/**
 * Sinh mat khau ban dau cho nguoi khac — dang `k7mq-p4ax-r9tz`.
 *
 * Bang chu da BO cac ky tu de nham khi doc: `0` `O` `o` `1` `l` `I` `i`. Day
 * khong phai chi tiet tham my ma la dieu kien de nut "Tao mat khau" duoc dung
 * that: quan tri phai doc chuoi nay qua dien thoai cho cong nhan xuong. Ham cu
 * sinh `base64url` phan biet hoa thuong, co `-` va `_` — doc qua dien thoai la
 * bat kha thi, nen quan tri se bo qua nut do va tu go mot mat khau yeu. Mot nut
 * khong ai bam thi khong bao ve duoc gi.
 *
 * Do manh: bang 27 ky tu, 12 vi tri ≈ 57 bit.
 */

/** Da bo `0` `o` `1` `l` `i` — chi giu chu thuong de doc/go cho de. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz2345679";

const GROUP_LENGTH = 4;
const GROUP_COUNT = 3;
const TOTAL_LENGTH = GROUP_LENGTH * GROUP_COUNT;

/**
 * Lay mot ky tu ngau nhien theo kieu LOAI BO PHAN DU: chia lay du thang tu mot
 * byte 0-255 se lam cac ky tu dau bang xuat hien nhieu hon (256 khong chia het
 * cho 30). Bo cac gia tri roi vao phan du va boc lai cho den khi duoc mot gia
 * tri nam gon trong khoang chia het.
 */
function randomIndex(alphabetSize: number): number {
  const limit = Math.floor(256 / alphabetSize) * alphabetSize;
  const buffer = new Uint8Array(1);

  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      return buffer[0] % alphabetSize;
    }
  }
}

/** Sinh mat khau dang `k7mq-p4ax-r9tz` (12 ky tu, 3 nhom ngan cach bang `-`). */
export function generateReadablePassword(): string {
  const characters: string[] = [];
  for (let index = 0; index < TOTAL_LENGTH; index += 1) {
    characters.push(ALPHABET[randomIndex(ALPHABET.length)]);
  }

  const groups: string[] = [];
  for (let start = 0; start < TOTAL_LENGTH; start += GROUP_LENGTH) {
    groups.push(characters.slice(start, start + GROUP_LENGTH).join(""));
  }

  return groups.join("-");
}

/** Cac ky tu de nham — export de bai kiem thu khang dinh dung mot danh sach. */
export const CONFUSABLE_CHARACTERS = ["0", "O", "o", "1", "l", "I", "i"];
