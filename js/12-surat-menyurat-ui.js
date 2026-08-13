/* ===================== Surat Menyurat (khusus Staf/Admin/Super Admin) ===================== */
let suratEditId = null; // null = mode tambah, terisi = mode ubah
function resetSuratForm(){
  suratEditId = null;
  const t = document.getElementById('suratFormTitle'); if(t) t.textContent = 'Tambah Surat';
  const jenis = document.getElementById('stJenis'); if(jenis) jenis.value = 'masuk';
  const nomor = document.getElementById('stNomor'); if(nomor) nomor.value = '';
  const tgl = document.getElementById('stTanggal'); if(tgl) tgl.value = todayISO();
  const pihak = document.getElementById('stPihak'); if(pihak) pihak.value = '';
  const perihal = document.getElementById('stPerihal'); if(perihal) perihal.value = '';
  const ket = document.getElementById('stKeterangan'); if(ket) ket.value = '';
  const btn = document.getElementById('btnSaveSurat'); if(btn) btn.textContent = '+ Simpan Surat';
  const cancel = document.getElementById('btnCancelSuratEdit'); if(cancel) cancel.style.display = 'none';
}
setTimeout(resetSuratForm, 0);
document.getElementById('btnCancelSuratEdit')?.addEventListener('click', resetSuratForm);

document.getElementById('btnSaveSurat')?.addEventListener('click', ()=>{
  if(!(isStaf()||isAdmin())){ toast('Hanya Staf/Admin/Super Admin yang boleh mencatat surat'); return; }
  if(!db){ toast('Hubungkan Firebase dulu (masuk akun)'); return; }
  const perihal = document.getElementById('stPerihal').value.trim();
  if(!perihal){ toast('Isi perihal surat dulu'); return; }
  const data = {
    jenis: document.getElementById('stJenis').value,
    nomor: document.getElementById('stNomor').value.trim(),
    tanggal: document.getElementById('stTanggal').value || todayISO(),
    pihak: document.getElementById('stPihak').value.trim(),
    perihal,
    keterangan: document.getElementById('stKeterangan').value.trim(),
  };
  if(suratEditId){
    suratRootRef(suratEditId).update(data).then(()=>{
      toast('Surat diperbarui');
      resetSuratForm();
    }).catch(e=>{
      console.error(e);
      toast('Gagal memperbarui surat: '+(e.message||e.code||e));
    });
    return;
  }
  const newRef = suratRootRef().push();
  newRef.set(Object.assign({createdAt: firebase.database.ServerValue.TIMESTAMP}, data)).then(()=>{
    toast('Surat disimpan');
    resetSuratForm();
  }).catch(e=>{
    console.error(e);
    toast('Gagal menyimpan surat: '+(e.message||e.code||e));
  });
});

function fillSuratForm(id){
  const s = state.surat[id];
  if(!s) return;
  suratEditId = id;
  document.getElementById('suratFormTitle').textContent = 'Ubah Surat';
  document.getElementById('stJenis').value = s.jenis || 'masuk';
  document.getElementById('stNomor').value = s.nomor || '';
  document.getElementById('stTanggal').value = s.tanggal || '';
  document.getElementById('stPihak').value = s.pihak || '';
  document.getElementById('stPerihal').value = s.perihal || '';
  document.getElementById('stKeterangan').value = s.keterangan || '';
  document.getElementById('btnSaveSurat').textContent = 'Simpan Perubahan';
  document.getElementById('btnCancelSuratEdit').style.display = '';
  setTab('surat');
}

function suratMatchesFilter(s, q, jenisFilter){
  if(jenisFilter && s.jenis !== jenisFilter) return false;
  if(!q) return true;
  const hay = [s.nomor,s.pihak,s.perihal,s.keterangan].map(v=>(v||'').toLowerCase()).join(' ');
  return hay.includes(q);
}

function renderSuratTable(){
  const tbody = document.querySelector('#suratTable tbody');
  if(!tbody) return;
  const searchEl = document.getElementById('suratSearch');
  const jenisEl = document.getElementById('suratFilterJenis');
  const q = (searchEl && searchEl.value || '').trim().toLowerCase();
  const jenisFilter = jenisEl ? jenisEl.value : '';
  const all = Object.entries(state.surat);
  const list = all.filter(([id,s])=> suratMatchesFilter(s,q,jenisFilter))
    .sort((a,b)=> String(b[1].tanggal||'').localeCompare(String(a[1].tanggal||'')));
  tbody.innerHTML = '';
  const emptyEl = document.getElementById('suratEmpty');
  if(emptyEl) emptyEl.style.display = all.length ? 'none' : '';
  list.forEach(([id,s])=>{
    const jenisLabel = s.jenis==='keluar' ? 'Keluar' : 'Masuk';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(s.tanggal||'-')}</td>
      <td><span class="pill${s.jenis==='keluar'?' active':''}">${jenisLabel}</span></td>
      <td style="text-align:left;">${escapeHtml(s.nomor||'-')}</td>
      <td style="text-align:left;">${escapeHtml(s.pihak||'-')}</td>
      <td style="text-align:left;">${escapeHtml(s.perihal||'-')}</td>
      <td class="noprint">
        <button class="secondary" data-act="edit" data-id="${id}" type="button">Ubah</button>
        ${s.suratDoc ? `<button class="secondary" data-act="opendoc" data-id="${id}" type="button">${icon('printer')}Buka Surat</button>` : ''}
        <button class="danger" data-act="del" data-id="${id}" type="button">Hapus</button>
      </td>`;
    tbody.appendChild(tr);
  });
  if(all.length && !list.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="empty" style="padding:16px;">Tidak ada surat yang cocok dengan pencarian/filter.</td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('button[data-act="edit"]').forEach(b=> b.addEventListener('click', ()=> fillSuratForm(b.dataset.id)));
  tbody.querySelectorAll('button[data-act="opendoc"]').forEach(b=> b.addEventListener('click', ()=> openSuratDocFromArsip(b.dataset.id)));
  tbody.querySelectorAll('button[data-act="del"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      if(!confirm('Hapus surat ini dari arsip?')) return;
      suratRootRef(b.dataset.id).remove();
      if(suratEditId===b.dataset.id) resetSuratForm();
    });
  });
}
document.getElementById('suratSearch')?.addEventListener('input', renderSuratTable);
document.getElementById('suratFilterJenis')?.addEventListener('change', renderSuratTable);

document.getElementById('btnExportSurat')?.addEventListener('click', ()=>{
  const rows = [['Tanggal','Jenis','Nomor','Dari/Kepada','Perihal','Keterangan']];
  Object.values(state.surat).sort((a,b)=> String(a.tanggal||'').localeCompare(String(b.tanggal||''))).forEach(s=>{
    rows.push([s.tanggal||'', s.jenis==='keluar'?'Keluar':'Masuk', s.nomor||'', s.pihak||'', s.perihal||'', s.keterangan||'']);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromAOA(rows,[14,10,18,24,30,30]), 'Surat Menyurat');
  downloadWorkbook(wb, `surat-menyurat-${todayISO()}.xlsx`);
});

/* ===================== Buat Surat (dokumen surat kustom, opsional & bisa disimpan ke arsip) ===================== */
const SURAT_DOC_FONTS = {
  sans:    {label:'Sans — Public Sans',       family:"'Public Sans', system-ui, sans-serif"},
  inter:   {label:'Sans — Inter',             family:"'Inter', system-ui, sans-serif"},
  poppins: {label:'Sans — Poppins',           family:"'Poppins', system-ui, sans-serif"},
  serif:   {label:'Serif — PT Serif',         family:"'PT Serif', serif"},
  lora:    {label:'Serif — Lora',             family:"'Lora', serif"},
  garamond:{label:'Serif — EB Garamond',      family:"'EB Garamond', serif"},
  merri:   {label:'Serif — Merriweather',     family:"'Merriweather', serif"},
  times:   {label:'Klasik — Times New Roman', family:"'Times New Roman', Times, serif"},
};
const SURAT_DOC_PAPER = { a4:{w:210,h:297}, f4:{w:215,h:330} };
let sdPendingLogo = undefined; // undefined = tak diubah, '' = dihapus, string = baru (dataURI)
let sdEditArsipId = null; // id record di state.surat yang sedang dibuka/diubah suratDoc-nya (null = belum disimpan)

(function initSuratDocFontSelect(){
  const sel = document.getElementById('sdFont');
  if(!sel) return;
  sel.innerHTML = Object.keys(SURAT_DOC_FONTS).map(k=>`<option value="${k}">${escapeHtml(SURAT_DOC_FONTS[k].label)}</option>`).join('');
})();

function resetSuratDocForm(){
  sdEditArsipId = null;
  sdPendingLogo = undefined;
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value = val; };
  document.getElementById('sdPakaiKop').checked = true;
  const logoFile = document.getElementById('sdLogoFile'); if(logoFile) logoFile.value = '';
  const logoStatus = document.getElementById('sdLogoStatus'); if(logoStatus) logoStatus.textContent = '';
  set('sdYayasan',''); set('sdNamaMadrasah',''); set('sdAlamat','');
  set('sdNomor',''); set('sdLampiran',''); set('sdPerihal','');
  set('sdTempat',''); set('sdTanggal', todayISO());
  set('sdKepada',''); set('sdIsi',''); set('sdPenutup','');
  set('sdTtdPosisi','kanan'); set('sdTtdJabatan','Kepala Madrasah'); set('sdTtdNama',''); set('sdTtdNip','');
  set('sdPaper','a4'); set('sdAlign','left'); set('sdFont','sans');
  set('sdFontSize','100'); set('sdLineHeight','1.5');
  const title = document.getElementById('sdFormTitle'); if(title) title.textContent = 'Buat Surat dari Madrasah';
  const card = document.getElementById('suratDocPreviewCard'); if(card) card.style.display = 'none';
}
resetSuratDocForm();
document.getElementById('btnResetSuratDoc')?.addEventListener('click', ()=>{
  if(!confirm('Kosongkan seluruh form surat ini?')) return;
  resetSuratDocForm();
});

document.getElementById('sdLogoFile')?.addEventListener('change', async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  try{
    sdPendingLogo = await fileToDataUri(file, 300);
    document.getElementById('sdLogoStatus').innerHTML = 'Logo dipilih '+icon('check','solo')+' (klik "Tampilkan Pratinjau")';
  }catch(err){
    console.error(err);
    toast('Gagal membaca gambar logo');
  }
});
document.getElementById('btnClearSdLogo')?.addEventListener('click', ()=>{
  sdPendingLogo = '';
  const logoFile = document.getElementById('sdLogoFile'); if(logoFile) logoFile.value = '';
  document.getElementById('sdLogoStatus').textContent = 'Logo akan dihapus';
});

function collectSuratDocConfig(){
  const g = id => (document.getElementById(id)?.value || '').trim();
  return {
    pakaiKop: !!document.getElementById('sdPakaiKop')?.checked,
    logo: sdPendingLogo!==undefined ? sdPendingLogo : (collectSuratDocConfig._lastLogo || ''),
    yayasan: g('sdYayasan'), namaMadrasah: g('sdNamaMadrasah'), alamat: g('sdAlamat'),
    nomor: g('sdNomor'), lampiran: g('sdLampiran'), perihal: g('sdPerihal'),
    tempat: g('sdTempat'), tanggal: g('sdTanggal'),
    kepada: g('sdKepada'), isi: g('sdIsi'), penutup: g('sdPenutup'),
    ttdPosisi: g('sdTtdPosisi')||'kanan', ttdJabatan: g('sdTtdJabatan'), ttdNama: g('sdTtdNama'), ttdNip: g('sdTtdNip'),
    paper: g('sdPaper')||'a4', align: g('sdAlign')||'left', font: g('sdFont')||'sans',
    fontSize: Number(g('sdFontSize'))||100, lineHeight: Number(g('sdLineHeight'))||1.5,
  };
}

function fillSuratDocForm(cfg){
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value = val; };
  document.getElementById('sdPakaiKop').checked = cfg.pakaiKop!==false;
  sdPendingLogo = undefined; // biarkan logo lama tetap dipakai kecuali diubah lagi
  collectSuratDocConfig._lastLogo = cfg.logo || '';
  document.getElementById('sdLogoStatus').textContent = cfg.logo ? 'Memakai logo tersimpan' : '';
  set('sdYayasan', cfg.yayasan||''); set('sdNamaMadrasah', cfg.namaMadrasah||''); set('sdAlamat', cfg.alamat||'');
  set('sdNomor', cfg.nomor||''); set('sdLampiran', cfg.lampiran||''); set('sdPerihal', cfg.perihal||'');
  set('sdTempat', cfg.tempat||''); set('sdTanggal', cfg.tanggal||todayISO());
  set('sdKepada', cfg.kepada||''); set('sdIsi', cfg.isi||''); set('sdPenutup', cfg.penutup||'');
  set('sdTtdPosisi', cfg.ttdPosisi||'kanan'); set('sdTtdJabatan', cfg.ttdJabatan||''); set('sdTtdNama', cfg.ttdNama||''); set('sdTtdNip', cfg.ttdNip||'');
  set('sdPaper', cfg.paper||'a4'); set('sdAlign', cfg.align||'left'); set('sdFont', cfg.font||'sans');
  set('sdFontSize', cfg.fontSize||100); set('sdLineHeight', cfg.lineHeight||1.5);
}

function formatTanggalIndo(iso){
  if(!iso) return '';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const [y,m,d] = iso.split('-').map(Number);
  if(!y||!m||!d) return iso;
  return `${d} ${bulan[m-1]} ${y}`;
}

function renderSuratDocBoard(cfg){
  const board = document.getElementById('suratDocBoard');
  if(!board) return;
  const fontDef = SURAT_DOC_FONTS[cfg.font] || SURAT_DOC_FONTS.sans;
  const kopHtml = cfg.pakaiKop ? `
    <div class="suratDocKop">
      ${cfg.logo ? `<img src="${cfg.logo}" alt="logo">` : ''}
      <div class="txt">
        ${cfg.yayasan ? `<div class="yayasan">${escapeHtml(cfg.yayasan)}</div>` : ''}
        <div class="madrasah">${escapeHtml(cfg.namaMadrasah||'')}</div>
        ${cfg.alamat ? `<div class="alamat">${escapeHtml(cfg.alamat)}</div>` : ''}
      </div>
    </div>` : '';
  const tglLabel = formatTanggalIndo(cfg.tanggal);
  board.innerHTML = `
    <div class="suratDocPage" style="--sdFont:${fontDef.family}; --sdFontScale:${(cfg.fontSize||100)/100}; --sdLineHeight:${cfg.lineHeight||1.5};">
      ${kopHtml}
      <div class="suratDocMeta">
        <div class="kiri">
          ${cfg.nomor ? `<div>Nomor: ${escapeHtml(cfg.nomor)}</div>` : ''}
          ${cfg.lampiran ? `<div>Lampiran: ${escapeHtml(cfg.lampiran)}</div>` : ''}
          ${cfg.perihal ? `<div>Perihal: <strong>${escapeHtml(cfg.perihal)}</strong></div>` : ''}
        </div>
        <div class="kanan">${[cfg.tempat, tglLabel].filter(Boolean).map(escapeHtml).join(', ')}</div>
      </div>
      ${cfg.kepada ? `<div class="suratDocKepada">${escapeHtml(cfg.kepada)}</div>` : ''}
      <div class="suratDocIsi${cfg.align==='justify'?' justify':''}">${escapeHtml(cfg.isi||'')}</div>
      ${cfg.penutup ? `<div class="suratDocPenutup${cfg.align==='justify'?' justify':''}">${escapeHtml(cfg.penutup)}</div>` : ''}
      <div class="suratDocTtdWrap pos-${cfg.ttdPosisi||'kanan'}">
        <div class="suratDocTtd">
          <div>${escapeHtml(cfg.ttdJabatan||'')}</div>
          <span class="nama">${escapeHtml(cfg.ttdNama||'............................')}</span>
          ${cfg.ttdNip ? `<div class="nip">NIP. ${escapeHtml(cfg.ttdNip)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

function sdApplyPrintPageStyle(paper){
  const sz = SURAT_DOC_PAPER[paper] || SURAT_DOC_PAPER.a4;
  let styleEl = document.getElementById('suratDocPrintPageStyle');
  if(!styleEl){ styleEl = document.createElement('style'); styleEl.id = 'suratDocPrintPageStyle'; document.head.appendChild(styleEl); }
  styleEl.textContent = `@media print{ @page{ size: ${sz.w}mm ${sz.h}mm; margin:0mm; } }`;
}

let lastSuratDocConfig = null;
document.getElementById('btnBuildSuratDoc')?.addEventListener('click', ()=>{
  const cfg = collectSuratDocConfig();
  if(cfg.pakaiKop && !cfg.namaMadrasah){ toast('Isi nama madrasah untuk kop surat, atau matikan opsi kop surat'); return; }
  if(!cfg.perihal && !cfg.isi){ toast('Isi perihal atau isi surat dulu'); return; }
  collectSuratDocConfig._lastLogo = cfg.logo;
  lastSuratDocConfig = cfg;
  renderSuratDocBoard(cfg);
  const card = document.getElementById('suratDocPreviewCard');
  if(card){ card.style.display = ''; card.scrollIntoView({behavior:'smooth', block:'start'}); }
});

document.getElementById('btnPrintSuratDoc')?.addEventListener('click', ()=>{
  if(!lastSuratDocConfig){ toast('Tampilkan pratinjau dulu sebelum mencetak'); return; }
  sdApplyPrintPageStyle(lastSuratDocConfig.paper);
  document.body.classList.add('printingSurat');
  window.print();
});
window.addEventListener('afterprint', ()=> document.body.classList.remove('printingSurat'));

document.getElementById('btnSaveSuratDoc')?.addEventListener('click', ()=>{
  if(!(isStaf()||isAdmin())){ toast('Hanya Staf/Admin/Super Admin yang boleh menyimpan surat'); return; }
  if(!db){ toast('Hubungkan Firebase dulu (masuk akun)'); return; }
  if(!lastSuratDocConfig){ toast('Tampilkan pratinjau dulu sebelum menyimpan'); return; }
  const cfg = lastSuratDocConfig;
  const data = {
    jenis: 'keluar',
    nomor: cfg.nomor || '',
    tanggal: cfg.tanggal || todayISO(),
    pihak: (cfg.kepada||'').split('\n')[0] || '',
    perihal: cfg.perihal || '(Surat tanpa perihal)',
    keterangan: 'Dibuat lewat fitur Buat Surat',
    suratDoc: cfg,
  };
  const after = ()=>{ toast('Surat disimpan ke arsip'); };
  if(sdEditArsipId){
    suratRootRef(sdEditArsipId).update(data).then(after).catch(e=>{ console.error(e); toast('Gagal menyimpan: '+(e.message||e.code||e)); });
  }else{
    const newRef = suratRootRef().push();
    newRef.set(Object.assign({createdAt: firebase.database.ServerValue.TIMESTAMP}, data)).then(()=>{
      sdEditArsipId = newRef.key;
      after();
    }).catch(e=>{ console.error(e); toast('Gagal menyimpan: '+(e.message||e.code||e)); });
  }
});

function openSuratDocFromArsip(id){
  const s = state.surat[id];
  if(!s || !s.suratDoc) return;
  sdEditArsipId = id;
  fillSuratDocForm(s.suratDoc);
  lastSuratDocConfig = s.suratDoc;
  document.getElementById('sdFormTitle').textContent = 'Buat Surat dari Madrasah (mengubah surat tersimpan)';
  renderSuratDocBoard(s.suratDoc);
  const card = document.getElementById('suratDocPreviewCard');
  if(card) card.style.display = '';
  setTab('surat');
  document.getElementById('sdFormTitle')?.scrollIntoView({behavior:'smooth', block:'start'});
}

