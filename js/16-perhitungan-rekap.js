/* ===================== Perhitungan (rumus dari Excel) ===================== */
function toRaportValue(v){
  if(!v) return 0; // kosong atau 0 -> tetap 0, bukan 4
  const rules = konversiRaportRules; // sudah terurut menurun berdasarkan min (lihat normalizeKonversiRaportRules)
  for(const r of rules){ if(v >= r.min) return r.nilai; }
  return rules.length ? rules[rules.length-1].nilai : 0;
}

function rankRows(rows, subjects){
  const tieSubs = (state.tieBreak||[]).filter(s=> subjects.includes(s));
  function compareRows(a,b){
    if(b.bersih !== a.bersih) return b.bersih - a.bersih;
    for(const subj of tieSubs){
      const idx = subjects.indexOf(subj);
      if(idx===-1) continue;
      const av = Number(a.nilaiAsli[idx]||0), bv = Number(b.nilaiAsli[idx]||0);
      if(bv !== av) return bv - av;
    }
    return 0;
  }
  const sorted = rows.slice().sort(compareRows);
  sorted.forEach((r,i)=>{
    if(i===0){ r.peringkatAuto = 1; r.peringkatTie = false; }
    else {
      const prev = sorted[i-1];
      const cmp = compareRows(prev, r);
      r.peringkatAuto = (cmp===0) ? prev.peringkatAuto : (i+1);
      r.peringkatTie = (cmp===0) && (prev.bersih===r.bersih);
    }
  });
  // Guru bisa mengedit peringkat sendiri untuk kasus nilai bersih sama (atau kasus lain),
  // tanpa memandang urutan Mapel Prioritas — override ini dipakai apa adanya jika terisi.
  rows.forEach(r=>{
    const manual = r.peringkatManual;
    if(manual!=null && manual!=='' && !isNaN(manual)){
      r.peringkat = Number(manual);
      r.peringkatOverride = true;
    } else {
      r.peringkat = r.peringkatAuto;
      r.peringkatOverride = false;
    }
  });
  return rows;
}

// scoresMap opsional: default state.scores (Catur Wulan yang sedang aktif). Dipakai juga oleh
// rekap gabungan akhir tahun dengan mengoper peta nilai rata-rata gabungan CW1+CW2+CW3.
function computeAll(scoresMap){
  const sc0 = scoresMap || state.scores;
  const students = orderedStudents();
  const rows = students.map(st=>{
    const sc = sc0[st.id] || {};
    const mapel = sc.mapel || {};
    const nilaiAsli = state.subjects.map(s=> Number(mapel[s]||0));
    const jumlah = nilaiAsli.reduce((a,b)=>a+b,0);            // U
    const pot = hitungPotonganAbsen(sc.absen||{});
    const potongan = pot.asli;                                  // V — otomatis dari absen
    const bersih = jumlah - potongan;                           // W
    const rata = state.subjects.length ? bersih/state.subjects.length : 0; // X
    const raport = nilaiAsli.map(toRaportValue);
    const raportJumlah = raport.reduce((a,b)=>a+b,0);
    const potonganRaport = pot.raport;                          // otomatis dari absen
    const raportBersih = raportJumlah - potonganRaport;
    const raportRata = state.subjects.length ? raportBersih/state.subjects.length : 0;
    return {
      id: st.id, no: st.no, nama: st.nama,
      nilaiAsli, raport, jumlah, potongan, bersih, rata,
      raportJumlah, potonganRaport, raportBersih, raportRata,
      absen: sc.absen||{}, sikap: sc.sikap||{},
      peringkatManual: (sc.peringkatManual!=null && sc.peringkatManual!=='') ? Number(sc.peringkatManual) : null
    };
  });
  return rankRows(rows, state.subjects);
}

// Menggabungkan nilai 3 Catur Wulan jadi satu nilai akhir per siswa per mapel (rata-rata dari
// catur wulan yang punya data), lalu diranking ulang — untuk rekap akhir tahun.
// overrideMap opsional: {studentId -> peringkat manual} khusus rekap gabungan (dataRoot('rankOverrideGabungan')).
function computeCombined(scoresByC, overrideMap){
  const ov = overrideMap || {};
  const subjects = state.subjects;
  const students = orderedStudents();
  const rows = students.map(st=>{
    const layers = CATUR_KEYS.map(cw=> (scoresByC[cw]||{})[st.id]).filter(Boolean);
    const n = layers.length || 1;
    const mapel = {};
    subjects.forEach(s=>{
      const sum = layers.reduce((a,l)=> a + Number((l.mapel||{})[s]||0), 0);
      mapel[s] = layers.length ? sum/layers.length : 0;
    });
    const nilaiAsli = subjects.map(s=> mapel[s]);
    const jumlah = nilaiAsli.reduce((a,b)=>a+b,0);
    const potongan = layers.reduce((a,l)=> a + hitungPotonganAbsen(l.absen||{}).asli, 0);
    const bersih = jumlah - potongan;
    const rata = subjects.length ? bersih/subjects.length : 0;
    const raport = nilaiAsli.map(toRaportValue);
    const raportJumlah = raport.reduce((a,b)=>a+b,0);
    const potonganRaport = layers.reduce((a,l)=> a + hitungPotonganAbsen(l.absen||{}).raport, 0);
    const raportBersih = raportJumlah - potonganRaport;
    const raportRata = subjects.length ? raportBersih/subjects.length : 0;
    const absen = {
      sakit: layers.reduce((a,l)=>a+Number((l.absen||{}).sakit||0),0),
      ijin: layers.reduce((a,l)=>a+Number((l.absen||{}).ijin||0),0),
      alpa: layers.reduce((a,l)=>a+Number((l.absen||{}).alpa||0),0),
    };
    const sikapSrc = (scoresByC.cw3||{})[st.id]?.sikap || (scoresByC.cw2||{})[st.id]?.sikap || (scoresByC.cw1||{})[st.id]?.sikap || {};
    const manual = ov[st.id];
    return {
      id: st.id, no: st.no, nama: st.nama,
      nilaiAsli, raport, jumlah, potongan, bersih, rata,
      raportJumlah, potonganRaport, raportBersih, raportRata,
      absen, sikap: sikapSrc, caturTerisi: layers.length,
      peringkatManual: (manual!=null && manual!=='') ? Number(manual) : null
    };
  });
  return rankRows(rows, subjects);
}

function caturDisplayLabel(){
  const custom = (state.caturMeta || {}).label;
  return custom || CATUR_LABELS[activeCatur] || '';
}

/* ===================== Rekap tables ===================== */
function renderRekap(){
  const m = state.meta;
  document.getElementById('printSchool').textContent = m.nama || 'MADRASAH TARBIYATUL ISLAM AL-HIDAYAH';
  document.getElementById('printAddr').textContent = m.alamat || '';
  document.getElementById('printKelas').textContent = m.kelas ? ('Kelas: ' + m.kelas) : '';
  document.getElementById('printCatur').textContent = 'Catur Wulan: ' + caturDisplayLabel();
  document.getElementById('printTahun').textContent = m.tahun ? ('Tahun Ajaran: ' + m.tahun + (m.tahunMasehi?(' / '+m.tahunMasehi):'')) : '';

  const rows = computeAll();
  const subjects = state.subjects;

  const tAsli = document.getElementById('tblAsli');
  tAsli.querySelector('thead').innerHTML = '<tr><th>No</th><th style="text-align:left;">Nama</th>' +
    subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('') +
    '<th>Jml</th><th>Absen</th><th>Bersih</th><th>Rata²</th><th>Rank</th></tr>';
  tAsli.querySelector('tbody').innerHTML = rows.length ? rows.map(r=>
    `<tr><td>${r.no}</td><td class="name">${escapeHtml(r.nama)}</td>` +
    r.nilaiAsli.map(v=>`<td class="num${Number(v)<=54?' nilaiMerah':''}">${v}</td>`).join('') +
    `<td class="num">${r.jumlah}</td><td class="num">${r.potongan}</td><td class="num">${r.bersih}</td><td class="num">${r.rata.toFixed(2)}</td>` +
    `<td class="num">` +
      `<input type="number" class="rankInput noprint" data-id="${r.id}" value="${r.peringkat}" style="width:48px;text-align:center;padding:3px;">` +
      `<span class="rankPrint">${r.peringkat}${r.peringkatOverride?(' '+icon('pencil','solo')):(r.peringkatTie?' *':'')}</span>` +
      `${r.peringkatOverride?(' <span class="hint noprint" title="Peringkat diedit manual oleh guru">'+icon('pencil','solo')+'</span>'):(r.peringkatTie?' <span class="hint noprint" title="Nilai bersih sama, belum ada mapel prioritas yang membedakan">*</span>':'')}` +
    `</td></tr>`
  ).join('') : '';
  tAsli.querySelectorAll('input.rankInput').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const id = inp.dataset.id;
      const v = inp.value.trim();
      dataRoot('scores/'+activeCatur+'/'+id).update({ peringkatManual: (v===''? null : Number(v)) })
        .then(()=> toast(v===''?'Peringkat dikembalikan ke otomatis':'Peringkat manual disimpan'));
    });
  });

  const tRap = document.getElementById('tblRaport');
  tRap.querySelector('thead').innerHTML = '<tr><th>No</th><th style="text-align:left;">Nama</th>' +
    subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('') +
    '<th>Jml</th><th>Absen</th><th>Bersih</th><th>Rata²</th>' +
    '<th>Kelakuan</th><th>Kerajinan</th><th>Kebersihan</th><th>Sakit</th><th>Ijin</th><th>Alpa</th></tr>';
  tRap.querySelector('tbody').innerHTML = rows.length ? rows.map(r=>
    `<tr><td>${r.no}</td><td class="name">${escapeHtml(r.nama)}</td>` +
    r.raport.map(v=>`<td class="num${Number(v)<=5?' nilaiMerah':''}">${v}</td>`).join('') +
    `<td class="num">${r.raportJumlah}</td><td class="num">${r.potonganRaport}</td><td class="num">${r.raportBersih}</td><td class="num">${r.raportRata.toFixed(2)}</td>` +
    `<td>${escapeHtml(r.sikap.kelakuan||'')}</td><td>${escapeHtml(r.sikap.kerajinan||'')}</td><td>${escapeHtml(r.sikap.kebersihan||'')}</td>` +
    `<td class="num">${r.absen.sakit||0}</td><td class="num">${r.absen.ijin||0}</td><td class="num">${r.absen.alpa||0}</td></tr>`
  ).join('') : '';

  const tAvg = document.getElementById('tblAvg');
  tAvg.querySelector('thead').innerHTML = '<tr>' + subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('') + '<th>Rata² Umum</th></tr>';
  if(rows.length){
    const sums = subjects.map((_,i)=> rows.reduce((a,r)=>a+r.nilaiAsli[i],0));
    const avgs = sums.map(s=> s/rows.length);
    const overall = avgs.reduce((a,b)=>a+b,0)/avgs.length;
    tAvg.querySelector('tbody').innerHTML = '<tr>' + avgs.map(a=>`<td class="num">${a.toFixed(1)}</td>`).join('') + `<td class="num"><strong>${overall.toFixed(2)}</strong></td></tr>`;
  } else {
    tAvg.querySelector('tbody').innerHTML = '';
  }

  const tAvgRap = document.getElementById('tblAvgRaport');
  tAvgRap.querySelector('thead').innerHTML = '<tr>' + subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('') + '<th>Rata² Umum</th></tr>';
  if(rows.length){
    const sumsRap = subjects.map((_,i)=> rows.reduce((a,r)=>a+r.raport[i],0));
    const avgsRap = sumsRap.map(s=> s/rows.length);
    const overallRap = avgsRap.reduce((a,b)=>a+b,0)/avgsRap.length;
    tAvgRap.querySelector('tbody').innerHTML = '<tr>' + avgsRap.map(a=>`<td class="num">${a.toFixed(2)}</td>`).join('') + `<td class="num"><strong>${overallRap.toFixed(2)}</strong></td></tr>`;
  } else {
    tAvgRap.querySelector('tbody').innerHTML = '';
  }

  let msg = document.getElementById('rekapEmptyMsg');
  if(!rows.length){
    if(!msg){
      msg = document.createElement('div');
      msg.id = 'rekapEmptyMsg';
      msg.className = 'empty';
      msg.textContent = activeKelasId ? 'Belum ada data siswa/nilai untuk direkap.' : 'Pilih atau buat kelas dulu di tab Kelas.';
      document.getElementById('rekapPrintArea').appendChild(msg);
    } else {
      msg.textContent = activeKelasId ? 'Belum ada data siswa/nilai untuk direkap.' : 'Pilih atau buat kelas dulu di tab Kelas.';
    }
  } else if(msg){
    msg.remove();
  }
}

document.getElementById('btnExportRekap').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const rows = computeAll();
  if(!rows.length){ toast('Belum ada data untuk diekspor'); return; }
  const subjects = state.subjects;
  const wb = XLSX.utils.book_new();

  const asliRows = [['No','Nama', ...subjects, 'Jml','Absen','Bersih','Rata²','Peringkat']];
  rows.forEach(r=> asliRows.push([r.no, r.nama, ...r.nilaiAsli, r.jumlah, r.potongan, r.bersih, Number(r.rata.toFixed(2)), r.peringkat]));
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(asliRows, [4,22,...subjects.map(()=>10),8,8,8,8,10]), 'Nilai Asli');

  const rapRows = [['No','Nama', ...subjects, 'Jml','Absen','Bersih','Rata²', 'Kelakuan','Kerajinan','Kebersihan','Sakit','Ijin','Alpa']];
  rows.forEach(r=> rapRows.push([r.no, r.nama, ...r.raport, r.raportJumlah, r.potonganRaport, r.raportBersih, Number(r.raportRata.toFixed(2)), r.sikap.kelakuan||'', r.sikap.kerajinan||'', r.sikap.kebersihan||'', r.absen.sakit||0, r.absen.ijin||0, r.absen.alpa||0]));
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rapRows, [4,22,...subjects.map(()=>8),8,8,8,8,10,10,10,8,8,8]), 'Nilai Raport');

  const sums = subjects.map((_,i)=> rows.reduce((a,r)=>a+r.nilaiAsli[i],0));
  const avgs = sums.map(s=> Number((s/rows.length).toFixed(2)));
  const overall = Number((avgs.reduce((a,b)=>a+b,0)/avgs.length).toFixed(2));
  const avgRows = [[...subjects, 'Rata² Umum'], [...avgs, overall]];
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(avgRows, [...subjects.map(()=>10),12]), 'Rata-rata Kelas (Asli)');

  const sumsRap = subjects.map((_,i)=> rows.reduce((a,r)=>a+r.raport[i],0));
  const avgsRap = sumsRap.map(s=> Number((s/rows.length).toFixed(2)));
  const overallRap = Number((avgsRap.reduce((a,b)=>a+b,0)/avgsRap.length).toFixed(2));
  const avgRapRows = [[...subjects, 'Rata² Umum'], [...avgsRap, overallRap]];
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(avgRapRows, [...subjects.map(()=>10),12]), 'Rata-rata Kelas (Raport)');

  downloadWorkbook(wb, `rekap-${kelasFileTag()}.xlsx`);
});

/* ===================== Rekap Akhir Tahun (Gabungan CW1+CW2+CW3) ===================== */
let rekapGabunganRows = null;
let gabunganScoresByC = null;
let gabunganOverride = {};
document.getElementById('btnMuatRekapGabungan').addEventListener('click', async ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const area = document.getElementById('rekapGabunganArea');
  area.innerHTML = '<div class="hint">Memuat nilai 3 catur wulan…</div>';
  try{
    const [snaps, ovSnap] = await Promise.all([
      Promise.all(CATUR_KEYS.map(cw=> dataRoot('scores/'+cw).get())),
      dataRoot('rankOverrideGabungan').get()
    ]);
    const scoresByC = {};
    CATUR_KEYS.forEach((cw,i)=> scoresByC[cw] = snaps[i].val() || {});
    gabunganScoresByC = scoresByC;
    gabunganOverride = ovSnap.val() || {};
    rekapGabunganRows = computeCombined(scoresByC, gabunganOverride);
    renderRekapGabungan(rekapGabunganRows, scoresByC);
    document.getElementById('btnExportRekapGabungan').style.display = '';
    document.getElementById('btnPrintRekapGabungan').style.display = '';
  }catch(e){
    console.error(e);
    area.innerHTML = '<div class="empty">Gagal memuat rekap gabungan.</div>';
    toast('Gagal memuat rekap gabungan: '+e.message);
  }
});

function renderRekapGabungan(rows, scoresByC){
  const area = document.getElementById('rekapGabunganArea');
  const subjects = state.subjects;
  const m = state.meta || {};
  if(!rows.length){
    area.innerHTML = '<div class="empty">Belum ada data siswa/nilai untuk direkap.</div>';
    return;
  }
  const caturTerisiCount = CATUR_KEYS.filter(cw=> Object.keys(scoresByC[cw]||{}).length>0).length;
  const head = '<tr><th>No</th><th style="text-align:left;">Nama</th>' +
    subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('') +
    '<th>Jml</th><th>Absen</th><th>Bersih</th><th>Rata²</th><th>Rank</th><th>CW Terisi</th></tr>';
  const body = rows.map(r=>
    `<tr><td>${r.no}</td><td class="name">${escapeHtml(r.nama)}</td>` +
    r.nilaiAsli.map(v=>`<td class="num${Number(v)<=54?' nilaiMerah':''}">${v.toFixed(1)}</td>`).join('') +
    `<td class="num">${r.jumlah.toFixed(1)}</td><td class="num">${r.potongan}</td><td class="num">${r.bersih.toFixed(1)}</td><td class="num">${r.rata.toFixed(2)}</td>` +
    `<td class="num">` +
      `<input type="number" class="rankInputGab noprint" data-id="${r.id}" value="${r.peringkat}" style="width:48px;text-align:center;padding:3px;">` +
      `<span class="rankPrint">${r.peringkat}${r.peringkatOverride?(' '+icon('pencil','solo')):(r.peringkatTie?' *':'')}</span>` +
      `${r.peringkatOverride?(' <span class="hint noprint" title="Peringkat diedit manual oleh guru">'+icon('pencil','solo')+'</span>'):(r.peringkatTie?' <span class="hint noprint" title="Nilai bersih sama, belum ada mapel prioritas yang membedakan">*</span>':'')}` +
    `</td>` +
    `<td class="num">${r.caturTerisi}/3</td></tr>`
  ).join('');
  area.innerHTML = `
    <div class="certframe">
      <div class="certHead">
        <img src="${LOGO_DATA_URI}" class="certLogo" alt="Logo Madrasah">
        <div class="certHeadText">
          <div class="school">${escapeHtml(m.nama||'')}</div>
          <div class="addr">${escapeHtml(m.alamat||'')}</div>
        </div>
      </div>
      <div class="meta">
        <span>Kelas: ${escapeHtml(m.kelas||'')}</span><span>Rekap Akhir Tahun (Gabungan ${caturTerisiCount}/3 Catur Wulan)</span><span>Tahun Ajaran: ${escapeHtml(m.tahun||'')}${m.tahunMasehi?(' / '+escapeHtml(m.tahunMasehi)):''}</span>
      </div>
    </div>
    <div class="tablewrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>
    <p class="hint">Kolom "CW Terisi" menunjukkan dari berapa catur wulan nilai siswa tsb dirata-rata — kalau belum 3/3, rekap ini masih sementara. Kolom "Rank" bisa diedit langsung oleh guru untuk siswa yang nilai bersihnya sama; kosongkan untuk kembali ke perhitungan otomatis.</p>
  `;
  area.querySelectorAll('input.rankInputGab').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const id = inp.dataset.id;
      const v = inp.value.trim();
      gabunganOverride[id] = (v===''? null : Number(v));
      dataRoot('rankOverrideGabungan/'+id).set(v===''?null:Number(v)).then(()=>{
        rekapGabunganRows = computeCombined(gabunganScoresByC, gabunganOverride);
        renderRekapGabungan(rekapGabunganRows, gabunganScoresByC);
        toast(v===''?'Peringkat gabungan dikembalikan ke otomatis':'Peringkat gabungan manual disimpan');
      });
    });
  });
}

document.getElementById('btnExportRekapGabungan').addEventListener('click', ()=>{
  if(!rekapGabunganRows || !rekapGabunganRows.length){ toast('Muat rekap gabungan dulu'); return; }
  const subjects = state.subjects;
  const rows = rekapGabunganRows;
  const wb = XLSX.utils.book_new();
  const asliRows = [['No','Nama', ...subjects, 'Jml','Absen','Bersih','Rata²','Peringkat','CW Terisi','Raport Jml','Raport Absen','Raport Bersih']];
  rows.forEach(r=> asliRows.push([r.no, r.nama, ...r.nilaiAsli.map(v=>Number(v.toFixed(2))), Number(r.jumlah.toFixed(2)), r.potongan, Number(r.bersih.toFixed(2)), Number(r.rata.toFixed(2)), r.peringkat, r.caturTerisi+'/3', r.raportJumlah, r.potonganRaport, r.raportBersih]));
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(asliRows, [4,22,...subjects.map(()=>10),8,8,8,8,10,8,10,10,10]), 'Rekap Gabungan');
  downloadWorkbook(wb, `rekap-akhir-tahun-${kelasFileTag()}.xlsx`);
});

document.getElementById('btnPrintRekapGabungan').addEventListener('click', ()=>{
  if(!rekapGabunganRows || !rekapGabunganRows.length){ toast('Muat rekap gabungan dulu'); return; }
  fitPrintTables(document.getElementById('rekapGabunganCard'));
  document.body.classList.add('printingRekapGabungan');
  window.print();
  setTimeout(()=>{ document.body.classList.remove('printingRekapGabungan'); resetPrintPagePrefsToDefault(); }, 500);
});

/* Cetak Rekap Ini & Cetak Kartu Ini dipisah supaya tidak nyambung jadi satu kertas:
   masing-masing menyembunyikan bagian lain sebelum window.print() dipanggil. */
function printRekapOnly(){
  fitPrintTables(document.getElementById('rekapPrintArea'));
  document.body.classList.add('printingRekapOnly');
  window.print();
  setTimeout(()=>{ document.body.classList.remove('printingRekapOnly'); resetPrintPagePrefsToDefault(); }, 500);
}
function printKartuSiswa(){
  const area = document.getElementById('cardArea');
  if(!area || !area.innerHTML.trim()){ toast('Tampilkan kartu siswa dulu'); return; }
  fitPrintTables(area);
  document.body.classList.add('printingKartuSiswa');
  window.print();
  setTimeout(()=>{ document.body.classList.remove('printingKartuSiswa'); resetPrintPagePrefsToDefault(); }, 500);
}

