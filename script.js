import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  user: null,
  tasks: [],
  research: [],
  schedule: [],
  chapters: [],
  unsub: [],
  selectedResearchId: null,
};

const CHAPTERS = [
  'Chapter 1 – Introduction',
  'Chapter 2 – Literature Review',
  'Chapter 3 – Methodology',
  'Chapter 4 – Findings',
  'Chapter 5 – Discussion and Recommendations',
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const path = (name) => collection(db, 'users', state.user.uid, name);
const dpath = (name, id) => doc(db, 'users', state.user.uid, name, id);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => t.hidden = true, 3500);
}
function esc(v = '') { return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function fmtDate(s) { if (!s) return 'No date'; const [y, m, d] = s.split('-'); return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function chapterLabel(ch) { return String(ch || '').replace('Chapter ', 'Ch. '); }
function normalizeChapters(chapters) {
  if (Array.isArray(chapters)) return chapters;
  if (!chapters) return [];
  return String(chapters).split(',').map(x => x.trim()).filter(Boolean);
}
function sourceCitation(source) {
  if (source.citation) return source.citation;
  const bits = [];
  if (source.authors) bits.push(source.authors);
  if (source.year) bits.push(`(${source.year}).`);
  if (source.title) bits.push(source.title);
  if (source.journal) bits.push(source.journal);
  return bits.join(' ') || 'Untitled source';
}
function sourceShortTitle(source) {
  const citation = sourceCitation(source);
  return citation.length > 110 ? citation.slice(0, 110) + '…' : citation;
}

$('#signupBtn').onclick = async () => authAction('signup');
$('#loginBtn').onclick = async () => authAction('login');
$('#logoutBtn').onclick = () => signOut(auth);

async function authAction(mode) {
  const email = $('#email').value.trim();
  const pass = $('#password').value;
  $('#authMessage').textContent = '';
  try {
    if (mode === 'signup') await createUserWithEmailAndPassword(auth, email, pass);
    else await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    $('#authMessage').textContent = e.message.replace('Firebase: ', '');
  }
}

onAuthStateChanged(auth, async (user) => {
  state.unsub.forEach(u => u());
  state.unsub = [];
  state.user = user;
  const authScreen = $('#authScreen');
  const appShell = $('#app');
  if (user) {
    authScreen.hidden = true;
    authScreen.style.display = 'none';
    appShell.hidden = false;
    appShell.style.display = 'grid';
    $('#userEmail').textContent = user.email;
    try {
      await seedChapters();
      listenAll();
    } catch (err) {
      toast(err.message);
      console.error(err);
    }
  } else {
    authScreen.hidden = false;
    authScreen.style.display = 'grid';
    appShell.hidden = true;
    appShell.style.display = 'none';
  }
});

async function seedChapters() {
  const snap = await getDocs(path('chapters'));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  CHAPTERS.forEach((title, i) => batch.set(dpath('chapters', String(i + 1)), {
    title,
    status: i === 0 ? 'In progress' : 'Not started',
    progress: i === 0 ? 10 : 0,
    currentFocus: '',
    currentWords: 0,
    wordGoal: 0,
    notes: '',
    order: i + 1,
    updatedAt: serverTimestamp(),
  }));
  await batch.commit();
}

function listenAll() {
  ['tasks', 'research', 'schedule', 'chapters'].forEach(name => {
    const unsub = onSnapshot(path(name), (snap) => {
      state[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (name === 'research' && state.research.length && !state.research.some(r => r.id === state.selectedResearchId)) {
        state.selectedResearchId = state.research[0].id;
      }
      render();
    }, (err) => toast(err.message));
    state.unsub.push(unsub);
  });
}

$$('.nav-btn').forEach(btn => btn.onclick = () => showPage(btn.dataset.page));
function showPage(page) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === page));
  const titles = {
    dashboard: ['Dashboard', 'Your dissertation command center.'],
    research: ['Research Library', 'APA citations, notes, quotes, and source thinking.'],
    chapters: ['Chapters', 'Track chapter progress and notes.'],
    tasks: ['Tasks', 'Manage action items for school and dissertation work.'],
    schedule: ['Calendar', 'See dated events, coursework, and dissertation milestones.'],
    settings: ['Settings', 'Backups and account tools.'],
  };
  $('#pageTitle').textContent = titles[page][0];
  $('#pageSub').textContent = titles[page][1];
}

$('#quickAddBtn').onclick = () => openModal('task');
$('#addTaskBtn').onclick = () => openModal('task');
$('#addResearchBtn').onclick = () => openModal('research');
$('#addScheduleBtn').onclick = () => openModal('schedule');
$('#researchSearch').oninput = renderResearch;
$('#taskSearch').oninput = renderTasks;
$('#scheduleSearch').oninput = renderSchedule;

const schemas = {
  task: { title: 'Task', collection: 'tasks', fields: [
    ['task', 'Task', 'text', 'full'],
    ['focus', 'Focus', 'select', '', ['Writing', 'Reading', 'Research', 'Editing', 'Coursework', 'Meeting', 'Email', 'Personal']],
    ['priority', 'Priority', 'select', '', ['High', 'Medium', 'Low']],
    ['status', 'Status', 'select', '', ['Not started', 'In progress', 'Waiting', 'Complete']],
    ['dueDate', 'Due date', 'date'],
    ['today', 'Show on Today', 'checkbox'],
    ['details', 'Details', 'textarea', 'full'],
  ]},
  research: { title: 'Source', collection: 'research', fields: [
    ['citation', 'APA Citation', 'textarea', 'full'],
    ['summary', 'Research Summary', 'textarea', 'full'],
    ['quotes', 'Important Quotes', 'textarea', 'full'],
    ['notes', 'My Notes', 'textarea', 'full'],
    ['use', 'How I’ll Use This Source', 'textarea', 'full'],
    ['writingIdeas', 'Writing Ideas', 'textarea', 'full'],
    ['chapters', 'Related Chapters', 'chapters', 'full'],
    ['used', 'Used in Dissertation', 'checkbox'],
    ['zoteroLink', 'Zotero Link or Key', 'text', 'full'],
    ['status', 'Status', 'select', '', ['To read', 'Reading', 'Summarized', 'Cited']],
  ]},
  schedule: { title: 'Event', collection: 'schedule', fields: [
    ['event', 'Event', 'text', 'full'],
    ['date', 'Date', 'date'],
    ['category', 'Category', 'select', '', ['Dissertation', 'Coursework', 'Personal', 'Home', 'Business', 'Family']],
    ['type', 'Type', 'select', '', ['Writing', 'Reading', 'Meeting', 'Assignment', 'Milestone', 'Deadline', 'Other']],
    ['priority', 'Priority', 'select', '', ['High', 'Medium', 'Low']],
    ['status', 'Status', 'select', '', ['Scheduled', 'In progress', 'Complete']],
    ['notes', 'Notes', 'textarea', 'full'],
  ]},
  chapter: { title: 'Chapter', collection: 'chapters', fields: [
    ['title', 'Title', 'text', 'full'],
    ['status', 'Status', 'select', '', ['Not started', 'In progress', 'Waiting', 'Complete']],
    ['progress', 'Progress %', 'number'],
    ['currentFocus', 'Current focus', 'text', 'full'],
    ['currentWords', 'Current words', 'number'],
    ['wordGoal', 'Word goal', 'number'],
    ['notes', 'Notes', 'textarea', 'full'],
  ]},
};

function openModal(type, item = {}) {
  const schema = schemas[type];
  $('#modalTitle').textContent = (item.id ? 'Edit ' : 'Add ') + schema.title;
  $('#modalFields').innerHTML = schema.fields.map(f => fieldHTML(f, item[f[0]], item)).join('');
  $('#modal').dataset.type = type;
  $('#modal').dataset.id = item.id || '';
  $('#modal').showModal();
}

function fieldHTML(f, val = '', item = {}) {
  const [key, label, type, cls, opts] = f;
  const full = cls === 'full' ? 'full' : '';
  if (type === 'select') return `<label class="${full}">${label}<select name="${key}">${opts.map(o => `<option ${o === (val || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  if (type === 'textarea') return `<label class="${full}">${label}<textarea name="${key}">${esc(val || '')}</textarea></label>`;
  if (type === 'checkbox') return `<label class="${full} check"><input type="checkbox" name="${key}" ${val ? 'checked' : ''}> ${label}</label>`;
  if (type === 'chapters') {
    const selected = normalizeChapters(val || item.chapters);
    return `<fieldset class="${full} chapter-checks"><legend>${label}</legend>${CHAPTERS.map((chapter, index) => {
      const value = `Chapter ${index + 1}`;
      return `<label><input type="checkbox" name="${key}" value="${value}" ${selected.includes(value) ? 'checked' : ''}> ${value}</label>`;
    }).join('')}</fieldset>`;
  }
  return `<label class="${full}">${label}<input name="${key}" type="${type}" value="${esc(val || '')}"></label>`;
}

$('#modalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = $('#modal').dataset.type;
  const id = $('#modal').dataset.id;
  const schema = schemas[type];
  const fd = new FormData(e.target);
  const docRef = id ? dpath(schema.collection, id) : doc(path(schema.collection));
  const data = { updatedAt: serverTimestamp() };
  try {
    for (const [key, , fieldType] of schema.fields) {
      if (fieldType === 'chapters') data[key] = fd.getAll(key);
      else if (fieldType === 'checkbox') data[key] = Boolean(fd.get(key));
      else {
        data[key] = (fd.get(key) || '').toString();
        if (fieldType === 'number') data[key] = Number(data[key] || 0);
      }
    }
    await setDoc(docRef, id ? data : { ...data, createdAt: serverTimestamp() }, { merge: true });
    if (type === 'research') state.selectedResearchId = docRef.id;
    $('#modal').close();
    toast('Saved');
  } catch (err) {
    toast(err.message);
    console.error(err);
  }
});

async function del(collectionName, id) {
  if (confirm('Delete this item?')) await deleteDoc(dpath(collectionName, id));
}
window.editItem = (type, id) => {
  const arr = state[schemas[type].collection];
  openModal(type, arr.find(x => x.id === id));
};
window.deleteItem = (col, id) => del(col, id);
window.selectSource = (id) => { state.selectedResearchId = id; renderResearch(); };

function render() {
  renderDashboard();
  renderResearch();
  renderChapters();
  renderTasks();
  renderSchedule();
}

function renderDashboard() {
  const today = todayISO();
  const twoWeeks = addDays(14);
  const todayItems = [...state.tasks.filter(t => t.today || t.dueDate === today), ...state.schedule.filter(s => s.date === today && s.status !== 'Complete')];
  const recentSources = [...state.research].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 6);
  const coming = state.schedule.filter(s => s.date > today && s.date <= twoWeeks && s.status !== 'Complete').sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 6);
  $('#todayList').innerHTML = listMini(todayItems, x => x.task || x.event, x => x.focus || x.category || x.priority || '');
  $('#recentSourcesList').innerHTML = listMini(recentSources, x => sourceShortTitle(x), x => normalizeChapters(x.chapters).map(chapterLabel).join(', '));
  $('#comingList').innerHTML = listMini(coming, x => x.event, x => `${fmtDate(x.date)} • ${x.category || ''}`);
  const chapters = state.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
  const avg = chapters.length ? Math.round(chapters.reduce((s, c) => s + Number(c.progress || 0), 0) / chapters.length) : 0;
  $('#overallProgress').textContent = avg + '%';
  $('#chapterProgress').innerHTML = chapters.map(c => progressHTML(c.title, c.progress || 0)).join('') || '<p class="empty">No chapters yet.</p>';
  $('#snapshot').innerHTML = `<div class="stat"><b>Tasks</b><span>${state.tasks.length}</span></div><div class="stat"><b>Sources</b><span>${state.research.length}</span></div><div class="stat"><b>Used Sources</b><span>${state.research.filter(r => r.used).length}</span></div><div class="stat"><b>Upcoming</b><span>${coming.length}</span></div>`;
}

function listMini(arr, title, sub) {
  return arr.length ? arr.slice(0, 6).map(x => `<div class="mini-item"><b>${esc(title(x))}</b><small>${esc(sub(x) || '')}</small></div>`).join('') : '<p class="empty">Nothing here yet.</p>';
}
function progressHTML(title, p) {
  return `<div class="progress-row"><div class="progress-label"><span>${esc(title)}</span><span>${Number(p) || 0}%</span></div><div class="bar"><span style="width:${Math.max(0, Math.min(100, Number(p) || 0))}%"></span></div></div>`;
}

function renderResearch() {
  const q = ($('#researchSearch')?.value || '').toLowerCase();
  const items = state.research
    .filter(r => JSON.stringify(r).toLowerCase().includes(q))
    .sort((a, b) => sourceCitation(a).localeCompare(sourceCitation(b)));
  if (items.length && !items.some(r => r.id === state.selectedResearchId)) state.selectedResearchId = items[0].id;
  $('#sourceCount').textContent = `${items.length} source${items.length === 1 ? '' : 's'}`;
  $('#citationList').innerHTML = items.length ? items.map(r => citationRow(r)).join('') : '<p class="empty pad">No sources yet. Click + Add Source.</p>';
  const selected = state.research.find(r => r.id === state.selectedResearchId);
  $('#sourceDetail').innerHTML = selected ? sourceDetailHTML(selected) : '<div class="source-empty"><h3>Select a citation</h3><p>Choose a source from the left, or click + Add Source to begin building your research workspace.</p></div>';
}
function citationRow(r) {
  const chapters = normalizeChapters(r.chapters).map(chapterLabel).join(', ');
  return `<button class="citation-row ${r.id === state.selectedResearchId ? 'selected' : ''}" onclick="selectSource('${r.id}')"><span>${esc(sourceShortTitle(r))}</span><small>${esc(chapters || (r.used ? 'Used in dissertation' : ''))}</small></button>`;
}
function sourceDetailHTML(r) {
  const chapters = normalizeChapters(r.chapters);
  return `<div class="detail-head"><div><p class="eyebrow">Selected Source</p><h2>${esc(sourceShortTitle(r))}</h2></div><div class="record-actions"><button class="small-btn" onclick="editItem('research','${r.id}')">Edit Source</button><button class="small-btn danger" onclick="deleteItem('research','${r.id}')">Delete</button></div></div>
  <section class="source-section"><h3>APA Citation</h3><p>${esc(sourceCitation(r))}</p></section>
  <section class="source-section"><h3>Research Summary</h3><p>${esc(r.summary || 'No summary added yet.')}</p></section>
  <section class="source-section"><h3>Important Quotes</h3><p>${esc(r.quotes || 'No quotes added yet.')}</p></section>
  <section class="source-section"><h3>My Notes</h3><p>${esc(r.notes || 'No notes added yet.')}</p></section>
  <section class="source-section"><h3>How I’ll Use This Source</h3><p>${esc(r.use || 'Not decided yet.')}</p></section>
  <section class="source-section"><h3>Writing Ideas</h3><p>${esc(r.writingIdeas || 'No writing ideas added yet.')}</p></section>
  <section class="source-section"><h3>Chapters</h3><div class="meta">${chapters.length ? chapters.map(c => `<span class="chip">${esc(c)}</span>`).join('') : '<span class="muted">No chapters selected.</span>'}${r.used ? '<span class="chip">Used in Dissertation</span>' : ''}</div></section>
  ${r.zoteroLink ? `<section class="source-section"><h3>Zotero</h3><p>${esc(r.zoteroLink)}</p></section>` : ''}`;
}

function renderChapters() {
  const chapters = state.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
  $('#chaptersGrid').innerHTML = chapters.map(c => {
    const chapterNum = `Chapter ${c.order || ''}`.trim();
    const sources = state.research.filter(r => normalizeChapters(r.chapters).includes(chapterNum));
    return `<article class="chapter-card"><h3>${esc(c.title)}</h3><div class="meta"><span class="chip">${esc(c.status || '')}</span><span class="chip">${c.progress || 0}%</span><span class="chip">${sources.length} source${sources.length === 1 ? '' : 's'}</span></div>${progressHTML('Progress', c.progress || 0)}<p><b>Focus:</b> ${esc(c.currentFocus || 'Not set')}</p><p><b>Words:</b> ${c.currentWords || 0} / ${c.wordGoal || 0}</p><p>${esc(c.notes || '')}</p><div class="record-actions"><button class="small-btn" onclick="editItem('chapter','${c.id}')">Edit</button></div></article>`;
  }).join('');
}

function renderTasks() {
  const q = ($('#taskSearch')?.value || '').toLowerCase();
  const items = state.tasks.filter(t => JSON.stringify(t).toLowerCase().includes(q)).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  $('#taskGrid').innerHTML = items.map(t => `<article class="record-card"><h3>${esc(t.task || 'Untitled task')}</h3><div class="meta"><span class="chip">${esc(t.status || '')}</span><span class="chip">${esc(t.priority || '')}</span><span class="chip">${esc(t.focus || '')}</span>${t.today ? '<span class="chip">Today</span>' : ''}</div><p><b>Due:</b> ${fmtDate(t.dueDate)}</p><p>${esc(t.details || '')}</p><div class="record-actions"><button class="small-btn" onclick="editItem('task','${t.id}')">Edit</button><button class="small-btn danger" onclick="deleteItem('tasks','${t.id}')">Delete</button></div></article>`).join('') || '<p class="empty">No tasks yet.</p>';
}
function renderSchedule() {
  const q = ($('#scheduleSearch')?.value || '').toLowerCase();
  const items = state.schedule.filter(s => JSON.stringify(s).toLowerCase().includes(q)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  $('#scheduleGrid').innerHTML = items.map(s => `<article class="timeline-item"><div class="date-badge">${fmtDate(s.date)}</div><div><h3>${esc(s.event || 'Untitled event')}</h3><div class="meta"><span class="chip">${esc(s.category || '')}</span><span class="chip">${esc(s.type || '')}</span><span class="chip">${esc(s.status || '')}</span></div><p>${esc(s.notes || '')}</p><div class="record-actions"><button class="small-btn" onclick="editItem('schedule','${s.id}')">Edit</button><button class="small-btn danger" onclick="deleteItem('schedule','${s.id}')">Delete</button></div></div></article>`).join('') || '<p class="empty">No scheduled items yet.</p>';
}

$('#exportBtn').onclick = () => {
  const data = JSON.stringify({ tasks: state.tasks, research: state.research, schedule: state.schedule, chapters: state.chapters }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-dissertation-dashboard-backup.json';
  a.click();
};
$('#importFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  if (!confirm('Import backup? This will add/overwrite items with matching IDs.')) return;
  for (const col of ['tasks', 'research', 'schedule', 'chapters']) {
    for (const item of data[col] || []) {
      const { id, ...rest } = item;
      await setDoc(id ? dpath(col, id) : doc(path(col)), rest, { merge: true });
    }
  }
  toast('Import complete');
};
