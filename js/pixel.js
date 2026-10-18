/* Compound Life pixel character, chibi version: a 48×48 scene (scaled up with image-rendering: pixelated) drawn in code
   from the life's state each year. A big round head (about half the height) on a tiny round body with stubby arms and legs;
   a face with big sparkly eyes, coral blush and a tiny mouth that follows the mood (happy ^ ^, normal, teary, dizzy when
   ill, sleepy in old age); career outfits with one or two signature items; a partner, children who hold their parents'
   hands (babies are carried), house and car; little floating emotes (hearts, sparkles, a sweat drop, zzz, a rain cloud).
   The player has a small green sprout on top of the head. Only the six palette colours; every figure gets one soft
   1px charcoal outline (corners stay round, no lines inside the figure).
   Pixel.stateOf(s) reads a life; Pixel.set(canvas, state) draws it and keeps it alive (squash-and-stretch, blinking, a head
   tilt now and then); Pixel.cheer(canvas, kind) jumps, with hearts ('love') or sparkles ('yay', the default). */
(function(){
const W=48,H=48,FY=44;
/* palette indices: 0 empty, 1 charcoal, 2 washi, 3 coral, 4 yamabuki, 5 mizu, 6 wakatake */
const CH=1,WH=2,CO=3,YA=4,MI=5,WA=6;
const PM={'#':CH,w:WH,c:CO,y:YA,m:MI,g:WA};
let RGB=null;
function palette(){if(RGB)return RGB;const cs=getComputedStyle(document.documentElement);
 RGB=[null].concat(['--charcoal','--washi','--coral','--yamabuki','--mizu','--wakatake'].map(n=>{const h=cs.getPropertyValue(n).trim().replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}));return RGB}
const reduce=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- a layer of palette indices (plus which body part drew each pixel) ---------- */
function buf(){const b=new Uint8Array(W*H),p=new Uint8Array(W*H);return{b,p,part:0,
 px(x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<W&&y<H){b[y*W+x]=c;p[y*W+x]=this.part}},
 rect(x,y,w,h,c){for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.px(x+i,y+j,c)},
 get(x,y){return x>=0&&y>=0&&x<W&&y<H?b[y*W+x]:0},
 /* a rounded blob filling a w×h box (a superellipse: n=2 is an ellipse, higher is squarer) */
 blob(x,y,w,h,c,n){n=n||2.4;for(let j=0;j<h;j++)for(let i=0;i<w;i++){const dx=Math.abs(2*(i+.5)/w-1),dy=Math.abs(2*(j+.5)/h-1);if(dx**n+dy**n<=1)this.px(x+i,y+j,c)}},
 /* string art: one character per pixel ('.' skips); m maps extra letters */
 pat(x,y,rows,m){rows.forEach((r,j)=>{for(let i=0;i<r.length;i++){const k=r[i],c=(m&&m[k])||PM[k];if(c)this.px(x+i,y+j,c)}})}}}
/* every empty pixel touching a filled one (not diagonally, so corners stay round) becomes charcoal */
function outline(l){const o=new Uint8Array(l.b);for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(l.b[y*W+x])continue;
 if(l.get(x-1,y)||l.get(x+1,y)||l.get(x,y-1)||l.get(x,y+1))o[y*W+x]=CH}l.b.set(o)}
function put(sc,l){for(let i=0;i<W*H;i++)if(l.b[i])sc.b[i]=l.b[i]}
function sprite(sc,draw,det){const l=buf();draw(l);outline(l);if(det)det(l);put(sc,l)}
const flip=r=>r.map(s=>[...s].reverse().join(''));

/* ---------- sizes: head w/h, body w/h, legs, leg width ---------- */
const SZ={baby:{hw:13,hh:12,bw:11,bh:6,lh:0,lw:0},child:{hw:13,hh:12,bw:9,bh:6,lh:2,lw:2},teen:{hw:15,hh:13,bw:9,bh:7,lh:3,lw:2},
 adult:{hw:15,hh:14,bw:11,bh:7,lh:3,lw:3},elder:{hw:15,hh:14,bw:13,bh:7,lh:2,lw:3},
 kid:{hw:11,hh:10,bw:7,bh:5,lh:2,lw:2},kteen:{hw:11,hh:11,bw:7,bh:6,lh:3,lw:2}};
const stageOf=a=>a<3?'baby':a<13?'child':a<18?'teen':a<65?'adult':'elder';
/* where everything sits; sq 1 squashes (lower and wider), -1 stretches (taller) */
function geo(sz,cx,fy,sq){const z=SZ[sz],bw=z.bw+(sq>0?2:0),by1=fy-z.lh,by0=by1-z.bh+1+(sq||0),hy1=by0+1,hy0=hy1-z.hh+1,hx0=cx-(z.hw>>1),bx0=cx-(bw>>1),
 hy=by0+Math.min(4,z.bh-2);
 return{z,sz,cx,fy,bw,bx0,bx1:bx0+bw-1,by0,by1,hx0,hx1:hx0+z.hw-1,hy0,hy1,ey:hy0+(z.hh>=13?5:4),
  lh:{x:bx0-2,y:hy},rh:{x:bx0+bw,y:hy},ls:{x:bx0-2,y:by0+2},rs:{x:bx0+bw,y:by0+2}}}

/* ---------- the face: eyes by head width (15: 4×4, 13: 3×4, 11: 2×3), blush, a tiny mouth ---------- */
const EYE={
 15:{x:5,open:['.##.','#w##','####','.##.'],joy:['.##.','#..#'],shut:['#..#','.##.'],lid:['####'],
  swirl:['.##.','#..#','#.##','.#..'],bl:6},
 13:{x:4,open:['.#.','#w#','###','.#.'],joy:['.#.','#.#'],shut:['#.#','.#.'],lid:['###'],swirl:['##.','..#','#.#','.#.'],bl:5},
 11:{x:3,open:['##','w#','##'],joy:['.#.','#.#'],shut:['#.#','.#.'],lid:['##'],swirl:['##','.#','#.'],bl:4}};
function face(l,g,k){const E=EYE[g.z.hw],w=E.open[0].length,h=E.open.length,x1=g.cx-E.x,x2=g.cx+E.x-w+1,y=g.ey,my=y+h,
 both=(r,dy,mir)=>{l.pat(x1-(r[0].length>w?1:0),y+(dy||0),r);l.pat(x2,y+(dy||0),mir?flip(r):r)},
 blush=()=>{l.rect(g.cx-E.bl,my,2,1,CO);l.rect(g.cx+E.bl-1,my,2,1,CO)},mouth=r=>l.pat(g.cx-(r[0].length>>1),my,r);
 if(k==='happy'){both(E.joy,1);blush();mouth(w>2?['#.#.#','.#.#.']:['#.#','.#.'])}
 else if(k==='sad'){const r=E.open.slice(0,-1).concat([E.open[h-1].replace(/#/g,'m')]);both(r);l.rect(x1,my,1,2,MI);l.rect(x2+w-1,my,1,2,MI);mouth(['.#.','#.#'])}
 else if(k==='sick'){both(E.swirl,0,1);for(let i=-2;i<=2;i+=2)l.rect(g.cx+i,g.hy0+3,1,1,MI);mouth(w>2?['.#.#.','#.#.#']:['.#.','#.#'])}
 else if(k==='sleepy'){both(E.shut,h-2);blush();mouth(['#'])}
 else if(k==='peace'){both(E.shut,h-2);blush();mouth(['#.#','.#.'])}
 else{both(k==='blink'?E.lid:E.open,k==='blink'?h-2:0);blush();mouth(['#.#','.#.'])}}

/* ---------- hair: drawn over the head (so the head stays round), with a little shine ---------- */
function fringe(l,g,h,long,thin){const n=g.z.hw,base=thin?1:n>=11&&n<13?2:3,c=n>>1;for(let i=0;i<n;i++){const ed=Math.min(i,n-1-i);
 let d=base+(ed===0?4:ed===1?3:ed===2?1:0)+(!thin&&ed>=3&&(i-c)%3===0?1:0);if(long&&ed<=1)d=g.z.hh-2-ed;
 for(let j=0;j<d;j++){const x=g.hx0+i,y=g.hy0+j;if(l.get(x,y)===WH)l.px(x,y,h)}}}
function hairBack(l,g,o,h){const st=o.style;
 if(st==='bob'){l.rect(g.hx0-1,g.hy0+3,1,g.z.hh-4,h);l.rect(g.hx1+1,g.hy0+3,1,g.z.hh-4,h)}
 if(st==='bun')l.blob(g.cx-3,g.hy0-4,7,6,h,2.2);
 if(st==='pig'){l.blob(g.hx0-3,g.hy0+1,4,5,h,2.2);l.blob(g.hx1,g.hy0+1,4,5,h,2.2)}}
function hairFront(l,g,o,h){const st=o.style;
 if(st==='curl'){l.pat(g.cx-1,g.hy0-2,['.##','#..'],{'#':h});return}
 fringe(l,g,h,st==='bob',h===MI);
 const sx=g.hx0+(g.z.hw>=13?3:2);if(h===CH){l.px(sx,g.hy0+2,WH);l.px(sx+1,g.hy0+1,WH);if(g.z.hw>=13)l.px(sx+2,g.hy0+1,WH)}
 if(st==='tuft')l.pat(g.cx,g.hy0-3,['.#','#.','#.'],{'#':h});
 if(st==='bob')l.pat(g.hx1-4,g.hy0-1,['cc.cc','ccccc','cc.cc']);
 if(st==='bun')l.px(g.cx+3,g.hy0-1,CO);
 if(st==='pig'){l.px(g.hx0-1,g.hy0+2,CO);l.px(g.hx1+1,g.hy0+2,CO)}}

/* ---------- a limb: a 2×2 sleeve brush from the shoulder to the hand, then a round 2×2 hand ---------- */
function limb(l,s,h,c){const dx=h.x-s.x,dy=h.y-s.y,n=Math.max(Math.abs(dx),Math.abs(dy),1);
 for(let k=0;k<=n;k++)l.rect(s.x+Math.round(dx*k/n),s.y+Math.round(dy*k/n),2,2,c);l.rect(h.x,h.y,2,2,WH)}

/* ---------- props: string art held at a hand (the pixel ax,ay sits on the hand's top-left), mirrored for the left hand ---------- */
function held(sc,g,P){const side=P.side||1,h=side<0?g.lh:g.rh,r=typeof P.r==='function'?P.r(g):P.r,w=r[0].length;
 const rows=side<0?flip(r):r,x0=side<0?h.x+1-(w-1-P.ax):h.x-P.ax;sprite(sc,l=>l.pat(x0,h.y-P.ay,rows,P.m))}
/* a prop in front of the body (laptop, guitar: dx,dy from the body's top-centre) or on the ground (ball: dx from the body's right edge) */
function front(sc,g,P){const r=typeof P.r==='function'?P.r(g):P.r;sprite(sc,l=>l.pat(P.ground?g.bx1+P.dx:g.cx+P.dx,P.ground?g.fy-r.length+1:g.by0+P.dy,r,P.m))}

/* ---------- one chibi figure ---------- */
function figure(sc,o){const f=o.fit||{},g=geo(o.sz,o.cx,o.fy,o.sq),sh=f.sh||WA,pa=f.pa||MI,hair=o.hair||CH;
 if(o.hold){if(o.hold.L)g.lh=o.hold.L;if(o.hold.R)g.rh=o.hold.R}
 if(f.up&&!(o.hold&&o.hold.R))g.rh={x:g.bx1+2,y:g.by0-1};
 const props=(f.props||[]).concat(o.extra||[]),B=buf(),Hd=buf();
 /* legs, round body, arms */
 B.part=1;if(g.z.lh)for(const x of [g.cx-g.z.lw,g.cx+1]){if(f.legs==='shorts'){B.rect(x,g.by1+1,g.z.lw,1,pa);B.rect(x,g.by1+2,g.z.lw,g.z.lh-1,WH)}else B.rect(x,g.by1+1,g.z.lw,g.z.lh,pa)}
 else{B.rect(g.cx-5,g.fy,3,1,WH);B.rect(g.cx+3,g.fy,3,1,WH)}
 B.part=2;B.blob(g.bx0,g.by0,g.bw,g.z.bh+(g.z.lh?1:0),sh,2.2);if(f.body)f.body(B,g);
 B.part=3;const arm=f.arms==='bare'?WH:sh;limb(B,g.ls,g.lh,arm);limb(B,g.rs,g.rh,arm);
 if(o.watch)B.px(g.lh.x+1,g.lh.y-1,YA);
 /* head, hair, hat, face */
 Hd.part=4;hairBack(Hd,g,o,hair);Hd.blob(g.hx0,g.hy0,g.z.hw,g.z.hh,WH);hairFront(Hd,g,o,hair);
 let top=g.hy0-(o.style==='bun'?4:o.style==='tuft'?3:1);
 if(f.hat){const t=f.hat(Hd,g);if(t!=null)top=Math.min(top,t)}
 if(o.plaster)Hd.pat(g.cx+3,g.hy0+3,['yy.','.yy']);
 face(Hd,g,o.face||'normal');
 if(f.face)f.face(Hd,g);
 if(o.sprout){Hd.pat(g.cx-2,top-3,['gg.gg','.g#g.','..#..']);top-=3}
 /* a head tilt: everything above the eyes slides one pixel */
 const ch=buf();ch.b.set(B.b);ch.p.set(B.p);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=y<g.ey?x-(o.tilt||0):x,c=Hd.get(sx,y);if(c){ch.b[y*W+x]=c;ch.p[y*W+x]=4}}
 /* washi touching washi from another part (a white coat under the chin, a hand on a white apron) gets a thin line */
 const sep=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(ch.b[i]!==WH||!ch.p[i])continue;
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(ch.b[j]===WH&&ch.p[j]>ch.p[i]){sep.push(i);break}}}
 sep.forEach(i=>ch.b[i]=CH);
 outline(ch);if(f.det)f.det(ch,g);
 if(o.gown)for(let y=g.by0+2;y<=g.by1;y+=2)for(let x=g.bx0+1+((y>>1)%2);x<g.bx1;x+=3)if(ch.b[y*W+x]===MI)ch.px(x,y,WH);
 put(sc,ch);
 props.forEach(P=>P.front||P.ground?front(sc,g,P):held(sc,g,P));
 g.top=top;return g}

/* ---------- outfits: shirt and trousers, body extras (body), details after the outline (det), a hat, props ---------- */
const suit=(jk,tie,props)=>({sh:jk,pa:jk,body:(l,g)=>l.pat(g.cx-2,g.by0+2,['wwcww','.wcw.','..c..'],{c:tie}),props});
const P={
 calc:{r:['yyyyy','ywwwy','yyyyy','y#y#y','yyyyy','y#y#y','yyyyy'],ax:0,ay:4},
 coin:{r:['.yyy.','yywyy','ywyyy','yyyyy','.yyy.'],ax:0,ay:2},
 brief:{r:['.###.','.#.#.','ccccc','ccccc','ccycc','ccccc'],ax:2,ay:0},
 mega:{r:['....yy','..yyyy','yyyyyy','yyyyyy','..yyyy','....yy'],ax:0,ay:3},
 home:{r:['...c...','..ccc..','.ccccc.','ccccccc','.ywyyy.','.ywyyy.','.yyyyy.'],ax:1,ay:5},
 umb:{r:['...ccc...','.ccccccc.','ccccccccc','c.c.#.c.c','....#....','....#....','....#....','....#....','....#....','...##....'],ax:4,ay:8},
 chart:{r:['wwwwwww','wwwwwgw','wwwwgww','wgwgwww','wwgwwww','wwwwwww'],ax:6,ay:4},
 rocket:{r:['.c.','ccc','cwc','ccc','ccc','c.c','.y.'],ax:1,ay:4},
 book:{r:['cccc','cwwc','cccc','cccc','wwww'],ax:3,ay:2},
 stick:{r:['.....y','....y.','...y..','..y...','.y....','y.....'],ax:0,ay:5},
 bulb:{r:['.yyy.','yywyy','ywyyy','yyyyy','.yyy.','.mmm.','.mmm.'],ax:1,ay:5},
 wrench:{r:['y.y','y.y','yyy','.y.','.y.','.y.','.y.'],ax:0,ay:4},
 wheel:{r:['.mmmmm.','mmwwwmm','mww#wwm','m#####m','mww#wwm','mmwwwmm','.mmmmm.'],ax:0,ay:3},
 carrot:{r:['.g.g.','..g..','.ccc.','.ccc.','..cc.','..c..'],ax:1,ay:2},
 pencil:{r:['cc','yy','yy','yy','yy','yy','w#'],ax:0,ay:3},
 phone:{r:['mmmm','mwwm','mwwm','mwwm','mmmm'],ax:0,ay:4},
 star:{r:['...y...','..yyy..','yyyyyyy','.yyyyy.','.yy.yy.','.y...y.'],ax:3,ay:6},
 quill:{r:['.....w','....ww','...ww.','..ww..','.w....','#.....'],ax:0,ay:4},
 pad:{r:['wwwww','w###w','wwwww','w###w','wwwww'],ax:4,ay:2},
 racket:{r:['.www.','wmwmw','wwmww','wmwmw','.www.','..#..','..#..','..#..'],ax:1,ay:6},
 bell:{r:['mm.mm','mm#mm','mm.mm'],ax:1,ay:1},
 spat:{r:['wwww','wwww','wwww','.##.','.##.','.##.'],ax:1,ay:4},
 bag:{r:['.###.','.#.#.','yyyyy','ycccy','yyyyy','yyyyy'],ax:2,ay:0},
 cane:{r:g=>['.yy.','y..y','y...'].concat(Array(Math.max(1,g.fy-g.rh.y)).fill('y...')),ax:-1,ay:3},
 laptop:{front:true,r:['mmmmmmm','mmmmmmm','mmmwmmm','mmmmmmm','wwwwwww'],dx:-3,dy:2},
 guitar:{front:true,r:['..........yy','.........yy.','........y...','.......y....','.yyy..y.....','yyyyyy......','yyy#yy......','yy##yy......','yyyyyyy.....','.yyyyy......'],dx:-6,dy:-1},
 ball:{ground:true,r:['.www.','ww#ww','w###w','ww#ww','.www.'],dx:3}};
const Lh=p=>Object.assign({side:-1},p);
const OUT={
 acct:suit(MI,CO,[P.calc]),bank:suit(MI,YA,[P.coin]),law:suit(MI,CO,[P.brief]),prop:suit(WA,YA,[P.home]),ins:Object.assign(suit(MI,WH,[P.umb]),{up:1}),trade:suit(MI,CO,[Lh(P.chart)]),
 civ:{sh:WA,pa:MI,body:(l,g)=>{l.pat(g.cx-2,g.by0+2,['#...#','.#.#.','.yyy.','.yyy.'])}},
 mkt:{sh:CO,pa:MI,props:[P.mega]},
 swe:{sh:WA,pa:MI,body:(l,g)=>l.pat(g.cx-2,g.by0+2,['w...w','w...w']),props:[P.laptop]},
 start:{sh:MI,pa:MI,body:(l,g)=>l.pat(g.cx-2,g.by0+2,['w...w','w...w']),props:[P.rocket]},
 teach:{sh:YA,pa:MI,body:(l,g)=>{l.rect(g.cx-1,g.by0+2,3,1,WH);for(let y=g.by0+3;y<=g.by1;y+=2)l.px(g.cx,y,CO)},props:[Lh(P.book),P.stick]},
 nurse:{sh:MI,pa:MI,hat:(l,g)=>{l.pat(g.cx-3,g.hy0-3,['.wwwww.','wwwcwww','wwcccww','wwwcwww']);return g.hy0-3},body:(l,g)=>l.pat(g.cx-1,g.by0+2,['w.w','.w.'])},
 doc:{sh:WH,pa:MI,body:(l,g)=>l.rect(g.cx-1,g.by0,3,g.z.bh,MI),det:(l,g)=>{const y=g.by0+2;l.pat(g.cx-3,y,['#.....#','#.....#','.#...#.','..###..','....m..'])}},
 chef:{sh:WH,pa:MI,hat:(l,g)=>{l.blob(g.cx-7,g.hy0-6,7,6,WH,2);l.blob(g.cx-3,g.hy0-8,7,7,WH,2);l.blob(g.cx+1,g.hy0-6,7,6,WH,2);l.rect(g.cx-5,g.hy0-2,11,4,WH);return g.hy0-8},
  det:(l,g)=>{for(const y of [g.by0+3,g.by0+5])for(const x of [g.cx-2,g.cx+2])l.px(x,y,CH)},face:(l,g)=>{for(let x=g.cx-5;x<=g.cx+5;x++)l.px(x,g.hy0+2,CH);l.px(g.cx-6,g.hy0+1,CH);l.px(g.cx+6,g.hy0+1,CH)}},
 elec:{sh:YA,pa:MI,body:(l,g)=>{l.rect(g.cx-3,g.by0+3,7,g.z.bh,MI);l.pat(g.cx-1,g.by0+3,['.y','yy','y.'])},props:[P.bulb]},
 mech:{sh:MI,pa:MI,body:(l,g)=>l.rect(g.cx+1,g.by0+3,2,2,WH),props:[P.wrench],face:(l,g)=>l.pat(g.cx-6,g.ey+5,['#.','.#'].map(r=>r.replace(/#/g,'m')))},
 cons:{sh:MI,pa:MI,body:(l,g)=>{l.rect(g.bx0,g.by0,g.bw,g.z.bh,CO);l.rect(g.cx-1,g.by0+2,3,g.z.bh,MI);l.rect(g.bx0,g.by0+4,g.bw,1,WH)},
  hat:(l,g)=>{l.blob(g.hx0+1,g.hy0-3,g.z.hw-2,8,YA,2.2);l.rect(g.hx0-1,g.hy0+2,g.z.hw+2,1,YA);l.rect(g.cx,g.hy0-3,1,5,WH);return g.hy0-3}},
 drv:{sh:MI,pa:MI,hat:(l,g)=>{l.blob(g.hx0+1,g.hy0-2,g.z.hw-2,7,CO,2.2);l.rect(g.cx-1,g.hy0+2,9,1,CO);l.px(g.cx-1,g.hy0,YA);return g.hy0-2},props:[P.wheel]},
 fact:{sh:WA,pa:WA,hat:(l,g)=>{l.rect(g.hx0,g.hy0+2,g.z.hw,1,CH);l.blob(g.cx-5,g.hy0,4,4,MI,2);l.blob(g.cx+2,g.hy0,4,4,MI,2);l.px(g.cx-4,g.hy0+1,WH);l.px(g.cx+3,g.hy0+1,WH)},body:(l,g)=>l.rect(g.cx+1,g.by0+3,3,2,MI)},
 farm:{sh:WA,pa:MI,body:(l,g)=>{l.rect(g.cx-3,g.by0+3,7,g.z.bh,MI);l.px(g.cx-4,g.by0+2,MI);l.px(g.cx+4,g.by0+2,MI)},
  hat:(l,g)=>{l.blob(g.hx0+2,g.hy0-3,g.z.hw-4,6,YA,2.2);l.rect(g.hx0-3,g.hy0+2,g.z.hw+6,1,YA);l.rect(g.hx0+2,g.hy0+1,g.z.hw-4,1,CO);return g.hy0-3},props:[P.carrot]},
 design:{sh:YA,pa:MI,hat:(l,g)=>{l.blob(g.hx0-1,g.hy0-3,g.z.hw-1,6,CO,2);l.px(g.cx-1,g.hy0-4,CO);return g.hy0-4},props:[P.pencil]},
 music:{sh:CO,pa:MI,props:[P.guitar]},
 infl:{sh:CO,pa:MI,up:1,hat:(l,g)=>{l.blob(g.hx0+1,g.hy0-2,g.z.hw-2,7,MI,2.2);l.rect(g.hx0-2,g.hy0+2,7,1,MI);return g.hy0-2},props:[P.phone]},
 actor:{sh:MI,pa:MI,up:1,body:(l,g)=>l.pat(g.cx-2,g.by0+2,['cc.cc','.www.','.www.']),props:[P.star]},
 writer:{sh:MI,pa:WA,body:(l,g)=>{l.rect(g.bx0,g.by0+2,g.bw,2,YA);l.rect(g.cx+2,g.by0+4,2,3,YA)},props:[P.quill,Lh(P.pad)]},
 foot:{sh:CO,pa:MI,legs:'shorts',det:(l,g)=>{for(let x=g.bx0+1;x<g.bx1;x+=2)for(let y=g.by0+2;y<=g.by1;y++)if(l.get(x,y)===CO)l.px(x,y,WH)},props:[P.ball]},
 badm:{sh:MI,pa:WH,legs:'shorts',hat:(l,g)=>{l.rect(g.hx0,g.hy0+3,g.z.hw,1,CO);l.pat(g.hx1-1,g.hy0+3,['ccc','.cc'])},props:[P.racket]},
 esp:{sh:CO,pa:MI,hat:(l,g)=>{l.rect(g.hx0+2,g.hy0-1,g.z.hw-4,1,CH);l.blob(g.hx0-2,g.ey-1,4,5,MI,2);l.blob(g.hx1-1,g.ey-1,4,5,MI,2);return g.hy0-1},
  face:(l,g)=>l.pat(g.hx1-2,g.ey+3,['.#','#.','#.']),body:(l,g)=>l.rect(g.bx0,g.by0+4,g.bw,1,YA)},
 coach:{sh:WA,pa:MI,legs:'shorts',arms:'bare',det:(l,g)=>{l.pat(g.cx-2,g.by0+2,['#...#','.#.#.','..#..','..yy.'])},props:[P.bell]},
 hawker:{sh:YA,pa:MI,body:(l,g)=>{l.rect(g.cx-3,g.by0+3,7,g.z.bh,WH)},hat:(l,g)=>{l.rect(g.hx0,g.hy0+3,g.z.hw,1,CO);l.pat(g.hx1-1,g.hy0+2,['.cc','cc.'])},props:[P.spat]},
 shop:{sh:MI,pa:MI,body:(l,g)=>{l.rect(g.cx-3,g.by0+3,7,g.z.bh,WA);l.px(g.cx-3,g.by0+2,WA);l.px(g.cx+3,g.by0+2,WA)},det:(l,g)=>l.rect(g.cx+1,g.by0+4,2,1,YA),props:[P.bag]}
};
/* everyday clothes by wealth (0 poor, 1 comfortable, 2 rich), students, school, the hospital */
function casual(w,i){return w>=2?{sh:MI,pa:MI,body:(l,g)=>l.pat(g.cx-2,g.by0+2,['wwyww','.www.','.www.','.www.'])}
 :w===1?{sh:[MI,WA,YA,CO][i%4],pa:MI}:{sh:WA,pa:MI,det:(l,g)=>{l.rect(g.cx+1,g.by0+4,2,2,CO);l.px(g.cx+1,g.by0+4,YA)}}}
const STUDY={sh:YA,pa:MI,body:(l,g)=>{l.rect(g.cx-3,g.by0+2,1,4,CO);l.rect(g.cx+3,g.by0+2,1,4,CO)},props:[Lh(P.book)]};
const SCHOOL={sh:WH,pa:MI,body:(l,g)=>l.pat(g.cx-1,g.by0+2,['c.c','.c.'])};
const GOWN={sh:MI,pa:MI};

/* a baby carried in front of a parent: a small round bundle with a sleepy face */
function bundle(sc,cx,y,c){sprite(sc,l=>{l.blob(cx-4,y,9,8,c,2.2);l.blob(cx-3,y,7,6,WH,2.4)},l=>{l.pat(cx-2,y+2,['#...#']);l.px(cx,y+4,CO);l.pat(cx-1,y-1,['.#','#.'])})}
function house(sc){sprite(sc,l=>{l.rect(1,34,13,11,YA);for(let i=0;i<7;i++)l.rect(i,33-i,15-2*i,1,CO);l.rect(6,38,3,7,MI);l.rect(2,36,3,3,MI);l.rect(10,36,3,3,MI)},l=>{l.px(8,41,YA);l.px(3,37,WH);l.px(11,37,WH)})}
function car(sc){sprite(sc,l=>{l.blob(33,37,15,7,CO,3);l.blob(36,33,9,7,CO,2.6);l.rect(37,35,3,2,WH);l.rect(41,35,3,2,WH)},l=>{l.rect(35,43,3,2,CH);l.rect(43,43,3,2,CH);l.px(46,39,YA)})}
/* tiny charcoal digits for "+2" when there are more children than hands */
const DIG={'+':['000','010','111','010','000'],0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['111','001','111','100','111'],3:['111','001','111','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],6:['111','100','111','101','111'],7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','111']};
function text(sc,str,x,y){let cx=x;for(const ch of str){const g=DIG[ch];if(g)g.forEach((r,j)=>[...r].forEach((v,i)=>{if(v==='1')sc.px(cx+i,y+j,CH)}));cx+=4}}

/* ---------- emotes over the player's head (mx = head centre, top = top of the head, hat or sprout) ---------- */
const HEART=['cc.cc','cwccc','ccccc','.ccc.','..c..'],HEART_S=['c.c','ccc','.c.'];
function emote(sc,kind,mx,top,g,k,p){
 if(kind==='love'){const a=Math.round((p||0)*7);sprite(sc,l=>{l.pat(mx+4,top-5-a,HEART);if(p>.3)l.pat(mx-8,top-2-Math.round((p-.3)*8),HEART_S)})}
 else if(kind==='yay'){[[-10,8],[9,4],[-7,0],[6,-3],[-1,-3],[12,10]].forEach(([dx,dy],i)=>{const v=(i+k)%3;if(!v)return;const x=mx+dx,y=top+dy;
  sprite(sc,l=>{if(v===1)l.pat(x-1,y-1,['.y.','yyy','.y.']);else l.px(x,y,YA)})})}
 else if(kind==='sweat'){const d=k%8<4?0:1;sprite(sc,l=>l.pat(g.hx1,g.hy0+2+d,['.m.','.m.','mmm','mwm','.m.']))}
 else if(kind==='zzz'){const n=(k>>2)%4;sprite(sc,()=>{},l=>{if(n>=1)l.pat(mx+5,top-3,['###','.#.','###']);
  if(n>=2)l.pat(mx+9,top-8,['####','..#.','.#..','####']);if(n>=3)l.pat(mx+14,top-14,['#####','...#.','..#..','.#...','#####'])})}
 else if(kind==='rain'){const y=top-10;sprite(sc,l=>{l.blob(mx-6,y,13,4,MI,2.2);l.blob(mx-4,y-2,6,4,MI,2.2);l.blob(mx+1,y-1,5,3,MI,2.2)});
  sprite(sc,()=>{},l=>{[-4,-1,2,5].forEach((dx,i)=>{const dy=(k+i*3)%4;l.rect(mx+dx,y+5+dy,1,2,CH)})})}}

/* ---------- the whole scene ---------- */
function faceOf(st,fr){if(st.face)return st.face;if(st.sleep)return 'peace';if(fr.cheer)return 'happy';if(st.ill==='gown')return 'sick';
 const old=stageOf(st.age)==='elder';let k=st.mood==='sad'||st.dep?'sad':old&&st.mood!=='happy'?'sleepy':st.mood==='happy'?'happy':'normal';
 if(fr.blink&&(k==='normal'||k==='sad'))k='blink';return k}
function scene(st,fr){const sc=buf();fr=fr||{};
 sprite(sc,l=>l.rect(0,FY+2,W,H-FY-2,WA));
 if(st.house)house(sc);if(st.vehicle)car(sc);
 const stg=stageOf(st.age),ks=st.kids||[],grown=stg==='adult'||stg==='elder',couple=st.partner&&grown,sad=st.mood==='sad'||st.dep;
 const mainX=couple?17:24,partX=30,sq=s=>s||0,up=fr.up||0;
 /* walking children hold a free hand (player's left, partner's right), babies are carried */
 const walk=grown?ks.filter(a=>a>=3).slice(0,2):[],carry=grown?ks.filter(a=>a<3).slice(0,couple?2:1):[];
 const slots=couple?[{p:'m',side:-1},{p:'p',side:1}]:[{p:'m',side:-1},{p:'m',side:1}],hold={m:{},p:{}};
 const kids=walk.map((a,i)=>{const s=slots[i],pg=geo(stg,s.p==='m'?mainX:partX,FY,0),hand=s.side<0?{x:pg.bx0-3,y:pg.by0+5}:{x:pg.bx1+2,y:pg.by0+5};
  hold[s.p][s.side<0?'L':'R']=hand;const sz=a<10?'kid':'kteen',bw=SZ[sz].bw;return{a,i,sz,hand,cx:s.side<0?hand.x-1-(bw>>1):hand.x+2+(bw>>1),side:-s.side}});
 /* the partner first (behind), then the player, then the children in front */
 if(couple){const old=stg==='elder',f=st.sex==='f';
  figure(sc,{sz:stg,cx:partX,fy:FY,sq:sq(fr.sq2),style:f?'tuft':'bun',hair:old?MI:CH,fit:st.wealth>=2?casual(2):casual(1,['foot','mkt','music','esp','infl','hawker','actor'].includes(st.fit)?2:3),
   face:fr.blink2&&!sad?'blink':sad?'normal':old?'sleepy':'happy',hold:hold.p,watch:st.wealth>=2})}
 let mg;
 if(stg==='baby')mg=figure(sc,{sz:'baby',cx:mainX,fy:FY-up,sq:sq(fr.sq),tilt:fr.tilt,style:'curl',fit:{sh:MI},face:faceOf(st,fr),sprout:1});
 else{const fit=st.ill==='gown'?GOWN:st.fit?OUT[st.fit]||casual(st.wealth,0):st.study?STUDY:stg==='teen'?SCHOOL:casual(st.wealth,0),
   old=stg==='elder',free=!(fit.props||[]).some(p=>!p.side)&&!fit.up&&!hold.m.R;
  mg=figure(sc,{sz:stg,cx:mainX,fy:FY-up,sq:sq(fr.sq),tilt:fr.tilt,style:st.sex==='f'?(old?'bun':'bob'):'short',hair:old?MI:CH,fit,face:faceOf(st,fr),sprout:1,
   hold:hold.m,watch:st.wealth>=2&&stg!=='child',plaster:st.ill==='band',gown:st.ill==='gown',extra:old&&!st.sleep&&free?[P.cane]:[]})}
 carry.forEach((a,i)=>{const cx=i===0&&couple?partX:mainX,g=geo(stg,cx,FY,0);bundle(sc,cx,g.by0+1,[YA,CO][i])});
 kids.forEach(k=>{figure(sc,{sz:k.sz,cx:k.cx,fy:FY,sq:k.i===0?sq(fr.sq3):0,style:k.i%2?'pig':'tuft',fit:{sh:[CO,YA][k.i],pa:MI},
   face:fr.blink3&&k.i===1?'blink':sad?'normal':k.i?'normal':'happy',hold:k.side<0?{L:k.hand}:{R:k.hand}});sprite(sc,l=>l.rect(k.hand.x,k.hand.y,2,2,WH))});
 const more=ks.length-(grown?walk.length+carry.length:0);if(grown&&more>0)text(sc,'+'+more,W-4*String(more).length-5,2);
 /* emotes */
 if(mg&&!st.sleep){const em=fr.em||st.emote||(st.dep?'rain':st.broke?'sweat':st.retired?'zzz':null);if(em)emote(sc,em,mg.cx+(fr.tilt||0),mg.top,mg,fr.k||0,fr.p)}
 return sc}
function paint(cv,st,fr){if(cv.width!==W){cv.width=W;cv.height=H}const ctx=cv.getContext('2d'),img=ctx.createImageData(W,H),P=palette(),sc=scene(st,fr);
 for(let i=0;i<W*H;i++){const c=sc.b[i];if(!c)continue;const k=P[c];img.data[i*4]=k[0];img.data[i*4+1]=k[1];img.data[i*4+2]=k[2];img.data[i*4+3]=255}
 ctx.putImageData(img,0,0)}

/* ---------- a life's state (engine globals: netWorth, sick, depressed) ---------- */
function stateOf(s){const age=s.dead?s.deathAge:s.age,nw=netWorth(s),B=s.base,h=s.happy;
 return{age,sex:s.sex,fit:s.job&&!s.retired&&!s.study&&!(s.job.train>s.age)?s.job.id:s.job&&s.job.train>s.age?(s.job.id==='doc'?'doc':'law'):null,
  study:!!s.study,partner:!!s.married,kids:s.kids.map(b=>age-b).filter(a=>a>=0),
  wealth:nw<.5*B?0:nw<10*B?1:2,house:!!s.house,vehicle:!!s.car,mood:h>=70?'happy':h>=35?'flat':'sad',
  ill:s.illAge===s.age&&!s.dead?'gown':sick(s)?'band':null,dep:depressed(s),sleep:!!s.dead,
  broke:!s.dead&&(s.debt>.3*B||nw+s.sloan<-.25*B),retired:!!s.retired&&!s.dead}}

/* ---------- animation: soft squash-and-stretch, blinking, a head tilt now and then, emotes, a jump at big moments ---------- */
const SQ=[0,0,1,1,0,0,-1,-1];
const live=new Map();let timer=null;
function frame(e,t){const f={},c=e.cheer>t,tt=t+e.off;
 if(!reduce){f.sq=SQ[Math.floor(tt/200)%8];f.sq2=SQ[Math.floor((tt+500)/200)%8];f.sq3=SQ[Math.floor((tt+900)/170)%8];
  f.blink=tt%3400<130;f.blink2=(tt+1700)%4100<130;f.blink3=(tt+800)%3700<130;
  const tc=tt%7400;if(tc>5600&&tc<6800)f.tilt=Math.floor(tt/7400)%2?1:-1;f.k=Math.floor(tt/220)}
 if(c){const p=1-(e.cheer-t)/1400;f.em=e.kind;f.p=reduce?.5:p;f.cheer=1;
  if(!reduce){const k=Math.min(13,Math.floor(p*14));f.up=[0,0,2,4,5,6,6,5,4,2,0,0,0,0][k];f.sq=[1,1,-1,-1,0,0,0,0,-1,-1,1,1,0,0][k];f.tilt=0}}
 return f}
function tick(){const t=performance.now();for(const[cv,e]of live){if(!cv.isConnected){live.delete(cv);continue}const f=frame(e,t),key=JSON.stringify(f);if(key!==e.key){e.key=key;paint(cv,e.st,f)}}
 if(!live.size){clearInterval(timer);timer=null}}
function set(cv,st,still){if(!cv||!st)return;let e=live.get(cv);if(!e){e={off:Math.random()*3000};if(!still)live.set(cv,e)}e.st=st;e.key='';paint(cv,st,frame(e,performance.now()));
 if(!still&&!timer)timer=setInterval(tick,reduce?400:60)}
function cheer(cv,kind){const e=live.get(cv);if(e){e.cheer=performance.now()+1400;e.kind=kind||'yay';e.key=''}}
window.Pixel={stateOf,set,cheer,paint,scene,frame,W,H};
})();
