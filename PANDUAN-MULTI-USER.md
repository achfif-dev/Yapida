# Panduan Multi-User: Super Admin, Admin, Staf, Guru, Viewer

## 1. Cara kerja role

| Role | Akses |
|---|---|
| **Super Admin** | `achfif@gmail.com` — tertanam di kode & rules, tidak bisa diubah/diturunkan siapa pun. Akses penuh semua kelas + kelola pengguna. |
| **Admin** | Akses penuh semua kelas + kelola pengguna (angkat/turunkan Staf/Guru/Admin lain). Ditetapkan oleh Super Admin/Admin lain. |
| **Staf** | Akses penuh baca/tulis ke **semua kelas** (nilai, absensi, siswa, ijazah). Tidak bisa kelola pengguna, tidak bisa backup/restore seluruh database. |
| **Guru** | Akses baca/tulis **hanya ke kelas yang ditugaskan** kepadanya (dicentang oleh Admin di tab **Pengguna**). Tidak bisa akses kelas lain, tidak bisa buat/hapus kelas baru, tidak bisa kelola pengguna. |
| **Viewer** (default akun baru) | Tidak bisa baca maupun tulis data apa pun. Akun Google baru otomatis masuk sebagai Viewer sampai ditetapkan Admin. |

Guru & Staf punya hak yang **sama persis** (baca+tulis penuh) di dalam kelas yang boleh mereka akses — bedanya hanya cakupan kelasnya.

## 2. Langkah pemasangan (WAJIB — jangan lewati langkah 2b)

### a. Upload `index.html` yang sudah diperbarui
File ini sudah berisi logika role, tab **Pengguna** (khusus Admin/Super Admin), dan layar "Menunggu Persetujuan" untuk Viewer.

### b. Pasang Firebase Security Rules (BAGIAN PALING PENTING)
Kode aplikasi di browser **bisa dimodifikasi siapa pun** yang paham teknis (lewat DevTools). Jadi pembatasan akses yang sesungguhnya **harus** ada di server, yaitu di Firebase Realtime Database Rules — bukan cuma disembunyikan di tampilan.

1. Buka [Firebase Console](https://console.firebase.google.com) → project **database-yapida-app**.
2. Menu **Realtime Database** → tab **Rules**.
3. Ganti seluruh isi rules dengan isi file `firebase-rules.json` yang saya sertakan.
4. Klik **Publish**.

Tanpa langkah ini, sistem role di aplikasi hanya kosmetik (bisa dilewati lewat DevTools) — datanya akan tetap terbuka sesuai rules lama.

### c. Login pertama kali sebagai Super Admin
Login dengan akun `achfif@gmail.com` — sistem otomatis membuat profil dengan role **Super Admin** dan langsung memberi akses penuh + tab **Pengguna**.

### d. Undang Staf/Guru
Minta setiap Staf/Guru login sekali dengan akun Google mereka (mereka akan melihat layar "Menunggu Persetujuan"). Setelah itu, buka tab **Pengguna** (sebagai Super Admin/Admin), ubah role mereka jadi **Staf** atau **Guru**, dan untuk Guru — centang kelas yang mereka ampu, lalu klik **Simpan**.

## 3. Catatan & batasan yang perlu diketahui

- **Nama kelas & nama siswa** (bukan nilai/absensi) bisa terbaca oleh siapa pun berrole Staf/Guru/Admin (bukan hanya kelas yang ditugaskan) — ini trade-off yang disengaja karena data siswa disimpan lintas-kelas (riwayat kenaikan kelas). Yang benar-benar dibatasi ketat per kelas adalah **nilai, absensi, dan data kelas (rapor/data/{kelas})**.
- **Backup/Restore seluruh database** hanya bisa dilakukan Admin & Super Admin (bukan Staf), karena ini operasi yang bisa menimpa seluruh data sekaligus.
- **Buat/Hapus kelas baru** hanya bisa dilakukan Staf, Admin, dan Super Admin. Guru hanya bisa mengelola (ubah/hapus) kelas yang sudah ditugaskan padanya, tidak bisa membuat kelas baru.
- Jika Anda ingin pembatasan yang lebih ketat lagi (misal: Guru sama sekali tidak bisa melihat nama siswa di kelas lain), itu perlu perombakan struktur data siswa — bisa dikerjakan sebagai langkah lanjutan bila diperlukan.
