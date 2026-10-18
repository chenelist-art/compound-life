/* Compound Life pixel character: a tiny scene (56×44 pixels, scaled up with image-rendering: pixelated) drawn in code from
   the life's state each year: age (baby → elder), career outfit, partner and children, wealth (clothes, watch, house, car),
   mood and health (face, bandage or hospital gown, a rain cloud during depression). Only the six palette colours are used,
   and every sprite gets a charcoal outline so it sits with the picture-book art.
   Pixel.stateOf(s) reads a life; Pixel.set(canvas, state) draws it (and keeps it gently animated); Pixel.cheer(canvas) jumps. */
(function(){
const W=56,H=44,GROUND=41;
/* palette indices: 0 empty, 1 charcoal, 2 washi, 3 coral, 4 yamabuki, 5 mizu, 6 wakatake */
const CH=1,WH=2,CO=3,YA=4,MI=5,WA=6;
let RGB=null;
function palette(){if(RGB)return RGB;const cs=getComputedStyle(document.documentElement);
 RGB=[null].concat(['--charcoal','--washi','--coral','--yamabuki','--mizu','--wakatake'].map(n=>{const h=cs.getPropertyValue(n).trim().replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}));return RGB}
const reduce=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* a layer of palette indices */
function buf(){const b=new Uint8Array(W*H);return{b,
 px(x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<W&&y<H)b[y*W+x]=c},
 rect(x,y,w,h,c){for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.px(x+i,y+j,c)},
 get(x,y){return x>=0&&y>=0&&x<W&&y<H?b[y*W+x]:0}}}
/* every empty pixel touching a filled one becomes charcoal */
function outline(l){const o=new Uint8Array(l.b);for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(l.b[y*W+x])continue;
 if(l.get(x-1,y)||l.get(x+1,y)||l.get(x,y-1)||l.get(x,y+1))o[y*W+x]=CH}l.b.set(o)}
/* draw one outlined sprite onto the scene; `det` adds inner details (eyes, ties) after the outline */
function sprite(scene,draw,det){const l=buf();draw(l);outline(l);if(det)det(l);for(let i=0;i<W*H;i++)if(l.b[i])scene.b[i]=l.b[i]}

/* body sizes: head w/h, torso w/h, legs, arm width */
const GEO={child:{hw:8,hh:8,tw:7,th:5,lh:4,aw:1},teen:{hw:8,hh:8,tw:8,th:7,lh:6,aw:2},adult:{hw:9,hh:9,tw:10,th:8,lh:8,aw:2},elder:{hw:9,hh:9,tw:10,th:8,lh:7,aw:2},
 k1:{hw:5,hh:5,tw:5,th:3,lh:2,aw:1},k2:{hw:6,hh:6,tw:6,th:4,lh:3,aw:1},k3:{hw:7,hh:7,tw:7,th:5,lh:4,aw:1}};
const stageOf=a=>a<3?'baby':a<13?'child':a<18?'teen':a<65?'adult':'elder';
function geo(g,cx,fy){const ty=fy-g.lh-g.th+1,hy=ty-g.hh,tx=cx-Math.floor(g.tw/2),hx=cx-Math.floor(g.hw/2);return Object.assign({cx,fy,ty,hy,tx,hx},g)}

/* ---------- outfits: shirt and trousers colours, plus extras drawn before (o) and after (d) the outline ---------- */
const suit=(jk,tie)=>({sh:jk,pa:jk,o:(l,p)=>{l.rect(p.cx-1,p.ty,2,p.th,WH)},d:(l,p)=>{l.rect(p.cx-1,p.ty+1,1,p.th-2,tie);l.px(p.cx,p.ty+1,tie)}});
const over=(top,c)=>(l,p)=>{l.rect(p.tx,p.ty+top,p.tw,p.th-top,c);l.rect(p.tx+1,p.fy-p.lh+1,p.tw-2,2,c)};
const hat=(c,h,brim)=>(l,p)=>{l.rect(p.hx-(brim||0),p.hy-1,p.hw+2*(brim||0),1,c);l.rect(p.hx+1,p.hy-h,p.hw-2,h,c)};
const prop=(f)=>({prop:f});
const OUT={
 acct:suit(MI,CO),bank:suit(MI,YA),law:Object.assign(suit(MI,CO),prop((l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.fy-p.lh-1,5,4,YA)})),
 civ:Object.assign(suit(WA,MI),{d2:(l,p)=>l.px(p.cx+2,p.ty+3,YA)}),mkt:suit(CO,YA),
 prop:Object.assign(suit(MI,WA),prop((l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty+p.th-3,3,2,YA);l.px(x+3,p.ty+p.th-3,YA)})),
 ins:Object.assign(suit(MI,CO),prop((l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty+2,4,6,WH)})),
 trade:Object.assign(suit(MI,YA),prop((l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty+1,6,5,WH)}),{pd:(l,p)=>{const x=p.tx+p.tw+p.aw+1,y=p.ty+4;[[0,0],[1,-1],[2,0],[3,-2],[4,-3]].forEach(([i,j])=>l.px(x+i,y+j,WA))}}),
 swe:{sh:WA,pa:MI,prop:(l,p)=>{l.rect(p.cx-4,p.ty+3,8,4,MI);l.rect(p.cx-5,p.ty+7,10,1,WH)}},
 start:{sh:MI,pa:MI,prop:(l,p)=>{l.rect(p.cx-4,p.ty+3,8,4,WH);l.rect(p.cx-5,p.ty+7,10,1,MI)}},
 teach:{sh:YA,pa:MI,prop:(l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty+3,4,5,CO)}},
 nurse:{sh:MI,pa:MI,hat:(l,p)=>l.rect(p.hx+2,p.hy-2,p.hw-4,2,WH),d:(l,p)=>{l.px(p.cx,p.hy-2,CO)}},
 doc:{sh:MI,pa:MI,o:(l,p)=>{l.rect(p.tx,p.ty,Math.floor(p.tw/2)-1,p.th+3,WH);l.rect(p.cx+2,p.ty,Math.ceil(p.tw/2)-2,p.th+3,WH);l.rect(p.tx-p.aw,p.ty+1,p.aw,p.th-2,WH);l.rect(p.tx+p.tw,p.ty+1,p.aw,p.th-2,WH)},
  d:(l,p)=>{l.px(p.cx-2,p.ty+1,CH);l.px(p.cx-2,p.ty+2,CH);l.px(p.cx-1,p.ty+3,CH);l.px(p.cx,p.ty+4,MI)}},
 chef:{sh:WH,pa:MI,hat:(l,p)=>{l.rect(p.hx+1,p.hy-4,p.hw-2,4,WH);l.rect(p.hx,p.hy-6,p.hw,3,WH)},d:(l,p)=>{l.px(p.cx-1,p.ty+2,CH);l.px(p.cx-1,p.ty+5,CH)}},
 elec:{sh:YA,pa:MI,o:over(3,MI),hat:hat(YA,2,1),d:(l,p)=>{l.px(p.cx,p.ty+4,YA);l.px(p.cx-1,p.ty+5,YA)}},
 mech:{sh:MI,pa:MI,prop:(l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty+p.th-4,1,5,WH);l.rect(x-1,p.ty+p.th-5,3,1,WH)}},
 cons:{sh:MI,pa:MI,o:(l,p)=>{l.rect(p.tx,p.ty,3,p.th,YA);l.rect(p.tx+p.tw-3,p.ty,3,p.th,YA)},hat:hat(YA,3,1)},
 drv:{sh:MI,pa:MI,hat:(l,p)=>{l.rect(p.hx,p.hy-1,p.hw,2,CO);l.rect(p.hx+p.hw-1,p.hy,3,1,CO)}},
 fact:{sh:WA,pa:WA,hat:hat(MI,2,0)},
 farm:{sh:WA,pa:MI,o:over(4,MI),hat:hat(YA,3,3)},
 design:{sh:YA,pa:MI,hat:(l,p)=>{l.rect(p.hx,p.hy-1,p.hw+1,2,CO);l.px(p.hx+p.hw,p.hy-2,CO)},prop:(l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty,1,6,CH);l.rect(x,p.ty-1,1,1,CO)}},
 music:{sh:CO,pa:MI,prop:(l,p)=>{l.rect(p.cx-3,p.ty+3,6,5,YA);l.rect(p.cx+3,p.ty-1,1,5,YA)},pd:(l,p)=>l.px(p.cx-1,p.ty+5,CH)},
 infl:{sh:CO,pa:MI,prop:(l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.hy+2,2,4,MI);l.px(x+3,p.hy,CO)}},
 actor:{sh:WH,pa:MI,o:(l,p)=>l.rect(p.tx,p.ty,p.tw,2,CO),prop:(l,p)=>{const x=p.tx+p.tw+p.aw+2;l.px(x,p.hy+1,YA);l.px(x-1,p.hy+2,YA);l.px(x+1,p.hy+2,YA);l.px(x,p.hy+3,YA)}},
 writer:{sh:MI,pa:WA,prop:(l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty+3,4,5,WH)},d:(l,p)=>{const y=p.hy+Math.floor(p.hh/2);l.rect(p.cx-3,y,7,1,CH)}},
 foot:{sh:CO,pa:WH,legs:'shorts',d:(l,p)=>l.rect(p.cx-1,p.ty+2,2,3,WH),prop:(l,p)=>{const x=p.tx+p.tw+2;l.rect(x,p.fy-3,4,4,WH)},pd:(l,p)=>{const x=p.tx+p.tw+2;l.px(x+1,p.fy-2,CH);l.px(x+2,p.fy-1,CH)}},
 badm:{sh:MI,pa:WH,legs:'shorts',prop:(l,p)=>{const x=p.tx+p.tw+p.aw;l.rect(x,p.ty+2,1,6,CH);l.rect(x-1,p.ty-3,3,5,MI)}},
 esp:{sh:CO,pa:MI,d:(l,p)=>{l.rect(p.hx-1,p.hy+3,2,3,MI);l.rect(p.hx+p.hw-1,p.hy+3,2,3,MI);l.px(p.hx+1,p.hy+6,CH);l.px(p.hx+2,p.hy+7,CH)}},
 coach:{sh:WA,pa:MI,legs:'shorts',arms:'bare',d:(l,p)=>{l.px(p.cx,p.ty+1,CH);l.px(p.cx,p.ty+2,YA)}},
 hawker:{sh:CO,pa:MI,o:(l,p)=>{l.rect(p.tx+2,p.ty+2,p.tw-4,p.th-2,WH);l.rect(p.tx+2,p.fy-p.lh+1,p.tw-4,3,WH)},hat:(l,p)=>l.rect(p.hx,p.hy+1,p.hw,1,WH)},
 shop:{sh:MI,pa:MI,o:(l,p)=>{l.rect(p.tx+2,p.ty+2,p.tw-4,p.th-2,WA);l.rect(p.tx+2,p.fy-p.lh+1,p.tw-4,3,WA)},d:(l,p)=>l.px(p.tx+2,p.ty+3,YA)}
};
/* everyday clothes by wealth (0 poor, 1 comfortable, 2 rich), students, schoolchildren, retirement */
function casual(w,i){return w>=2?{sh:WH,pa:MI,o:(l,p)=>{l.rect(p.tx,p.ty,3,p.th,CO);l.rect(p.tx+p.tw-3,p.ty,3,p.th,CO)}}:w===1?{sh:[MI,WA,YA,CO][i%4],pa:MI}:{sh:WA,pa:MI,d:(l,p)=>l.rect(p.tx+1,p.fy-3,2,2,CO)}}

/* one person: legs, torso, arms, head and hair, then the outfit, then the face */
function person(sc,o){const g=GEO[o.st],p=geo(g,o.cx,o.fy),f=o.fit||{},elder=o.st==='elder';
 const hair=elder?MI:CH,sh=f.sh||WA,pa=f.pa||MI;
 sprite(sc,l=>{
  const lw=Math.max(1,Math.floor((p.tw-3)/2)),ly=p.fy-p.lh+1;
  for(const x of [p.tx+1,p.tx+p.tw-1-lw]){if(f.legs==='shorts'){const k=Math.ceil(p.lh/2);l.rect(x,ly,lw,k,pa);l.rect(x,ly+k,lw,p.lh-k,WH)}else l.rect(x,ly,lw,p.lh,pa);l.rect(x,p.fy,lw,1,CH)}
  l.rect(p.tx,p.ty,p.tw,p.th,sh);
  const arm=f.arms==='bare'?WH:sh;
  l.rect(p.tx-p.aw,p.ty+1,p.aw,p.th-1,arm);l.rect(p.tx+p.tw,p.ty+1,p.aw,p.th-1,arm);
  l.rect(p.tx-p.aw,p.ty+p.th-1,p.aw,1,WH);l.rect(p.tx+p.tw,p.ty+p.th-1,p.aw,1,WH);
  if(f.o)f.o(l,p);
  l.rect(p.hx,p.hy,p.hw,p.hh,WH);
  l.rect(p.hx+1,p.hy,p.hw-2,2,hair);l.rect(p.hx,p.hy+1,1,2,hair);l.rect(p.hx+p.hw-1,p.hy+1,1,2,hair);
  if(o.sex==='f'){l.rect(p.hx-1,p.hy+1,1,p.hh+1,hair);l.rect(p.hx+p.hw,p.hy+1,1,p.hh+1,hair)}
  if(f.hat)f.hat(l,p);
  if(o.band)l.rect(p.hx,p.hy+2,p.hw,1,YA);
 },l=>{
  if(f.d)f.d(l,p);if(f.d2)f.d2(l,p);
  if(o.watch)l.px(p.tx-p.aw,p.ty+p.th-2,YA);
  if(o.band){l.px(p.hx+p.hw-3,p.hy+2,CO);l.px(p.hx+2,p.hy+2,CO)}
  if(o.gown){for(let y=p.ty+1;y<p.ty+p.th;y+=2)for(let x=p.tx+1+(y%4?0:1);x<p.tx+p.tw-1;x+=3)l.px(x,y,WH)}
  face(l,p,o)});
 if(f.prop)sprite(sc,l=>f.prop(l,p),f.pd?l=>f.pd(l,p):null);
 if(elder)sprite(sc,l=>{const x=p.tx+p.tw+p.aw+1;l.rect(x,p.ty+p.th-1,1,p.fy-p.ty-p.th+2,YA);l.rect(x-1,p.ty+p.th-2,2,1,YA)});
 return p}
/* the face follows Happiness: smile, flat or sad; blinking; closed eyes at the end */
function face(l,p,o){const big=p.hh>=8,ey=p.hy+(big?4:3),ex1=p.cx-2,ex2=p.cx+1,mood=o.sleep?'happy':o.mood||'happy';
 if(o.sleep){l.rect(ex1-1,ey+1,2,1,CH);l.rect(ex2,ey+1,2,1,CH)}
 else if(o.blink){l.px(ex1,ey+1,CH);l.px(ex2,ey+1,CH)}
 else{l.px(ex1,ey,CH);l.px(ex2,ey,CH);if(big){l.px(ex1,ey+1,CH);l.px(ex2,ey+1,CH)}}
 const my=ey+(big?3:2);
 if(mood==='happy'){l.px(ex1,my,CH);l.px(ex1+1,my+1,CH);l.px(ex2-1,my+1,CH);l.px(ex2,my,CH);if(big){l.px(ex1-1,my-1,CO);l.px(ex2+1,my-1,CO)}}
 else if(mood==='flat'){l.rect(ex1+1,my+1,2,1,CH)}
 else{l.px(ex1,my+1,CH);l.px(ex1+1,my,CH);l.px(ex2-1,my,CH);l.px(ex2,my+1,CH)}}
/* a baby: a bundle in a blanket */
function baby(sc,cx,fy,c,o){sprite(sc,l=>{l.rect(cx-4,fy-5,9,6,c);l.rect(cx-3,fy-6,7,1,c);l.rect(cx-2,fy-5,5,4,WH)},l=>{l.px(cx-1,fy-4,CH);l.px(cx+1,fy-4,CH);if(!o||o.mood!=='sad')l.px(cx,fy-2,CO)})}
function kid(sc,a,cx,fy,i,mood){const c=[CO,YA,MI,WA][i%4];if(a<3){baby(sc,cx,fy,c,{mood});return}
 person(sc,{st:a<10?'k1':a<18?'k2':'k3',cx,fy,sex:i%2?'f':'m',mood,fit:{sh:c,pa:MI}})}
function house(sc){sprite(sc,l=>{l.rect(2,28,18,14,YA);for(let i=0;i<7;i++)l.rect(1+i,27-i,20-2*i,1,CO);l.rect(9,34,4,8,MI);l.rect(4,31,3,3,MI);l.rect(15,31,3,3,MI)})}
function car(sc){sprite(sc,l=>{l.rect(38,35,17,5,MI);l.rect(42,31,9,4,MI);l.rect(43,32,3,2,WH);l.rect(47,32,3,2,WH)},l=>{l.rect(40,39,3,2,CH);l.rect(50,39,3,2,CH)})}
function cloud(sc,cx,y){sprite(sc,l=>{l.rect(cx-5,y,11,3,WH);l.rect(cx-3,y-1,7,1,WH);for(const x of [cx-3,cx,cx+3])l.rect(x,y+4,1,2,MI)})}
/* tiny digits for "+2" when there are more than four children */
const DIG={'+':['000','010','111','010','000'],0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['111','001','111','100','111'],3:['111','001','111','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],6:['111','100','111','101','111'],7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','111']};
function text(sc,str,x,y){sprite(sc,l=>{let cx=x;for(const ch of str){const g=DIG[ch];if(g)g.forEach((r,j)=>[...r].forEach((v,i)=>{if(v==='1')l.px(cx+i,y+j,YA)}));cx+=4}})}
function sparkles(sc,cx,top,k){const pts=[[-9,4],[9,2],[-7,-3],[8,-4],[0,-7]];pts.forEach(([dx,dy],i)=>{if((i+k)%2)return;const x=cx+dx,y=top+dy;sprite(sc,l=>{l.px(x,y,YA);l.px(x-1,y,YA);l.px(x+1,y,YA);l.px(x,y-1,YA);l.px(x,y+1,YA)})})}

/* ---------- the whole scene ---------- */
function scene(st,fr){const sc=buf();fr=fr||{};
 sprite(sc,l=>l.rect(0,GROUND+1,W,H-GROUND-1,WA));
 if(st.house)house(sc);if(st.vehicle)car(sc);
 const stg=stageOf(st.age),up=fr.up||0,mainX=st.partner?22:28;
 let top=0;
 if(stg==='baby')baby(sc,mainX,GROUND-up,MI,st);
 else{const fit=st.ill==='gown'?{sh:MI,pa:MI}:st.fit?OUT[st.fit]||casual(st.wealth,0):st.study?{sh:YA,pa:MI,prop:(l,p)=>l.rect(p.tx-p.aw-3,p.ty+1,3,5,CO)}:casual(st.wealth,0);
  const p=person(sc,{st:stg,cx:mainX,fy:GROUND-up,sex:st.sex,mood:st.mood,blink:fr.blink,sleep:st.sleep,fit,watch:st.wealth>=2&&stg!=='child',band:st.ill==='band',gown:st.ill==='gown'});top=p.hy}
 if(st.partner&&stg!=='baby'&&stg!=='child')person(sc,{st:stg,cx:37,fy:GROUND,sex:st.sex==='f'?'m':'f',mood:'happy',blink:fr.blink2,fit:st.wealth>=2?casual(2):{sh:st.fit==='foot'||st.fit==='chef'?YA:CO,pa:MI},watch:st.wealth>=2});
 const ks=(st.kids||[]).slice(0,4),pos=[[47,GROUND+1],[11,GROUND+1],[52,GROUND+1],[5,GROUND+1]];
 ks.forEach((a,i)=>kid(sc,a,pos[i][0],pos[i][1],i,st.mood==='sad'?'flat':'happy'));
 if((st.kids||[]).length>4)text(sc,'+'+(st.kids.length-4),45,1);
 if(st.dep&&stg!=='baby')cloud(sc,mainX,Math.max(2,top-7));
 if(fr.cheer!=null)sparkles(sc,mainX,top+2,fr.cheer);
 return sc}
function paint(cv,st,fr){if(cv.width!==W){cv.width=W;cv.height=H}const ctx=cv.getContext('2d'),img=ctx.createImageData(W,H),P=palette(),sc=scene(st,fr);
 for(let i=0;i<W*H;i++){const c=sc.b[i];if(!c)continue;const k=P[c];img.data[i*4]=k[0];img.data[i*4+1]=k[1];img.data[i*4+2]=k[2];img.data[i*4+3]=255}
 ctx.putImageData(img,0,0)}

/* ---------- a life's state (engine globals: netWorth, sick, depressed) ---------- */
function stateOf(s){const age=s.dead?s.deathAge:s.age,nw=netWorth(s),B=s.base,h=s.happy;
 return{age,sex:s.sex,fit:s.job&&!s.retired&&!s.study&&!(s.job.train>s.age)?s.job.id:s.job&&s.job.train>s.age?(s.job.id==='doc'?'doc':'law'):null,
  study:!!s.study,partner:!!s.married,kids:s.kids.map(b=>age-b).filter(a=>a>=0),
  wealth:nw<.5*B?0:nw<10*B?1:2,house:!!s.house,vehicle:!!s.car,mood:h>=60?'happy':h>=35?'flat':'sad',
  ill:s.illAge===s.age&&!s.dead?'gown':sick(s)?'band':null,dep:depressed(s),sleep:!!s.dead}}

/* ---------- animation: a small bounce, blinking, and a jump at big moments ---------- */
const live=new Map();let timer=null;
function frame(e,t){const f={},c=e.cheer>t;
 if(c){const k=Math.floor((1-(e.cheer-t)/1200)*12);f.up=[0,2,4,5,5,4,2,0,2,3,2,0][k]||0;f.cheer=k}
 else if(!reduce){f.up=Math.floor((t+e.off)/700)%2;const b=(t+e.off)%3600;f.blink=b<140;f.blink2=(t+e.off+1700)%4100<140}
 if(reduce&&c){f.up=0;f.cheer=0}
 return f}
function tick(){const t=performance.now();for(const[cv,e]of live){if(!cv.isConnected){live.delete(cv);continue}const f=frame(e,t),key=JSON.stringify(f);if(key!==e.key){e.key=key;paint(cv,e.st,f)}}
 if(!live.size){clearInterval(timer);timer=null}}
function set(cv,st,still){if(!cv||!st)return;let e=live.get(cv);if(!e){e={off:Math.random()*3000};if(!still)live.set(cv,e)}e.st=st;e.key='';paint(cv,st,frame(e,performance.now()));
 if(!still&&!timer)timer=setInterval(tick,reduce?400:90)}
function cheer(cv){const e=live.get(cv);if(e){e.cheer=performance.now()+1200;e.key=''}}
window.Pixel={stateOf,set,cheer,paint,W,H};
})();
