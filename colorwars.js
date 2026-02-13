
// colorwars.js - Chain Reaction (5x5) rules:
// - Explosion threshold is ALWAYS 4 (all cells).
// - Seeding: each player can place on an empty cell exactly once.
// - After both seeded: you can play ONLY on your own cells.
// - Optional bot as Player 2.

(() => {
  const N = 5;
  const THRESHOLD = 4;

  const elMenu = document.getElementById("menu");
  const elGame = document.getElementById("game");
  const elGrid = document.getElementById("grid");
  const elStatus = document.getElementById("status");
  const elP1 = document.getElementById("p1Score");
  const elP2 = document.getElementById("p2Score");

  const elDiff = document.getElementById("diff");
  const elDiffLabel = document.getElementById("diffLabel");
  const btnBot = document.getElementById("btnBot");
  const btnFriend = document.getElementById("btnFriend");
  const btnBack = document.getElementById("btnBack");
  const btnExit = document.getElementById("btnExit");
  const btnSettings = document.getElementById("btnSettings");

  const modal = document.getElementById("modal");
  const chkSound = document.getElementById("chkSound");
  const chkBot = document.getElementById("chkBot");
  const btnClose = document.getElementById("btnClose");
  const btnNew = document.getElementById("btnNew");

  // Sound wrapper (uses sfx.js if present)
  const SOUND = {
    enabled: true,
    _try(name){
      if (!this.enabled) return;
      try{
        if (window.SFX && typeof window.SFX.play === "function") window.SFX.play(name);
      }catch(e){}
    },
    click(){ this._try("click"); },
    pop(){ this._try("capture"); },
    win(){ this._try("win"); },
    deny(){ this._try("click"); }
  };

  let owner, count;
  let turn = 1; // 1 or 2
  let seeded = {1:false, 2:false};
  let vsBot = false;
  let botLevel = 0; // 0 easy,1 mid,2 hard (light heuristic)
  let busy = false;

  function setDiffLabel(v){
    const t = ["سهل","عادي","صعب"][v] || "سهل";
    elDiffLabel.textContent = t;
  }
  setDiffLabel(+elDiff.value);
  elDiff.addEventListener("input", ()=> setDiffLabel(+elDiff.value));

  function showMenu(){
    elMenu.classList.remove("hidden");
    elGame.classList.add("hidden");
    setTurnBg();
  }
  function showGame(){
    elMenu.classList.add("hidden");
    elGame.classList.remove("hidden");
    setTurnBg();
  }

  function openModal(){
    modal.classList.remove("hidden");
  }
  function closeModal(){
    modal.classList.add("hidden");
  }

  btnSettings.addEventListener("click", (e)=>{ e.preventDefault(); openModal(); });
  btnClose.addEventListener("click", (e)=>{ e.preventDefault(); closeModal(); });
  modal.addEventListener("click", (e)=>{ if (e.target === modal) closeModal(); });

  // IMPORTANT: fix broken buttons on mobile (touch + click)
  ["touchend","pointerup"].forEach(ev=>{
    btnClose.addEventListener(ev, (e)=>{ e.preventDefault(); closeModal(); }, {passive:false});
    btnNew.addEventListener(ev, (e)=>{ e.preventDefault(); newGame(); closeModal(); }, {passive:false});
  });
  btnNew.addEventListener("click", (e)=>{ e.preventDefault(); newGame(); closeModal(); });

  chkSound.addEventListener("change", ()=>{ SOUND.enabled = !!chkSound.checked; });
  chkBot.addEventListener("change", ()=>{ vsBot = !!chkBot.checked; });

  btnBack.addEventListener("click", ()=> location.href="play.html");
  btnExit.addEventListener("click", ()=> location.href="play.html");

  btnBot.addEventListener("click", ()=>{
    vsBot = true;
    botLevel = +elDiff.value;
    chkBot.checked = true;
    newGame(true);
  });
  btnFriend.addEventListener("click", ()=>{
    vsBot = false;
    botLevel = +elDiff.value;
    chkBot.checked = false;
    newGame(true);
  });

  function initState(){
    owner = Array.from({length:N}, ()=> Array(N).fill(0));
    count = Array.from({length:N}, ()=> Array(N).fill(0));
    turn = 1;
    seeded = {1:false, 2:false};
    busy = false;
    renderAll();
    setStatus();
  }

  
  function setTurnBg(){
    // background tracks current player turn
    const root = document.documentElement;
    // base palette close to original but tinted
    const p1 = "#e3736b"; // red tint
    const p2 = "#5aa4e6"; // blue tint
    const neutral = "#e58a6b";
    const col = (turn===1 ? p1 : p2);
    // During menu show neutral; during game show turn color
    const active = (elGame && !elGame.classList.contains("hidden"));
    root.style.setProperty("--bg", active ? col : neutral);
  }
function setStatus(msg){
    setTurnBg();
    if (msg){ elStatus.textContent = msg; return; }
    if (!seeded[1] || !seeded[2]){
      elStatus.textContent = "ابدأ: كل لاعب يضع أول حركة في خانة فارغة مرة واحدة.";
      return;
    }
    elStatus.textContent = `الدور: لاعب ${turn} (الانفجار عند 4)`;
  }

  function scoreOf(p){
    let s=0;
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (owner[r][c]===p) s++;
    return s;
  }

  function renderCell(r,c){
    const cell = elGrid.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (!cell) return;
    cell.innerHTML = "";
    const o = owner[r][c];
    const k = count[r][c];

    if (o===0 || k===0){
      cell.classList.remove("p1","p2");
      return;
    }

    const orb = document.createElement("div");
    orb.className = "orb " + (o===1 ? "red" : "blue");

    const dots = document.createElement("div");
    dots.className = "dots";
    // show 1..4 white dots
    if (k===1){
      dots.appendChild(dot("d1"));
    } else if (k===2){
      dots.appendChild(dot("d2a"));
      dots.appendChild(dot("d2b"));
    } else if (k===3){
      dots.appendChild(dot("d3a"));
      dots.appendChild(dot("d3b"));
      dots.appendChild(dot("d3c"));
    } else {
      dots.appendChild(dot("d4a"));
      dots.appendChild(dot("d4b"));
      dots.appendChild(dot("d4c"));
      dots.appendChild(dot("d4d"));
    }

    orb.appendChild(dots);
    cell.appendChild(orb);
  }

  function dot(cls){
    const d=document.createElement("div");
    d.className="dot "+cls;
    return d;
  }

  function renderAll(){
    // build grid once
    if (!elGrid.dataset.built){
      elGrid.dataset.built="1";
      elGrid.innerHTML = "";
      for (let r=0;r<N;r++){
        for (let c=0;c<N;c++){
          const cell=document.createElement("div");
          cell.className="cell";
          cell.dataset.r=r; cell.dataset.c=c;
          cell.addEventListener("click", ()=> onTap(r,c));
          cell.addEventListener("touchend", (e)=>{ e.preventDefault(); onTap(r,c); }, {passive:false});
          elGrid.appendChild(cell);
        }
      }
    }
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) renderCell(r,c);

    const s1 = scoreOf(1), s2 = scoreOf(2);
    elP1.textContent = String(s1);
    elP2.textContent = String(s2);
  }

  function canPlay(r,c,p){
    const o = owner[r][c];
    if (!seeded[p]) {
      return o===0; // seeding: empty only (once)
    }
    if (!seeded[1] || !seeded[2]){
      // other player still seeding, already seeded player cannot play (to keep symmetry)
      return false;
    }
    return o===p; // after seeding both: own cells only
  }

  async function onTap(r,c){
    if (busy) return;
    const p = turn;

    if (!canPlay(r,c,p)){
      SOUND.deny();
      if (!seeded[p]){
        setStatus("غير مسموح: أول حركة لازم تكون في خانة فارغة.");
      } else if (!seeded[1] || !seeded[2]){
        setStatus("انتظر: اللاعب الآخر لم يضع أول حركة بعد.");
      } else {
        setStatus("غير مسموح: بعد البداية اللعب يكون على خاناتك فقط.");
      }
      return;
    }

    SOUND.click();
    await applyMove(r,c,p);
    await afterMove();
  }

  async function applyMove(r,c,p){
    busy = true;

    if (owner[r][c]===0){
      owner[r][c]=p;
      count[r][c]=1;
      seeded[p]=true;
    } else {
      count[r][c] += 1;
    }

    // resolve chain reactions
    const queue = [];
    if (count[r][c] >= THRESHOLD) queue.push([r,c]);

    while(queue.length){
      const [x,y] = queue.shift();
      if (count[x][y] < THRESHOLD) continue;

      // explode
      const who = owner[x][y];
      count[x][y] = 0;
      owner[x][y] = 0;
      SOUND.pop();

      const neigh = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      for (const [nx,ny] of neigh){
        if (nx<0||ny<0||nx>=N||ny>=N) continue;
        owner[nx][ny] = who;
        count[nx][ny] = Math.min(THRESHOLD, count[nx][ny]+1);
        if (count[nx][ny] >= THRESHOLD) queue.push([nx,ny]);
      }
      renderAll();
      await sleep(60);
    }

    renderAll();
    busy = false;
  }

  function hasAny(p){
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (owner[r][c]===p) return true;
    return false;
  }

  async function afterMove(){
    renderAll();

    // win condition: after both seeded and someone has no cells
    if (seeded[1] && seeded[2]){
      const p1 = hasAny(1);
      const p2 = hasAny(2);
      if (!p1 && p2){
        SOUND.win();
        setStatus("فاز اللاعب 2");
        return;
      }
      if (!p2 && p1){
        SOUND.win();
        setStatus("فاز اللاعب 1");
        return;
      }
    }

    // switch turn
    turn = (turn===1 ? 2 : 1);
    setStatus();

    // bot move
    if (vsBot && turn===2){
      await sleep(220);
      const mv = pickBotMove();
      if (mv) await onTap(mv[0], mv[1]);
    }
  }

  function pickBotMove(){
    // during seeding: choose empty cell near center
    if (!seeded[2]){
      const empties = [];
      for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (owner[r][c]===0) empties.push([r,c]);
      empties.sort((a,b)=> distCenter(a)-distCenter(b));
      return empties[0] || null;
    }

    if (!seeded[1] || !seeded[2]) return null;

    // choose among own cells only
    const moves = [];
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (owner[r][c]===2) moves.push([r,c]);
    if (!moves.length) return null;

    if (botLevel===0){
      // easy: random
      return moves[Math.floor(Math.random()*moves.length)];
    }

    // medium/hard: heuristic based on potential explosions / captures
    let best = null, bestScore = -1e9;
    for (const [r,c] of moves){
      const sc = evalMove(r,c);
      if (sc > bestScore){ bestScore=sc; best=[r,c]; }
    }
    return best || moves[0];
  }

  function evalMove(r,c){
    // Higher if this move causes explosion chain or threatens neighbor.
    const k = count[r][c];
    let score = 0;
    if (k === THRESHOLD-1) score += 50; // immediate explode
    score += k * 2;

    const neigh = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([x,y])=> x>=0&&y>=0&&x<N&&y<N);
    for (const [x,y] of neigh){
      if (owner[x][y]===1) score += 3; // pressure opponent
      if (count[x][y]===THRESHOLD-1) score += 4;
    }
    // prefer centerish
    score += (10 - distCenter([r,c])*2);

    if (botLevel===2){
      // add small lookahead: simulate one explode only (cheap)
      if (k===THRESHOLD-1) score += neigh.length * 2;
    }
    return score;
  }

  function distCenter([r,c]){
    const cr=(N-1)/2, cc=(N-1)/2;
    return Math.abs(r-cr)+Math.abs(c-cc);
  }

  function newGame(fromMenu=false){
    initState();
    showGame();
    setTurnBg();
    if (fromMenu) setStatus("ابدأ: كل لاعب يضع أول حركة في خانة فارغة مرة واحدة.");
  }

  function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

  // start at menu
  showMenu();
})();
