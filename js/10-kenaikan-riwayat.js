/* ===================== Kenaikan / Pindah Kelas & Riwayat ===================== */
let pindahSelectedIds = new Set(); // studentId yang tercentang untuk dipindahkan (default: semua)
let pindahKnownIds = new Set(); // studentId yang sudah pernah dirender di checklist ini (supaya tidak "auto-centang ulang" siswa yang sengaja di-uncheck)

function populatePindahRiwayatSelects(){
  const selRiwayat = document.getElementById('riwayatSiswaPick');
  const pindahTbody = document.querySelector('#pindahSiswaTable tbody');
  if(!selRiwayat || !pindahTbody) return; // belum ter-render (mis. sebelum login)

  const list = orderedStudents();
  const curRiwayat = selRiwayat.value;
  selRiwayat.innerHTML = '';
  if(!list.length){
    selRiwayat.innerHTML = '<option value="">— belum ada siswa —</option>';
  }
  list.forEach(st=>{
    const o2 = document.createElement('option'); o2.value = st.id; o2.textContent = `${st.no}. ${st.nama}`; selRiwayat.appendChild(o2);
  });
  if(curRiwayat && list.some(s=>s.id===curRiwayat)) selRiwayat.value = curRiwayat;

  // Checklist siswa yang mau dipindahkan — default semua tercentang. Siswa yang pernah sengaja
  // di-uncheck TIDAK otomatis tercentang lagi walau tabel di-render ulang karena data lain berubah.
  const validIds = new Set(list.map(s=>s.id));
  Array.from(pindahSelectedIds).forEach(id=>{ if(!validIds.has(id)) pindahSelectedIds.delete(id); });
  Array.from(pindahKnownIds).forEach(id=>{ if(!validIds.has(id)) pindahKnownIds.delete(id); });
  list.forEach(st=>{
    if(!pindahKnownIds.has(st.id)){
      pindahKnownIds.add(st.id);
      pindahSelectedIds.add(st.id); // siswa baru dilihat pertama kali -> default tercentang
    }
  });

  document.getElementById('pindahSiswaEmpty').style.display = list.length ? 'none' : '';
  pindahTbody.innerHTML = list.map(st=>`
    <tr>
      <td><input type="checkbox" class="pindahChk" data-id="${st.id}" ${pindahSelectedIds.has(st.id)?'checked':''} style="width:auto;"></td>
      <td>${st.no}</td>
      <td class="name">${escapeHtml(st.nama)}</td>
    </tr>`).join('');
  pindahTbody.querySelectorAll('.pindahChk').forEach(chk=>{
    chk.addEventListener('change', ()=>{
      if(chk.checked) pindahSelectedIds.add(chk.dataset.id);
      else pindahSelectedIds.delete(chk.dataset.id);
    });
  });

  const selTujuan = document.getElementById('pindahKelasTujuan');
  if(selTujuan){
    const curT = selTujuan.value;
    selTujuan.innerHTML = '<option value="">— pilih kelas tujuan —</option>';
    // Sembunyikan kelas dari Tahun Ajaran yang LEBIH LAMA dari kelas aktif — kelas tahun lalu
    // sudah "lulus/selesai" dan tidak masuk akal jadi tujuan pindah/kenaikan kelas. Kelas di
    // tahun ajaran yang SAMA (mis. pindah ke kelas paralel) atau tahun ajaran BARU (kenaikan
    // kelas ke tahun depan) tetap muncul seperti biasa.
    const kelasAktif = state.kelasList[activeKelasId] || {};
    const tahunAktifNum = kelasGroupYearNum(kelasGroupKey(kelasAktif));
    const semuaLain = Object.entries(state.kelasList).filter(([id])=> id!==activeKelasId);
    const kandidat = tahunAktifNum===-1 ? semuaLain : semuaLain.filter(([,k])=> kelasGroupYearNum(kelasGroupKey(k)) >= tahunAktifNum);
    let curGroup = null, groupEl = selTujuan;
    sortKelasEntries(kandidat).forEach(([id,k])=>{
      const tLabel = k.tingkatan || 'Lainnya';
      if(tLabel !== curGroup){
        curGroup = tLabel;
        groupEl = document.createElement('optgroup');
        groupEl.label = tLabel;
        selTujuan.appendChild(groupEl);
      }
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = `${k.tingkatan||''} ${k.kelasNama||''}${kelasGroupLabel(k)!=='Tanpa Tahun Ajaran' ? (' — '+kelasGroupLabel(k)) : ''}`;
      groupEl.appendChild(opt);
    });
    if(!kandidat.length && semuaLain.length){
      selTujuan.innerHTML = '<option value="">— tidak ada kelas di tahun ajaran ini/berikutnya —</option>';
    }
    if(curT && kandidat.some(([id])=>id===curT)) selTujuan.value = curT;
  }

  renderRiwayatKelas();
}

document.getElementById('btnPindahPilihSemua').addEventListener('click', ()=>{
  orderedStudents().forEach(st=> pindahSelectedIds.add(st.id));
  document.querySelectorAll('#pindahSiswaTable .pindahChk').forEach(chk=> chk.checked = true);
});
document.getElementById('btnPindahKosongkanSemua').addEventListener('click', ()=>{
  pindahSelectedIds.clear();
  document.querySelectorAll('#pindahSiswaTable .pindahChk').forEach(chk=> chk.checked = false);
});

document.getElementById('btnPindahKelas').addEventListener('click', async ()=>{
  if(!activeKelasId){ toast('Pilih/buat kelas dulu'); return; }
  const tujuanId = document.getElementById('pindahKelasTujuan').value;
  const noMulai = Number(document.getElementById('pindahNoBaru').value || 1);
  if(!tujuanId){ toast('Pilih kelas tujuan dulu'); return; }

  // Urutkan siswa terpilih berdasarkan no urut saat ini, supaya penomoran baru tetap berurutan rapi.
  const selected = orderedStudents().filter(st=> pindahSelectedIds.has(st.id));
  if(!selected.length){ toast('Pilih minimal satu siswa untuk dipindahkan'); return; }

  const kt = state.kelasList[tujuanId] || {};
  const tujuanLabel = `${kt.tingkatan||''} ${kt.kelasNama||''}`.trim();
  const totalDiKelasIni = orderedStudents().length;
  const confirmMsg = selected.length===totalDiKelasIni
    ? `Pindahkan SEMUA (${selected.length}) siswa di kelas ini ke kelas ${tujuanLabel}? Nilai di kelas ini tetap tersimpan sebagai riwayat dan bisa dilihat lagi lewat "Riwayat Kelas & Nilai".`
    : `Pindahkan ${selected.length} dari ${totalDiKelasIni} siswa terpilih ke kelas ${tujuanLabel}? ${totalDiKelasIni-selected.length} siswa yang tidak dicentang akan TETAP di kelas ini (tinggal kelas). Nilai tetap tersimpan sebagai riwayat.`;
  if(!confirm(confirmMsg)) return;

  const btn = document.getElementById('btnPindahKelas');
  btn.disabled = true;
  let noBaru = noMulai;
  let sukses = 0, gagal = 0;
  try{
    for(const st of selected){
      try{
        // Digabung jadi SATU multi-path update per siswa (bukan 4 .set()/.remove() terpisah).
        // Sebelumnya kalau koneksi putus di tengah 4 langkah itu, siswa bisa nyangkut TERDAFTAR
        // DI 2 KELAS SEKALIGUS (sudah masuk roster kelas tujuan tapi belum terhapus dari kelas
        // asal). Dengan update atomik, satu siswa pasti "pindah utuh" atau "tidak pindah sama
        // sekali" — tidak ada kondisi setengah-jalan untuk siswa itu.
        await db.ref('rapor').update({
          ['data/'+tujuanId+'/students/'+st.id]: {no: noBaru},
          ['students/'+st.id+'/riwayatKelas/'+tujuanId]: {
            no: noBaru, tingkatan: kt.tingkatan||'', kelasNama: kt.kelasNama||'', catur: kt.catur||'', tahun: kt.tahun||'', tahunMasehi: kt.tahunMasehi||'',
            tanggal: todayISO()
          },
          ['students/'+st.id+'/kelasAktifId']: tujuanId,
          ['data/'+activeKelasId+'/students/'+st.id]: null, // keluar dari roster kelas lama; nilai & riwayat kelas lama tetap tersimpan
        });
        pindahSelectedIds.delete(st.id);
        sukses++;
        noBaru++;
      }catch(e){
        console.error('Gagal memindahkan', st.nama, e);
        gagal++;
      }
    }
    toast(gagal ? `${sukses} siswa dipindahkan, ${gagal} gagal` : `${sukses} siswa berhasil dipindahkan ke kelas baru`);
  }finally{
    btn.disabled = false;
  }
});

async function renderRiwayatKelasInto(id, box){
  if(!box) return;
  if(!id){ box.innerHTML = ''; return; }
  const m = state.studentsMaster[id];
  const riwayat = (m && m.riwayatKelas) || {};
  const entries = Object.entries(riwayat).sort((a,b)=> (a[1].tahun||'').localeCompare(b[1].tahun||''));
  if(!entries.length){ box.innerHTML = '<div class="empty">Belum ada riwayat kelas untuk siswa ini.</div>'; return; }

  // Request id disimpan DI ELEMEN box itu sendiri (bukan properti statis fungsi) supaya dua box
  // berbeda (mis. box di kartu "Riwayat Kelas & Nilai Siswa" & box di kartu "Database Siswa
  // Keseluruhan") masing-masing punya penanda "permintaan terbaru" sendiri tanpa saling menimpa.
  box._reqId = (box._reqId || 0) + 1;
  const myRequestId = box._reqId;
  box.innerHTML = '<div class="hint">Memuat riwayat nilai…</div>';
  const rowsHtml = [];
  for(const [kelasId, r] of entries){
    const [subjSnap, ...scoreSnaps] = await Promise.all([
      db.ref('rapor/data/'+kelasId+'/subjects').get(),
      ...CATUR_KEYS.map(cw=> db.ref('rapor/data/'+kelasId+'/scores/'+cw+'/'+id).get())
    ]);
    if(myRequestId !== box._reqId) return; // sudah ganti siswa/kelas, batalkan render lama
    const subjects = subjSnap.val() || [];
    const aktif = m.kelasAktifId===kelasId ? ' <span class="pill active">aktif</span>' : '';
    CATUR_KEYS.forEach((cw,i)=>{
      const sc = scoreSnaps[i].val() || {};
      if(!subjects.length && !sc.mapel) return; // tidak ada apa-apa utk catur wulan ini, jangan tampilkan baris kosong
      const nilaiTxt = subjects.length
        ? subjects.map(s=> `${escapeHtml(s)}: ${(sc.mapel && sc.mapel[s]!=null) ? sc.mapel[s] : '-'}`).join(' · ')
        : '';
      rowsHtml.push(`<tr>
        <td class="name">${escapeHtml(r.tingkatan||'')} ${escapeHtml(r.kelasNama||'')}${aktif}</td>
        <td>${CATUR_LABELS[cw]}</td>
        <td>${escapeHtml(r.tahun||'')}${r.tahunMasehi?('<br>'+escapeHtml(r.tahunMasehi)):''}</td>
        <td style="text-align:left;font-size:11.5px;">${nilaiTxt || '<span class="hint">Belum ada nilai</span>'}</td>
      </tr>`);
    });
  }
  if(myRequestId !== box._reqId) return;
  box.innerHTML = rowsHtml.length
    ? `<table><thead><tr><th style="text-align:left;">Kelas</th><th>Catur Wulan</th><th>Tahun</th><th style="text-align:left;">Nilai per Mapel</th></tr></thead><tbody>${rowsHtml.join('')}</tbody></table>`
    : '<div class="empty">Belum ada nilai tersimpan di kelas manapun untuk siswa ini.</div>';
}
async function renderRiwayatKelas(){
  const sel = document.getElementById('riwayatSiswaPick');
  const box = document.getElementById('riwayatKelasList');
  if(!sel || !box) return;
  await renderRiwayatKelasInto(sel.value, box);
}
document.getElementById('riwayatSiswaPick').addEventListener('change', renderRiwayatKelas);

