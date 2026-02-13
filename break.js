(()=> {
  // Break Time system (global) - uses Settings: karim_settings_v2
  const KEY_SETTINGS = "karim_settings_v2";
  const KEY_LAST = "break_last_ts_v2";
  const KEY_SEED = "break_seed_v1";

  // --- tiny style injection (works in any page) ---
  function ensureStyle(){
    if(document.getElementById("breakStyle")) return;
    const st=document.createElement("style");
    st.id="breakStyle";
    st.textContent = `
      .kg_break_overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px;z-index:9999}
      .kg_break_overlay.hidden{display:none}
      .kg_break_card{width:min(720px,100%);border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(20,22,30,.88);box-shadow:0 24px 80px rgba(0,0,0,.6);padding:16px;color:rgba(255,255,255,.94);font-family:system-ui,-apple-system,Segoe UI,Arial}
      .kg_break_head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .kg_break_title{font-weight:1000;letter-spacing:.4px}
      .kg_break_small{font-size:12px;opacity:.75}
      .kg_break_body{margin-top:12px;display:grid;gap:10px}
      .kg_break_block{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);border-radius:14px;padding:10px 12px}
      .kg_break_block b{display:block;margin-bottom:6px}
      .kg_break_btnrow{margin-top:12px;display:flex;justify-content:flex-end}
      .kg_break_btn{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);color:rgba(255,255,255,.92);padding:10px 14px;border-radius:14px;font-weight:950;cursor:pointer}
      .kg_break_btn:active{transform:translateY(1px)}
    `;
    document.head.appendChild(st);
  }

  function ensureModal(){
    ensureStyle();
    let m=document.getElementById("kgBreak");
    if(m) return m;
    m=document.createElement("div");
    m.id="kgBreak";
    m.className="kg_break_overlay hidden";
    m.innerHTML = `
      <div class="kg_break_card" role="dialog" aria-modal="true">
        <div class="kg_break_head">
          <div>
            <div class="kg_break_title" id="kgBreakTitle">Break Time</div>
            <div class="kg_break_small" id="kgBreakSub">استراحة قصيرة</div>
          </div>
        </div>
        <div class="kg_break_body" id="kgBreakBody"></div>
        <div class="kg_break_btnrow">
          <button class="kg_break_btn" id="kgBreakOK">OK</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener("click", (e)=>{ if(e.target===m) hide(); });
    document.getElementById("kgBreakOK").onclick = ()=>hide();
    return m;
  }

  function show(title, sub, html){
    const m=ensureModal();
    document.getElementById("kgBreakTitle").textContent = title || "Break Time";
    document.getElementById("kgBreakSub").textContent = sub || "";
    document.getElementById("kgBreakBody").innerHTML = html;
    m.classList.remove("hidden");
  }
  function hide(){ ensureModal().classList.add("hidden"); }
  function isOpen(){ return !ensureModal().classList.contains("hidden"); }

  function loadSettings(){
    try{
      return JSON.parse(localStorage.getItem(KEY_SETTINGS) || "{}");
    }catch{ return {}; }
  }
  function getBreakMin(){
    const s=loadSettings();
    const on = (s.breakOn !== false);
    const min = Math.max(5, Math.min(60, parseInt(s.breakMin || 15, 10)));
    return {on, min};
  }

  function bucketByHour(h){
    if (h >= 4 && h < 11) return "morning";
    if (h >= 15 && h < 19) return "evening";
    if (h >= 19 && h < 23) return "night";
    return "sleep";
  }

  // --- content (short, safe, varied) ---
  const QURAN = [
    {t:"أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ", ref:"الرعد: 28"},
    {t:"فَاذْكُرُونِي أَذْكُرْكُمْ", ref:"البقرة: 152"},
    {t:"إِنَّ مَعَ الْعُسْرِ يُسْرًا", ref:"الشرح: 6"},
    {t:"وَقُل رَّبِّ زِدْنِي عِلْمًا", ref:"طه: 114"},
    {t:"وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ", ref:"الحديد: 4"},
    {t:"وَتَوَكَّلْ عَلَى الْحَيِّ الَّذِي لَا يَمُوتُ", ref:"الفرقان: 58"},
    {t:"إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", ref:"البقرة: 153"},
  ];

  const SALAWAT = [
    "اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ ﷺ.",
    "صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ.",
    "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ."
  ];

  const HADITH = [
    "قال ﷺ: «أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ».",
    "قال ﷺ: «مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ».",
    "قال ﷺ: «اغْتَنِمْ خَمْسًا قَبْلَ خَمْسٍ: شَبَابَكَ قَبْلَ هَرَمِكَ...».",
  ];

  const ADHKAR = {
    morning: [
      "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.",
      "رَضِيتُ بِاللَّهِ رَبًّا وَبِالْإِسْلَامِ دِينًا وَبِمُحَمَّدٍ ﷺ نَبِيًّا.",
      "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.",
    ],
    evening: [
      "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.",
      "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ.",
      "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.",
    ],
    night: [
      "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ.",
      "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ.",
      "اللَّهُمَّ اغْفِرْ لِي.",
    ],
    sleep: [
      "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.",
      "اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ.",
      "سُبْحَانَ اللَّهِ 33 — الْحَمْدُ لِلَّهِ 33 — اللَّهُ أَكْبَرُ 34.",
    ],
  };

  // deterministic-ish pick to avoid نفس الجملة طول الوقت
  function seedRand(){
    let s = parseInt(localStorage.getItem(KEY_SEED)||"0",10);
    if(!s){ s = Math.floor(Math.random()*1e9); localStorage.setItem(KEY_SEED,String(s)); }
    // LCG
    s = (s*1664525 + 1013904223) % 4294967296;
    localStorage.setItem(KEY_SEED,String(s));
    return s / 4294967296;
  }
  function pick(arr){
    const r = seedRand();
    return arr[Math.floor(r*arr.length)];
  }

  function buildHtml(){
    const h=new Date().getHours();
    const b=bucketByHour(h);
    const q=pick(QURAN);
    const s=pick(SALAWAT);
    const hd=pick(HADITH);
    const dz=pick(ADHKAR[b] || ADHKAR.night);
    return `
      <div class="kg_break_block"><b>آية</b><div>${q.t}<div class="kg_break_small">${q.ref}</div></div></div>
      <div class="kg_break_block"><b>الصلاة على النبي ﷺ</b><div>${s}</div></div>
      <div class="kg_break_block"><b>حديث</b><div>${hd}</div></div>
      <div class="kg_break_block"><b>ذكر (${b})</b><div>${dz}</div></div>
    `;
  }

  function shouldShow(min){
    const last = parseInt(localStorage.getItem(KEY_LAST)||"0",10);
    const now = Date.now();
    return (now - last) >= (min*60*1000 - 1500);
  }
  function markShown(){ localStorage.setItem(KEY_LAST, String(Date.now())); }

  let pending=false;

  function tick(){
    const {on, min} = getBreakMin();
    if(!on) return;
    if(!shouldShow(min)) return;
    if(isOpen()){ pending=true; return; }
    pending=false;
    show("Break Time", `كل ${min} دقيقة`, buildHtml());
    markShown();
  }

  // schedule aligned
  function schedule(){
    const {on, min} = getBreakMin();
    if(!on) return;
    const now=new Date();
    const ms=now.getMilliseconds();
    const sec=now.getSeconds();
    const m=now.getMinutes();
    const mod=m % min;
    const minsToNext = (mod===0) ? min : (min - mod);
    const delay = ((minsToNext*60) - sec)*1000 - ms;
    setTimeout(()=>{ tick(); setInterval(tick, min*60*1000); }, Math.max(800, delay));
  }

  // observe modal closing for pending
  const obs=new MutationObserver(()=>{ if(pending && !isOpen()) tick(); });
  obs.observe(ensureModal(), {attributes:true, attributeFilter:["class"]});

  schedule();
})();
