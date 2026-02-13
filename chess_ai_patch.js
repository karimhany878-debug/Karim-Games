/* chess_ai_patch.js
   Drop-in upgrade: stronger eval + small opening book + sane ELO mapping.
   Loads AFTER chess.js and overrides a few functions.
*/
(function(){
  if (typeof window === "undefined") return;
  if (typeof S === "undefined" || typeof ui === "undefined") return;

  // ---- UI labels: ELO mapping (approx) ----
  try{
    const sel = document.getElementById("lvl");
    if(sel){
      for(const opt of sel.options){
        if(opt.value==="easy") opt.text = "Easy (500)";
        if(opt.value==="normal") opt.text = "Normal (1000)";
        if(opt.value==="hard") opt.text = "Hard (2000)";
      }
    }
  }catch(e){}

  // ---- Time budgets (ms) + human delay ----
  // Increase Hard budget if you want even stronger: e.g. 4500..7000 (PC only).
  window.botDelay  = function(l){ return l==="easy" ? 520 : l==="normal" ? 760 : 1100; };
  window.botBudget = function(l){ return l==="easy" ? 180 : l==="normal" ? 850 : 3200; };

  // ---- Helpers ----
  const FILES = "abcdefgh";
  function sqToIdx(sq){
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1],10);
    if(f<0||r<1||r>8) return -1;
    const row = 8 - r; // rank8 => row0
    return row*8 + f;
  }
  function findMoveByUCI(st, uci){
    const from = sqToIdx(uci.slice(0,2));
    const to   = sqToIdx(uci.slice(2,4));
    const promo = (uci.length>=5) ? uci[4].toUpperCase() : null;
    const moves = genMoves(st,false);
    for(const m of moves){
      if(m.from===from && m.to===to && ((m.promo||null)===promo)) return m;
    }
    return null;
  }
  function plyCount(st){
    return (st.full-1)*2 + (st.turn==="b" ? 1 : 0);
  }

  // ---- Tiny opening book (variety + good fundamentals) ----
  // Keys are posKey(st) after WHITE's move(s). Values are UCI moves for BLACK.
  const BOOK = new Map([
    // After 1.e4
    ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", [
      ["c7c5", 40], // Sicilian
      ["e7e5", 35], // Open games
      ["e7e6", 15], // French
      ["c7c6", 10], // Caro
    ]],
    // After 1.d4
    ["rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3", [
      ["d7d5", 45],
      ["g8f6", 35],
      ["e7e6", 20],
    ]],
    // After 1.c4
    ["rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3", [
      ["e7e5", 45],
      ["g8f6", 35],
      ["c7c5", 20],
    ]],
    // After 1.Nf3
    ["rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -", [
      ["d7d5", 40],
      ["g8f6", 40],
      ["c7c5", 20],
    ]],

    // After 1.e4 c5 2.Nf3
    ["rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -", [
      ["d7d6", 45],
      ["e7e6", 30],
      ["b8c6", 25],
    ]],
    // After 1.e4 e5 2.Nf3
    ["rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -", [
      ["b8c6", 55],
      ["d7d6", 25],
      ["g8f6", 20],
    ]],
  ]);

  function pickBookMove(st, lvl){
    if(plyCount(st) > 8) return null;
    const key = posKey(st);
    const ent = BOOK.get(key);
    if(!ent) return null;

    let list = ent.slice();

    if(lvl==="hard"){
      // keep top 2 weights, still random (variety بدون تضييع قوة)
      list.sort((a,b)=>b[1]-a[1]);
      list = list.slice(0,2);
    }

    let total = 0;
    for(const it of list) total += it[1];

    let r = Math.random()*total;
    for(const [uci,w] of list){
      r -= w;
      if(r<=0) return findMoveByUCI(st, uci);
    }
    return findMoveByUCI(st, list[0][0]);
  }

  // ---- Stronger, faster evaluation (centipawns) ----
  const PST = {
    P: [
      0,0,0,0,0,0,0,0,
      50,50,50,55,55,50,50,50,
      12,12,18,28,28,18,12,12,
      6,6,10,22,22,10,6,6,
      2,2,4,14,14,4,2,2,
      0,0,0,8,8,0,0,0,
      0,0,0,-10,-10,0,0,0,
      0,0,0,0,0,0,0,0
    ],
    N: [
      -50,-35,-25,-20,-20,-25,-35,-50,
      -30,-10,0,5,5,0,-10,-30,
      -20,5,15,18,18,15,5,-20,
      -18,6,18,22,22,18,6,-18,
      -18,5,14,20,20,14,5,-18,
      -20,0,8,10,10,8,0,-20,
      -30,-10,0,0,0,0,-10,-30,
      -50,-35,-25,-20,-20,-25,-35,-50
    ],
    B: [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,6,0,0,0,0,6,-10,
      -10,10,10,10,10,10,10,-10,
      -10,0,10,12,12,10,0,-10,
      -10,6,6,12,12,6,6,-10,
      -10,0,6,10,10,6,0,-10,
      -10,0,0,0,0,0,0,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ],
    R: [
      0,0,0,6,6,0,0,0,
      -4,0,0,0,0,0,0,-4,
      -4,0,0,0,0,0,0,-4,
      -4,0,0,0,0,0,0,-4,
      -4,0,0,0,0,0,0,-4,
      -4,0,0,0,0,0,0,-4,
      8,10,10,10,10,10,10,8,
      0,0,0,0,0,0,0,0
    ],
    Q: [
      -10,-6,-6,-3,-3,-6,-6,-10,
      -6,0,0,0,0,0,0,-6,
      -6,0,3,3,3,3,0,-6,
      -3,0,3,3,3,3,0,-3,
      -3,0,3,3,3,3,0,-3,
      -6,0,3,3,3,3,0,-6,
      -6,0,0,0,0,0,0,-6,
      -10,-6,-6,-3,-3,-6,-6,-10
    ],
    K: [
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20,
      25,35,10,0,0,10,35,25
    ],
    KE: [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,0,0,0,0,0,0,-10,
      -10,0,8,10,10,8,0,-10,
      -10,0,10,15,15,10,0,-10,
      -10,0,10,15,15,10,0,-10,
      -10,0,8,10,10,8,0,-10,
      -10,0,0,0,0,0,0,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ]
  };

  function mirrorSq(sq){
    const r = (sq/8)|0, c=sq%8;
    return (7-r)*8 + c;
  }

  function evalWhite(st){
    let s = 0;
    const pawW = Array(8).fill(0), pawB = Array(8).fill(0);
    let bishopsW=0, bishopsB=0;
    let queens = 0;
    let kingW=-1, kingB=-1;

    // endgame detector
    let phase = 0;
    for(let i=0;i<64;i++){
      const v = st.a[i]; if(!v) continue;
      const p=v[1];
      if(p==="Q") phase += 4;
      else if(p==="R") phase += 2;
      else if(p==="B"||p==="N") phase += 1;
    }
    const endgame = phase <= 6;

    for(let sq=0;sq<64;sq++){
      const v = st.a[sq]; if(!v) continue;
      const side=v[0], p=v[1];
      const msq = side==="w" ? sq : mirrorSq(sq);

      let val = V[p];
      let pst = 0;

      if(p==="K"){
        pst = (endgame ? PST.KE[msq] : PST.K[msq]);
        if(side==="w") kingW=sq; else kingB=sq;
      }else{
        pst = PST[p] ? PST[p][msq] : 0;
      }

      if(p==="P"){
        const file = sq%8;
        if(side==="w") pawW[file]++; else pawB[file]++;
      }
      if(p==="B"){ if(side==="w") bishopsW++; else bishopsB++; }
      if(p==="Q") queens++;

      const add = val + pst;
      s += (side==="w") ? add : -add;
    }

    if(bishopsW>=2) s += 35;
    if(bishopsB>=2) s -= 35;

    for(let f=0;f<8;f++){
      if(pawW[f]>1) s -= 14*(pawW[f]-1);
      if(pawB[f]>1) s += 14*(pawB[f]-1);

      const wIso = pawW[f]>0 && ( (f===0||pawW[f-1]===0) && (f===7||pawW[f+1]===0) );
      const bIso = pawB[f]>0 && ( (f===0||pawB[f-1]===0) && (f===7||pawB[f+1]===0) );
      if(wIso) s -= 10;
      if(bIso) s += 10;
    }

    // passed pawns (simple)
    function isPassedPawn(side, sq){
      const file = sq%8;
      const r = (sq/8)|0;
      const dir = (side==="w") ? -1 : 1;
      const enemy = (side==="w") ? "bP" : "wP";
      for(let df=-1; df<=1; df++){
        const f = file+df;
        if(f<0||f>7) continue;
        let rr = r + dir;
        while(rr>=0 && rr<=7){
          const p = st.a[rr*8 + f];
          if(p===enemy) return false;
          rr += dir;
        }
      }
      return true;
    }
    for(let sq=0;sq<64;sq++){
      const v=st.a[sq]; if(!v||v[1]!=="P") continue;
      const side=v[0];
      if(isPassedPawn(side,sq)){
        const r = (sq/8)|0;
        const adv = side==="w" ? (7-r) : r;
        const bonus = 8 + adv*4;
        s += (side==="w") ? bonus : -bonus;
      }
    }

    if(kingW!==-1){
      if(kingW===sqToIdx("g1") || kingW===sqToIdx("c1")) s += 22;
    }
    if(kingB!==-1){
      if(kingB===sqToIdx("g8") || kingB===sqToIdx("c8")) s -= 22;
    }

    if(queens){
      const center = new Set([sqToIdx("d1"),sqToIdx("e1"),sqToIdx("d2"),sqToIdx("e2"),
                              sqToIdx("d8"),sqToIdx("e8"),sqToIdx("d7"),sqToIdx("e7")]);
      if(center.has(kingW)) s -= 25;
      if(center.has(kingB)) s += 25;
    }

    return s;
  }

  // Critical: negamax expects score from side-to-move
  window.evalPos = function(st){
    let s = evalWhite(st);
    if(inCheck(st,"w")) s -= 18;
    if(inCheck(st,"b")) s += 18;
    return (st.turn==="w") ? s : -s;
  };

  // ---- Always allow variety + opening book ----
  window.maybeBot = function(){
    if(ended) return;
    if(ui.mode.value!=="bot") return;
    if(S.turn!=="b") return;
    if(botBusy) return;

    botBusy = true;
    updateHUD();

    const lvl = ui.lvl.value;
    setTimeout(()=>{
      const st = cloneS(S);

      let m = pickBookMove(st, lvl);
      let score = 0;

      if(!m){
        const res = searchBest(st, botBudget(lvl), true);
        m = res.m;
        score = res.score || 0;
      }

      if(m && !ended){
        // display eval from White perspective
        const whiteScore = -score;
        ui.eval.textContent = ((whiteScore/100)>=0?"+":"") + (whiteScore/100).toFixed(2);
        applyMove(m);
      }

      botBusy = false;
    }, botDelay(lvl));
  };

})();
