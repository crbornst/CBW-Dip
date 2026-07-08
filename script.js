import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const todayISO = () => new Date().toISOString().slice(0,10);
const addDaysISO = days => { const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const defaultData = () => ({
  chapters: [
    {id:uid(), title:'Chapter 1 – Introduction', status:'In Progress', progress:10, currentFocus:'Problem of Practice', wordGoal:6000, currentWords:0, notes:''},
    {id:uid(), title:'Chapter 2 – Literature Review', status:'Not Started', progress:0, currentFocus:'Themes and sources', wordGoal:12000, currentWords:0, notes:''},
    {id:uid(), title:'Chapter 3 – Methodology', status:'Not Started', progress:0, currentFocus:'Research design', wordGoal:8000, currentWords:0, notes:''},
    {id:uid(), title:'Chapter 4 – Findings', status:'Waiting', progress:0, currentFocus:'Data collection', wordGoal:9000, currentWords:0, notes:''},
    {id:uid(), title:'Chapter 5 – Discussion & Recommendations', status:'Waiting', progress:0, currentFocus:'Not started', wordGoal:8000, currentWords:0, notes:''}
  ],
  tasks: [],
  research: [],
  schedule: []
});

let state = defaultData();
let currentUser = null;
let saveTimer = null;
let editing = { type:null, id:null };

const schemas = {
  chapter: [
    ['title','Chapter title','text','full'], ['status','Status','select','', ['Not Started','In Progress','Waiting','Complete']], ['progress','Progress %','number'], ['currentFocus','Current focus','text'], ['wordGoal','Word goal','number'], ['currentWords','Current words','number'], ['notes','Notes','textarea','full']
  ],
  task: [
    ['title','Task','text','full'], ['focus','Focus','select','', ['Writing','Reading','Research','Editing','Chair/Committee','Coursework','Administration']], ['priority','Priority','select','', ['High','Medium','Low']], ['status','Status','select','', ['Not Started','In Progress','Waiting','Complete']], ['dueDate','Due date','date'], ['notes','Notes','textarea','full']
  ],
  research: [
    ['title','Title','text','full'], ['authors','Authors','text'], ['year','Year','number'], ['sourceType','Source type','select','', ['Journal Article','Book','Dissertation','Report','Website','Government Document']], ['status','Status','select','', ['To Read','Reading','Finished','Cited']], ['theme','Theme','text'], ['journal','Journal / Book','text'], ['volume','Volume','text'], ['issue','Issue','text'], ['pages','Pages','text'], ['doi','DOI / URL','url','full'], ['publisher','Publisher','text'], ['apaCitation','APA Citation','textarea','full'], ['purpose','Purpose','textarea','full'], ['researchQuestions','Research Question(s)','textarea','full'], ['methodology','Methodology','textarea','full'], ['participants','Participants / Setting','textarea','full'], ['keyFindings','Key Findings','textarea','full'], ['quotes','Important Quotes','textarea','full'], ['limitations','Limitations','textarea','full'], ['useInDissertation','Application to My Dissertation','textarea','full'], ['notes','Personal Notes','textarea','full']
  ],
  schedule: [
    ['title','Event','text','full'], ['date','Date','date'], ['category','Category','select','', ['Dissertation','Coursework','Personal','Home','Business','Family']], ['type','Type','select','', ['Writing','Reading','Meeting','Assignment','Presentation','Milestone','Deadline','Study Block']], ['priority','Priority','select','', ['High','Medium','Low']], ['status','Status','select','', ['Scheduled','In Progress','Complete','Canceled']], ['relatedChapter','Related chapter','text'], ['notes','Notes','textarea','full']
  ]
};

function setMessage(msg){ $('#authMessage').textContent = msg || ''; }
function setSync(msg){ $('#syncStatus').textContent = msg; }

$('#signUpBtn').addEventListener('click', async () => {
  try { setMessage(''); await createUserWithEmailAndPassword(auth, $('#email').value, $('#password').value); }
  catch(e){ setMessage(cleanFirebaseError(e)); }
});
$('#signInBtn').addEventListener('click', async () => {
  try { setMessage(''); await signInWithEmailAndPassword(auth, $('#email').value, $('#password').value); }
  catch(e){ setMessage(cleanFirebaseError(e)); }
});
$('#signOutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if(user){
    $('#authScreen').classList.add('hidden'); $('#app').classList.remove('hidden');
    await loadCloud(); render();
  } else {
    $('#authScreen').classList.remove('hidden'); $('#app').classList.add('hidden');
  }
});

function cleanFirebaseError(e){
  const code = e?.code || '';
  if(code.includes('invalid-credential')) return 'The email or password did not match.';
  if(code.includes('email-already-in-use')) return 'That email already has an account. Try signing in.';
  if(code.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if(code.includes('invalid-email')) return 'Enter a valid email address.';
  return e.message || 'Something went wrong.';
}

async function loadCloud(){
  setSync('Loading cloud data...');
  const ref = doc(db, 'users', currentUser.uid, 'app', 'data');
  const snap = await getDoc(ref);
  if(snap.exists()) state = { ...defaultData(), ...snap.data() };
  else { state = defaultData(); await saveCloudNow(); }
  setSync('Saved to cloud');
}

function scheduleSave(){
  if(!currentUser) return;
  setSync('Saving...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCloudNow, 550);
}
async function saveCloudNow(){
  if(!currentUser) return;
  const ref = doc(db, 'users', currentUser.uid, 'app', 'data');
  await setDoc(ref, { ...state, updatedAt: serverTimestamp() }, { merge:false });
  setSync(`Saved ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`);
}

$$('nav button[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
$$('[data-view-jump]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.viewJump)));
function showView(id){
  $$('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  $$('.view').forEach(v => v.classList.toggle('active-view', v.id === id));
  $('#viewTitle').textContent = ({dashboard:'Dashboard',chapters:'Chapters',tasks:'Tasks',research:'Research Library',schedule:'Master Schedule'})[id] || 'Dashboard';
}

$('#openQuickAdd').addEventListener('click', () => openEditor('schedule'));
$$('[data-add]').forEach(btn => btn.addEventListener('click', () => openEditor(btn.dataset.add)));
$('#editorDialog').addEventListener('submit', ev => { ev.preventDefault(); saveEditor(); });
$('#deleteBtn').addEventListener('click', deleteCurrent);

function openEditor(type, id=null){
  editing = {type, id};
  const collection = type === 'chapter' ? 'chapters' : type === 'task' ? 'tasks' : type === 'research' ? 'research' : 'schedule';
  const item = id ? state[collection].find(x => x.id === id) : {};
  $('#dialogTitle').textContent = `${id ? 'Edit' : 'Add'} ${type === 'research' ? 'source' : type}`;
  $('#deleteBtn').classList.toggle('hidden', !id);
  const fields = schemas[type].map(([key,label,inputType,klass,options]) => fieldHTML(key,label,inputType,klass,options,item[key])).join('');
  $('#formFields').innerHTML = fields;
  $('#editorDialog').showModal();
}
function fieldHTML(key,label,type,klass='',options=[],value=''){
  const val = value ?? '';
  if(type === 'select') return `<label class="${klass}">${label}<select name="${key}"><option value=""></option>${options.map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
  if(type === 'textarea') return `<label class="${klass}">${label}<textarea name="${key}">${esc(val)}</textarea></label>`;
  return `<label class="${klass}">${label}<input name="${key}" type="${type}" value="${esc(val)}"></label>`;
}
function saveEditor(){
  const form = new FormData($('#editorDialog form'));
  const item = { id: editing.id || uid() };
  schemas[editing.type].forEach(([key]) => item[key] = form.get(key) || '');
  ['progress','wordGoal','currentWords','year'].forEach(k => { if(k in item) item[k] = Number(item[k] || 0); });
  const collection = editing.type === 'chapter' ? 'chapters' : editing.type === 'task' ? 'tasks' : editing.type === 'research' ? 'research' : 'schedule';
  if(editing.id) state[collection] = state[collection].map(x => x.id === editing.id ? item : x);
  else state[collection].push(item);
  $('#editorDialog').close(); render(); scheduleSave();
}
function deleteCurrent(){
  const collection = editing.type === 'chapter' ? 'chapters' : editing.type === 'task' ? 'tasks' : editing.type === 'research' ? 'research' : 'schedule';
  state[collection] = state[collection].filter(x => x.id !== editing.id);
  $('#editorDialog').close(); render(); scheduleSave();
}

function render(){
  renderDashboard(); renderChapters(); renderTasks(); renderResearch(); renderSchedule();
}
function renderDashboard(){
  const today = todayISO(), twoWeeks = addDaysISO(14);
  const todayItems = state.schedule.filter(x => x.date === today && x.status !== 'Complete' && x.status !== 'Canceled');
  const coming = state.schedule.filter(x => x.date > today && x.date <= twoWeeks && x.status !== 'Complete' && x.status !== 'Canceled').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const reading = state.research.filter(x => x.status === 'Reading');
  $('#todayList').innerHTML = listItems(todayItems, 'schedule', x => `${x.category || 'Schedule'} • ${x.type || ''}`) || empty('Nothing scheduled for today.');
  $('#comingList').innerHTML = listItems(coming, 'schedule', x => `${fmtDate(x.date)} • ${x.category || ''}`) || empty('Nothing coming up in the next two weeks.');
  $('#readingList').innerHTML = listItems(reading, 'research', x => `${x.authors || 'No author yet'}${x.year ? ' • '+x.year : ''}`) || empty('No sources marked as Reading yet.');
  const avg = state.chapters.length ? Math.round(state.chapters.reduce((s,c)=>s+Number(c.progress||0),0)/state.chapters.length) : 0;
  $('#overallProgress').textContent = `${avg}%`;
  $('#chapterSnapshot').innerHTML = state.chapters.map(c => `<div class="mini-chapter"><strong>${esc(c.title)}</strong><div class="progress"><div class="bar" style="width:${Number(c.progress||0)}%"></div></div><span class="meta">${c.progress||0}% • ${esc(c.status||'')}</span></div>`).join('');
}
function listItems(items,type,metaFn){
  return items.map(x => `<div class="item"><div><h4>${esc(x.title)}</h4><div class="meta">${esc(metaFn(x))}</div></div><button onclick="window.editItem('${type}','${x.id}')">Edit</button></div>`).join('');
}
function empty(text){ return `<div class="empty">${esc(text)}</div>`; }
function renderChapters(){
  $('#chaptersGrid').innerHTML = state.chapters.map(c => `<article class="chapter-card"><h3>${esc(c.title)}</h3><div class="progress"><div class="bar" style="width:${Number(c.progress||0)}%"></div></div><div class="meta"><span class="pill">${c.progress||0}%</span><span class="pill">${esc(c.status||'')}</span></div><p><strong>Focus:</strong> ${esc(c.currentFocus||'')}</p><p><strong>Words:</strong> ${Number(c.currentWords||0).toLocaleString()} / ${Number(c.wordGoal||0).toLocaleString()}</p><button onclick="window.editItem('chapter','${c.id}')">Edit chapter</button></article>`).join('');
}
function renderTasks(){
  $('#tasksTable').innerHTML = table(['Task','Focus','Priority','Status','Due','Notes',''], state.tasks, x => [x.title,x.focus,x.priority,x.status,fmtDate(x.dueDate),x.notes,actions('task',x.id)]);
}
function renderResearch(){
  $('#researchTable').innerHTML = table(['Title','Authors','Year','Status','Theme','Citation',''], state.research, x => [x.title,x.authors,x.year,x.status,x.theme,x.apaCitation,actions('research',x.id)]);
}
function renderSchedule(){
  const sorted = [...state.schedule].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  $('#scheduleTable').innerHTML = table(['Event','Date','Category','Type','Priority','Status',''], sorted, x => [x.title,fmtDate(x.date),x.category,x.type,x.priority,x.status,actions('schedule',x.id)]);
}
function table(headers, rows, map){
  if(!rows.length) return empty('No items yet. Use the Add button to create one.');
  return `<table class="data-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${map(r).map(v=>`<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function actions(type,id){ return `<div class="row-actions"><button onclick="window.editItem('${type}','${id}')">Edit</button></div>`; }
window.editItem = openEditor;
function fmtDate(date){
  if(!date) return '';
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'});
}
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `my-dip-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href);
});
$('#importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0]; if(!file) return;
  const text = await file.text();
  state = { ...defaultData(), ...JSON.parse(text) };
  render(); scheduleSave(); ev.target.value = '';
});
