/* ===================== Kartu Raport per siswa ===================== */
document.getElementById('btnBuildCard').addEventListener('click', ()=>{
  const id = document.getElementById('pickPrintStudent').value;
  const area = document.getElementById('cardArea');
  if(!id){ area.innerHTML = ''; toast('Pilih siswa dulu'); return; }
  const rows = computeAll();
  const r = rows.find(x=>x.id===id);
  if(!r){ area.innerHTML = ''; return; }
  const m = state.meta;
  const subjects = state.subjects;

  let tableRows = subjects.map((s,i)=>
    `<tr><td class="name" style="text-align:left;">${escapeHtml(s)}</td><td class="num${Number(r.nilaiAsli[i])<=54?' nilaiMerah':''}">${r.nilaiAsli[i]}</td><td class="num${Number(r.raport[i])<=5?' nilaiMerah':''}">${r.raport[i]}</td></tr>`
  ).join('');

  area.innerHTML = `
    <div class="certframe" style="margin-top:14px;">
      <div class="certHead">
        <img src="${getBrandLogo()}" class="certLogo" alt="Logo Madrasah">
        <div class="certHeadText">
          <div class="school">${escapeHtml(m.nama||'')}</div>
          <div class="addr">${escapeHtml(m.alamat||'')}</div>
        </div>
      </div>
      <div class="meta">
        <span>Kelas: ${escapeHtml(m.kelas||'')}</span>
        <span>Catur Wulan: ${escapeHtml(caturDisplayLabel())}</span>
        <span>Tahun Ajaran: ${escapeHtml(m.tahun||'')}${m.tahunMasehi?(' / '+escapeHtml(m.tahunMasehi)):''}</span>
      </div>
      <h3 style="text-align:center;margin-top:14px;">${escapeHtml(r.nama)} <span class="hint">(No. ${r.no})</span></h3>
      <div class="tablewrap">
        <table>
          <thead><tr><th style="text-align:left;">Mata Pelajaran</th><th>Nilai Asli</th><th>Nilai Raport</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="row" style="margin-top:12px;">
        <div class="field"><label>Jumlah Nilai Asli</label><div class="num">${r.jumlah}</div></div>
        <div class="field"><label>Dikurangi Absen (Asli)</label><div class="num">${r.potongan}</div></div>
        <div class="field"><label>Jumlah Bersih</label><div class="num">${r.bersih}</div></div>
        <div class="field"><label>Rata-rata</label><div class="num">${r.rata.toFixed(2)}</div></div>
        <div class="field"><label>Peringkat</label><div class="num">${r.peringkat}${r.peringkatOverride?(' '+icon('pencil','solo')):''}</div></div>
      </div>
      <div class="row">
        <div class="field"><label>Jumlah Nilai Raport</label><div class="num">${r.raportJumlah}</div></div>
        <div class="field"><label>Dikurangi Absen (Raport)</label><div class="num">${r.potonganRaport}</div></div>
        <div class="field"><label>Raport Bersih</label><div class="num">${r.raportBersih}</div></div>
        <div class="field"><label>Rata-rata Raport</label><div class="num">${r.raportRata.toFixed(2)}</div></div>
      </div>
      <div class="row">
        <div class="field"><label>Kelakuan</label><div>${escapeHtml(r.sikap.kelakuan||'-')}</div></div>
        <div class="field"><label>Kerajinan</label><div>${escapeHtml(r.sikap.kerajinan||'-')}</div></div>
        <div class="field"><label>Kebersihan</label><div>${escapeHtml(r.sikap.kebersihan||'-')}</div></div>
        <div class="field"><label>Sakit / Ijin / Alpa</label><div>${r.absen.sakit||0} / ${r.absen.ijin||0} / ${r.absen.alpa||0}</div></div>
      </div>
      <div class="row" style="margin-top:24px;justify-content:space-between;">
        <div class="field" style="text-align:center;">Mengetahui,<br>Kepala Madrasah<br><br><br><strong>${escapeHtml(m.kepala||'..............................')}</strong></div>
        <div class="field" style="text-align:center;">${escapeHtml(m.tempat||'')}, ${m.tanggal||'...................................'}<br>Wali Kelas<br><br><br><strong>${escapeHtml(m.wali||'..............................')}</strong></div>
      </div>
    </div>
    <div class="btnrow noprint"><button class="gold" onclick="printKartuSiswa()">${icon('printer')}Cetak Kartu Ini</button></div>
  `;
});

