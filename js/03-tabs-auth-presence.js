/* ===================== Tabs ===================== */
// Simpan tab terakhir yang dibuka supaya saat halaman di-refresh, tampilan tetap
// berada di tab tsb (tidak balik ke tab "Kelas") — lihat restoreLastTab().
function saveActiveTab(name){
  try{ localStorage.setItem('rapor_active_tab', name); }catch(e){}
}
function runTabSideEffects(name){
  if(name==='rekap') renderRekap();
  if(name==='input'){ renderStudentPicker(); renderTabelMassal(); }
  if(name==='absensi') renderAbsensiTable();
  if(name==='ijazah') renderIjazahTab();
  if(name==='siswa') renderDatabaseSiswaGlobal();
  if(name==='surat') renderSuratTable();
}
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    setTab(tab.dataset.tab);
    runTabSideEffects(tab.dataset.tab);
  });
});

/* ===================== Auth (Google Sign-In) ===================== */
function setTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
  ['kelas','siswa','absensi','input','rekap','ijazah','akun','surat','pengguna'].forEach(n=>{
    document.getElementById('tab-'+n).style.display = (n===name) ? '' : 'none';
  });
  saveActiveTab(name);
}
// Dipanggil sesudah login (termasuk auto-login sesudah refresh halaman) untuk
// mengembalikan tampilan ke tab terakhir yang dibuka user, bukan selalu ke tab "Kelas".
function restoreLastTab(){
  const validTabs = ['kelas','siswa','absensi','input','rekap','ijazah','akun','surat','pengguna'];

  // Bedakan "baru masuk/login" vs "refresh halaman saat sesi masih berjalan":
  // - sessionStorage bertahan saat halaman di-refresh (F5 / tombol Refresh header),
  //   tapi otomatis kosong lagi kalau tab/browser ditutup atau baru logout.
  // - Kalau flag belum ada -> ini login baru -> paksa ke tab "Kelas" dulu supaya
  //   kelas yang mau diupdate dipastikan benar sebelum ke tab lain.
  // - Kalau flag sudah ada -> ini refresh dari sesi yang sama -> kembalikan ke tab terakhir.
  let isFreshLogin = true;
  try{ isFreshLogin = sessionStorage.getItem('rapor_session_active') !== '1'; }catch(e){}

  let target = 'kelas';
  if(!isFreshLogin){
    try{
      const saved = localStorage.getItem('rapor_active_tab');
      if(saved && validTabs.includes(saved)) target = saved;
    }catch(e){}
  }
  // Tab "Pengguna" hanya untuk yang berwenang kelola akun — kalau tidak berhak, jangan
  // macet di tab ini (mis. akun Guru biasa yang terakhir kali dipakai oleh Admin).
  if(target==='pengguna' && !canManageUsers()) target = 'kelas';
  if(target==='surat' && !(isStaf()||isAdmin())) target = 'kelas';
  setTab(target);
  runTabSideEffects(target);

  try{ sessionStorage.setItem('rapor_session_active', '1'); }catch(e){}
}

document.getElementById('btnGoogleLogin').addEventListener('click', ()=>{
  const loginErr = document.getElementById('loginErr');
  loginErr.textContent = 'Membuka jendela masuk Google…';
  const provider = new firebase.auth.GoogleAuthProvider();
  // Pakai POPUP sebagai metode utama. Ini aman sekarang karena authDomain sudah
  // dibuat satu origin dengan domain app (lihat firebaseConfig di atas + rewrite
  // proxy di vercel.json/netlify.toml) — jadi popup dan halaman utama berbagi origin
  // yang sama, tidak butuh sessionStorage lintas-navigasi seperti metode redirect.
  // Redirect (signInWithRedirect) rawan gagal dengan error "auth/missing-initial-state"
  // di banyak browser Android karena sessionStorage-nya suka hilang saat berpindah
  // tab ke Google lalu balik lagi. Popup tidak punya masalah ini.
  auth.signInWithPopup(provider).catch(err=>{
    console.error(err);
    // Kalau popup diblokir/gagal dibuka (jarang, tapi ada browser yang strict),
    // fallback otomatis ke redirect supaya user tetap bisa masuk.
    if(err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user'){
      if(err.code === 'auth/popup-blocked'){
        loginErr.textContent = 'Popup diblokir browser, mengalihkan ke halaman Google…';
        auth.signInWithRedirect(provider).catch(err2=>{
          console.error(err2);
          loginErr.textContent = 'Gagal masuk: ' + (err2.message || err2.code);
        });
      } else {
        loginErr.textContent = ''; // user membatalkan sendiri, tidak perlu tampilkan error
      }
    } else {
      loginErr.textContent = 'Gagal masuk: ' + (err.message || err.code || err);
    }
  });
});

// Tangani hasil kalau ternyata fallback redirect di atas terpakai (popup diblokir).
auth.getRedirectResult().catch(err=>{
  console.error('Gagal masuk (redirect):', err);
  const loginErr = document.getElementById('loginErr');
  if(loginErr) loginErr.textContent = 'Gagal masuk: ' + (err.message || err.code || err);
});

function doLogout(){
  if(ownProfileRef) ownProfileRef.off();
  ownProfileRef = null;
  if(usersRef) usersRef.off();
  usersRef = null;
  detachPresence();
  detachPresenceListener();
  currentUserProfile = null;
  auth.signOut();
}
document.getElementById('btnLogoutAkun').addEventListener('click', doLogout);
document.getElementById('btnLogoutViewer').addEventListener('click', doLogout);

function userChip(user){
  const photo = user.photoURL ? `<img src="${user.photoURL}" referrerpolicy="no-referrer">` : '';
  const role = myRole();
  const roleTxt = role ? ` · ${escapeHtml(ROLE_LABELS[role]||role)}` : '';
  return `<span class="userchip">${photo}<span>${escapeHtml(user.displayName||user.email||'')}${roleTxt}</span><button type="button" id="btnLogoutChip">Keluar</button></span>`;
}

/* Membuat/memuat profil pengguna di users/{uid}. Akun SUPER_ADMIN_EMAIL SELALU
   dipaksa jadi 'superadmin' (self-heal); akun lain yang baru login otomatis
   dibuatkan profil dengan role 'viewer'. Keamanan sesungguhnya ada di Firebase
   Security Rules (lihat dokumen rules terpisah) — kode ini hanya mengikuti rules itu. */
async function ensureUserProfileAndLoadRole(user){
  const uid = user.uid;
  const ref = firebase.database().ref('users/'+uid);
  const snap = await ref.once('value');
  let profile = snap.val();
  const isSuper = (user.email||'').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if(!profile){
    profile = {
      email: user.email||'', displayName: user.displayName||'',
      role: isSuper ? 'superadmin' : 'viewer',
      assignedKelas: {},
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    await ref.set(profile);
  } else if(isSuper && profile.role !== 'superadmin'){
    await ref.update({role:'superadmin', email:user.email||profile.email||''});
    profile.role = 'superadmin';
  } else if(!isSuper && profile.role === 'superadmin'){
    // Jaga-jaga: hanya SUPER_ADMIN_EMAIL yang boleh punya role superadmin.
    // Firebase Rules yang benar akan MENOLAK ini juga (tidak seharusnya pernah terjadi) —
    // dibungkus try/catch supaya tidak memblokir login jika rules menolak.
    try{ await ref.update({role:'viewer'}); profile.role = 'viewer'; }catch(e){ console.warn('Gagal downgrade anomali role:', e); }
  }
  if(profile.email !== (user.email||'') || profile.displayName !== (user.displayName||'')){
    ref.update({email:user.email||'', displayName:user.displayName||''}).catch(()=>{});
  }
  currentUserProfile = Object.assign({uid}, profile, {assignedKelas: profile.assignedKelas||{}});
}

// Dengarkan perubahan role diri sendiri secara realtime (misal saat Admin baru saja
// mengangkat akun ini jadi Staf/Guru selagi aplikasi terbuka).
function attachOwnProfileListener(uid){
  if(ownProfileRef) ownProfileRef.off();
  ownProfileRef = firebase.database().ref('users/'+uid);
  ownProfileRef.on('value', snap=>{
    const v = snap.val();
    if(!v || !currentUserProfile) return;
    const wasViewer = currentUserProfile.role === 'viewer';
    currentUserProfile = Object.assign({}, currentUserProfile, v, {assignedKelas: v.assignedKelas||{}});
    renderRoleGate();
    if(!wasViewer && currentUserProfile.role === 'viewer'){
      // role dicabut selagi sedang dipakai -> paksa keluar dari data
      toast('Akses Anda telah dicabut oleh Admin');
    }
    applyRoleUI();
  });
}

function renderRoleGate(){
  const appContent = document.getElementById('appContent');
  const tabsBar = document.getElementById('tabsBar');
  const viewerWait = document.getElementById('viewerWait');
  const loginGate = document.getElementById('loginGate');
  if(!currentUserProfile){ return; }
  loginGate.style.display = 'none';
  if(currentUserProfile.role === 'viewer'){
    document.getElementById('viewerWaitEmail').textContent = currentUserProfile.email || '';
    viewerWait.style.display = '';
    appContent.style.display = 'none';
    tabsBar.style.display = 'none';
  } else {
    viewerWait.style.display = 'none';
    appContent.style.display = '';
    tabsBar.style.display = '';
  }
}

/* ===================== Presence ("siapa saja yang sedang aktif") =====================
   Menandai akun sendiri sebagai online di presence/{uid} selama tab ini terbuka & terhubung.
   Memakai .info/connected + onDisconnect() supaya otomatis terhapus begitu tab ditutup /
   koneksi putus, tanpa perlu tombol "logout" ditekan. CATATAN: path 'presence' baru ini
   perlu diizinkan (read utk akun login, write hanya ke node uid sendiri) di Firebase
   Realtime Database Rules, kalau belum ada aturannya presence tidak akan tersimpan. */
function attachPresence(user){
  if(presenceRef) return; // sudah terpasang
  presenceRef = firebase.database().ref('presence/'+user.uid);
  connectedInfoRef = firebase.database().ref('.info/connected');
  connectedInfoRef.on('value', snap=>{
    if(snap.val() !== true) return;
    presenceRef.onDisconnect().remove();
    presenceRef.set({
      email: user.email||'',
      displayName: user.displayName||'',
      lastActive: firebase.database.ServerValue.TIMESTAMP
    }).catch(e=> console.warn('Gagal menandai presence aktif:', e));
  });
}
function detachPresence(){
  if(connectedInfoRef){ connectedInfoRef.off(); connectedInfoRef = null; }
  if(presenceRef){ presenceRef.onDisconnect().cancel().catch(()=>{}); presenceRef.remove().catch(()=>{}); presenceRef = null; }
}
function attachPresenceListener(){
  if(presenceListRef) return;
  presenceListRef = firebase.database().ref('presence');
  presenceListRef.on('value', snap=>{
    allPresence = snap.val() || {};
    renderOnlineBadge();
    if(canManageUsers()) renderPenggunaTable();
  });
}
function detachPresenceListener(){
  if(presenceListRef){ presenceListRef.off(); presenceListRef = null; }
  allPresence = {};
  renderOnlineBadge();
}
function renderOnlineBadge(){
  const badge = document.getElementById('onlineBadge');
  const txt = document.getElementById('onlineCountText');
  if(!badge || !txt) return;
  const list = Object.values(allPresence);
  if(!currentUserProfile || currentUserProfile.role === 'viewer' || !list.length){
    badge.style.display = 'none';
    return;
  }
  badge.style.display = '';
  txt.textContent = list.length===1 ? '1 aktif' : `${list.length} aktif`;
  badge.title = 'Sedang aktif sekarang:\n' + list.map(p=> p.displayName || p.email || '(tanpa nama)').join('\n');
}

auth.onAuthStateChanged(async user=>{
  const loginGate = document.getElementById('loginGate');
  const appContent = document.getElementById('appContent');
  const tabsBar = document.getElementById('tabsBar');
  const viewerWait = document.getElementById('viewerWait');
  const chipWrap = document.getElementById('userChipWrap');
  const loginErr = document.getElementById('loginErr');

  if(user){
    loginErr.textContent = 'Memeriksa akses akun…';
    try{
      await ensureUserProfileAndLoadRole(user);
    }catch(e){
      console.error('Gagal memuat profil pengguna:', e);
      loginErr.textContent = `Gagal memuat profil akun "${user.email||''}": ${e.message||e.code||e}`;
      await auth.signOut();
      return;
    }
    loginErr.textContent = '';
    chipWrap.innerHTML = userChip(user);
    document.getElementById('btnLogoutChip').addEventListener('click', doLogout);
    document.getElementById('akunEmail').textContent = user.email || user.displayName || '—';
    document.getElementById('penggunaSuperAdminEmail').textContent = SUPER_ADMIN_EMAIL;
    attachOwnProfileListener(user.uid);
    renderRoleGate();
    if(currentUserProfile.role === 'viewer'){
      return; // tidak inisialisasi Firebase data / tab apa pun untuk viewer
    }
    attachPresence(user);
    attachPresenceListener();
    initFirebase();
    applyRoleUI();
    restoreLastTab();
  } else {
    loginGate.style.display = '';
    viewerWait.style.display = 'none';
    appContent.style.display = 'none';
    tabsBar.style.display = 'none';
    chipWrap.innerHTML = '';
    currentDataRefs.forEach(ref=>ref.off());
    currentDataRefs = [];
    if(studentsMasterRef) studentsMasterRef.off();
    studentsMasterRef = null;
    if(suratRef) suratRef.off();
    suratRef = null;
    state.surat = {};
    if(ownProfileRef) ownProfileRef.off();
    ownProfileRef = null;
    if(usersRef) usersRef.off();
    usersRef = null;
    detachPresence();
    detachPresenceListener();
    currentUserProfile = null;
    state.studentsMaster = {};
    db = null; activeKelasId = null;
    try{ sessionStorage.removeItem('rapor_session_active'); }catch(e){}
    document.getElementById('connDot').classList.add('off');
    document.getElementById('connText').textContent = 'Belum masuk';
  }
});

