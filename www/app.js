const STORAGE_KEY = 'orgu-sayaci:v1';

const $ = (sel) => document.querySelector(sel);

// Android uygulaması olarak mı çalışıyoruz? (Capacitor) Öyleyse telefonun kendi özelliklerini kullan
const isNative = !!window.Capacitor?.isNativePlatform?.();
const native = window.Capacitor?.Plugins ?? {};

let state = loadState();
let currentId = null;
let editingId = null;
let wakeLock = null;

// --- Kayıt (veriler sadece bu cihazda saklanır)

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.projects)) return data;
  } catch {}
  return { projects: [] };
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function current() {
  return state.projects.find((p) => p.id === currentId);
}

function touch(p) {
  p.updatedAt = Date.now();
  saveState();
}

// --- Yardımcılar

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toPosInt(value) {
  const n = parseInt(value, 10);
  return n > 0 ? n : null;
}

function vibrate(strong) {
  try {
    if (isNative) {
      if (strong) native.Haptics?.vibrate({ duration: 300 });
      else native.Haptics?.impact({ style: 'LIGHT' });
    } else {
      navigator.vibrate?.(strong ? [80, 60, 80] : 15);
    }
  } catch {}
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function timeAgo(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

// --- Ekranlar

function route() {
  const match = location.hash.match(/^#\/proje\/(\w+)$/);
  currentId = match && state.projects.some((p) => p.id === match[1]) ? match[1] : null;
  $('#list-view').hidden = !!currentId;
  $('#counter-view').hidden = !currentId;
  if (currentId) {
    renderCounter();
    requestWakeLock();
  } else {
    renderList();
    releaseWakeLock();
  }
  window.scrollTo(0, 0);
}

function renderList() {
  const projects = [...state.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  $('#empty-state').hidden = projects.length > 0;
  $('#project-list').innerHTML = projects.map((p) => {
    const pct = p.target ? Math.min(100, Math.round((p.rows / p.target) * 100)) : null;
    return `<li><a class="project-card" href="#/proje/${p.id}">
      <span class="project-name">${escapeHtml(p.name)}</span>
      <span class="project-meta">Sıra ${p.rows}${p.target ? ` / ${p.target}` : ''} · ${timeAgo(p.updatedAt)}</span>
      ${pct !== null ? `<span class="progress"><span style="width:${pct}%"></span></span>` : ''}
    </a></li>`;
  }).join('');
}

function bannerFor(p) {
  if (p.target && p.rows === p.target) return '🎉 Tebrikler, hedefe ulaştın!';
  if (p.remindEvery && p.rows > 0 && p.rows % p.remindEvery === 0) {
    return '🔔 ' + (p.remindText || 'Hatırlatma zamanı!');
  }
  return null;
}

function renderCounter() {
  const p = current();
  if (!p) return;

  $('#project-title').textContent = p.name;
  $('#row-count').textContent = p.rows;
  $('#stitch-count').textContent = p.stitches;
  if (document.activeElement !== $('#notes')) $('#notes').value = p.notes;

  const info = [];
  if (p.target) info.push(`Hedef: ${p.target} sıra`);
  if (p.remindEvery) info.push(`Sonraki hatırlatma: ${p.remindEvery - (p.rows % p.remindEvery)} sıra sonra`);
  $('#row-info').textContent = info.join(' · ');

  $('#progress').hidden = !p.target;
  if (p.target) $('#progress-bar').style.width = Math.min(100, (p.rows / p.target) * 100) + '%';

  const banner = bannerFor(p);
  // Yer her zaman ayrılı kalır, böylece + butonu kaymaz
  $('#banner').classList.toggle('is-empty', !banner);
  $('#banner').textContent = banner || '';
}

// --- Sayaç işlemleri

function changeRows(delta) {
  const p = current();
  if (!p) return;
  p.rows = Math.max(0, p.rows + delta);
  if (delta > 0) p.stitches = 0;
  touch(p);
  renderCounter();

  // Hatırlatma veya hedef anında daha uzun titreşim
  vibrate(delta > 0 && !!bannerFor(p));
  const count = $('#row-count');
  count.classList.remove('pop');
  void count.offsetWidth;
  count.classList.add('pop');
}

function changeStitches(delta) {
  const p = current();
  if (!p) return;
  p.stitches = Math.max(0, p.stitches + delta);
  touch(p);
  renderCounter();
  vibrate(false);
}

$('#row-plus').addEventListener('click', () => changeRows(1));
$('#row-minus').addEventListener('click', () => changeRows(-1));
$('#stitch-plus').addEventListener('click', () => changeStitches(1));
$('#stitch-minus').addEventListener('click', () => changeStitches(-1));

$('#row-reset').addEventListener('click', () => {
  const p = current();
  if (!p || !confirm('Sıra ve ilmek sayacı sıfırlansın mı?')) return;
  p.rows = 0;
  p.stitches = 0;
  touch(p);
  renderCounter();
});

$('#notes').addEventListener('input', (e) => {
  const p = current();
  if (!p) return;
  p.notes = e.target.value;
  touch(p);
});

// Bilgisayarda klavyeyle sayma: Boşluk / ↑ ekler, ↓ geri alır
document.addEventListener('keydown', (e) => {
  if (!currentId || e.target.closest('input, textarea, button, dialog')) return;
  if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); changeRows(1); }
  if (e.key === 'ArrowDown') { e.preventDefault(); changeRows(-1); }
});

// --- Proje ekle / düzenle

const dialog = $('#project-dialog');

function openDialog(p) {
  editingId = p ? p.id : null;
  $('#dialog-title').textContent = p ? 'Projeyi düzenle' : 'Yeni proje';
  $('#delete-project').hidden = !p;
  $('#f-name').value = p ? p.name : '';
  $('#f-target').value = p?.target ?? '';
  $('#f-every').value = p?.remindEvery ?? '';
  $('#f-text').value = p?.remindText ?? '';
  dialog.showModal();
  $('#f-name').focus();
}

$('#new-project').addEventListener('click', () => openDialog(null));
$('#edit-project').addEventListener('click', () => openDialog(current()));
$('#cancel-dialog').addEventListener('click', () => dialog.close());

$('#project-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fields = {
    name: $('#f-name').value.trim(),
    target: toPosInt($('#f-target').value),
    remindEvery: toPosInt($('#f-every').value),
    remindText: $('#f-text').value.trim(),
  };
  if (!fields.name) return;

  if (editingId) {
    const p = state.projects.find((x) => x.id === editingId);
    Object.assign(p, fields);
    touch(p);
    dialog.close();
    renderCounter();
  } else {
    const now = Date.now();
    const p = { id: newId(), ...fields, rows: 0, stitches: 0, notes: '', createdAt: now, updatedAt: now };
    state.projects.push(p);
    saveState();
    dialog.close();
    location.hash = `#/proje/${p.id}`;
  }
});

$('#delete-project').addEventListener('click', () => {
  const p = state.projects.find((x) => x.id === editingId);
  if (!p || !confirm(`"${p.name}" silinsin mi? Bu işlem geri alınamaz.`)) return;
  state.projects = state.projects.filter((x) => x.id !== p.id);
  saveState();
  dialog.close();
  location.hash = '';
});

// --- Örgü örerken ekran kararmasın

async function requestWakeLock() {
  try {
    if (isNative) {
      await native.KeepAwake?.keepAwake();
    } else if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}

function releaseWakeLock() {
  if (isNative) native.KeepAwake?.allowSleep()?.catch(() => {});
  wakeLock?.release();
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentId) requestWakeLock();
});

// --- Başlat

// Android uygulamasında dosyalar zaten telefonda, internetsiz çalışma için service worker gerekmez
if (!isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.addEventListener('hashchange', route);
route();
