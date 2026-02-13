const KEY="karim_settings_v1";
function loadSettings(){
  try{ return JSON.parse(localStorage.getItem(KEY)||"{}"); }catch{return {};}
}

const gridEl=document.getElementById("grid");
const turnEl=document.getElementById("turn");
const scoreEl=document.getElementById("score");
const hintEl=document.getElementById("hint");
const modeEl=document.getElementById("mode");
const lvlEl=document.getElementById("level");

let board=Array(9).fill("");
let turn="X";
let score={X:0,O:0};
let locked=false;

function render(){
  gridEl.innerHTML="";
  for(let i=0;i<9;i++){
    const d=document.createElement("div");
    d.className="cell"+(board[i]?" lock":"");
    d.textContent = board[i] ? (board[i]==="X" ? "✖" : "⭕") : "";
    d.onclick=()=>onCell(i);
    gridEl.appendChild(d);
  }
  turnEl.textContent = `Turn: ${turn}`;
  scoreEl.textContent = `X: ${score.X}  O: ${score.O}`;
}

function lines(){
  return [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
}
function winner(b=board){
  for(const [a,c,d] of lines()){
    if(b[a] && b[a]===b[c] && b[a]===b[d]) return b[a];
  }
  if(b.every(x=>x)) return "DRAW";
  return null;
}
function moves(b=board){
  const m=[];
  for(let i=0;i<9;i++) if(!b[i]) m.push(i);
  return m;
}

function botDelay(){
  const s=loadSettings();
  const base = typeof s.chessBotDelay==="number" ? s.chessBotDelay : 900;
  // reuse same setting for simplicity, add jitter
  return Math.max(250, Math.min(2500, base)) + Math.floor(Math.random()*220);
}

// Simple AI tiers
function botPick(){
  const lvl=lvlEl.value;

  // easy: random with slight win/block
  if(lvl==="easy"){
    return smartRandom();
  }

  // normal: minimax depth-limited
  if(lvl==="normal"){
    return minimaxRoot(5);
  }

  // hard: full minimax
  return minimaxRoot(9);
}

function smartRandom(){
  const m=moves();
  // win
  for(const i of m){
    const b=board.slice(); b[i]="O";
    if(winner(b)==="O") return i;
  }
  // block
  for(const i of m){
    const b=board.slice(); b[i]="X";
    if(winner(b)==="X") return i;
  }
  return m[Math.floor(Math.random()*m.length)];
}

function minimaxRoot(depth){
  let best=-Infinity, bestMove=null;
  for(const i of moves()){
    const b=board.slice(); b[i]="O";
    const val = minimax(b, depth-1, false, -Infinity, Infinity);
    if(val>best){ best=val; bestMove=i; }
  }
  return bestMove ?? smartRandom();
}
function minimax(b, depth, isMax, a, beta){
  const w=winner(b);
  if(w==="O") return 10 + depth;
  if(w==="X") return -10 - depth;
  if(w==="DRAW") return 0;
  if(depth<=0) return 0;

  if(isMax){
    let best=-Infinity;
    for(const i of moves(b)){
      const bb=b.slice(); bb[i]="O";
      best=Math.max(best, minimax(bb, depth-1, false, a, beta));
      a=Math.max(a,best);
      if(beta<=a) break;
    }
    return best;
  }else{
    let best=Infinity;
    for(const i of moves(b)){
      const bb=b.slice(); bb[i]="X";
      best=Math.min(best, minimax(bb, depth-1, true, a, beta));
      beta=Math.min(beta,best);
      if(beta<=a) break;
    }
    return best;
  }
}

function onCell(i){
  if(locked) return;
  if(board[i]) return;

  board[i]=turn;
  const w=winner();
  if(w){ end(w); return; }

  turn = (turn==="X") ? "O" : "X";
  render();

  if(modeEl.value==="bot" && turn==="O"){
    locked=true;
    hintEl.textContent="Bot thinking...";
    setTimeout(()=>{
      const mv=botPick();
      locked=false;
      hintEl.textContent="";
      if(mv!=null && !board[mv]){
        board[mv]="O";
        const ww=winner();
        if(ww){ end(ww); return; }
        turn="X";
        render();
      }
    }, botDelay());
  }
}

function end(w){
  if(w==="DRAW"){
    hintEl.textContent="Draw.";
  }else{
    score[w]++; hintEl.textContent = `${w} wins.`;
  }
  render();
  setTimeout(()=>{ newGame(false); }, 650);
}

function newGame(resetScore=false){
  board=Array(9).fill("");
  turn="X";
  locked=false;
  hintEl.textContent="";
  if(resetScore) score={X:0,O:0};
  render();
}

document.getElementById("new").onclick=()=>newGame(true);
render();
