(function(){
  const txt = (s)=> (s||"").toLowerCase().trim();
  function route(t){
    if(t==="play") location.href="play.html";
    if(t==="read") location.href="read.html";
    if(t==="settings") location.href="settings.html";
  }
  document.addEventListener("click",(e)=>{
    const el=e.target.closest("button,a,div");
    if(!el) return;
    const t=txt(el.textContent);
    if(t==="play"||t.startsWith("play")) return route("play");
    if(t==="read"||t.startsWith("read")) return route("read");
    if(t==="settings"||t.startsWith("settings")) return route("settings");
  }, true);
})();
