(() => {
  const $ = (id)=>document.getElementById(id);
  const win = $("winOverlay");
  const help = $("helpOverlay");

  const hide = (el)=> el && el.classList.add("hidden");
  const resetUI = ()=>{ hide(win); hide(help); };

  // عند أي إعادة فتح/استعادة تبويب: امسح أي حالة قديمة
  window.addEventListener("pageshow", resetUI);
  window.addEventListener("DOMContentLoaded", () => {
    resetUI();
    // ابدأ جولة جديدة تلقائيا
    setTimeout(() => $("btnNew")?.click(), 0);
  });

  // منع تداخل الـOverlays قسريا
  setInterval(() => {
    if (!win || !help) return;
    const winShown  = !win.classList.contains("hidden");
    const helpShown = !help.classList.contains("hidden");
    if (winShown && helpShown) hide(help);
  }, 120);

  // مفاتيح طوارئ
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") resetUI();
    if (e.key.toLowerCase() === "r") { resetUI(); $("btnNew")?.click(); }
  });
})();
