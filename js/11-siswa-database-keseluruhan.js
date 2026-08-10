/* ===================== Database Siswa Keseluruhan (khusus Staf/Admin/Super Admin) =====================
   Berbeda dari "Daftar Siswa" (studentTable) yang hanya menampilkan siswa DI KELAS AKTIF, tabel ini
   memakai state.studentsMaster APA ADANYA (sudah global lintas kelas — lihat attachStudentsMasterListener),
   sehingga siswa yang sudah pindah/lulus dari kelas aktif tetap terlihat di sini. */
function renderDatabaseSiswaGlobal(){
  const canAdminExtra = isStaf() || isAdmin();
  const tbody = document.querySelector('#globalSiswaTable tbody');
  if(!tbody || !canAdminExtra) return; // tidak dirender kalau tidak berhak (kartu juga disembunyikan di applyRoleUI)
  const searchInput = document.getElementById('globalSiswaSearch');
  const q = (searchInput && searchInput.value || '').trim().toLowerCase();
  const all = Object.entries(state.studentsMaster);
  const list = all.filter(([id,m])=>{
    if(!q) return true;
    const hay = [m.nama,m.nisn,m.nis,m.alamat,m.ayah,m.ibu,m.wali].map(v=>(v||'').toLowerCase()).join(' ');
    return hay.includes(q);
  }).sort((a,b)=> String(a[1].nama||'').localeCompare(String(b[1].nama||'')));
  tbody.innerHTML = '';
  document.getElementById('globalSiswaEmpty').style.display = all.length ? 'none' : '';
  list.forEach(([id,m])=>{
    const ak = state.kelasList[m.kelasAktifId];
    const kelasAktifTxt = ak ? escapeHtml(`${ak.tingkatan||''} ${ak.kelasNama||''} · ${ak.tahun||''}`.trim()) : '<span class="hint">tidak ada kelas aktif</span>';
    const jumlahRiwayat = Object.keys(m.riwayatKelas||{}).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="name">${escapeHtml(m.nama||'-')}</td>
      <td class="num">${escapeHtml(m.nisn||'-')}</td>
      <td>${escapeHtml(m.jk||'-')}</td>
      <td style="text-align:left;">${kelasAktifTxt}</td>
      <td>${jumlahRiwayat} kelas</td>
      <td class="noprint"><button class="secondary" data-act="riwayat" data-id="${id}" type="button">Lihat Riwayat</button></td>`;
    tbody.appendChild(tr);
  });
  if(all.length && !list.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="empty" style="padding:16px;">Tidak ada siswa yang cocok dengan pencarian.</td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('button[data-act="riwayat"]').forEach(b=>{
    b.addEventListener('click', ()=> showGlobalRiwayat(b.dataset.id));
  });
}
document.getElementById('globalSiswaSearch')?.addEventListener('input', renderDatabaseSiswaGlobal);

async function showGlobalRiwayat(id){
  const m = state.studentsMaster[id];
  if(!m) return;
  const wrap = document.getElementById('globalRiwayatWrap');
  const title = document.getElementById('globalRiwayatTitle');
  const box = document.getElementById('globalRiwayatBox');
  if(!wrap || !title || !box) return;
  wrap.style.display = '';
  title.textContent = `Riwayat Kelas — ${m.nama||''}`;
  await renderRiwayatKelasInto(id, box);
  wrap.scrollIntoView({behavior:'smooth', block:'start'});
}

document.getElementById('btnExportSiswaGlobal')?.addEventListener('click', ()=>{
  const rows = [['Nama','NISN','NIS','JK','Alamat','Ayah','Ibu','Wali','No. HP Wali/Ortu','Kelas Aktif Saat Ini','Tahun Ajaran Aktif','Jumlah Kelas Ditempuh','Riwayat Kelas (ringkas)']];
  Object.values(state.studentsMaster).sort((a,b)=> String(a.nama||'').localeCompare(String(b.nama||''))).forEach(m=>{
    const ak = state.kelasList[m.kelasAktifId] || {};
    const riwayatTxt = Object.values(m.riwayatKelas||{})
      .sort((a,b)=> String(a.tahun||'').localeCompare(String(b.tahun||'')))
      .map(r=> `${r.tingkatan||''} ${r.kelasNama||''} (${r.tahun||''})`.trim()).join('; ');
    rows.push([
      m.nama||'', m.nisn||'', m.nis||'', m.jk||'', m.alamat||'', m.ayah||'', m.ibu||'', m.wali||'', m.telp||'',
      ak.kelasNama ? `${ak.tingkatan||''} ${ak.kelasNama||''}`.trim() : '', ak.tahun||'',
      Object.keys(m.riwayatKelas||{}).length, riwayatTxt
    ]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[22,14,12,4,24,18,18,18,16,20,14,10,40]), 'Database Siswa Keseluruhan');
  downloadWorkbook(wb, `database-siswa-keseluruhan-${todayISO()}.xlsx`);
});

