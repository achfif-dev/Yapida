# Database & Buku Nilai Raport — Madrasah

Aplikasi web **single-file (HTML)** untuk mengelola data siswa, nilai, absensi, rapor, dan ijazah madrasah/sekolah Islam (TPQ, Ibtidaiyah, Tsanawiyah, Aliyah), dengan penyimpanan **realtime** menggunakan **Firebase Realtime Database** dan login **Google Sign-In**.

Tidak perlu instalasi atau server — cukup buka file `index.html` di browser. Semua data tersimpan di cloud (Firebase) sehingga bisa diakses dari perangkat mana pun oleh akun yang diizinkan.

---

## Daftar Isi

1. [Teknologi](#teknologi)
2. [Konsep Dasar Data](#konsep-dasar-data)
3. [Login & Akun](#1-login--akun)
4. [Tab Kelas](#2-tab-kelas)
5. [Tab Siswa](#3-tab-siswa)
6. [Tab Absensi](#4-tab-absensi)
7. [Tab Input Nilai](#5-tab-input-nilai)
8. [Tab Rekap & Cetak](#6-tab-rekap--cetak)
9. [Tab Ijazah](#7-tab-ijazah)
10. [Tab Akun](#8-tab-akun)
11. [Fitur Cetak & Ekspor](#fitur-cetak--ekspor)
12. [Tampilan & UX](#tampilan--ux)

---

## Teknologi

- **Frontend**: HTML, CSS, JavaScript murni (vanilla) — satu file (`index.html`), tanpa build step.
- **Database**: Firebase Realtime Database (data realtime, sinkron otomatis antar perangkat).
- **Autentikasi**: Firebase Authentication — Google Sign-In (hanya akun yang diizinkan admin yang bisa masuk).
- **Font**: Google Fonts (Fraunces, Public Sans, IBM Plex Mono, serta berbagai font Latin & Arab untuk keperluan template ijazah).
- **Library eksternal**:
  - [SheetJS / xlsx.js](https://sheetjs.com/) — baca & tulis file Excel (`.xlsx`).
  - [html2canvas](https://html2canvas.hertzen.com/) & [jsPDF](https://github.com/parallax/jsPDF) — ekspor ijazah ke PDF/JPG (dimuat on-demand saat dibutuhkan, perlu koneksi internet).

## Konsep Dasar Data

Struktur data dirancang supaya **biodata siswa bersifat global** (tidak terikat satu kelas) sementara **nilai & absensi bersifat per kelas**:

| Path Firebase | Isi |
|---|---|
| `rapor/murid/{muridId}` | Biodata induk siswa (nama, NISN, NIS, JK, alamat, ortu/wali, dll) + `riwayatKelas` (riwayat semua kelas yang pernah ditempuh) + `kelasAktifId`. |
| `rapor/enroll/{kelasId}/{muridId}` | Data pendaftaran siswa di kelas tertentu (no. urut). |
| `rapor/kelasList/{kelasId}` | Data kelas (tingkatan, nama kelas, tahun ajaran H/M, status kelas akhir). |
| `rapor/data/{kelasId}/...` | Nilai, absensi, mapel, identitas rapor, tie-break, dan data ijazah untuk kelas tersebut. |

Dengan struktur ini, saat siswa **naik kelas / pindah kelas**, biodatanya tidak perlu diinput ulang — cukup dipindahkan (lihat [Kenaikan / Pindah Kelas](#kenaikan--pindah-kelas)), dan nilai di kelas-kelas sebelumnya tetap tersimpan sebagai riwayat.

Satu **kelas** mencakup **3 Catur Wulan (CW1, CW2, CW3)** sekaligus dalam satu tahun ajaran — tidak perlu membuat kelas baru tiap ganti catur wulan, cukup pindah pemilih Catur Wulan Aktif.

---

## 1. Login & Akun

- **Login dengan Google** — hanya email yang sudah didaftarkan admin di Firebase yang bisa masuk (akses dibatasi per madrasah/yayasan).
- Indikator status koneksi realtime ke database (badge hijau/oranye di header).
- Setelah login, seluruh konten aplikasi (tab-tab) baru ditampilkan.

## 2. Tab Kelas

Tab ini adalah **pusat kendali** aplikasi — semua tab lain (Siswa, Absensi, Input Nilai, Rekap, Ijazah) mengikuti kelas yang sedang aktif di sini. Tab ini ditempatkan **paling awal** dan dilengkapi **banner peringatan "⚠️ Pilih Kelas Terlebih Dahulu!!!"** agar pengguna memastikan kelas yang aktif sudah benar sebelum mengubah data. Kelas & tahun ajaran yang aktif juga selalu ditampilkan sebagai **badge di header** halaman.

### Kelas Aktif
- Pemilih **Kelas** (dropdown, dikelompokkan otomatis per **tingkatan**: TPQ → Ibtidaiyah → Tsanawiyah → Aliyah, dan diurutkan dari kelas pertama ke kelas terakhir, mis. 1 → 2 → 3).
- Pemilih **Catur Wulan Aktif** (CW1/CW2/CW3) — mengganti tampilan nilai tanpa membuat kelas baru.
- Deteksi & migrasi otomatis nilai format lama (sebelum ada Catur Wulan) ke CW1.

### Buat Kelas / Tingkatan Baru
- Form membuat kelas baru: Tingkatan (TPQ/Ibtidaiyah/Tsanawiyah/Aliyah), Nama/Nomor Kelas, Tahun Ajaran (Hijriyah & Masehi), dan penanda **Kelas/Tingkat Akhir** (mengaktifkan fitur Ijazah untuk kelas tersebut).
- **Copy Format dari Kelas Tahun Sebelumnya** — menyalin tingkatan, nama kelas, dan daftar mapel dari kelas lama saat membuat kelas untuk tahun ajaran baru.
- Mode **Ubah Kelas** (edit data kelas yang sudah ada).

### Semua Kelas
- Tabel daftar seluruh kelas, dikelompokkan per **Tahun Ajaran** (terbaru di atas), dengan sub-pemisah per **tingkatan** di dalamnya.
- Filter berdasarkan Tahun Ajaran.
- Aksi per kelas: **Pindah** (jadikan aktif), **Ubah**, **Hapus** (beserta seluruh siswa & nilai di kelas tersebut).
- Ekspor daftar kelas ke Excel.

### Identitas Rapor — Kelas Aktif
- Data identitas yang berlaku sepanjang tahun ajaran kelas ini: Nama Madrasah, Alamat, Tingkat, Kelas, Tahun Ajaran (H/M), Wali Kelas, Kepala Madrasah, Tempat.

### Identitas Rapor — Catur Wulan Aktif
- Data khusus per catur wulan: Label Catur Wulan/Semester, Tanggal Penulisan Raport (bisa berbeda tiap catur wulan).

### Daftar Mata Pelajaran — Kelas Aktif
- Kelola daftar mapel (tambah/hapus/urutkan) khusus untuk kelas yang aktif — urutan ini menentukan urutan kolom nilai di seluruh aplikasi.

### Mapel Prioritas untuk Peringkat Sama (Tie-Break)
- Menentukan urutan mapel yang dipakai sebagai pembanding jika dua siswa punya nilai bersih yang sama, supaya peringkat tidak "kembar" begitu saja.

## 3. Tab Siswa

### Tambah / Ubah Siswa
- Form biodata lengkap: No. Urut, Nama, Jenis Kelamin, NISN, NIS Lokal, Tempat & Tanggal Lahir, Alamat, Nama Ayah/Ibu, Wali, No. HP Wali/Ortu.
- Mengubah biodata berlaku **global** (mengikuti siswa ke kelas mana pun ia berada), sedangkan No. Urut hanya berlaku di kelas aktif.

### Daftar Siswa
- Tabel siswa di kelas aktif, dengan pencarian (nama, NISN, NIS, alamat, ayah/ibu/wali) dan filter kelas & jenis kelamin.
- Aksi **Ubah** dan **Keluarkan** (mengeluarkan siswa dari kelas aktif; biodata & riwayat di kelas lain tetap aman).
- **Ekspor Excel** — unduh seluruh data siswa kelas aktif.
- **Template Import Siswa** — unduh template Excel siap isi (kolom: No, Nama, NISN, NIS, JK, Tempat Lahir, Tanggal Lahir, Alamat, Ayah, Ibu, Wali, No. HP) lengkap dengan petunjuk pengisian.
- **Import dari Excel** — mengimpor banyak siswa sekaligus ke kelas aktif dari file Excel. Jika NISN/Nama pada baris sudah cocok dengan siswa yang ada di kelas aktif, data akan **diperbarui** (tidak dobel); jika belum ada, siswa baru otomatis ditambahkan.

### Kenaikan / Pindah Kelas
- Memindahkan siswa (satu per satu atau massal, dengan checklist — default semua tercentang) dari kelas aktif ke kelas tujuan, lengkap dengan penomoran ulang mulai dari nomor tertentu.
- Nilai & riwayat di kelas-kelas sebelumnya **tidak hilang**, tetap tersimpan sebagai riwayat.
- Cocok dipakai saat kenaikan kelas/tahun ajaran baru — tanpa perlu hapus & input ulang data.

### Riwayat Kelas & Nilai Siswa
- Melihat seluruh riwayat kelas yang pernah/sedang ditempuh seorang siswa beserta nilainya di tiap kelas — berguna untuk menelusuri jejak akademik siswa lintas tahun ajaran.

## 4. Tab Absensi

### Absensi Harian
- Menandai status kehadiran (Hadir/Sakit/Izin/Alpa) tiap siswa untuk tanggal tertentu, tersimpan realtime per kelas aktif.
- Tombol **Tandai Semua Hadir** untuk mempercepat input.

### Riwayat Absensi
- Daftar tanggal yang sudah pernah diisi beserta rekap H/S/I/A per tanggal; bisa dibuka kembali untuk diedit.

### Impor Absensi dari Template Excel
- Unduh **template 1 pekan** atau **1 bulan penuh** (kolom tanggal otomatis dibuat sesuai rentang).
- Isi status (H/S/I/A) di Excel untuk semua siswa & tanggal sekaligus, lalu **impor kembali** — data tanggal yang sama akan ditimpa oleh isian file.

### Rekap Absensi
- Menghitung rekap Hadir/Sakit/Izin/Alpa per siswa dalam rentang tanggal tertentu.
- **Ekspor Excel** rekap absensi.
- Rekap absensi bisa disalin ke form Input Nilai (kolom absen di rapor).

## 5. Tab Input Nilai

Dua mode input yang saling melengkapi:

### Mode Per Siswa
- Pilih satu siswa, lalu isi:
  - **Nilai Asli** tiap mata pelajaran (0–100).
  - **Absensi** (Sakit/Ijin/Alpa) & **Pengurangan Nilai karena Absen**.
  - **Sikap**: Kelakuan, Kerajinan, Kebersihan.
  - Kalkulasi otomatis langsung ditampilkan (live calc) saat mengisi.

### Mode Tabel (seperti Excel)
- Semua siswa ditampilkan ke bawah dan semua mapel ke samping dalam satu tabel — cocok untuk mengisi nilai satu mapel untuk semua siswa sekaligus.
- **Ekspor Excel** tabel nilai, **Unduh Template Excel** kosong (sudah berisi daftar siswa & mapel), dan **Impor dari Excel** untuk mengisi nilai secara massal.

## 6. Tab Rekap & Cetak

### Cetak
- Rekap nilai lengkap untuk kelas & catur wulan aktif: **Nilai Asli**, **Nilai Raport** (hasil konversi skala 4–9), dan **Rata-rata Kelas per Mata Pelajaran**.
- Dicetak dengan kop identitas madrasah, logo, kelas, catur wulan, dan tahun ajaran (mengikuti format A4 landscape saat dicetak).
- **Cetak Rekap** (print langsung) dan **Ekspor Excel** (semua tabel rekap sekaligus).

### Cetak Kartu Raport per Siswa
- Menampilkan & mencetak kartu rapor individual per siswa (pilih siswa dari dropdown lalu klik "Tampilkan Kartu").

### Rekap Akhir Tahun — Gabungan CW1 + CW2 + CW3
- Menghitung rata-rata nilai tiap mapel dari ketiga catur wulan yang sudah punya nilai, lalu **meranking ulang** siswa berdasarkan nilai gabungan.
- Absen (sakit/ijin/alpa) & potongan nilai dijumlah dari ketiga catur wulan.
- Dipakai sebagai bahan peringkat akhir tahun / dasar penerbitan ijazah — rapor tiap catur wulan tetap tersimpan & bisa dicetak terpisah seperti biasa.
- Bisa diekspor ke Excel dan dicetak.

### Konversi Nilai Asli → Nilai Raport
- Skala konversi baku (berlaku untuk semua kelas): ≥85→9, 75–84→8, 65–74→7, 55–64→6, 45–54→5, <45→4.

## 7. Tab Ijazah

Khusus untuk **kelas akhir** (ditandai di tab Kelas) pada tingkat **TPQ**, **Ibtidaiyah (Awwaliyah 6 Tahun)**, dan **Tsanawiyah (Wustho 3 Tahun)**. Nilai diambil otomatis dari data Input Nilai kelas tersebut.

### Data Umum Ijazah — Kelas Aktif
- No. Ijazah awal (otomatis berurutan per siswa), tanggal ujian (dari–sampai, format Hijriyah & Masehi), tempat, dan tanggal terbit ijazah.

### Template Cetak (per tingkatan)
Template cetak ijazah bersifat **global per tingkatan** (dipakai untuk semua kelas akhir di tingkatan yang sama) dan mencakup:
- Identitas: nama yayasan, nama madrasah, alamat, label tingkat, judul halaman belakang.
- Nama & jabatan penandatangan (Kepala Madrasah, Ketua Yayasan, Panitia EBTA).
- Mapel "Materi Tambahan" khusus TPQ.
- Header teks Arab (bisa disembunyikan bila bingkai kustom sudah memuat teks Arab sendiri).
- **Pilihan font** Latin & Arab (banyak preset, dengan pratinjau langsung).
- Unggah **gambar bingkai kustom** (menggantikan bingkai bawaan) dan pengaturan skala konten.

### Data per Siswa
- No. Ijazah, No. Induk, dan **pas foto 3×4** per siswa.

### Pratinjau & Cetak
- Pilih ukuran kertas (A4 atau F4/Folio).
- **Mode Geser Posisi**: menggeser seluruh isi ijazah sekaligus (mode grup) atau menggeser tiap elemen satu per satu — nama madrasah, judul, nama siswa, tiap baris biodata, foto, tanda tangan, dll (mode per baris) — untuk menyesuaikan posisi teks dengan bingkai kustom, lalu disimpan.
- **Cetak**, **Unduh PDF (2 sisi — depan & belakang)**, **Unduh JPG Depan**, **Unduh JPG Belakang** per siswa.
- **Unduh PDF Semua Siswa (Kelas Ini)** — mencetak ijazah seluruh siswa di kelas akhir tersebut sekaligus dalam satu file PDF.

## 8. Tab Akun

### Akun & Koneksi
- Menampilkan akun Google yang sedang login dan status koneksi database.
- Tombol **Keluar** (logout).

### Backup & Restore Database
- **Unduh Backup (JSON)** — mengunduh **seluruh data** aplikasi (semua kelas, siswa, nilai, absensi, template ijazah, dst) dalam satu file JSON.
- **Pulihkan Database** — memulihkan data dari file backup JSON (⚠️ akan **menimpa seluruh data** yang ada saat ini).

### Batas Konversi Nilai
- Tabel referensi skala konversi Nilai Asli → Nilai Raport yang berlaku di seluruh aplikasi.

---

## Fitur Cetak & Ekspor

| Fitur | Format | Lokasi |
|---|---|---|
| Daftar Kelas | Excel | Tab Kelas |
| Daftar Siswa | Excel (ekspor & **template import**) | Tab Siswa |
| Absensi (template & impor massal) | Excel | Tab Absensi |
| Rekap Absensi | Excel | Tab Absensi |
| Nilai — Mode Tabel (template, ekspor, & impor massal) | Excel | Tab Input Nilai |
| Rekap Nilai (Asli, Raport, Rata-rata) | Excel & Cetak (print) | Tab Rekap |
| Kartu Raport per Siswa | Cetak (print) | Tab Rekap |
| Rekap Akhir Tahun Gabungan | Excel & Cetak (print) | Tab Rekap |
| Ijazah per Siswa | PDF (2 sisi), JPG depan/belakang, Cetak | Tab Ijazah |
| Ijazah Semua Siswa Sekelas | PDF gabungan | Tab Ijazah |
| Seluruh Database Aplikasi | Backup/Restore JSON | Tab Akun |

## Tampilan & UX

- Desain responsif, dioptimalkan untuk mobile maupun desktop, dengan tema warna khas madrasah (hijau tua, emas, krem).
- Tata letak cetak (`@media print`) khusus supaya tabel & rapor rapi saat dicetak (A4 landscape untuk rekap nilai).
- Notifikasi **toast** untuk konfirmasi setiap aksi (simpan, hapus, impor, dll).
- **Badge Kelas Aktif** di header — selalu menampilkan tingkatan, nama kelas, dan tahun ajaran yang sedang dipilih, agar pengguna tidak salah mengubah data di kelas yang salah.
- Pencarian & filter cepat pada daftar siswa dan daftar kelas.
- Pengelompokan otomatis kelas berdasarkan **tingkatan** (TPQ → Ibtidaiyah → Tsanawiyah → Aliyah) dan **urutan kelas** (1 → 2 → 3 → dst) di semua dropdown pemilih kelas.

---

## Catatan Teknis

- Semua perhitungan (konversi nilai, rata-rata, peringkat, tie-break) dilakukan otomatis di sisi klien (browser) berdasarkan data yang tersimpan di Firebase.
- Ekspor PDF/JPG ijazah memuat pustaka `html2canvas` & `jsPDF` secara **on-demand** dari CDN — dibutuhkan koneksi internet saat pertama kali dipakai.
- Struktur data mendukung banyak kelas & tahun ajaran sekaligus dalam satu project Firebase yang sama, sehingga riwayat akademik siswa lintas tahun tetap terjaga.
