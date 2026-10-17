/* Shared page helpers. The design is light-only (picture-book style), so there is no theme toggle.
   fitText shrinks a big number or headline marked data-fit so it never overflows its box. */
(function(){
  window.fitText=function(el){
    el.style.fontSize='';const p=el.parentElement;if(!p)return;const cs=getComputedStyle(p);
    const avail=p.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
    const c=el.cloneNode(true);c.removeAttribute('id');c.removeAttribute('data-fit');
    Object.assign(c.style,{position:'absolute',visibility:'hidden',animation:'none',transform:'none',width:'max-content',left:'0',top:'0'});
    p.appendChild(c);const w=c.getBoundingClientRect().width;c.remove();
    if(avail>0&&w>avail){const fs=parseFloat(getComputedStyle(el).fontSize);el.style.fontSize=(fs*avail/w*.97).toFixed(1)+'px'}
  };
  window.fitAll=()=>document.querySelectorAll('[data-fit]').forEach(window.fitText);
  window.fitAll();
  if(document.fonts)document.fonts.ready.then(window.fitAll);
  let ft;window.addEventListener('resize',()=>{clearTimeout(ft);ft=setTimeout(window.fitAll,100)});
})();
