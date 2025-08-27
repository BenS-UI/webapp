/* ui.js — UI, menus, color wheel, settings, new/export, tooltips */
(() => {
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v,a,b)=>v<a?a:(v>b?b:v);

  // ------- Toolbar root (support #bar or #toolbar) -------
  const toolbar = document.getElementById('bar') || document.getElementById('toolbar');
  if (!toolbar) {
    console.error('Toolbar (#bar / #toolbar) not found');
    return;
  }

  function ensureBtn(id, html, beforeId) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = id; btn.className = 'btn' + (id==='settingsBtn' ? ' iconbtn' : '');
      btn.innerHTML = html;
      const before = beforeId ? document.getElementById(beforeId) : null;
      toolbar.insertBefore(btn, before || null);
    }
    return btn;
  }

  const colorBtn       = ensureBtn('colorBtn', `<div id="swatch" style="width:18px;height:18px;border-radius:50%;border:2px solid #fff8;box-shadow:0 0 0 2px #0003 inset;background:#1aa4ff"></div>`);
  const colorToolsBtn  = ensureBtn('colorToolsBtn', `<span class="label">Color ▾</span>`);
  const blendToolsBtn  = ensureBtn('blendToolsBtn', `<span class="label">Blend ▾</span>`);
  // the rest of buttons are assumed present in HTML; ensure if needed:
  ensureBtn('newBtn',        `<span class="label">New ▾</span>`);
  ensureBtn('undoBtn',       ``);
  ensureBtn('redoBtn',       ``);
  ensureBtn('cameraBtn',     ``);
  ensureBtn('exportBtn',     `<span class="label">Export</span>`);
  ensureBtn('settingsBtn',   ``);

  // ------- Tooltip (black, tiny) -------
  const tip = document.createElement('div');
  tip.className = 'tooltip'; document.body.appendChild(tip);
  function showTip(el, text){
    const r = el.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = `${Math.round(r.left + r.width/2 - tip.offsetWidth/2)}px`;
    tip.style.top  = `${Math.round(r.top - 30)}px`;
    tip.classList.add('show');
  }
  function hideTip(){ tip.classList.remove('show'); }
  const hoverHints = [
    ['colorBtn','Pick a color'],
    ['colorToolsBtn','Color tools'],
    ['blendToolsBtn','Blend tools'],
    ['newBtn','New artwork'],
    ['undoBtn','Undo (Ctrl+Z)'],
    ['redoBtn','Redo (Ctrl+Y)'],
    ['cameraBtn','Snapshot (Ctrl+P)'],
    ['exportBtn','Export (Ctrl+S)'],
    ['settingsBtn','Settings'],
  ];
  hoverHints.forEach(([id, t])=>{
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('mouseenter', ()=> showTip(el,t));
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('blur', hideTip);
  });

  // ------- Helpers for menus/panels -------
  function glass(el){ el.classList.add('glass'); return el; }
  function makeMenu(id){
    let m = document.getElementById(id);
    if (!m){ m = document.createElement('div'); m.id=id; m.className='menu glass'; document.body.appendChild(m); }
    return m;
  }
  function positionMenu(menu, anchor){
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.round(r.left)}px`;
    menu.style.bottom = `${Math.round(window.innerHeight - r.top + 8)}px`;
  }
  function showMenu(menu, anchor){
    positionMenu(menu, anchor); menu.classList.add('show');
    (toolbar).style.opacity = 1;
  }
  function hideMenu(menu){ menu.classList.remove('show'); }
  function hideAllMenus(){
    ['colorMenu','blendMenu','newMenu','exportMenu','wheelPopover'].forEach(id=>{ const el = document.getElementById(id); if(el) hideMenu(el); });
    $('#overlay')?.classList.remove('show');
    $('#settingsPanel')?.classList.remove('show');
  }
  window.addEventListener('click', (e)=>{
    const within = e.target.closest('.menu, #toolbar, #bar, .color-pop, #settingsPanel');
    if (!within) hideAllMenus();
  });

  // ------- Color Tools Menu -------
  const colorMenu = makeMenu('colorMenu');
  colorMenu.innerHTML = `
    <div class="menu-item" data-tool="bucket"><span class="dot" style="color:#9ad1ff"></span>Bucket</div>
    <div class="menu-item" data-tool="splatter"><span class="dot" style="color:#c8ffa8"></span>Splatter</div>
    <div class="menu-item" data-tool="spray"><span class="dot" style="color:#ffd79a"></span>Spray</div>
    <div class="menu-item" data-tool="glitter"><span class="dot" style="color:#fff"></span>Glitter</div>
  `;
  colorToolsBtn.addEventListener('click', ()=>{
    hideMenu($('#blendMenu'));
    showMenu(colorMenu, colorToolsBtn);
  });
  colorMenu.addEventListener('click', (e)=>{
    const it = e.target.closest('.menu-item'); if(!it) return;
    window.Bucket?.setTool(it.dataset.tool);
    $$('#colorMenu .menu-item, #blendMenu .menu-item').forEach(n=> n.classList.toggle('active', n===it));
    hideAllMenus();
  });

  // ------- Blend Tools Menu -------
  const blendMenu = makeMenu('blendMenu');
  blendMenu.innerHTML = `
    <div class="menu-item active" data-tool="blender"><span class="dot" style="color:#9ad1ff"></span>Blender</div>
    <div class="menu-item" data-tool="smudge"><span class="dot" style="color:#ffd79a"></span>Smudge</div>
    <div class="menu-item" data-tool="push"><span class="dot" style="color:#a8e0ff"></span>Push</div>
    <div class="menu-item" data-tool="pinch"><span class="dot" style="color:#ffa6c1"></span>Pinch</div>
    <div class="menu-item" data-tool="ripple"><span class="dot" style="color:#9ae2ff"></span>Ripple</div>
  `;
  blendToolsBtn.addEventListener('click', ()=>{
    hideMenu($('#colorMenu'));
    showMenu(blendMenu, blendToolsBtn);
  });
  blendMenu.addEventListener('click', (e)=>{
    const it = e.target.closest('.menu-item'); if(!it) return;
    window.Bucket?.setTool(it.dataset.tool);
    $$('#colorMenu .menu-item, #blendMenu .menu-item').forEach(n=> n.classList.toggle('active', n===it));
    hideAllMenus();
  });

  // ------- Color Picker (wheel + SB diamond + hex) -------
  const wheelPop = document.createElement('div'); wheelPop.id='wheelPopover'; wheelPop.className='color-pop glass';
  wheelPop.innerHTML = `
    <div class="wheel-wrap">
      <canvas id="colorWheel" width="220" height="220"></canvas>
      <canvas id="svDiamond"  width="160" height="160"></canvas>
      <input id="hexField" value="#1aa4ff" spellcheck="false"/>
    </div>`;
  document.body.appendChild(wheelPop);

  const wheel = $('#colorWheel'), diamond = $('#svDiamond'), hexField = $('#hexField');
  const DPR = Math.max(1, window.devicePixelRatio || 1);

  // scale canvases for DPR and keep CSS size
  function scaleCanvas(c){
    const cssW = c.width, cssH = c.height;
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    c.width = Math.round(cssW * DPR);
    c.height= Math.round(cssH * DPR);
  }
  scaleCanvas(wheel); scaleCanvas(diamond);

  let hue=205/360, sat=0.85, val=1;

  function hsvToRgb(h,s,v){
    const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
    const r=[v,q,p,p,t,v][i%6], g=[t,v,v,q,p,p][i%6], b=[p,p,t,v,v,q][i%6];
    return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
  }
  const rgbToHex = ([r,g,b]) => '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');

  function drawWheel(){
    const ctx = wheel.getContext('2d'); const w=wheel.width, h=wheel.height, r=Math.min(w,h)/2, ring=24*DPR, inner=r-ring;
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,w,h); ctx.translate(w/2,h/2);
    for(let a=0;a<360;a++){
      const ang=(a-90)*Math.PI/180;
      ctx.beginPath(); ctx.strokeStyle = rgbToHex(hsvToRgb(a/360,1,1)); ctx.lineWidth=ring;
      ctx.arc(0,0,(inner+ring/2),ang,ang+Math.PI/180); ctx.stroke();
    }
    const ang=(hue*360-90)*Math.PI/180;
    ctx.beginPath(); ctx.lineWidth=2*DPR; ctx.strokeStyle='#fff';
    ctx.arc(Math.cos(ang)*(inner+ring/2), Math.sin(ang)*(inner+ring/2), 10*DPR, 0, Math.PI*2); ctx.stroke();
    ctx.setTransform(1,0,0,1,0,0);
  }
  function drawDiamond(){
    const ctx=diamond.getContext('2d'); const w=diamond.width,h=diamond.height; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,w,h);
    ctx.save(); ctx.translate(w/2,h/2); ctx.rotate(Math.PI/4);
    const size=Math.min(w,h)*0.72, s2=size/2;
    for(let y=-s2;y<s2;y++){
      const v = 1 - (y+s2)/size;
      const grad = ctx.createLinearGradient(-s2,0,s2,0);
      grad.addColorStop(0, rgbToHex(hsvToRgb(hue,0,v)));
      grad.addColorStop(1, rgbToHex(hsvToRgb(hue,1,v)));
      ctx.fillStyle=grad; ctx.fillRect(-s2,y,size,1);
    }
    const x = (sat*size - s2), y = ((1-val)*size - s2);
    ctx.beginPath(); ctx.lineWidth=2*DPR; ctx.strokeStyle="#fff"; ctx.rect(x-7*DPR,y-7*DPR,14*DPR,14*DPR); ctx.stroke();
    ctx.restore();
  }
  function updatePour(){
    const rgb = hsvToRgb(hue,sat,val); const hex = rgbToHex(rgb);
    $('#swatch').style.background = hex; $('#hexField').value = hex;
    window.Bucket?.setPourHex(hex);
  }
  function openWheel(){ positionMenu(wheelPop, colorBtn); wheelPop.classList.add('show'); drawWheel(); drawDiamond(); updatePour(); }
  function closeWheel(){ wheelPop.classList.remove('show'); }
  colorBtn.addEventListener('click', ()=> wheelPop.classList.contains('show')?closeWheel():openWheel());

// Map client coords -> canvas coords accounting for DPR & CSS scaling
function canvasCoords(el, evt){
  const rect = el.getBoundingClientRect();
  const scaleX = el.width / rect.width;
  const scaleY = el.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}

function pickWheel(ev){
  const { x, y } = canvasCoords(wheel, ev);
  const cx = wheel.width / 2;
  const cy = wheel.height / 2;
  hue = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
  drawWheel();
  drawDiamond();
  updatePour();
}

wheel.addEventListener('mousedown', e => {
  pickWheel(e);
  const move = ev => pickWheel(ev);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', () =>
    window.removeEventListener('mousemove', move),
    { once: true }
  );
});

  function pickDiamond(ev){
    const { x:cxRaw, y:cyRaw } = canvasCoords(diamond, ev);
    const w=diamond.width, h=diamond.height;
    const cx=w/2, cy=h/2;
    const dx=cxRaw-cx, dy=cyRaw-cy;
    // inverse rotate by 45deg
    const cos = Math.SQRT1_2, sin = -Math.SQRT1_2; // cos(45)=sin(45)=sqrt(1/2); negative for -45°
    const xr = dx*cos - dy*sin;
    const yr = dx*sin + dy*cos;
    const size=Math.min(w,h)*0.72, s2=size/2;
    sat = clamp((xr + s2)/size, 0, 1);
    val = clamp(1 - (yr + s2)/size, 0, 1);
    drawDiamond(); updatePour();
  }
  diamond.addEventListener('mousedown', e=>{
    pickDiamond(e);
    const m=ev=>pickDiamond(ev);
    window.addEventListener('mousemove',m);
    window.addEventListener('mouseup',()=>window.removeEventListener('mousemove',m),{once:true});
  });
  hexField.addEventListener('click', e=> e.stopPropagation());
  hexField.addEventListener('input', e=> e.stopPropagation());
  hexField.addEventListener('change', ()=>{
    const v=hexField.value.trim();
    if(/^#?[0-9a-fA-F]{6}$/.test(v)){
      const hex = v.startsWith('#')?v:'#'+v;
      $('#swatch').style.background = hex;
      window.Bucket?.setPourHex(hex);
    }
  });

  // ------- Settings panel (detached from HTML panel) -------
  const overlay = document.createElement('div'); overlay.id='overlay'; document.body.appendChild(overlay);
  const panel = document.createElement('div'); panel.id='settingsPanel'; glass(panel); document.body.appendChild(panel);

  panel.innerHTML = `
    <div id="settingsDrag" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 6px 10px;">
      <div id="settingsTitle">Settings</div>
      <button id="settingsClose" title="Close">✕</button>
    </div>
    <div id="settingsGrid">
      <label>Speed</label>     <div><input id="sp" type="range" min="0" max="4" step="0.01"><span class="val" id="spV"></span></div>
      <label>Strength</label>  <div><input id="st" type="range" min="0" max="60" step="0.1"><span class="val" id="stV"></span></div>
      <label>Size</label>      <div><input id="sz" type="range" min="10" max="300" step="1"><span class="val" id="szV"></span></div>
      <label>Viscosity</label> <div><input id="vi" type="range" min="0" max="0.01" step="0.0001"><span class="val" id="viV"></span></div>
      <label>Diffusion</label> <div><input id="df" type="range" min="0" max="0.002" step="0.0001"><span class="val" id="dfV"></span></div>
      <label>Resolution</label><div><input id="rs" type="range" min="60" max="220" step="1"><span class="val" id="rsV"></span></div>
    </div>
  `;

  const fmt=v=>(Math.abs(+v)>=1?(+v).toFixed(2):(+v).toFixed(4));
  function whenBucketReady(fn){
    if (window.Bucket) return fn();
    let tries=0; const t=setInterval(()=>{ if(window.Bucket){ clearInterval(t); fn(); } else if(++tries>200){ clearInterval(t); } },25);
  }
  function bindSlider(id, get, set, format=fmt){
    const el = $('#'+id), lab = $('#'+id+'V');
    el.value = get(); lab.textContent = format(el.value);
    el.addEventListener('input', ()=>{ lab.textContent=format(el.value); set(+el.value); });
  }
  whenBucketReady(()=>{
    bindSlider('sp', ()=>Bucket.params.speed,     v=>Bucket.params.speed=v);
    bindSlider('st', ()=>Bucket.params.strength,  v=>Bucket.params.strength=v, v=>(+v).toFixed(1));
    bindSlider('sz', ()=>Bucket.params.size,      v=>Bucket.params.size=v, v=>Math.round(+v));
    bindSlider('vi', ()=>Bucket.params.viscosity, v=>Bucket.params.viscosity=v);
    bindSlider('df', ()=>Bucket.params.diffusion, v=>Bucket.params.diffusion=v);
    const rs=$('#rs'), rsV=$('#rsV'); rs.value=Bucket.params.baseFactor; rsV.textContent=rs.value;
    rs.addEventListener('input', ()=>{ rsV.textContent=rs.value; Bucket.setBaseFactor(+rs.value); });
  });

  // Drag settings panel
  (function dragify(){
    const head = $('#settingsDrag'); let drag=false, ox=0, oy=0;
    head.addEventListener('mousedown', e=>{ drag=true; const r=panel.getBoundingClientRect(); ox=e.clientX-r.left; oy=e.clientY-r.top; });
    window.addEventListener('mousemove', e=>{ if(!drag) return; panel.style.left = Math.min(Math.max(8, e.clientX-ox), window.innerWidth - panel.offsetWidth - 8) + 'px'; panel.style.top = Math.min(Math.max(8, e.clientY-oy), window.innerHeight - panel.offsetHeight - 8) + 'px'; });
    window.addEventListener('mouseup', ()=> drag=false);
  })();
  function openSettings(){ overlay.classList.add('show'); panel.classList.add('show'); panel.style.left='96px'; panel.style.top='96px'; }
  function closeSettings(){ overlay.classList.remove('show'); panel.classList.remove('show'); }
  overlay.addEventListener('click', closeSettings);
  $('#settingsClose').addEventListener('click', closeSettings);
  $('#settingsBtn').addEventListener('click', openSettings);

  // ------- New Artwork dialog -------
  const newMenu = makeMenu('newMenu');
  newMenu.innerHTML = `
    <h4>New Artwork</h4>
    <div class="row"><label>Colors</label>
      <select id="newCount"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option><option>6</option><option>7</option></select>
    </div>
    <div class="row"><label>Layout</label>
      <select id="newLayout">
        <option value="stream" selected>Blue Stream</option>
        <option value="sectors">Radial Sectors</option>
        <option value="rings">Rings</option>
        <option value="spiral">Spiral</option>
        <option value="blotches">Blotches</option>
        <option value="stripes-v">Stripes • Vertical</option>
        <option value="stripes-h">Stripes • Horizontal</option>
        <option value="voronoi">Random Regions</option>
        <option value="squares">Squares</option>
        <option value="split">Bisection</option>
      </select>
    </div>
    <h4>Palette</h4>
    <div id="newColors" class="colors"></div>
    <div class="actions">
      <button id="newCancel" class="ghost" type="button">Cancel</button>
      <button id="newCreate" class="primary" type="button">Create</button>
    </div>
  `;
  const newBtn     = $('#newBtn'),
        newCount   = () => $('#newCount'),
        newLayout  = () => $('#newLayout'),
        newColors  = () => $('#newColors');

  function defaultPalette(n){ const base=['#0b3a7a','#1aa4ff','#00ffd1','#7cc7ff','#5bd0ff','#79ffe0','#a4b9ff']; return base.slice(0,n); }
  function buildWells(){
    const host = newColors(); const n = +newCount().value; host.innerHTML='';
    const pal = defaultPalette(n);
    for(let i=0;i<n;i++){
      const wrap = document.createElement('div'); wrap.className='cwell';
      const input = document.createElement('input'); input.type='color'; input.value=pal[i];
      wrap.style.background = pal[i];

      // keep menu open while interacting with color input
      ['click','mousedown','pointerdown','input','change','focus'].forEach(evt=>{
        input.addEventListener(evt, e=> e.stopPropagation());
        wrap .addEventListener(evt, e=> e.stopPropagation());
      });

      // open native picker when clicking the circle anywhere
      wrap.addEventListener('click', e=>{ e.stopPropagation(); input.showPicker?.(); });

      input.addEventListener('input', ()=> wrap.style.background = input.value);
      wrap.appendChild(input); host.appendChild(wrap);
    }
  }
  buildWells();

  newBtn.addEventListener('click', ()=>{ showMenu(newMenu, newBtn); });

  newMenu.addEventListener('click', e=>{
    // prevent clicks inside from closing when hitting inputs
    if (e.target.closest('input,select,button,.cwell')) e.stopPropagation();
  });

  newMenu.addEventListener('mousedown', e=>{
    if (e.target.closest('input,select,button,.cwell')) e.stopPropagation();
  });

  newMenu.addEventListener('change', e=>{
    if (e.target && e.target.id === 'newCount') buildWells();
  });

  $('#newCancel').addEventListener('click', hideAllMenus);
  $('#newCreate').addEventListener('click', ()=>{
    const colors = [...newColors().querySelectorAll('input')].map(i=>i.value);
    window.Bucket?.generateLayout(newLayout().value, colors);
    hideAllMenus();
  });

  // ------- Export dialog (hi-res) -------
  const exportBtn = $('#exportBtn');
  const exportMenu = makeMenu('exportMenu');
  exportMenu.innerHTML = `
    <h4>Export</h4>
    <div class="grid">
      <label>Format</label>
      <select id="exFormat"><option value="image/png">PNG</option><option value="image/jpeg" selected>JPG</option><option value="image/webp">WEBP</option></select>
      <label>Width</label><input id="exW" type="number" min="256" max="4096" step="1" value="1920">
      <label>Height</label><input id="exH" type="number" min="256" max="4096" step="1" value="1080">
      <label>Aspect</label><div><label style="display:flex;align-items:center;gap:8px"><input id="exLock" type="checkbox" checked><span class="small" id="exRatio">16:9</span></label></div>
      <label>Quality</label><input id="exQ" type="range" min="0.5" max="1" step="0.01" value="0.92">
      <div class="full actions"><button id="exCancel" class="ghost" type="button">Cancel</button><button id="exSave" class="primary" type="button">Save</button></div>
    </div>
  `;
  function gcd(a,b){ return b?gcd(b,a%b):a; }
  function updateRatio(){ const w=+$('#exW').value|0, h=+$('#exH').value|0; const g=gcd(w,h)||1; $('#exRatio').textContent = `${(w/g)|0}:${(h/g)|0}`; }
  function syncQ(){ $('#exQ').disabled = ($('#exFormat').value==='image/png'); }
  function clampDim(){ const W=$('#exW'), H=$('#exH'); W.value=Math.max(256,Math.min(4096, +W.value|0)); H.value=Math.max(256,Math.min(4096, +H.value|0)); }

  exportBtn.addEventListener('click', ()=>{
    whenBucketReady(()=>{
      const B=window.Bucket, W=Math.min(1920, B.canvas.width|0), H=Math.round(W*(B.canvas.height/B.canvas.width));
      $('#exW').value=W; $('#exH').value=H; updateRatio(); syncQ();
      showMenu(exportMenu, exportBtn);
    });
  });
  $('#exFormat').addEventListener('change', syncQ);
  $('#exW').addEventListener('input', ()=>{
    clampDim(); if($('#exLock').checked){ $('#exH').value = Math.round(+$('#exW').value * (Bucket.canvas.height/Bucket.canvas.width)); } updateRatio();
  });
  $('#exH').addEventListener('input', ()=>{
    clampDim(); if($('#exLock').checked){ $('#exW').value = Math.round(+$('#exH').value * (Bucket.canvas.width/Bucket.canvas.height)); } updateRatio();
  });
  $('#exCancel').addEventListener('click', hideAllMenus);

  function withHighRes(temp, action){
    const prev = window.Bucket.params.baseFactor;
    window.Bucket.setBaseFactor(temp);
    requestAnimationFrame(()=> requestAnimationFrame(()=> {
      action(()=> {
        window.Bucket.setBaseFactor(prev);
        requestAnimationFrame(()=> requestAnimationFrame(()=>{}));
      });
    }));
  }
  $('#exSave').addEventListener('click', ()=>{
    const type = $('#exFormat').value, q = +$('#exQ').value;
    const w = +$('#exW').value|0, h = +$('#exH').value|0;
    whenBucketReady(()=>{
      withHighRes(200, (done)=>{
        const off = document.createElement('canvas'); off.width=w; off.height=h;
        const octx = off.getContext('2d', { alpha:false });
        octx.drawImage(Bucket.canvas,0,0,w,h);
        off.toBlob((blob)=>{
          const a=document.createElement('a');
          const ext = (type==='image/png'?'png':(type==='image/webp'?'webp':'jpg'));
          const t=new Date(), pad=n=>String(n).padStart(2,'0');
          a.href=URL.createObjectURL(blob);
          a.download=`bucket-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.${ext}`;
          document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
          done();
        }, type, type==='image/png'?undefined:q);
        hideAllMenus();
      });
    });
  });

  // ------- Keep wheel by toolbar -------
  function toggleWheel(){ wheelPop.classList.contains('show') ? hideAllMenus() : (showMenu(wheelPop, colorBtn), drawWheel(), drawDiamond(), updatePour()); }
  colorBtn.addEventListener('click', toggleWheel);
})();
