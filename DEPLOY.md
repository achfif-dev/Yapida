# Panduan Deploy: Vercel & Netlify

Aplikasi ini cuma satu file statis (`index.html`, tanpa proses build), jadi deploy-nya sangat sederhana di kedua platform. Pilih salah satu — tidak perlu dua-duanya.

Siapkan folder berisi 3 file ini sebelum deploy:
- `index.html`
- `vercel.json` (kalau pakai Vercel)
- `netlify.toml` (kalau pakai Netlify)

---

## Opsi A — Vercel

### Cara tercepat (tanpa install apa pun, drag & drop)
1. Buka https://vercel.com → login/daftar (bisa pakai akun Google).
2. Klik **Add New → Project** → tab **Deploy without Git** (atau seret folder ke halaman impor).
3. Seret folder yang berisi `index.html` + `vercel.json`.
4. Klik **Deploy**. Selesai — Anda dapat URL seperti `nama-project.vercel.app`.

### Lewat CLI (kalau Anda punya Node.js/terminal)
```bash
npm install -g vercel
cd folder-project-anda
vercel        # ikuti prompt, pilih "no framework / other"
vercel --prod # deploy ke production URL
```

### Lewat GitHub (paling gampang untuk update berkala)
1. Push folder ini ke repo GitHub.
2. Di Vercel: **Add New → Project** → pilih repo tsb → Deploy.
3. Setiap kali Anda `git push`, Vercel otomatis re-deploy.

---

## Opsi B — Netlify

### Cara tercepat (drag & drop)
1. Buka https://app.netlify.com → login/daftar.
2. Di dashboard, cari kotak **"Drag and drop your site output folder here"** (bagian bawah halaman **Sites**).
3. Seret folder yang berisi `index.html` + `netlify.toml`.
4. Selesai — Anda dapat URL seperti `nama-acak.netlify.app` (bisa diganti nama di **Site settings → Change site name**).

### Lewat CLI
```bash
npm install -g netlify-cli
cd folder-project-anda
netlify deploy          # deploy preview dulu
netlify deploy --prod   # kalau sudah oke, deploy ke production
```

### Lewat GitHub
1. Push folder ke repo GitHub.
2. Di Netlify: **Add new site → Import an existing project** → pilih repo.
3. Build command: kosongkan. Publish directory: `.` (sudah otomatis dari `netlify.toml`).

---

## ⚠️ Langkah WAJIB setelah deploy: daftarkan domain baru di Firebase

Google Sign-In akan **gagal** (`auth/unauthorized-domain`) kalau domain deploy-nya belum didaftarkan di Firebase:

1. Buka [Firebase Console](https://console.firebase.google.com) → project **database-yapida-app**.
2. Menu **Authentication → Settings → Authorized domains**.
3. Klik **Add domain**, masukkan domain hasil deploy Anda, contoh:
   - `nama-project.vercel.app`
   - `nama-acak.netlify.app`
   - atau domain custom Anda sendiri kalau sudah dihubungkan.
4. Simpan.

Kalau Anda pakai **custom domain** (mis. `raport.yayasan-alhidayah.sch.id`), tambahkan juga domain itu di sini setelah dihubungkan di Vercel/Netlify.

Firebase Rules (`firebase-rules.json` dari sebelumnya) tidak perlu diubah untuk keperluan deploy — itu berlaku di sisi database, tidak tergantung di mana file HTML-nya di-hosting.
