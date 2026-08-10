/* ===================== Absensi ===================== */
let pendingAbsensi = {}; // studentId -> 'H'|'S'|'I'|'A' untuk tanggal yang sedang dilihat

function todayISO(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

(function initAbsTanggal(){
  const el = document.getElementById('absTanggal');
  if(!el.value) el.value = todayISO();
  const tplMinggu = document.getElementById('absTplMingguDari');
  if(tplMinggu && !tplMinggu.value) tplMinggu.value = todayISO();
  const tplBulan = document.getElementById('absTplBulan');
  if(tplBulan && !tplBulan.value) tplBulan.value = todayISO().slice(0,7);
})();

function loadPendingFromDate(){
  const tgl = document.getElementById('absTanggal').value || todayISO();
  const existing = state.absensi[tgl] || {};
  pendingAbsensi = {};
  orderedStudents().forEach(st=>{ pendingAbsensi[st.id] = existing[st.id] || 'H'; });
}

function renderAbsensiTable(){
  const tbody = document.querySelector('#absensiTable tbody');
  const list = orderedStudents();
  document.getElementById('absensiEmpty').style.display = list.length ? 'none' : '';
  if(!Object.keys(pendingAbsensi).length || list.some(st=>!(st.id in pendingAbsensi))) loadPendingFromDate();
  tbody.innerHTML = '';
  const labels = {H:'Hadir', S:'Sakit', I:'Izin', A:'Alpa'};
  list.forEach(st=>{
    const cur = pendingAbsensi[st.id] || 'H';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${st.no}</td><td class="name">${escapeHtml(st.nama)}</td><td>
      <div class="statuspick" data-id="${st.id}">
        ${['H','S','I','A'].map(s=>`<button type="button" data-st="${s}" class="${s===cur?'on':''}">${labels[s]}</button>`).join('')}
      </div></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.statuspick').forEach(wrap=>{
    wrap.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        pendingAbsensi[wrap.dataset.id] = btn.dataset.st;
        wrap.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===btn));
      });
    });
  });
  renderRiwayatAbsensi();
}

function renderRiwayatAbsensi(){
  const tbody = document.querySelector('#riwayatAbsensiTable tbody');
  const emptyEl = document.getElementById('riwayatAbsensiEmpty');
  if(!tbody) return;
  const dates = Object.keys(state.absensi || {}).sort().reverse();
  emptyEl.style.display = dates.length ? 'none' : '';
  tbody.innerHTML = dates.map(tgl=>{
    const byStudent = state.absensi[tgl] || {};
    const t = {H:0,S:0,I:0,A:0};
    Object.values(byStudent).forEach(s=>{ if(t[s]!==undefined) t[s]++; });
    return `<tr><td class="name">${escapeHtml(tgl)}</td><td class="num badgeH">${t.H}</td><td class="num badgeS">${t.S}</td><td class="num badgeI">${t.I}</td><td class="num badgeA">${t.A}</td>
      <td class="noprint">
        <button class="secondary" data-edit="${escapeHtml(tgl)}" type="button">${icon('pencil')}Edit</button>
        <button class="secondary" data-del="${escapeHtml(tgl)}" type="button">${icon('trash')}Hapus</button>
      </td></tr>`;
  }).join('');
  tbody.querySelectorAll('button[data-edit]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const tgl = b.dataset.edit;
      document.getElementById('absTanggal').value = tgl;
      loadPendingFromDate();
      renderAbsensiTable();
      toast('Absensi tanggal ' + tgl + ' dimuat untuk diedit — ubah status lalu klik "Simpan Absensi Tanggal Ini"');
    });
  });
  tbody.querySelectorAll('button[data-del]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const tgl = b.dataset.del;
      if(!confirm('Hapus semua data absensi tanggal ' + tgl + '?')) return;
      dataRoot('absensi/'+tgl).remove().then(()=> toast('Absensi tanggal ' + tgl + ' dihapus'));
    });
  });
}

document.getElementById('absTanggal').addEventListener('change', ()=>{
  loadPendingFromDate();
  renderAbsensiTable();
});

document.getElementById('btnMarkAllHadir').addEventListener('click', ()=>{
  orderedStudents().forEach(st=> pendingAbsensi[st.id] = 'H');
  renderAbsensiTable();
});

document.getElementById('btnSaveAbsensi').addEventListener('click', ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const tgl = document.getElementById('absTanggal').value || todayISO();
  dataRoot('absensi/'+tgl).set(pendingAbsensi).then(()=> toast('Absensi tanggal ' + tgl + ' disimpan'));
});

document.getElementById('btnHitungRekapAbsensi').addEventListener('click', ()=>{
  const dari = document.getElementById('rekapAbsDari').value;
  const sampai = document.getElementById('rekapAbsSampai').value;
  const tbody = document.querySelector('#rekapAbsensiTable tbody');
  const emptyEl = document.getElementById('rekapAbsensiEmpty');
  if(!dari || !sampai){ toast('Isi rentang tanggal dulu'); return; }

  const tally = {}; // studentId -> {H,S,I,A}
  orderedStudents().forEach(st=> tally[st.id] = {H:0,S:0,I:0,A:0});
  Object.entries(state.absensi).forEach(([tgl, byStudent])=>{
    if(tgl < dari || tgl > sampai) return;
    Object.entries(byStudent).forEach(([sid, st])=>{
      if(tally[sid]) tally[sid][st] = (tally[sid][st]||0) + 1;
    });
  });

  const list = orderedStudents();
  tbody.innerHTML = list.map(st=>{
    const t = tally[st.id] || {H:0,S:0,I:0,A:0};
    return `<tr><td>${st.no}</td><td class="name">${escapeHtml(st.nama)}</td>
      <td class="num badgeH">${t.H}</td><td class="num badgeS">${t.S}</td><td class="num badgeI">${t.I}</td><td class="num badgeA">${t.A}</td>
      <td class="noprint"><button class="secondary" data-id="${st.id}" type="button">Isi ke Nilai</button></td></tr>`;
  }).join('');
  emptyEl.style.display = list.length ? 'none' : '';

  tbody.querySelectorAll('button[data-id]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const t = tally[b.dataset.id] || {S:0,I:0,A:0};
      setTab('input');
      document.getElementById('pickStudent').value = b.dataset.id;
      renderInputForm();
      document.getElementById('absSakit').value = t.S;
      document.getElementById('absIjin').value = t.I;
      document.getElementById('absAlpa').value = t.A;
      updateLiveCalc();
      toast('Tersalin — jangan lupa klik Simpan Nilai');
    });
  });
});

