const SETTINGS_KEY="karim_settings_v2";
const FAV_KEY="karim_read_favs_v1";

function toast(msg, ok=true){
  const t=document.getElementById("toast");
  t.textContent=msg;
  t.classList.remove("hidden","bad","hidden");
  t.classList.add(ok?"good":"bad");
  clearTimeout(toast._tm);
  toast._tm=setTimeout(()=>t.classList.add("hidden"), 1600);
}
function sfx(name){ try{ if(window.SFX) SFX.play(name); }catch{} }

function loadFavs(){ try{ return JSON.parse(localStorage.getItem(FAV_KEY)||"{}"); }catch{ return {}; } }
function saveFavs(x){ localStorage.setItem(FAV_KEY, JSON.stringify(x)); }

function icon(name){
  const I={
    sun:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    moon:`<svg viewBox="0 0 24 24" fill="none"><path d="M21 14.5A7.5 7.5 0 0 1 9.5 3 6.5 6.5 0 1 0 21 14.5Z" stroke="currentColor" stroke-width="2"/></svg>`,
    bed:`<svg viewBox="0 0 24 24" fill="none"><path d="M3 11h18v8H3v-8Z" stroke="currentColor" stroke-width="2"/><path d="M7 11V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/><path d="M3 19v2M21 19v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    wake:`<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h10v6a5 5 0 0 1-10 0V3Z" stroke="currentColor" stroke-width="2"/><path d="M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 14v3M15 14v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    pray:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 2c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3Z" stroke="currentColor" stroke-width="2"/><path d="M6 22v-4a6 6 0 0 1 12 0v4" stroke="currentColor" stroke-width="2"/><path d="M8 14l4 2 4-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    food:`<svg viewBox="0 0 24 24" fill="none"><path d="M7 2v9M10 2v9M7 6h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 2v7a3 3 0 0 0 6 0V2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 22h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    quran:`<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4 4V4Z" stroke="currentColor" stroke-width="2"/><path d="M9 20h10V8a4 4 0 0 0-4-4H5" stroke="currentColor" stroke-width="2"/></svg>`,
    dua:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 21c4.4 0 8-3.6 8-8V6l-8-4-8 4v7c0 4.4 3.6 8 8 8Z" stroke="currentColor" stroke-width="2"/></svg>`,
    star:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 17.3l-5.1 3 1.4-5.8-4.5-3.9 6-.5L12 5l2.2 5.1 6 .5-4.5 3.9 1.4 5.8-5.1-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  };
  return I[name]||I.dua;
}

// Data files live in ./read_data/*.json (each section in a separate file)
const DATA_DIR = "read_data";
let DB = [];          // categories (loaded from index.json)
let DB_MAP = {};      // id -> category
let ALL_LOADED = false;

async function loadIndex(){
  try{
    const r = await fetch(`${DATA_DIR}/index.json`);
    const j = await r.json();
    DB = (j && j.categories) ? j.categories : [];
    DB_MAP = {};
    DB.forEach(c => { DB_MAP[c.id] = c; });
  }catch(e){
    console.warn("READ: failed to load index", e);
    DB = [];
    DB_MAP = {};
  }
}

async function loadCategoryItems(id){
  const c = DB_MAP[id];
  if(!c) return [];
  if(Array.isArray(c.items) && c.items.length) return c.items;
  if(!c.file) { c.items = []; return c.items; }
  try{
    const r = await fetch(`${DATA_DIR}/${c.file}`);
    const j = await r.json();
    c.items = (j && Array.isArray(j.items)) ? j.items : [];
  }catch(e){
    console.warn("READ: failed to load category", id, e);
    c.items = [];
  }
  return c.items;
}

async function ensureAllLoaded(){
  if(ALL_LOADED) return;
  await Promise.all(DB.map(c=>loadCategoryItems(c.id)));
  ALL_LOADED = true;
}


const UI = {
  chips: document.getElementById("chips"),
  search: document.getElementById("search"),
  btnClear: document.getElementById("btnClear"),
  cats: document.getElementById("cats"),
  reader: document.getElementById("reader"),
  mTitle: document.getElementById("mTitle"),
  mText: document.getElementById("mText"),
  mRef: document.getElementById("mRef"),
  mRepeat: document.getElementById("mRepeat"),
  mProg: document.getElementById("mProg"),
  mTag: document.getElementById("mTag"),
  btnClose: document.getElementById("btnClose"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnShuffle: document.getElementById("btnShuffle"),
  btnFav: document.getElementById("btnFav"),
  btnCopy: document.getElementById("btnCopy"),
  btnIndex: document.getElementById("btnIndex"),
  idxModal: document.getElementById("indexModal"),
  idxList: document.getElementById("idxList"),
  idxSearch: document.getElementById("idxSearch"),
  btnIdxClear: document.getElementById("btnIdxClear"),
  btnIndexClose: document.getElementById("btnIndexClose"),
};

let favs = loadFavs();
let currentCat = null;
let currentIndex = 0;
let currentList = [];

function timeHint(){
  const h = new Date().getHours();
  if(h>=4 && h<11) return {id:"morning", name:"الآن: صباح"};
  if(h>=15 && h<22) return {id:"evening", name:"الآن: مساء"};
  if(h>=22 || h<4) return {id:"sleep", name:"الآن: قبل النوم"};
  return {id:"after_prayer", name:"الآن: أذكار مختارة"};
}
function renderChips(){
  UI.chips.innerHTML="";
  const th=timeHint();

  const a=document.createElement("div");
  a.className="chip good"; a.textContent=th.name;
  UI.chips.appendChild(a);

  const q=document.createElement("button");
  q.className="chipBtn";
  q.type="button";
  q.textContent="📖 القرآن";
  q.addEventListener("click", ()=>{ sfx("click"); location.href="quran.html"; });
  UI.chips.appendChild(q);

  const b=document.createElement("div");
  b.className="chip"; b.textContent=" المفضلة محفوظة";
  UI.chips.appendChild(b);
}
function countLabel(c){
  if(c && c.page) return "فتح";
  if(Array.isArray(c && c.items)) return `${c.items.length} عنصر`;
  return "اضغط للفتح";
}
function renderCats(filterText=""){
  const q=(filterText||"").trim().toLowerCase();
  UI.cats.innerHTML="";
  const th=timeHint().id;

  const cats = DB.filter(c=>{
    if(!q) return true;
    if((c.title||"").toLowerCase().includes(q)) return true;
    if((c.hint||"").toLowerCase().includes(q)) return true;
    if(Array.isArray(c.items)) return c.items.some(it => (it.t||"").toLowerCase().includes(q) || (it.text||"").toLowerCase().includes(q));
    return false;
  });

  for(const c of cats){
    const el=document.createElement("a");
    el.href="#";
    el.className="card" + (c.id===th ? " primary" : "");
    el.innerHTML = `
      <div class="cat">
        <div class="ico">${icon(c.icon)}</div>
        <div class="txt">
          <div class="h">${c.title}</div>
          <div class="p">${(c.hint||"")}  ${countLabel(c)}</div>
        </div>
      </div>
    `;
    el.addEventListener("click",(e)=>{
      e.preventDefault();
      sfx("click");
      openCategory(c.id);
    });
    UI.cats.appendChild(el);
  }
}
async function openCategory(id){
  const c = DB_MAP[id] || DB.find(x=>x.id===id);
  if(!c){ toast("القسم غير موجود", false); sfx("error"); return; }
  if(c.page){ location.href=c.page; return; }
  await loadCategoryItems(id);
  currentCat = c;
  currentList = (c.items||[]).slice();
  currentIndex = 0;
  UI.reader.classList.remove("hidden");
  renderItem();
}
function closeReader(){ UI.reader.classList.add("hidden"); }

function keyFor(it){
  return (currentCat?currentCat.id:"x")+"::"+(it.t||"")+"::"+(it.text||"").slice(0,40);
}
function renderItem(){
  if(!currentCat) return;
  if(currentList.length===0){ toast("لا يوجد عناصر", false); return; }
  currentIndex = (currentIndex + currentList.length) % currentList.length;
  const it=currentList[currentIndex];

  UI.mTitle.textContent = currentCat.title;
  UI.mText.textContent = (it.t? (it.t+"\n\n") : "") + (it.text||"");
  UI.mRef.textContent = it.ref ? ("المصدر: " + it.ref) : "";
  UI.mRepeat.textContent = it.rep ? ("التكرار: " + it.rep) : "";
  UI.mProg.textContent = `${currentIndex+1}/${currentList.length}`;
  UI.mTag.textContent = currentCat.hint;

  const k=keyFor(it);
  UI.btnFav.textContent = favs[k] ? " Saved" : " Fav";
}
function next(){ currentIndex++; sfx("move"); renderItem(); }
function prev(){ currentIndex--; sfx("move"); renderItem(); }
function shuffle(){
  for(let i=currentList.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [currentList[i],currentList[j]]=[currentList[j],currentList[i]];
  }
  currentIndex=0; sfx("ok"); renderItem();
}
async function copy(){
  const it=currentList[currentIndex];
  const txt = (it.t?it.t+"\n":"") + (it.text||"") + (it.ref?("\n\n "+it.ref):"");
  try{
    await navigator.clipboard.writeText(txt);
    toast("تم النسخ"); sfx("ok");
  }catch{
    const ta=document.createElement("textarea");
    ta.value=txt; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy");
    ta.remove();
    toast("تم النسخ"); sfx("ok");
  }
}
function toggleFav(){
  const it=currentList[currentIndex];
  const k=keyFor(it);
  if(favs[k]){ delete favs[k]; toast("تم إزالة من المفضلة"); sfx("click"); }
  else{ favs[k]=true; toast("تمت الإضافة للمفضلة"); sfx("ok"); }
  saveFavs(favs);
  renderItem();
}

function openIndex(){
  UI.idxModal.classList.remove("hidden");
  UI.idxSearch.value="";
  renderIndex("");
}
function closeIndex(){ UI.idxModal.classList.add("hidden"); }
function renderIndex(q){
  const s=(q||"").trim().toLowerCase();
  UI.idxList.innerHTML="";
  currentCat.items.forEach((it, i)=>{
    const text=(it.text||"");
    const ok = !s || (it.t||"").toLowerCase().includes(s) || text.toLowerCase().includes(s);
    if(!ok) return;
    const row=document.createElement("div");
    row.className="idxItem";
    row.innerHTML = `<div class="t">${i+1}. ${(it.t||"عنصر")}</div><div class="s">${text.slice(0,90)}${text.length>90?"":""}</div>`;
    row.addEventListener("click",()=>{
      sfx("click");
      currentIndex=i;
      closeIndex();
      renderItem();
    });
    UI.idxList.appendChild(row);
  });
}

UI.btnClear.addEventListener("click",()=>{ UI.search.value=""; renderCats(""); sfx("click"); });
let _srchT=null;
async function onSearch(){
  const q=(UI.search.value||"");
  const qq=q.trim();
  // لو بحث حقيقي: حمّل كل الملفات مرة واحدة عشان يشتغل البحث داخل النصوص
  if(qq.length>=2){
    clearTimeout(_srchT);
    _srchT=setTimeout(async ()=>{ await ensureAllLoaded(); renderCats(q); }, 120);
    return;
  }
  renderCats(q);
}
UI.search.addEventListener("input", onSearch);

UI.btnClose.addEventListener("click",()=>{ sfx("click"); closeReader(); });
UI.reader.addEventListener("click",(e)=>{ if(e.target===UI.reader){ sfx("click"); closeReader(); } });

UI.btnNext.addEventListener("click", next);
UI.btnPrev.addEventListener("click", prev);
UI.btnShuffle.addEventListener("click", shuffle);
UI.btnCopy.addEventListener("click", copy);
UI.btnFav.addEventListener("click", toggleFav);
UI.btnIndex.addEventListener("click", ()=>{ sfx("click"); openIndex(); });

UI.btnIndexClose.addEventListener("click", ()=>{ sfx("click"); closeIndex(); });
UI.idxModal.addEventListener("click",(e)=>{ if(e.target===UI.idxModal){ sfx("click"); closeIndex(); } });
UI.idxSearch.addEventListener("input", ()=>renderIndex(UI.idxSearch.value));
UI.btnIdxClear.addEventListener("click", ()=>{ UI.idxSearch.value=""; renderIndex(""); sfx("click"); });

document.addEventListener("keydown",(e)=>{
  if(UI.reader.classList.contains("hidden")) return;
  if(e.key==="Escape"){ closeReader(); }
  if(e.key==="ArrowLeft"){ next(); }
  if(e.key==="ArrowRight"){ prev(); }
});

async function init(){
  renderChips();
  await loadIndex();
  renderCats("");
}
init();
