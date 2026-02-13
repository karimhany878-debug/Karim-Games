const KEY_V2="karim_settings_v2";
const KEY_V1="karim_settings_v1";

function defaults(){
  return {
    sound:true,
    volume:0.35,
    chessBotDelay:0,
    chessStrength:"normal",
    breakMin:15,
    breakOn:true
  };
}
function load(){
  let base=defaults();
  try{
    const v2=JSON.parse(localStorage.getItem(KEY_V2)||"{}");
    base={...base,...v2};
  }catch{}
  // migrate from v1 if exists (best-effort)
  try{
    const v1=JSON.parse(localStorage.getItem(KEY_V1)||"{}");
    base.sound = (typeof base.sound==="boolean") ? base.sound : (v1.sound ?? true);
    base.volume = (typeof base.volume==="number") ? base.volume : (v1.volume ?? 0.35);
    base.chessBotDelay = (typeof base.chessBotDelay==="number") ? base.chessBotDelay : (v1.chessBotDelay ?? 1200);
    base.breakMin = (typeof base.breakMin==="number") ? base.breakMin : (v1.breakMin ?? 15);
  }catch{}
  return base;
}
function save(x){ localStorage.setItem(KEY_V2, JSON.stringify(x)); }

const S=load();

const elSound=document.getElementById("sound");
const elVol=document.getElementById("vol");
const elChDelay=document.getElementById("chDelay");
const elChStr=document.getElementById("chStr");
const elBreakMin=document.getElementById("breakMin");
const elBreakOn=document.getElementById("breakOn");

const toastEl=document.getElementById("toast");
let tmr=null;
function toast(msg, kind="good"){
  toastEl.textContent=msg;
  toastEl.classList.remove("hidden","good","bad");
  toastEl.classList.add(kind);
  clearTimeout(tmr);
  tmr=setTimeout(()=>toastEl.classList.add("hidden"), 1100);
}

function bind(){
  elSound.checked=!!S.sound;
  elVol.value=String(S.volume);
  elChDelay.value=String(S.chessBotDelay);
  elChStr.value=S.chessStrength || "normal";
  elBreakMin.value=String(S.breakMin);
  elBreakOn.checked=!!S.breakOn;
}
bind();

document.getElementById("save").onclick=()=>{
  const out={
    sound:elSound.checked,
    volume:Math.max(0, Math.min(1, parseFloat(elVol.value||"0.35"))),
    chessBotDelay:Math.max(200, Math.min(6000, parseInt(elChDelay.value||"1200",10))),
    chessStrength:elChStr.value || "normal",
    breakMin:Math.max(5, Math.min(60, parseInt(elBreakMin.value||"15",10))),
    breakOn:elBreakOn.checked
  };
  save(out);
  toast("Saved", "good");
};

document.getElementById("reset").onclick=()=>{
  const d=defaults();
  save(d);
  Object.assign(S,d);
  bind();
  toast("Reset", "bad");
};

