/* ===================== Preferensi ukuran kertas & font saat cetak ===================== */
/* Dipilih pengguna lewat dropdown di card "Cetak" (tab Rekap), disimpan di localStorage
   (preferensi lokal alat cetak, bukan data sekolah, jadi tidak perlu ke Firebase).
   Ukuran dalam mm, mode potret (lebar < tinggi) — untuk lanskap tinggal ditukar. */
const PRINT_PAPER_SIZES_MM = {
  a4:     {w:210, h:297},
  f4:     {w:215, h:330}, // F4/Folio, umum dipakai printer Indonesia
  legal:  {w:216, h:356},
  letter: {w:216, h:279},
};
function mmToPx(mm){ return mm * 96 / 25.4; }
function getPrintPrefs(){
  return {
    paper: localStorage.getItem('yapidaPrintPaper') || 'a4',
    orientation: localStorage.getItem('yapidaPrintOrientation') || 'landscape',
    fontScale: parseFloat(localStorage.getItem('yapidaPrintFontScale') || '1.2') || 1.2,
  };
}
function savePrintPrefs(patch){
  const next = {...getPrintPrefs(), ...patch};
  localStorage.setItem('yapidaPrintPaper', next.paper);
  localStorage.setItem('yapidaPrintOrientation', next.orientation);
  localStorage.setItem('yapidaPrintFontScale', String(next.fontScale));
}
function initPrintPrefsUI(){
  const prefs = getPrintPrefs();
  const selPaper = document.getElementById('printPaperSize');
  const selOrient = document.getElementById('printOrientation');
  const selFont = document.getElementById('printFontScale');
  if(selPaper){ selPaper.value = prefs.paper; selPaper.addEventListener('change', ()=> savePrintPrefs({paper:selPaper.value})); }
  if(selOrient){ selOrient.value = prefs.orientation; selOrient.addEventListener('change', ()=> savePrintPrefs({orientation:selOrient.value})); }
  if(selFont){ selFont.value = String(prefs.fontScale); selFont.addEventListener('change', ()=> savePrintPrefs({fontScale:parseFloat(selFont.value)})); }
}
document.addEventListener('DOMContentLoaded', initPrintPrefsUI);

function ensurePrintPageStyleEl(){
  let el = document.getElementById('dynPrintPageStyle');
  if(!el){ el = document.createElement('style'); el.id = 'dynPrintPageStyle'; document.head.appendChild(el); }
  return el;
}
/* Menulis ulang @page sesuai pilihan pengguna (bukan dikunci A4 lewat CSS statis lagi),
   supaya saat dialog cetak browser diarahkan ke kertas F4/Legal, tata letak HTML memang
   dihitung ulang untuk lebar itu — bukan cuma A4 yang di-skala ke kertas lebih besar. */
function applyPrintPagePrefs(){
  const prefs = getPrintPrefs();
  const dim = PRINT_PAPER_SIZES_MM[prefs.paper] || PRINT_PAPER_SIZES_MM.a4;
  const landscape = prefs.orientation !== 'portrait';
  const w = landscape ? Math.max(dim.w, dim.h) : Math.min(dim.w, dim.h);
  const h = landscape ? Math.min(dim.w, dim.h) : Math.max(dim.w, dim.h);
  const MARGIN_MM = 6; // dikecilkan dari 8mm supaya lebar cetak yang bisa dipakai lebih lega
  ensurePrintPageStyleEl().textContent = `@media print{ @page{ size:${w}mm ${h}mm; margin:${MARGIN_MM}mm; } }`;
  return { usableWidthPx: mmToPx(w - MARGIN_MM*2), fontScale: prefs.fontScale };
}
/* Dipanggil setelah selesai cetak supaya cetak lain (Ijazah/Surat, yang tidak lewat
   fitPrintTables) tidak ikut kebawa ukuran kertas F4/Legal yang sempat dipilih. */
function resetPrintPagePrefsToDefault(){
  ensurePrintPageStyleEl().textContent = '@media print{ @page{ size:A4 landscape; margin:6mm; } }';
}

/* ===================== Auto-fit ukuran font & lebar kolom tabel saat cetak ===================== */
/* v1: kolom Nama dijatah lebar tetap, sisanya dibagi RATA ke semua kolom lain. v2: kolom
   dikenali per jenis (No/Kelakuan/Kerajinan/Kebersihan/Sakit/Ijin/Alpa dikasih lebar tetap
   kecil, sisanya untuk kolom nilai). Tapi v2 masih menghitung font TIAP TABEL SENDIRI² —
   karena tabel Nilai Raport tetap punya lebih banyak kolom total daripada Nilai Asli/
   Rata-rata (6 kolom perilaku/absen ekstra), jatah lebar per kolom nilainya tetap sedikit
   lebih kecil, jadi hasil cetaknya masih terlihat lebih kecil dari tabel lain.
   v3: font-size SEKARANG DISAMAKAN untuk semua tabel dalam satu area cetak — dihitung dari
   tabel yang paling "sempit" (biasanya Nilai Raport), lalu dipakai sama persis untuk semua
   tabel lain juga (Nilai Asli, Rata-rata). Jadi bukan lagi masing-masing tabel mentok di
   plafon sendiri-sendiri — semua tabel dijamin ukuran fontnya identik. */
function classifyPrintCol(th){
  const style = th.getAttribute('style') || '';
  const txt = (th.textContent || '').trim();
  if(/text-align:\s*left/i.test(style)) return {px:95};       // Nama / Mata Pelajaran (boleh wrap 2 baris)
  if(txt === 'No') return {px:20};
  if(['Sakit','Ijin','Alpa'].includes(txt)) return {px:22};   // 1-2 digit
  if(['Kelakuan','Kerajinan','Kebersihan'].includes(txt)) return {px:38}; // kata singkat, boleh 2 baris
  if(txt === 'CW Terisi') return {px:40};
  return {px:null}; // kolom nilai/angka utama — dapat porsi rata dari sisa lebar (flex)
}
/* Ukuran font aman untuk lebar kolom `px` supaya sel angka terpanjang di kolom nilai
   tetap muat 1 baris tanpa kepotong/overflow — dihitung dari lebar font monospace
   ('.num' pakai IBM Plex Mono), bukan tebakan/divisor sembarangan seperti sebelumnya. */
function fontSizeForFlexPx(px, worstChars){
  const PAD_PX = 8;         // padding sel (2×3px) + sedikit ruang aman pembulatan
  const CHAR_W = 0.62;      // lebar rata² 1 karakter font monospace relatif thd font-size
  return Math.max(0, (px - PAD_PX) / ((worstChars||5.3) * CHAR_W));
}
/* Nilai kolom terpanjang beda-beda per tabel: tabel Nilai Asli/Rata-rata (Asli) bisa
   berisi angka sampai "82.35" (5 karakter), sedangkan tabel Nilai Raport & Rata-rata
   (Raport) nilainya hasil konversi 4-9 / Rata² dua desimal — paling panjang cuma "8.41"
   (4 karakter). Dipakai worst-case yang sesuai isi tabel supaya kolom Raport tidak
   dipaksa memakai jatah lebar karakter yang sama besarnya dengan tabel Asli, yang bikin
   fontnya kelihatan lebih kecil saat dicetak walau sebenarnya masih muat lebih besar. */
function worstCharsForTable(table){
  return (table.id === 'tblRaport' || table.id === 'tblAvgRaport') ? 4.3 : 5.3;
}
function buildPrintColgroup(table, widths){
  const old = table.querySelector('colgroup[data-autofit]');
  if(old) old.remove();
  const headRow = table.querySelector('thead tr:first-child');
  if(!headRow || !headRow.children.length) return;
  const colgroup = document.createElement('colgroup');
  colgroup.setAttribute('data-autofit', '1');
  widths.forEach(px=>{
    const col = document.createElement('col');
    col.style.setProperty('--colw', px + 'px');
    colgroup.appendChild(col);
  });
  table.insertBefore(colgroup, table.firstChild);
}
function fitPrintTables(root){
  const { usableWidthPx, fontScale } = applyPrintPagePrefs();
  const container = root || document;
  const infos = Array.from(container.querySelectorAll('table')).map(table=>{
    const headRow = table.querySelector('thead tr:first-child');
    const ths = headRow ? Array.from(headRow.children) : [];
    if(!ths.length) return { table, classified: null };
    const classified = ths.map(classifyPrintCol);
    const fixedTotal = classified.reduce((a,c)=> a + (c.px!=null ? c.px : 0), 0);
    const flexCount = Math.max(1, classified.filter(c=> c.px==null).length);
    const flexPx = Math.max(24, (usableWidthPx - fixedTotal) / flexCount);
    const worstChars = worstCharsForTable(table);
    return { table, classified, flexPx, worstChars, ownFont: fontSizeForFlexPx(flexPx, worstChars) };
  });
  const flexInfos = infos.filter(i=> i.classified);
  if(!flexInfos.length) return;
  // Setiap tabel dihitung dulu font amannya SENDIRI (pakai lebar kolom & worst-case
  // karakternya masing-masing — lihat worstCharsForTable), baru dipakai yang PALING
  // KECIL sebagai font seragam untuk semua tabel dalam `root` yang sama. Karena setiap
  // font_i sudah aman untuk tabelnya sendiri, memakai font <= font_i selalu tetap aman
  // (tidak overflow) — beda dari sebelumnya yang menyamakan worst-case ke semua tabel
  // walau isinya beda (nilai Raport 1 digit vs nilai Asli sampai "82.35"), sehingga
  // tabel Raport dulu dipaksa ikut font sekecil tabel yang butuh ruang paling banyak.
  let fontSize = Math.min(...flexInfos.map(i=> i.ownFont)) * fontScale;
  fontSize = Math.max(7.5, Math.min(20, fontSize));
  infos.forEach(({table, classified, flexPx})=>{
    if(!classified){ table.style.removeProperty('--printFontSize'); table.classList.remove('printFit'); return; }
    buildPrintColgroup(table, classified.map(c=> c.px!=null ? c.px : flexPx));
    table.classList.add('printFit');
    table.style.setProperty('--printFontSize', fontSize.toFixed(1) + 'px');
  });
}

/* ===================== Ekspor XLSX (helper umum) ===================== */
function downloadWorkbook(wb, filename){
  XLSX.writeFile(wb, filename);
}
function kelasFileTag(){
  const m = state.meta || {};
  return (m.kelas || 'kelas').toString().replace(/[^a-z0-9]+/gi,'_');
}
function sheetFromAOA(aoa, colWidths){
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if(colWidths) ws['!cols'] = colWidths.map(w=>({wch:w}));
  return ws;
}

/* -- Ekspor: Kelas -- */
document.getElementById('btnExportKelas')?.addEventListener('click', ()=>{
  const rows = [['Tingkatan','Kelas','Tahun Ajaran (H)','Tahun Ajaran (M)']];
  Object.values(state.kelasList).forEach(k=> rows.push([k.tingkatan||'', k.kelasNama||'', k.tahun||'', k.tahunMasehi||'']));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[14,22,14,14]), 'Daftar Kelas');
  downloadWorkbook(wb, 'daftar-kelas.xlsx');
});

/* -- Ekspor: Siswa -- */
document.getElementById('btnExportSiswa')?.addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const rows = [['No','Nama','NISN','NIS','JK','Tempat Lahir','Tanggal Lahir','Alamat','Ayah','Ibu','Wali','No. HP']];
  orderedStudents().forEach(st=> rows.push([st.no, st.nama, st.nisn||'', st.nis||'', st.jk||'', st.tempatLahir||'', st.tglLahir||'', st.alamat||'', st.ayah||'', st.ibu||'', st.wali||'', st.telp||'']));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[4,22,14,12,4,14,14,22,18,18,18,14]), 'Daftar Siswa');
  downloadWorkbook(wb, `siswa-${kelasFileTag()}.xlsx`);
});

/* -- Template Import Siswa -- */
document.getElementById('btnDownloadTemplateSiswa')?.addEventListener('click', ()=>{
  const rows = [
    ['No','Nama','NISN','NIS','JK','Tempat Lahir','Tanggal Lahir','Alamat','Ayah','Ibu','Wali','No. HP'],
    [1,'Contoh: Ahmad Fauzi','1234567890','001','L','Jakarta','2015-05-17','Jl. Contoh No. 1','Bpk. Fulan','Ibu Fulanah','','081234567890'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[4,22,14,12,4,14,14,22,18,18,18,14]), 'Template Siswa');
  const petunjuk = [
    ['Petunjuk Pengisian Template Import Siswa'],
    ['1. Kolom "No" = nomor urut siswa di kelas ini. Boleh dikosongkan (otomatis melanjutkan nomor terakhir).'],
    ['2. Kolom "JK" diisi L (Laki-laki) atau P (Perempuan).'],
    ['3. Kolom "Tanggal Lahir" diisi format YYYY-MM-DD (cth. 2015-05-17), atau boleh format tanggal Excel biasa.'],
    ['4. Import akan menambahkan siswa ke kelas yang sedang AKTIF saat file diimpor — pastikan kelas aktif sudah benar sebelum impor.'],
    ['5. Jika NISN atau Nama pada baris sudah cocok dengan siswa yang sudah ada di kelas aktif, datanya akan DIPERBARUI, bukan dibuat dobel.'],
    ['6. Hapus baris contoh (baris ke-2) sebelum mengisi data sungguhan.'],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(petunjuk,[75]), 'Petunjuk');
  downloadWorkbook(wb, 'template-import-siswa.xlsx');
  toast('Template diunduh — isi data siswa lalu impor kembali');
});

/* -- Import Siswa dari Excel -- */
function siswaParseDateCell(v){
  if(v===undefined || v===null || v==='') return '';
  if(v instanceof Date){
    return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
  }
  if(typeof v === 'number'){
    if(typeof XLSX!=='undefined' && XLSX.SSF && XLSX.SSF.parse_date_code){
      const d = XLSX.SSF.parse_date_code(v);
      if(d) return d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');
    }
    return '';
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  return '';
}
document.getElementById('btnImportSiswaTrigger')?.addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu di tab Kelas'); return; }
  document.getElementById('fileImportSiswa').click();
});
document.getElementById('fileImportSiswa')?.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); e.target.value=''; return; }
  const reader = new FileReader();
  reader.onload = async (ev)=>{
    const btn = document.getElementById('btnImportSiswaTrigger');
    try{
      const wb = XLSX.read(ev.target.result, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(!aoa.length){ toast('File kosong'); return; }
      const header = aoa[0].map(h=>String(h||'').trim());
      const findIdx = (re)=> header.findIndex(h=> re.test(h));
      const idx = {
        no: findIdx(/^no\.?$/i),
        nama: findIdx(/^nama/i),
        nisn: findIdx(/^nisn/i),
        nis: findIdx(/^nis(\s*lokal)?$/i),
        jk: findIdx(/^jk$|jenis\s*kelamin/i),
        tempatLahir: findIdx(/tempat\s*lahir/i),
        tglLahir: findIdx(/tanggal\s*lahir|tgl\s*lahir/i),
        alamat: findIdx(/^alamat/i),
        ayah: findIdx(/ayah/i),
        ibu: findIdx(/ibu/i),
        wali: findIdx(/^wali/i),
        telp: findIdx(/hp|telp|telepon/i),
      };
      if(idx.nama===-1){ toast('Kolom "Nama" tidak ditemukan di file — cek header sesuai template'); return; }

      if(btn){ btn.disabled = true; btn.textContent = 'Mengimpor…'; }

      const existing = orderedStudents();
      const byNisn = {}, byNama = {};
      existing.forEach(st=>{
        if(st.nisn) byNisn[String(st.nisn).trim()] = st;
        if(st.nama) byNama[st.nama.trim().toLowerCase()] = st;
      });
      let nextNo = existing.length ? Math.max(...existing.map(s=>s.no||0))+1 : 1;
      const k = state.kelasList[activeKelasId] || {};

      let ditambah=0, diperbarui=0;
      for(let r=1;r<aoa.length;r++){
        const row = aoa[r];
        if(!row || !row.length) continue;
        const nama = String(row[idx.nama]||'').trim();
        if(!nama) continue;
        const nisn = idx.nisn!==-1 ? String(row[idx.nisn]||'').trim() : '';
        const jkRaw = idx.jk!==-1 ? String(row[idx.jk]||'').trim().toUpperCase() : '';
        const biodata = {
          nama,
          jk: jkRaw.startsWith('P') ? 'P' : 'L',
          nisn,
          nis: idx.nis!==-1 ? String(row[idx.nis]||'').trim() : '',
          tempatLahir: idx.tempatLahir!==-1 ? String(row[idx.tempatLahir]||'').trim() : '',
          tglLahir: idx.tglLahir!==-1 ? siswaParseDateCell(row[idx.tglLahir]) : '',
          alamat: idx.alamat!==-1 ? String(row[idx.alamat]||'').trim() : '',
          ayah: idx.ayah!==-1 ? String(row[idx.ayah]||'').trim() : '',
          ibu: idx.ibu!==-1 ? String(row[idx.ibu]||'').trim() : '',
          wali: idx.wali!==-1 ? String(row[idx.wali]||'').trim() : '',
          telp: idx.telp!==-1 ? String(row[idx.telp]||'').trim() : '',
        };
        let no = (idx.no!==-1 && row[idx.no]!=='' && !isNaN(Number(row[idx.no]))) ? Number(row[idx.no]) : null;

        const match = (nisn && byNisn[nisn]) || byNama[nama.toLowerCase()];
        if(match){
          await studentsRootRef(match.id).update(biodata);
          if(no!=null) await dataRoot('students/'+match.id).update({no});
          diperbarui++;
        }else{
          if(no==null) no = nextNo;
          const newRef = studentsRootRef().push();
          const id = newRef.key;
          const master = {
            ...biodata,
            kelasAktifId: activeKelasId,
            riwayatKelas: { [activeKelasId]: { no, tingkatan:k.tingkatan||'', kelasNama:k.kelasNama||'', catur:k.catur||'', tahun:k.tahun||'', tahunMasehi:k.tahunMasehi||'', tanggal: todayISO() } }
          };
          await newRef.set(master);
          await dataRoot('students/'+id).set({no});
          nextNo = Math.max(nextNo, no+1);
          byNama[nama.toLowerCase()] = {id, nisn};
          if(nisn) byNisn[nisn] = {id, nisn};
          ditambah++;
        }
      }
      if(!ditambah && !diperbarui){ toast('Tidak ada data valid yang bisa diimpor (cek kolom Nama)'); return; }
      toast(`Impor selesai — ${ditambah} siswa baru, ${diperbarui} diperbarui`);
      resetStudentForm();
    }catch(err){
      console.error(err);
      toast('Gagal membaca file: '+err.message);
    }finally{
      if(btn){ btn.disabled = false; btn.innerHTML = icon('upload')+'Import dari Excel'; }
      e.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
});

/* -- Ekspor: Absensi (rekap yang sedang ditampilkan) -- */
document.getElementById('btnExportAbsensi')?.addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const dari = document.getElementById('rekapAbsDari').value;
  const sampai = document.getElementById('rekapAbsSampai').value;
  const tally = {};
  orderedStudents().forEach(st=> tally[st.id] = {H:0,S:0,I:0,A:0});
  Object.entries(state.absensi).forEach(([tgl, byStudent])=>{
    if(dari && tgl < dari) return;
    if(sampai && tgl > sampai) return;
    Object.entries(byStudent).forEach(([sid, st])=>{ if(tally[sid]) tally[sid][st] = (tally[sid][st]||0)+1; });
  });
  const rows = [['No','Nama','Hadir','Sakit','Izin','Alpa']];
  orderedStudents().forEach(st=>{
    const t = tally[st.id];
    rows.push([st.no, st.nama, t.H, t.S, t.I, t.A]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[4,22,8,8,8,8]), 'Rekap Absensi');
  downloadWorkbook(wb, `absensi-${kelasFileTag()}.xlsx`);
});

/* ===================== Cetak Daftar Hadir & Nilai Ujian ===================== */
function populateUjianMapelSelect(){
  const sel = document.getElementById('ujianMapel');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Tanpa Mata Pelajaran (kosong, isi manual) —</option>' +
    state.subjects.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if(cur && state.subjects.includes(cur)) sel.value = cur;
}

function fillUjianMetaForm(){
  const uj = state.ujianMeta || {};
  document.getElementById('ujianJudulArab').value = uj.judulArab ?? 'الإمتحان الثاني';
  document.getElementById('ujianNamaArab').value = uj.namaArab ?? 'للمدرسة الإبتدائية الهداية';
  document.getElementById('ujianTahunArab').value = uj.tahunArab ?? '';
  document.getElementById('ujianTempat').value = uj.tempat ?? (state.meta?.tempat || '');
  document.getElementById('ujianTahunFooter').value = uj.tahunFooter ?? '';
}

document.getElementById('btnSimpanUjianMeta').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const payload = {
    judulArab: document.getElementById('ujianJudulArab').value.trim(),
    namaArab: document.getElementById('ujianNamaArab').value.trim(),
    tahunArab: document.getElementById('ujianTahunArab').value.trim(),
    tempat: document.getElementById('ujianTempat').value.trim(),
    tahunFooter: document.getElementById('ujianTahunFooter').value.trim(),
  };
  dataRoot('ujianMeta').set(payload).then(()=> toast('Pengaturan Daftar Ujian disimpan'));
});

function buildDaftarUjianHTML(mapel){
  const m = state.meta || {};
  const uj = state.ujianMeta || {};
  const students = orderedStudents();
  const judulArab = uj.judulArab || document.getElementById('ujianJudulArab').value.trim() || 'الإمتحان';
  const namaArab = uj.namaArab || document.getElementById('ujianNamaArab').value.trim() || '';
  const tahunArab = uj.tahunArab || document.getElementById('ujianTahunArab').value.trim() || '';
  const tempat = uj.tempat || document.getElementById('ujianTempat').value.trim() || m.tempat || '';
  const tahunFooter = uj.tahunFooter || document.getElementById('ujianTahunFooter').value.trim() || '';

  const rowsHtml = students.length ? students.map(st=>
    `<tr><td>${st.no}</td><td class="name" style="white-space:normal;">${escapeHtml(st.nama)}</td><td></td><td></td><td></td></tr>`
  ).join('') :
    `<tr><td colspan="5" class="empty">Belum ada siswa di kelas ini.</td></tr>`;

  return `
    <div class="certframe">
      <div class="certHead">
        <img src="${LOGO_DATA_URI}" class="certLogo" alt="Logo Madrasah">
        <div class="certHeadText">
          <div class="school" style="font-size:20px; direction:rtl;">${escapeHtml(judulArab)} ${escapeHtml(namaArab)}</div>
          ${tahunArab ? `<div class="addr" style="direction:rtl;">سنة الدراسة : ${escapeHtml(tahunArab)}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="row" style="margin:10px 0 4px;">
      <div class="field" style="flex:0 0 auto;"><strong>Bidang Studi</strong> : ${mapel ? escapeHtml(mapel) : '.........................................'}</div>
    </div>
    <div class="row" style="margin-bottom:10px;">
      <div class="field" style="flex:0 0 auto;"><strong>Kelas</strong> : ${escapeHtml(m.kelas||'')}</div>
    </div>
    <h3 style="text-align:center; text-decoration:underline;">DAFTAR HADIR DAN NILAI UJIAN</h3>
    <div class="tablewrap">
      <table>
        <thead><tr><th style="width:6%;">No.</th><th style="text-align:left;">Nama Murid</th><th>Tanda Tangan</th><th>Hasil Nilai Ujian</th><th>Keterangan</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div class="row" style="margin-top:34px; justify-content:flex-end;">
      <div class="field" style="text-align:center; flex:0 0 260px;">
        ${escapeHtml(tempat)}, ................................. ${escapeHtml(tahunFooter)}<br>
        <strong>MUMTAHIN</strong>
        <br><br><br>
        ( ......................................... )
      </div>
    </div>
  `;
}

document.getElementById('btnTampilkanDaftarUjian').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const sel = document.getElementById('ujianMapel');
  const mapel = sel.value;
  document.getElementById('daftarUjianArea').innerHTML = buildDaftarUjianHTML(mapel);
  document.getElementById('daftarUjianActions').style.display = '';
});

document.getElementById('btnPrintDaftarUjian').addEventListener('click', ()=>{
  if(!document.getElementById('daftarUjianArea').innerHTML.trim()){ toast('Tampilkan daftar ujian dulu'); return; }
  fitPrintTables(document.getElementById('daftarUjianArea'));
  document.body.classList.add('printingDaftarUjian');
  window.print();
  setTimeout(()=>{ document.body.classList.remove('printingDaftarUjian'); resetPrintPagePrefsToDefault(); }, 500);
});

document.getElementById('btnExportDaftarUjian').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const mapel = document.getElementById('ujianMapel').value;
  const students = orderedStudents();
  if(!students.length){ toast('Belum ada siswa di kelas ini'); return; }
  const rows = [['No','Nama Murid','Tanda Tangan','Hasil Nilai Ujian','Keterangan']];
  students.forEach(st=> rows.push([st.no, st.nama, '', '', '']));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows, [4,26,14,16,16]), 'Daftar Ujian');
  const tagMapel = mapel ? mapel.replace(/\s+/g,'_') : 'kosong';
  downloadWorkbook(wb, `daftar-hadir-nilai-ujian-${tagMapel}-${kelasFileTag()}.xlsx`);
});

/* -- Template Impor Absensi: 1 Pekan / 1 Bulan Penuh -- */
function absDateRangeWeek(startISO){
  const start = new Date(startISO+'T00:00:00');
  const days = [];
  for(let i=0;i<7;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    days.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
  }
  return days;
}
function absDatesInMonth(monthISO){ // monthISO = 'YYYY-MM'
  const [y,m] = monthISO.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = [];
  for(let d=1; d<=daysInMonth; d++){
    days.push(y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'));
  }
  return days;
}
function buildAbsensiTemplateWorkbook(dates){
  const header = ['No','Nama', ...dates];
  const rows = [header];
  orderedStudents().forEach(st=> rows.push([st.no, st.nama, ...dates.map(()=>'H')]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows, [4,22,...dates.map(()=>10)]), 'Template Absensi');
  const petunjuk = [
    ['Petunjuk Pengisian Template Absensi'],
    [''],
    ['Kolom tanggal (format YYYY-MM-DD) diisi salah satu kode berikut:'],
    ['H', 'Hadir'],
    ['S', 'Sakit'],
    ['I', 'Izin'],
    ['A', 'Alpa'],
    [''],
    ['Semua sel sudah diisi default "H" (Hadir). Ubah menjadi S/I/A hanya untuk siswa yang tidak hadir penuh pada tanggal tersebut.'],
    ['Jangan mengubah kolom No, Nama, atau nama/urutan kolom tanggal, lalu impor kembali file ini di tab Absensi > "Impor File Absensi Terisi".'],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(petunjuk, [70,14]), 'Petunjuk');
  return wb;
}
document.getElementById('btnTemplateAbsensiMinggu')?.addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  if(!orderedStudents().length){ toast('Tambahkan siswa dulu di tab Siswa'); return; }
  const start = document.getElementById('absTplMingguDari').value || todayISO();
  const dates = absDateRangeWeek(start);
  const wb = buildAbsensiTemplateWorkbook(dates);
  downloadWorkbook(wb, `template-absensi-1pekan-${dates[0]}-${kelasFileTag()}.xlsx`);
  toast('Template 1 pekan diunduh — isi status lalu impor kembali');
});
document.getElementById('btnTemplateAbsensiBulan')?.addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  if(!orderedStudents().length){ toast('Tambahkan siswa dulu di tab Siswa'); return; }
  const bln = document.getElementById('absTplBulan').value || todayISO().slice(0,7);
  const dates = absDatesInMonth(bln);
  const wb = buildAbsensiTemplateWorkbook(dates);
  downloadWorkbook(wb, `template-absensi-1bulan-${bln}-${kelasFileTag()}.xlsx`);
  toast('Template 1 bulan diunduh — isi status lalu impor kembali');
});

/* -- Impor Absensi Terisi (dari template 1 pekan / 1 bulan, atau file serupa) -- */
function absNormalizeStatus(v){
  const s = String(v==null?'':v).trim().toUpperCase();
  if(['H','HADIR'].includes(s)) return 'H';
  if(['S','SAKIT'].includes(s)) return 'S';
  if(['I','IZIN','IJIN'].includes(s)) return 'I';
  if(['A','ALPA','ALPHA'].includes(s)) return 'A';
  return null;
}
function absParseDateCell(v){
  if(v===undefined || v===null || v==='') return null;
  if(v instanceof Date){
    return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
  }
  if(typeof v === 'number'){
    if(typeof XLSX!=='undefined' && XLSX.SSF && XLSX.SSF.parse_date_code){
      const d = XLSX.SSF.parse_date_code(v);
      if(d) return d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');
    }
    return null;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  return null;
}
document.getElementById('btnImportAbsensiTrigger')?.addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  document.getElementById('fileImportAbsensi').click();
});
document.getElementById('fileImportAbsensi')?.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const wb = XLSX.read(ev.target.result, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(!aoa.length){ toast('File kosong'); return; }
      const header = aoa[0];
      const headerStr = header.map(h=>String(h||'').trim());
      const idxNo = headerStr.findIndex(h=>/^no\.?$/i.test(h));
      const idxNama = headerStr.findIndex(h=>/^nama/i.test(h));
      const dateCols = []; // {idx, tgl}
      header.forEach((h,i)=>{
        if(i===idxNo || i===idxNama) return;
        const tgl = absParseDateCell(h);
        if(tgl) dateCols.push({idx:i, tgl});
      });
      if(!dateCols.length){ toast('Tidak ada kolom tanggal yang dikenali (header kolom tanggal harus format YYYY-MM-DD)'); return; }

      const byNo = {}, byNama = {};
      orderedStudents().forEach(st=>{ byNo[String(st.no)] = st; byNama[st.nama.trim().toLowerCase()] = st; });

      const updates = {};
      let matchedStudents = 0;
      const touchedDates = new Set();
      for(let r=1;r<aoa.length;r++){
        const row = aoa[r];
        if(!row || !row.length) continue;
        let st = null;
        if(idxNo!==-1 && row[idxNo]!=='') st = byNo[String(row[idxNo]).trim()];
        if(!st && idxNama!==-1 && row[idxNama]!=='') st = byNama[String(row[idxNama]).trim().toLowerCase()];
        if(!st) continue;
        let rowMatched = false;
        dateCols.forEach(({idx, tgl})=>{
          const status = absNormalizeStatus(row[idx]);
          if(!status) return;
          updates[tgl + '/' + st.id] = status;
          touchedDates.add(tgl);
          rowMatched = true;
        });
        if(rowMatched) matchedStudents++;
      }
      if(!Object.keys(updates).length){ toast('Tidak ada data valid yang bisa diimpor (cek kolom No/Nama & isi status H/S/I/A)'); return; }
      dataRoot('absensi').update(updates).then(()=>{
        toast(`Impor berhasil — ${touchedDates.size} tanggal, ${matchedStudents} siswa diperbarui`);
        loadPendingFromDate();
        renderAbsensiTable();
      });
    }catch(err){
      console.error(err);
      toast('Gagal membaca file: ' + err.message);
    }finally{
      e.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
});

/* -- Ekspor: Tabel Input Nilai (mode tabel) -- */
document.getElementById('btnExportTabelNilai').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const rows = [['No','Nama', ...state.subjects]];
  orderedStudents().forEach(st=>{
    const mapel = (state.scores[st.id]||{}).mapel || {};
    rows.push([st.no, st.nama, ...state.subjects.map(s=> mapel[s] ?? '')]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[4,22,...state.subjects.map(()=>10)]), 'Nilai');
  downloadWorkbook(wb, `nilai-${kelasFileTag()}.xlsx`);
});

/* -- Template import nilai -- */
document.getElementById('btnDownloadTemplate').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  if(!orderedStudents().length){ toast('Tambahkan siswa dulu di tab Siswa'); return; }
  const rows = [['No','Nama', ...state.subjects]];
  orderedStudents().forEach(st=> rows.push([st.no, st.nama, ...state.subjects.map(()=>'')]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[4,22,...state.subjects.map(()=>10)]), 'Template Nilai');
  downloadWorkbook(wb, `template-nilai-${kelasFileTag()}.xlsx`);
  toast('Template diunduh — isi nilai lalu impor kembali');
});

document.getElementById('btnImportTrigger').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  document.getElementById('fileImportNilai').click();
});
document.getElementById('fileImportNilai').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const wb = XLSX.read(ev.target.result, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(!aoa.length){ toast('File kosong'); return; }
      const header = aoa[0].map(h=>String(h||'').trim());
      const idxNo = header.findIndex(h=>/^no\.?$/i.test(h));
      const idxNama = header.findIndex(h=>/^nama/i.test(h));
      const subjColIdx = {};
      state.subjects.forEach(s=>{
        const i = header.findIndex(h=> h.toLowerCase()===s.toLowerCase());
        if(i!==-1) subjColIdx[s] = i;
      });
      if(!Object.keys(subjColIdx).length){ toast('Kolom mapel di file tidak cocok dengan daftar mapel kelas ini'); return; }

      const byNo = {}, byNama = {};
      orderedStudents().forEach(st=>{ byNo[String(st.no)] = st; byNama[st.nama.trim().toLowerCase()] = st; });

      const updates = {};
      let matched = 0;
      for(let r=1;r<aoa.length;r++){
        const row = aoa[r];
        if(!row || !row.length) continue;
        let st = null;
        if(idxNo!==-1 && row[idxNo]!=='') st = byNo[String(row[idxNo]).trim()];
        if(!st && idxNama!==-1 && row[idxNama]!=='') st = byNama[String(row[idxNama]).trim().toLowerCase()];
        if(!st) continue;
        matched++;
        Object.entries(subjColIdx).forEach(([subj, ci])=>{
          const v = row[ci];
          if(v==='' || v===undefined || v===null) return;
          const n = Number(v);
          if(!isNaN(n)) updates[st.id + '/mapel/' + subj] = n;
        });
      }
      if(!matched){ toast('Tidak ada baris yang cocok dengan siswa di kelas ini (cek kolom No/Nama)'); return; }
      dataRoot('scores/'+activeCatur).update(updates).then(()=>{
        toast(`Impor ${CATUR_LABELS[activeCatur]} berhasil — ${matched} siswa diperbarui`);
        renderTabelMassal();
      });
    }catch(err){
      console.error(err);
      toast('Gagal membaca file: ' + err.message);
    }finally{
      e.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
});

