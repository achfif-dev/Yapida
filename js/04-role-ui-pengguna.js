/* ===================== Kontrol tampilan berdasarkan Role ===================== */
function applyRoleUI(){
  if(!currentUserProfile) return;
  const canManage = canManageUsers();
  const canStruktur = canEditStrukturKelas();
  const canAdminExtra = isStaf() || isAdmin(); // Staf, Admin, Super Admin — fitur "Surat Menyurat" & "Database Siswa Keseluruhan"
  document.getElementById('tabBtnPengguna').style.display = canManage ? '' : 'none';
  document.getElementById('tabBtnSurat').style.display = canAdminExtra ? '' : 'none';
  const cardDatabaseSiswaGlobal = document.getElementById('cardDatabaseSiswaGlobal');
  if(cardDatabaseSiswaGlobal) cardDatabaseSiswaGlobal.style.display = canAdminExtra ? '' : 'none';
  const cardBuatKelas = document.getElementById('cardBuatKelas');
  if(cardBuatKelas) cardBuatKelas.style.display = canStruktur ? '' : 'none';
  const cardBackupRestore = document.getElementById('cardBackupRestore');
  if(cardBackupRestore) cardBackupRestore.style.display = isAdmin() ? '' : 'none';
  const cardWhiteLabelSetup = document.getElementById('cardWhiteLabelSetup');
  if(cardWhiteLabelSetup) cardWhiteLabelSetup.style.display = isAdmin() ? '' : 'none';
  renderKonversiRaportTable(); // re-render supaya mode edit/read-only ikut role yang baru diketahui
  if(canManage) attachUsersListener(); else detachUsersListener();
  if(canAdminExtra){ attachSuratListener(); renderDatabaseSiswaGlobal(); renderSuratTable(); }
  else {
    detachSuratListener();
    // Kalau role dicabut sewaktu sedang membuka tab "Surat Menyurat", jangan macet di tab itu.
    const activeTabEl = document.querySelector('.tab.active');
    if(activeTabEl && activeTabEl.dataset.tab==='surat'){ setTab('kelas'); runTabSideEffects('kelas'); }
  }
  populateKelasSwitcher();
  renderKelasTable();
}

/* ===================== Kelola Pengguna (khusus Admin & Super Admin) ===================== */
function detachUsersListener(){
  if(usersRef){ usersRef.off(); usersRef = null; }
  allUsers = {};
}
function attachUsersListener(){
  if(usersRef) return;
  usersRef = firebase.database().ref('users');
  usersRef.on('value', snap=>{
    allUsers = snap.val() || {};
    renderPenggunaTable();
  });
}
function renderPenggunaTable(){
  if(!canManageUsers()) return;
  const tbody = document.querySelector('#penggunaTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const entries = Object.entries(allUsers).sort((a,b)=> (a[1].email||'').localeCompare(b[1].email||''));
  document.getElementById('penggunaEmpty').style.display = entries.length ? 'none' : '';
  const kelasEntries = sortKelasEntries(Object.entries(state.kelasList||{}));
  entries.forEach(([uid, u])=>{
    const isSuper = u.role === 'superadmin';
    const tr = document.createElement('tr');
    const isOnline = !!allPresence[uid];
    const statusDot = isOnline ? '<span class="pill active" style="margin-left:6px;" title="Sedang aktif sekarang">● Aktif</span>' : '';
    const namaLabel = escapeHtml(u.displayName||u.email||uid);
    const emailLabel = escapeHtml(u.email||'');
    if(isSuper){
      tr.innerHTML = `
        <td class="name">${namaLabel}${statusDot}<div class="hint">${emailLabel}</div></td>
        <td><span class="pill active">Super Admin</span></td>
        <td class="hint">Semua kelas</td>
        <td class="noprint hint">Tidak dapat diubah</td>`;
      tbody.appendChild(tr);
      return;
    }
    const roleSelId = 'roleSel_'+uid;
    const roleOpts = ['viewer','guru','staf','admin'].map(r=>
      `<option value="${r}" ${u.role===r?'selected':''}>${ROLE_LABELS[r]}</option>`).join('');
    let kelasBoxes = '<span class="hint">— (bukan Guru)</span>';
    if(u.role === 'guru'){
      kelasBoxes = `<div class="grid17" id="kelasBox_${uid}" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));">` +
        kelasEntries.map(([kid,k])=>{
          const checked = (u.assignedKelas && u.assignedKelas[kid]) ? 'checked' : '';
          const label = `${k.tingkatan||''} ${k.kelasNama||''}`;
          return `<label style="font-size:11.5px; font-weight:500; display:flex; gap:4px; align-items:center;">
            <input type="checkbox" style="width:auto;" data-kelas-check="${uid}" value="${kid}" ${checked}> ${escapeHtml(label)}</label>`;
        }).join('') + '</div>';
      if(!kelasEntries.length) kelasBoxes = '<span class="hint">Belum ada kelas dibuat</span>';
    }
    const isSelf = uid === (currentUserProfile && currentUserProfile.uid);
    const hapusBtn = isSelf
      ? `<button class="secondary" type="button" disabled title="Tidak bisa menghapus akun sendiri">Hapus</button>`
      : `<button class="danger" data-act="hapusUser" data-uid="${uid}" data-nama="${namaLabel.replace(/"/g,'&quot;')}" type="button">Hapus</button>`;
    tr.innerHTML = `
      <td class="name">${namaLabel}${statusDot}<div class="hint">${emailLabel}</div></td>
      <td><select id="${roleSelId}" data-uid="${uid}" class="roleSelInput">${roleOpts}</select></td>
      <td style="text-align:left;">${kelasBoxes}</td>
      <td class="noprint"><div class="btnrow" style="margin-top:0;"><button class="secondary" data-act="simpanRole" data-uid="${uid}" type="button">Simpan</button>${hapusBtn}</div></td>`;
    tbody.appendChild(tr);
  });

  // Tampilkan/sembunyikan kotak kelas saat role diganti ke/dari 'guru' (sebelum disimpan)
  tbody.querySelectorAll('select.roleSelInput').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const uid = sel.dataset.uid;
      const u = allUsers[uid] || {};
      renderPenggunaTable(); // sederhana: render ulang; role sementara belum tersimpan jadi kotak kelas ikut role di DB
      const selAfter = document.getElementById('roleSel_'+uid);
      if(selAfter) selAfter.value = sel.value;
      const td = selAfter ? selAfter.closest('tr').children[2] : null;
      if(td && sel.value === 'guru'){
        const kEntries = sortKelasEntries(Object.entries(state.kelasList||{}));
        td.innerHTML = kEntries.length ? `<div class="grid17" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));">` +
          kEntries.map(([kid,k])=>{
            const checked = (u.assignedKelas && u.assignedKelas[kid]) ? 'checked' : '';
            return `<label style="font-size:11.5px; font-weight:500; display:flex; gap:4px; align-items:center;">
              <input type="checkbox" style="width:auto;" data-kelas-check="${uid}" value="${kid}" ${checked}> ${escapeHtml((k.tingkatan||'')+' '+(k.kelasNama||''))}</label>`;
          }).join('') + '</div>' : '<span class="hint">Belum ada kelas dibuat</span>';
      } else if(td){
        td.innerHTML = '<span class="hint">— (bukan Guru)</span>';
      }
    });
  });

  tbody.querySelectorAll('button[data-act="simpanRole"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const uid = btn.dataset.uid;
      const sel = document.getElementById('roleSel_'+uid);
      const newRole = sel.value;
      const assignedKelas = {};
      if(newRole === 'guru'){
        document.querySelectorAll('input[data-kelas-check="'+uid+'"]:checked').forEach(cb=>{ assignedKelas[cb.value] = true; });
      }
      try{
        await firebase.database().ref('users/'+uid).update({ role:newRole, assignedKelas });
        toast('Role pengguna diperbarui');
      }catch(e){
        console.error(e);
        toast('Gagal menyimpan role: '+(e.message||e.code||e));
      }
    });
  });

  tbody.querySelectorAll('button[data-act="hapusUser"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const uid = btn.dataset.uid;
      const nama = btn.dataset.nama || 'akun ini';
      if(!confirm(`Hapus akun "${nama}" dari daftar pengguna? Orang tsb tidak akan bisa lagi mengakses data (kembali jadi Viewer) sampai login ulang dan ditetapkan lagi oleh Admin. Tindakan ini tidak menghapus akun Google-nya, hanya profil role di aplikasi ini.`)) return;
      try{
        await firebase.database().ref('users/'+uid).remove();
        toast('Pengguna dihapus dari daftar');
      }catch(e){
        console.error(e);
        toast('Gagal menghapus pengguna: '+(e.message||e.code||e));
      }
    });
  });
}

function debounce(fn, wait){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this, args), wait);
  };
}

function initFirebase(){
  try{
    db = firebase.database();
    document.getElementById('connDot').classList.remove('off');
    document.getElementById('connText').textContent = 'Terhubung ke Firebase';
    document.getElementById('akunStatus').textContent = 'Terhubung ke Firebase Realtime Database';
    attachKelasListListener();
    attachStudentsMasterListener();
    attachIjazahTemplatesListener();
    attachKonversiRaportListener();
    // Indikator koneksi REALTIME (bukan cuma status init SDK) — supaya guru tahu kalau HP-nya
    // sedang offline dan input nilai masih tersimpan lokal, menunggu koneksi kembali sebelum
    // benar-benar tersimpan ke server.
    db.ref('.info/connected').on('value', snap=>{
      const dot = document.getElementById('connDot');
      const txt = document.getElementById('connText');
      if(snap.val() === true){
        dot.classList.remove('off');
        txt.textContent = 'Terhubung ke Firebase';
      } else {
        dot.classList.add('off');
        txt.textContent = 'Terputus — perubahan BELUM tersimpan';
      }
    });
  }catch(e){
    console.error(e);
    document.getElementById('connText').textContent = 'Gagal konek: ' + e.message;
  }
}

// Peringatan sebelum menutup/refresh tab kalau ada input nilai yang belum ditekan tombol Simpan —
// mencegah kehilangan data kalau HP disconnect/browser tertutup tanpa sengaja saat sedang input nilai.
window.addEventListener('beforeunload', (e)=>{
  if(!perSiswaDirty && !massInputDirty) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
});


