
// quran.js - Offline Quran reader (improved)
// Data: read_data/quran-simple.txt  (sura|ayah|text)
// Features: Uthmani font offline + basmala split + cards view + pseudo-page view

const SURAH_NAMES = [
"الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل",
"الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة",
"الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات",
"ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن",
"الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات",
"عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح",
"التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون",
"النصر","المسد","الإخلاص","الفلق","الناس"
];

const BASMALA = "بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ";

const $ = (s)=>document.querySelector(s);

let ALL = [];     // {s,a,t}
let BY_S = new Map(); // s -> array

function normalizeForSearch(s){
  // remove tashkeel + tatweel + normalize hamza variants
  return String(s)
    .replace(/[\u064B-\u0652\u0670]/g,"")
    .replace(/\u0640/g,"")
    .replace(/[إأٱآ]/g,"ا")
    .replace(/ى/g,"ي")
    .replace(/ؤ/g,"و")
    .replace(/ئ/g,"ي")
    .replace(/ة/g,"ه")
    .trim();
}

function splitBasmala(sura, ayah, text){
  if(ayah !== 1) return {has:false, rest:text};
  if(sura === 1 || sura === 9) return {has:false, rest:text};
  if(text.startsWith(BASMALA)){
    let rest = text.slice(BASMALA.length).trim();
    if(rest.length===0) rest = " ";
    return {has:true, rest};
  }
  // sometimes basmala followed by space then words
  const n = normalizeForSearch(text);
  const bn = normalizeForSearch(BASMALA);
  if(n.startsWith(bn)){
    // fallback: remove until first space after basmala length in original
    let rest = text.replace(BASMALA,"").trim();
    return {has:true, rest:rest || " "};
  }
  return {has:false, rest:text};
}

async function load(){
  const r = await fetch("read_data/quran-simple.txt");
  const txt = await r.text();
  const lines = txt.split(/\r?\n/).filter(Boolean);
  ALL = [];
  BY_S = new Map();

  for(const line of lines){
    const parts = line.split("|");
    if(parts.length < 3) continue;
    const s = Number(parts[0]);
    const a = Number(parts[1]);
    const t = parts.slice(2).join("|").trim();

    const {has, rest} = splitBasmala(s,a,t);

    // insert basmala as virtual line (a=0) for display only
    if(has){
      const itemB = {s, a:0, t:BASMALA};
      ALL.push(itemB);
      if(!BY_S.has(s)) BY_S.set(s, []);
      BY_S.get(s).push(itemB);
    }

    const item = {s, a, t:rest};
    ALL.push(item);
    if(!BY_S.has(s)) BY_S.set(s, []);
    BY_S.get(s).push(item);
  }

  initUI();
}

function initUI(){
  // build surah select
  const sel = $("#surah");
  sel.innerHTML = "";
  for(let i=1;i<=114;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i}. ${SURAH_NAMES[i-1]}`;
    sel.appendChild(opt);
  }

  const viewSel = $("#viewMode");
  const q = new URLSearchParams(location.search);
  const s0 = q.get("s") || "1";
  const v0 = q.get("v") || "cards";
  sel.value = s0;
  viewSel.value = v0;

  sel.addEventListener("change", ()=>renderSurah());
  viewSel.addEventListener("change", ()=>renderSurah(true));
  $("#btnTop").addEventListener("click", ()=>window.scrollTo({top:0,behavior:"smooth"}));
  $("#btnSearch").addEventListener("click", ()=>doSearch());
  $("#search").addEventListener("keydown",(e)=>{ if(e.key==="Enter") doSearch(); });
  $("#btnClear").addEventListener("click", ()=>{ $("#search").value=""; $("#results").innerHTML=""; renderSurah(); });

  renderSurah();
}

function setUrl(s, v){
  const u = new URL(location.href);
  u.searchParams.set("s", String(s));
  u.searchParams.set("v", String(v));
  history.replaceState({}, "", u.toString());
}

function renderSurah(keepScroll=false){
  const s = Number($("#surah").value);
  const view = $("#viewMode").value;
  setUrl(s, view);

  const container = $("#content");
  container.innerHTML = "";

  const arr = BY_S.get(s) || [];
  const name = SURAH_NAMES[s-1] || "";
  $("#surahTitle").textContent = `سورة ${name}`;

  if(view === "mushaf"){
    // pseudo page: continuous text with ayah numbers
    const box = document.createElement("div");
    box.className = "mushaf qText";
    // basmala centered if exists
    const hasB = arr.length && arr[0].a===0;
    if(hasB){
      const b = document.createElement("div");
      b.className="basmala";
      b.textContent = BASMALA;
      box.appendChild(b);
    }
    const span = document.createElement("div");
    span.style.textAlign="justify";
    span.style.textJustify="inter-word";
    for(const it of arr){
      if(it.a===0) continue;
      const line = document.createElement("span");
      line.className="line";
      line.textContent = it.t + " ";
      const num = document.createElement("span");
      num.textContent = `\u06DD${it.a} `;
      num.style.fontSize="0.9em";
      num.style.opacity="0.9";
      span.appendChild(line);
      span.appendChild(num);
    }
    box.appendChild(span);
    container.appendChild(box);
  }else{
    // cards view
    for(const it of arr){
      if(it.a===0){
        const b = document.createElement("div");
        b.className="basmala qText";
        b.textContent = BASMALA;
        container.appendChild(b);
        continue;
      }
      const card = document.createElement("div");
      card.className="ayahCard";
      card.innerHTML = `
        <div class="ayahRow">
          <div class="ayahNum">آية ${it.a}</div>
          <div class="badge">سورة ${name}</div>
        </div>
        <div class="qText" style="margin-top:10px">${escapeHtml(it.t)}</div>
      `;
      container.appendChild(card);
    }
  }

  if(!keepScroll) window.scrollTo({top:0});
}

function doSearch(){
  const q = $("#search").value.trim();
  const out = $("#results");
  out.innerHTML = "";
  if(!q) return;

  const nq = normalizeForSearch(q);
  const res = [];
  for(const it of ALL){
    if(it.a===0) continue;
    const nt = normalizeForSearch(it.t);
    if(nt.includes(nq)) res.push(it);
    if(res.length >= 60) break;
  }

  if(!res.length){
    out.innerHTML = `<div class="panelQ" style="margin-top:10px"><small>لا توجد نتائج.</small></div>`;
    return;
  }

  const box = document.createElement("div");
  box.className="panelQ";
  box.innerHTML = `<div class="ayahRow"><div class="badge">نتائج البحث</div><small>${res.length} نتيجة (أقصى 60)</small></div>`;
  const list = document.createElement("div");
  list.style.marginTop="10px";

  res.forEach(it=>{
    const name = SURAH_NAMES[it.s-1] || "";
    const row = document.createElement("div");
    row.className="ayahCard";
    row.style.margin="10px 0 0";
    row.innerHTML = `
      <div class="ayahRow">
        <div class="ayahNum">${name} : ${it.a}</div>
        <button class="smallBtn ghost" data-s="${it.s}" data-a="${it.a}">فتح</button>
      </div>
      <div class="qText" style="margin-top:10px">${escapeHtml(it.t)}</div>
    `;
    list.appendChild(row);
  });

  list.addEventListener("click",(e)=>{
    const b = e.target.closest("button[data-s]");
    if(!b) return;
    const s = Number(b.getAttribute("data-s"));
    $("#surah").value = String(s);
    $("#viewMode").value = "cards";
    renderSurah(true);
    // scroll to ayah card
    const a = Number(b.getAttribute("data-a"));
    setTimeout(()=>{
      const cards = Array.from(document.querySelectorAll(".ayahCard .ayahNum"));
      const el = cards.find(x=>x.textContent.includes("آية "+a));
      el?.scrollIntoView({behavior:"smooth", block:"start"});
    }, 50);
  });

  box.appendChild(list);
  out.appendChild(box);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

load().catch(err=>{
  console.error(err);
  $("#content").innerHTML = `<div class="panelQ"><small>تعذر تحميل القرآن: ${escapeHtml(String(err))}</small></div>`;
});
