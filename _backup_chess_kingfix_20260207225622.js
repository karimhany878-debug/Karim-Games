/* Karim Chess v4: Win/Draw + Strong Bot */
const $=s=>document.querySelector(s);
const cv=$("#cv"),ctx=cv.getContext("2d");
const ui={
  mode:$("#mode"),lvl:$("#lvl"),pset:$("#pset"),
  flip:$("#flip"),undo:$("#undo"),neu:$("#new"),
  sub:$("#sub"),turn:$("#turn"),eval:$("#eval"),
  wLost:$("#wLost"),bLost:$("#bLost")
};
const START="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const TYPES=["wP","wN","wB","wR","wQ","wK","bP","bN","bB","bR","bQ","bK"];
const V={P:100,N:320,B:330,R:500,Q:900,K:20000};
const PST={
P:[0,0,0,0,0,0,0,0,5,10,10,-20,-20,10,10,5,5,-5,-10,0,0,-10,-5,5,0,0,0,20,20,0,0,0,5,5,10,25,25,10,5,5,10,10,20,30,30,20,10,10,50,50,50,50,50,50,50,50,0,0,0,0,0,0,0,0],
N:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,5,5,0,-20,-40,-30,5,10,15,15,10,5,-30,-30,0,15,20,20,15,0,-30,-30,5,15,20,20,15,5,-30,-30,0,10,15,15,10,0,-30,-40,-20,0,0,0,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
B:[-20,-10,-10,-10,-10,-10,-10,-20,-10,5,0,0,0,0,5,-10,-10,10,10,10,10,10,10,-10,-10,0,10,10,10,10,0,-10,-10,5,5,10,10,5,5,-10,-10,0,5,10,10,5,0,-10,-10,0,0,0,0,0,0,-10,-20,-10,-10,-10,-10,-10,-10,-20],
R:[0,0,0,5,5,0,0,0,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,5,10,10,10,10,10,10,5,0,0,0,0,0,0,0,0],
Q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
K:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]
};
const MATE=1000000;

let PIECE_SET = localStorage.getItem("karim_piece_set") || (ui.pset?ui.pset.value:"cburnett");
if(ui.pset) ui.pset.value = PIECE_SET;

let IMG=new Map();
const piecePath=(set,code)=>`assets/pieces/${set}/${code}.svg`;

function loadImages(set){
  IMG=new Map();
  return new Promise(res=>{
    let left=TYPES.length;
    TYPES.forEach(t=>{
      const im=new Image();
      im.onload=()=>{ if(--left===0) res(true); };
      im.onerror=()=>{ if(--left===0) res(true); };
      im.src=piecePath(set,t);
      IMG.set(t,im);
    });
  });
}
function beep(f=420,ms=55,v=0.05){
  try{
    const ac=beep.ac||(beep.ac=new (window.AudioContext||window.webkitAudioContext)());
    const o=ac.createOscillator(),g=ac.createGain();
    o.type="sine";o.frequency.value=f;g.gain.value=v;
    o.connect(g);g.connect(ac.destination);o.start();setTimeout(()=>o.stop(),ms);
  }catch{}
}

const idx=(r,c)=>r*8+c, inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8, other=s=>s==="w"?"b":"w";
const sqName=(r,c)=>"abcdefgh"[c]+String(8-r);
const fromSq=s=>({c:"abcdefgh".indexOf(s[0]),r:8-parseInt(s[1],10)});

function parseFEN(fen){
  const [b,t,cs,ep,half,full]=fen.split(" ");
  const a=Array(64).fill(null);
  let r=0,c=0;
  for(const ch of b){
    if(ch==="/"){r++;c=0;continue;}
    if(ch>="1"&&ch<="8"){c+=+ch;continue;}
    const side=(ch===ch.toUpperCase())?"w":"b";
    a[idx(r,c)]=side+ch.toUpperCase(); c++;
  }
  return {a,turn:t,cast:{K:cs.includes("K"),Q:cs.includes("Q"),k:cs.includes("k"),q:cs.includes("q")},ep:ep==="-"?null:ep,half:+half,full:+full};
}
const cloneS=s=>({a:s.a.slice(),turn:s.turn,cast:{...s.cast},ep:s.ep,half:s.half,full:s.full});

function findKing(st,side){
  for(let i=0;i<64;i++) if(st.a[i]===side+"K") return {r:(i/8)|0,c:i%8};
  return null;
}
function isAttacked(st,r,c,by){
  const dir=(by==="w")?-1:1;
  for(const dc of [-1,1]){
    const rr=r+dir,cc=c+dc;
    if(inside(rr,cc)&&st.a[idx(rr,cc)]===by+"P") return true;
  }
  const KN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for(const [dr,dc] of KN){
    const rr=r+dr,cc=c+dc;
    if(inside(rr,cc)&&st.a[idx(rr,cc)]===by+"N") return true;
  }
  const DI=[[-1,-1],[-1,1],[1,-1],[1,1]];
  for(const [dr,dc] of DI){
    let rr=r+dr,cc=c+dc;
    while(inside(rr,cc)){
      const v=st.a[idx(rr,cc)];
      if(v){ if(v[0]===by&&(v[1]==="B"||v[1]==="Q")) return true; break; }
      rr+=dr;cc+=dc;
    }
  }
  const OR=[[-1,0],[1,0],[0,-1],[0,1]];
  for(const [dr,dc] of OR){
    let rr=r+dr,cc=c+dc;
    while(inside(rr,cc)){
      const v=st.a[idx(rr,cc)];
      if(v){ if(v[0]===by&&(v[1]==="R"||v[1]==="Q")) return true; break; }
      rr+=dr;cc+=dc;
    }
  }
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    const rr=r+dr,cc=c+dc;
    if(inside(rr,cc)&&st.a[idx(rr,cc)]===by+"K") return true;
  }
  return false;
}
function inCheck(st,side){
  const k=findKing(st,side); if(!k) return false;
  return isAttacked(st,k.r,k.c,other(side));
}

function makeMove(st,m,silent=false){
  const side=st.turn,opp=other(side);
  const fr=(m.from/8)|0,fc=m.from%8,tr=(m.to/8)|0,tc=m.to%8;
  const piece=st.a[m.from];
  let cap=null;

  st.ep=null;
  st.half++;
  if(piece[1]==="P"||m.cap||m.flags==="e") st.half=0;

  if(m.flags==="e"){
    const capR=tr+((side==="w")?1:-1);
    cap=st.a[idx(capR,tc)];
    st.a[idx(capR,tc)]=null;
  }else{
    cap=st.a[m.to];
  }

  st.a[m.to]=piece; st.a[m.from]=null;
  if(m.promo) st.a[m.to]=side+m.promo;

  if(m.flags==="ck"){
    if(side==="w"){ st.a[idx(7,5)]="wR"; st.a[idx(7,7)]=null; }
    else{ st.a[idx(0,5)]="bR"; st.a[idx(0,7)]=null; }
  }
  if(m.flags==="cq"){
    if(side==="w"){ st.a[idx(7,3)]="wR"; st.a[idx(7,0)]=null; }
    else{ st.a[idx(0,3)]="bR"; st.a[idx(0,0)]=null; }
  }

  if(piece===side+"K"){ if(side==="w"){st.cast.K=false;st.cast.Q=false;} else{st.cast.k=false;st.cast.q=false;} }
  if(piece===side+"R"){
    if(side==="w"&&fr===7&&fc===0) st.cast.Q=false;
    if(side==="w"&&fr===7&&fc===7) st.cast.K=false;
    if(side==="b"&&fr===0&&fc===0) st.cast.q=false;
    if(side==="b"&&fr===0&&fc===7) st.cast.k=false;
  }
  if(cap==="wR"){ if(tr===7&&tc===0) st.cast.Q=false; if(tr===7&&tc===7) st.cast.K=false; }
  if(cap==="bR"){ if(tr===0&&tc===0) st.cast.q=false; if(tr===0&&tc===7) st.cast.k=false; }

  if(piece[1]==="P"&&m.flags==="d"){
    const epR=fr+((side==="w")?-1:1);
    st.ep=sqName(epR,fc);
  }

  if(side==="b") st.full++;
  st.turn=opp;

  if(!silent){
    if(cap||m.flags==="e") beep(220,70,0.06);
    else beep(420,55,0.05);
  }
  return cap;
}

function genMoves(st,onlyCaps=false){
  const side=st.turn,opp=other(side);
  const out=[];
  const dir=(side==="w")?-1:1;
  const push=(from,to,promo=null,flags="",cap=null)=>{
    if(onlyCaps && !(cap||flags==="e"||promo)) return;
    out.push({from,to,promo,flags,cap});
  };

  for(let i=0;i<64;i++){
    const v=st.a[i]; if(!v||v[0]!==side) continue;
    const r=(i/8)|0,c=i%8,p=v[1];

    if(p==="P"){
      const r1=r+dir;
      if(!onlyCaps && inside(r1,c) && !st.a[idx(r1,c)]){
        if((side==="w"&&r1===0)||(side==="b"&&r1===7)){
          for(const pr of ["Q","R","B","N"]) push(i,idx(r1,c),pr,"p",null);
        }else push(i,idx(r1,c));
        const start=(side==="w")?6:1, r2=r+dir*2;
        if(r===start && !st.a[idx(r2,c)]) push(i,idx(r2,c),null,"d",null);
      }
      for(const dc of [-1,1]){
        const cc=c+dc;
        if(!inside(r1,cc)) continue;
        const t=st.a[idx(r1,cc)];
        if(t&&t[0]===opp){
          if((side==="w"&&r1===0)||(side==="b"&&r1===7)){
            for(const pr of ["Q","R","B","N"]) push(i,idx(r1,cc),pr,"cp",t);
          }else push(i,idx(r1,cc),null,"c",t);
        }
      }
      if(st.ep){
        const ep=fromSq(st.ep);
        if(ep.r===r1 && Math.abs(ep.c-c)===1){
          push(i,idx(ep.r,ep.c),null,"e",opp+"P");
        }
      }
    }

    if(p==="N"){
      const KN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for(const [dr,dc] of KN){
        const rr=r+dr,cc=c+dc;
        if(!inside(rr,cc)) continue;
        const t=st.a[idx(rr,cc)];
        if(!t||t[0]!==side) push(i,idx(rr,cc),null,t?"c":"",t||null);
      }
    }

    if(p==="B"||p==="R"||p==="Q"){
      const dirs=[];
      if(p!=="R") dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
      if(p!=="B") dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      for(const [dr,dc] of dirs){
        let rr=r+dr,cc=c+dc;
        while(inside(rr,cc)){
          const t=st.a[idx(rr,cc)];
          if(!t){ if(!onlyCaps) push(i,idx(rr,cc)); }
          else{ if(t[0]!==side) push(i,idx(rr,cc),null,"c",t); break; }
          rr+=dr;cc+=dc;
        }
      }
    }

    if(p==="K"){
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc)continue;
        const rr=r+dr,cc=c+dc;
        if(!inside(rr,cc)) continue;
        const t=st.a[idx(rr,cc)];
        if(!t||t[0]!==side) push(i,idx(rr,cc),null,t?"c":"",t||null);
      }
      if(!onlyCaps && !inCheck(st,side)){
        if(side==="w"){
          if(st.cast.K && !st.a[idx(7,5)]&&!st.a[idx(7,6)] && !isAttacked(st,7,5,"b") && !isAttacked(st,7,6,"b"))
            push(i,idx(7,6),null,"ck",null);
          if(st.cast.Q && !st.a[idx(7,1)]&&!st.a[idx(7,2)]&&!st.a[idx(7,3)] && !isAttacked(st,7,2,"b") && !isAttacked(st,7,3,"b"))
            push(i,idx(7,2),null,"cq",null);
        }else{
          if(st.cast.k && !st.a[idx(0,5)]&&!st.a[idx(0,6)] && !isAttacked(st,0,5,"w") && !isAttacked(st,0,6,"w"))
            push(i,idx(0,6),null,"ck",null);
          if(st.cast.q && !st.a[idx(0,1)]&&!st.a[idx(0,2)]&&!st.a[idx(0,3)] && !isAttacked(st,0,2,"w") && !isAttacked(st,0,3,"w"))
            push(i,idx(0,2),null,"cq",null);
        }
      }
    }
  }

  // legal filter
  const legal=[];
  for(const m of out){
    const ns=cloneS(st);
    makeMove(ns,m,true);
    const mover=other(ns.turn);
    if(!inCheck(ns,mover)) legal.push(m);
  }
  return legal;
}

function evalPos(st){
  let s=0;
  for(let i=0;i<64;i++){
    const v=st.a[i]; if(!v) continue;
    const side=v[0], p=v[1];
    const base=V[p];
    const pst = PST[p] ? PST[p][side==="w"?i:(63-i)] : 0;
    const val=base+pst;
    s += (side==="w") ? val : -val;
  }
  // small check pressure
  if(inCheck(st,"w")) s -= 20;
  if(inCheck(st,"b")) s += 20;
  return s;
}

// ---------- Zobrist + TT ----------
function rnd32(){ return (Math.random()*0x100000000)>>>0; }
const Z = {
  psq: {}, side:rnd32(),
  cast: {K:rnd32(),Q:rnd32(),k:rnd32(),q:rnd32()},
  ep: Array.from({length:8},()=>rnd32())
};
TYPES.forEach(t=>Z.psq[t]=Array.from({length:64},rnd32));

function hashState(st){
  let h=0;
  for(let i=0;i<64;i++){ const v=st.a[i]; if(v) h ^= Z.psq[v][i]; }
  if(st.turn==="b") h ^= Z.side;
  if(st.cast.K) h ^= Z.cast.K;
  if(st.cast.Q) h ^= Z.cast.Q;
  if(st.cast.k) h ^= Z.cast.k;
  if(st.cast.q) h ^= Z.cast.q;
  if(st.ep) h ^= Z.ep[fromSq(st.ep).c];
  return h>>>0;
}
const TT=new Map(); // key -> {d,flag,score,move}
const TT_MAX=250000;
function ttGet(k){ return TT.get(k); }
function ttPut(k,v){
  if(TT.size>TT_MAX){ TT.clear(); }
  TT.set(k,v);
}

function orderMoves(moves, pv){
  // PV first, then captures/promos (MVV), then others
  const scoreM=m=>{
    let s=0;
    if(pv && m.from===pv.from && m.to===pv.to && m.promo===pv.promo) s+=1e9;
    if(m.promo) s+=5e7;
    if(m.cap) s+=2e7 + V[m.cap[1]];
    if(m.flags==="e") s+=2e7+100;
    return s;
  };
  return moves.slice().sort((a,b)=>scoreM(b)-scoreM(a));
}

// Quiescence: only tactical moves at leaf
function quies(st, alpha, beta){
  let stand=evalPos(st);
  if(stand>=beta) return beta;
  if(stand>alpha) alpha=stand;

  const moves=genMoves(st,true); // captures/promos/ep only
  for(const m of orderMoves(moves,null)){
    const ns=cloneS(st);
    makeMove(ns,m,true);
    const sc = -quies(ns, -beta, -alpha);
    if(sc>=beta) return beta;
    if(sc>alpha) alpha=sc;
  }
  return alpha;
}

function alphabeta(st, depth, alpha, beta, ply, endTime){
  if(performance.now()>endTime) return null;

  const key=hashState(st);
  const tt=ttGet(key);
  if(tt && tt.d>=depth){
    if(tt.flag===0) return tt.score;
    if(tt.flag===1 && tt.score<=alpha) return alpha;
    if(tt.flag===2 && tt.score>=beta) return beta;
  }

  const moves=genMoves(st,false);
  if(depth===0){
    const q=quies(st,alpha,beta);
    return q;
  }

  if(moves.length===0){
    if(inCheck(st, st.turn)){
      // mate: side to move is mated
      return - (MATE - ply);
    }
    return 0; // stalemate
  }

  let bestMove=null;
  const pv = tt ? tt.move : null;
  const ordered=orderMoves(moves,pv);

  let a0=alpha;
  for(const m of ordered){
    const ns=cloneS(st);
    makeMove(ns,m,true);
    const sc = alphabeta(ns, depth-1, -beta, -alpha, ply+1, endTime);
    if(sc===null) return null;
    const score = -sc;

    if(score>alpha){
      alpha=score;
      bestMove=m;
      if(alpha>=beta) break;
    }
  }

  let flag=0;
  if(alpha<=a0) flag=1; else if(alpha>=beta) flag=2;
  ttPut(key,{d:depth,flag,score:alpha,move:bestMove});
  return alpha;
}

function searchBest(st, msBudget){
  const endTime=performance.now()+msBudget;
  let best=null, bestScore=0;

  for(let depth=1; depth<=8; depth++){
    const sc=alphabeta(st,depth,-MATE,MATE,0,endTime);
    if(sc===null) break;
    const tt=ttGet(hashState(st));
    if(tt && tt.move){ best=tt.move; bestScore=sc; }
  }
  return {m:best, score:bestScore};
}

// ---------- Draw rules ----------
function insufficient(st){
  // count pieces
  let w=[], b=[];
  for(const v of st.a){
    if(!v) continue;
    (v[0]==="w"?w:b).push(v[1]);
  }
  const only=(arr, allowed)=>{
    for(const p of arr){ if(p!=="K" && !allowed.includes(p)) return false; }
    return true;
  };
  // K vs K
  if(w.length===1 && b.length===1) return true;
  // K+minor vs K
  if(only(w,["N","B"]) && b.length===1) return (w.length<=2);
  if(only(b,["N","B"]) && w.length===1) return (b.length<=2);
  return false;
}

// ---------- UI / Render ----------
let S=parseFEN(START);
let flipped=false, selected=null, selMoves=[];
let history=[];         // stack {st,capW,capB,hash,half}
let rep=new Map();      // hash -> count
let lastMove=null;
let captured={w:[],b:[]};
let botBusy=false;
let ended=false;

function ensureOverlay(){
  if(document.getElementById("resultOverlay")) return;
  const style=document.createElement("style");
  style.textContent=`
  #resultOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.55);z-index:99999}
  #resultOverlay .box{min-width:320px;max-width:520px;padding:18px;border-radius:18px;
    background:rgba(10,14,28,.92);border:1px solid rgba(255,255,255,.18);
    box-shadow:0 18px 60px rgba(0,0,0,.5);color:#fff}
  #resultOverlay .t{font-weight:1000;font-size:20px;margin:0 0 8px}
  #resultOverlay .d{color:rgba(255,255,255,.75);margin:0 0 14px;line-height:1.6}
  #resultOverlay .row{display:flex;gap:10px;justify-content:flex-end}
  #resultOverlay .btn{padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);
    background:rgba(255,255,255,.08);color:#fff;font-weight:950;cursor:pointer}
  `;
  document.head.appendChild(style);

  const ov=document.createElement("div");
  ov.id="resultOverlay";
  ov.style.display="none";
  ov.innerHTML=`
    <div class="box">
      <div class="t" id="rt"></div>
      <div class="d" id="rd"></div>
      <div class="row">
        <button class="btn" id="rNew">New</button>
        <button class="btn" id="rClose">Close</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  $("#rNew").onclick=()=>{ hideResult(); resetGame(); };
  $("#rClose").onclick=()=>hideResult();
}
function showResult(title,detail){
  ensureOverlay();
  ended=true;
  $("#rt").textContent=title;
  $("#rd").textContent=detail||"";
  $("#resultOverlay").style.display="flex";
}
function hideResult(){
  const ov=$("#resultOverlay");
  if(ov) ov.style.display="none";
}

function pushHist(){
  const h=hashState(S);
  history.push({st:cloneS(S),capW:captured.w.slice(),capB:captured.b.slice(),hash:h});
  rep.set(h,(rep.get(h)||0)+1);
}
function popHist(){
  const h=history.pop(); if(!h) return;
  // remove current hash count
  const cur=hashState(S);
  rep.set(cur,Math.max(0,(rep.get(cur)||1)-1));

  S=cloneS(h.st);
  captured.w=h.capW.slice();
  captured.b=h.capB.slice();
  lastMove=null;
  selected=null; selMoves=[];
  ended=false; hideResult();
  updateHUD(); draw();
}
function resetGame(){
  S=parseFEN(START);
  flipped=false; selected=null; selMoves=[]; history=[];
  rep=new Map(); captured={w:[],b:[]}; lastMove=null;
  botBusy=false; ended=false; hideResult();
  updateHUD(); draw(); maybeBot();
}

function updateHUD(){
  ui.turn.textContent=(S.turn==="w")?"White":"Black";
  const ev=evalPos(S)/100.0;
  ui.eval.textContent=(ev>=0?"+":"")+ev.toFixed(2);
  ui.sub.textContent = (ui.mode.value==="bot")
    ? ((S.turn==="b")?"Bot thinking...":"Your turn")
    : "2 Players";

  ui.wLost.innerHTML=""; ui.bLost.innerHTML="";
  for(const p of captured.w){
    const im=document.createElement("img");
    im.src=piecePath(PIECE_SET,"w"+p); ui.wLost.appendChild(im);
  }
  for(const p of captured.b){
    const im=document.createElement("img");
    im.src=piecePath(PIECE_SET,"b"+p); ui.bLost.appendChild(im);
  }
}

function applyMove(m){
  pushHist();
  const cap=makeMove(S,m,false);
  if(cap){
    const side=cap[0]; // captured side
    captured[side].push(cap[1]);
  } else if(m.flags==="e"){
    captured[other(S.turn)].push("P");
  }
  lastMove={from:m.from,to:m.to};
  selected=null; selMoves=[];
  updateHUD(); draw();
  checkResult();
  maybeBot();
}

function checkResult(){
  // mate/stalemate
  const moves=genMoves(S,false);
  if(moves.length===0){
    if(inCheck(S,S.turn)){
      const winner = (S.turn==="w") ? "Black" : "White";
      showResult("Checkmate", `${winner} wins`);
      beep(160,140,0.08);
    }else{
      showResult("Draw", "Stalemate");
      beep(260,120,0.07);
    }
    return;
  }
  // 50 move
  if(S.half>=100){
    showResult("Draw","50-move rule");
    return;
  }
  // 3-fold repetition (count current position hash)
  const h=hashState(S);
  const cnt=rep.get(h)||0;
  if(cnt>=3){
    showResult("Draw","Threefold repetition");
    return;
  }
  // insufficient
  if(insufficient(S)){
    showResult("Draw","Insufficient material");
    return;
  }
}

function botDelay(l){ return l==="easy"?700:l==="normal"?900:1100; }
function botBudget(l){ return l==="easy"?250:l==="normal"?700:1600; }

function maybeBot(){
  if(ended) return;
  if(ui.mode.value!=="bot") return;
  if(S.turn!=="b") return; // bot black
  if(botBusy) return;

  botBusy=true;
  ui.sub.textContent="Bot thinking...";
  const lvl=ui.lvl.value;
  setTimeout(()=>{
    const st=cloneS(S);
    const {m,score}=searchBest(st,botBudget(lvl));
    if(m && !ended){
      ui.eval.textContent=((score/100)>=0?"+":"")+(score/100).toFixed(2);
      applyMove(m);
    }
    botBusy=false;
  }, botDelay(lvl));
}

// ---------- Canvas sizing (no ghosting) ----------
function resize(){
  const box=cv.parentElement.getBoundingClientRect();
  const cssSize=Math.floor(Math.min(box.width,box.height));
  const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  cv.style.width=cssSize+"px"; cv.style.height=cssSize+"px";
  cv.width=Math.floor(cssSize*dpr); cv.height=Math.floor(cssSize*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
new ResizeObserver(resize).observe(cv.parentElement);
window.addEventListener("resize",resize);

function boardXY(r,c,sq){ if(flipped){r=7-r;c=7-c;} return {x:c*sq,y:r*sq}; }
function screenRC(x,y,sq){ let c=(x/sq)|0, r=(y/sq)|0; if(flipped){r=7-r;c=7-c;} return {r,c}; }

function drawPiece(code,x,y,sq){
  const im=IMG.get(code);
  const pad=sq*0.08, w=sq-pad*2;
  if(im && im.complete && im.naturalWidth) ctx.drawImage(im,x+pad,y+pad,w,w);
  else{
    ctx.fillStyle=code[0]==="w"?"rgba(245,248,255,.9)":"rgba(10,14,22,.9)";
    ctx.beginPath();ctx.arc(x+sq/2,y+sq/2,sq*0.30,0,Math.PI*2);ctx.fill();
  }
}

function draw(){
  const rect=cv.getBoundingClientRect();
  const size=rect.width, sq=size/8;
  ctx.clearRect(0,0,size,size);

  const light="rgba(235,240,255,.12)", dark="rgba(120,170,140,.14)";
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    ctx.fillStyle=((r+c)&1)?dark:light;
    const p=boardXY(r,c,sq);
    ctx.fillRect(p.x,p.y,sq,sq);
  }

  if(lastMove){
    ctx.fillStyle="rgba(255,255,255,.10)";
    const fr=(lastMove.from/8)|0,fc=lastMove.from%8,tr=(lastMove.to/8)|0,tc=lastMove.to%8;
    let a=boardXY(fr,fc,sq), b=boardXY(tr,tc,sq);
    ctx.fillRect(a.x,a.y,sq,sq); ctx.fillRect(b.x,b.y,sq,sq);
  }

  if(selected!=null){
    ctx.fillStyle="rgba(120,180,255,.20)";
    const r=(selected/8)|0,c=selected%8;
    const p=boardXY(r,c,sq);
    ctx.fillRect(p.x,p.y,sq,sq);

    ctx.fillStyle="rgba(255,255,255,.25)";
    for(const m of selMoves){
      const rr=(m.to/8)|0,cc=m.to%8;
      const q=boardXY(rr,cc,sq);
      ctx.beginPath(); ctx.arc(q.x+sq/2,q.y+sq/2,sq*0.12,0,Math.PI*2); ctx.fill();
    }
  }

  for(let i=0;i<64;i++){
    const v=S.a[i]; if(!v) continue;
    const r=(i/8)|0,c=i%8;
    const p=boardXY(r,c,sq);
    drawPiece(v,p.x,p.y,sq);
  }

  ctx.strokeStyle="rgba(255,255,255,.14)";
  ctx.lineWidth=2;
  ctx.strokeRect(1,1,size-2,size-2);
}

// input
cv.addEventListener("pointerdown",(e)=>{
  if(ended) return;
  if(ui.mode.value==="bot" && S.turn==="b") return;
  if(botBusy) return;

  const rect=cv.getBoundingClientRect();
  const size=rect.width, sq=size/8;
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  const {r,c}=screenRC(x,y,sq);
  if(!inside(r,c)) return;
  const i=idx(r,c);
  const v=S.a[i];

  if(selected==null){
    if(v && v[0]===S.turn){
      selected=i;
      selMoves=genMoves(S,false).filter(m=>m.from===i);
      draw();
    }
    return;
  }

  const mv=selMoves.find(m=>m.to===i);
  if(mv){ applyMove(mv); return; }

  if(v && v[0]===S.turn){
    selected=i;
    selMoves=genMoves(S,false).filter(m=>m.from===i);
  }else{
    selected=null; selMoves=[];
  }
  draw();
});

// controls
ui.flip.onclick=()=>{ flipped=!flipped; draw(); };
ui.undo.onclick=()=>{
  if(ui.mode.value==="bot"){ popHist(); popHist(); }
  else popHist();
};
ui.neu.onclick=()=>resetGame();
ui.mode.onchange=()=>{ botBusy=false; ended=false; hideResult(); updateHUD(); maybeBot(); };
ui.lvl.onchange=()=>updateHUD();
if(ui.pset){
  ui.pset.onchange=async ()=>{
    PIECE_SET=ui.pset.value;
    localStorage.setItem("karim_piece_set",PIECE_SET);
    await loadImages(PIECE_SET);
    updateHUD(); draw();
  };
}

// boot
(async function(){
  await loadImages(PIECE_SET);
  resetGame();
  resize();
})();
