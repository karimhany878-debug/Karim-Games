/*
  Chess Puzzles V2 (chess.com-like UX):
  - Wrong move: "Incorrect, try again" (no auto-solution, no auto-arrow)
  - Hint levels: Motif -> highlight piece -> arrow (optional)
  - Show Move: plays ONLY next move (counts as assist)
  - Stars + streak saved in localStorage
  - Rush mode: 3 strikes and you're out (optional)  (concept inspired by puzzle rush rules)
*/

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d", { alpha:true });

const ui = {
  btnBack: document.getElementById("btnBack"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnRetry: document.getElementById("btnRetry"),
  btnHint: document.getElementById("btnHint"),
  btnShow: document.getElementById("btnShow"),
  btnResetStats: document.getElementById("btnResetStats"),

  mode: document.getElementById("mode"),
  btnSound: document.getElementById("btnSound"),
  vol: document.getElementById("vol"),

  sub: document.getElementById("sub"),
  pTitle: document.getElementById("pTitle"),
  pMeta: document.getElementById("pMeta"),
  motif: document.getElementById("motif"),

  streak: document.getElementById("streak"),
  best: document.getElementById("best"),
  mist: document.getElementById("mist"),
  hints: document.getElementById("hints"),
  livesBox: document.getElementById("livesBox"),
  lives: document.getElementById("lives"),

  toast: document.getElementById("toast"),

  modal: document.getElementById("modal"),
  mTitle: document.getElementById("mTitle"),
  mBody: document.getElementById("mBody"),
  mNext: document.getElementById("mNext"),
  mClose: document.getElementById("mClose"),

  boardWrap: document.querySelector(".boardWrap"),
};

let DPR=1, W=0, H=0, SQ=0, offX=0, offY=0;
function resize(){
  DPR=Math.max(1, Math.min(2, window.devicePixelRatio||1));
  W=Math.floor(canvas.clientWidth*DPR);
  H=Math.floor(canvas.clientHeight*DPR);
  canvas.width=W; canvas.height=H;

  const pad=Math.floor(18*DPR);
  const size=Math.min(W-2*pad, H-2*pad);
  SQ=Math.floor(size/8);
  offX=Math.floor((W - SQ*8)/2);
  offY=Math.floor((H - SQ*8)/2);
}
window.addEventListener("resize", resize);

function fileOf(i){return i&7}
function rankOf(i){return i>>3}
function idx(f,r){return r*8+f}
function inBoard(f,r){return f>=0&&f<8&&r>=0&&r<8}
function enemy(c){return c==="w"?"b":"w"}
function colorOf(p){return p?p[0]:null}
function typeOf(p){return p?p[1]:null}
function alg(i){ return "abcdefgh"[fileOf(i)] + String(rankOf(i)+1); }
function fromAlg(s){ const f="abcdefgh".indexOf(s[0]); const r=parseInt(s[1],10)-1; return idx(f,r); }

// ---------- Sound
let audioOn=true, audioCtx=null;
function initAudio(){ if(!audioOn) return; if(audioCtx) return; audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }
function tone(freq,dur,type="sine",gain=1){
  if(!audioOn) return; initAudio(); if(!audioCtx) return;
  const v=parseFloat(ui.vol?.value||"0.35")*gain;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.value=freq*(1+(Math.random()-0.5)*0.02);
  g.gain.value=0.0001; o.connect(g); g.connect(audioCtx.destination);
  const t0=audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002,v), t0+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.start(t0); o.stop(t0+dur+0.03);
}
const sfx={
  pick(){tone(520,0.06,"triangle")},
  ok(){tone(360,0.06,"sine")},
  bad(){tone(160,0.09,"square")},
  win(){tone(520,0.11,"sine"); setTimeout(()=>tone(780,0.11,"sine",0.85),120)},
};

// ---------- Toast
let toastTimer=null;
function toast(msg, kind="good", ms=900){
  ui.toast.textContent=msg;
  ui.toast.classList.remove("hidden","good","bad");
  ui.toast.classList.add(kind);
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>ui.toast.classList.add("hidden"), ms);
}

// ---------- Modal
function showModal(title, bodyHtml){
  ui.mTitle.textContent=title;
  ui.mBody.innerHTML=bodyHtml;
  ui.modal.classList.remove("hidden");
}
function hideModal(){ ui.modal.classList.add("hidden"); }

// ---------- Stats
const STAT_KEY="karim_puzzle_stats_v2";
function loadStats(){
  try{
    const s=JSON.parse(localStorage.getItem(STAT_KEY)||"{}");
    return { streak:s.streak||0, best:s.best||0, solved:s.solved||0 };
  }catch{ return {streak:0,best:0,solved:0}; }
}
function saveStats(s){ localStorage.setItem(STAT_KEY, JSON.stringify(s)); }
let ST=loadStats();

function renderStats(){
  ui.streak.textContent=String(ST.streak);
  ui.best.textContent=String(ST.best);
  ui.mist.textContent=String(mistakes);
  ui.hints.textContent=String(hintsUsed + (showUsed?1:0));
  ui.livesBox.style.display = (mode==="rush") ? "block" : "none";
  ui.lives.textContent=String(lives);
}

// ---------- Puzzle Set (add more here)
const PUZZLES = [
  {id:101, rating:900,  title:"Mate in 1", motif:"Checkmate", fen:"6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1", line:["f3a8"]},
  {id:102, rating:1100, title:"Fork", motif:"Knight Fork", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", line:["g8f6","f3e5"]},
  {id:103, rating:1200, title:"Win Queen", motif:"Tactical Shot", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 3", line:["c4f7","e8f7","f3e5"]},
  {id:104, rating:1000, title:"Mate Net", motif:"Back Rank", fen:"5rk1/6pp/8/8/8/6Q1/5PPP/6K1 w - - 0 1", line:["g3b8"]},
  {id:105, rating:1300, title:"Skewer", motif:"Skewer", fen:"r2q1rk1/ppp2ppp/2n5/3bp3/3P4/2P2N2/PP3PPP/R1BQ1RK1 w - - 0 10", line:["d1b3","d5c4","b3c4"]},
];

let pIndex=0;
let mode="classic";

// game state
function parseFEN(fen){
  const [placement, turn, castling, ep] = fen.split(" ");
  const board=Array(64).fill(null);
  const ranks=placement.split("/");
  for(let r=0;r<8;r++){
    let f=0;
    for(const ch of ranks[7-r]){
      if(ch>="1" && ch<="8"){ f += parseInt(ch,10); continue; }
      const col=(ch===ch.toUpperCase())?"w":"b";
      const t=ch.toUpperCase();
      board[idx(f,r)] = col+t;
      f++;
    }
  }
  const rights={K:false,Q:false,k:false,q:false};
  if(castling && castling!=="-") for(const c of castling) if(rights[c]!=null) rights[c]=true;
  const epSq=(ep && ep!=="-") ? fromAlg(ep) : -1;
  return {board, turn, castling:rights, ep:epSq, history:[]};
}

function cloneS(S){ return {board:S.board.slice(), turn:S.turn, castling:{...S.castling}, ep:S.ep, history:[]}; }

function kingSquare(S,color){
  for(let i=0;i<64;i++) if(S.board[i]===color+"K") return i;
  return -1;
}
function isSquareAttacked(S, sq, by){
  const b=S.board, f=fileOf(sq), r=rankOf(sq);

  if(by==="w"){
    const a1=(f>0&&r>0)?sq-9:-1, a2=(f<7&&r>0)?sq-7:-1;
    if(a1>=0 && b[a1]==="wP") return true;
    if(a2>=0 && b[a2]==="wP") return true;
  }else{
    const a1=(f>0&&r<7)?sq+7:-1, a2=(f<7&&r<7)?sq+9:-1;
    if(a1>=0 && b[a1]==="bP") return true;
    if(a2>=0 && b[a2]==="bP") return true;
  }

  const KN=[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
  for(const [df,dr] of KN){
    const nf=f+df,nr=r+dr; if(!inBoard(nf,nr)) continue;
    if(b[idx(nf,nr)]===by+"N") return true;
  }

  const DI=[[1,1],[1,-1],[-1,1],[-1,-1]];
  for(const [df,dr] of DI){
    let nf=f+df,nr=r+dr;
    while(inBoard(nf,nr)){
      const p=b[idx(nf,nr)];
      if(p){ if(p===by+"B"||p===by+"Q") return true; break; }
      nf+=df; nr+=dr;
    }
  }

  const OR=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const [df,dr] of OR){
    let nf=f+df,nr=r+dr;
    while(inBoard(nf,nr)){
      const p=b[idx(nf,nr)];
      if(p){ if(p===by+"R"||p===by+"Q") return true; break; }
      nf+=df; nr+=dr;
    }
  }

  for(let df=-1;df<=1;df++)for(let dr=-1;dr<=1;dr++){
    if(!df&&!dr) continue;
    const nf=f+df,nr=r+dr; if(!inBoard(nf,nr)) continue;
    if(b[idx(nf,nr)]===by+"K") return true;
  }
  return false;
}
function inCheck(S,color){
  const k=kingSquare(S,color); if(k<0) return false;
  return isSquareAttacked(S,k,enemy(color));
}

function genPseudo(S, from){
  const b=S.board; const p=b[from]; if(!p) return [];
  const c=colorOf(p), t=typeOf(p);
  const f=fileOf(from), r=rankOf(from);
  const out=[]; const add=(to,extra={})=>out.push({from,to,piece:p,capture:b[to],...extra});

  if(t==="P"){
    const dir=(c==="w")?1:-1, start=(c==="w")?1:6, prom=(c==="w")?7:0;
    const oneR=r+dir;
    if(inBoard(f,oneR)){
      const one=idx(f,oneR);
      if(!b[one]){
        if(oneR===prom) add(one,{promo:true}); else add(one);
        if(r===start){
          const two=idx(f,r+2*dir); if(!b[two]) add(two,{dbl:true});
        }
      }
    }
    for(const df of [-1,1]){
      const nf=f+df,nr=r+dir; if(!inBoard(nf,nr)) continue;
      const to=idx(nf,nr);
      const cap=b[to];
      if(cap && colorOf(cap)!==c){
        if(nr===prom) add(to,{promo:true}); else add(to);
      }
      if(S.ep===to){
        add(to,{ep:true,epCap:idx(nf,r)});
      }
    }
    return out;
  }

  if(t==="N"){
    const KN=[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
    for(const [df,dr] of KN){
      const nf=f+df,nr=r+dr; if(!inBoard(nf,nr)) continue;
      const to=idx(nf,nr);
      const cap=b[to];
      if(!cap || colorOf(cap)!==c) add(to);
    }
    return out;
  }

  if(t==="B"||t==="R"||t==="Q"){
    const dirs=[];
    if(t==="B"||t==="Q") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
    if(t==="R"||t==="Q") dirs.push([1,0],[-1,0],[0,1],[0,-1]);
    for(const [df,dr] of dirs){
      let nf=f+df,nr=r+dr;
      while(inBoard(nf,nr)){
        const to=idx(nf,nr), cap=b[to];
        if(!cap) add(to);
        else{ if(colorOf(cap)!==c) add(to); break; }
        nf+=df; nr+=dr;
      }
    }
    return out;
  }

  if(t==="K"){
    for(let df=-1;df<=1;df++)for(let dr=-1;dr<=1;dr++){
      if(!df&&!dr) continue;
      const nf=f+df,nr=r+dr; if(!inBoard(nf,nr)) continue;
      const to=idx(nf,nr);
      const cap=b[to];
      if(!cap || colorOf(cap)!==c) add(to);
    }
    return out;
  }

  return out;
}
function applyMove(S,m,promo="q"){
  const b=S.board;
  const undo={m,cap:b[m.to],ep:S.ep,cast:{...S.castling}};
  S.ep=-1;

  b[m.to]=b[m.from]; b[m.from]=null;
  if(m.ep){ b[m.epCap]=null; undo.epCap=m.epCap; }
  if(m.promo){ b[m.to]=S.turn + promo.toUpperCase(); }
  if(typeOf(m.piece)==="P" && m.dbl){
    const f=fileOf(m.from), r=rankOf(m.from);
    const epR=(S.turn==="w")?r+1:r-1;
    S.ep=idx(f,epR);
  }
  S.turn=enemy(S.turn);
  S.history.push(undo);
}
function genLegal(S,from){
  const p=S.board[from];
  if(!p || colorOf(p)!==S.turn) return [];
  const pseudo=genPseudo(S,from);
  const legal=[];
  for(const m of pseudo){
    const tmp=cloneS(S);
    applyMove(tmp,m,"q");
    const mover=enemy(tmp.turn);
    if(!inCheck(tmp,mover)) legal.push(m);
  }
  return legal;
}
function findMove(S,from,to){ return genLegal(S,from).find(m=>m.to===to) || null; }

// ---------- Rendering (pieces: clean silhouettes, no crosses)
function rr(x,y,w,h,r){
  const R=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+R,y);
  ctx.arcTo(x+w,y,x+w,y+h,R);
  ctx.arcTo(x+w,y+h,x,y+h,R);
  ctx.arcTo(x,y+h,x,y,R);
  ctx.arcTo(x,y,x+w,y,R);
  ctx.closePath();
}
function grad(col,cx,cy,r){
  const g=ctx.createRadialGradient(cx-r*0.30, cy-r*0.50, r*0.25, cx, cy, r*1.55);
  if(col==="w"){ g.addColorStop(0,"rgba(255,255,255,.98)"); g.addColorStop(1,"rgba(180,192,220,.95)"); }
  else{ g.addColorStop(0,"rgba(130,150,195,.92)"); g.addColorStop(1,"rgba(18,22,34,.98)"); }
  return g;
}
function stroke(col){ return col==="w" ? "rgba(30,40,60,.38)" : "rgba(255,255,255,.16)"; }
function base(cx,cy,col){
  const r=SQ*0.34, y=cy+r*0.62, w=r*1.75, h=r*0.50;
  ctx.save(); ctx.shadowColor="rgba(0,0,0,.48)"; ctx.shadowBlur=12*DPR;
  rr(cx-w/2,y-h/2,w,h,h*0.48); ctx.fillStyle=grad(col,cx,cy,r); ctx.fill(); ctx.restore();
  rr(cx-w/2,y-h/2,w,h,h*0.48); ctx.strokeStyle=stroke(col); ctx.lineWidth=2*DPR; ctx.stroke();
}
function pawn(cx,cy,col){
  const r=SQ*0.34;
  ctx.save(); ctx.shadowColor="rgba(0,0,0,.44)"; ctx.shadowBlur=12*DPR;
  ctx.beginPath(); ctx.arc(cx,cy-r*0.20,r*0.34,0,Math.PI*2); ctx.fillStyle=grad(col,cx,cy,r); ctx.fill();
  rr(cx-r*0.40,cy+r*0.02,r*0.80,r*0.88,r*0.22); ctx.fill(); ctx.restore();
  ctx.strokeStyle=stroke(col); ctx.lineWidth=2*DPR;
  ctx.beginPath(); ctx.arc(cx,cy-r*0.20,r*0.34,0,Math.PI*2); ctx.stroke();
  rr(cx-r*0.40,cy+r*0.02,r*0.80,r*0.88,r*0.22); ctx.stroke();
  base(cx,cy,col);
}
function rook(cx,cy,col){
  const r=SQ*0.34;
  ctx.save(); ctx.shadowColor="rgba(0,0,0,.46)"; ctx.shadowBlur=12*DPR;
  rr(cx-r*0.56,cy-r*0.20,r*1.12,r*0.98,r*0.16); ctx.fillStyle=grad(col,cx,cy,r); ctx.fill();
  const topY=cy-r*0.44;
  for(let i=-2;i<=2;i++){ rr(cx+i*r*0.20-r*0.075,topY,r*0.15,r*0.20,r*0.06); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle=stroke(col); ctx.lineWidth=2*DPR;
  rr(cx-r*0.56,cy-r*0.20,r*1.12,r*0.98,r*0.16); ctx.stroke();
  base(cx,cy,col);
}
function bishop(cx,cy,col){
  const r=SQ*0.34;
  ctx.save(); ctx.shadowColor="rgba(0,0,0,.46)"; ctx.shadowBlur=12*DPR;
  ctx.beginPath(); ctx.ellipse(cx,cy+r*0.06,r*0.52,r*0.74,0,0,Math.PI*2); ctx.fillStyle=grad(col,cx,cy,r); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx,cy-r*0.36,r*0.26,r*0.34,0,0,Math.PI*2); ctx.fill();
  // notch (no cross)
  ctx.globalAlpha=0.25; ctx.strokeStyle=(col==="w")?"rgba(20,24,34,.60)":"rgba(255,255,255,.45)"; ctx.lineWidth=3*DPR;
  ctx.beginPath(); ctx.moveTo(cx-r*0.18,cy-r*0.02); ctx.lineTo(cx+r*0.22,cy-r*0.34); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle=stroke(col); ctx.lineWidth=2*DPR;
  ctx.beginPath(); ctx.ellipse(cx,cy+r*0.06,r*0.52,r*0.74,0,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx,cy-r*0.36,r*0.26,r*0.34,0,0,Math.PI*2); ctx.stroke();
  base(cx,cy,col);
}
function knight(cx,cy,col){
  const r=SQ*0.34;
  ctx.save(); ctx.shadowColor="rgba(0,0,0,.50)"; ctx.shadowBlur=12*DPR;
  ctx.beginPath();
  ctx.moveTo(cx-r*0.58,cy+r*0.56);
  ctx.lineTo(cx-r*0.58,cy-r*0.05);
  ctx.quadraticCurveTo(cx-r*0.52,cy-r*0.62,cx-r*0.10,cy-r*0.62);
  ctx.quadraticCurveTo(cx+r*0.34,cy-r*0.54,cx+r*0.38,cy-r*0.16);
  ctx.quadraticCurveTo(cx+r*0.12,cy-r*0.10,cx+r*0.06,cy+r*0.12);
  ctx.quadraticCurveTo(cx,cy+r*0.36,cx+r*0.26,cy+r*0.56);
  ctx.closePath();
  ctx.fillStyle=grad(col,cx,cy,r); ctx.fill();
  ctx.restore();
  ctx.strokeStyle=stroke(col); ctx.lineWidth=2*DPR;
  ctx.beginPath();
  ctx.moveTo(cx-r*0.58,cy+r*0.56);
  ctx.lineTo(cx-r*0.58,cy-r*0.05);
  ctx.quadraticCurveTo(cx-r*0.52,cy-r*0.62,cx-r*0.10,cy-r*0.62);
  ctx.quadraticCurveTo(cx+r*0.34,cy-r*0.54,cx+r*0.38,cy-r*0.16);
  ctx.quadraticCurveTo(cx+r*0.12,cy-r*0.10,cx+r*0.06,cy+r*0.12);
  ctx.quadraticCurveTo(cx,cy+r*0.36,cx+r*0.26,cy+r*0.56);
  ctx.closePath();
  ctx.stroke();
  base(cx,cy,col);
}
function queen(cx,cy,col){
  const r=SQ*0.34;
  ctx.save(); ctx.shadowColor="rgba(0,0,0,.48)"; ctx.shadowBlur=12*DPR;
  ctx.beginPath();
  ctx.moveTo(cx-r*0.56,cy-r*0.10);
  ctx.lineTo(cx-r*0.38,cy-r*0.58);
  ctx.lineTo(cx-r*0.18,cy-r*0.22);
  ctx.lineTo(cx,cy-r*0.66);
  ctx.lineTo(cx+r*0.18,cy-r*0.22);
  ctx.lineTo(cx+r*0.38,cy-r*0.58);
  ctx.lineTo(cx+r*0.56,cy-r*0.10);
  ctx.closePath();
  ctx.fillStyle=grad(col,cx,cy,r); ctx.fill();
  rr(cx-r*0.56,cy-r*0.04,r*1.12,r*0.92,r*0.22); ctx.fill();
  ctx.restore();
  ctx.strokeStyle=stroke(col); ctx.lineWidth=2*DPR;
  rr(cx-r*0.56,cy-r*0.04,r*1.12,r*0.92,r*0.22); ctx.stroke();
  base(cx,cy,col);
}
function king(cx,cy,col){
  const r=SQ*0.34;
  ctx.save(); ctx.shadowColor="rgba(0,0,0,.52)"; ctx.shadowBlur=13*DPR;
  ctx.beginPath();
  ctx.moveTo(cx-r*0.62,cy-r*0.02);
  ctx.lineTo(cx-r*0.44,cy-r*0.62);
  ctx.lineTo(cx-r*0.20,cy-r*0.24);
  ctx.quadraticCurveTo(cx,cy-r*0.76,cx+r*0.20,cy-r*0.24);
  ctx.lineTo(cx+r*0.44,cy-r*0.62);
  ctx.lineTo(cx+r*0.62,cy-r*0.02);
  ctx.closePath();
  ctx.fillStyle=grad(col,cx,cy,r); ctx.fill();
  rr(cx-r*0.62,cy-r*0.00,r*1.24,r*1.02,r*0.24); ctx.fill();
  ctx.restore();
  ctx.strokeStyle=stroke(col); ctx.lineWidth=2*DPR;
  rr(cx-r*0.62,cy-r*0.00,r*1.24,r*1.02,r*0.24); ctx.stroke();
  base(cx,cy,col);
}
function drawPiece(p,cx,cy){
  const col=p[0], t=p[1];
  if(t==="P") pawn(cx,cy,col);
  else if(t==="R") rook(cx,cy,col);
  else if(t==="N") knight(cx,cy,col);
  else if(t==="B") bishop(cx,cy,col);
  else if(t==="Q") queen(cx,cy,col);
  else if(t==="K") king(cx,cy,col);
}

function boardToScreen(i){
  const f=fileOf(i), r=rankOf(i);
  return {x: offX + f*SQ, y: offY + (7-r)*SQ};
}
function screenToBoard(x,y){
  x-=offX; y-=offY;
  const df=Math.floor(x/SQ), dr=Math.floor(y/SQ);
  if(df<0||df>7||dr<0||dr>7) return -1;
  const f=df, r=7-dr;
  return idx(f,r);
}

// ---------- Arrow (for hint level 3)
function drawArrow(from,to, color="rgba(120,255,170,.55)"){
  const a=boardToScreen(from);
  const b=boardToScreen(to);
  const x1=a.x+SQ/2, y1=a.y+SQ/2;
  const x2=b.x+SQ/2, y2=b.y+SQ/2;

  const dx=x2-x1, dy=y2-y1;
  const len=Math.hypot(dx,dy) || 1;
  const ux=dx/len, uy=dy/len;

  const head=SQ*0.22;
  const tail=SQ*0.10;
  const tx=x2-ux*head, ty=y2-uy*head;

  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=tail;
  ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(tx,ty);
  ctx.stroke();

  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(tx - uy*head*0.55, ty + ux*head*0.55);
  ctx.lineTo(tx + uy*head*0.55, ty - ux*head*0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- Core puzzle flow
let G=null;            // current game state
let baseG=null;        // snapshot for retry
let solveSide="w";     // player side (the side to move in FEN)
let step=0;            // index inside solution line (full sequence)
let selected=-1;
let targets=[];
let hintLevel=0;
let mistakes=0;
let hintsUsed=0;
let showUsed=false;
let lives=3;
let lock=false;
let arrowFrom=-1, arrowTo=-1;
let glowSq=-1;

function curPuzzle(){ return PUZZLES[pIndex]; }
function expectedUCI(){ return curPuzzle().line[step] || null; }

function uciFromMove(m, promo=null){
  return alg(m.from)+alg(m.to)+(promo?promo:"");
}

function applyExpected(auto=false){
  const u=expectedUCI();
  if(!u) return false;
  const from=fromAlg(u.slice(0,2));
  const to=fromAlg(u.slice(2,4));
  const mv=findMove(G,from,to);
  if(!mv) return false;
  applyMove(G,mv,"q");
  step++;
  if(!auto) sfx.ok();
  return true;
}

function autoOpponentIfNeeded(){
  // play solution moves automatically while it's NOT solver's turn
  if(lock) return;
  lock=true;

  const loop = ()=>{
    if(step>=curPuzzle().line.length){ lock=false; return; }
    if(G.turn===solveSide){ lock=false; return; }

    // auto move (opponent response)
    const ok = applyExpected(true);
    if(ok){
      sfx.ok();
      setTimeout(loop, 420);
    }else{
      lock=false;
    }
  };
  setTimeout(loop, 350);
}

function resetPerPuzzle(keepStats=false){
  const P=curPuzzle();
  G=parseFEN(P.fen);
  baseG=parseFEN(P.fen);
  solveSide=G.turn;
  step=0;
  selected=-1; targets=[];
  hintLevel=0; arrowFrom=-1; arrowTo=-1; glowSq=-1;
  mistakes=0; hintsUsed=0; showUsed=false;
  lives = (mode==="rush") ? 3 : 3;
  lock=false;
  renderUI();
  autoOpponentIfNeeded();
}

function stars(){
  // simple: 3 stars = no mistakes + no assists, 2 = hints only, 1 = show move or many mistakes
  if(showUsed) return 1;
  if(mistakes===0 && hintsUsed===0) return 3;
  if(mistakes<=1) return 2;
  return 1;
}

function solved(){
  ST.solved++;
  ST.streak++;
  if(ST.streak>ST.best) ST.best=ST.streak;
  saveStats(ST);
  renderStats();
  sfx.win();

  const s=stars();
  const star = "".repeat(s) + "".repeat(3-s);

  showModal("Solved", `
    <div>Result: <b>${star}</b></div>
    <div style="margin-top:8px">Mistakes: <b>${mistakes}</b>  Hints: <b>${hintsUsed}</b>  Show Move: <b>${showUsed?"Yes":"No"}</b></div>
  `);
}

function failedRush(){
  ST.streak=0;
  saveStats(ST);
  renderStats();
  showModal("Out", `<div>3 strikes. Restart or Next.</div>`);
}

function wrong(){
  sfx.bad();
  ui.boardWrap.classList.add("shake");
  setTimeout(()=>ui.boardWrap.classList.remove("shake"), 280);

  if(mode==="rush"){
    lives--;
    toast("Incorrect  strike!", "bad", 900);
    if(lives<=0){
      failedRush();
      lock=true;
    }
  }else{
    toast("Incorrect  try again", "bad", 900);
  }
  mistakes++;
  renderStats();

  // revert to last stable position (try-again style)
  G=parseFEN(curPuzzle().fen);
  // replay correct moves up to 'step' to rebuild position
  // IMPORTANT: we rebuild ONLY using official line, step stays the same (still need correct move)
  for(let i=0;i<step;i++){
    const u=curPuzzle().line[i];
    const from=fromAlg(u.slice(0,2)), to=fromAlg(u.slice(2,4));
    const mv=findMove(G,from,to);
    if(mv) applyMove(G,mv,"q");
  }

  selected=-1; targets=[];
}

function correctAndContinue(){
  toast("Correct", "good", 650);
  renderUI();
  if(step>=curPuzzle().line.length){
    solved();
    return;
  }
  autoOpponentIfNeeded();
}

function tryMove(from,to){
  if(lock) return;
  if(G.turn!==solveSide) return; // user plays only solver side

  const mv=findMove(G,from,to);
  if(!mv){ wrong(); return; }

  const exp=expectedUCI();
  const uci=uciFromMove(mv,null);
  if(uci!==exp){
    wrong();
    return;
  }

  // correct
  applyMove(G,mv,"q");
  step++;
  sfx.ok();

  selected=-1; targets=[];
  // clear hint visuals after correct move
  arrowFrom=-1; arrowTo=-1; glowSq=-1;

  if(step>=curPuzzle().line.length){
    solved();
  }else{
    correctAndContinue();
  }
}

function hint(){
  if(lock) return;
  const exp=expectedUCI();
  if(!exp) return;

  const from=fromAlg(exp.slice(0,2));
  const to=fromAlg(exp.slice(2,4));

  hintLevel++;
  if(hintLevel===1){
    // Motif hint (no move reveal)
    hintsUsed++;
    toast(`Hint: ${curPuzzle().motif || "Tactic"}`, "good", 1200);
  }else if(hintLevel===2){
    // highlight piece square only
    hintsUsed++;
    glowSq=from; arrowFrom=-1; arrowTo=-1;
    toast("Hint: select the right piece", "good", 900);
  }else{
    // arrow reveal (explicit)
    hintsUsed++;
    glowSq=-1; arrowFrom=from; arrowTo=to;
    toast("Hint: follow the arrow", "good", 900);
  }
  renderStats();
}

function showMove(){
  if(lock) return;
  const exp=expectedUCI();
  if(!exp) return;

  showUsed=true;
  // reveal arrow briefly then play it
  const from=fromAlg(exp.slice(0,2));
  const to=fromAlg(exp.slice(2,4));
  arrowFrom=from; arrowTo=to;
  toast("Show Move (assist)", "good", 900);

  setTimeout(()=>{
    if(G.turn===solveSide){
      applyExpected(false);
      correctAndContinue();
      renderStats();
    }
  }, 520);
}

function renderUI(){
  const P=curPuzzle();
  ui.pTitle.textContent = `#${P.id}  ${P.title}`;
  ui.pMeta.textContent = `Rating: ${P.rating}  You play: ${solveSide==="w"?"White":"Black"}  Step: ${Math.min(step+1, P.line.length)}/${P.line.length}`;
  ui.motif.textContent = P.motif || "";
  ui.sub.textContent = (mode==="rush") ? "Rush: 3 strikes" : "Classic: try again";
  renderStats();
}

function setPuzzle(i){
  pIndex = (i + PUZZLES.length) % PUZZLES.length;
  resetPerPuzzle();
}

ui.btnBack.onclick=()=>location.href="index.html";
ui.btnPrev.onclick=()=>setPuzzle(pIndex-1);
ui.btnNext.onclick=()=>setPuzzle(pIndex+1);
ui.btnRetry.onclick=()=>resetPerPuzzle();
ui.btnHint.onclick=()=>hint();
ui.btnShow.onclick=()=>showMove();

ui.btnResetStats.onclick=()=>{
  ST={streak:0,best:0,solved:0};
  saveStats(ST);
  renderStats();
  toast("Stats reset", "good", 900);
};

ui.mode.onchange=()=>{
  mode=ui.mode.value;
  resetPerPuzzle();
};

ui.btnSound.onclick=()=>{
  audioOn=!audioOn;
  ui.btnSound.textContent = audioOn ? "Sound: ON" : "Sound: OFF";
};

ui.mNext.onclick=()=>{ hideModal(); setPuzzle(pIndex+1); };
ui.mClose.onclick=()=>hideModal();

// ---------- Input
canvas.addEventListener("pointerdown",(e)=>{
  initAudio();
  if(lock) return;
  if(!ui.modal.classList.contains("hidden")) return;

  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)*DPR;
  const y=(e.clientY-rect.top)*DPR;
  const sq=screenToBoard(x,y);
  if(sq<0) return;

  if(G.turn!==solveSide) return; // user moves only on solver turn

  const p=G.board[sq];
  if(selected<0){
    if(p && colorOf(p)===G.turn){
      selected=sq;
      targets=genLegal(G,sq).map(m=>m.to);
      sfx.pick();
    }else{
      wrong();
    }
    return;
  }

  if(sq===selected){ selected=-1; targets=[]; return; }

  // move attempt
  tryMove(selected, sq);
});

function draw(){
  ctx.clearRect(0,0,W,H);

  // chess.com-like board colors
  for(let r=0;r<8;r++){
    for(let f=0;f<8;f++){
      const i=idx(f,r);
      const {x,y}=boardToScreen(i);
      const light = ((f+r)&1)===0;
      ctx.fillStyle = light ? getComputedStyle(document.documentElement).getPropertyValue("--green1") : getComputedStyle(document.documentElement).getPropertyValue("--green2");
      ctx.fillRect(x,y,SQ,SQ);
    }
  }

  // glow square (hint level 2)
  if(glowSq>=0){
    const {x,y}=boardToScreen(glowSq);
    ctx.fillStyle="rgba(255,220,120,.22)";
    ctx.fillRect(x,y,SQ,SQ);
  }

  // selection + targets
  if(selected>=0){
    const {x,y}=boardToScreen(selected);
    ctx.fillStyle="rgba(78,163,255,.20)";
    ctx.fillRect(x,y,SQ,SQ);

    for(const t of targets){
      const {x:tx,y:ty}=boardToScreen(t);
      ctx.fillStyle="rgba(120,255,170,.14)";
      ctx.fillRect(tx,ty,SQ,SQ);
      ctx.fillStyle="rgba(0,0,0,.20)";
      ctx.beginPath();
      ctx.arc(tx+SQ/2, ty+SQ/2, SQ*0.12, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // arrow hint (level 3 / show move)
  if(arrowFrom>=0 && arrowTo>=0){
    drawArrow(arrowFrom, arrowTo, "rgba(30,30,30,.35)");
    drawArrow(arrowFrom, arrowTo, "rgba(255,255,255,.28)");
  }

  // pieces
  for(let i=0;i<64;i++){
    const p=G.board[i];
    if(!p) continue;
    const {x,y}=boardToScreen(i);
    drawPiece(p, x+SQ/2, y+SQ/2);
  }

  ctx.strokeStyle="rgba(0,0,0,.22)";
  ctx.lineWidth=3*DPR;
  ctx.strokeRect(offX,offY,SQ*8,SQ*8);

  requestAnimationFrame(draw);
}

// ---------- init
resize();
mode=ui.mode.value || "classic";
setPuzzle(0);
renderUI();
draw();
