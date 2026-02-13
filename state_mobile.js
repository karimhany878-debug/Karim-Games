/* state_mobile.js - viewport fit + play mode */
(function(){
  const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;

  function setVH(){
    // fix 100vh on mobile browsers
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  setVH();
  window.addEventListener('resize', ()=>{ setVH(); tryKickResize(); });

  function tryKickResize(){
    // If game uses canvas sizing on resize, ensure it happens after UI changes
    try { window.dispatchEvent(new Event('resize')); } catch {}
  }

  function qs(id){ return document.getElementById(id); }
  const btnPlay = qs('btnPlay');
  const btnUI = qs('btnUI');
  const btnNew = qs('btnNew');

  function enterPlay(){
    document.body.classList.add('playing');
    tryKickResize();
    // sometimes canvas map is tiny before "New" is clicked on mobile; kick once
    if(btnNew) setTimeout(()=>{ try{ btnNew.click(); }catch{} }, 80);
  }
  function exitPlay(){
    document.body.classList.remove('playing');
    tryKickResize();
  }

  if(isMobile){
    if(btnPlay) btnPlay.addEventListener('click', (e)=>{ e.preventDefault(); enterPlay(); });
    if(btnUI) btnUI.addEventListener('click', (e)=>{ e.preventDefault(); exitPlay(); });
  } else {
    // hide play bar on desktop just in case
    const bar = qs('mobilePlayBar');
    if(bar) bar.style.display = 'none';
  }
})();
