/* Chemistry Duolingo-like (offline)  Karim Games */
const $=s=>document.querySelector(s);
function escapeHTML(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\'/g,"&#39;");
}
const LS="karim_chem_v1";
const USED_KEY=LS+"_used_v1";
function loadUsed(){
  try{ return JSON.parse(localStorage.getItem(USED_KEY)||"{}"); }catch{return {};}
}
function saveUsed(u){ try{ localStorage.setItem(USED_KEY, JSON.stringify(u)); }catch{} }
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=(Math.random()*(i+1))|0;
    const t=arr[i]; arr[i]=arr[j]; arr[j]=t;
  }
  return arr;
}

function beep(f=520,ms=60,v=0.05){
  try{
    const ac=beep.ac||(beep.ac=new (window.AudioContext||window.webkitAudioContext)());
    const o=ac.createOscillator(), g=ac.createGain();
    o.type="sine"; o.frequency.value=f; g.gain.value=v;
    o.connect(g); g.connect(ac.destination);
    o.start(); setTimeout(()=>o.stop(), ms);
  }catch{}
}

function splitCoef(tok){
  const m = tok.match(/^([0-9]+)([A-Za-z].*)$/);
  if(m) return {coef:m[1], f:m[2]};
  return {coef:"", f:tok};
}
function fmtFormulaHTML(f){
  // subscript digits that belong to the formula (not leading coefficients)
  return (f||"").replace(/([0-9]+)/g, "<sub>$1</sub>");
}
function fmtTokenHTML(tok){
  tok = (tok||"").trim();
  const {coef, f} = splitCoef(tok);
  return coef + fmtFormulaHTML(f);
}
function fmtEqHTML(eq){
  if(!eq) return "";
  let s = String(eq);
  // support old style: double spaces used as arrow
  s = s.replace(/\s{2,}/g, " → ");
  s = s.replace(/->/g, " → ");
  // Normalize spaces
  s = s.replace(/\s*\+\s*/g, " + ");
  s = s.replace(/\s*→\s*/g, " → ");
  s = s.replace(/\s+/g, " ").trim();
  // format each token separated by space
  return s.split(" ").map(t=>{
    if(t==="+" || t==="→") return t;
    return fmtTokenHTML(t);
  }).join(" ");
}


const BANK=[
  // تصنيف (MCQ)
  {id:"c1",diff:"easy",kind:"mcq",title:"ما نوع التفاعل؟",eq:"CaCO3 -> CaO + CO2",opts:["انحلال حراري","إحلال بسيط","إحلال مزدوج","أكسدة واختزال"],ans:0,exp:"تسخين كربونات فلز يعطي أكسيد الفلز + CO."},
  {id:"c2",diff:"easy",kind:"mcq",title:"ما نوع التفاعل؟",eq:"AgNO3 + NaCl -> AgCl↓ + NaNO3",opts:["إحلال مزدوج","إحلال بسيط","انحلال حراري","تعادل فقط"],ans:0,exp:"تبادل أيونات بين مركبين (إحلال مزدوج) ويتكون راسب AgCl."},
  {id:"c3",diff:"med",kind:"mcq",title:"ما نوع التفاعل؟",eq:"Zn + CuSO4 -> ZnSO4 + Cu",opts:["إحلال بسيط","إحلال مزدوج","انحلال حراري","لا يحدث"],ans:0,exp:"فلز أنشط (Zn) يحل محل فلز أقل نشاطًا (Cu)."},
  {id:"c4",diff:"hard",kind:"mcq",title:"هل التفاعل أكسدة/اختزال؟",eq:"Fe2O3 + 3CO -> 2Fe + 3CO2",opts:["نعم (Redox)","لا"],ans:0,exp:"تغيّر أعداد التأكسد: Fe يُختزل، و CO يتأكسد إلى CO."},

  // توقع نواتج (Fill)
  {id:"p1",diff:"easy",kind:"fill",title:"أكمل النواتج",stem:"تسخين: 2KClO  ?",blanks:2,
    pool:["2KCl + 3O","KCl + O","2KCl + O","KO + Cl"],
    ans:"2KCl + 3O",exp:"انحلال كلورات البوتاسيوم يعطي كلوريد + أكسجين."},
  {id:"p2",diff:"med",kind:"fill",title:"أكمل النواتج",stem:"إحلال بسيط: Fe + CuSO4  ?",blanks:1,
    pool:["FeSO4 + Cu","FeSO4 + CuO","Cu + FeO","لا يحدث"],
    ans:"FeSO4 + Cu",exp:"الحديد أنشط من النحاس فيحل محله."},
  {id:"p3",diff:"easy",kind:"fill",title:"أكمل النواتج",stem:"إحلال مزدوج: BaCl + NaSO  ?",blanks:1,
    pool:["BaSO + 2NaCl","BaSO + NaCl","BaCl + NaSO","BaNaSO + Cl"],
    ans:"BaSO + 2NaCl",exp:"يتكون راسب كبريتات الباريوم غير الذائبة."},

  // موازنة (Balance)
  {id:"b1",diff:"easy",kind:"balance",title:"وازن المعادلة",lhs:["HCl","NaOH"],rhs:["NaCl","H2O"],coef:[1,1,1,1],
    exp:"تعادل: حمض + قاعدة  ملح + ماء."},
  {id:"b2",diff:"med",kind:"balance",title:"وازن المعادلة",lhs:["Zn","HCl"],rhs:["ZnCl2","H2"],coef:[1,2,1,1],
    exp:"إحلال بسيط: Zn يحل محل H من الحمض."},
  {id:"b3",diff:"med",kind:"balance",title:"وازن المعادلة",lhs:["Fe","O2"],rhs:["Fe2O3"],coef:[4,3,2],
    exp:"تذكّر: Fe2O3 فيها 2Fe و3O."},
  {id:"b4",diff:"easy",kind:"balance",title:"وازن المعادلة",lhs:["CaCO3"],rhs:["CaO","CO2"],coef:[1,1,1],
    exp:"انحلال حراري لكربونات الكالسيوم."},
  {id:"b5",diff:"hard",kind:"balance",title:"وازن المعادلة",lhs:["Fe2O3","CO"],rhs:["Fe","CO2"],coef:[1,3,2,3],
    exp:"Redox شائع: Fe2O3 + CO يتحول إلى Fe + CO2."},

  // أكسدة/اختزال (Modern/Traditional)
  {id:"r1",diff:"hard",kind:"mcq",title:"(مفهوم تقليدي) الأكسدة تعني",eq:"اختر الإجابة",opts:["زيادة نسبة الأكسجين أو نقص الهيدروجين","اكتساب إلكترونات","نقص عدد التأكسد","لا شيء"],ans:0,
    exp:"تقليديًا: الأكسدة = زيادة O أو نقص H."},
  {id:"r2",diff:"hard",kind:"mcq",title:"(مفهوم حديث) الاختزال يعني",eq:"اختر الإجابة",opts:["اكتساب إلكترونات/نقص عدد التأكسد","زيادة الأكسجين","فقد إلكترونات","زيادة عدد التأكسد"],ans:0,
    exp:"حديثًا: الاختزال = اكتساب إلكترونات (أو نقص عدد التأكسد)."},
];

const LESSONS=[
  {id:"E1",diff:"easy",name:"تصنيف سريع",desc:"اختيار نوع التفاعل من معادلات بسيطة",kinds:["mcq"],count:6},
  {id:"E2",diff:"easy",name:"الانحلال الحراري",desc:"أمثلة + توقع نواتج + موازنة سهلة",kinds:["mcq","fill","balance"],count:7},
  {id:"E3",diff:"easy",name:"الإحلال المزدوج",desc:"تبادل أيونات + راسب/تعادل",kinds:["mcq","fill","balance"],count:7},

  {id:"M1",diff:"med",name:"الإحلال البسيط",desc:"سلسلة نشاط (مبسطة) + توقع نواتج",kinds:["mcq","fill","balance"],count:8},
  {id:"M2",diff:"med",name:"الموازنة 1",desc:"تدريب على معاملات صغيرة",kinds:["balance"],count:8},
  {id:"M3",diff:"med",name:"الموازنة 2",desc:"معادلات أصعب شوية",kinds:["balance","mcq"],count:9},

  {id:"H1",diff:"hard",name:"أكسدة/اختزال (تقليدي)",desc:"O/H + أمثلة سريعة",kinds:["mcq"],count:6},
  {id:"H2",diff:"hard",name:"أكسدة/اختزال (حديث)",desc:"إلكترونات/أعداد تأكسد",kinds:["mcq","balance"],count:8},
  {id:"H3",diff:"hard",name:"اختبار شامل",desc:"مزج: نوع التفاعل + نواتج + موازنة",kinds:["mcq","fill","balance"],count:10},
];

let P = load();

function load(){
  try{ return JSON.parse(localStorage.getItem(LS)) || {diff:"easy",unlock:{easy:1,med:0,hard:0},xp:0}; }
  catch{ return {diff:"easy",unlock:{easy:1,med:0,hard:0},xp:0}; }
}
function save(){ localStorage.setItem(LS, JSON.stringify(P)); }

const el={
  home:$("#home"), quiz:$("#quiz"),
  lessons:$("#lessons"),
  hearts:$("#hearts"), barin:$("#barin"), xp:$("#xp"),
  qtitle:$("#qtitle"), qbody:$("#qbody"), qactions:$("#qactions"),
  check:$("#check"), skip:$("#skip"),
  toast:$("#toast"), sub:$("#subtitle"),
  back:$("#back"), reset:$("#reset")
};

let session=null;
let pending=null;

function toast(msg,type="good"){
  el.toast.className="toast "+type;
  el.toast.textContent=msg;
  setTimeout(()=>el.toast.classList.remove("hidden"),0);
  setTimeout(()=>el.toast.classList.add("hidden"),1600);
}

function renderLessons(){
  el.lessons.innerHTML="";
  const diff=P.diff;
  el.sub.textContent = diff==="easy" ? "سهل" : diff==="med" ? "متوسط" : "صعب";

  const unlocked = P.unlock[diff]||0;

  LESSONS.filter(x=>x.diff===diff).forEach((l,idx)=>{
    const locked = (idx>=unlocked);
    const d=document.createElement("div");
    d.className="lesson";
    d.innerHTML=`<div class="t">${l.name}</div><div class="d">${l.desc}</div>${locked?'<div class="lock">LOCK</div>':""}`;
    if(!locked){
      d.onclick=()=>startLesson(l.id);
    }else{
      d.onclick=()=>toast("افتح الدرس اللي قبله الأول","bad");
    }
    el.lessons.appendChild(d);
  });
}

function pickQs(lesson){
  const pool=BANK.filter(q=>q.diff===lesson.diff && lesson.kinds.includes(q.kind));
  const want = Math.min(lesson.count, pool.length || lesson.count);
  const usedAll = loadUsed();
  const key = lesson.id;
  const used = new Set(usedAll[key] || []);
  let avail = pool.filter(q=>!used.has(q.id));
  // لو خلصنا كل الأسئلة، نعيد الدورة
  if(avail.length < want){ usedAll[key]=[]; avail = pool.slice(); }
  shuffle(avail);
  const picked = avail.slice(0, want);
  // سجل الأسئلة المستخدمة
  const nextUsed = Array.from(new Set([...(usedAll[key]||[]), ...picked.map(x=>x.id)]));
  usedAll[key] = nextUsed.slice(-2000);
  saveUsed(usedAll);
  return picked;
}

function startLesson(id){
  const lesson=LESSONS.find(x=>x.id===id);
  const qs=pickQs(lesson);
  session={lesson,qs,i:0,hearts:3,xp:0,wrong:0};
  el.home.classList.add("hidden");
  el.quiz.classList.remove("hidden");
  renderQ();
}

function setHearts(n){
  el.hearts.innerHTML="";
  for(let i=0;i<3;i++){
    const h=document.createElement("div");
    h.className="heart "+(i<n?"on":"");
    el.hearts.appendChild(h);
  }
}

function progress(){
  const p = (session.i/session.qs.length)*100;
  el.barin.style.width = `${p}%`;
  el.xp.textContent = `XP ${P.xp + session.xp}`;
  setHearts(session.hearts);
}

function renderQ(){
  pending=null;
  progress();
  const q=session.qs[session.i];
  el.qtitle.textContent = `${q.title} (${session.i+1}/${session.qs.length})`;
  el.qactions.innerHTML="";

  if(q.kind==="mcq"){
    // Use formatting for arrows + subscripts when the stem is a chemical equation
    const eqHTML = (q.eq && (q.eq.includes("->") || q.eq.includes("  ") || /[A-Za-z][0-9]/.test(q.eq)))
      ? fmtEqHTML(q.eq)
      : String(q.eq||"");
    el.qbody.innerHTML = `<div class="eq" dir="ltr">${eqHTML}</div><div class="opts" id="opts"></div>`;
    const box=$("#opts");
        const order = shuffle(q.opts.map((_,i)=>i));
    order.forEach((origIx)=>{
      const t = q.opts[origIx];
      const b=document.createElement("div");
      b.className="opt";
      // options can be Arabic text or formulas; keep it safe + render subscripts if needed
      const isFormula = /[A-Za-z][0-9]/.test(t) || t.includes("->") || t.includes("  ");
      b.innerHTML = isFormula ? `<span dir="ltr">${fmtEqHTML(t)}</span>` : escapeHTML(String(t));
      b.onclick=()=>{
        pending={kind:"mcq", pick:origIx};
        document.querySelectorAll(".opt").forEach(x=>x.classList.remove("on"));
        b.classList.add("on");
        beep(520);
      };
      box.appendChild(b);
    });
  }

  if(q.kind==="fill"){
    const opts=q.pool.slice().sort(()=>Math.random()-0.5);
    el.qbody.innerHTML = `<div class="eq" dir="ltr">${fmtEqHTML(q.stem)}</div><div class="opts" id="opts"></div>`;
    const box=$("#opts");
    opts.forEach(t=>{
      const b=document.createElement("div");
      b.className="opt";
      b.innerHTML = `<span dir="ltr">${fmtTokenHTML(t)}</span>`;
      b.onclick=()=>{ [...box.children].forEach(x=>x.classList.remove("sel")); b.classList.add("sel"); pending={kind:"fill",pick:t}; beep(520); };
      box.appendChild(b);
    });
  }

  if(q.kind==="balance"){
    const all=[...q.lhs, ...q.rhs];
    const want=q.coef;
    const inp=[];
    const mk=(i)=>{
      const w=document.createElement("div");
      w.className="num";
      w.innerHTML=`<button data-a="-">-</button><input value="1" inputmode="numeric"/><button data-a="+">+</button>`;
      const input=w.querySelector("input");
      const clamp=()=>{ let v=+input.value||1; v=Math.max(1,Math.min(9,v)); input.value=v; inp[i]=v; };
      w.querySelectorAll("button").forEach(btn=>{
        btn.onclick=()=>{
          let v=+input.value||1;
          v += (btn.dataset.a==="+"?1:-1);
          input.value=v; clamp(); beep(480,45,0.04);
        };
      });
      input.oninput=()=>{ clamp(); };
      clamp();
      return w;
    };

    const eqL = q.lhs.map((s,i)=>`<span dir="ltr">${fmtTokenHTML(s)}</span>`).join(" + ");
    const eqR = q.rhs.map((s,i)=>`<span dir="ltr">${fmtTokenHTML(s)}</span>`).join(" + ");
    el.qbody.innerHTML = `<div class="eq" dir="ltr">${eqL} → ${eqR}</div><div class="row" id="nums"></div>
      <div style="margin-top:10px;color:rgba(255,255,255,.65);font-size:13px;text-align:center">اضبط معاملات كل مادة بالترتيب: (الطرف الأيسر ثم الأيمن)</div>`;
    const row=$("#nums");
    for(let i=0;i<all.length;i++){
      const c=document.createElement("div");
      c.style.textAlign="center";
      c.innerHTML=`<div style="font-size:12px;color:rgba(255,255,255,.65);margin-bottom:6px" dir="ltr">${fmtTokenHTML(all[i])}</div>`;
      c.appendChild(mk(i));
      row.appendChild(c);
    }
    pending={kind:"balance",get:()=>inp.slice(),want};
  }
}

function grade(){
  const q=session.qs[session.i];
  let ok=false;

  if(q.kind==="mcq"){
    ok = pending && pending.kind==="mcq" && pending.pick===q.ans;
  }
  if(q.kind==="fill"){
    ok = pending && pending.kind==="fill" && pending.pick===q.ans;
  }
  if(q.kind==="balance"){
    if(!pending || pending.kind!=="balance") ok=false;
    else{
      const got=pending.get();
      ok = got.length===q.coef.length && got.every((v,i)=>v===q.coef[i]);
    }
  }

  if(ok){
    session.xp += 10;
    beep(740,90,0.06);
    toast("صح   +10 XP","good");
  }else{
    session.wrong++;
    session.hearts--;
    beep(190,120,0.07);
    toast("غلط ","bad");
  }

  // شرح سريع
  if(q.exp) setTimeout(()=>toast(q.exp, ok?"good":"bad"), 200);

  // انتهاء القلوب
  if(session.hearts<=0){
    P.xp += session.xp;
    save();
    showEnd(false);
    return;
  }

  // السؤال التالي
  session.i++;
  if(session.i>=session.qs.length){
    P.xp += session.xp;
    // unlock next lesson (نفس المستوى)
    const diff=session.lesson.diff;
    const list=LESSONS.filter(x=>x.diff===diff);
    const idx=list.findIndex(x=>x.id===session.lesson.id);
    P.unlock[diff] = Math.max(P.unlock[diff]||0, idx+2);
    save();
    showEnd(true);
    return;
  }

  renderQ();
}

function showEnd(win){
  el.qbody.innerHTML = `
    <div class="eq">${win?"خلصت الدرس ":"خلصت القلوب "}</div>
    <div style="margin-top:12px;line-height:1.9;color:rgba(255,255,255,.78)">
      XP المكتسب: <b>${session.xp}</b><br/>
      أخطاء: <b>${session.wrong}</b><br/>
      الدرس: <b>${session.lesson.name}</b>
    </div>
  `;
  el.qactions.innerHTML="";
  el.check.textContent="رجوع للدروس";
  el.skip.classList.add("hidden");
  el.check.onclick=()=>{
    el.check.textContent="تحقق";
    el.skip.classList.remove("hidden");
    el.check.onclick=grade;
    goHome();
  };
}

function goHome(){
  session=null;
  el.quiz.classList.add("hidden");
  el.home.classList.remove("hidden");
  renderLessons();
}

el.check.onclick=grade;
el.skip.onclick=()=>{
  session.i++;
  if(session.i>=session.qs.length) showEnd(true);
  else renderQ();
};

document.querySelectorAll("[data-diff]").forEach(b=>{
  b.onclick=()=>{ P.diff=b.dataset.diff; save(); renderLessons(); beep(520); };
});

el.back.onclick=()=>{ location.href="play.html"; };
el.reset.onclick=()=>{
  localStorage.removeItem(LS);
  P=load();
  toast("تم Reset","good");
  goHome();
};

renderLessons();
