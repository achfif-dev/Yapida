# Database Yapida — Buku Induk Siswa, Nilai, Absensi & Raport
Yayasan Pendidikan Islam Al-Hidayah (Yapida) — Madrasah Tarbiyatul Islam Al-Hidayah, Ujung Piring, Bangkalan

Aplikasi 1 file (`index.html`) — konfigurasi Firebase sudah tertanam langsung di kode, login memakai Google, tanpa build step. Cocok dipakai lewat GitHub Pages / GitHub web UI.

## 1. Aktifkan Google Sign-In di Firebase
1. https://console.firebase.google.com → project **database-yapida-app**.
2. **Build → Authentication → Sign-in method** → aktifkan provider **Google**.
3. **Authentication → Settings → Authorized domains** → tambahkan domain tempat `index.html` akan dihosting (misalnya `namamu.github.io`). `localhost` biasanya sudah otomatis ada untuk uji coba lokal.

## 2. Amankan Rules Realtime Database
Firebase Console → **Realtime Database → Rules**:
```json
{
  "rules": {
    "rapor": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```
Ini mengunci seluruh data (`rapor/...`) hanya untuk pengguna yang sudah login Google. Kalau ingin membatasi lebih ketat (misalnya hanya email tertentu / guru tertentu yang boleh menulis), aturan bisa dipersempit lagi, contoh:
```json
{
  "rules": {
    "rapor": {
      ".read": "auth != null",
      ".write": "auth != null && (auth.token.email === 'admin@yapida.sch.id' || auth.token.email === 'guru2@yapida.sch.id')"
    }
  }
}
```

## 3. Deploy (GitHub Pages, tanpa terminal)
1. Push `index.html` (dan `README.md` ini) ke repo GitHub lewat web UI.
2. Repo → Settings → Pages → Source: `Deploy from a branch` → pilih branch `main` / folder `/root`.
3. Tunggu beberapa menit, buka URL yang muncul di Settings → Pages, lalu klik **Masuk dengan Google**.

## Fitur
- **Login Google wajib** — semua tab terkunci sampai pengguna berhasil masuk; ada tombol Keluar di header dan tab Akun.
- **Multi kelas/tingkatan** — 1 Ibtidaiyah, 2 Ibtidaiyah, 1 Tsanawiyah, dst, semua dalam satu project Firebase, diatur dari tab **Kelas**.
- **Database Siswa lengkap** — No urut, Nama, Jenis Kelamin, NISN, NIS lokal, Tempat & Tanggal Lahir, Alamat, Nama Ayah/Ibu, Wali, No. HP.
- **Absensi Harian** — tandai Hadir/Sakit/Izin/Alpa per tanggal per siswa; ada rekap rentang tanggal yang bisa langsung disalin ke form Input Nilai.
- **Input Nilai Asli** per mata pelajaran (0–100), otomatis dikonversi ke Nilai Raport (4–9).
- **Rekap & Cetak** — tabel nilai asli, nilai raport, rata-rata kelas, serta kartu raport per siswa siap cetak/print ke PDF.

## Struktur data di Realtime Database
```
rapor/
  kelasList/<kelasId>       -> { tingkatan, kelasNama, catur, tahun }
  data/<kelasId>/
    meta/                    -> identitas madrasah, kelas, wali kelas, dst
    subjects/                -> array nama mata pelajaran kelas ini
    students/<id>/           -> { no, nama, jk, nisn, nis, tempatLahir, tglLahir, alamat, ayah, ibu, wali, telp }
    scores/<id>/              -> { mapel:{...}, absen:{sakit,ijin,alpa}, potongan, sikap:{...} }
    absensi/<tanggal>/<id>/    -> "H" | "S" | "I" | "A"
```

## Rumus yang dipakai (sesuai file Excel asal)
- **Jumlah Nilai** = total semua nilai mapel
- **Jumlah Bersih** = Jumlah Nilai − Pengurangan Absen (bisa diisi manual, atau salin dari rekap Absensi)
- **Rata-rata** = Jumlah Bersih ÷ jumlah mapel
- **Peringkat** = ranking berdasar Jumlah Bersih (nilai tertinggi = peringkat 1, nilai sama → peringkat sama)
- **Nilai Raport** per mapel (konversi dari nilai asli 0–100):
  - ≥85 → 9, 75–84 → 8, 65–74 → 7, 55–64 → 6, 45–54 → 5, <45 → 4

Semua nilai dihitung otomatis & realtime di sisi aplikasi, jadi kalau nilai mapel atau absensi diubah, rekap & peringkat langsung ikut berubah untuk semua yang membuka halaman.

## Catatan keamanan
- Config Firebase (`apiKey`, dll.) di dalam `index.html` **aman untuk publik** — ini bukan rahasia, keamanan data sesungguhnya ditentukan oleh Rules di langkah 2. Jangan lupa terapkan Rules tersebut sebelum data sungguhan dimasukkan.
- Kalau perlu, batasi siapa saja yang boleh mengelola data lewat email di Rules seperti contoh di atas, atau lewat custom claims Firebase Auth untuk pengaturan role yang lebih rapi (admin/guru/wali kelas).
