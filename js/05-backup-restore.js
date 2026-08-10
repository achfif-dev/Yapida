/* ===================== Backup & Restore Database =====================
   Backup: mengunduh SELURUH isi node 'rapor' (kelasList, data per-kelas, students, ijazahTemplates, dst)
   sebagai satu file JSON — bisa dibuka lagi di komputer/HP lain lewat "Restore".
   Restore: membaca file JSON tsb dan MENIMPA seluruh node 'rapor' saat ini (db.ref('rapor').set(...)).
   Ini operasi berat & merusak-jika-salah, jadi selalu minta konfirmasi eksplisit dari pengguna. */
let restoreDbPendingData = null;
let restoreSuratPendingData = null;

async function buatDanUnduhBackupJson(){
  const [snap, suratSnap] = await Promise.all([ db.ref('rapor').get(), db.ref('surat').get() ]);
  const data = snap.val() || {};
  const payload = {
    _backupInfo: { app: 'Buku Nilai Raport — Madrasah', dibuatPada: new Date().toISOString() },
    rapor: data,
    surat: suratSnap.val() || {}
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-rapor-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}

document.getElementById('btnBackupDb').addEventListener('click', async ()=>{
  if(!isAdmin()){ toast('Hanya Admin/Super Admin yang boleh backup database'); return; }
  if(!db){ toast('Hubungkan Firebase dulu (masuk akun)'); return; }
  try{
    toast('Menyiapkan backup…');
    await buatDanUnduhBackupJson();
    toast('Backup berhasil diunduh');
  }catch(e){
    console.error(e);
    toast('Gagal membuat backup: ' + e.message);
  }
});

/* ===================== Backup Seluruh Database → Excel =====================
   Beda dengan Backup JSON (yang dipakai untuk Restore), ini mengubah SELURUH isi
   node 'rapor' + 'users' jadi tabel-tabel Excel yang bisa dibaca manual siapa pun
   tanpa perlu aplikasi ini — jaga-jaga kalau website/Firebase bermasalah. Data
   nilai per-catur-wulan & absensi harian dari SEMUA kelas digabung jadi tabel
   "panjang" (satu baris per data) karena tiap kelas bisa punya daftar mapel
   berbeda-beda, jadi tidak bisa dipetakan ke kolom yang seragam. */
document.getElementById('btnBackupExcel').addEventListener('click', async ()=>{
  if(!isAdmin()){ toast('Hanya Admin/Super Admin yang boleh backup database'); return; }
  if(!db){ toast('Hubungkan Firebase dulu (masuk akun)'); return; }
  const btn = document.getElementById('btnBackupExcel');
  btn.disabled = true;
  try{
    toast('Mengambil seluruh data dari Firebase…');
    const [raporSnap, usersSnap] = await Promise.all([
      db.ref('rapor').get(),
      db.ref('users').get().catch(()=>null) // tetap lanjut walau gagal (mis. rules tidak mengizinkan)
    ]);
    const rapor = raporSnap.val() || {};
    const users = (usersSnap && usersSnap.val()) || {};
    const kelasList = rapor.kelasList || {};
    const dataPerKelas = rapor.data || {};
    const studentsMaster = rapor.students || {};
    const ijazahTemplates = rapor.ijazahTemplates || {};
    const kelasNamaOf = (kid)=>{
      const k = kelasList[kid] || {};
      return [k.tingkatan, k.kelasNama].filter(Boolean).join(' ') || kid;
    };

    const wb = XLSX.utils.book_new();

    // --- Sheet: Ringkasan ---
    const jumlahSiswa = Object.keys(studentsMaster).length;
    const jumlahKelas = Object.keys(kelasList).length;
    const ringkasan = [
      ['Backup Lengkap Database — Buku Nilai Raport Madrasah'],
      ['Dibuat pada', new Date().toLocaleString('id-ID')],
      ['Jumlah kelas', jumlahKelas],
      ['Jumlah siswa (induk)', jumlahSiswa],
      ['Jumlah akun pengguna', Object.keys(users).length],
      [],
      ['CATATAN PENTING:'],
      ['File Excel ini HANYA untuk cadangan / dibaca manual kalau sistem atau koneksi bermasalah.'],
      ['Untuk memulihkan data kembali ke aplikasi (Restore), selalu gunakan file Backup JSON, bukan file Excel ini.'],
      ['Template desain Ijazah (posisi elemen, gambar bingkai, dst) tidak ikut ditabelkan di sini karena berupa data visual —'],
      ['gunakan Backup JSON kalau butuh memulihkan template ijazah.'],
    ];
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(ringkasan, [32,26]), 'Ringkasan');

    // --- Sheet: Daftar Kelas ---
    const kelasRows = [['ID Kelas','Tingkatan','Nama Kelas','Tahun Ajaran (H)','Tahun Ajaran (M)']];
    Object.entries(kelasList).forEach(([kid,k])=> kelasRows.push([kid, k.tingkatan||'', k.kelasNama||'', k.tahun||'', k.tahunMasehi||'']));
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(kelasRows, [16,14,16,16,16]), 'Daftar Kelas');

    // --- Sheet: Identitas per Kelas (meta) ---
    const metaRows = [['Kelas','Nama Madrasah','Alamat','Kepala Madrasah','Wali Kelas','Tempat','Tanggal Cetak']];
    Object.entries(dataPerKelas).forEach(([kid,d])=>{
      const m = d.meta || {};
      metaRows.push([kelasNamaOf(kid), m.nama||'', m.alamat||'', m.kepala||'', m.wali||'', m.tempat||'', m.tanggal||'']);
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(metaRows, [16,26,30,20,18,16,14]), 'Identitas per Kelas');

    // --- Sheet: Siswa (Induk) ---
    const siswaRows = [['ID Siswa','Nama','NISN','NIS','JK','Tempat Lahir','Tgl Lahir','Alamat','Ayah','Ibu','Wali','No. HP','Kelas Aktif Saat Ini']];
    Object.entries(studentsMaster).forEach(([sid,s])=>{
      siswaRows.push([sid, s.nama||'', s.nisn||'', s.nis||'', s.jk||'', s.tempatLahir||'', s.tglLahir||'', s.alamat||'', s.ayah||'', s.ibu||'', s.wali||'', s.telp||'', s.kelasAktifId?kelasNamaOf(s.kelasAktifId):'']);
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(siswaRows, [16,22,14,12,4,14,12,22,16,16,16,14,16]), 'Siswa (Induk)');

    // --- Sheet: Riwayat Kelas Siswa ---
    const riwayatRows = [['Nama Siswa','ID Kelas','Tingkatan','Kelas','No. Absen','Tahun Ajaran (H)','Tahun Ajaran (M)']];
    Object.entries(studentsMaster).forEach(([sid,s])=>{
      Object.entries(s.riwayatKelas||{}).forEach(([kid,rw])=>{
        riwayatRows.push([s.nama||sid, kid, rw.tingkatan||'', rw.kelasNama||'', rw.no||'', rw.tahun||'', rw.tahunMasehi||'']);
      });
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(riwayatRows, [22,16,14,16,10,16,16]), 'Riwayat Kelas Siswa');

    // --- Sheet: Mapel per Kelas ---
    const mapelRows = [['Kelas','No. Urut','Nama Mapel']];
    Object.entries(dataPerKelas).forEach(([kid,d])=>{
      (d.subjects||[]).forEach((s,i)=> mapelRows.push([kelasNamaOf(kid), i+1, s]));
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(mapelRows, [16,10,26]), 'Mapel per Kelas');

    // --- Sheet: Mapel Prioritas (Tie Break) per Kelas ---
    const tieRows = [['Kelas','No. Urut Prioritas','Nama Mapel']];
    Object.entries(dataPerKelas).forEach(([kid,d])=>{
      (d.tieBreak||[]).forEach((s,i)=> tieRows.push([kelasNamaOf(kid), i+1, s]));
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(tieRows, [16,16,26]), 'Mapel Prioritas');

    // --- Sheet: Nilai Asli — Semua Kelas & Catur Wulan (format panjang) ---
    const nilaiRows = [['Kelas','Catur Wulan','ID Siswa','Nama Siswa','Mapel','Nilai Asli']];
    Object.entries(dataPerKelas).forEach(([kid,d])=>{
      const kNama = kelasNamaOf(kid);
      CATUR_KEYS.forEach(cw=>{
        const scoresCw = (d.scores && d.scores[cw]) || {};
        Object.entries(scoresCw).forEach(([sid,sc])=>{
          const namaSiswa = (studentsMaster[sid]||{}).nama || sid;
          Object.entries(sc.mapel||{}).forEach(([mapel,nilai])=>{
            nilaiRows.push([kNama, CATUR_LABELS[cw]||cw, sid, namaSiswa, mapel, nilai]);
          });
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(nilaiRows, [16,16,16,22,20,10]), 'Nilai Asli (Semua)');

    // --- Sheet: Absen & Sikap per Catur Wulan — Semua Kelas ---
    const sikapRows = [['Kelas','Catur Wulan','ID Siswa','Nama Siswa','Sakit','Ijin','Alpa','Potongan (Asli)','Potongan (Raport)','Peringkat Manual','Kelakuan','Kerajinan','Kebersihan']];
    Object.entries(dataPerKelas).forEach(([kid,d])=>{
      const kNama = kelasNamaOf(kid);
      CATUR_KEYS.forEach(cw=>{
        const scoresCw = (d.scores && d.scores[cw]) || {};
        Object.entries(scoresCw).forEach(([sid,sc])=>{
          const namaSiswa = (studentsMaster[sid]||{}).nama || sid;
          const ab = sc.absen||{}; const sk = sc.sikap||{};
          sikapRows.push([kNama, CATUR_LABELS[cw]||cw, sid, namaSiswa, ab.sakit||0, ab.ijin||0, ab.alpa||0, sc.potongan||0, sc.potonganRaport||0, sc.peringkatManual??'', sk.kelakuan||'', sk.kerajinan||'', sk.kebersihan||'']);
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(sikapRows, [16,16,16,22,8,8,8,14,14,14,14,14,14]), 'Absen & Sikap (Semua)');

    // --- Sheet: Absensi Harian — Semua Kelas ---
    const absenHarianRows = [['Kelas','Tanggal','ID Siswa','Nama Siswa','Status (H/S/I/A)']];
    Object.entries(dataPerKelas).forEach(([kid,d])=>{
      const kNama = kelasNamaOf(kid);
      Object.entries(d.absensi||{}).forEach(([tgl,perSiswa])=>{
        Object.entries(perSiswa||{}).forEach(([sid,status])=>{
          const namaSiswa = (studentsMaster[sid]||{}).nama || sid;
          absenHarianRows.push([kNama, tgl, sid, namaSiswa, status]);
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(absenHarianRows, [16,14,16,22,16]), 'Absensi Harian (Semua)');

    // --- Sheet: Rank Override Rekap Gabungan ---
    const rankGabRows = [['Kelas','ID Siswa','Nama Siswa','Peringkat Manual (Gabungan)']];
    Object.entries(dataPerKelas).forEach(([kid,d])=>{
      const kNama = kelasNamaOf(kid);
      Object.entries(d.rankOverrideGabungan||{}).forEach(([sid,v])=>{
        if(v===null || v===undefined) return;
        const namaSiswa = (studentsMaster[sid]||{}).nama || sid;
        rankGabRows.push([kNama, sid, namaSiswa, v]);
      });
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(rankGabRows, [16,16,22,24]), 'Rank Manual Gabungan');

    // --- Sheet: Template Ijazah (ringkasan, bukan detail visual) ---
    const ijzRows = [['Kunci Tingkatan','Nama Madrasah di Template','Bingkai Depan Kustom?','Bingkai Belakang Kustom?','Jumlah Field Materi Tambahan']];
    Object.entries(ijazahTemplates).forEach(([key,t])=>{
      ijzRows.push([key, t.namaMadrasah||t.lembaga||'', (t.borderImgDepan||t.borderImg)?'Ya':'Tidak', t.borderImgBelakang?'Ya':'Tidak', (Array.isArray(t.materiTambahan) ? t.materiTambahan.length : (t.materiTambahan ? String(t.materiTambahan).split(',').length : 0))]);
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(ijzRows, [18,30,18,18,26]), 'Template Ijazah (ringkasan)');

    // --- Sheet: Pengguna (Users) ---
    const userRows = [['UID','Email','Nama','Role','Kelas Diampu (Guru)']];
    Object.entries(users).forEach(([uid,u])=>{
      const kelasDiampu = Object.keys(u.assignedKelas||{}).map(kid=>kelasNamaOf(kid)).join(', ');
      userRows.push([uid, u.email||'', u.displayName||'', ROLE_LABELS[u.role]||u.role||'', kelasDiampu]);
    });
    XLSX.utils.book_append_sheet(wb, sheetFromAOA(userRows, [26,26,22,16,26]), 'Pengguna');

    downloadWorkbook(wb, `backup-lengkap-${todayISO()}.xlsx`);
    toast('Backup Excel berhasil diunduh');
  }catch(e){
    console.error(e);
    toast('Gagal membuat backup Excel: ' + (e.message||e.code||e));
  }finally{
    btn.disabled = false;
  }
});

document.getElementById('restoreDbFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  const btn = document.getElementById('btnRestoreDb');
  const info = document.getElementById('restoreDbInfo');
  restoreDbPendingData = null;
  restoreSuratPendingData = null;
  btn.disabled = true;
  info.textContent = '';
  if(!file) return;
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    // Terima dua bentuk file: {_backupInfo, rapor:{...}} (hasil tombol Backup di atas)
    // ATAU langsung isi node 'rapor' itu sendiri (mis. hasil ekspor manual dari Firebase console).
    const raporData = (parsed && typeof parsed==='object' && 'rapor' in parsed) ? parsed.rapor : parsed;
    if(!raporData || typeof raporData!=='object'){ throw new Error('Format file tidak dikenali'); }
    restoreDbPendingData = raporData;
    restoreSuratPendingData = (parsed && typeof parsed==='object' && parsed.surat && typeof parsed.surat==='object') ? parsed.surat : null;
    const jumlahKelas = Object.keys(raporData.kelasList||{}).length;
    const jumlahSiswa = Object.keys(raporData.students||{}).length;
    info.textContent = `File terbaca: ${jumlahKelas} kelas, ${jumlahSiswa} siswa (global). Klik "Pulihkan Database" untuk melanjutkan.`;
    btn.disabled = false;
  }catch(err){
    console.error(err);
    info.textContent = 'Gagal membaca file: ' + err.message;
    toast('File backup tidak valid');
  }
});

document.getElementById('btnRestoreDb').addEventListener('click', async ()=>{
  if(!isAdmin()){ toast('Hanya Admin/Super Admin yang boleh memulihkan database'); return; }
  if(!db){ toast('Hubungkan Firebase dulu (masuk akun)'); return; }
  if(!restoreDbPendingData){ toast('Pilih file backup dulu'); return; }
  const ok1 = confirm('PERINGATAN: Memulihkan backup akan MENIMPA / MENGHAPUS seluruh data yang ada saat ini (semua kelas, siswa, nilai, absensi, ijazah) dan menggantinya dengan isi file backup. Tindakan ini TIDAK BISA DIBATALKAN begitu diproses. Lanjutkan?');
  if(!ok1) return;
  const konfirmasiTeks = prompt('Untuk mencegah restore tidak sengaja, ketik persis: PULIHKAN\n(huruf besar semua, tanpa spasi tambahan)');
  if(konfirmasiTeks !== 'PULIHKAN'){ toast('Dibatalkan — teks konfirmasi tidak cocok'); return; }
  try{
    toast('Membuat backup pengaman data SAAT INI dulu (sebelum ditimpa)… mohon tunggu');
    await buatDanUnduhBackupJson();
    toast('Backup pengaman terunduh. Memulihkan database… mohon tunggu, jangan tutup halaman ini');
    await db.ref('rapor').set(restoreDbPendingData);
    if(restoreSuratPendingData) await db.ref('surat').set(restoreSuratPendingData);
    toast('Database berhasil dipulihkan. Memuat ulang halaman…');
    setTimeout(()=> location.reload(), 1200);
  }catch(e){
    console.error(e);
    toast('Gagal memulihkan database: ' + e.message + ' — data SAAT INI belum tentu berubah, backup pengaman sudah terunduh kalau sempat.');
  }
});

