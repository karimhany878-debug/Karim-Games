/* chess_bot_patch.js
   - Fixes negamax eval sign (huge strength boost)
   - Adds small opening book (variety, no same opening always)
   - Stronger eval: material + PST + pawn structure + bishop pair + simple king safety
   - ELO-ish mapping: Easy500, Normal1000, Hard2000 (approx, hardware-dependent)
*/
(function(){
  try{ if(typeof S==="undefined"||typeof ui==="undefined"||typeof genMoves!=="function") return; }catch(_){ return; }

  try{
    const sel=document.getElementById("lvl");
    if(sel){
      for(const opt of sel.options){
        if(opt.value==="easy") opt.textContent="Easy (500)";
        if(opt.value==="normal") opt.textContent="Normal (1000)";
        if(opt.value==="hard") opt.textContent="Hard (2000)";
      }
    }
  }catch(e){}

  const FILES="abcdefgh";
  function sqToIdx(s){
    const f=FILES.indexOf(s[0]); const r=+s[1];
    if(f<0||r<1||r>8) return -1;
    const row=8-r;
    return row*8+f;
  }
  function mirrorSq(i){ const r=(i/8)|0, c=i%8; return (7-r)*8+c; }
  function plyCount(st){ return (st.full-1)*2 + (st.turn==="b"?1:0); }

  function findMoveByUCI(st, uci){
    const from=sqToIdx(uci.slice(0,2));
    const to=sqToIdx(uci.slice(2,4));
    const promo = (uci.length>=5) ? uci[4].toUpperCase() : null;
    const moves=genMoves(st,false);
    for(const m of moves){
      if(m.from===from && m.to===to && ((m.promo||null)===promo)) return m;
    }
    return null;
  }
  function applyUCI(st, uci){
    const m=findMoveByUCI(st, uci);
    if(!m) return false;
    makeMove(st, m, true);
    return true;
  }
  function weightedPick(list){
    let total=0;
    for(const it of list) total+=it.w;
    let r=Math.random()*total;
    for(const it of list){
      r-=it.w;
      if(r<=0) return it.uci;
    }
    return list[0].uci;
  }

  // Opening book (built by replaying moves to avoid brittle FEN strings)
  const BOOK=new Map();
  function addBook(seqUntilBlackToMove, replies){
    const st=parseFEN(START);
    for(const uci of seqUntilBlackToMove){
      if(!applyUCI(st, uci)) return;
    }
    if(st.turn!=="b") return;
    BOOK.set(posKey(st), replies);
  }

  addBook(["e2e4"], [{uci:"c7c5",w:40},{uci:"e7e5",w:35},{uci:"e7e6",w:15},{uci:"c7c6",w:10}]);
  addBook(["d2d4"], [{uci:"d7d5",w:45},{uci:"g8f6",w:35},{uci:"e7e6",w:20}]);
  addBook(["c2c4"], [{uci:"e7e5",w:45},{uci:"g8f6",w:35},{uci:"c7c5",w:20}]);
  addBook(["g1f3"], [{uci:"d7d5",w:40},{uci:"g8f6",w:40},{uci:"c7c5",w:20}]);
  addBook(["e2e4","c7c5","g1f3"], [{uci:"d7d6",w:45},{uci:"e7e6",w:30},{uci:"b8c6",w:25}]);
  addBook(["e2e4","e7e5","g1f3"], [{uci:"b8c6",w:55},{uci:"d7d6",w:25},{uci:"g8f6",w:20}]);

  function pickBookMove(st, lvl){
    if(plyCount(st)>10) return null;
    const ent=BOOK.get(posKey(st));
    if(!ent) return null;

    let list=ent.slice();
    if(lvl==="hard"){ list.sort((a,b)=>b.w-a.w); list=list.slice(0,2); }
    else if(lvl==="normal"){ list.sort((a,b)=>b.w-a.w); list=list.slice(0,3); }

    const uci=weightedPick(list);
    return findMoveByUCI(st, uci);
  }

  // Stronger eval (WHITE perspective)
  const PST = {
    P: [0,0,0,0,0,0,0,0, 55,55,55,55,55,55,55,55, 12,12,18,28,28,18,12,12, 6,6,10,22,22,10,6,6, 2,2,4,14,14,4,2,2, 0,0,0,8,8,0,0,0, 0,0,0,-10,-10,0,0,0, 0,0,0,0,0,0,0,0],
    N: [-50,-35,-25,-20,-20,-25,-35,-50, -30,-10,0,5,5,0,-10,-30, -20,5,15,18,18,15,5,-20, -18,6,18,22,22,18,6,-18, -18,5,14,20,20,14,5,-18, -20,0,8,10,10,8,0,-20, -30,-10,0,0,0,0,-10,-30, -50,-35,-25,-20,-20,-25,-35,-50],
    B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,6,0,0,0,0,6,-10, -10,10,10,10,10,10,10,-10, -10,0,10,12,12,10,0,-10, -10,6,6,12,12,6,6,-10, -10,0,6,10,10,6,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 25,35,10,0,0,10,35,25],
    KE:[-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,8,10,10,8,0,-10, -10,0,10,15,15,10,0,-10, -10,0,10,15,15,10,0,-10, -10,0,8,10,10,8,0,-10, -10,0,0,0,0,0,0,-10, -20,-10,-10,-10,-10,-10,-10,-20]
  };

  function evalWhite(st){
    let s=0;
    const pawW=Array(8).fill(0), pawB=Array(8).fill(0);
    let bishopsW=0, bishopsB=0;

    let phase=0;
    for(let i=0;i<64;i++){
      const v=st.a[i]; if(!v) continue;
      const p=v[1];
      if(p==="Q") phase+=4;
      else if(p==="R") phase+=2;
      else if(p==="B"||p==="N") phase+=1;
    }
    const endgame = phase<=6;

    for(let sq=0;sq<64;sq++){
      const v=st.a[sq]; if(!v) continue;
      const side=v[0], p=v[1];
      const msq = (side==="w") ? sq : mirrorSq(sq);

      let val=V[p];
      let pst=0;
      if(p==="P") pst=PST.P[msq]||0;
      else if(p==="N") pst=PST.N[msq]||0;
      else if(p==="B") pst=PST.B[msq]||0;
      else if(p==="K") pst=(endgame?PST.KE[msq]:PST.K[msq])||0;

      if(p==="P"){
        const f=sq%8;
        if(side==="w") pawW[f]++; else pawB[f]++;
      }
      if(p==="B"){ if(side==="w") bishopsW++; else bishopsB++; }

      const add=val+pst;
      s += (side==="w") ? add : -add;
    }

    if(bishopsW>=2) s+=35;
    if(bishopsB>=2) s-=35;

    for(let f=0; f<8; f++){
      if(pawW[f]>1) s -= 14*(pawW[f]-1);
      if(pawB[f]>1) s += 14*(pawB[f]-1);

      const wIso = pawW[f]>0 && ((f===0||pawW[f-1]===0) && (f===7||pawW[f+1]===0));
      const bIso = pawB[f]>0 && ((f===0||pawB[f-1]===0) && (f===7||pawB[f+1]===0));
      if(wIso) s -= 10;
      if(bIso) s += 10;
    }

    if(!endgame){
      const kg1=sqToIdx("g1"), kc1=sqToIdx("c1"), ke1=sqToIdx("e1");
      const kg8=sqToIdx("g8"), kc8=sqToIdx("c8"), ke8=sqToIdx("e8");
      for(let i=0;i<64;i++){
        const v=st.a[i]; if(!v||v[1]!=="K") continue;
        if(v[0]==="w"){
          if(i===kg1||i===kc1) s+=22;
          if(i===ke1) s-=18;
        }else{
          if(i===kg8||i===kc8) s-=22;
          if(i===ke8) s+=18;
        }
      }
    }
    return s;
  }

  // IMPORTANT: Negamax requires eval from side-to-move
  evalPos = function(st){
    let s=evalWhite(st);
    if(inCheck(st,"w")) s -= 25;
    if(inCheck(st,"b")) s += 25;
    return (st.turn==="w") ? s : -s;
  };

  // HUD shows White perspective like chess sites
  const _updateHUD = updateHUD;
  updateHUD = function(){
    _updateHUD();
    const ev = evalWhite(S)/100.0;
    ui.eval.textContent = (ev>=0?"+":"") + ev.toFixed(2);
  };

  // Budgets (ELO-ish)
  botDelay  = function(l){ return l==="easy"?550 : l==="normal"?800 : 1100; };
  botBudget = function(l){ return l==="easy"?180 : l==="normal"?900 : 5200; };

  // Bot: book + variety early (even on hard) so it won't always repeat openings
  maybeBot = function(){
    if(ended) return;
    if(ui.mode.value!=="bot") return;
    if(S.turn!=="b") return;
    if(botBusy) return;

    botBusy=true;
    updateHUD();
    const lvl=ui.lvl.value;

    setTimeout(()=>{
      const st=cloneS(S);

      let m = pickBookMove(st, lvl);

      if(!m){
        const early = plyCount(st) <= 10;
        const variety = (lvl!=="hard") || early;

        const res = searchBest(st, botBudget(lvl), variety);
        m = res.m;

        if(res && typeof res.score==="number"){
          // bot is black => flip for White perspective display
          const whiteScore = -res.score;
          ui.eval.textContent = ((whiteScore/100)>=0?"+":"") + (whiteScore/100).toFixed(2);
        }
      }

      if(m && !ended) applyMove(m);
      botBusy=false;
    }, botDelay(lvl));
  };

  try{ updateHUD(); }catch(e){}
})();
