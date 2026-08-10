/* ===================== Surat Menyurat (khusus Staf/Admin/Super Admin, global lintas kelas) =====================
   Disimpan di node level-atas 'surat/{id}' — SENGAJA DI LUAR 'rapor/...' (bukan 'rapor/surat'), karena
   'rapor' punya .read:true untuk SEMUA role non-viewer (termasuk Guru) di Security Rules, dan aturan anak
   tidak bisa mempersempit izin baca yang sudah diberikan induknya (cascading). Supaya Guru benar-benar
   tidak bisa membaca arsip surat (bukan cuma disembunyikan di UI), node ini dipisah — sama seperti 'backup'
   yang juga dipisah dari 'rapor' untuk alasan yang sama. Listener hanya dipasang untuk role yang berhak
   (lihat applyRoleUI) supaya tidak memboroskan kuota baca Firebase Spark plan untuk role Guru. CATATAN:
   path 'surat' ini perlu diizinkan (read/write hanya utk staf/admin/superadmin) di Firebase Realtime
   Database Rules — lihat blok "surat" di rules.json, sejajar dengan "rapor" dan "backup". */
let suratRef = null;
function suratRootRef(path){ return db.ref('surat' + (path?('/'+path):'')); }
function attachSuratListener(){
  if(suratRef) return; // sudah terpasang
  suratRef = suratRootRef();
  state.surat = {};
  const renderSurat = debounce(()=>{ renderSuratTable(); }, 80);
  suratRef.on('child_added', snap=>{ state.surat[snap.key] = snap.val(); renderSurat(); });
  suratRef.on('child_changed', snap=>{ state.surat[snap.key] = snap.val(); renderSurat(); });
  suratRef.on('child_removed', snap=>{ delete state.surat[snap.key]; renderSurat(); });
}
function detachSuratListener(){
  if(suratRef){ suratRef.off(); suratRef = null; }
  state.surat = {};
  const tbody = document.querySelector('#suratTable tbody');
  if(tbody) tbody.innerHTML = '';
}

// Migrasi otomatis: kelas lama menyimpan biodata lengkap langsung di rapor/data/{kelasId}/students/{id}.
// Begitu terlihat, biodata itu dipindah ke rapor/students/{id} (ID dipertahankan supaya nilai yang
// sudah ada di rapor/data/{kelasId}/scores/{id} tetap terhubung), lalu record kelas disederhanakan jadi {no}.
function migrateLegacyStudentIfNeeded(kelasId, studentId, v){
  if(!v || v.nama===undefined) return; // sudah bentuk baru ({no} saja) atau kosong
  const k = state.kelasList[kelasId] || {};
  const master = {
    nama:v.nama||'', jk:v.jk||'', nisn:v.nisn||'', nis:v.nis||'', tempatLahir:v.tempatLahir||'',
    tglLahir:v.tglLahir||'', alamat:v.alamat||'', ayah:v.ayah||'', ibu:v.ibu||'', wali:v.wali||'', telp:v.telp||'',
    kelasAktifId: kelasId,
    riwayatKelas: { [kelasId]: { no:v.no||0, tingkatan:k.tingkatan||'', kelasNama:k.kelasNama||'', catur:k.catur||'', tahun:k.tahun||'', tahunMasehi:k.tahunMasehi||'', tanggal: todayISO() } }
  };
  studentsRootRef(studentId).set(master);
  db.ref('rapor/data/'+kelasId+'/students/'+studentId).set({no: v.no||0});
}

// Untuk role Guru, hanya kelas yang ditugaskan padanya yang boleh muncul/dipilih.
// Staf, Admin, Super Admin melihat semua kelas.
function accessibleKelasIds(){
  return Object.keys(state.kelasList||{}).filter(id=> canAccessKelas(id));
}

function attachKelasListListener(){
  kelasListRef().on('value', snap=>{
    state.kelasList = snap.val() || {};
    populateKelasFilterTahun();
    renderKelasTable();
    populateKelasSwitcher();
    populateCopySubjectsFrom();
    populatePindahRiwayatSelects();
    renderDatabaseSiswaGlobal();

    // Kelas pertama kali di database ini (belum ada kelas sama sekali): isi bawaan Tahun
    // Ajaran dengan 1447-1448 H / 2026-2027 M supaya admin tidak perlu ngetik dari nol.
    // Untuk kelas-kelas selanjutnya, Tahun Ajaran otomatis maju +1 lewat "Copy Format dari
    // Kelas Tahun Sebelumnya" (lihat nextTahunAjaranString), bukan lewat kode ini lagi.
    if(!Object.keys(state.kelasList).length && !kelasEditId){
      const tH = document.getElementById('newTahun');
      const tM = document.getElementById('newTahunMasehi');
      if(tH && !tH.value) tH.value = '1447-1448 H';
      if(tM && !tM.value) tM.value = '2026-2027 M';
    }

    const keys = accessibleKelasIds();
    if(kelasEditId && !state.kelasList[kelasEditId]) resetKelasForm();
    if(activeKelasId && !state.kelasList[activeKelasId]){
      // active kelas was deleted elsewhere
      setActiveKelas(keys[0] || null);
    } else if(activeKelasId && !canAccessKelas(activeKelasId)){
      // kelas aktif sudah tidak lagi diizinkan untuk role ini (mis. Guru dicabut dari kelas)
      setActiveKelas(keys[0] || null);
    } else if(!activeKelasId){
      const saved = localStorage.getItem('rapor_active_kelas');
      if(saved && state.kelasList[saved] && canAccessKelas(saved)) setActiveKelas(saved);
      else if(keys.length) setActiveKelas(keys[0]);
    }
  });
}

function populateKelasSwitcher(){
  const cur = activeKelasId;
  const allowed = new Set(accessibleKelasIds());
  const entries = sortKelasEntries(Object.entries(state.kelasList)).filter(([id])=> allowed.has(id));
  ['kelasSwitcher','studentFilterKelas'].forEach(selId=>{
    const sel = document.getElementById(selId);
    if(!sel) return;
    sel.innerHTML = '';
    if(!entries.length){
      sel.innerHTML = isGuru() ? '<option value="">— belum ada kelas ditugaskan ke Anda —</option>' : '<option value="">— belum ada kelas —</option>';
      return;
    }
    let curGroup = null, groupEl = sel;
    entries.forEach(([id, k])=>{
      const tLabel = k.tingkatan || 'Lainnya';
      if(tLabel !== curGroup){
        curGroup = tLabel;
        groupEl = document.createElement('optgroup');
        groupEl.label = tLabel;
        sel.appendChild(groupEl);
      }
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${k.tingkatan} ${k.kelasNama}${k.catur ? (' · CW '+k.catur) : ''}`;
      groupEl.appendChild(opt);
    });
    if(cur) sel.value = cur;
  });
}
document.getElementById('kelasSwitcher').addEventListener('change', (e)=>{
  setActiveKelas(e.target.value || null);
});
document.getElementById('studentFilterKelas').addEventListener('change', (e)=>{
  document.getElementById('kelasSwitcher').value = e.target.value;
  setActiveKelas(e.target.value || null);
});
document.getElementById('studentSearch').addEventListener('input', debounce(renderStudentTable, 120));
document.getElementById('studentFilterJk').addEventListener('change', renderStudentTable);

function populateCopySubjectsFrom(){
  const sel = document.getElementById('copySubjectsFrom');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— jangan salin, isi manual —</option>';
  // Diurutkan tahun terbaru dulu supaya "kelas tahun sebelumnya" gampang ditemukan saat mau buat kelas tahun baru.
  Object.entries(state.kelasList)
    .sort((a,b)=> kelasGroupYearNum(kelasGroupKey(b[1])) - kelasGroupYearNum(kelasGroupKey(a[1])))
    .forEach(([id,k])=>{
      const opt = document.createElement('option');
      opt.value = id;
      const tahunLabel = kelasGroupLabel(k);
      opt.textContent = `${k.tingkatan||''} ${k.kelasNama||''}${tahunLabel!=='Tanpa Tahun Ajaran' ? (' — '+tahunLabel) : ''}`;
      sel.appendChild(opt);
    });
  sel.value = cur;
}
document.getElementById('copySubjectsFrom').addEventListener('change', (e)=>{
  const id = e.target.value;
  if(!id || kelasEditId) return; // hanya isi otomatis saat mode buat kelas baru
  const k = state.kelasList[id];
  if(!k) return;
  document.getElementById('newTingkatan').value = k.tingkatan || 'TPQ';
  document.getElementById('newKelasNama').value = k.kelasNama || '';
  // Tahun Ajaran otomatis dimajukan +1 dari kelas yang disalin (H & M sama-sama), supaya
  // tidak perlu ngetik manual tiap bikin kelas untuk tahun ajaran berikutnya.
  const nextH = nextTahunAjaranString(k.tahun||'');
  const nextM = nextTahunAjaranString(k.tahunMasehi||'');
  if(nextH) document.getElementById('newTahun').value = nextH;
  if(nextM) document.getElementById('newTahunMasehi').value = nextM;
  toast('Nama, mapel & Tahun Ajaran (otomatis +1 tahun) disalin — cek dulu sebelum simpan');
});

// Menaikkan 1 tahun dari string Tahun Ajaran, mempertahankan format aslinya apa adanya
// (pemisah, spasi, akhiran "H"/"M", dsb) — hanya dua angka tahunnya yang ditambah 1.
// Contoh: "1447-1448 H" -> "1448-1449 H", "2026-2027 M" -> "2027-2028 M".
function nextTahunAjaranString(s){
  s = (s||'').trim();
  if(!s) return '';
  const m = s.match(/(\d{3,4})(\D+)(\d{3,4})/);
  if(!m) return s; // format tidak dikenali, biarkan apa adanya supaya tidak merusak isian
  const a = parseInt(m[1],10) + 1;
  const b = parseInt(m[3],10) + 1;
  return s.slice(0, m.index) + a + m[2] + b + s.slice(m.index + m[0].length);
}

/* ---- Pengelompokan kelas per Tahun Ajaran (untuk grouping & filter) ---- */
function kelasGroupKey(k){
  const h = (k.tahun||'').trim();
  const m = (k.tahunMasehi||'').trim();
  if(!h && !m) return '__none__';
  return h + '||' + m;
}
function kelasGroupLabel(k){
  const h = (k.tahun||'').trim();
  const m = (k.tahunMasehi||'').trim();
  if(!h && !m) return 'Tanpa Tahun Ajaran';
  return [h, m].filter(Boolean).join(' / ');
}
function kelasGroupYearNum(key){
  const match = (key||'').match(/\d{3,4}/);
  return match ? parseInt(match[0],10) : -1;
}
function populateKelasFilterTahun(){
  const sel = document.getElementById('kelasFilterTahun');
  if(!sel) return;
  const cur = sel.value;
  const groups = {}; // key -> {label, count}
  Object.values(state.kelasList).forEach(k=>{
    const key = kelasGroupKey(k);
    if(!groups[key]) groups[key] = {label: kelasGroupLabel(k), count: 0};
    groups[key].count++;
  });
  const sortedKeys = Object.keys(groups).sort((a,b)=> kelasGroupYearNum(b) - kelasGroupYearNum(a));
  sel.innerHTML = '<option value="">— Semua Tahun —</option>' +
    sortedKeys.map(key=> `<option value="${escapeHtml(key)}">${escapeHtml(groups[key].label)} (${groups[key].count} kelas)</option>`).join('');
  if(cur && groups[cur]) sel.value = cur; else sel.value = '';
}
document.getElementById('kelasFilterTahun')?.addEventListener('change', renderKelasTable);

function renderKelasTable(){
  const tbody = document.querySelector('#kelasTable tbody');
  tbody.innerHTML = '';
  const allowedIds = new Set(accessibleKelasIds());
  const allEntries = Object.entries(state.kelasList).filter(([id])=> allowedIds.has(id));
  document.getElementById('kelasEmpty').style.display = allEntries.length ? 'none' : '';

  const filterVal = document.getElementById('kelasFilterTahun')?.value || '';
  const entries = filterVal ? allEntries.filter(([id,k])=> kelasGroupKey(k)===filterVal) : allEntries;
  const filterEmptyEl = document.getElementById('kelasFilterEmpty');
  if(filterEmptyEl) filterEmptyEl.style.display = (allEntries.length && !entries.length) ? '' : 'none';

  // Kelompokkan berdasarkan Tahun Ajaran, urutkan grup dari tahun terbaru ke terlama.
  const groups = {}; // key -> {label, items:[[id,k],...]}
  entries.forEach(([id,k])=>{
    const key = kelasGroupKey(k);
    if(!groups[key]) groups[key] = {label: kelasGroupLabel(k), items: []};
    groups[key].items.push([id,k]);
  });
  const sortedKeys = Object.keys(groups).sort((a,b)=> kelasGroupYearNum(b) - kelasGroupYearNum(a));

  sortedKeys.forEach(key=>{
    const g = groups[key];
    const trHead = document.createElement('tr');
    trHead.innerHTML = `<td colspan="5" style="text-align:left; background:var(--paper-2); font-weight:700; color:var(--deep-2);">${icon('calendar')}Tahun Ajaran: ${escapeHtml(g.label)} <span class="hint" style="font-weight:400;">(${g.items.length} kelas)</span></td>`;
    tbody.appendChild(trHead);
    const items = sortKelasEntries(g.items);
    let curTingkatan = null;
    items.forEach(([id,k])=>{
      const tLabel = k.tingkatan || 'Lainnya';
      if(tLabel !== curTingkatan){
        curTingkatan = tLabel;
        const trSub = document.createElement('tr');
        trSub.innerHTML = `<td colspan="5" style="text-align:left; background:#f7f4ea; font-weight:600; color:var(--gold); font-size:11.5px; letter-spacing:.03em; text-transform:uppercase;">— ${escapeHtml(tLabel)} —</td>`;
        tbody.appendChild(trSub);
      }
      const tr = document.createElement('tr');
      const isActive = id===activeKelasId;
      tr.innerHTML = `
        <td>${escapeHtml(k.tingkatan||'')}</td>
        <td class="name">${escapeHtml(k.kelasNama||'')} ${isActive ? '<span class="pill active">aktif</span>' : ''} ${k.kelasAkhir ? `<span class="pill" title="Kelas akhir — tab Ijazah aktif">${icon('graduation-cap')}Kelas Akhir</span>` : ''}</td>
        <td>${escapeHtml(k.tahun||'')}</td>
        <td>${escapeHtml(k.tahunMasehi||'')}</td>
        <td class="noprint">
          ${isActive ? '' : `<button class="secondary" data-act="switch" data-id="${id}" type="button">Pindah</button>`}
          <button class="secondary" data-act="edit" data-id="${id}" type="button">Ubah</button>
          <button class="danger" data-act="del" data-id="${id}" type="button">Hapus</button>
        </td>`;
      tbody.appendChild(tr);
    });
  });

  updateHeaderLine();

  tbody.querySelectorAll('button[data-act="switch"]').forEach(b=>{
    b.addEventListener('click', ()=> setActiveKelas(b.dataset.id));
  });
  tbody.querySelectorAll('button[data-act="edit"]').forEach(b=>{
    b.addEventListener('click', ()=> fillKelasForm(b.dataset.id));
  });
  tbody.querySelectorAll('button[data-act="del"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const k = state.kelasList[b.dataset.id];
      if(!confirm(`Hapus kelas "${k?.tingkatan||''} ${k?.kelasNama||''}" beserta semua siswa & nilainya? Tindakan ini tidak bisa dibatalkan.`)) return;
      kelasListRef(b.dataset.id).remove();
      db.ref('rapor/data/'+b.dataset.id).remove();
      if(kelasEditId===b.dataset.id) resetKelasForm();
    });
  });
}

function resetKelasForm(){
  kelasEditId = null;
  document.getElementById('kelasFormTitle').textContent = 'Buat Kelas / Tingkatan Baru';
  document.getElementById('newTingkatan').value = 'TPQ';
  document.getElementById('newKelasNama').value = '';
  document.getElementById('newTahun').value = '';
  document.getElementById('newTahunMasehi').value = '';
  document.getElementById('newKelasAkhir').checked = false;
  document.getElementById('copySubjectsFrom').value = '';
  document.getElementById('copySubjectsRow').style.display = '';
  document.getElementById('btnCreateKelas').textContent = '+ Buat Kelas';
  document.getElementById('btnCancelKelasEdit').style.display = 'none';
}

function fillKelasForm(id){
  const k = state.kelasList[id];
  if(!k) return;
  kelasEditId = id;
  document.getElementById('kelasFormTitle').textContent = 'Ubah Kelas';
  document.getElementById('newTingkatan').value = k.tingkatan || 'TPQ';
  document.getElementById('newKelasNama').value = k.kelasNama || '';
  document.getElementById('newTahun').value = k.tahun || '';
  document.getElementById('newTahunMasehi').value = k.tahunMasehi || '';
  document.getElementById('newKelasAkhir').checked = !!k.kelasAkhir;
  document.getElementById('copySubjectsRow').style.display = 'none'; // tidak relevan saat mengubah kelas yang sudah ada
  document.getElementById('btnCreateKelas').textContent = 'Simpan Perubahan';
  document.getElementById('btnCancelKelasEdit').style.display = '';
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab==='kelas'));
  setTab('kelas');
}

document.getElementById('btnCancelKelasEdit').addEventListener('click', resetKelasForm);

document.getElementById('btnCreateKelas').addEventListener('click', async ()=>{
  if(!canEditStrukturKelas()){ toast('Anda tidak punya izin membuat/mengubah kelas'); return; }
  if(!db){ toast('Hubungkan Firebase dulu di tab Firebase'); return; }
  const tingkatan = document.getElementById('newTingkatan').value;
  const kelasNama = document.getElementById('newKelasNama').value.trim();
  const tahun = document.getElementById('newTahun').value.trim();
  const tahunMasehi = document.getElementById('newTahunMasehi').value.trim();
  const kelasAkhir = document.getElementById('newKelasAkhir').checked;
  if(!kelasNama){ toast('Isi nama/nomor kelas dulu'); return; }

  if(kelasEditId){
    // Mode ubah: kelas yang sudah ada, tidak menyentuh siswa/nilai/mapel
    const id = kelasEditId;
    await kelasListRef(id).update({tingkatan, kelasNama, tahun, tahunMasehi, kelasAkhir});
    await db.ref('rapor/data/'+id+'/meta').update({
      tingkat: tingkatan, kelas: kelasNama, tahun, tahunMasehi
    });
    toast('Kelas diperbarui');
    resetKelasForm();
    return;
  }

  const ref = kelasListRef().push();
  const id = ref.key;
  await ref.set({tingkatan, kelasNama, tahun, tahunMasehi, kelasAkhir});

  const copyFromId = document.getElementById('copySubjectsFrom').value;
  let subjectsToUse = DEFAULT_SUBJECTS.slice();
  if(copyFromId){
    const snap = await db.ref('rapor/data/'+copyFromId+'/subjects').get();
    const v = snap.val();
    if(v && v.length) subjectsToUse = v;
  }
  await db.ref('rapor/data/'+id+'/subjects').set(subjectsToUse);
  await db.ref('rapor/data/'+id+'/meta').set({
    nama: 'MADRASAH TARBIYATUL ISLAM AL-HIDAYAH',
    tingkat: tingkatan, kelas: kelasNama, tahun, tahunMasehi
  });

  document.getElementById('newKelasNama').value = '';
  document.getElementById('newTahun').value = '';
  document.getElementById('newTahunMasehi').value = '';
  document.getElementById('newKelasAkhir').checked = false;
  toast('Kelas dibuat');
  setActiveKelas(id);
});

function setActiveKelas(id){
  currentDataRefs.forEach(ref=>ref.off());
  currentDataRefs = [];
  currentCaturRefs.forEach(ref=>ref.off());
  currentCaturRefs = [];
  activeKelasId = id;
  localStorage.setItem('rapor_active_kelas', id || '');
  populateKelasSwitcher();
  renderKelasTable();
  syncCaturSwitcherUI();

  const identitasCard = document.getElementById('identitasCard');
  const caturMetaCard = document.getElementById('caturMetaCard');
  const subjectsCard = document.getElementById('subjectsCard');
  const tieBreakCard = document.getElementById('tieBreakCard');

  if(!id){
    identitasCard.style.display = 'none';
    caturMetaCard.style.display = 'none';
    subjectsCard.style.display = 'none';
    tieBreakCard.style.display = 'none';
    state.meta = {}; state.caturMeta = {}; state.subjects = DEFAULT_SUBJECTS.slice(); state.students = {}; state.scores = {}; state.absensi = {}; state.tieBreak = []; state.ujianMeta = {};
    state.ijazahUmum = {}; state.ijazah = {};
    updateHeaderLine();
    renderStudentTable(); renderStudentPicker(); renderInputForm(); renderRekap(); renderSubjectList(); renderAbsensiTable(); renderTieBreakList(); renderTabelMassal(); renderIjazahTab();
    document.getElementById('legacyScoreBanner').style.display = 'none';
    return;
  }
  identitasCard.style.display = '';
  caturMetaCard.style.display = '';
  subjectsCard.style.display = '';
  tieBreakCard.style.display = '';
  updateHeaderLine();
  attachDataListeners();
  attachCaturListeners();
  checkLegacyScores();
  // Render ulang SEMUA tab (bukan cuma tab yang sedang aktif) segera setelah state
  // di-reset ke kelas baru, supaya tab Siswa/Absensi/Input Nilai/Rekap/Ijazah langsung
  // tersinkron ke kelas yang baru dipilih tanpa perlu refresh halaman. Data Firebase
  // yang datang belakangan (child_added dst) akan tetap merender ulang seperti biasa;
  // panggilan di sini hanya memastikan tampilan tidak "nyangkut" menampilkan sisa data
  // kelas sebelumnya selama menunggu data kelas baru datang (mis. kelas baru kosong).
  renderStudentTable();
  renderStudentPicker();
  renderInputForm(); // penting: pilihan siswa lama sudah tidak valid di kelas baru, form nilai perlu ikut direset
  renderRekap();
  renderSubjectList();
  renderAbsensiTable();
  renderTieBreakList();
  renderTabelMassal();
  renderIjazahTab();
}

function attachDataListeners(){
  const mRef = dataRoot('meta');
  mRef.on('value', snap=>{ state.meta = snap.val() || {}; fillMetaForm(); updateHeaderLine(); });

  const sRef = dataRoot('subjects');
  sRef.on('value', snap=>{
    const v = snap.val();
    state.subjects = (v && v.length) ? v : DEFAULT_SUBJECTS.slice();
    renderSubjectList();
    renderTieBreakList();
    renderRekap();
    renderInputFormIfSelected();
  });

  // ---- students, absensi: pakai child_* event, bukan 'value' ----
  // Hemat kuota Firebase gratis (Spark, 10GB/bulan): listener 'value' mengirim
  // ULANG seluruh isi node setiap kali ada satu perubahan kecil di dalamnya.
  // Untuk node yang terus tumbuh (banyak siswa, banyak tanggal absensi),
  // dengan child_added/child_changed/child_removed hanya data ANAK yang
  // berubah yang ditransfer — jauh lebih hemat bandwidth. Render di-debounce
  // karena update massal (mis. simpan tabel nilai) memicu banyak child_changed
  // sekaligus.
  const stRef = dataRoot('students');
  state.students = {};
  const renderStudents = debounce(()=>{ renderStudentTable(); renderStudentPicker(); renderRekap(); populatePindahRiwayatSelects(); }, 80);
  stRef.on('child_added', snap=>{
    const v = snap.val();
    migrateLegacyStudentIfNeeded(activeKelasId, snap.key, v);
    state.students[snap.key] = v; renderStudents();
  });
  stRef.on('child_changed', snap=>{ state.students[snap.key] = snap.val(); renderStudents(); });
  stRef.on('child_removed', snap=>{ delete state.students[snap.key]; renderStudents(); });

  const abRef = dataRoot('absensi');
  state.absensi = {};
  const renderAbsensi = debounce(()=>{ renderAbsensiTable(); }, 80);
  abRef.on('child_added', snap=>{ state.absensi[snap.key] = snap.val(); renderAbsensi(); });
  abRef.on('child_changed', snap=>{ state.absensi[snap.key] = snap.val(); renderAbsensi(); });
  abRef.on('child_removed', snap=>{ delete state.absensi[snap.key]; renderAbsensi(); });

  const tbRef = dataRoot('tieBreak');
  tbRef.on('value', snap=>{
    state.tieBreak = snap.val() || [];
    renderTieBreakList();
    renderRekap();
  });

  const ijUmumRef = dataRoot('ijazahUmum');
  ijUmumRef.on('value', snap=>{ state.ijazahUmum = snap.val() || {}; renderIjazahTab(); });

  const ujRef = dataRoot('ujianMeta');
  ujRef.on('value', snap=>{ state.ujianMeta = snap.val() || {}; fillUjianMetaForm(); });

  const ijRef = dataRoot('ijazah');
  state.ijazah = {};
  const renderIjz = debounce(()=>{ renderIjazahTab(); }, 80);
  ijRef.on('child_added', snap=>{ state.ijazah[snap.key] = snap.val(); renderIjz(); });
  ijRef.on('child_changed', snap=>{ state.ijazah[snap.key] = snap.val(); renderIjz(); });
  ijRef.on('child_removed', snap=>{ delete state.ijazah[snap.key]; renderIjz(); });

  currentDataRefs = [mRef, sRef, stRef, abRef, tbRef, ijUmumRef, ijRef, ujRef];
}

// Nilai (scores) & identitas per-Catur Wulan dipasang terpisah dari attachDataListeners()
// supaya berpindah Catur Wulan (cw1/cw2/cw3) TIDAK perlu melepas & memasang ulang semua
// listener kelas lainnya (siswa, absensi, ijazah, dst) — cukup nilai & identitas catur wulannya saja.
function attachCaturListeners(){
  currentCaturRefs.forEach(ref=>ref.off());
  currentCaturRefs = [];
  if(!activeKelasId) return;

  const cmRef = dataRoot('caturMeta/'+activeCatur);
  cmRef.on('value', snap=>{ state.caturMeta = snap.val() || {}; fillCaturMetaForm(); });

  const scRef = dataRoot('scores/'+activeCatur);
  state.scores = {};
  const renderScores = debounce(()=>{ renderRekap(); renderInputFormIfSelected(); renderTabelMassal(); }, 80);
  scRef.on('child_added', snap=>{ state.scores[snap.key] = snap.val(); renderScores(); });
  scRef.on('child_changed', snap=>{ state.scores[snap.key] = snap.val(); renderScores(); });
  scRef.on('child_removed', snap=>{ delete state.scores[snap.key]; renderScores(); });

  // Metadata "siapa & kapan terakhir menyimpan nilai" untuk Catur Wulan ini — bukan penguncian
  // (guru lain tetap bisa menyimpan kapan saja), sekadar kesadaran bersama supaya guru tahu kalau
  // rekan lain baru saja mengubah nilai di kelas yang sama (hindari kebingungan/tertimpa tanpa sadar).
  const smRef = dataRoot('scoresMeta/'+activeCatur);
  smRef.on('value', snap=>{
    const v = snap.val();
    const el = document.getElementById('nilaiLastSavedInfo');
    if(!el) return;
    el.textContent = (v && v.byName)
      ? `Terakhir disimpan oleh ${v.byName} pada ${new Date(v.at).toLocaleString('id-ID')}`
      : '';
  });

  currentCaturRefs = [cmRef, scRef, smRef];
}

function tandaiNilaiTersimpan(){
  if(!activeKelasId || !currentUserProfile) return;
  dataRoot('scoresMeta/'+activeCatur).set({
    byName: currentUserProfile.displayName || currentUserProfile.email || 'Tidak diketahui',
    at: firebase.database.ServerValue.TIMESTAMP
  }).catch(()=>{}); // gagal-diam: metadata ini murni informasional, bukan boleh menghalangi penyimpanan nilai
}

function syncCaturSwitcherUI(){
  const sel = document.getElementById('caturSwitcher');
  if(sel) sel.value = activeCatur;
}

// Deteksi sisa data nilai format lama (sebelum ada Catur Wulan): tersimpan langsung di
// rapor/data/{kelasId}/scores/{studentId}/mapel, bukan di scores/{cw1|cw2|cw3}/{studentId}.
async function checkLegacyScores(){
  const banner = document.getElementById('legacyScoreBanner');
  if(!banner || !activeKelasId) return;
  try{
    const snap = await dataRoot('scores').get();
    const v = snap.val() || {};
    const hasLegacy = Object.entries(v).some(([k,val])=> !CATUR_KEYS.includes(k) && val && typeof val==='object' && ('mapel' in val));
    banner.style.display = hasLegacy ? '' : 'none';
  }catch(e){ console.error(e); }
}

document.getElementById('btnMigrasiNilaiLama').addEventListener('click', async ()=>{
  if(!activeKelasId) return;
  if(!confirm('Pindahkan semua nilai format lama di kelas ini ke Catur Wulan 1? Data lama akan dihapus setelah dipindah.')) return;
  try{
    const snap = await dataRoot('scores').get();
    const v = snap.val() || {};
    const updates = {};
    let count = 0;
    Object.entries(v).forEach(([k,val])=>{
      if(CATUR_KEYS.includes(k)) return; // sudah format baru, lewati
      if(val && typeof val==='object' && ('mapel' in val)){
        updates['cw1/'+k] = val;
        updates[k] = null; // hapus yang lama
        count++;
      }
    });
    if(!count){ toast('Tidak ada nilai lama yang perlu dimigrasi'); return; }
    await dataRoot('scores').update(updates);
    toast(`${count} data nilai berhasil dipindah ke Catur Wulan 1`);
    document.getElementById('legacyScoreBanner').style.display = 'none';
    if(activeCatur==='cw1') attachCaturListeners();
  }catch(e){ console.error(e); toast('Gagal migrasi: '+e.message); }
});

document.getElementById('caturSwitcher').addEventListener('change', (e)=>{
  switchCatur(e.target.value);
});
function switchCatur(catur){
  if(!CATUR_KEYS.includes(catur)) return;
  activeCatur = catur;
  localStorage.setItem('rapor_active_catur', catur);
  syncCaturSwitcherUI();
  if(activeKelasId) attachCaturListeners();
  else { renderRekap(); renderInputFormIfSelected(); renderTabelMassal(); }
}


function updateHeaderLine(){
  // Header dibuat umum (tidak menampilkan detail nilai/absensi).
  // Kelas & tahun ajaran yang sedang aktif ditampilkan sebagai badge di header, dan bisa diganti di tab "Kelas".
  document.getElementById('schoolLine').textContent = 'Yayasan Pendidikan Islam Al-Hidayah — Yapida — realtime';
  const badge = document.getElementById('activeKelasBadge');
  const text = document.getElementById('activeKelasText');
  if(!badge || !text) return;
  const k = activeKelasId ? state.kelasList[activeKelasId] : null;
  if(k){
    const tahunLabel = kelasGroupLabel(k);
    text.textContent = `Kelas Aktif: ${k.tingkatan||''} ${k.kelasNama||''}${tahunLabel!=='Tanpa Tahun Ajaran' ? (' — '+tahunLabel) : ''}`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

