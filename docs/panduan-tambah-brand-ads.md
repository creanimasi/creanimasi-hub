# Panduan Menambah Brand di Ads Performance

> Versi in-app ada di halaman **Ads Performance → tombol 📖 Panduan** (`src/components/PanduanBrandAdsModal.jsx`).
> Kalau isi panduan ini diubah, ubah juga komponen itu supaya keduanya sama.

## Konsep dasar

- Hub mengambil data dari Meta memakai **access token**. Satu token = satu **Business Manager (BM)**.
- Satu token boleh dipakai banyak brand selama ad account-nya bisa diakses token itu.
- Token disimpan sebagai **env var di Coolify** (bukan di database). Brand hanya mencatat *nama* env var-nya di field **Nama Env Token**. Kosong berarti memakai `META_ACCESS_TOKEN`.

| Brand | BM | Nama Env Token |
|---|---|---|
| Brand lama | BM lama | *(kosong)* → `META_ACCESS_TOKEN` |
| Creanimasi | BM baru | `META_ACCESS_TOKEN_BM2` |

## Langkah 0: Tentukan skenario

Cek di **Business Settings → Accounts → Ad accounts** pada BM yang token-nya ingin kamu pakai.

| Kondisi | Skenario |
|---|---|
| Ad account **sudah ada** di daftar BM yang token-nya sudah kamu punya | **A** (tanpa token baru) |
| Ad account ada di **BM lain**, dan pemiliknya mau share ke BM kamu (Partner) | **A** (setelah dishare) |
| Ad account ada di **BM lain**, tidak bisa di-share, dan kamu punya akses admin di sana | **B** (token baru dari BM itu) |

---

## Skenario A: BM sama (pakai token yang sudah ada)

Tidak perlu token baru dan tidak perlu redeploy.

1. **Beri akses ke System User.**
   Business Settings → Accounts → **Ad accounts** → pilih akun → **Add people** → tab **System users** → pilih System User pemilik token → aktifkan **View performance** → **Assign**.
   - Kalau akun belum ada di daftar dan dimiliki BM lain, minta pemiliknya: Business Settings → Ad accounts → pilih akun → **Assign Partners** → masukkan **Business ID** BM kamu (View performance). Setelah itu ulangi langkah ini.
2. **Tes** (ganti `TOKEN` dengan token BM tersebut, jangan tempel token ke chat):
   ```powershell
   $T = "TOKEN"
   curl.exe "https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name&access_token=$T"
   ```
   Ad account baru harus muncul di hasil. Kalau `{"data":[]}`, akses belum ter-assign.
3. **Tambah di Hub**: Ads Performance → **+ Brand**.
   - Nama Brand: nama unik.
   - Ad Account ID: `act_xxxxxxxxxx`.
   - Nama Env Token: kosongkan kalau BM-nya pakai `META_ACCESS_TOKEN`. Isi nama env var lain kalau BM-nya memakai env var itu (misal `META_ACCESS_TOKEN_BM2`).
4. Lanjut ke **Setelah brand dibuat**.

---

## Skenario B: BM beda (token baru)

Lakukan **semua langkah di BM tempat ad account berada**.

1. **Buat App** di [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App.
   - Use case: **Create & manage ads with Marketing API**.
   - Di langkah Business, pilih BM tersebut.
2. **Buat System User**: Business Settings → Users → System Users → **Add** (role Employee cukup).
3. **Hubungkan System User ke App**: Business Settings → Accounts → **Apps** → pilih app → **Add People** → pilih System User → aktifkan **Develop app**. Tanpa ini, saat generate token muncul *"No permissions available"*.
4. **Beri akses ad account**: pilih System User → **Add assets** → **Ad accounts** → aktifkan **View performance**. Kalau tombol Add assets tidak terlihat, pakai cara Skenario A langkah 1 dari sisi Ad accounts.
5. **Generate token**: System User → **Generate token** → pilih app → expiration **Never** → centang **`ads_read`** → salin token (hanya tampil sekali).
6. **Tes token** dengan perintah `me/adaccounts` di atas. Akun harus muncul.
7. **Pasang di Coolify**: aplikasi **backend** → Environment Variables → **Add**.
   - Name: `META_ACCESS_TOKEN_` + nama unik (misal `META_ACCESS_TOKEN_BM3`). Harus diawali `META_ACCESS_TOKEN`, huruf besar, angka, atau underscore.
   - Value: token. **Buildtime dimatikan, Runtime dicentang.**
   - **Save**, lalu **Redeploy** backend. Env var baru hanya terbaca setelah restart.
8. **Tambah di Hub**: **+ Brand**, isi Nama, Ad Account ID, dan **Nama Env Token** dengan nama variabel dari langkah 7 (persis sama).
9. Lanjut ke **Setelah brand dibuat**.

---

## Setelah brand dibuat

1. Klik **⚙️ Setting** → isi **Kurs USD** dan **HPP default (%)**. Default kurs 16.000 dan HPP 0%. Kalau dibiarkan, profit terlihat terlalu besar.
2. Klik **📅 Sync Range** untuk menarik data historis, atau **Sync Meta** untuk kemarin.
3. Isi **+ Input Harian** (jumlah order dan omzet) supaya profit dan ROAS terhitung.
4. Sync otomatis jalan setiap hari **07:00 WIB** untuk semua brand aktif.

Brand bisa diubah lewat **✏️ Edit Brand** (nama, akun, env token, aktif). Untuk berhenti sync tanpa kehilangan data, hilangkan centang "Brand aktif". **Hapus** brand menghapus semua data insights dan report brand itu secara permanen.

---

## Kalau ada error

| Pesan | Penyebab | Solusi |
|---|---|---|
| *No permissions available* saat generate token | System User belum punya role di App, atau app belum punya use case Marketing API | Skenario B langkah 3; cek use case app |
| `me/adaccounts` → `{"data":[]}` | Ad account belum di-assign ke System User | Skenario A langkah 1 |
| `(#200) Ad account owner has NOT grant ads_read…` | Akun belum di-assign, atau app dan akun beda BM (app mode Development), atau brand memakai token yang salah (Nama Env Token kosong) | Cek assign, buat app di BM pemilik akun, cek **Edit Brand** |
| `190 … subcode 460` (session invalidated) | Token dicabut (Revoke tokens) atau dibatalkan Meta | Generate token baru → update di Coolify → Redeploy |
| `Cannot parse access token` | Token salah tempel, terpotong, atau kelebihan spasi | Tempel ulang lewat variabel `$T` |
| `META_ACCESS_TOKEN_XXX tidak di-set` | Env var belum dibuat, salah ketik, atau backend belum di-redeploy | Cocokkan nama persis, Redeploy |
| Sync gagal (500) | Alasan asli hanya ada di log | Coolify → backend → Logs → cari baris `Gagal sync:` |
| "Brand sudah ada" | Nama brand harus unik | Pakai nama lain |

## Aturan penting

- Jangan klik **Revoke tokens** kecuali sudah punya token pengganti yang terpasang di Coolify.
- Jangan pakai awalan `REACT_APP_` untuk token (ikut ter-bundle ke frontend).
- Jangan tempel token ke chat atau commit ke git.
- Kalau token dibuat dengan masa berlaku 60 hari, catat tanggal ganti supaya sync tidak berhenti mendadak.
- Satu token boleh dipakai banyak brand (selama ad account-nya bisa diakses token itu).
