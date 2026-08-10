/* ===================== Identitas / Meta ===================== */
function fillMetaForm(){
  const m = state.meta;
  document.getElementById('mNama').value = m.nama || 'MADRASAH TARBIYATUL ISLAM AL-HIDAYAH';
  document.getElementById('mAlamat').value = m.alamat || '';
  document.getElementById('mTingkat').value = m.tingkat || '';
  document.getElementById('mKelas').value = m.kelas || '';
  document.getElementById('mTahun').value = m.tahun || '';
  document.getElementById('mTahunMasehi').value = m.tahunMasehi || '';
  document.getElementById('mWali').value = m.wali || '';
  document.getElementById('mKepala').value = m.kepala || '';
  document.getElementById('mTempat').value = m.tempat || '';
}
function fillCaturMetaForm(){
  const cm = state.caturMeta || {};
  const label = document.getElementById('caturMetaLabel');
  if(label) label.textContent = CATUR_LABELS[activeCatur] || 'Catur Wulan Aktif';
  document.getElementById('mCatur').value = cm.label || '';
  document.getElementById('mTanggal').value = cm.tanggal || '';
}

document.getElementById('btnSaveMeta').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const meta = {
    nama: document.getElementById('mNama').value,
    alamat: document.getElementById('mAlamat').value,
    tingkat: document.getElementById('mTingkat').value,
    kelas: document.getElementById('mKelas').value,
    tahun: document.getElementById('mTahun').value,
    tahunMasehi: document.getElementById('mTahunMasehi').value,
    wali: document.getElementById('mWali').value,
    kepala: document.getElementById('mKepala').value,
    tempat: document.getElementById('mTempat').value,
  };
  dataRoot('meta').set(meta).then(()=>toast('Identitas rapor disimpan'));
});

document.getElementById('btnSaveCaturMeta').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const caturMeta = {
    label: document.getElementById('mCatur').value,
    tanggal: document.getElementById('mTanggal').value,
  };
  dataRoot('caturMeta/'+activeCatur).set(caturMeta).then(()=>toast(`Identitas ${CATUR_LABELS[activeCatur]} disimpan`));
});

/* ===================== Subjects ===================== */
function renderSubjectList(){
  const wrap = document.getElementById('subjectList');
  wrap.innerHTML = '';
  state.subjects.forEach((s, i)=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginBottom = '6px';
    row.innerHTML = `
      <div class="field" style="flex:0 0 40px;"><span class="pill">${i+1}</span></div>
      <div class="field" style="flex:3;"><input data-idx="${i}" class="subjInput" value="${escapeHtml(s)}" readonly></div>
      <div class="field noprint" style="flex:0 0 auto;align-self:center;display:flex;gap:4px;">
        <button class="secondary btnMoveSubjUp" data-idx="${i}" type="button" title="Naikkan urutan" ${i===0?'disabled':''} style="min-width:40px;">▲</button>
        <button class="secondary btnMoveSubjDown" data-idx="${i}" type="button" title="Turunkan urutan" ${i===state.subjects.length-1?'disabled':''} style="min-width:40px;">▼</button>
      </div>
      <div class="field" style="flex:0 0 auto;align-self:center;display:flex;gap:6px;">
        <button class="secondary btnEditSubj" data-idx="${i}" type="button">Edit</button>
        <button class="danger btnDeleteSubj" data-idx="${i}" type="button">Hapus</button>
      </div>
    `;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('button.btnMoveSubjUp').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = Number(btn.dataset.idx);
      if(idx<=0) return;
      const tmp = state.subjects[idx-1];
      state.subjects[idx-1] = state.subjects[idx];
      state.subjects[idx] = tmp;
      renderSubjectList();
    });
  });
  wrap.querySelectorAll('button.btnMoveSubjDown').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = Number(btn.dataset.idx);
      if(idx>=state.subjects.length-1) return;
      const tmp = state.subjects[idx+1];
      state.subjects[idx+1] = state.subjects[idx];
      state.subjects[idx] = tmp;
      renderSubjectList();
    });
  });
  wrap.querySelectorAll('.subjInput').forEach(input=>{
    input.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' && !input.readOnly){
        e.preventDefault();
        const idx = input.dataset.idx;
        const btn = wrap.querySelector(`button.btnEditSubj[data-idx="${idx}"]`);
        if(btn) btn.click();
      }
    });
  });
  wrap.querySelectorAll('button.btnEditSubj').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = Number(btn.dataset.idx);
      const input = wrap.querySelector(`.subjInput[data-idx="${idx}"]`);
      const editing = btn.dataset.editing === '1';
      if(!editing){
        // Masuk mode edit
        input.removeAttribute('readonly');
        input.focus();
        input.select();
        btn.textContent = 'Simpan';
        btn.dataset.editing = '1';
        btn.classList.remove('secondary');
        btn.classList.add('gold');
      } else {
        // Simpan perubahan nama mapel ini
        if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
        const newVal = input.value.trim();
        if(!newVal){ toast('Nama mapel tidak boleh kosong'); input.focus(); return; }
        const dup = state.subjects.some((sub, j)=> j!==idx && sub.trim().toLowerCase()===newVal.toLowerCase());
        if(dup){ toast('Nama mapel tersebut sudah ada di daftar'); input.focus(); return; }
        const namaLama = state.subjects[idx];
        state.subjects[idx] = newVal;
        dataRoot('subjects').set(state.subjects).then(()=>{
          toast(namaLama===newVal ? 'Nama mapel disimpan' : `Mapel "${namaLama}" diubah menjadi "${newVal}"`);
          renderSubjectList();
        });
      }
    });
  });
  wrap.querySelectorAll('button.btnDeleteSubj').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const namaMapel = state.subjects[Number(btn.dataset.idx)] || '';
      if(!confirm(`Hapus mapel "${namaMapel}" dari daftar? Nilai mapel ini yang sudah tersimpan untuk siswa TIDAK otomatis terhapus, tapi kolomnya tidak akan tampil lagi sampai mapel ditambahkan ulang. Jangan lupa klik "Simpan Daftar Mapel" setelah ini.`)) return;
      state.subjects.splice(Number(btn.dataset.idx), 1);
      renderSubjectList();
    });
  });
  populateUjianMapelSelect();
}
document.getElementById('btnAddSubject').addEventListener('click', ()=>{
  const inp = document.getElementById('newSubject');
  const v = inp.value.trim();
  if(!v) return;
  state.subjects.push(v);
  inp.value = '';
  renderSubjectList();
});
document.getElementById('btnSaveSubjects').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const inputs = document.querySelectorAll('.subjInput');
  const list = Array.from(inputs).map(i=>i.value.trim()).filter(Boolean);
  if(!list.length){ toast('Daftar mapel tidak boleh kosong'); return; }
  state.subjects = list;
  dataRoot('subjects').set(list).then(()=>toast('Daftar mapel disimpan'));
});

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ===================== Mapel Prioritas (tie-break peringkat) ===================== */
function renderTieBreakList(){
  const addSel = document.getElementById('tieBreakAddSelect');
  const cur = addSel.value;
  const available = state.subjects.filter(s=> !state.tieBreak.includes(s));
  addSel.innerHTML = available.length
    ? available.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')
    : '<option value="">— semua mapel sudah masuk urutan —</option>';
  if(available.includes(cur)) addSel.value = cur;

  const wrap = document.getElementById('tieBreakList');
  const empty = document.getElementById('tieBreakEmpty');
  empty.style.display = state.tieBreak.length ? 'none' : '';
  wrap.innerHTML = state.tieBreak.map((s,i)=>`
    <div class="row" style="margin-bottom:6px; align-items:center;">
      <div class="field" style="flex:0 0 30px;"><span class="pill">${i+1}</span></div>
      <div class="field" style="flex:3;">${escapeHtml(s)}</div>
      <div class="field" style="flex:0 0 auto;display:flex;gap:4px;">
        <button class="secondary" data-act="up" data-idx="${i}" type="button" ${i===0?'disabled':''}>↑</button>
        <button class="secondary" data-act="down" data-idx="${i}" type="button" ${i===state.tieBreak.length-1?'disabled':''}>↓</button>
        <button class="danger" data-act="rm" data-idx="${i}" type="button">Hapus</button>
      </div>
    </div>
  `).join('');
  wrap.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = Number(btn.dataset.idx);
      if(btn.dataset.act==='up' && i>0){ [state.tieBreak[i-1],state.tieBreak[i]]=[state.tieBreak[i],state.tieBreak[i-1]]; }
      if(btn.dataset.act==='down' && i<state.tieBreak.length-1){ [state.tieBreak[i+1],state.tieBreak[i]]=[state.tieBreak[i],state.tieBreak[i+1]]; }
      if(btn.dataset.act==='rm'){
        if(!confirm(`Hapus "${escapeHtml(state.tieBreak[i]||'')}" dari urutan mapel prioritas? Jangan lupa klik "Simpan Urutan Prioritas" setelah ini.`)) return;
        state.tieBreak.splice(i,1);
      }
      renderTieBreakList();
    });
  });
}
document.getElementById('btnTieBreakAdd').addEventListener('click', ()=>{
  const v = document.getElementById('tieBreakAddSelect').value;
  if(!v) return;
  if(!state.tieBreak.includes(v)) state.tieBreak.push(v);
  renderTieBreakList();
});
document.getElementById('btnSaveTieBreak').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  dataRoot('tieBreak').set(state.tieBreak).then(()=>toast('Urutan prioritas peringkat disimpan'));
});

