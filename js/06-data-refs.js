/* ===================== Kelas (multi-tingkatan) ===================== */
function kelasListRef(path){ return db.ref('rapor/kelasList' + (path?('/'+path):'')); }
function dataRoot(path){ return db.ref('rapor/data/' + activeKelasId + (path?('/'+path):'')); }

/* ===================== Database Murid (global, lintas kelas & kenaikan kelas) =====================
   rapor/students/{studentId} menyimpan biodata induk siswa + riwayatKelas (semua kelas yang
   pernah/sedang ditempuh). ID ini SAMA dipakai sebagai key di rapor/data/{kelasId}/scores/{studentId}
   di setiap kelas yang pernah ia tempuh, jadi nilai di kelas-kelas sebelumnya tetap bisa diakses
   walau siswa sudah naik/pindah/tinggal kelas. rapor/data/{kelasId}/students/{studentId} sendiri
   hanya menyimpan {no} — nomor urut siswa tsb di kelas itu (data "keanggotaan kelas", bukan biodata). */
let studentsMasterRef = null;
function studentsRootRef(path){ return db.ref('rapor/students' + (path?('/'+path):'')); }

/* ===================== Template Ijazah (global, lintas kelas per tingkatan) ===================== */
function attachIjazahTemplatesListener(){
  if(ijazahTemplatesRef) ijazahTemplatesRef.off();
  ijazahTemplatesRef = db.ref('rapor/ijazahTemplates');
  ijazahTemplatesRef.on('value', snap=>{
    ijazahTemplates = snap.val() || {};
    renderIjazahTab();
  });
}
function getIjazahTemplate(key){
  const base = IJAZAH_DEFAULT_TEMPLATES[key] || {};
  return Object.assign({}, base, ijazahTemplates[key] || {});
}

function attachStudentsMasterListener(){
  studentsMasterRef = studentsRootRef();
  state.studentsMaster = {};
  // Sama seperti students/scores/absensi per kelas: pakai child_* (bukan 'value') supaya saat
  // SATU siswa berubah, Firebase tidak mengirim ULANG seluruh database murid dari semua kelas.
  const renderMaster = debounce(()=>{ renderStudentTable(); renderStudentPicker(); renderRekap(); populatePindahRiwayatSelects(); renderDatabaseSiswaGlobal(); }, 80);
  studentsMasterRef.on('child_added', snap=>{ state.studentsMaster[snap.key] = snap.val(); renderMaster(); });
  studentsMasterRef.on('child_changed', snap=>{ state.studentsMaster[snap.key] = snap.val(); renderMaster(); });
  studentsMasterRef.on('child_removed', snap=>{ delete state.studentsMaster[snap.key]; renderMaster(); });
}

