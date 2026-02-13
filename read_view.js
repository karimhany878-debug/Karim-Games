
// read_view.js - render one adhkar JSON file (offline)
(function(){
  const $ = (s)=>document.querySelector(s);
  const toast = (msg)=>{
    const t = $("#toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(window.__toastT);
    window.__toastT=setTimeout(()=>t.classList.add("hidden"),1800);
  };

  const file = window.ADH_KAR_FILE;
  const title = window.ADH_KAR_TITLE || "الذكر";
  $("#title").textContent = title;

  fetch(file).then(r=>r.json()).then(data=>{
    const items = (data.items||[]);
    const list = $("#list");
    list.innerHTML = "";
    if(!items.length){
      list.innerHTML = `<div class="card"><div class="p">لا يوجد محتوى.</div></div>`;
      return;
    }
    // restore progress
    const key = "adhkar_progress::"+file;
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    items.forEach((it, i)=>{
      const id = it.id || ("i_"+i);
      const repeat = Math.max(1, Number(it.repeat||1));
      const done = Number(saved[id]||0);

      const card = document.createElement("div");
      card.className="card";
      card.innerHTML = `
        <div class="row">
          <div class="h">${escapeHtml(it.source||"")}</div>
          <div class="badge"><span class="muted">التكرار</span> <b>${repeat}</b></div>
        </div>
        <pre class="text">${escapeHtml(it.text||"")}</pre>
        <div class="row actions">
          <button class="btn small" data-act="dec">-</button>
          <div class="count"><b data-k="done">${done}</b> / <span>${repeat}</span></div>
          <button class="btn small" data-act="inc">+</button>
          <button class="btn small ghost" data-act="reset">إعادة</button>
          <button class="btn small ghost" data-act="copy">نسخ</button>
        </div>
      `;
      const doneEl = card.querySelector('[data-k="done"]');
      const setDone = (v)=>{
        v=Math.max(0, Math.min(repeat, v));
        doneEl.textContent = String(v);
        saved[id]=v;
        localStorage.setItem(key, JSON.stringify(saved));
        card.classList.toggle("ok", v>=repeat);
      };
      setDone(done);

      card.addEventListener("click",(e)=>{
        const b = e.target.closest("button");
        if(!b) return;
        const act = b.getAttribute("data-act");
        if(act==="inc") setDone(doneEl.textContent*1 + 1);
        if(act==="dec") setDone(doneEl.textContent*1 - 1);
        if(act==="reset") setDone(0);
        if(act==="copy"){
          const txt=(it.text||"").trim();
          navigator.clipboard?.writeText(txt).then(()=>toast("تم النسخ")).catch(()=>toast("انسخ يدويًا"));
        }
      });

      list.appendChild(card);
    });
  }).catch(err=>{
    console.error(err);
    $("#list").innerHTML = `<div class="card"><div class="p">تعذر تحميل الملف: ${escapeHtml(String(err))}</div></div>`;
  });

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
})();
