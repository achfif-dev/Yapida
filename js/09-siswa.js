/* ===================== Siswa (database profil lengkap) ===================== */
function studentMatchesFilters(st, q, jk){
  if(jk && (st.jk||'')!==jk) return false;
  if(q){
    const haystack = [st.nama, st.nisn, st.nis, st.alamat, st.tempatLahir, st.ayah, st.ibu, st.wali, st.telp]
      .filter(Boolean).join(' ').toLowerCase();
    if(!haystack.includes(q)) return false;
  }
  return true;
}
function filteredOrderedStudents(){
  const list = orderedStudents();
  const qEl = document.getElementById('studentSearch');
  const jkEl = document.getElementById('studentFilterJk');
  const q = qEl ? qEl.value.trim().toLowerCase() : '';
  const jk = jkEl ? jkEl.value : '';
  if(!q && !jk) return list;
  return list.filter(st=>studentMatchesFilters(st, q, jk));
}
function renderStudentTable(){
  const tbody = document.querySelector('#studentTable tbody');
  tbody.innerHTML = '';
  const all = orderedStudents();
  const list = filteredOrderedStudents();
  document.getElementById('studentEmpty').style.display = all.length ? 'none' : '';
  const hint = document.getElementById('studentFilterHint');
  if(hint){
    if(all.length && list.length!==all.length){
      hint.style.display = '';
      hint.textContent = `Menampilkan ${list.length} dari ${all.length} siswa sesuai pencarian/filter.`;
    } else {
      hint.style.display = 'none';
    }
  }
  list.forEach((st)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${st.no}</td>
      <td class="name">${escapeHtml(st.nama)}</td>
      <td class="num">${escapeHtml(st.nisn||'-')}</td>
      <td>${escapeHtml(st.jk||'-')}</td>
      <td style="text-align:left;">${escapeHtml(st.alamat||'-')}</td>
      <td class="noprint">
        <button class="secondary" data-act="edit" data-id="${st.id}" type="button">Ubah</button>
        <button class="danger" data-act="del" data-id="${st.id}" type="button">Keluarkan</button>
      </td>`;
    tbody.appendChild(tr);
  });
  if(all.length && !list.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="empty" style="padding:16px;">Tidak ada siswa yang cocok dengan pencarian/filter.</td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('button[data-act="del"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.id;
      if(!confirm('Keluarkan siswa ini dari kelas ini? Nilai & absensi di kelas ini akan terhapus. Biodata & riwayat nilai di kelas lain (jika ada) tetap aman.')) return;
      dataRoot('students/'+id).remove();
      CATUR_KEYS.forEach(cw=> dataRoot('scores/'+cw+'/'+id).remove());
      const m = state.studentsMaster[id];
      if(m){
        const riwayat = {...(m.riwayatKelas||{})};
        delete riwayat[activeKelasId];
        const sisaKelas = Object.keys(riwayat);
        studentsRootRef(id+'/riwayatKelas/'+activeKelasId).remove();
        if(!sisaKelas.length){
          // tidak ada riwayat kelas tersisa sama sekali -> hapus juga biodata induknya
          studentsRootRef(id).remove();
        } else if(m.kelasAktifId===activeKelasId){
          studentsRootRef(id+'/kelasAktifId').set(sisaKelas[0]);
        }
      }
      if(studentEditId===id) resetStudentForm();
    });
  });
  tbody.querySelectorAll('button[data-act="edit"]').forEach(b=>{
    b.addEventListener('click', ()=> fillStudentForm(b.dataset.id));
  });
  populatePindahRiwayatSelects();
}

function orderedStudents(){
  return Object.entries(state.students)
    .map(([id, v])=>{
      const m = state.studentsMaster[id];
      // fallback ke record lama (biodata inline) selama migrasi belum selesai ditulis balik oleh Firebase
      return m ? { id, ...m, no: (v && v.no!=null) ? v.no : m.no } : { id, ...v };
    })
    .filter(st=>st.nama)
    .sort((a,b)=>(a.no||0)-(b.no||0));
}

function resetStudentForm(){
  studentEditId = null;
  document.getElementById('studentFormTitle').textContent = 'Tambah Siswa Baru';
  document.getElementById('sfNo').value = orderedStudents().length + 1;
  document.getElementById('sfNama').value = '';
  document.getElementById('sfJk').value = 'L';
  document.getElementById('sfNisn').value = '';
  document.getElementById('sfNis').value = '';
  document.getElementById('sfTempatLahir').value = '';
  document.getElementById('sfTglLahir').value = '';
  document.getElementById('sfAlamat').value = '';
  document.getElementById('sfAyah').value = '';
  document.getElementById('sfIbu').value = '';
  document.getElementById('sfWali').value = '';
  document.getElementById('sfTelp').value = '';
  document.getElementById('btnSaveStudent').textContent = '+ Simpan Siswa';
  document.getElementById('btnCancelStudentEdit').style.display = 'none';
}

function fillStudentForm(id){
  const st = state.studentsMaster[id];
  const enr = state.students[id];
  if(!st) return;
  studentEditId = id;
  document.getElementById('studentFormTitle').textContent = 'Ubah Data Siswa';
  document.getElementById('sfNo').value = (enr && enr.no) || st.no || '';
  document.getElementById('sfNama').value = st.nama || '';
  document.getElementById('sfJk').value = st.jk || 'L';
  document.getElementById('sfNisn').value = st.nisn || '';
  document.getElementById('sfNis').value = st.nis || '';
  document.getElementById('sfTempatLahir').value = st.tempatLahir || '';
  document.getElementById('sfTglLahir').value = st.tglLahir || '';
  document.getElementById('sfAlamat').value = st.alamat || '';
  document.getElementById('sfAyah').value = st.ayah || '';
  document.getElementById('sfIbu').value = st.ibu || '';
  document.getElementById('sfWali').value = st.wali || '';
  document.getElementById('sfTelp').value = st.telp || '';
  document.getElementById('btnSaveStudent').textContent = 'Simpan Perubahan';
  document.getElementById('btnCancelStudentEdit').style.display = '';
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab==='siswa'));
  setTab('siswa');
}

document.getElementById('btnCancelStudentEdit').addEventListener('click', resetStudentForm);

document.getElementById('btnSaveStudent').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu di tab Kelas'); return; }
  const nama = document.getElementById('sfNama').value.trim();
  if(!nama){ toast('Isi nama siswa dulu'); return; }
  const no = Number(document.getElementById('sfNo').value || (orderedStudents().length+1));
  const biodata = {
    nama,
    jk: document.getElementById('sfJk').value,
    nisn: document.getElementById('sfNisn').value.trim(),
    nis: document.getElementById('sfNis').value.trim(),
    tempatLahir: document.getElementById('sfTempatLahir').value.trim(),
    tglLahir: document.getElementById('sfTglLahir').value,
    alamat: document.getElementById('sfAlamat').value.trim(),
    ayah: document.getElementById('sfAyah').value.trim(),
    ibu: document.getElementById('sfIbu').value.trim(),
    wali: document.getElementById('sfWali').value.trim(),
    telp: document.getElementById('sfTelp').value.trim(),
  };

  if(studentEditId){
    // Ubah biodata: berlaku global (ikut siswa ke kelas manapun), no urut hanya berlaku di kelas aktif.
    // Ditulis atomik (satu multi-path update) supaya biodata & no urut selalu konsisten bersamaan.
    db.ref('rapor').update({
      ['students/'+studentEditId+'/nama']: biodata.nama,
      ['students/'+studentEditId+'/jk']: biodata.jk,
      ['students/'+studentEditId+'/nisn']: biodata.nisn,
      ['students/'+studentEditId+'/nis']: biodata.nis,
      ['students/'+studentEditId+'/tempatLahir']: biodata.tempatLahir,
      ['students/'+studentEditId+'/tglLahir']: biodata.tglLahir,
      ['students/'+studentEditId+'/alamat']: biodata.alamat,
      ['students/'+studentEditId+'/ayah']: biodata.ayah,
      ['students/'+studentEditId+'/ibu']: biodata.ibu,
      ['students/'+studentEditId+'/wali']: biodata.wali,
      ['students/'+studentEditId+'/telp']: biodata.telp,
      ['data/'+activeKelasId+'/students/'+studentEditId+'/no']: no,
    }).then(()=>{
      toast('Data siswa diperbarui');
      resetStudentForm();
    }).catch(e=>{
      console.error(e);
      toast('Gagal memperbarui data siswa: '+(e.message||e.code||e));
    });
    return;
  }

  const k = state.kelasList[activeKelasId] || {};
  const newRef = studentsRootRef().push();
  const id = newRef.key;
  const master = {
    ...biodata,
    kelasAktifId: activeKelasId,
    riwayatKelas: { [activeKelasId]: { no, tingkatan:k.tingkatan||'', kelasNama:k.kelasNama||'', catur:k.catur||'', tahun:k.tahun||'', tahunMasehi:k.tahunMasehi||'', tanggal: todayISO() } }
  };
  // Ditulis sebagai SATU operasi atomik (multi-path update dari root 'rapor') supaya biodata
  // global (rapor/students) dan keanggotaan roster kelas (rapor/data/{kelas}/students) selalu
  // tersimpan BARENGAN — kalau koneksi putus di tengah jalan, TIDAK ADA yang tersimpan sama
  // sekali (bukan "nyangkut" separuh: siswa ada secara global tapi hilang dari semua kelas).
  db.ref('rapor').update({
    ['students/'+id]: master,
    ['data/'+activeKelasId+'/students/'+id]: {no}
  }).then(()=>{
    toast('Siswa ditambahkan');
    resetStudentForm();
  }).catch(e=>{
    console.error(e);
    toast('Gagal menyimpan siswa: '+(e.message||e.code||e));
  });
});

