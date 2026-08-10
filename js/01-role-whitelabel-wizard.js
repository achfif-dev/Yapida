/* ===================== Role & Multi-User (tertanam) =====================
   SUPER_ADMIN_EMAIL tertanam di kode: akun ini SELALU dipaksa jadi 'superadmin'
   dan tidak bisa diturunkan oleh siapa pun lewat aplikasi ini (juga dikunci di
   Firebase Security Rules — lihat dokumen rules terpisah). Akun Google baru
   yang login otomatis dibuatkan profil dengan role 'viewer' (tidak bisa baca/tulis
   data apa pun) sampai ditetapkan oleh Admin/Super Admin sebagai Staf atau Guru. */
const SUPER_ADMIN_EMAIL = (APP_CONFIG.superAdminEmail || DEFAULT_APP_CONFIG.superAdminEmail || '').trim();
const ROLE_LABELS = { superadmin:'Super Admin', admin:'Admin', staf:'Staf', guru:'Guru', viewer:'Viewer (belum disetujui)' };
let currentUserProfile = null; // {uid,email,displayName,role,assignedKelas}
let usersRef = null;
let ownProfileRef = null;
let allUsers = {};
let presenceRef = null;      // ref presence/{uid} milik akun sendiri
let presenceListRef = null;  // ref presence (semua akun) untuk didengarkan
let connectedInfoRef = null; // ref .info/connected
let allPresence = {};        // {uid: {email, displayName, lastActive}} — akun yang sedang online

function myRole(){ return currentUserProfile ? currentUserProfile.role : null; }
function isSuperAdmin(){ return myRole()==='superadmin'; }
function isAdmin(){ return myRole()==='admin' || isSuperAdmin(); }
function isStaf(){ return myRole()==='staf'; }
function isGuru(){ return myRole()==='guru'; }
function canManageUsers(){ return isAdmin(); }
// Staf & Admin/Super Admin: akses penuh SEMUA kelas. Guru: hanya kelas yang ditugaskan padanya.
function canEditStrukturKelas(){ return isStaf() || isAdmin(); } // buat/hapus kelas baru, backup-restore, dst
function canAccessKelas(kelasId){
  if(!kelasId) return false;
  if(isStaf() || isAdmin()) return true;
  if(isGuru()) return !!(currentUserProfile.assignedKelas && currentUserProfile.assignedKelas[kelasId]);
  return false;
}

/* ===================== White Label: terapkan branding ke seluruh halaman ===================== */
function applyBranding(){
  const b = APP_CONFIG.brand || {};
  const logo = getBrandLogo(APP_CONFIG);
  document.title = b.appTitle || DEFAULT_APP_CONFIG.brand.appTitle;
  ['headerLogo','loginLogo','rekapLogo','viewerWaitLogo'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.src = logo;
  });
  // Kalau Admin sudah mengisi logo kustom lewat Setup Wizard, timpa semua ikon
  // (favicon berbagai ukuran + apple-touch-icon) supaya konsisten di semua tempat.
  // Kalau belum (masih logo bawaan), biarkan ikon statis di /icons yang sudah
  // dioptimalkan per-ukuran tetap dipakai (lebih tajam daripada 1 file di-resize browser).
  const hasCustomLogo = !!(b.logoDataUrl);
  if(hasCustomLogo){
    ['dynFavicon','dynFavicon16','dynFavicon32','dynFavicon192','dynFavicon512','dynAppleTouchIcon'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.href = logo;
    });
  }
  const schoolLineEl = document.getElementById('schoolLine');
  if(schoolLineEl) schoolLineEl.textContent = (b.shortName || DEFAULT_APP_CONFIG.brand.shortName) + ' — realtime';
  const loginSchoolEl = document.getElementById('loginSchoolName');
  if(loginSchoolEl) loginSchoolEl.textContent = b.schoolName || DEFAULT_APP_CONFIG.brand.schoolName;
  const loginAddrEl = document.getElementById('loginSchoolAddr');
  if(loginAddrEl) loginAddrEl.textContent = b.address || DEFAULT_APP_CONFIG.brand.address;
  if(b.primaryColor || b.accentColor){
    const root = document.documentElement.style;
    if(b.primaryColor){ root.setProperty('--deep', b.primaryColor); root.setProperty('--deep-2', b.primaryColor); }
    if(b.accentColor){ root.setProperty('--gold', b.accentColor); }
  }
}
applyBranding();

/* ===================== Setup Wizard (White Label) ===================== */
(function(){
  const overlay = document.getElementById('setupWizardOverlay');
  let swStep = 1;
  let swBrand = {}, swFirebase = {}, swSuperAdmin = '';

  function swOpen(){
    const cfg = loadAppConfig();
    swBrand = Object.assign({}, cfg.brand);
    swFirebase = Object.assign({}, cfg.firebase);
    swSuperAdmin = cfg.superAdminEmail || '';
    swStep = 1;
    swFillStep1(); swFillStep2(); swFillStep3();
    swRender();
    overlay.style.display = 'flex';
  }
  function swClose(){ overlay.style.display = 'none'; }

  function swFillStep1(){
    document.getElementById('swSchoolName').value = swBrand.schoolName || '';
    document.getElementById('swShortName').value = swBrand.shortName || '';
    document.getElementById('swAppTitle').value = swBrand.appTitle || '';
    document.getElementById('swAddress').value = swBrand.address || '';
    document.getElementById('swPrimaryColor').value = swBrand.primaryColor || '#1e4d3a';
    document.getElementById('swAccentColor').value = swBrand.accentColor || '#b8863a';
    document.getElementById('swPrimaryColorText').value = swBrand.primaryColor || '#1e4d3a';
    document.getElementById('swAccentColorText').value = swBrand.accentColor || '#b8863a';
    document.getElementById('swLogoPreview').src = swBrand.logoDataUrl || DEFAULT_LOGO_DATA_URI;
  }
  function swFillStep2(){
    ['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId'].forEach(function(k){
      const el = document.getElementById('sw_'+k);
      if(el) el.value = '';
    });
    document.getElementById('swPasteFirebase').value = '';
    document.getElementById('swParseMsg').textContent = '';
  }
  function swFillStep3(){
    document.getElementById('swSuperAdminEmail').value = swSuperAdmin;
  }

  function swRender(){
    for(let i=1;i<=4;i++){
      const el = document.getElementById('swStep'+i);
      if(el) el.style.display = (i===swStep) ? '' : 'none';
    }
    document.getElementById('swBack').style.display = swStep>1 ? '' : 'none';
    document.getElementById('swNext').innerHTML = swStep<4 ? 'Lanjut →' : icon('save')+'Simpan &amp; Muat Ulang';
    const labels = ['Branding','Firebase','Super Admin','Ringkasan'];
    document.getElementById('swProgress').innerHTML = labels.map(function(l,i){
      const active = (i+1) <= swStep;
      return '<div style="flex:1;text-align:center;min-width:0;">'
        + '<div style="height:4px;border-radius:99px;background:'+(active?'var(--deep)':'var(--line)')+';margin-bottom:4px;"></div>'
        + '<div style="font-size:10px;font-weight:700;color:'+(active?'var(--deep)':'#8a856f')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+l+'</div></div>';
    }).join('');
    if(swStep===4) swRenderSummary();
  }

  function swRenderSummary(){
    const fbProjectId = document.getElementById('sw_projectId').value.trim();
    document.getElementById('swSummary').innerHTML =
      '<div><b>Nama Yayasan/Sekolah:</b> '+escapeHtml(document.getElementById('swSchoolName').value||'—')+'</div>'
      +'<div><b>Nama Singkat:</b> '+escapeHtml(document.getElementById('swShortName').value||'—')+'</div>'
      +'<div><b>Judul Aplikasi (tab browser):</b> '+escapeHtml(document.getElementById('swAppTitle').value||'—')+'</div>'
      +'<div><b>Firebase Project:</b> '+escapeHtml(fbProjectId||'(tidak diganti — tetap pakai yang sekarang)')+'</div>'
      +'<div><b>Super Admin:</b> '+escapeHtml(document.getElementById('swSuperAdminEmail').value||'(tidak diisi)')+'</div>';
  }

  document.getElementById('swLogoUploadBtn').addEventListener('click', function(){ document.getElementById('swLogoFile').click(); });
  document.getElementById('swLogoFile').addEventListener('change', function(e){
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    if(file.size > 900*1024){ alert('Ukuran logo terlalu besar (maks ±900 KB). Gunakan gambar yang lebih kecil/terkompresi.'); return; }
    const reader = new FileReader();
    reader.onload = function(){
      swBrand.logoDataUrl = reader.result;
      document.getElementById('swLogoPreview').src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('swLogoRemove').addEventListener('click', function(){
    swBrand.logoDataUrl = '';
    document.getElementById('swLogoPreview').src = DEFAULT_LOGO_DATA_URI;
  });
  document.getElementById('swPrimaryColor').addEventListener('input', function(e){ document.getElementById('swPrimaryColorText').value = e.target.value; });
  document.getElementById('swAccentColor').addEventListener('input', function(e){ document.getElementById('swAccentColorText').value = e.target.value; });
  document.getElementById('swPrimaryColorText').addEventListener('input', function(e){ if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) document.getElementById('swPrimaryColor').value = e.target.value; });
  document.getElementById('swAccentColorText').addEventListener('input', function(e){ if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) document.getElementById('swAccentColor').value = e.target.value; });

  function swParseFirebasePaste(text){
    const fields = ['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId','measurementId'];
    const out = {};
    fields.forEach(function(key){
      const re = new RegExp(key + '\\s*:\\s*["\']([^"\']+)["\']', 'i');
      const m = text.match(re);
      if(m) out[key] = m[1];
    });
    return out;
  }
  document.getElementById('swParseBtn').addEventListener('click', function(){
    const text = document.getElementById('swPasteFirebase').value;
    const parsed = swParseFirebasePaste(text);
    const count = Object.keys(parsed).length;
    const msg = document.getElementById('swParseMsg');
    if(count===0){ msg.textContent = 'Tidak ada field yang terdeteksi. Pastikan kode konfigurasi ditempel apa adanya dari Firebase Console.'; msg.style.color='var(--danger)'; return; }
    Object.keys(parsed).forEach(function(k){
      const el = document.getElementById('sw_'+k);
      if(el) el.value = parsed[k];
    });
    msg.textContent = count+' field berhasil terisi otomatis dari teks yang ditempel. Periksa kembali di bawah.';
    msg.style.color = 'var(--deep)';
  });

  function swReadStep1IntoState(){
    swBrand.schoolName = document.getElementById('swSchoolName').value.trim();
    swBrand.shortName = document.getElementById('swShortName').value.trim();
    swBrand.appTitle = document.getElementById('swAppTitle').value.trim();
    swBrand.address = document.getElementById('swAddress').value.trim();
    swBrand.primaryColor = document.getElementById('swPrimaryColor').value;
    swBrand.accentColor = document.getElementById('swAccentColor').value;
  }
  function swReadStep2IntoState(){
    ['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId','measurementId'].forEach(function(k){
      const el = document.getElementById('sw_'+k);
      if(el) swFirebase[k] = el.value.trim();
    });
  }
  function swReadStep3IntoState(){
    swSuperAdmin = document.getElementById('swSuperAdminEmail').value.trim();
  }

  document.getElementById('swNext').addEventListener('click', function(){
    if(swStep===1) swReadStep1IntoState();
    if(swStep===2){
      swReadStep2IntoState();
      const core = ['apiKey','databaseURL','projectId'];
      const filledCount = core.filter(function(k){ return swFirebase[k]; }).length;
      if(filledCount>0 && filledCount<core.length){
        alert('Kalau mau mengganti database Firebase, minimal isi apiKey, databaseURL, dan projectId sekaligus. Kosongkan semua field kalau tidak jadi mengganti.');
        return;
      }
    }
    if(swStep===3) swReadStep3IntoState();
    if(swStep<4){ swStep++; swRender(); return; }
    swFinish();
  });
  document.getElementById('swBack').addEventListener('click', function(){ if(swStep>1){ swStep--; swRender(); } });
  document.getElementById('swCancel').addEventListener('click', swClose);
  document.getElementById('swReset').addEventListener('click', function(){
    if(confirm('Kembalikan semua pengaturan white label ke bawaan (identitas & database Yapida)? Aplikasi akan dimuat ulang.')){
      resetAppConfig();
      location.reload();
    }
  });

  function swFinish(){
    const partial = { brand: swBrand, superAdminEmail: swSuperAdmin, setupCompleted: true };
    // Firebase HANYA diganti kalau ketiga field inti terisi — supaya tidak pernah
    // menyimpan konfigurasi Firebase yang setengah kosong / merusak koneksi yang ada.
    if(swFirebase.apiKey && swFirebase.databaseURL && swFirebase.projectId){
      partial.firebase = swFirebase;
    }
    saveAppConfig(partial);
    location.reload();
  }

  document.getElementById('btnOpenSetupWizardLogin').addEventListener('click', swOpen);
  document.getElementById('btnOpenSetupWizardAkun').addEventListener('click', swOpen);
})();

document.getElementById('btnRefreshHeader').addEventListener('click', ()=>{
  const btn = document.getElementById('btnRefreshHeader');
  btn.classList.add('spinning');
  btn.disabled = true;
  location.reload();
});

