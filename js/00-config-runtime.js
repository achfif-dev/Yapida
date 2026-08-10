/* ===================== Ikon stok (pengganti emoji di teks yang dirender lewat innerHTML) =====================
   Dipakai lewat icon('nama') di dalam template string, mengembalikan <svg> outline kecil
   supaya tampilannya konsisten & rapi (bukan emoji bawaan OS yang gaya/warnanya beda-beda). */
const ICON_INNER = {
  printer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'graduation-cap': '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 10v6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M12 3 2 20h20L12 3z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
};
function icon(name, extraClass){
  const inner = ICON_INNER[name] || '';
  const cls = 'ic' + (extraClass ? ' '+extraClass : '');
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

/* ===================== White Label: konfigurasi runtime (bisa diubah lewat Setup Wizard, TANPA edit kode) =====================
   Prioritas nilai: localStorage (diisi lewat wizard) → DEFAULT_APP_CONFIG bawaan (identitas
   & Firebase Yapida) — supaya instance yang sudah berjalan sekarang TIDAK berubah sama
   sekali selama belum pernah mengisi wizard. */
const APPCFG_KEY = 'buku_nilai_app_config_v1';
const DEFAULT_APP_CONFIG = {
  brand: {
    schoolName: 'Yayasan Pendidikan Islam Al-Hidayah — Madrasah Tarbiyatul Islam Al-Hidayah',
    shortName: 'Yayasan Pendidikan Islam Al-Hidayah — Yapida',
    appTitle: 'Buku Nilai Raport — Madrasah',
    address: 'Ujung Piring, Bangkalan',
    logoDataUrl: '', // kosong = pakai logo bawaan (DEFAULT_LOGO_DATA_URI)
    primaryColor: '#1e4d3a',
    accentColor: '#b8863a'
  },
  firebase: {
    apiKey: "AIzaSyD1rHF7j3wn7SfhrojtCe6dAaE4m1SKvKw",
    authDomain: "database-yapida-app.firebaseapp.com",
    databaseURL: "https://database-yapida-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "database-yapida-app",
    storageBucket: "database-yapida-app.firebasestorage.app",
    messagingSenderId: "588371630615",
    appId: "1:588371630615:web:eb2ca47ebfc05d4e569a52",
    measurementId: "G-E2WPCPWFWP"
  },
  superAdminEmail: 'achfif@gmail.com',
  setupCompleted: true // instance bawaan ini sudah "selesai setup" sejak awal
};

function gwDeepMerge(base, override){
  const out = Object.assign({}, base);
  Object.keys(override || {}).forEach(k=>{
    const v = override[k];
    if(v && typeof v === 'object' && !Array.isArray(v)) out[k] = gwDeepMerge(base[k] || {}, v);
    else if(v !== undefined) out[k] = v;
  });
  return out;
}
function loadAppConfig(){
  try{
    const raw = localStorage.getItem(APPCFG_KEY);
    if(!raw) return DEFAULT_APP_CONFIG;
    return gwDeepMerge(DEFAULT_APP_CONFIG, JSON.parse(raw));
  }catch(e){ return DEFAULT_APP_CONFIG; }
}
function saveAppConfig(partial){
  const next = gwDeepMerge(loadAppConfig(), partial);
  try{ localStorage.setItem(APPCFG_KEY, JSON.stringify(next)); }
  catch(e){ console.warn('Gagal menyimpan konfigurasi aplikasi:', e); }
  return next;
}
function resetAppConfig(){ try{ localStorage.removeItem(APPCFG_KEY); }catch(e){} }
function isFirebaseConfigured(cfg){ cfg = cfg || loadAppConfig(); return !!(cfg.firebase && cfg.firebase.apiKey); }
function getBrandLogo(cfg){ cfg = cfg || loadAppConfig(); return (cfg.brand && cfg.brand.logoDataUrl) || DEFAULT_LOGO_DATA_URI; }

const APP_CONFIG = loadAppConfig();

/* ===================== Firebase config (dari APP_CONFIG, bukan lagi hardcode) ===================== */
const DEFAULT_LOGO_DATA_URI = "data:image/png;base64,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";
const firebaseConfig = {
  apiKey: APP_CONFIG.firebase.apiKey,
  // authDomain: untuk instance BAWAAN (project Firebase Yapida) pertahankan trik
  // "same-origin auth" apa adanya — otomatis pakai domain yang sedang diakses (BUKAN
  // hardcode ke satu domain saja), supaya proxy "/__/auth/*" (vercel.json/netlify.toml)
  // tetap berlaku di domain custom apa pun. Untuk project Firebase LAIN (hasil isian
  // Setup Wizard, dipakai sekolah/perusahaan lain), authDomain dipakai apa adanya
  // seperti yang ditempel dari Firebase Console — mereka belum tentu punya proxy tsb.
  authDomain: (function(){
    var h = window.location.hostname;
    if(APP_CONFIG.firebase.projectId === DEFAULT_APP_CONFIG.firebase.projectId){
      if(h === 'localhost' || h === '127.0.0.1') return DEFAULT_APP_CONFIG.firebase.authDomain;
      return h;
    }
    return APP_CONFIG.firebase.authDomain;
  })(),
  databaseURL: APP_CONFIG.firebase.databaseURL,
  projectId: APP_CONFIG.firebase.projectId,
  storageBucket: APP_CONFIG.firebase.storageBucket,
  messagingSenderId: APP_CONFIG.firebase.messagingSenderId,
  appId: APP_CONFIG.firebase.appId,
  measurementId: APP_CONFIG.firebase.measurementId
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

