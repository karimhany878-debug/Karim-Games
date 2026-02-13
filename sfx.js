/* sfx.js - Offline procedural sound (pleasant, non-harsh)
   Uses localStorage key: karim_settings_v2 { sound:boolean, volume:number }
*/
(function(){
  const KEY="karim_settings_v2";

  function load(){
    try{
      const s=JSON.parse(localStorage.getItem(KEY)||"{}");
      return {
        on: (typeof s.sound==="boolean") ? s.sound : true,
        vol: (typeof s.volume==="number") ? s.volume : 0.35
      };
    }catch{ return {on:true, vol:0.35}; }
  }

  function ctx(){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    if(SFX._ac) return SFX._ac;
    SFX._ac = new AC();
    return SFX._ac;
  }

  function now(ac){ return ac.currentTime; }

  function env(g, t0, a, d, s, r, peak){
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.00001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.00001, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.00001, peak*s), t0 + a + d);
    g.gain.exponentialRampToValueAtTime(0.00001, t0 + a + d + r);
  }

  function tone(freq, dur, type, gain){
    const st=load();
    if(!st.on) return;
    const ac=ctx(); if(!ac) return;
    const t0=now(ac);
    const o=ac.createOscillator();
    const g=ac.createGain();
    const f=ac.createBiquadFilter();
    f.type="lowpass";
    f.frequency.value = Math.max(1200, Math.min(6000, freq*6));
    o.type = type || "sine";
    o.frequency.value = freq * (1 + (Math.random()*0.006 - 0.003));
    o.connect(f); f.connect(g); g.connect(ac.destination);

    const peak = Math.max(0.00001, st.vol * (gain||1) * 0.12);
    env(g, t0, 0.008, 0.05, 0.35, Math.max(0.06, dur||0.10), peak);

    o.start(t0);
    o.stop(t0 + Math.max(0.10, dur||0.12) + 0.02);
  }

  function chord(base, dur, gain){
    tone(base, dur, "triangle", gain);
    setTimeout(()=>tone(base*1.26, dur*0.92, "sine", (gain||1)*0.55), 12);
    setTimeout(()=>tone(base*1.50, dur*0.88, "sine", (gain||1)*0.42), 22);
  }

  function arpeggio(freqs, dur, gain){
    let i=0;
    function step(){
      if(i>=freqs.length) return;
      tone(freqs[i], dur, "triangle", gain);
      i++;
      setTimeout(step, Math.max(60, dur*1000*0.55));
    }
    step();
  }

  const SFX = window.SFX = {
    _ac:null,
    play(name){
      switch(String(name||"").toLowerCase()){
        case "click":   return tone(520, 0.10, "triangle", 0.9);
        case "select":  return tone(620, 0.12, "triangle", 1.0);
        case "move":    return tone(420, 0.12, "sine", 0.9);
        case "capture": return tone(240, 0.14, "triangle", 1.0);
        case "error":   return tone(160, 0.18, "sawtooth", 0.5);
        case "ok":      return chord(520, 0.14, 0.9);
        case "win":     return arpeggio([520,660,820,980], 0.14, 0.9);
        case "draw":    return arpeggio([420,420,420], 0.12, 0.65);
        case "lose":    return arpeggio([320,260,220], 0.16, 0.8);
        default:        return tone(440, 0.10, "sine", 0.7);
      }
    }
  };

  document.addEventListener("pointerdown", ()=>{
    const ac = ctx(); if(!ac) return;
    try{ if(ac.state==="suspended") ac.resume(); }catch{}
  }, {once:true, passive:true});
})();
