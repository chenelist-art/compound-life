/* Rosettes, redrawn as picture-book suns and moons.
   A rosette is a list of bands drawn in order (outermost first). Each band is a ring of `s` strands
   that wave `p` times around the circle; a band with `fill` is a scalloped disc in a palette colour,
   a band without one is a fine woven lace in charcoal. Changing `phase` turns the scallops.
   `core` is the sun or moon in the middle, with a face; `stars` is a ring of little stars. */
(function(){
  const VAR={coral:'--coral',yamabuki:'--yamabuki',mizu:'--mizu',wakatake:'--wakatake',washi:'--washi',charcoal:'--charcoal'};
  function token(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}
  const col=c=>token(VAR[c]||'--charcoal');
  function size(cv){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=cv.clientWidth||cv.width, h=cv.clientHeight||w;
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
    const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    return{ctx,w,h};
  }
  function band(ctx,cx,cy,R,b,phase){
    const rb=b.r*R, A=b.a*R, p=b.p, S=b.s||1, N=b.n||Math.max(240,p*16);
    const dir=b.dir||1, TAU=Math.PI*2;
    for(let k=0;k<S;k++){
      const off=k/S*TAU/p;
      ctx.beginPath();
      for(let i=0;i<=N;i++){
        const t=i/N*TAU;
        const r=rb+A*Math.sin(p*(t+off)+phase*dir*(b.spd||1));
        const x=cx+r*Math.cos(t), y=cy+r*Math.sin(t);
        if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
      }
      ctx.closePath();
      if(b.fill){ctx.fillStyle=col(b.fill);ctx.fill()}
      ctx.stroke();
    }
  }
  function star(ctx,x,y,r,rot){
    ctx.beginPath();
    for(let i=0;i<10;i++){const a=rot-Math.PI/2+i*Math.PI/5,q=i%2?r*.5:r;const px=x+q*Math.cos(a),py=y+q*Math.sin(a);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py)}
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  function face(ctx,x,y,r,mood){
    const ex=r*.34, ey=y-r*.06, er=Math.max(1.6,r*.075);
    ctx.save();ctx.lineWidth=Math.max(2,Math.min(3.5,r*.07));
    ctx.fillStyle=col('coral');
    for(const s of [-1,1]){ctx.beginPath();ctx.ellipse(x+s*r*.56,y+r*.2,r*.15,r*.09,0,0,7);ctx.fill()}
    ctx.fillStyle=col('charcoal');
    for(const s of [-1,1]){
      ctx.beginPath();
      if(mood==='sleep'){ctx.arc(x+s*ex,ey,er*1.5,.15*Math.PI,.85*Math.PI);ctx.stroke()}
      else{ctx.arc(x+s*ex,ey,er,0,7);ctx.fill()}
    }
    ctx.beginPath();
    if(mood==='sad')ctx.arc(x,y+r*.42,r*.2,1.2*Math.PI,1.8*Math.PI);
    else ctx.arc(x,y+r*.1,r*.2,.15*Math.PI,.85*Math.PI);
    ctx.stroke();ctx.restore();
  }
  function render(cv,cfg){
    const{ctx,w,h}=size(cv);
    ctx.clearRect(0,0,w,h);
    const cx=w/2, cy=h/2, R=Math.min(w,h)/2*(cfg.scale||.96);
    const ph=cfg.phase||0, ink=col('charcoal');
    ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=ink;
    for(const g of (cfg.guides||[])){
      ctx.save();ctx.lineWidth=g.lw||2;ctx.setLineDash(g.dash||[2,6]);ctx.beginPath();ctx.arc(cx,cy,g.r*R,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    for(const b of cfg.bands){
      ctx.save();ctx.strokeStyle=ink;ctx.lineWidth=b.lw||(b.fill?3:1.4);
      band(ctx,cx,cy,R,b,ph);
      ctx.restore();
    }
    const st=cfg.stars;
    if(st){ctx.save();ctx.lineWidth=st.lw||2;ctx.fillStyle=col(st.fill||'yamabuki');
      for(let i=0;i<st.n;i++){const a=i/st.n*Math.PI*2+ph*(st.spd||.3);star(ctx,cx+st.r*R*Math.cos(a),cy+st.r*R*Math.sin(a),st.size*R,a)}
      ctx.restore()}
    const c=cfg.core;
    if(c){const r=c.r*R;ctx.save();ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fillStyle=col(c.fill||'yamabuki');ctx.fill();ctx.stroke();
      if(c.craters){ctx.lineWidth=2;for(const[dx,dy,cr]of [[-.5,-.48,.13],[.52,-.4,.09],[.12,-.66,.07],[.6,.5,.08]]){ctx.beginPath();ctx.arc(cx+dx*r,cy+dy*r,cr*r,0,7);ctx.stroke()}}
      if(c.face)face(ctx,cx,cy+r*.06,r*.82,c.face);
      ctx.restore()}
  }
  /* the turning sun on the landing page */
  const SUN={bands:[
    {r:.9,a:.06,p:14,fill:'coral',dir:1},
    {r:.71,a:.025,p:30,fill:'washi',dir:-1},
    {r:.6,a:.07,p:12,s:3,lw:1.5,dir:1}],
    core:{r:.44,fill:'yamabuki',face:'happy'}};
  /* the sleeping moon behind the birth screen */
  const MOON={bands:[
    {r:.94,a:.035,p:24,fill:'mizu',dir:1},
    {r:.82,a:.03,p:16,s:2,lw:1.4,dir:-1},
    {r:.7,a:.02,p:36,fill:'washi',dir:1}],
    stars:{n:8,r:.82,size:.045},
    core:{r:.5,fill:'yamabuki',face:'sleep',craters:true}};
  window.Guilloche={render,token,SUN,MOON};
})();
