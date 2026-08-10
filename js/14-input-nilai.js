/* ===================== Validasi Input Nilai & Absen =====================
   HTML min/max pada <input type="number"> hanya kosmetik (tidak mencegah pengguna
   mengetik/menempel angka di luar rentang), jadi validasi NYATA dilakukan di sini
   sebelum data dikirim ke Firebase. */
function isValidNilai(v){
  if(v===''||v==null) return true; // kosong = dibiarkan (lihat logika existing di caller)
  const n = Number(v);
  return !isNaN(n) && n>=0 && n<=100;
}
function isValidAbsen(v){
  if(v===''||v==null) return true;
  const n = Number(v);
  return !isNaN(n) && n>=0 && Number.isInteger(n);
}

/* ===================== Input Nilai ===================== */
function renderStudentPicker(){
  ['pickStudent','pickPrintStudent'].forEach(selId=>{
    const sel = document.getElementById(selId);
    const cur = sel.value;
    sel.innerHTML = '<option value="">— pilih siswa —</option>';
    orderedStudents().forEach(st=>{
      const opt = document.createElement('option');
      opt.value = st.id; opt.textContent = st.no + '. ' + st.nama;
      sel.appendChild(opt);
    });
    if(cur) sel.value = cur;
  });
}

document.getElementById('pickStudent').addEventListener('change', (e)=>{
  if(perSiswaDirty && !confirm('Ada nilai yang belum disimpan untuk siswa sebelumnya. Ganti siswa dan buang perubahan tsb?')){
    e.target.value = lastPickedStudentId || '';
    return;
  }
  renderInputForm();
});

function renderInputFormIfSelected(){
  if(document.getElementById('pickStudent').value) renderInputForm();
}

function renderInputForm(){
  const id = document.getElementById('pickStudent').value;
  lastPickedStudentId = id;
  perSiswaDirty = false;
  const form = document.getElementById('inputForm');
  const empty = document.getElementById('inputEmpty');
  if(!id){ form.style.display='none'; empty.style.display=''; return; }
  form.style.display=''; empty.style.display='none';

  const wrap = document.getElementById('subjectInputs');
  wrap.innerHTML = '';
  const sc = state.scores[id] || {};
  const mapel = sc.mapel || {};
  state.subjects.forEach(subj=>{
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `<label>${escapeHtml(subj)}</label><input type="number" min="0" max="100" data-subj="${escapeHtml(subj)}" value="${mapel[subj] ?? ''}">`;
    wrap.appendChild(field);
  });

  document.getElementById('absSakit').value = sc.absen?.sakit ?? '';
  document.getElementById('absIjin').value = sc.absen?.ijin ?? '';
  document.getElementById('absAlpa').value = sc.absen?.alpa ?? '';
  document.getElementById('sikapKelakuan').value = sc.sikap?.kelakuan ?? '';
  document.getElementById('sikapKerajinan').value = sc.sikap?.kerajinan ?? '';
  document.getElementById('sikapKebersihan').value = sc.sikap?.kebersihan ?? '';

  updateLiveCalc();
  wrap.querySelectorAll('input').forEach(inp=> inp.addEventListener('input', updateLiveCalc));
  wrap.querySelectorAll('input').forEach(inp=> inp.addEventListener('input', ()=>{
    perSiswaDirty = true;
    inp.style.outline = isValidNilai(inp.value) ? '' : '2px solid var(--danger)';
  }));
  ['absSakit','absIjin','absAlpa'].forEach(fid=> document.getElementById(fid).addEventListener('input', ()=>{ perSiswaDirty = true; }));
  ['absSakit','absIjin','absAlpa'].forEach(fid=> document.getElementById(fid).addEventListener('input', updateLiveCalc));
}

// Rumus pengurangan nilai karena absensi (Sakit tidak mengurangi apapun):
//  - Nilai Asli   : −10 tiap kelipatan 3 Alpa, −10 tiap kelipatan 5 Ijin
//  - Nilai Raport : −1  tiap kelipatan 3 Alpa, −1  tiap kelipatan 5 Ijin
function hitungPotonganAbsen(absen){
  const alpa = Number(absen?.alpa||0);
  const ijin = Number(absen?.ijin||0);
  const asli = Math.floor(alpa/3)*10 + Math.floor(ijin/5)*10;
  const raport = Math.floor(alpa/3)*1 + Math.floor(ijin/5)*1;
  return { asli, raport };
}

function updateLiveCalc(){
  const wrap = document.getElementById('subjectInputs');
  let total = 0;
  wrap.querySelectorAll('input').forEach(inp=> total += Number(inp.value||0));
  const absen = {
    sakit: Number(document.getElementById('absSakit').value||0),
    ijin: Number(document.getElementById('absIjin').value||0),
    alpa: Number(document.getElementById('absAlpa').value||0),
  };
  const pot = hitungPotonganAbsen(absen);
  document.getElementById('absPotongan').value = pot.asli;
  document.getElementById('absPotonganRaport').value = pot.raport;
  const bersih = total - pot.asli;
  const rata = state.subjects.length ? (bersih / state.subjects.length) : 0;
  document.getElementById('liveCalc').textContent =
    `Jumlah: ${total} · Dikurangi absen (Asli): ${pot.asli} · Bersih: ${bersih} · Rata-rata: ${rata.toFixed(2)} · Dikurangi absen (Raport): ${pot.raport}`;
}

document.getElementById('btnSaveScore').addEventListener('click', ()=>{
  const id = document.getElementById('pickStudent').value;
  if(!id){ toast('Pilih siswa dulu'); return; }
  const existingMapel = (state.scores[id] && state.scores[id].mapel) || {};
  const subjInputs = document.querySelectorAll('#subjectInputs input');
  const invalidSubj = Array.from(subjInputs).filter(inp=> !isValidNilai(inp.value));
  if(invalidSubj.length){
    invalidSubj.forEach(inp=> inp.style.outline = '2px solid var(--danger)');
    toast(`Nilai "${invalidSubj[0].dataset.subj}" harus angka 0–100. Perbaiki dulu sebelum disimpan.`);
    invalidSubj[0].focus();
    return;
  }
  const absenIds = ['absSakit','absIjin','absAlpa'];
  const invalidAbsenId = absenIds.find(fid=> !isValidAbsen(document.getElementById(fid).value));
  if(invalidAbsenId){
    toast('Jumlah absen harus angka bulat 0 atau lebih. Perbaiki dulu sebelum disimpan.');
    document.getElementById(invalidAbsenId).focus();
    return;
  }
  const mapel = {};
  subjInputs.forEach(inp=>{
    inp.style.outline = '';
    const v = inp.value;
    if(v===''){
      // biarkan kosong: pertahankan nilai lama (jika ada), jangan menimpa dengan 0
      if(existingMapel[inp.dataset.subj] !== undefined) mapel[inp.dataset.subj] = existingMapel[inp.dataset.subj];
      return;
    }
    mapel[inp.dataset.subj] = Number(v);
  });
  const absen = {
    sakit: Number(document.getElementById('absSakit').value||0),
    ijin: Number(document.getElementById('absIjin').value||0),
    alpa: Number(document.getElementById('absAlpa').value||0),
  };
  const pot = hitungPotonganAbsen(absen);
  const existing = state.scores[id] || {};
  const payload = {
    mapel,
    absen,
    potongan: pot.asli,
    potonganRaport: pot.raport,
    peringkatManual: (existing.peringkatManual!=null) ? existing.peringkatManual : null,
    sikap: {
      kelakuan: document.getElementById('sikapKelakuan').value.trim(),
      kerajinan: document.getElementById('sikapKerajinan').value.trim(),
      kebersihan: document.getElementById('sikapKebersihan').value.trim(),
    }
  };
  dataRoot('scores/'+activeCatur+'/'+id).set(payload).then(()=>{
    toast(`Nilai ${CATUR_LABELS[activeCatur]} disimpan`);
    perSiswaDirty = false;
    tandaiNilaiTersimpan();
  });
});

/* ===================== Mode Input: Per Siswa vs Tabel ===================== */
let inputMode = 'per';
let perSiswaDirty = false;   // true kalau ada input nilai/absen per-siswa yang belum disimpan
let massInputDirty = false;  // true kalau ada input nilai di tabel massal yang belum disimpan
let lastPickedStudentId = '';
function setInputMode(mode){
  inputMode = mode;
  document.getElementById('cardPerSiswa').style.display = mode==='per' ? '' : 'none';
  document.getElementById('cardTabel').style.display = mode==='tabel' ? '' : 'none';
  document.getElementById('btnModePerSiswa').classList.toggle('secondary', mode!=='per');
  document.getElementById('btnModeTabel').classList.toggle('secondary', mode!=='tabel');
  if(mode==='tabel') renderTabelMassal();
}
document.getElementById('btnModePerSiswa').addEventListener('click', ()=>setInputMode('per'));
document.getElementById('btnModeTabel').addEventListener('click', ()=>setInputMode('tabel'));
setInputMode('per');

function renderTabelMassal(){
  const thead = document.querySelector('#tblInputMassal thead');
  const tbody = document.querySelector('#tblInputMassal tbody');
  const list = orderedStudents();
  const subjects = state.subjects;
  document.getElementById('tblInputMassalEmpty').style.display = (list.length && subjects.length) ? 'none' : '';

  thead.innerHTML = '<tr><th>No</th><th style="text-align:left;">Nama</th>' +
    subjects.map(s=>`<th>${escapeHtml(s)}</th>`).join('') + '</tr>';

  tbody.innerHTML = list.map(st=>{
    const sc = state.scores[st.id] || {};
    const mapel = sc.mapel || {};
    return `<tr><td>${st.no}</td><td class="name">${escapeHtml(st.nama)}</td>` +
      subjects.map(s=>`<td><input type="number" min="0" max="100" inputmode="numeric" enterkeyhint="next" style="width:64px;text-align:center;padding:5px;" data-id="${st.id}" data-subj="${escapeHtml(s)}" value="${mapel[s] ?? ''}"></td>`).join('') +
      '</tr>';
  }).join('');
}

// Tombol Enter (PC maupun HP) pindah ke baris di bawahnya pada kolom mapel yang sama,
// mengikuti urutan siswa — persis seperti Excel. Kalau sudah di baris terakhir, lanjut
// ke kolom mapel berikutnya mulai dari baris pertama.
document.querySelector('#tblInputMassal tbody').addEventListener('input', (e)=>{
  const inp = e.target;
  if(!inp || !inp.dataset || !inp.dataset.subj) return;
  massInputDirty = true;
  inp.style.outline = isValidNilai(inp.value) ? '' : '2px solid var(--danger)';
});

document.querySelector('#tblInputMassal tbody').addEventListener('keydown', (e)=>{
  if(e.key !== 'Enter') return;
  const inp = e.target;
  if(!inp || !inp.dataset || !inp.dataset.subj) return;
  e.preventDefault();
  const tbody = document.querySelector('#tblInputMassal tbody');
  const subj = inp.dataset.subj;
  const kolomIni = Array.from(tbody.querySelectorAll('input[data-subj]')).filter(el=> el.dataset.subj === subj);
  const idx = kolomIni.indexOf(inp);
  if(idx === -1) return;
  if(idx < kolomIni.length - 1){
    kolomIni[idx+1].focus();
    kolomIni[idx+1].select();
  } else {
    const subjects = state.subjects;
    const subjIdx = subjects.indexOf(subj);
    if(subjIdx > -1 && subjIdx < subjects.length - 1){
      const nextSubj = subjects[subjIdx+1];
      const kolomBerikutnya = Array.from(tbody.querySelectorAll('input[data-subj]')).filter(el=> el.dataset.subj === nextSubj);
      if(kolomBerikutnya.length){ kolomBerikutnya[0].focus(); kolomBerikutnya[0].select(); }
    }
  }
});

document.getElementById('btnSaveTabelMassal').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const inputs = document.querySelectorAll('#tblInputMassal input');
  if(!inputs.length){ toast('Tidak ada data untuk disimpan'); return; }
  const invalid = Array.from(inputs).filter(inp=> !isValidNilai(inp.value));
  if(invalid.length){
    invalid.forEach(inp=> inp.style.outline = '2px solid var(--danger)');
    toast(`${invalid.length} nilai tidak valid (harus angka 0–100) — kotak merah. Perbaiki dulu sebelum disimpan.`);
    invalid[0].focus();
    return;
  }
  inputs.forEach(inp=> inp.style.outline = '');
  const updates = {};
  inputs.forEach(inp=>{
    const v = inp.value;
    if(v==='') return; // biarkan kosong, jangan menimpa dengan 0 kalau memang belum diisi
    updates[inp.dataset.id + '/mapel/' + inp.dataset.subj] = Number(v);
  });
  if(!Object.keys(updates).length){ toast('Belum ada nilai yang diisi'); return; }
  dataRoot('scores/'+activeCatur).update(updates).then(()=>{
    toast(`Semua nilai ${CATUR_LABELS[activeCatur]} di tabel disimpan`);
    massInputDirty = false;
    tandaiNilaiTersimpan();
  });
});

