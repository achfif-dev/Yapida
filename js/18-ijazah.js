/* ===================== IJAZAH ===================== */
let ijzPendingFoto = null;   // dataURI menunggu disimpan untuk siswa yang sedang diedit
let ijzPendingBorderDepan = undefined; // undefined = tidak diubah, '' = dihapus, string = baru
let ijzPendingBorderBelakang = undefined; // undefined = tidak diubah, '' = dihapus, string = baru

function currentTingkatanKey(){
  if(!activeKelasId) return null;
  const k = state.kelasList[activeKelasId];
  if(!k) return null;
  if(!k.kelasAkhir) return null; // Ijazah hanya berlaku untuk kelas yang ditandai sebagai kelas/tingkat akhir
  return tingkatanKey(k.tingkatan);
}

function fileToDataUri(file, maxW){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(reader.error);
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(maxW && w>maxW){ h = Math.round(h*maxW/w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderIjazahTab(){
  const noKelas = document.getElementById('ijazahNoKelas');
  const notSupported = document.getElementById('ijazahNotSupported');
  const body = document.getElementById('ijazahBody');
  if(!activeKelasId){
    noKelas.style.display = ''; notSupported.style.display = 'none'; body.style.display = 'none';
    return;
  }
  const key = currentTingkatanKey();
  const k = state.kelasList[activeKelasId] || {};
  if(!key){
    noKelas.style.display = 'none';
    notSupported.style.display = '';
    if(!tingkatanKey(k.tingkatan)){
      notSupported.innerHTML = `Tingkatan kelas aktif ini (<strong>${escapeHtml(k.tingkatan||'-')}</strong>) belum punya template Ijazah. Template tersedia untuk: TPQ, Ibtidaiyah, Tsanawiyah.`;
    } else if(!k.kelasAkhir){
      notSupported.innerHTML = `Tab Ijazah hanya aktif untuk kelas yang ditandai sebagai <strong>Kelas / Tingkat Akhir</strong>. Kelas aktif saat ini (<strong>${escapeHtml(k.tingkatan||'')} ${escapeHtml(k.kelasNama||'')}</strong>) belum ditandai demikian — buka tab Kelas → "Ubah" kelas ini → centang "Kelas / Tingkat Akhir (kelulusan)" jika kelas ini memang kelas kelulusan.`;
    } else {
      notSupported.textContent = 'Kelas aktif ini belum mendukung Ijazah.';
    }
    body.style.display = 'none';
    return;
  }
  noKelas.style.display = 'none';
  notSupported.style.display = 'none';
  body.style.display = '';

  document.getElementById('ijazahTingkatanLabel').textContent = k.tingkatan + ' — ' + (k.kelasNama||'');

  // ---- form Data Umum ----
  const u = state.ijazahUmum || {};
  document.getElementById('ijzNoAwal').value = u.noAwal || '';
  document.getElementById('ijzDariH').value = u.dariH || '';
  document.getElementById('ijzDariM').value = u.dariM || '';
  document.getElementById('ijzSampaiH').value = u.sampaiH || '';
  document.getElementById('ijzSampaiM').value = u.sampaiM || '';
  document.getElementById('ijzTempat').value = u.tempat || 'Bangkalan';
  document.getElementById('ijzTerbitH').value = u.terbitH || '';
  document.getElementById('ijzTerbitM').value = u.terbitM || '';

  // ---- form Template ----
  const tpl = getIjazahTemplate(key);
  document.getElementById('tplLembagaAtas').value = tpl.lembagaAtas || '';
  document.getElementById('tplNamaMadrasah').value = tpl.namaMadrasah || '';
  document.getElementById('tplAlamat').value = tpl.alamat || '';
  document.getElementById('tplTingkatLabel').value = tpl.tingkatLabel || '';
  document.getElementById('tplJudulBelakang').value = tpl.judulBelakang || '';
  document.getElementById('tplKepalaLabel').value = tpl.kepalaLabel || '';
  document.getElementById('tplKepalaNama').value = tpl.kepalaNama || '';
  document.getElementById('tplKetuaLabel').value = tpl.ketuaLabel || '';
  document.getElementById('tplKetuaNama').value = tpl.ketuaNama || '';
  document.getElementById('tplPanitiaKetua').value = tpl.panitiaKetua || '';
  document.getElementById('tplPanitiaSekretaris').value = tpl.panitiaSekretaris || '';
  document.getElementById('tplMateriTambahan').value = (tpl.materiTambahan||[]).join(', ');
  document.getElementById('tplShowArabTop').checked = tpl.showArabTop !== false;
  document.getElementById('tplArabTop').value = tpl.arabTop || '';
  document.getElementById('tplScale').value = tpl.contentScale || 100;
  document.getElementById('tplFontPreset').value = tpl.fontPreset || 'klasik';
  document.getElementById('tplFontPresetArab').value = tpl.fontPresetArab || 'amiri';
  document.getElementById('tplFontSizeLatin').value = tpl.fontScaleLatin || 100;
  document.getElementById('tplFontSizeArab').value = tpl.fontScaleArab || 100;
  updateFontPreview();
  document.getElementById('tplPanitiaRow').style.display = tpl.showPanitia ? '' : 'none';
  document.getElementById('tplMateriTambahanRow').style.display = (key==='tpq') ? '' : 'none';

  // ---- status bingkai kustom per tingkatan (depan/belakang terpisah) ----
  ijzPendingBorderDepan = undefined;
  ijzPendingBorderBelakang = undefined;
  document.getElementById('tplBorderFileDepan').value = '';
  document.getElementById('tplBorderFileBelakang').value = '';
  document.getElementById('ijazahTingkatanLabelBingkai').textContent = k.tingkatan || '';
  const borderDepanAda = !!(tpl.borderImgDepan || tpl.borderImg);
  const borderBelakangAda = !!tpl.borderImgBelakang;
  document.getElementById('tplBorderDepanStatus').textContent = borderDepanAda ? 'Bingkai kustom tersimpan untuk tingkatan ini.' : 'Belum ada bingkai kustom — memakai bingkai bawaan.';
  document.getElementById('tplBorderBelakangStatus').textContent = borderBelakangAda ? 'Bingkai kustom tersimpan untuk tingkatan ini.' : 'Belum ada bingkai kustom — memakai bingkai bawaan.';

  // ---- pickers ----
  const students = orderedStudents();
  ['ijzPickStudent','ijzPickPreview'].forEach(selId=>{
    const sel = document.getElementById(selId);
    const cur = sel.value;
    sel.innerHTML = students.length ? students.map(s=>`<option value="${s.id}">${s.no}. ${escapeHtml(s.nama)}</option>`).join('') : '<option value="">— belum ada siswa —</option>';
    if(cur) sel.value = cur;
  });
  renderIjzStudentForm();
}

function renderIjzStudentForm(){
  const sel = document.getElementById('ijzPickStudent');
  const id = sel.value;
  const empty = document.getElementById('ijzStudentEmpty');
  const form = document.getElementById('ijzStudentForm');
  if(!id){ empty.style.display=''; form.style.display='none'; ijzSelectedStudentId=null; return; }
  ijzSelectedStudentId = id;
  empty.style.display = 'none'; form.style.display = '';
  const st = orderedStudents().find(s=>s.id===id) || {};
  const rec = state.ijazah[id] || {};
  const u = state.ijazahUmum || {};
  document.getElementById('ijzNoIjazah').value = rec.noIjazah || (u.noAwal ? String(Number(u.noAwal) + (st.no||1) - 1) : '');
  document.getElementById('ijzNoInduk').value = rec.noInduk || st.nis || st.nisn || '';
  ijzPendingFoto = null;
  document.getElementById('ijzFotoFile').value = '';
}
document.getElementById('ijzPickStudent').addEventListener('change', renderIjzStudentForm);

document.getElementById('ijzFotoFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{ ijzPendingFoto = await fileToDataUri(file, 300); toast('Foto siap disimpan — klik "Simpan Data Siswa Ini"'); }
  catch(err){ console.error(err); toast('Gagal membaca foto'); }
});

document.getElementById('btnSaveIjzSiswa').addEventListener('click', ()=>{
  if(!activeKelasId || !ijzSelectedStudentId){ toast('Pilih siswa dulu'); return; }
  const payload = {
    noIjazah: document.getElementById('ijzNoIjazah').value.trim(),
    noInduk: document.getElementById('ijzNoInduk').value.trim(),
  };
  if(ijzPendingFoto) payload.foto = ijzPendingFoto;
  else if(state.ijazah[ijzSelectedStudentId] && state.ijazah[ijzSelectedStudentId].foto) payload.foto = state.ijazah[ijzSelectedStudentId].foto;
  dataRoot('ijazah/'+ijzSelectedStudentId).set(payload).then(()=>{
    toast('Data ijazah siswa disimpan');
    ijzPendingFoto = null;
  });
});

document.getElementById('btnSaveIjazahUmum').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const payload = {
    noAwal: document.getElementById('ijzNoAwal').value.trim(),
    dariH: document.getElementById('ijzDariH').value.trim(),
    dariM: document.getElementById('ijzDariM').value.trim(),
    sampaiH: document.getElementById('ijzSampaiH').value.trim(),
    sampaiM: document.getElementById('ijzSampaiM').value.trim(),
    tempat: document.getElementById('ijzTempat').value.trim(),
    terbitH: document.getElementById('ijzTerbitH').value.trim(),
    terbitM: document.getElementById('ijzTerbitM').value.trim(),
  };
  dataRoot('ijazahUmum').set(payload).then(()=>toast('Data umum ijazah disimpan'));
});

document.getElementById('tplBorderFileDepan').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{ ijzPendingBorderDepan = await fileToDataUri(file, 900); toast('Bingkai depan siap — klik "Simpan Template"'); }
  catch(err){ console.error(err); toast('Gagal membaca gambar bingkai'); }
});
document.getElementById('btnClearBorderDepan').addEventListener('click', ()=>{
  if(!confirm('Hapus bingkai depan kustom dari template tingkatan ini? Jangan lupa klik "Simpan Template" setelah ini agar perubahan tersimpan.')) return;
  ijzPendingBorderDepan = '';
  toast('Bingkai depan akan dihapus — klik "Simpan Template"');
});
document.getElementById('tplBorderFileBelakang').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{ ijzPendingBorderBelakang = await fileToDataUri(file, 900); toast('Bingkai belakang siap — klik "Simpan Template"'); }
  catch(err){ console.error(err); toast('Gagal membaca gambar bingkai'); }
});
document.getElementById('btnClearBorderBelakang').addEventListener('click', ()=>{
  if(!confirm('Hapus bingkai belakang kustom dari template tingkatan ini? Jangan lupa klik "Simpan Template" setelah ini agar perubahan tersimpan.')) return;
  ijzPendingBorderBelakang = '';
  toast('Bingkai belakang akan dihapus — klik "Simpan Template"');
});

document.getElementById('btnSaveTemplate').addEventListener('click', ()=>{
  const key = currentTingkatanKey();
  if(!key){ toast('Tingkatan kelas aktif tidak didukung'); return; }
  const existing = getIjazahTemplate(key);
  const payload = Object.assign({}, existing, {
    lembagaAtas: document.getElementById('tplLembagaAtas').value.trim(),
    namaMadrasah: document.getElementById('tplNamaMadrasah').value.trim(),
    alamat: document.getElementById('tplAlamat').value.trim(),
    tingkatLabel: document.getElementById('tplTingkatLabel').value.trim(),
    judulBelakang: document.getElementById('tplJudulBelakang').value.trim(),
    kepalaLabel: document.getElementById('tplKepalaLabel').value.trim(),
    kepalaNama: document.getElementById('tplKepalaNama').value.trim(),
    ketuaLabel: document.getElementById('tplKetuaLabel').value.trim(),
    ketuaNama: document.getElementById('tplKetuaNama').value.trim(),
    panitiaKetua: document.getElementById('tplPanitiaKetua').value.trim(),
    panitiaSekretaris: document.getElementById('tplPanitiaSekretaris').value.trim(),
    materiTambahan: document.getElementById('tplMateriTambahan').value.split(',').map(s=>s.trim()).filter(Boolean),
    showArabTop: document.getElementById('tplShowArabTop').checked,
    arabTop: document.getElementById('tplArabTop').value,
    contentScale: Number(document.getElementById('tplScale').value) || 100,
    fontPreset: document.getElementById('tplFontPreset').value || 'klasik',
    fontPresetArab: document.getElementById('tplFontPresetArab').value || 'amiri',
    fontScaleLatin: Number(document.getElementById('tplFontSizeLatin').value) || 100,
    fontScaleArab: Number(document.getElementById('tplFontSizeArab').value) || 100,
  });
  if(ijzPendingBorderDepan !== undefined){ payload.borderImgDepan = ijzPendingBorderDepan; }
  if(ijzPendingBorderBelakang !== undefined){ payload.borderImgBelakang = ijzPendingBorderBelakang; }
  db.ref('rapor/ijazahTemplates/'+key).set(payload).then(()=>{
    toast('Template ijazah disimpan');
    ijzPendingBorderDepan = undefined;
    ijzPendingBorderBelakang = undefined;
    document.getElementById('tplBorderFileDepan').value = '';
    document.getElementById('tplBorderFileBelakang').value = '';
  });
});

function ijazahRowFor(studentId){
  const rows = computeAll();
  return rows.find(r=>r.id===studentId);
}

function buildIjazahHTML(studentId){
  const key = currentTingkatanKey();
  if(!key) return null;
  const tpl = getIjazahTemplate(key);
  const st = orderedStudents().find(s=>s.id===studentId);
  if(!st) return null;
  const row = ijazahRowFor(studentId) || {nilaiAsli: state.subjects.map(()=>0), raport: state.subjects.map(()=>0), jumlah:0, rata:0, peringkat:'-'};
  const rec = state.ijazah[studentId] || {};
  const u = state.ijazahUmum || {};
  const m = state.meta || {};
  const noIjazah = rec.noIjazah || '';
  const noInduk = rec.noInduk || st.nis || st.nisn || '';
  const fotoInner = rec.foto ? `<img src="${rec.foto}">` : 'Photo<br>3x4';
  const tahunH = (m.tahun||'').split('/')[0] || (m.tahun||'');
  const fontPreset = ijzFontPreset(tpl.fontPreset);
  const arabFont = ijzArabFont(tpl.fontPresetArab);
  const borderImgDepan = tpl.borderImgDepan || tpl.borderImg || ''; // borderImg = kompatibilitas data lama
  const borderImgBelakang = tpl.borderImgBelakang || '';
  const scaleLatin = (Number(tpl.fontScaleLatin)||100)/100;
  const scaleArab = (Number(tpl.fontScaleArab)||100)/100;
  const pageStyleParts = [];
  if(borderImgDepan) pageStyleParts.push(`background-image:url('${borderImgDepan}')`);
  pageStyleParts.push(`--ijzFontTitle:${fontPreset.title}`);
  pageStyleParts.push(`--ijzFontBody:${fontPreset.body}`);
  pageStyleParts.push(`--ijzFontArab:${arabFont.family}`);
  pageStyleParts.push(`--ijzScaleLatin:${scaleLatin}`);
  pageStyleParts.push(`--ijzScaleArab:${scaleArab}`);
  const borderStyle = ` style="${pageStyleParts.join(';')}"`;
  const borderClass = borderImgDepan ? ' hasCustomBorder' : '';

  const closing = (tpl.closingText||'')
    .replace('{DARI_M}', u.dariM||'').replace('{SAMPAI_M}', u.sampaiM||'')
    .replace(/\n/g,'<br>');
  const leadIntro = (tpl.leadIntro||'').replace(/\n/g,'<br>');
  const scl = (Number(tpl.contentScale)||100)/100;
  const gp = tpl.groupPos || {x:0,y:0};
  const innerTransformParts = [];
  if(gp.x || gp.y) innerTransformParts.push(`translate(${gp.x}px,${gp.y}px)`);
  if(scl!==1) innerTransformParts.push(`scale(${scl})`);
  const innerStyle = innerTransformParts.length ? ` style="transform:${innerTransformParts.join(' ')}; transform-origin:top center;"` : '';
  const arabTopHtml = escapeHtml(tpl.arabTop||'').replace(/\n/g,'<br>');
  const elPos = tpl.elPos || {};
  function elAttr(key, extraStyle){
    const p = elPos[key];
    const t = (p && (p.x||p.y)) ? `transform:translate(${p.x}px,${p.y}px);` : '';
    const style = `${extraStyle||''}${t}`;
    return ` data-ijzel="${key}"${style ? ` style="${style}"` : ''}`;
  }

  const front = `
    <div class="ijazahPage${borderClass}"${borderStyle}>
      <div class="ijazahInner"${innerStyle}>
        ${tpl.showArabTop!==false ? `<div class="ijazahArabTop"${elAttr('arabTop')}>${arabTopHtml}</div>` : ''}
        <div class="ijazahLembaga"${elAttr('lembaga')}>${escapeHtml(tpl.lembagaAtas||'')}</div>
        <div class="ijazahNos"><span${elAttr('noIjazah')}>No. Ijazah: ${escapeHtml(noIjazah)}</span><span class="ijazahTitleWord"${elAttr('titleIjazah','font-size:22px;')}>Ijazah</span><span${elAttr('noInduk')}>No. Induk: ${escapeHtml(noInduk)}</span></div>
        <div class="ijazahMadrasah"${elAttr('madrasah')}>${escapeHtml(tpl.namaMadrasah||'')}</div>
        <div class="ijazahAddr"${elAttr('addr')}>${escapeHtml(tpl.alamat||'')}</div>
        ${tpl.showTingkatLine ? `<div class="ijazahTingkat"${elAttr('tingkat')}>${escapeHtml(tpl.tingkatLabel||'')}</div>` : ''}
        <div class="ijazahTahun"${elAttr('tahun')}>TAHUN PELAJARAN : ${escapeHtml(m.tahun||'')}${m.tahunMasehi?(' / '+escapeHtml(m.tahunMasehi)):''}</div>
        ${tpl.showSesudahLine ? `<div${elAttr('sesudah')}>
        <div class="ijazahTahun">Sesudah diadakan Evaluasi Belajar Tahap Akhir (EBTA)</div>
        <div class="ijazahTahun">Dari tanggal ${escapeHtml(u.dariH||'')} H sampai tanggal ${escapeHtml(u.sampaiH||'')} H<br>atau tanggal ${escapeHtml(u.dariM||'')} M sampai tanggal ${escapeHtml(u.sampaiM||'')} M</div>
        </div>` : ''}
        <div class="ijazahLead"${elAttr('lead')}>${leadIntro}</div>
        <div class="ijazahNama"${elAttr('nama')}>${escapeHtml(st.nama||'')}</div>
        <div class="ijazahBioRow"${elAttr('bio1')}><span class="lbl">Lahir di</span><span>:</span><span class="val">${escapeHtml(st.tempatLahir||'')}</span></div>
        <div class="ijazahBioRow"${elAttr('bio2')}><span class="lbl">Pada Tanggal</span><span>:</span><span class="val">${escapeHtml(st.tglLahir||'')}</span></div>
        <div class="ijazahBioRow"${elAttr('bio3')}><span class="lbl">Putra / Putri dari</span><span>:</span><span class="val">${escapeHtml(st.ayah||st.wali||'')}</span></div>
        <div class="ijazahBioRow"${elAttr('bio4')}><span class="lbl">Alamat</span><span>:</span><span class="val">${escapeHtml(st.alamat||'')}</span></div>
        <div class="ijazahTelahLulus"${elAttr('closing')}>${closing}</div>
        <div class="ijazahFotoBox"${elAttr('foto')}>${fotoInner}</div>
        <div class="ijazahSignArea">
          <div${elAttr('signDate','text-align:right;')}>${escapeHtml(u.tempat||'Bangkalan')}, ${escapeHtml(u.terbitH||'')} H / ${escapeHtml(u.terbitM||'')} M</div>
          <div class="ttd"${elAttr('signKepala','text-align:right;')}>${escapeHtml(tpl.kepalaLabel||'')}<span class="ttdNama">( ${escapeHtml(tpl.kepalaNama||'')} )</span></div>
          <div class="ijazahPengurusBlock"${elAttr('pengurus')}>
            <div>Mengetahui,<br>Pengurus Yayasan Pendidikan Islam Al-Hidayah<br>${escapeHtml(tpl.ketuaLabel||'Ketua')}</div>
            <div class="ttd"><span class="ttdNama">( ${escapeHtml(tpl.ketuaNama||'')} )</span></div>
          </div>
        </div>
      </div>
    </div>`;

  const materiTambahan = (key==='tpq') ? (tpl.materiTambahan||[]) : [];
  const mainSubjects = state.subjects.filter(s=>!materiTambahan.includes(s));
  const tambahanSubjects = state.subjects.filter(s=>materiTambahan.includes(s));
  // Nilai di kolom "Angka" ijazah memakai nilai Raport (bukan nilai asli), dengan batas paling rendah 5.
  function subVal(s){
    const idx = state.subjects.indexOf(s);
    const raportVal = idx>=0 ? Number((row.raport && row.raport[idx])||0) : 0;
    return Math.max(raportVal, 5);
  }
  function tblRows(list){
    return list.map((s,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${escapeHtml(s)}</td><td>${subVal(s)}</td><td>${escapeHtml(angkaKeKata(subVal(s)))}</td></tr>`).join('');
  }
  const mainVals = mainSubjects.map(subVal);
  const mainJumlah = mainVals.reduce((a,b)=>a+b,0);
  const mainRata = mainSubjects.length ? (mainJumlah/mainSubjects.length) : 0;
  const tambahanVals = tambahanSubjects.map(subVal);
  const tambahanJumlah = tambahanVals.reduce((a,b)=>a+b,0);
  const tambahanRata = tambahanSubjects.length ? (tambahanJumlah/tambahanSubjects.length) : 0;

  const backStyleParts = [];
  if(borderImgBelakang) backStyleParts.push(`background-image:url('${borderImgBelakang}')`);
  backStyleParts.push(`--ijzFontTitle:${fontPreset.title}`);
  backStyleParts.push(`--ijzFontBody:${fontPreset.body}`);
  backStyleParts.push(`--ijzScaleLatin:${scaleLatin}`);
  const backPageStyle = ` style="${backStyleParts.join(';')}"`;
  const backBorderClass = borderImgBelakang ? ' hasCustomBorderBack' : '';
  const back = `
    <div class="ijazahPage${backBorderClass}"${backPageStyle}>
      <div class="ijazahInner">
        <div class="ijazahBackTitle">${escapeHtml(tpl.judulBelakang||'EVALUASI BELAJAR TAHAP AKHIR')}</div>
        <div class="ijazahBackSub">${escapeHtml(tpl.namaMadrasah||'')}</div>
        <div class="ijazahBackAddr">${escapeHtml(tpl.alamat||'')}${tpl.showTingkatLine? (' — '+escapeHtml(tpl.tingkatLabel||'')):''}</div>
        <div class="ijazahBackMeta">TAHUN PELAJARAN : ${escapeHtml(m.tahun||'')}${m.tahunMasehi?(' / '+escapeHtml(m.tahunMasehi)):''}</div>
        <div class="ijazahBackDaftar">DAFTAR NILAI DARI : <strong>${escapeHtml(st.nama||'')}</strong></div>
        <table class="ijazahTbl">
          <thead><tr><th>No</th><th>Mata Pelajaran</th><th>Angka</th><th>Huruf</th></tr></thead>
          <tbody>${tblRows(mainSubjects)}
            <tr><td colspan="2"><strong>Jumlah</strong></td><td colspan="2"><strong>${mainJumlah}</strong></td></tr>
            <tr><td colspan="2"><strong>Rata-rata</strong></td><td colspan="2"><strong>${mainRata.toFixed(2)}</strong></td></tr>
            <tr><td colspan="2"><strong>Peringkat</strong></td><td colspan="2"><strong>${row.peringkat!=null?row.peringkat:'-'}</strong></td></tr>
          </tbody>
        </table>
        ${tambahanSubjects.length ? `
        <table class="ijazahTbl">
          <thead><tr><th>No</th><th>Materi Tambahan</th><th>Angka</th><th>Huruf</th></tr></thead>
          <tbody>${tblRows(tambahanSubjects)}
            <tr><td colspan="2"><strong>Jumlah</strong></td><td colspan="2"><strong>${tambahanJumlah}</strong></td></tr>
            <tr><td colspan="2"><strong>Rata-rata</strong></td><td colspan="2"><strong>${tambahanRata.toFixed(2)}</strong></td></tr>
          </tbody>
        </table>` : ''}
        <div class="ijazahBackSign">
          <div>${escapeHtml(u.tempat||'Bangkalan')}, ${escapeHtml(u.terbitH||'')} H<br>${escapeHtml(u.terbitM||'')} M</div>
        </div>
        ${tpl.showPanitia ? `
        <div class="ijazahBackSign">
          <div style="width:44%;">Ketua<span class="ttdNama">( ${escapeHtml(tpl.panitiaKetua||'')} )</span></div>
          <div style="width:44%;">Sekretaris<span class="ttdNama">( ${escapeHtml(tpl.panitiaSekretaris||'')} )</span></div>
        </div>` : `
        <div class="ijazahBackSign">
          <div>${escapeHtml(tpl.kepalaLabel||'')}<span class="ttdNama">( ${escapeHtml(tpl.kepalaNama||'')} )</span></div>
        </div>`}
      </div>
    </div>`;

  return {front, back};
}

document.getElementById('btnBuildIjazah').addEventListener('click', ()=>{
  const id = document.getElementById('ijzPickPreview').value;
  if(!id){ toast('Pilih siswa dulu'); return; }
  ijzPreviewStudentId = id;
  const pages = buildIjazahHTML(id);
  const board = document.getElementById('ijazahBoard');
  const exportBtns = document.getElementById('ijazahExportBtns');
  if(!pages){ board.innerHTML=''; exportBtns.style.display='none'; return; }
  board.innerHTML = pages.front + pages.back;
  exportBtns.style.display = '';
  ijzApplyPreviewAspect(board);
  ijzSyncDragModeToBoard();
});

/* ---- Mode Geser Posisi (drag-to-position, seperti Canva/Corel, khusus bagian depan) ----
   Dua opsi:
   - "group": seluruh isi ijazah bagian depan digeser bersama-sama (satu offset x/y untuk semua).
   - "row"  : tiap baris/komponen digeser sendiri-sendiri (independen).
*/
let ijzElState = {};      // key -> {x,y}, posisi berjalan (live) tiap komponen (mode "row")
let ijzGroupState = {x:0,y:0}; // posisi berjalan (live) grup (mode "group")
let ijzDragKey = null;    // key komponen yang sedang diseret (mode "row")
let ijzGroupDragging = false; // sedang menyeret grup? (mode "group")
let ijzDragStart = { clientX:0, clientY:0, x:0, y:0 };

function ijzDragMode(){
  const el = document.querySelector('input[name="ijzDragModeRadio"]:checked');
  return el ? el.value : 'off';
}
function ijzFrontPageEl(){
  return document.querySelector('#ijazahBoard .ijazahPage:first-child');
}
function ijzFrontInnerEl(){
  const front = ijzFrontPageEl();
  return front ? front.querySelector('.ijazahInner') : null;
}
function ijzDraggableEls(){
  const front = ijzFrontPageEl();
  return front ? front.querySelectorAll('[data-ijzel]') : [];
}
function ijzApplyElTransform(key){
  const front = ijzFrontPageEl();
  if(!front) return;
  const el = front.querySelector(`[data-ijzel="${key}"]`);
  if(!el) return;
  const p = ijzElState[key] || {x:0,y:0};
  el.style.transform = (p.x||p.y) ? `translate(${p.x}px,${p.y}px)` : '';
}
function ijzApplyGroupTransform(){
  const inner = ijzFrontInnerEl();
  if(!inner) return;
  const key = currentTingkatanKey();
  const tpl = key ? getIjazahTemplate(key) : {};
  const scl = (Number(tpl.contentScale)||100)/100;
  const p = ijzGroupState || {x:0,y:0};
  const parts = [];
  if(p.x || p.y) parts.push(`translate(${p.x}px,${p.y}px)`);
  if(scl!==1) parts.push(`scale(${scl})`);
  inner.style.transform = parts.length ? parts.join(' ') : '';
}
function ijzSyncDragModeToBoard(){
  const mode = ijzDragMode();
  const key = currentTingkatanKey();
  const tpl = key ? getIjazahTemplate(key) : {};
  const src = tpl.elPos || {};
  const gp = tpl.groupPos || {x:0,y:0};
  ijzGroupState = { x:Number(gp.x)||0, y:Number(gp.y)||0 };
  ijzElState = {};
  ijzDraggableEls().forEach(el=>{
    const k = el.getAttribute('data-ijzel');
    const p = src[k] || {x:0,y:0};
    ijzElState[k] = { x:Number(p.x)||0, y:Number(p.y)||0 };
    el.classList.toggle('dragMode', mode==='row');
    ijzApplyElTransform(k);
  });
  const inner = ijzFrontInnerEl();
  if(inner) inner.classList.toggle('groupDragMode', mode==='group');
  ijzApplyGroupTransform();
}
document.querySelectorAll('input[name="ijzDragModeRadio"]').forEach(radio=>{
  radio.addEventListener('change', (e)=>{
    if(e.target.value!=='off' && !ijzFrontPageEl()){
      toast('Tampilkan ijazah dulu (klik "Tampilkan Ijazah")');
      document.getElementById('ijzDragModeOff').checked = true;
      return;
    }
    ijzSyncDragModeToBoard();
    if(e.target.value==='group') toast('Mode geser grup aktif: klik & seret di mana saja untuk menggeser semua isi sekaligus');
    else if(e.target.value==='row') toast('Mode geser per baris aktif: klik & seret tiap baris/komponen satu per satu');
  });
});
(function setupIjzDrag(){
  const board = document.getElementById('ijazahBoard');
  board.addEventListener('pointerdown', (e)=>{
    const mode = ijzDragMode();
    if(mode==='off') return;
    const front = ijzFrontPageEl();
    if(!front || !front.contains(e.target)) return;
    if(mode==='row'){
      const target = e.target.closest('[data-ijzel]');
      if(!target) return;
      ijzDragKey = target.getAttribute('data-ijzel');
      const p = ijzElState[ijzDragKey] || {x:0,y:0};
      ijzDragStart = { clientX:e.clientX, clientY:e.clientY, x:p.x, y:p.y };
      try{ target.setPointerCapture(e.pointerId); }catch(err){}
    } else if(mode==='group'){
      ijzGroupDragging = true;
      const p = ijzGroupState || {x:0,y:0};
      ijzDragStart = { clientX:e.clientX, clientY:e.clientY, x:p.x, y:p.y };
      try{ front.setPointerCapture(e.pointerId); }catch(err){}
    }
    e.preventDefault();
    e.stopPropagation();
  });
  board.addEventListener('pointermove', (e)=>{
    if(ijzDragKey){
      const x = Math.round(ijzDragStart.x + (e.clientX - ijzDragStart.clientX));
      const y = Math.round(ijzDragStart.y + (e.clientY - ijzDragStart.clientY));
      ijzElState[ijzDragKey] = { x, y };
      ijzApplyElTransform(ijzDragKey);
    } else if(ijzGroupDragging){
      const x = Math.round(ijzDragStart.x + (e.clientX - ijzDragStart.clientX));
      const y = Math.round(ijzDragStart.y + (e.clientY - ijzDragStart.clientY));
      ijzGroupState = { x, y };
      ijzApplyGroupTransform();
    }
  });
  const stopDrag = ()=>{ ijzDragKey = null; ijzGroupDragging = false; };
  board.addEventListener('pointerup', stopDrag);
  board.addEventListener('pointercancel', stopDrag);
  board.addEventListener('pointerleave', stopDrag);
})();
document.getElementById('btnSaveDragPosition').addEventListener('click', ()=>{
  const key = currentTingkatanKey();
  if(!key){ toast('Tingkatan kelas aktif tidak didukung'); return; }
  db.ref('rapor/ijazahTemplates/'+key).update({ elPos: ijzElState, groupPos: ijzGroupState }).then(()=> toast('Posisi disimpan'));
});
document.getElementById('btnResetDragPosition').addEventListener('click', ()=>{
  const mode = ijzDragMode();
  if(mode==='group'){
    ijzGroupState = {x:0,y:0};
    ijzApplyGroupTransform();
  } else {
    Object.keys(ijzElState).forEach(k=>{ ijzElState[k] = {x:0,y:0}; ijzApplyElTransform(k); });
  }
  toast('Posisi direset (klik "Simpan Posisi" untuk menyimpan)');
});

const IJZ_PAPER_SIZES = { a4:{w:210,h:297}, f4:{w:215,h:330} };
function ijzGetPaperSize(){
  const sel = document.getElementById('ijzPaperSize');
  return IJZ_PAPER_SIZES[(sel && sel.value) || 'a4'] || IJZ_PAPER_SIZES.a4;
}
function ijzApplyPreviewAspect(root){
  const sz = ijzGetPaperSize();
  const scope = root || document;
  scope.querySelectorAll('.ijazahPage').forEach(el=>{ el.style.aspectRatio = `${sz.w} / ${sz.h}`; });
}
document.getElementById('ijzPaperSize').addEventListener('change', ()=> ijzApplyPreviewAspect());
function ijzApplyPrintPageStyle(){
  const sz = ijzGetPaperSize();
  let styleEl = document.getElementById('ijazahPrintPageStyle');
  if(!styleEl){ styleEl = document.createElement('style'); styleEl.id = 'ijazahPrintPageStyle'; document.head.appendChild(styleEl); }
  styleEl.textContent = `@media print{ @page{ size: ${sz.w}mm ${sz.h}mm; margin:8mm; } }`;
}
function ijzAddFittedImage(pdf, img, canvas, pageW, pageH){
  const ratio = canvas.width / canvas.height;
  let w = pageW, h = pageW / ratio;
  if(h > pageH){ h = pageH; w = pageH * ratio; }
  const x = (pageW - w) / 2, y = (pageH - h) / 2;
  pdf.addImage(img, 'PNG', x, y, w, h);
}

document.getElementById('btnPrintIjazah').addEventListener('click', ()=>{
  ijzApplyPrintPageStyle();
  document.body.classList.add('printingIjazah');
  window.print();
});
window.addEventListener('afterprint', ()=> document.body.classList.remove('printingIjazah'));

async function ensureExportLibs(){
  if(!window.html2canvas || !window.jspdf){ toast('Memuat pustaka ekspor…'); }
  let tries = 0;
  while((!window.html2canvas || !window.jspdf) && tries<40){ await new Promise(r=>setTimeout(r,150)); tries++; }
  if(!window.html2canvas || !window.jspdf) throw new Error('Pustaka ekspor gagal dimuat (cek koneksi internet)');
}

async function pageToCanvas(pageEl){
  return await html2canvas(pageEl, {
    scale:3,
    useCORS:true,
    backgroundColor:'#ffffff',
    imageTimeout:15000,
    logging:false,
    letterRendering:true
  });
}

document.getElementById('btnPdfIjazah').addEventListener('click', async ()=>{
  if(!ijzPreviewStudentId){ toast('Tampilkan ijazah dulu'); return; }
  try{
    await ensureExportLibs();
    const pages = document.querySelectorAll('#ijazahBoard .ijazahPage');
    if(!pages.length){ toast('Belum ada pratinjau'); return; }
    const { jsPDF } = window.jspdf;
    const sz = ijzGetPaperSize();
    const pdf = new jsPDF({orientation:'portrait', unit:'mm', format:[sz.w, sz.h]});
    for(let i=0;i<pages.length;i++){
      const canvas = await pageToCanvas(pages[i]);
      const img = canvas.toDataURL('image/png');
      if(i>0) pdf.addPage([sz.w, sz.h], 'portrait');
      ijzAddFittedImage(pdf, img, canvas, sz.w, sz.h);
    }
    const st = orderedStudents().find(s=>s.id===ijzPreviewStudentId);
    pdf.save(`ijazah-${(st?.nama||'siswa').replace(/\s+/g,'_')}.pdf`);
  }catch(err){ console.error(err); toast('Gagal ekspor PDF: '+err.message); }
});

async function downloadPageAsJpg(selector, filename){
  try{
    await ensureExportLibs();
    const el = document.querySelector(selector);
    if(!el){ toast('Belum ada pratinjau'); return; }
    const canvas = await pageToCanvas(el);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.98);
    a.download = filename;
    a.click();
  }catch(err){ console.error(err); toast('Gagal ekspor JPG: '+err.message); }
}
document.getElementById('btnJpgIjazahDepan').addEventListener('click', ()=>{
  const st = orderedStudents().find(s=>s.id===ijzPreviewStudentId);
  downloadPageAsJpg('#ijazahBoard .ijazahPage:nth-child(1)', `ijazah-depan-${(st?.nama||'siswa').replace(/\s+/g,'_')}.jpg`);
});
document.getElementById('btnJpgIjazahBelakang').addEventListener('click', ()=>{
  const st = orderedStudents().find(s=>s.id===ijzPreviewStudentId);
  downloadPageAsJpg('#ijazahBoard .ijazahPage:nth-child(2)', `ijazah-belakang-${(st?.nama||'siswa').replace(/\s+/g,'_')}.jpg`);
});

document.getElementById('btnPdfIjazahSemua').addEventListener('click', async ()=>{
  if(!activeKelasId){ toast('Pilih kelas dulu'); return; }
  const key = currentTingkatanKey();
  if(!key){ toast('Kelas ini tidak mendukung Ijazah (tingkatan tidak didukung atau bukan kelas akhir)'); return; }
  const students = orderedStudents();
  if(!students.length){ toast('Belum ada siswa di kelas ini'); return; }
  try{
    await ensureExportLibs();
    toast('Menyiapkan PDF semua siswa… mohon tunggu');
    const hidden = document.createElement('div');
    hidden.style.position = 'fixed'; hidden.style.left = '-9999px'; hidden.style.top = '0';
    document.body.appendChild(hidden);
    const { jsPDF } = window.jspdf;
    const sz = ijzGetPaperSize();
    const pdf = new jsPDF({orientation:'portrait', unit:'mm', format:[sz.w, sz.h]});
    let first = true;
    for(const st of students){
      const pages = buildIjazahHTML(st.id);
      if(!pages) continue;
      hidden.innerHTML = pages.front + pages.back;
      ijzApplyPreviewAspect(hidden);
      const pageEls = hidden.querySelectorAll('.ijazahPage');
      for(const pageEl of pageEls){
        const canvas = await pageToCanvas(pageEl);
        const img = canvas.toDataURL('image/png');
        if(!first) pdf.addPage([sz.w, sz.h], 'portrait');
        ijzAddFittedImage(pdf, img, canvas, sz.w, sz.h);
        first = false;
      }
    }
    document.body.removeChild(hidden);
    pdf.save(`ijazah-semua-${kelasFileTag()}.pdf`);
    toast('PDF semua siswa berhasil diunduh');
  }catch(err){ console.error(err); toast('Gagal ekspor PDF: '+err.message); }
});

function populateFontPresetSelect(){
  const sel = document.getElementById('tplFontPreset');
  if(sel) sel.innerHTML = Object.keys(IJAZAH_FONT_PRESETS).map(k=>`<option value="${k}">${escapeHtml(IJAZAH_FONT_PRESETS[k].label)}</option>`).join('');
  const selArab = document.getElementById('tplFontPresetArab');
  if(selArab) selArab.innerHTML = Object.keys(IJAZAH_ARABIC_FONTS).map(k=>`<option value="${k}">${escapeHtml(IJAZAH_ARABIC_FONTS[k].label)}</option>`).join('');
}
function updateFontPreview(){
  const sel = document.getElementById('tplFontPreset');
  const selArab = document.getElementById('tplFontPresetArab');
  if(!sel) return;
  const preset = ijzFontPreset(sel.value);
  const arabFont = ijzArabFont(selArab ? selArab.value : undefined);
  const scaleLatin = (Number(document.getElementById('tplFontSizeLatin').value)||100)/100;
  const scaleArab = (Number(document.getElementById('tplFontSizeArab').value)||100)/100;
  const titleEl = document.getElementById('tplFontPreviewTitle');
  const bodyEl = document.getElementById('tplFontPreviewBody');
  const arabEl = document.getElementById('tplFontPreviewArab');
  if(titleEl){ titleEl.style.fontFamily = preset.title; titleEl.style.fontSize = (22*scaleLatin)+'px'; }
  if(bodyEl){ bodyEl.style.fontFamily = preset.body; bodyEl.style.fontSize = (13*scaleLatin)+'px'; }
  if(arabEl){ arabEl.style.fontFamily = arabFont.family; arabEl.style.fontSize = (16*scaleArab)+'px'; }
}
document.getElementById('tplFontPreset').addEventListener('change', updateFontPreview);
document.getElementById('tplFontPresetArab').addEventListener('change', updateFontPreview);
document.getElementById('tplFontSizeLatin').addEventListener('input', updateFontPreview);
document.getElementById('tplFontSizeArab').addEventListener('input', updateFontPreview);

