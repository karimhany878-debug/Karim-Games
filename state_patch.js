(function(){
  const KEY="karim_settings_v1";
  function loadS(){ try{return JSON.parse(localStorage.getItem(KEY)||"{}");}catch{return {}} }
  const S=loadS();
  if(S.stateAuto===false){ return; }

  function normNode(x){
    if(!x) return null;
    if(typeof x==="object") return x;
    const pools=[window.nodes, window.NODES, window.stateNodes, window.gameNodes, window.graphNodes];
    for(const arr of pools){
      if(Array.isArray(arr)){
        const n = arr.find(v=>v && (v.id===x || v.idx===x || v.index===x || v.nodeId===x));
        if(n) return n;
      }
    }
    return null;
  }
  function ownerOf(n){
    if(!n) return null;
    return n.owner ?? n.team ?? n.player ?? n.side ?? n.colorId ?? null;
  }
  function inferAction(src,dst){
    const s=normNode(src), d=normNode(dst);
    const so=ownerOf(s), doo=ownerOf(d);
    if(so==null || doo==null) return null;
    return (so===doo) ? "transfer" : "attack";
  }
  function wrap(fnName){
    const fn=window[fnName];
    if(typeof fn!=="function") return false;
    window[fnName]=function(...args){
      try{
        const act=inferAction(args[0], args[1]);
        if(act){
          // rewrite last "mode" argument if present
          for(let i=args.length-1;i>=0;i--){
            if(typeof args[i]==="string" && (args[i].includes("transfer") || args[i].includes("attack"))){
              args[i]=act; break;
            }
            if(typeof args[i]==="boolean"){
              args[i]=(act==="attack"); break;
            }
          }
        }
      }catch{}
      return fn.apply(this,args);
    };
    return true;
  }

  const names=[
    "sendTroops","dispatchTroops","issueOrder","sendUnits","sendArmy",
    "send","doSend","executeSend","applySend","makeMove"
  ];
  let ok=false;
  for(const n of names) ok = wrap(n) || ok;
  if(!ok){
    console.warn("[state_patch] No known send function found. Add it to names[] in state_patch.js.");
  }else{
    console.log("[state_patch] Auto Attack/Transfer enabled.");
  }
})();
