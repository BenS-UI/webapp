// app.js
import { Fluid } from './fluid-core.js';

/* ------ Canvas / engine ------ */
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d', { alpha:false });

const fluid = new Fluid({ baseFactor:90, iter:20, dpr:DPR });

function resize(){
  const W = Math.floor(window.innerWidth * DPR);
  const H = Math.floor(window.innerHeight * DPR);
  canvas.width = W; canvas.height = H;
  fluid.resize(W,H);
  if (!seededOnce) { defaultSeed(); resetHistory(); seededOnce = true; }
}
let seededOnce = false;
window.addEventListener('resize', resize);

/* ------ Palette / seeding ------ */
const E_BLUE = '#1aa4ff', NEON_AQUA = '#00ffd1', DEEP_BLUE = '#0b3a7a';
function hexToRgb(hex){ const h=hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(s=>s+s).join(''):h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function rgbToHex([r,g,b]){ return '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''); }

function defaultSeed(){ generateLayout('stream',[DEEP_BLUE,E_BLUE,NEON_AQUA]); }
function generateLayout(kind, colors){
  const cols = colors.map(hexToRgb);
  const N = fluid.N, cx=(N+2)/2, cy=(N+2)/2, rMax=Math.hypot(N,N)/2;
  const set=(i,j,c)=>fluid.setCell(i,j,c);
  fluid.clearDye();

  if(kind==='stream'){
    for(let j=1;j<=N;j++) for(let i=1;i<=N;i++){
      if(Math.random()<0.015){ const c=Math.random()<0.5?cols[1%cols.length]:cols[2%cols.length]; set(i,j,c); }
    }
    const amp=N*0.06, freq=0.09;
    for(let j=1;j<=N;j++){
      const mid=Math.floor(N*0.45 + Math.sin(j*freq)*amp);
      const w =Math.floor(N*0.05 + (Math.sin(j*0.03)*0.5+0.5)*N*0.015);
      for(let i=Math.max(1,mid-w);i<=Math.min(N,mid+w);i++){
        const t=(i-(mid-w))/(2*w+1), c0=cols[1], c1=cols[2];
        set(i,j,[ c0[0]*(1-t)+c1[0]*t|0, c0[1]*(1-t)+c1[1]*t|0, c0[2]*(1-t)+c1[2]*t|0 ]);
      }
    }
    return;
  }
  if(kind==='split'){ for(let j=1;j<=N;j++)for(let i=1;i<=N;i++) set(i,j,(i<=N/2)?cols[0]:cols[1%cols.length]); return; }
  if(kind==='squares'){
    const k=cols.length,g=Math.ceil(Math.sqrt(k)),w=Math.ceil(N/g),h=Math.ceil(N/g);
    for(let j=1;j<=N;j++)for(let i=1;i<=N;i++){ const gx=Math.min(g-1,(i-1)/w|0), gy=Math.min(g-1,(j-1)/h|0), idx=(gy*g+gx)%k; set(i,j,cols[idx]); }
    return;
  }
  if(kind==='sectors'){
    const k=cols.length;
    for(let j=1;j<=N;j++)for(let i=1;i<=N;i++){ const a=Math.atan2(j-cy,i-cx), idx=((a+Math.PI)/(2*Math.PI)*k)|0; set(i,j,cols[idx%k]); }
    return;
  }
  if(kind==='rings'){
    const k=cols.length;
    for(let j=1;j<=N;j++)for(let i=1;i<=N;i++){ const r=Math.hypot(i-cx,j-cy), idx=(Math.floor((r/rMax)*k))%k; set(i,j,cols[idx]); }
    return;
  }
  if(kind==='spiral'){
    const k=cols.length, wind=3.0;
    for(let j=1;j<=N;j++)for(let i=1;i<=N;i++){
      const dx=i-cx,dy=j-cy,r=Math.hypot(dx,dy)/rMax,a=Math.atan2(dy,dx);
      const t=a+wind*r*2*Math.PI, idx=((t+Math.PI)/(2*Math.PI)*k)|0; set(i,j,cols[idx%k]);
    } return;
  }
  if(kind==='blotches' || kind==='voronoi'){
    const k=cols.length, seeds=[]; for(let n=0;n<k;n++) seeds.push({x:1+Math.random()*N,y:1+Math.random()*N,c:n});
    for(let j=1;j<=N;j++)for(let i=1;i<=N;i++){
      let best=-1,bd=1e9; for(const s of seeds){ const dx=i-s.x,dy=j-s.y,d=dx*dx+dy*dy; if(d<bd){bd=d;best=s.c;} }
      set(i,j,cols[best]);
    } return;
  }
  if(kind==='stripes-v' || kind==='stripes-h'){
    const k=cols.length, vertical=(kind==='stripes-v');
    for(let j=1;j<=N;j++)for(let i=1;i<=N;i++){ const t=vertical?i:j, idx=Math.floor((t/N)*k)%k; set(i,j,cols[idx]); }
    return;
  }
}

/* ------ Tools ------ */
let tool='blender', holding=false, button=0, spinSign=1;
let vortexX=0,vortexY=0, prevX=NaN, prevY=NaN, timeSec=0;

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const IX=(x,y)=>fluid.IX(x,y);
const PX2G = ()=> (fluid.N/Math.max(fluid.W,fluid.H));

/* Settings refs (define ONCE) */
const speedEl=document.getElementById('speed');
const strengthEl=document.getElementById('strength');
const sizeEl=document.getElementById('size');
const viscEl=document.getElementById('visc');
const diffEl=document.getElementById('diff');
const resEl=document.getElementById('res');

/* Tools implementations */
function addBlender(dt){ if(!holding || tool!=='blender') return;
  const speed=+speedEl.value,strength=+strengthEl.value,radiusPx=+sizeEl.value*DPR;
  const [cx,cy]=fluid.gridFromPx(vortexX,vortexY);
  const rG=clamp(radiusPx*PX2G(),2,fluid.N), r2=rG*rG;
  for(let j=1;j<=fluid.N;j++)for(let i=1;i<=fluid.N;i++){
    const dx=i-cx,dy=j-cy,d2=dx*dx+dy*dy; if(d2>r2) continue;
    const dist=Math.sqrt(d2)+1e-6, tx=(-dy/dist)*spinSign, ty=(dx/dist)*spinSign, w=1-d2/r2, f=dt*speed*strength*w;
    fluid.u0[IX(i,j)]+=tx*f; fluid.v0[IX(i,j)]+=ty*f;
  }
}
let pourColor = hexToRgb(E_BLUE);
function addBucket(dt){ if(!holding || tool!=='bucket') return;
  const radiusPx=+sizeEl.value*DPR; const [cx,cy]=fluid.gridFromPx(vortexX,vortexY);
  const rG=clamp(radiusPx*PX2G(),2,fluid.N), r2=rG*rG; const [rC,gC,bC]=pourColor; const rate=clamp(60*dt,0.1,2);
  for(let j=1;j<=fluid.N;j++)for(let i=1;i<=fluid.N;i++){
    const dx=i-cx,dy=j-cy,d2=dx*dx+dy*dy; if(d2>r2) continue;
    const w=Math.max(0,1-d2/r2), a=w*rate, id=IX(i,j);
    fluid.dR[id]+=(rC-fluid.dR[id])*a; fluid.dG[id]+=(gC-fluid.dG[id])*a; fluid.dB[id]+=(bC-fluid.dB[id])*a;
  }
}
function addSmudge(dt){ if(!holding || tool!=='smudge' || isNaN(prevX)) return;
  const [cx,cy]=fluid.gridFromPx(vortexX,vortexY); const [pxg,pyg]=fluid.gridFromPx(prevX,prevY);
  const mvx=cx-pxg,mvy=cy-pyg,len=Math.hypot(mvx,mvy)+1e-6,sx=mvx/len,sy=mvy/len;
  const radiusPx=+sizeEl.value*DPR,rG=clamp(radiusPx*PX2G(),2,fluid.N), r2=rG*rG;
  const pull=+strengthEl.value*0.6*(1+ +speedEl.value*0.2);
  for(let j=1;j<=fluid.N;j++)for(let i=1;i<=fluid.N;i++){
    const dx=i-cx,dy=j-cy,d2=dx*dx+dy*dy; if(d2>r2) continue;
    const w=1-d2/r2, srcX=clamp((i - sx*3)|0,1,fluid.N), srcY=clamp((j - sy*3)|0,1,fluid.N);
    const id=IX(i,j), sid=IX(srcX,srcY), a=w*pull*dt;
    fluid.dR[id]+=(fluid.dR[sid]-fluid.dR[id])*a;
    fluid.dG[id]+=(fluid.dG[sid]-fluid.dG[id])*a;
    fluid.dB[id]+=(fluid.dB[sid]-fluid.dB[id])*a;
  }
}
let splatterCarry=0; function addSplatter(dt){
  if(!holding || tool!=='splatter') return;
  const speed=+speedEl.value,strength=+strengthEl.value,radiusPx=+sizeEl.value*DPR; const [cx,cy]=fluid.gridFromPx(vortexX,vortexY);
  const [rC,gC,bC]=pourColor; let rate=25*(0.5+speed*0.5)*dt + splatterCarry; let drops=Math.floor(rate); splatterCarry=rate-drops;
  for(let n=0;n<drops;n++){
    const ang=Math.random()*Math.PI*2, rad=Math.random()*radiusPx;
    const gx=clamp((cx+(rad*Math.cos(ang))*PX2G())|0,2,fluid.N-1);
    const gy=clamp((cy+(rad*Math.sin(ang))*PX2G())|0,2,fluid.N-1);
    const dropR=(0.2+Math.random()*0.8)*(radiusPx*PX2G());
    const rG=clamp(dropR,1.2,fluid.N/6), r2=rG*rG;
    for(let j=(gy-rG)|0;j<=(gy+rG)|0;j++){ if(j<1||j>fluid.N) continue;
      for(let i=(gx-rG)|0;i<=(gx+rG)|0;i++){ if(i<1||i>fluid.N) continue;
        const dx=i-gx,dy=j-gy,d2=dx*dx+dy*dy; if(d2>r2) continue;
        const w=1-d2/r2,id=IX(i,j);
        fluid.dR[id]+=(rC-fluid.dR[id])*w; fluid.dG[id]+=(gC-fluid.dG[id])*w; fluid.dB[id]+=(bC-fluid.dB[id])*w;
      }
    }
    const spin = speed*.35*strength*spinSign;
    if(Math.abs(spin)>0.01){
      for(let j=(gy-rG)|0;j<=(gy+rG)|0;j++){ if(j<1||j>fluid.N) continue;
        for(let i=(gx-rG)|0;i<=(gx+rG)|0;i++){ if(i<1||i>fluid.N) continue;
          const dx=i-gx,dy=j-gy,d2=dx*dx+dy*dy; if(d2>r2||d2===0) continue;
          const dist=Math.sqrt(d2),tx=-dy/dist,ty=dx/dist,w=1-d2/r2,f=dt*spin*w;
          fluid.u0[IX(i,j)]+=tx*f; fluid.v0[IX(i,j)]+=ty*f;
        }
      }
    }
  }
}
let sprayCarry=0; function addSpray(dt){
  if(!holding || tool!=='spray') return;
  const rate = 220 * dt * (0.5 + +strengthEl.value/60); let count = Math.floor(rate + sprayCarry);
  sprayCarry = rate + sprayCarry - count; const radPx = (+sizeEl.value*0.6)*DPR; const [rC,gC,bC]=pourColor;
  while(count-- > 0){
    const ang=Math.random()*Math.PI*2, rad=(Math.random()**0.5)*radPx;
    const [gx,gy]=fluid.gridFromPx(vortexX + Math.cos(ang)*rad, vortexY + Math.sin(ang)*rad);
    const id=IX(gx|0,gy|0); fluid.dR[id]+=(rC-fluid.dR[id])*0.9; fluid.dG[id]+=(gC-fluid.dG[id])*0.9; fluid.dB[id]+=(bC-fluid.dB[id])*0.9;
  }
}
let glitterCarry=0; function addGlitter(dt){
  if(!holding || tool!=='glitter') return;
  const baseRate=160*dt; let count=Math.floor(baseRate + glitterCarry);
  glitterCarry = baseRate + glitterCarry - count; const radPx=(+sizeEl.value*0.5)*DPR; const [rC,gC,bC]=pourColor;
  while(count-- > 0){
    const ang=Math.random()*Math.PI*2, rad=(Math.random()**0.3)*radPx;
    const [gx,gy]=fluid.gridFromPx(vortexX + Math.cos(ang)*rad, vortexY + Math.sin(ang)*rad);
    const id=IX(gx|0,gy|0); const sparkle=Math.random()<0.25; const br=sparkle?1.0:0.6+Math.random()*0.4;
    const R=Math.min(255,rC*br + (sparkle?60:0)), G=Math.min(255,gC*br + (sparkle?60:0)), B=Math.min(255,bC*br + (sparkle?60:0));
    fluid.dR[id]+=(R-fluid.dR[id])*0.9; fluid.dG[id]+=(G-fluid.dG[id])*0.9; fluid.dB[id]+=(B-fluid.dB[id])*0.9;
  }
}
function addPush(dt){ if(!holding || tool!=='push' || isNaN(prevX)) return;
  const [cx,cy]=fluid.gridFromPx(vortexX,vortexY); const [pxg,pyg]=fluid.gridFromPx(prevX,prevY);
  const vx=cx-pxg,vy=cy-pyg,len=Math.hypot(vx,vy)+1e-6,dx=vx/len,dy=vy/len; const radiusPx=+sizeEl.value*DPR;
  const rG=clamp(radiusPx*PX2G(),2,fluid.N),r2=rG*rG,force=+strengthEl.value*dt*(0.6+ +speedEl.value*0.4);
  for(let j=1;j<=fluid.N;j++)for(let i=1;i<=fluid.N;i++){
    const rx=i-cx,ry=j-cy,d2=rx*rx+ry*ry; if(d2>r2) continue; const w=1-d2/r2,f=force*w; fluid.u0[IX(i,j)]+=dx*f; fluid.v0[IX(i,j)]+=dy*f;
  }
}
function addPinch(dt){ if(!holding || tool!=='pinch') return;
  const [cx,cy]=fluid.gridFromPx(vortexX,vortexY); const radiusPx=+sizeEl.value*DPR;
  const rG=clamp(radiusPx*PX2G(),2,fluid.N), r2=rG*rG, s=(button===0?-1:1), force=+strengthEl.value*dt*(0.8+ +speedEl.value*0.2);
  for(let j=1;j<=fluid.N;j++)for(let i=1;i<=fluid.N;i++){
    const rx=i-cx,ry=j-cy,d2=rx*rx+ry*ry; if(d2>r2||d2===0) continue;
    const dist=Math.sqrt(d2),nx=rx/dist,ny=ry/dist,w=1-d2/r2,f=force*w*s; fluid.u0[IX(i,j)]+=nx*f; fluid.v0[IX(i,j)]+=ny*f;
  }
}
function addRipple(dt){ if(!holding || tool!=='ripple') return;
  const [cx,cy]=fluid.gridFromPx(vortexX,vortexY); const radiusPx=+sizeEl.value*DPR;
  const rG=clamp(radiusPx*PX2G(),3,fluid.N/2), k=(Math.PI*2)/(rG/3), w=6*(+speedEl.value), amp=(+strengthEl.value)*0.08;
  for(let j=1;j<=fluid.N;j++)for(let i=1;i<=fluid.N;i++){
    const rx=i-cx,ry=j-cy,d=Math.hypot(rx,ry); if(d>rG||d===0) continue;
    const s=Math.sin(k*d - w*timeSec), a=amp*(1-(d*d)/(rG*rG)), nx=rx/d, ny=ry/d;
    fluid.u0[IX(i,j)] += nx * s * a * dt * 60; fluid.v0[IX(i,j)] += ny * s * a * dt * 60;
  }
}

/* ------ UI: menus, wheel, settings ------ */
const bar = document.getElementById('bar');
const colorMenu = document.getElementById('colorMenu');
const blendMenu = document.getElementById('blendMenu');
const newMenu = document.getElementById('newMenu');
const exportMenu = document.getElementById('exportMenu');

function positionMenu(menu, anchor){
  const r=anchor.getBoundingClientRect();
  menu.style.left=Math.round(r.left)+'px';
  menu.style.bottom=Math.round(window.innerHeight - r.top + 8)+'px';
}
function showMenu(menu, anchor){ positionMenu(menu, anchor); menu.classList.add('show'); bar.classList.add('show'); }
function hideMenu(menu){ menu.classList.remove('show'); if(!colorMenu.classList.contains('show') && !blendMenu.classList.contains('show') && !newMenu.classList.contains('show') && !exportMenu.classList.contains('show') && overlay.style.display!=='block') bar.classList.remove('show'); }
function hideMenus(){ [colorMenu,blendMenu,newMenu,exportMenu].forEach(hideMenu); }

/* Buttons */
const colorBtn = document.getElementById('colorBtn');
const colorToolsBtn = document.getElementById('colorToolsBtn');
const blendToolsBtn = document.getElementById('blendToolsBtn');
const newBtn = document.getElementById('newBtn');
const settingsBtn = document.getElementById('settingsBtn');

colorToolsBtn.onclick = ()=>{ if(colorMenu.classList.contains('show')) hideMenu(colorMenu); else { hideMenu(blendMenu); showMenu(colorMenu, colorToolsBtn); } };
blendToolsBtn.onclick = ()=>{ if(blendMenu.classList.contains('show')) hideMenu(blendMenu); else { hideMenu(colorMenu); showMenu(blendMenu, blendToolsBtn); } };
window.addEventListener('click', (e)=>{ if(!e.target.closest('.menu') && !e.target.closest('#bar')) hideMenus(); });

[...colorMenu.querySelectorAll('.menu-item')].forEach(el=> el.addEventListener('click',()=>{ tool=el.dataset.tool; setActiveTool(); hideMenus(); }));
[...blendMenu.querySelectorAll('.menu-item')].forEach(el=> el.addEventListener('click',()=>{ tool=el.dataset.tool; setActiveTool(); hideMenus(); }));
function setActiveTool(){
  [...document.querySelectorAll('.menu-item')].forEach(x=> x.classList.toggle('active', x.dataset.tool===tool));
  document.getElementById('hint').textContent =
    tool==='bucket' ? 'Hold to pour color.' :
    tool==='splatter' ? 'Hold to splatter. Left=CW, Right=CCW.' :
    tool==='blender' ? 'Hold to spin. Left=CW, Right=CCW.' :
    tool==='smudge'  ? 'Hold and drag to smudge.' :
    tool==='spray'   ? 'Hold to spray.' :
    tool==='glitter' ? 'Hold to sprinkle.' :
    tool==='push'    ? 'Hold and drag to push.' :
    tool==='pinch'   ? 'Hold to pinch (Right reverses).' :
                       'Hold to make circular waves.';
}
setActiveTool();

/* Color wheel popover (for main color AND palette wells) */
const swatch=document.getElementById('swatch');
const wheelPop=document.getElementById('wheelPopover');
const wheelCanvas=document.getElementById('wheel');
const diamondCanvas=document.getElementById('diamond');
const hexInput=document.getElementById('hex');

let hue=205/360, sat=0.85, val=1.0; // initial blue
function hsvToRgb(h,s,v){
  const i = Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  const r=[v,q,p,p,t,v][i%6], g=[t,v,v,q,p,p][i%6], b=[p,p,t,v,v,q][i%6];
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}
function drawWheel(){
  const c=wheelCanvas, w=c.width, h=c.height, r=Math.min(w,h)/2, ir=r-24;
  const wctx=c.getContext('2d'); wctx.setTransform(1,0,0,1,0,0); wctx.clearRect(0,0,w,h); wctx.translate(w/2,h/2);
  for(let a=0;a<360;a++){
    const ang=(a-90)*Math.PI/180;
    wctx.beginPath(); wctx.strokeStyle = rgbToHex(hsvToRgb(a/360,1,1)); wctx.lineWidth=24;
    wctx.arc(0,0,(ir+12),ang,ang+Math.PI/180); wctx.stroke();
  }
  const ang=(hue*360-90)*Math.PI/180;
  wctx.beginPath(); wctx.lineWidth=3; wctx.strokeStyle="#fff"; wctx.arc(Math.cos(ang)*(ir+12), Math.sin(ang)*(ir+12), 10, 0, Math.PI*2); wctx.stroke();
  wctx.setTransform(1,0,0,1,0,0);
}
function drawDiamond(){
  const c=diamondCanvas, w=c.width, h=c.height; const dctx=c.getContext('2d');
  dctx.setTransform(1,0,0,1,0,0); dctx.clearRect(0,0,w,h);
  dctx.save(); dctx.translate(w/2,h/2); dctx.rotate(Math.PI/4);
  const size=Math.min(w,h)*0.72; const s2=size/2;
  for(let y=-s2;y<s2;y++){
    const v = 1 - (y+s2)/size;
    const grad = dctx.createLinearGradient(-s2,0,s2,0);
    grad.addColorStop(0, rgbToHex(hsvToRgb(hue,0,v)));
    grad.addColorStop(1, rgbToHex(hsvToRgb(hue,1,v)));
    dctx.fillStyle=grad; dctx.fillRect(-s2,y,size,1);
  }
  const x = (sat*size - s2), y = ((1-val)*size - s2);
  dctx.beginPath(); dctx.lineWidth=3; dctx.strokeStyle="#fff"; dctx.rect(x-7,y-7,14,14); dctx.stroke();
  dctx.restore();
}

let activeWell = null; // palette well under edit
function updateHex(){
  const rgb=hsvToRgb(hue,sat,val);
  const hex=rgbToHex(rgb);
  hexInput.value=hex; swatch.style.background=hex; pourColor=rgb;
  if (activeWell){ activeWell.style.background=hex; activeWell.dataset.hex=hex; }
}
function openWheelAt(anchor){
  positionMenu(wheelPop, anchor);
  wheelPop.classList.add('show'); drawWheel(); drawDiamond(); updateHex();
}
function closeWheel(){ wheelPop.classList.remove('show'); activeWell=null; }

colorBtn.addEventListener('click', ()=>{ activeWell=null; openWheelAt(colorBtn); });
window.addEventListener('click', (e)=>{ if(!e.target.closest('#wheelPopover') && !e.target.closest('#colorBtn') && !e.target.closest('.cwell')) closeWheel(); });

function pickOnWheel(ev){
  const r=wheelCanvas.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  const dx=ev.clientX-cx, dy=ev.clientY-cy;
  hue=(Math.atan2(dy,dx)+Math.PI)/(2*Math.PI);
  drawWheel(); drawDiamond(); updateHex();
}
function pickOnDiamond(ev){
  const r=diamondCanvas.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  const dx=ev.clientX-cx, dy=ev.clientY-cy;
  const x = (dx*Math.SQRT1_2 - dy*Math.SQRT1_2);
  const y = (dx*Math.SQRT1_2 + dy*Math.SQRT1_2);
  const size=Math.min(r.width,r.height)*0.72, s2=size/2;
  const sx = clamp((x + s2)/size, 0, 1);
  const vy = clamp((y + s2)/size, 0, 1);
  sat = sx; val = 1 - vy;
  drawDiamond(); updateHex();
}
wheelCanvas.addEventListener('mousedown', e=>{ pickOnWheel(e); const m=ev=>pickOnWheel(ev); window.addEventListener('mousemove',m); window.addEventListener('mouseup',()=>window.removeEventListener('mousemove',m),{once:true}); });
diamondCanvas.addEventListener('mousedown', e=>{ pickOnDiamond(e); const m=ev=>pickOnDiamond(ev); window.addEventListener('mousemove',m); window.addEventListener('mouseup',()=>window.removeEventListener('mousemove',m),{once:true}); });
hexInput.addEventListener('change', ()=>{ const v=hexInput.value.trim(); if(/^#?[0-9a-fA-F]{6}$/.test(v)){ const rgb=hexToRgb(v.startsWith('#')?v:'#'+v); pourColor=rgb; swatch.style.background=(v.startsWith('#')?v:'#'+v); if(activeWell){ activeWell.style.background=(v.startsWith('#')?v:'#'+v); activeWell.dataset.hex=hexInput.value; } } });

/* New menu + palette wells using wheel */
const newCount = document.getElementById('newCount');
const newLayout = document.getElementById('newLayout');
const newColors = document.getElementById('newColors');
const newCancel = document.getElementById('newCancel');
const newCreate = document.getElementById('newCreate');

function defaultPalette(n){ const base=['#0b3a7a','#1aa4ff','#00ffd1','#7cc7ff','#5bd0ff','#79ffe0','#a4b9ff']; return base.slice(0,n); }
function buildColorWells(){
  const n=+newCount.value; newColors.innerHTML=''; const palette=defaultPalette(n);
  for(let i=0;i<n;i++){
    const div=document.createElement('div'); div.className='cwell'; const hex=palette[i]; div.style.background=hex; div.dataset.hex=hex; div.tabIndex=0;
    div.addEventListener('click', ()=>{ activeWell=div; hexInput.value=div.dataset.hex; openWheelAt(div); });
    div.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); activeWell=div; hexInput.value=div.dataset.hex; openWheelAt(div); }});
    newColors.appendChild(div);
  }
}
newBtn.addEventListener('click', ()=>{ if(newMenu.classList.contains('show')) hideMenu(newMenu); else { buildColorWells(); showMenu(newMenu,newBtn); }});
newCount.addEventListener('change', buildColorWells);
newCancel.addEventListener('click', ()=> hideMenu(newMenu));
newCreate.addEventListener('click', ()=>{ const colors=[...newColors.querySelectorAll('.cwell')].map(el=>el.dataset.hex || '#1aa4ff'); generateLayout(newLayout.value, colors); resetHistory(); tool='blender'; setActiveTool(); hideMenus(); });

/* Settings panel */
const overlay=document.getElementById('overlay');
const panel=document.getElementById('panel');
const closeBtn=document.getElementById('close');
settingsBtn.addEventListener('click', ()=>{ overlay.style.display='block'; panel.classList.add('show'); bar.classList.add('show'); });
closeBtn.addEventListener('click', ()=>{ overlay.style.display='none'; panel.classList.remove('show'); bar.classList.remove('show'); });
overlay.addEventListener('click', ()=>{ overlay.style.display='none'; panel.classList.remove('show'); bar.classList.remove('show'); });

/* Slider readouts */
const fmt=v=>(Math.abs(v)>=1?Number(v).toFixed(2):Number(v).toFixed(4));
function bindVal(id,el){ const s=document.getElementById(id); const u=()=>s.textContent=fmt(el.value); el.addEventListener('input',u); u(); }
bindVal('speedV',speedEl); bindVal('strengthV',strengthEl); bindVal('sizeV',sizeEl); bindVal('viscV',viscEl); bindVal('diffV',diffEl); bindVal('resV',resEl);
resEl.addEventListener('input', ()=> fluid.setBaseFactor(+resEl.value));

/* History */
const history=[], redoStack=[]; const MAXH=20;
function snapshot(){ return { r:new Float32Array(fluid.dR), g:new Float32Array(fluid.dG), b:new Float32Array(fluid.dB) }; }
function restore(s){ fluid.dR.set(s.r); fluid.dG.set(s.g); fluid.dB.set(s.b); }
function resetHistory(){ history.length=0; redoStack.length=0; history.push(snapshot()); }
function pushHistory(){ history.push(snapshot()); if(history.length>MAXH) history.shift(); redoStack.length=0; }
function undo(){ if(history.length<2) return; const cur=history.pop(); redoStack.push(cur); restore(history[history.length-1]); }
function redo(){ if(!redoStack.length) return; const s=redoStack.pop(); restore(s); history.push(snapshot()); }
document.getElementById('undoBtn').onclick=undo; document.getElementById('redoBtn').onclick=redo;

/* Export + camera (temp hi-res 200) */
const exportBtn=document.getElementById('exportBtn');
const exFormat=document.getElementById('exFormat'), exW=document.getElementById('exW'), exH=document.getElementById('exH'), exLock=document.getElementById('exLock'), exQ=document.getElementById('exQ'), exRatio=document.getElementById('exRatio');
document.getElementById('cameraBtn').addEventListener('click', ()=> withHighRes(200, quickJpg));

function withHighRes(tempFactor, action){
  const prev=fluid.baseFactor;
  fluid.setBaseFactor(tempFactor);
  requestAnimationFrame(()=> requestAnimationFrame(()=>{ action(); fluid.setBaseFactor(prev); }));
}
function quickJpg(){
  canvas.toBlob((blob)=>{
    const a=document.createElement('a');
    const t=new Date(), pad=n=>String(n).padStart(2,'0');
    a.href=URL.createObjectURL(blob);
    a.download=`vortex-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.jpg`;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
  }, 'image/jpeg', 0.92);
}
function openExport(){ positionMenu(exportMenu, exportBtn); exportMenu.classList.add('show'); bar.classList.add('show'); exW.value=Math.min(1920, fluid.W|0); exH.value=Math.round(exW.value*(fluid.H/fluid.W)); updateRatio(); syncQuality(); }
function closeExport(){ hideMenu(exportMenu); }
function gcd(a,b){ return b?gcd(b,a%b):a; }
function updateRatio(){ const g=gcd(+exW.value,+exH.value); exRatio.textContent=`${Math.round(exW.value/g)}:${Math.round(exH.value/g)}`; }
function syncQuality(){ exQ.disabled = (exFormat.value==='image/png'); }
function clampDim(){ exW.value=Math.max(256,Math.min(4096,+exW.value|0)); exH.value=Math.max(256,Math.min(4096,+exH.value|0)); }
exportBtn.addEventListener('click', ()=> exportMenu.classList.contains('show')?closeExport():openExport());
document.getElementById('exCancel').addEventListener('click', closeExport);
exFormat.addEventListener('change', syncQuality);
exW.addEventListener('input', ()=>{ clampDim(); if(exLock.checked){ exH.value = Math.round(+exW.value * (fluid.H/fluid.W)); } updateRatio(); });
exH.addEventListener('input', ()=>{ clampDim(); if(exLock.checked){ exW.value = Math.round(+exH.value * (fluid.W/fluid.H)); } updateRatio(); });
document.getElementById('exSave').addEventListener('click', ()=>{
  clampDim(); const w=+exW.value|0, h=+exH.value|0, type=exFormat.value, q=+exQ.value;
  withHighRes(200, ()=>{
    const off=document.createElement('canvas'); off.width=w; off.height=h; const octx=off.getContext('2d',{alpha:false});
    octx.drawImage(canvas,0,0,w,h);
    off.toBlob((blob)=>{
      const a=document.createElement('a'); const ext=(type==='image/png'?'png':(type==='image/webp'?'webp':'jpg'));
      const t=new Date(), pad=n=>String(n).padStart(2,'0');
      a.href=URL.createObjectURL(blob); a.download=`vortex-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.${ext}`;
      document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
    }, type, type==='image/png'?undefined:q);
    closeExport();
  });
});

/* Input */
function startHold(px,py,btn){ spinSign=(btn===2?-1:1); button=btn; if(!holding) pushHistory(); holding=true; prevX=vortexX=px; prevY=vortexY=py; }
function stopHold(){ if(holding){ holding=false; pushHistory(); } }
canvas.addEventListener('mousedown', e=>{ const px=e.offsetX*DPR, py=e.offsetY*DPR; if(e.button===0){ startHold(px,py,0); } else if(e.button===2){ e.preventDefault(); startHold(px,py,2);} });
window.addEventListener('mouseup', e=>{ if(e.button===0||e.button===2) stopHold(); });
canvas.addEventListener('mousemove', e=>{ const px=e.offsetX*DPR, py=e.offsetY*DPR; if(holding){ prevX=vortexX; prevY=vortexY; } else { prevX=px; prevY=py; } vortexX=px; vortexY=py; });
document.addEventListener('contextmenu', e=> e.preventDefault());

/* Keyboard */
window.addEventListener('keydown', (e)=>{
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && k==='z'){ e.preventDefault(); undo(); }
  else if((e.ctrlKey||e.metaKey) && (k==='y' || (e.shiftKey&&k==='z'))){ e.preventDefault(); redo(); }
  else if((e.ctrlKey||e.metaKey) && k==='p'){ e.preventDefault(); document.getElementById('cameraBtn').click(); }
  else if((e.ctrlKey||e.metaKey) && k==='s'){ e.preventDefault(); exportMenu.classList.contains('show')?closeExport():openExport(); }
});

/* Loop */
let last=performance.now();
function step(now){
  const dt=Math.min(0.033,(now-last)/1000); last=now; timeSec+=dt;
  addBlender(dt); addBucket(dt); addSmudge(dt); addSplatter(dt); addSpray(dt); addGlitter(dt); addPush(dt); addPinch(dt); addRipple(dt);
  fluid.vel_step(+viscEl.value, dt); fluid.dens_step(+diffEl.value, dt);
  fluid.drawTo(ctx);
  requestAnimationFrame(step);
}

/* Init */
resize();
requestAnimationFrame(step);
