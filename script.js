import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { collection, doc, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const state = { user:null, tasks:[], research:[], schedule:[], chapters:[], unsub:[] };
const CHAPTERS = [
  'Chapter 1 – Introduction','Chapter 2 – Literature Review','Chapter 3 – Methodology','Chapter 4 – Findings','Chapter 5 – Discussion and Recommendations'
];
const todayISO = () => new Date().toISOString().slice(0,10);
const addDays = (n) => { const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const path = (name) => collection(db, 'users', state.user.uid, name);
const dpath = (name,id) => doc(db, 'users', state.user.uid, name, id);
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; setTimeout(()=>t.hidden=true,2800); }
function fmtDate(s){ if(!s) return 'No date'; const [y,m,d]=s.split('-'); return new Date(Number(y),Number(m)-1,Number(d)).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function esc(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$('#signupBtn').onclick = async () => authAction('signup');
$('#loginBtn').onclick = async () => authAction('login');
$('#logoutBtn').onclick = () => signOut(auth);
async function authAction(mode){
  const email=$('#email').value.trim(); const pass=$('#password').value;
  $('#authMessage').textContent='';
  try{
    if(mode==='signup') await createUserWithEmailAndPassword(auth,email,pass);
    else await signInWithEmailAndPassword(auth,email,pass);
  }catch(e){ $('#authMessage').textContent = e.message.replace('Firebase: ',''); }
}

onAuthStateChanged(auth, async (user)=>{
  state.unsub.forEach(u=>u()); state.unsub=[]; state.user=user;
  $('#authScreen').hidden=!!user; $('#app').hidden=!user;
  if(!user) return;
  $('#userEmail').textContent=user.email;
  await seedChapters(); listenAll();
});

async function seedChapters(){
  const snap = await getDocs(path('chapters'));
  if(!snap.empty) return;
  const batch = writeBatch(db);
  CHAPTERS.forEach((title,i)=> batch.set(dpath('chapters',String(i+1)), { title, status: i===0?'In progress':'Not started', progress: i===0?10:0, currentFocus:'', currentWords:0, wordGoal:0, notes:'', order:i+1, updatedAt: serverTimestamp() }));
  await batch.commit();
}
function listenAll(){
  ['tasks','research','schedule','chapters'].forEach(name=>{
    const unsub=onSnapshot(path(name),(snap)=>{ state[name]=snap.docs.map(d=>({id:d.id,...d.data()})); render(); },(err)=>toast(err.message));
    state.unsub.push(unsub);
  });
}

$$('.nav-btn').forEach(btn=>btn.onclick=()=>showPage(btn.dataset.page));
function showPage(page){
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===page));
  const titles={dashboard:['Dashboard','Your dissertation command center.'],chapters:['Chapters','Track chapter progress and notes.'],research:['Research Library','Collect sources, citations, and literature notes.'],tasks:['Tasks','Manage action items for school and dissertation work.'],schedule:['Calendar','See dated events, coursework, and dissertation milestones.'],settings:['Settings','Backups and account tools.']};
  $('#pageTitle').textContent=titles[page][0]; $('#pageSub').textContent=titles[page][1];
}
$('#quickAddBtn').onclick=()=>openModal('task'); $('#addTaskBtn').onclick=()=>openModal('task'); $('#addResearchBtn').onclick=()=>openModal('research'); $('#addScheduleBtn').onclick=()=>openModal('schedule');
$('#researchSearch').oninput=renderResearch; $('#taskSearch').oninput=renderTasks; $('#scheduleSearch').oninput=renderSchedule;

const schemas={
  task:{ title:'Task', collection:'tasks', fields:[
    ['task','Task','text','full'], ['focus','Focus','select','', ['Writing','Reading','Research','Editing','Coursework','Meeting','Email','Personal']], ['priority','Priority','select','', ['High','Medium','Low']], ['status','Status','select','', ['Not started','In progress','Waiting','Complete']], ['dueDate','Due date','date'], ['today','Show on Today','checkbox'], ['details','Details','textarea','full']
  ]},
  research:{ title:'Source', collection:'research', fields:[
    ['title','Title','text','full'], ['authors','Authors','text'], ['year','Year','number'], ['status','Status','select','', ['To read','Reading','Summarized','Cited']], ['theme','Theme / Section','text'], ['journal','Journal / Book','text'], ['volume','Volume','text'], ['issue','Issue','text'], ['pages','Pages','text'], ['doi','DOI / URL','url','full'], ['citation','APA Citation','textarea','full'], ['notes','Notes / Application','textarea','full']
  ]},
  schedule:{ title:'Event', collection:'schedule', fields:[
    ['event','Event','text','full'], ['date','Date','date'], ['category','Category','select','', ['Dissertation','Coursework','Personal','Home','Business','Family']], ['type','Type','select','', ['Writing','Reading','Meeting','Assignment','Milestone','Deadline','Other']], ['priority','Priority','select','', ['High','Medium','Low']], ['status','Status','select','', ['Scheduled','In progress','Complete']], ['notes','Notes','textarea','full']
  ]},
  chapter:{ title:'Chapter', collection:'chapters', fields:[
    ['title','Title','text','full'], ['status','Status','select','', ['Not started','In progress','Waiting','Complete']], ['progress','Progress %','number'], ['currentFocus','Current focus','text','full'], ['currentWords','Current words','number'], ['wordGoal','Word goal','number'], ['notes','Notes','textarea','full']
  ]}
};
function openModal(type,item={}){
  const schema=schemas[type]; $('#modalTitle').textContent=(item.id?'Edit ':'Add ')+schema.title;
  $('#modalFields').innerHTML=schema.fields.map(f=>fieldHTML(f,item[f[0]])).join('');
  $('#modal').dataset.type=type; $('#modal').dataset.id=item.id||''; $('#modal').showModal();
}
function fieldHTML(f,val=''){
  const [key,label,type,cls,opts]=f; const full=cls==='full'?'full':'';
  if(type==='select') return `<label class="${full}">${label}<select name="${key}">${opts.map(o=>`<option ${o===(val||'')?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
  if(type==='textarea') return `<label class="${full}">${label}<textarea name="${key}">${esc(val||'')}</textarea></label>`;
  if(type==='checkbox') return `<label class="${full} check"><input type="checkbox" name="${key}" ${val?'checked':''}> ${label}</label>`;
  return `<label class="${full}">${label}<input name="${key}" type="${type}" value="${esc(val||'')}"></label>`;
}
$('#modalForm').addEventListener('submit',async(e)=>{
  e.preventDefault(); const type=$('#modal').dataset.type; const id=$('#modal').dataset.id; const schema=schemas[type]; const fd=new FormData(e.target); const data={updatedAt:serverTimestamp()};
  schema.fields.forEach(([key,,fieldType])=>{ data[key]= fieldType==='checkbox' ? Boolean(fd.get(key)) : (fd.get(key)||'').toString(); if(fieldType==='number') data[key]=Number(data[key]||0); });
  try{ if(id) await setDoc(dpath(schema.collection,id),data,{merge:true}); else await addDoc(path(schema.collection),{...data,createdAt:serverTimestamp()}); $('#modal').close(); toast('Saved'); } catch(err){ toast(err.message); }
});
async function del(collectionName,id){ if(confirm('Delete this item?')) await deleteDoc(dpath(collectionName,id)); }
window.editItem=(type,id)=>{ const arr=state[schemas[type].collection]; openModal(type,arr.find(x=>x.id===id)); };
window.deleteItem=(col,id)=>del(col,id);

function render(){ renderDashboard(); renderChapters(); renderResearch(); renderTasks(); renderSchedule(); }
function renderDashboard(){
  const today=todayISO(), twoWeeks=addDays(14);
  const todayItems=[...state.tasks.filter(t=>t.today||t.dueDate===today), ...state.schedule.filter(s=>s.date===today && s.status!=='Complete')];
  const reading=state.research.filter(r=>r.status==='Reading');
  const coming=state.schedule.filter(s=>s.date>today && s.date<=twoWeeks && s.status!=='Complete').sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(0,6);
  $('#todayList').innerHTML=listMini(todayItems, x=>x.task||x.event, x=>x.focus||x.category||x.priority||'');
  $('#readingList').innerHTML=listMini(reading, x=>x.title, x=>`${x.authors||''} ${x.year?`• ${x.year}`:''}`);
  $('#comingList').innerHTML=listMini(coming, x=>x.event, x=>`${fmtDate(x.date)} • ${x.category||''}`);
  const chapters=state.chapters.sort((a,b)=>(a.order||0)-(b.order||0)); const avg=chapters.length?Math.round(chapters.reduce((s,c)=>s+Number(c.progress||0),0)/chapters.length):0;
  $('#overallProgress').textContent=avg+'%';
  $('#chapterProgress').innerHTML=chapters.map(c=>progressHTML(c.title,c.progress||0)).join('')||'<p class="empty">No chapters yet.</p>';
  $('#snapshot').innerHTML=`<div class="stat"><b>Tasks</b><span>${state.tasks.length}</span></div><div class="stat"><b>Sources</b><span>${state.research.length}</span></div><div class="stat"><b>Reading</b><span>${reading.length}</span></div><div class="stat"><b>Upcoming</b><span>${coming.length}</span></div>`;
}
function listMini(arr,title,sub){ return arr.length? arr.slice(0,6).map(x=>`<div class="mini-item"><b>${esc(title(x))}</b><small>${esc(sub(x)||'')}</small></div>`).join(''):'<p class="empty">Nothing here yet.</p>'; }
function progressHTML(title,p){ return `<div class="progress-row"><div class="progress-label"><span>${esc(title)}</span><span>${Number(p)||0}%</span></div><div class="bar"><span style="width:${Math.max(0,Math.min(100,Number(p)||0))}%"></span></div></div>`; }
function renderChapters(){ const chapters=state.chapters.sort((a,b)=>(a.order||0)-(b.order||0)); $('#chaptersGrid').innerHTML=chapters.map(c=>`<article class="chapter-card"><h3>${esc(c.title)}</h3><div class="meta"><span class="chip">${esc(c.status||'')}</span><span class="chip">${c.progress||0}%</span></div>${progressHTML('Progress',c.progress||0)}<p><b>Focus:</b> ${esc(c.currentFocus||'Not set')}</p><p><b>Words:</b> ${c.currentWords||0} / ${c.wordGoal||0}</p><p>${esc(c.notes||'')}</p><div class="record-actions"><button class="small-btn" onclick="editItem('chapter','${c.id}')">Edit</button></div></article>`).join(''); }
function renderResearch(){ const q=($('#researchSearch')?.value||'').toLowerCase(); const items=state.research.filter(r=>JSON.stringify(r).toLowerCase().includes(q)).sort((a,b)=>(b.year||0)-(a.year||0)); $('#researchGrid').innerHTML=items.map(r=>`<article class="record-card"><h3>${esc(r.title||'Untitled source')}</h3><div class="meta"><span class="chip">${esc(r.status||'')}</span><span class="chip">${esc(r.theme||'No theme')}</span><span class="chip">${esc(r.year||'')}</span></div><p><b>Authors:</b> ${esc(r.authors||'')}</p><p><b>Journal/Book:</b> ${esc(r.journal||'')}</p><p>${esc((r.notes||r.citation||'').slice(0,180))}</p><div class="record-actions"><button class="small-btn" onclick="editItem('research','${r.id}')">Edit</button><button class="small-btn danger" onclick="deleteItem('research','${r.id}')">Delete</button></div></article>`).join('')||'<p class="empty">No sources yet.</p>'; }
function renderTasks(){ const q=($('#taskSearch')?.value||'').toLowerCase(); const items=state.tasks.filter(t=>JSON.stringify(t).toLowerCase().includes(q)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')); $('#taskGrid').innerHTML=items.map(t=>`<article class="record-card"><h3>${esc(t.task||'Untitled task')}</h3><div class="meta"><span class="chip">${esc(t.status||'')}</span><span class="chip">${esc(t.priority||'')}</span><span class="chip">${esc(t.focus||'')}</span>${t.today?'<span class="chip">Today</span>':''}</div><p><b>Due:</b> ${fmtDate(t.dueDate)}</p><p>${esc(t.details||'')}</p><div class="record-actions"><button class="small-btn" onclick="editItem('task','${t.id}')">Edit</button><button class="small-btn danger" onclick="deleteItem('tasks','${t.id}')">Delete</button></div></article>`).join('')||'<p class="empty">No tasks yet.</p>'; }
function renderSchedule(){ const q=($('#scheduleSearch')?.value||'').toLowerCase(); const items=state.schedule.filter(s=>JSON.stringify(s).toLowerCase().includes(q)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')); $('#scheduleGrid').innerHTML=items.map(s=>`<article class="timeline-item"><div class="date-badge">${fmtDate(s.date)}</div><div><h3>${esc(s.event||'Untitled event')}</h3><div class="meta"><span class="chip">${esc(s.category||'')}</span><span class="chip">${esc(s.type||'')}</span><span class="chip">${esc(s.status||'')}</span></div><p>${esc(s.notes||'')}</p><div class="record-actions"><button class="small-btn" onclick="editItem('schedule','${s.id}')">Edit</button><button class="small-btn danger" onclick="deleteItem('schedule','${s.id}')">Delete</button></div></div></article>`).join('')||'<p class="empty">No scheduled items yet.</p>'; }

$('#exportBtn').onclick=()=>{ const data=JSON.stringify({tasks:state.tasks,research:state.research,schedule:state.schedule,chapters:state.chapters},null,2); const blob=new Blob([data],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='my-dissertation-dashboard-backup.json'; a.click(); };
$('#importFile').onchange=async(e)=>{ const file=e.target.files[0]; if(!file) return; const data=JSON.parse(await file.text()); if(!confirm('Import backup? This will add/overwrite items with matching IDs.')) return; for(const col of ['tasks','research','schedule','chapters']){ for(const item of data[col]||[]){ const {id,...rest}=item; await setDoc(id?dpath(col,id):doc(path(col)), rest, {merge:true}); } } toast('Import complete'); };
