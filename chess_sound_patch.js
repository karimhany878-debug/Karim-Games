/* chess_sound_patch.js - override chess beep() to use SFX (pleasant) */
(function(){
  if(!window.SFX) return;
  window.beep = function(f=420, ms=55, v=0.05){
    if(f<=200) return SFX.play("win");                 // checkmate
    if(f>=240 -and f<=280 -and ms -ge 100) return SFX.play("draw"); // draw
    if(f<=260) return SFX.play("capture");            // capture
    return SFX.play("move");                           // normal move
  };
})();
