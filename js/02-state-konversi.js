/* ===================== State ===================== */
const DEFAULT_SUBJECTS = ["Tauhid","Fiqih","Tafsir","Hadits","Nahwu","Shorrof","Qoidah Fiqh","Ushul Fiqh",
  "Ilmu Akhlaq","Akhlaq","Balaghah","Tarikh Islam","I'rob","Imla'","Baca Al-Qur'an","Baca Kitab","Kemasyarakatan"];

const CATUR_KEYS = ['cw1','cw2','cw3'];
const CATUR_LABELS = { cw1:'Catur Wulan 1', cw2:'Catur Wulan 2', cw3:'Catur Wulan 3' };

let db = null;
let activeKelasId = null;
let activeCatur = localStorage.getItem('rapor_active_catur') || 'cw1';
let currentDataRefs = [];
let currentCaturRefs = []; // listener nilai (scores) & caturMeta — dilepas/dipasang ulang saat ganti Catur Wulan TANPA reset seluruh kelas
let studentEditId = null; // null = mode tambah, terisi = mode ubah
let kelasEditId = null; // null = mode buat kelas baru, terisi = mode ubah kelas

let state = {
  kelasList: {},   // kelasId -> {tingkatan, kelasNama, tahun} — 1 kelas dipakai utuh dari CW1 s/d CW3
  meta: {},        // identitas kelas yang berlaku sepanjang tahun (nama madrasah, alamat, wali, kepala, tempat, tahun)
  caturMeta: {},   // {label, tanggal} milik Catur Wulan yang sedang aktif (dataRoot('caturMeta/'+activeCatur))
  subjects: DEFAULT_SUBJECTS.slice(),
  students: {},   // id -> {no}  (enrollment/urutan siswa DI KELAS AKTIF SAJA)
  studentsMaster: {}, // id -> {nama, nisn, nis, jk, ..., kelasAktifId, riwayatKelas:{kelasId:{no,tingkatan,kelasNama,tahun,tanggal}}} — database murid, tidak terikat satu kelas
  surat: {},      // id -> {jenis:'masuk'|'keluar', nomor, tanggal, pihak, perihal, keterangan} — arsip surat menyurat, global (tidak terikat kelas)
  scores: {},     // id -> {mapel:{...}, absen:{sakit,ijin,alpa}, potongan, potonganRaport, peringkatManual, sikap:{...}} — HANYA utk Catur Wulan aktif (dataRoot('scores/'+activeCatur))
                   // potongan & potonganRaport dihitung otomatis dari absen (lihat hitungPotonganAbsen), disimpan hanya sebagai arsip.
                   // peringkatManual: override peringkat oleh guru untuk kasus nilai bersih sama (null = pakai perhitungan otomatis).
  absensi: {},     // tanggal -> { studentId -> 'H'|'S'|'I'|'A' } — menyatu sepanjang tahun ajaran
  tieBreak: [],    // array mapel, urutan prioritas untuk memecah peringkat yang sama
  ijazahUmum: {},  // data umum ijazah kelas aktif: {noAwal, dariH, dariM, sampaiH, sampaiM, tempat, terbitH, terbitM}
  ijazah: {},      // studentId -> {noIjazah, noInduk, foto}
  ujianMeta: {}    // pengaturan cetak "Daftar Hadir & Nilai Ujian": {judulArab, namaArab, tahunArab, tempat, tahunFooter}
};

let ijazahTemplates = {}; // tingkatanKey -> template config (global, lintas kelas)
let ijazahTemplatesRef = null;

/* ===================== Konversi Nilai Asli -> Nilai Raport (global, lintas kelas, bisa diatur per-sekolah) =====================
   Disimpan di 'rapor/konversiRaport' (global, SEJAJAR dengan 'rapor/ijazahTemplates' — bukan di dalam
   dataRoot()/per-kelas) supaya berlaku untuk SEMUA kelas dalam satu database/sekolah, sesuai
   keterangan "Berlaku untuk semua kelas" yang sudah ada di tab Akun. Tiap sekolah yang memakai
   instance aplikasi ini (lewat Setup Wizard White Label / database Firebase sendiri) bisa punya
   tabel konversi sendiri, tanpa perlu mengedit kode. */
const DEFAULT_KONVERSI_RAPORT = [
  {min:85, nilai:9},
  {min:75, nilai:8},
  {min:65, nilai:7},
  {min:55, nilai:6},
  {min:45, nilai:5},
  {min:0,  nilai:4}
];
let konversiRaportRules = DEFAULT_KONVERSI_RAPORT.map(r=>Object.assign({}, r)); // array {min, nilai}, terurut menurun berdasarkan min
let konversiRaportRef = null;

function normalizeKonversiRaportRules(list){
  let rules = (Array.isArray(list) ? list : [])
    .map(r=> ({ min:Number(r && r.min), nilai:Number(r && r.nilai) }))
    .filter(r=> !isNaN(r.min) && !isNaN(r.nilai));
  if(!rules.length) rules = DEFAULT_KONVERSI_RAPORT.map(r=>Object.assign({}, r));
  rules.sort((a,b)=> b.min - a.min); // menurun: nilai min tertinggi dicek lebih dulu
  return rules;
}

function attachKonversiRaportListener(){
  if(konversiRaportRef) konversiRaportRef.off();
  konversiRaportRef = db.ref('rapor/konversiRaport');
  konversiRaportRef.on('value', snap=>{
    konversiRaportRules = normalizeKonversiRaportRules(snap.val());
    renderKonversiRaportTable();
    if(typeof renderRekap === 'function') renderRekap();
  });
}

function saveKonversiRaportRules(rules){
  const clean = normalizeKonversiRaportRules(rules);
  return db.ref('rapor/konversiRaport').set(clean).then(()=>toast('Batas konversi nilai raport disimpan'));
}

/* Render tabel di tab Akun. Guru/Viewer hanya lihat (read-only); Staf/Admin/Super Admin bisa edit
   langsung di dalam tabel (baris ditambah/dihapus dinamis) lalu menekan "Simpan Konversi". */
function renderKonversiRaportTable(){
  const tbody = document.querySelector('#konversiRaportTable tbody');
  if(!tbody) return; // belum login / tab belum dirender
  const canEdit = (typeof isAdmin === 'function') && isAdmin();
  const rules = konversiRaportRules.slice().sort((a,b)=> b.min - a.min);
  tbody.innerHTML = '';
  rules.forEach((r, i)=>{
    const tr = document.createElement('tr');
    if(canEdit){
      tr.innerHTML =
        '<td><input type="number" class="konversiMinInput" data-i="'+i+'" value="'+r.min+'" style="width:90px;"></td>'
      + '<td><input type="number" class="konversiNilaiInput" data-i="'+i+'" value="'+r.nilai+'" style="width:90px;"></td>'
      + '<td class="noprint"><button class="danger konversiHapusBaris" data-i="'+i+'" type="button" style="min-height:32px;">Hapus</button></td>';
    } else {
      tr.innerHTML = '<td>≥ '+r.min+'</td><td>'+r.nilai+'</td><td class="noprint"></td>';
    }
    tbody.appendChild(tr);
  });
  document.getElementById('konversiRaportEmpty').style.display = rules.length ? 'none' : '';
  const editRow = document.getElementById('konversiRaportEditRow');
  if(editRow) editRow.style.display = canEdit ? '' : 'none';
  const info = document.getElementById('konversiRaportInfo');
  if(info) info.textContent = canEdit
    ? 'Nilai asli >= "Nilai Asli Minimal" akan dikonversi ke "Nilai Raport" pada baris tsb (baris dengan minimal tertinggi yang masih terpenuhi yang dipakai). Pastikan ada satu baris dengan minimal 0 sebagai batas paling bawah.'
    : '';
}

function readKonversiRaportRulesFromForm(){
  const mins = Array.from(document.querySelectorAll('#konversiRaportTable .konversiMinInput'));
  const nilais = Array.from(document.querySelectorAll('#konversiRaportTable .konversiNilaiInput'));
  return mins.map((el,i)=> ({ min:Number(el.value), nilai:Number(nilais[i] ? nilais[i].value : 0) }));
}

document.getElementById('btnKonversiTambahBaris').addEventListener('click', ()=>{
  const current = readKonversiRaportRulesFromForm();
  current.push({min:0, nilai:0});
  konversiRaportRules = normalizeKonversiRaportRules(current);
  renderKonversiRaportTable();
});

document.getElementById('konversiRaportTable').addEventListener('click', (e)=>{
  const btn = e.target.closest('.konversiHapusBaris');
  if(!btn) return;
  const current = readKonversiRaportRulesFromForm();
  current.splice(Number(btn.dataset.i), 1);
  konversiRaportRules = normalizeKonversiRaportRules(current.length ? current : DEFAULT_KONVERSI_RAPORT);
  renderKonversiRaportTable();
});

document.getElementById('btnKonversiSimpan').addEventListener('click', ()=>{
  const rules = readKonversiRaportRulesFromForm();
  if(!rules.length){ toast('Minimal harus ada satu baris konversi'); return; }
  saveKonversiRaportRules(rules).catch(e=>{ console.error(e); toast('Gagal menyimpan: '+(e.message||e.code||e)); });
});

document.getElementById('btnKonversiReset').addEventListener('click', ()=>{
  if(!confirm('Kembalikan tabel konversi ke pengaturan bawaan (85/75/65/55/45)?')) return;
  saveKonversiRaportRules(DEFAULT_KONVERSI_RAPORT).catch(e=>{ console.error(e); toast('Gagal menyimpan: '+(e.message||e.code||e)); });
});
let ijzSelectedStudentId = null;
let ijzPreviewStudentId = null;

const IJAZAH_FONT_PRESETS = {
  klasik: { label:"Klasik — Fraunces & Public Sans", title:"'Fraunces', serif", body:"'Public Sans', system-ui, sans-serif" },
  elegan: { label:"Elegan — Playfair Display & EB Garamond", title:"'Playfair Display', serif", body:"'EB Garamond', serif" },
  formal: { label:"Formal — Merriweather & Lora", title:"'Merriweather', serif", body:"'Lora', serif" },
  modern: { label:"Modern — Poppins & Inter", title:"'Poppins', sans-serif", body:"'Inter', sans-serif" },
  naskah: { label:"Naskah Klasik — Cormorant Garamond", title:"'Cormorant Garamond', serif", body:"'Cormorant Garamond', serif" },
  regal: { label:"Regal — Cinzel & Crimson Text", title:"'Cinzel', serif", body:"'Crimson Text', serif" },
  pustaka: { label:"Pustaka Kuno — Libre Baskerville & EB Garamond", title:"'Libre Baskerville', serif", body:"'EB Garamond', serif" },
  kontemporer: { label:"Kontemporer — Montserrat & Nunito", title:"'Montserrat', sans-serif", body:"'Nunito', sans-serif" },
  minimalis: { label:"Minimalis — Raleway & Work Sans", title:"'Raleway', sans-serif", body:"'Work Sans', sans-serif" },
  spektral: { label:"Spektral Anggun — Spectral & Spectral", title:"'Spectral', serif", body:"'Spectral', serif" },
  marcelus: { label:"Anggun Tipis — Marcellus & Josefin Sans", title:"'Marcellus', serif", body:"'Josefin Sans', sans-serif" },
  skrip: { label:"Skrip Mewah — Great Vibes & EB Garamond", title:"'Great Vibes', cursive", body:"'EB Garamond', serif" },
  displaymewah: { label:"Display Mewah — DM Serif Display & Lora", title:"'DM Serif Display', serif", body:"'Lora', serif" },
  cormorantTipis: { label:"Cormorant Tipis — Cormorant & EB Garamond", title:"'Cormorant', serif", body:"'EB Garamond', serif" },
  prataKlasik: { label:"Prata Klasik — Prata & Cormorant Garamond", title:"'Prata', serif", body:"'Cormorant Garamond', serif" },
  bodoniFormal: { label:"Bodoni Formal — Bodoni Moda & PT Serif", title:"'Bodoni Moda', serif", body:"'PT Serif', serif" },
  ornamenDekoratif: { label:"Ornamen Dekoratif — Cinzel Decorative & Crimson Text", title:"'Cinzel Decorative', serif", body:"'Crimson Text', serif" },
  kaligrafiLatin: { label:"Kaligrafi Latin — Tangerine & Lora", title:"'Tangerine', cursive", body:"'Lora', serif" },
  italiaKlasik: { label:"Italia Klasik — Italiana & EB Garamond", title:"'Italiana', serif", body:"'EB Garamond', serif" },
  antikNaskah: { label:"Antik Naskah — IM Fell English", title:"'IM Fell English', serif", body:"'IM Fell English', serif" },
  serifTerbaca: { label:"Serif Terbaca — Vollkorn & Source Serif 4", title:"'Vollkorn', serif", body:"'Source Serif 4', serif" },
};
function ijzFontPreset(key){ return IJAZAH_FONT_PRESETS[key] || IJAZAH_FONT_PRESETS.klasik; }

const IJAZAH_ARABIC_FONTS = {
  amiri: { label:"Amiri — Naskh Klasik", family:"'Amiri', serif" },
  scheherazade: { label:"Scheherazade New — Naskh Mushaf", family:"'Scheherazade New', serif" },
  notonaskh: { label:"Noto Naskh Arabic — Naskh Modern", family:"'Noto Naskh Arabic', serif" },
  lateef: { label:"Lateef — Naskh Ringan", family:"'Lateef', serif" },
  arefruqaa: { label:"Aref Ruqaa — Gaya Ruq'ah/Kaligrafi", family:"'Aref Ruqaa', serif" },
  rakkas: { label:"Rakkas — Dekoratif Tebal", family:"'Rakkas', cursive" },
  reemkufi: { label:"Reem Kufi — Kufi Modern", family:"'Reem Kufi', sans-serif" },
  elmessiri: { label:"El Messiri — Kufi Kontemporer", family:"'El Messiri', sans-serif" },
  cairo: { label:"Cairo — Sans Modern", family:"'Cairo', sans-serif" },
  tajawal: { label:"Tajawal — Sans Bersih", family:"'Tajawal', sans-serif" },
  mada: { label:"Mada — Sans Geometris", family:"'Mada', sans-serif" },
  harmattan: { label:"Harmattan — Klasik Sahara", family:"'Harmattan', serif" },
  markazi: { label:"Markazi Text — Naskh Modern Tipis", family:"'Markazi Text', serif" },
  katibeh: { label:"Katibeh — Display Kufi Tebal", family:"'Katibeh', system-ui, sans-serif" },
  jomhuria: { label:"Jomhuria — Display Kondensasi", family:"'Jomhuria', sans-serif" },
  changa: { label:"Changa — Sans Modern", family:"'Changa', sans-serif" },
  mirza: { label:"Mirza — Gaya Nastaliq Ringan", family:"'Mirza', cursive" },
  notokufi: { label:"Noto Kufi Arabic — Kufi Bersih", family:"'Noto Kufi Arabic', sans-serif" },
};
function ijzArabFont(key){ return IJAZAH_ARABIC_FONTS[key] || IJAZAH_ARABIC_FONTS.amiri; }

const IJAZAH_DEFAULT_TEMPLATES = {
  tpq: {
    lembagaAtas: "YAYASAN PENDIDIKAN ISLAM AL-HIDAYAH (YAPIDA)",
    namaMadrasah: "TAMAN PENDIDIKAN AL-QUR'AN ( TPQ ) AL-HIDAYAH",
    alamat: "UJUNG PIRING BANGKALAN",
    tingkatLabel: "",
    showTingkatLine: false,
    showSesudahLine: false,
    judulBelakang: "EVALUASI BELAJAR TAHAP AKHIR",
    kepalaLabel: "Kepala TPQ Al-Hidayah",
    kepalaNama: "MAHMIYATUL KIROMAH",
    ketuaLabel: "Ketua",
    ketuaNama: "JUHARI, S.Ag MEI",
    showPanitia: false,
    panitiaKetua: "", panitiaSekretaris: "",
    materiTambahan: ["Surat-surat Pendek","Niatnya Shalat","Do'a Sehari-hari"],
    leadIntro: "Yang bertandatangan di bawah ini,\nKepala Taman Pendidikan Al-Qur'an ( TPQ )\nMemutuskan Bahwa:",
    closingText: "Telah lulus dalam Evaluasi Belajar tulis baca Al-qur'an Tingkat ( TPQ ) yang di laksanakan pada tanggal {DARI_M} sampai {SAMPAI_M}.\nIjazah ini di berikan sebagai bukti bahwa nama tersebut telah menyelesaikan pendidikan di Taman Pendidikan Al-Qur'an ( TPQ ) Al-Hidayah",
    borderImg: "",
    showArabTop: true,
    arabTop: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nيَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ",
    contentOffsetX: 0, contentOffsetY: 0, contentScale: 100,
    fontPreset: "klasik", fontPresetArab: "amiri"
  },
  ibtidaiyah: {
    lembagaAtas: "YAYASAN PENDIDIKAN ISLAM AL-HIDAYAH (YAPIDA)",
    namaMadrasah: "MADRASAH DINIYAH TAKMILIYAH AL-HIDAYAH",
    alamat: "UJUNG PIRING BANGKALAN",
    tingkatLabel: "TINGKAT AWALIYAH ( 6 TAHUN )",
    showTingkatLine: true,
    showSesudahLine: true,
    judulBelakang: "EVALUASI BELAJAR TAHAP AKHIR",
    kepalaLabel: "Kepala Madrasah.",
    kepalaNama: "MOH.TAUFIQ MUNAWIR",
    ketuaLabel: "Ketua",
    ketuaNama: "JUHARI, S.Ag MEI",
    showPanitia: true,
    panitiaKetua: "HAFSAH", panitiaSekretaris: "MARATUS SHOLIHAH",
    materiTambahan: [],
    leadIntro: "Kami memutuskan bahwa :",
    closingText: "Telah lulus dalam Evaluasi Belajar Tahap Akhir tersebut diatas dan sebagai bukti surat ijazah ini kami berikan.",
    borderImg: "",
    showArabTop: true,
    arabTop: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nيَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ",
    contentOffsetX: 0, contentOffsetY: 0, contentScale: 100,
    fontPreset: "klasik", fontPresetArab: "amiri"
  },
  tsanawiyah: {
    lembagaAtas: "YAYASAN PENDIDIKAN ISLAM AL-HIDAYAH (YAPIDA)",
    namaMadrasah: "MADRASAH TARBIYATUL ISLAM AL-HIDAYAH",
    alamat: "UJUNG PIRING BANGKALAN",
    tingkatLabel: "TINGKAT WUSTHO ( 3 TAHUN )",
    showTingkatLine: true,
    showSesudahLine: true,
    judulBelakang: "EVALUASI BELAJAR TAHAP AKHIR",
    kepalaLabel: "Kepala Madrasah.",
    kepalaNama: "MOH. NASHIR SYAFI'I",
    ketuaLabel: "Ketua",
    ketuaNama: "JUHARI, S.Ag MEI",
    showPanitia: true,
    panitiaKetua: "ABD. ROSYID FADLI", panitiaSekretaris: "M. THOHA AHMAD",
    materiTambahan: [],
    leadIntro: "Kami memutuskan bahwa :",
    closingText: "Telah lulus dalam Evaluasi Belajar Tahap Akhir tersebut diatas dan sebagai bukti surat ijazah ini kami berikan.",
    borderImg: "",
    showArabTop: true,
    arabTop: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nيَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ",
    contentOffsetX: 0, contentOffsetY: 0, contentScale: 100,
    fontPreset: "klasik", fontPresetArab: "amiri"
  }
};
const IJAZAH_LETTER_GRADES = [{min:85,label:'A'},{min:75,label:'B'},{min:65,label:'C'},{min:55,label:'D'},{min:45,label:'E'},{min:0,label:'F'}];
function nilaiHuruf(v){
  for(const g of IJAZAH_LETTER_GRADES){ if(Number(v)>=g.min) return g.label; }
}
const IJZ_ANGKA_SATUAN = ['Nol','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan'];
const IJZ_ANGKA_BELASAN = ['Sepuluh','Sebelas','Dua Belas','Tiga Belas','Empat Belas','Lima Belas','Enam Belas','Tujuh Belas','Delapan Belas','Sembilan Belas'];
const IJZ_ANGKA_PULUHAN = ['','','Dua Puluh','Tiga Puluh','Empat Puluh','Lima Puluh','Enam Puluh','Tujuh Puluh','Delapan Puluh','Sembilan Puluh'];
// Mengubah angka nilai (bilangan bulat, umumnya 0-9 sesuai skala raport) menjadi kata bilangan Bahasa Indonesia.
// Misal: 6 -> "Enam". Mendukung juga 10-99 untuk berjaga-jaga jika skala nilai berubah.
function angkaKeKata(v){
  let n = Math.round(Number(v)||0);
  if(n<0) n = 0;
  if(n<=9) return IJZ_ANGKA_SATUAN[n];
  if(n<20) return IJZ_ANGKA_BELASAN[n-10];
  if(n<100){
    const puluh = Math.floor(n/10), sisa = n%10;
    return (IJZ_ANGKA_PULUHAN[puluh] + (sisa ? ' ' + IJZ_ANGKA_SATUAN[sisa] : '')).trim();
  }
  return String(n);
  return 'F';
}
function tingkatanKey(tingkatan){
  const t = (tingkatan||'').toLowerCase();
  if(t==='tpq') return 'tpq';
  if(t==='ibtidaiyah') return 'ibtidaiyah';
  if(t==='tsanawiyah') return 'tsanawiyah';
  return null;
}

/* ---- Urutan tingkatan & kelas (TPQ -> Ibtidaiyah -> Tsanawiyah -> Aliyah, kelas 1 -> kelas terakhir) ---- */
const TINGKATAN_ORDER = ['TPQ','Ibtidaiyah','Tsanawiyah','Aliyah'];
function tingkatanOrderIndex(t){
  const i = TINGKATAN_ORDER.indexOf(t||'');
  return i===-1 ? TINGKATAN_ORDER.length : i;
}
function kelasNumOrder(k){
  const m = String(k.kelasNama||'').match(/\d+/);
  return m ? parseInt(m[0],10) : 999;
}
function sortKelasEntries(entries){
  return entries.slice().sort((a,b)=>{
    const ka=a[1]||{}, kb=b[1]||{};
    const ti = tingkatanOrderIndex(ka.tingkatan) - tingkatanOrderIndex(kb.tingkatan);
    if(ti!==0) return ti;
    const ni = kelasNumOrder(ka) - kelasNumOrder(kb);
    if(ni!==0) return ni;
    return String(ka.kelasNama||'').localeCompare(String(kb.kelasNama||''));
  });
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>t.classList.remove('show'), 2200);
}

