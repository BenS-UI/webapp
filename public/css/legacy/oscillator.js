/*! Circle of Fifths Synth Widget — dedicated JS (loads its own CSS)
   Features: plasma arcs, chords, hover intervals, rotary knobs, numeric edit, key root highlight, minimize pellet with mute.
*/
(function(){
  const WIDGET_ID = "circle-fifths-synth-widget";
  if (document.getElementById(WIDGET_ID)) return;

  // ---------- path helper (CSS lives next to this JS) ----------
  function getCSSHref() {
    const scripts = document.getElementsByTagName("script");
    const cur = document.currentScript || scripts[scripts.length-1];
    try { return new URL("oscillator.css", cur.src).href; }
    catch { return "oscillator.css"; }
  }

  // ---------- small utils ----------
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "style") Object.assign(n.style, v);
      else if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    const list = Array.isArray(children) ? children : [children];
    for (const c of list) if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  };
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const PC = n => ((n % 12) + 12) % 12;
  const fract = v => v - Math.floor(v);
  const noise1 = x => fract(Math.sin(x*12.9898)*43758.5453);
  const sCurve = t => Math.pow(Math.sin(Math.PI*t), 1.35);

  // ---------- music ----------
  const NAMES  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const FIFTHS = [0,7,2,9,4,11,6,1,8,3,10,5];
  const MAJOR  = [0,2,4,5,7,9,11];
  const MINOR  = [0,2,3,5,7,8,10];
  const INTERVALS = { "m3":3,"M3":4,"P5":7,"m7":10,"M7":11,"P8":12,"M9":14,"P11":17 };

  // ---------- host + shadow ----------
  const SIZE   = { w: 520, h: 700 };  // widget footprint
  const CIRCLE = { size: 200, radius: 80 }; // circle of fifths
  const NOTE_DIAM = 36; // note buttons

  const host = el("div", { id: WIDGET_ID });
  Object.assign(host.style, {
    position:"fixed",
    right:"24px",
    bottom:"24px",
    width: SIZE.w+"px",
    height: SIZE.h+"px",
    zIndex: 2147483000,
  });
  document.body.appendChild(host);
  const root = host.attachShadow({mode:"open"});

  // load CSS into the SHADOW (required to style shadow DOM)
  const cssLink = document.createElement("link");
  cssLink.rel = "stylesheet";
  cssLink.href = getCSSHref();
  root.appendChild(cssLink);

  // ---------- audio ----------
  const audio = {
    ctx:null, master:null, analyser:null, dryGain:null, filter:null, pan:null,
    delay:null, delayGain:null, delayFeedback:null,
    lfo:null, lfoGain:null, lfoTarget:"pitch",
    started:false, muted:false,
    settings:{
      waveform:"sine", attack:0.01, decay:0.15, sustain:0.6, release:0.4,
      cutoff:8000, resonance:0.8, detune:0, glide:0.0, volume:0.8,
      delayTime:0.18, delayMix:0.28, delayFeedback:0.32,
      lfoRate:5, lfoAmount:0
    }
  };
  const now = () => (audio.ctx ? audio.ctx.currentTime : 0);

  function updatePelletIcons(){
    if (!miniMute) return;
    if (!audio.started || audio.muted) miniMute.textContent = "🔇";
    else miniMute.textContent = "🔊";
  }

  function initAudio(){
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
    const ctx = audio.ctx;

    audio.master = ctx.createGain(); audio.master.gain.value = audio.settings.volume;
    audio.analyser = ctx.createAnalyser(); audio.analyser.fftSize = 256;

    audio.dryGain = ctx.createGain(); audio.dryGain.gain.value = 1;
    audio.filter = ctx.createBiquadFilter(); audio.filter.type="lowpass";
    audio.filter.frequency.value = audio.settings.cutoff; audio.filter.Q.value = audio.settings.resonance;
    audio.pan = ctx.createStereoPanner(); audio.pan.pan.value = 0;

    audio.delay = ctx.createDelay(1.5); audio.delay.delayTime.value = audio.settings.delayTime;
    audio.delayGain = ctx.createGain(); audio.delayGain.gain.value = audio.settings.delayMix;
    audio.delayFeedback = ctx.createGain(); audio.delayFeedback.gain.value = audio.settings.delayFeedback;
    audio.delay.connect(audio.delayFeedback); audio.delayFeedback.connect(audio.delay);
    audio.delay.connect(audio.delayGain);

    audio.lfo = ctx.createOscillator(); audio.lfo.type="sine"; audio.lfo.frequency.value = audio.settings.lfoRate;
    audio.lfoGain = ctx.createGain(); audio.lfoGain.gain.value = audio.settings.lfoAmount;
    audio.lfo.connect(audio.lfoGain); audio.lfo.start();

    audio.dryGain.connect(audio.filter);
    audio.delayGain.connect(audio.filter);
    audio.filter.connect(audio.pan);
    audio.pan.connect(audio.master);
    audio.master.connect(audio.analyser);
    audio.master.connect(ctx.destination);
  }
  function resumeAudio(){ initAudio(); if (audio.ctx.state!=="running") audio.ctx.resume(); audio.started=true; audio.muted=false; updatePelletIcons(); }
  function suspendAudio(){ if (audio.ctx && audio.ctx.state==="running") audio.ctx.suspend(); audio.muted=true; updatePelletIcons(); }

  // voices
  const sustained = new Map(); // pc -> Set(oct)
  const voices = new Map();    // "pc:oct" -> nodes
  const hoverNotes = new Set();
  const lastAlt = new Map();   // pc -> "up"|"down"

  function attachLFOToVoice(v){
    if (!audio.lfo || !audio.lfoGain) return;
    audio.lfoGain.disconnect();
    if (audio.lfoTarget === "pitch") audio.lfoGain.connect(v.osc.detune);
    else audio.lfoGain.connect(audio.filter.frequency);
  }

  function createVoice(pc, octave, {ephemeral=false}={}){
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = audio.settings.waveform;
    osc.detune.value = audio.settings.detune;

    const midi = 12*(octave+1)+pc;
    const freq = midiToHz(midi);

    const glide = clamp(audio.settings.glide, 0, 1);
    if (glide>0 && voices.size){
      let sum=0,n=0; for(const k of voices.keys()){ const [spc,so]=k.split(":").map(Number); sum+=12*(so+1)+spc; n++; }
      const fromHz = midiToHz(sum/n);
      osc.frequency.setValueAtTime(fromHz, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + glide);
    } else {
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
    }

    // ADSR
    const t0 = ctx.currentTime;
    const A = clamp(audio.settings.attack, 0.001, 2);
    const D = clamp(audio.settings.decay, 0, 2);
    const S = clamp(audio.settings.sustain, 0, 1);
    const R = clamp(audio.settings.release, 0.02, 4);
    amp.gain.cancelScheduledValues(t0);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(1.0, t0 + A);
    amp.gain.exponentialRampToValueAtTime(Math.max(S,0.0001), t0 + A + D);

    osc.connect(amp); amp.connect(audio.dryGain); amp.connect(audio.delay);
    attachLFOToVoice({osc});
    osc.start();

    const key = `${pc}:${octave}`;
    const pack = {osc, amp, key, release: () => {
      const t = ctx.currentTime;
      amp.gain.cancelScheduledValues(t);
      amp.gain.setValueAtTime(amp.gain.value, t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + R);
      setTimeout(()=>{ try{osc.stop()}catch{}; try{osc.disconnect()}catch{}; try{amp.disconnect()}catch{}; }, (R+0.06)*1000);
    }};
    if (!ephemeral) voices.set(key, pack);
    return pack;
  }

  function startSustain(pc, octave){ const set = sustained.get(pc) || new Set(); if (!set.has(octave)){ set.add(octave); sustained.set(pc,set); createVoice(pc, octave); syncArcs(); } }
  function stopSustainNote(pc){
    const set = sustained.get(pc); if(!set) return;
    for (const oct of set){ const k=`${pc}:${oct}`; const v=voices.get(k); if(v){v.release(); voices.delete(k);} }
    sustained.delete(pc); syncArcs();
  }
  function stopAllSustain(){ for (const v of voices.values()) v.release(); voices.clear(); sustained.clear(); syncArcs(); }
  function hoverPlay(pc, octave, dur=0.35){
    const v = createVoice(pc, octave, {ephemeral:true});
    const key = `h:${pc}:${octave}:${Math.random().toString(36).slice(2)}`;
    hoverNotes.add(key); setTimeout(()=>{ v.release(); hoverNotes.delete(key); }, dur*1000);
  }
  function pickNextOctave(pc){
    const set = sustained.get(pc) || new Set();
    const order = [4,5,3,6,2]; for (const o of order) if (!set.has(o)) return o;
    let o=4; while(set.has(o)) o++; return clamp(o,1,7);
  }

  // ---------- header / controls / layout ----------
  const header = el("div", {class:"hdr"}, [
    el("div", {class:"dot"}),
    el("div", {class:"title"}, "Ring Oscillator"),
    el("div", {class:"spacer"}),
    el("div", {class:"icon", id:"minBtn", title:"Minimize"}, "–"),
    el("button", {class:"btn power", id:"powerBtn", title:"Audio On/Off"}, "Power")
  ]);

  const ctrlTop = el("div", {class:"btn-row"}, [
    el("button", {class:"toggle", id:"intervalToggle", title:"Toggle interval mode"}, "Interval"),
    el("select", {id:"intervalSel", title:"Interval"}, Object.keys(INTERVALS).map(k=>el("option",{},k))),
    el("button", {class:"btn", id:"randChord", title:"Random chord"}, "Chord"),
    el("button", {class:"toggle", id:"keyToggle", title:"Toggle key filter"}, "Key"),
    el("select", {id:"keySel", title:"24 Keys"}, [
      el("option", {value:"none"}, "None"),
      ...NAMES.map((_,i)=>el("option",{value:`M:${i}`},`${NAMES[i]} major`)),
      ...NAMES.map((_,i)=>el("option",{value:`m:${i}`},`${NAMES[i]} minor`))
    ])
  ]);

  const circleWrap = el("div", {class:"circle", style:{ width: CIRCLE.size+"px", height: CIRCLE.size+"px" }});
  const svg = el("svg", {class:"svg", width:String(CIRCLE.size), height:String(CIRCLE.size), viewBox:`0 0 ${CIRCLE.size} ${CIRCLE.size}`});
  circleWrap.appendChild(svg);

  // ---------- knobs container ----------
  const knobs = el("div", {class:"knobs"});

  // Wrap knobs in a padded box so they never clip bottom
  const knobsBox = el("div", {class:"knobs-box"}, [knobs]);

  // Knobs builder
  function makeKnob(labelText, id, {min=0,max=1,step=0.01,value=0,fmt=(v)=>v.toFixed(2)}, onChange){
    const k = el("div",{class:"knob", id});
    const dial = el("div",{class:"dial", title:labelText},[
      el("div",{class:"arc"}),
      el("div",{class:"cap"}),
      el("div",{class:"tick"})
    ]);
    const lab = el("label",{},labelText);
    const val = el("input",{class:"val", value:fmt(value)});
    k.appendChild(dial); k.appendChild(lab); k.appendChild(val);

    const state = { min, max, step, value, prev:value, deg:0 };
    const range = max - min;
    const SWEEP = 270, START = -135;

    function stepClamp(v){ const s = step || 0.0001; return Math.round(v / s) * s; }
    function setValue(v, fromUser=false){
      v = stepClamp(clamp(v, min, max));
      state.value = v;
      const t = (v - min)/range;
      const deg = START + SWEEP * t;
      state.deg = deg;
      dial.style.setProperty("--deg", deg + "deg");
      dial.style.setProperty("--pct", (t*100)+"%");
      if (document.activeElement !== val) val.value = fmt(v);
      if (fromUser && typeof onChange === "function") onChange(v);
    }
    setValue(value, false);

    // pointer drag
    let dragging=false;
    const getAngle = (e) => {
      const r = dial.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const p = e.touches?e.touches[0]:e;
      const x = p.clientX - cx, y = p.clientY - cy;
      let a = Math.atan2(y, x) * 180/Math.PI; a -= 90;
      while (a < -180) a += 360; while (a > 180) a -= 360;
      let rel = clamp(a, START, START+SWEEP);
      const t = (rel - START)/SWEEP; return min + t*range;
    };
    const onDown = e => { dragging=true; e.preventDefault(); setValue(getAngle(e), true); };
    const onMove = e => { if(!dragging) return; e.preventDefault(); setValue(getAngle(e), true); };
    const onUp   = ()=>{ dragging=false; };
    dial.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    dial.addEventListener("touchstart", onDown, {passive:false});
    window.addEventListener("touchmove", onMove, {passive:false});
    window.addEventListener("touchend", onUp);

    // wheel fine adjust
    dial.addEventListener("wheel", (e)=>{ e.preventDefault(); const delta = (e.deltaY>0?-1:1)*(step||((max-min)/150)); setValue(state.value + delta, true); }, {passive:false});

    // numeric scrub + validate
    let dragVal = {drag:false, sx:0, orig:0};
    val.addEventListener("mousedown",(e)=>{ dragVal={drag:true,sx:e.clientX,orig:state.value}; e.preventDefault(); });
    window.addEventListener("mousemove",(e)=>{ if(!dragVal.drag) return; const px = e.clientX - dragVal.sx; const sens = (max-min) / 160; setValue(dragVal.orig + px*sens, true); });
    window.addEventListener("mouseup",()=>{ dragVal.drag=false; });
    val.addEventListener("focus", ()=>{ state.prev = state.value; val.select(); });
    val.addEventListener("keydown", (e)=>{ if(e.key==="Enter") val.blur(); if(e.key==="Escape"){ val.value = fmt(state.prev); val.blur(); } });
    val.addEventListener("blur", ()=>{ const raw = val.value.trim().replace(/[^\-0-9\.]/g,""); const num = Number(raw); if (!isFinite(num)){ val.value = fmt(state.prev); return; } setValue(clamp(num, min, max), true); });

    return {root:k, set:setValue, get:()=>state.value};
  }

  const knob = (label,id,opts,apply)=>{ 
    const k = makeKnob(label,id,opts,(v)=>apply(v)); 
    knobs.appendChild(k.root); 
    return k; 
  };

  knob("Attack","kAttack",{min:0,max:2,step:0.01,value:audio.settings.attack},v=>audio.settings.attack=v);
  knob("Decay","kDecay",{min:0,max:2,step:0.01,value:audio.settings.decay},v=>audio.settings.decay=v);
  knob("Sustain","kSustain",{min:0,max:1,step:0.01,value:audio.settings.sustain},v=>audio.settings.sustain=v);
  knob("Release","kRelease",{min:0,max:4,step:0.01,value:audio.settings.release},v=>audio.settings.release=v);
  knob("Cutoff","kCutoff",{min:100,max:12000,step:1,value:audio.settings.cutoff,fmt:v=>Math.round(v)+" Hz"},v=>{
    audio.settings.cutoff=v; if(audio.filter) audio.filter.frequency.setValueAtTime(v, now());
  });
  knob("Reson.","kRes",{min:0.1,max:20,step:0.1,value:audio.settings.resonance,fmt:v=>v.toFixed(1)},v=>{
    audio.settings.resonance=v; if(audio.filter) audio.filter.Q.setValueAtTime(v, now());
  });
  knob("Detune","kDetune",{min:-1200,max:1200,step:1,value:audio.settings.detune,fmt:v=>Math.round(v)+" ct"},v=>{
    audio.settings.detune=v; for(const {osc} of voices.values()) osc.detune.setValueAtTime(v, now());
  });
  knob("Glide","kGlide",{min:0,max:1,step:0.01,value:audio.settings.glide},v=>audio.settings.glide=v);
  knob("Volume","kVol",{min:0,max:1,step:0.01,value:audio.settings.volume},v=>{
    audio.settings.volume=v; if(audio.master) audio.master.gain.setValueAtTime(v, now());
  });
  knob("Delay","kDelay",{min:0,max:1.5,step:0.01,value:audio.settings.delayTime,fmt:v=>v.toFixed(2)+" s"},v=>{
    audio.settings.delayTime=v; if(audio.delay) audio.delay.delayTime.setValueAtTime(v, now());
  });
  knob("DlyMix","kDelayMix",{min:0,max:1,step:0.01,value:audio.settings.delayMix},v=>{
    audio.settings.delayMix=v; if(audio.delayGain) audio.delayGain.gain.setValueAtTime(v, now());
  });
  knob("Feedback","kFb",{min:0,max:0.95,step:0.01,value:audio.settings.delayFeedback},v=>{
    audio.settings.delayFeedback=v; if(audio.delayFeedback) audio.delayFeedback.gain.setValueAtTime(v, now());
  });
  knob("LFO Hz","kLfoRate",{min:0.1,max:20,step:0.1,value:audio.settings.lfoRate},v=>{
    audio.settings.lfoRate=v; if(audio.lfo) audio.lfo.frequency.setValueAtTime(v, now());
  });
  knob("LFO Amt","kLfoAmt",{min:0,max:1200,step:1,value:audio.settings.lfoAmount,fmt:v=>Math.round(v)},v=>{
    audio.settings.lfoAmount=v; if(audio.lfoGain) audio.lfoGain.gain.setValueAtTime(v, now());
  });

  // LFO Target select (moved to end, no useless input box)
  const lfoTargetWrap = el("div",{class:"knob"},[
    el("label",{for:"lfoTarget"},"LFO→"),
    el("select",{id:"lfoTarget"},[
      el("option",{value:"pitch"},"Pitch"),
      el("option",{value:"filter"},"Filter")
    ])
  ]);
  knobs.appendChild(lfoTargetWrap);

// Waveform select (moved to end, no useless input box)
  const waveformSel = el("select", {id:"waveSel"}, [
    el("option",{value:"sine"},"Sine"),
    el("option",{value:"square"},"Square"),
    el("option",{value:"sawtooth"},"Saw"),
    el("option",{value:"triangle"},"Triangle")
  ]);
  const waveWrap = el("div",{class:"knob"},[
    el("label",{for:"waveSel"},"Wave"),
    waveformSel
  ]);
  knobs.appendChild(waveWrap);

//USELESS HINTS BOX I MIGHT NEED LATER//
//  const hints = el("div",{class:"knob"},[
//    el("label",{},"Hints"),
//    el("input",{class:"val", value:"Hover=play(+interval). Click=sustain. Right-click=remove.", readOnly:true})
//  ]);
//  knobs.appendChild(hints);

  // Main body layout (now with knobsBox wrapper instead of knobs directly)
  const body = el("div", {class:"wrap"}, [
    header,
    ctrlTop,
    circleWrap,
    knobsBox
  ]);

  // Pellet
  const pellet = el("div",{class:"pellet", id:"pelletBtn", title:"Synth"},[
    el("div",{class:"name"},"Synth"),
    el("div",{class:"row"},[
      el("div",{class:"mini", id:"miniMute", title:"Mute/Unmute"}, "🔊"),
      el("div",{class:"mini", id:"miniOpen", title:"Open"}, "⤢")
    ])
  ]);

  // mount once (no duplicate re-appends)
  root.appendChild(body);
  root.appendChild(pellet);

  // ---------- circle + notes ----------
  const center = {x:CIRCLE.size/2, y:CIRCLE.size/2}, radius = CIRCLE.radius;
  const noteButtons = new Map();
  function posFor(idx){
    const angle = (-90 + idx * 30) * Math.PI / 180;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  }

  for (let i=0;i<12;i++){
    const pc = FIFTHS[i]; const p = posFor(i);
    const btn = el("div",{
      class:"note",
      style:{ width: NOTE_DIAM+"px", height: NOTE_DIAM+"px", left:(p.x-NOTE_DIAM/2)+"px", top:(p.y-NOTE_DIAM/2)+"px" },
      title:`${NAMES[pc]} — hover(+interval), click=sustain, right-click=remove`
    }, NAMES[pc]);

    // Hover: melody + optional interval
    btn.addEventListener("mouseenter", () => {
      if (!audio.started || audio.muted) return;
      if (!isNoteAllowed(pc)) return;
      let oct = 4;
      const set = sustained.get(pc);
      if (set && set.size){
        const last = lastAlt.get(pc) || "down";
        const dir = last === "down" ? "up" : "down"; lastAlt.set(pc, dir);
        oct = dir === "up" ? Math.min(6, (Math.max(...set) || 4) + 1)
                           : Math.max(2, (Math.min(...set) || 4) - 1);
      }
      hoverPlay(pc, oct);
      if (intervalToggle.classList.contains("on")){
        const iv = INTERVALS[intervalSel.value] || 0;
        const pc2 = PC(pc + iv);
        if (isNoteAllowed(pc2)) hoverPlay(pc2, oct);
      }
    });

    // Click: sustain (+ interval if on)
    btn.addEventListener("click", e => {
      e.preventDefault();
      if (!audio.started) { resumeAudio(); powerBtn.classList.add("on"); }
      if (!isNoteAllowed(pc)) return;
      const addRoot = () => startSustain(pc, (sustained.get(pc)?.size ? pickNextOctave(pc) : 4));
      if (intervalToggle.classList.contains("on")){
        addRoot(); const iv = INTERVALS[intervalSel.value] || 0; const pc2 = PC(pc + iv);
        if (isNoteAllowed(pc2)) startSustain(pc2, 4);
      } else { addRoot(); }
      updateNoteStates(); syncArcs();
    });

    btn.addEventListener("contextmenu", e => { e.preventDefault(); stopSustainNote(pc); updateNoteStates(); });

    circleWrap.appendChild(btn); noteButtons.set(pc, btn);
  }

  // ---------- PLASMA ARCS ----------
  const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
  const grad = document.createElementNS("http://www.w3.org/2000/svg","linearGradient");
  grad.setAttribute("id","plasmaGrad"); grad.setAttribute("x1","0%"); grad.setAttribute("y1","0%"); grad.setAttribute("x2","100%"); grad.setAttribute("y2","0%");
  grad.innerHTML = `<stop offset="0%" stop-color="#0ff" stop-opacity="0.0"/><stop offset="35%" stop-color="#7de3ff" stop-opacity="0.8"/><stop offset="65%" stop-color="#38bdf8" stop-opacity="1.0"/><stop offset="100%" stop-color="#0ff" stop-opacity="0.0"/>`;
  const glow = document.createElementNS("http://www.w3.org/2000/svg","filter");
  glow.setAttribute("id","glow"); glow.innerHTML = `<feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  const glowWide = document.createElementNS("http://www.w3.org/2000/svg","filter");
  glowWide.setAttribute("id","glowWide"); glowWide.innerHTML = `<feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  defs.appendChild(grad); defs.appendChild(glow); defs.appendChild(glowWide);
  svg.appendChild(defs);

  const arcLayerBack = document.createElementNS("http://www.w3.org/2000/svg","g");
  const arcLayerMid  = document.createElementNS("http://www.w3.org/2000/svg","g");
  const arcLayerFront= document.createElementNS("http://www.w3.org/2000/svg","g");
  svg.appendChild(arcLayerBack); svg.appendChild(arcLayerMid); svg.appendChild(arcLayerFront);

  const arcMap = new Map(); // "a-b" -> {back, mid, front, spark, seed}
  let ampSmooth = 0.2;

  function keyPair(a,b){ return a<b ? `${a}-${b}` : `${b}-${a}`; }
  function activePCs(){ return [...sustained.keys()]; }
  function posOfPC(pc){ const idx = FIFTHS.indexOf(pc); return posFor(idx); }

  function ensureArc(a,b){
    const k = keyPair(a,b);
    if (arcMap.has(k)) return arcMap.get(k);

    const makePath = (stroke, width, opacity, filter, useGrad=false) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg","path");
      p.setAttribute("fill","none");
      p.setAttribute("stroke", stroke);
      p.setAttribute("stroke-width", String(width));
      p.setAttribute("stroke-linecap","round");
      p.setAttribute("opacity", String(opacity));
      if (filter) p.setAttribute("filter", filter);
      if (useGrad) p.setAttribute("stroke","url(#plasmaGrad)");
      p.setAttribute("stroke-dasharray","6 10");
      return p;
    };

    const back = makePath("#7de3ff", 7, 0.30, "url(#glowWide)", false);
    const mid  = makePath("url(#plasmaGrad)", 3.2, 0.95, "url(#glow)", true);
    const front= makePath("#38bdf8", 2.0, 0.90, "url(#glow)", false);

    arcLayerBack.appendChild(back);
    arcLayerMid.appendChild(mid);
    arcLayerFront.appendChild(front);

    const spark = document.createElementNS("http://www.w3.org/2000/svg","circle");
    spark.setAttribute("r","2.8");
    spark.setAttribute("fill","#e0faff");
    spark.setAttribute("filter","url(#glow)");
    arcLayerFront.appendChild(spark);

    const entry = {back, mid, front, spark, seed: Math.random()*1000};
    arcMap.set(k, entry);
    return entry;
  }

  function clearStaleArcs(){
    const need = new Set();
    const pcs = activePCs();
    for (let i=0;i<pcs.length;i++) for (let j=i+1;j<pcs.length;j++) need.add(keyPair(pcs[i],pcs[j]));
    for (const k of [...arcMap.keys()]){
      if (!need.has(k)){
        const {back,mid,front,spark} = arcMap.get(k);
        back.remove(); mid.remove(); front.remove(); spark.remove();
        arcMap.delete(k);
      }
    }
  }
  function syncArcs(){ clearStaleArcs(); }

  function anchorPoints(pa, pb){
    const r = NOTE_DIAM/2 - 2;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const d = Math.hypot(dx,dy) || 1;
    const ux = dx/d, uy = dy/d;
    return [{x: pa.x + ux*r, y: pa.y + uy*r}, {x: pb.x - ux*r, y: pb.y - uy*r}, d];
  }

  function buildPath(pa,pb,time,seed,strand=0){
    let [a,b,dist] = anchorPoints(pa,pb);
    const dx = b.x - a.x, dy = b.y - a.y;
    const nx = -dy / (dist||1), ny = dx / (dist||1);

    const segs = Math.max(22, Math.floor(dist/8));
    const baseAmp = Math.min(20, 9 + dist*0.03) * (1 + 0.12*strand);
    const speed = 0.7 + 0.18*strand;

    let d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`;
    for (let i=1;i<=segs;i++){
      const t = i/segs;
      const px = a.x + dx*t, py = a.y + dy*t;
      const n1 = noise1((t*2.7 + time*speed) + seed);
      const n2 = noise1((t*6.9 - time*speed*0.6) + seed*0.37);
      const n3 = noise1((t*12.3 + time*speed*1.2) + seed*1.13);
      const jitter = (n1-0.5)*0.7 + (n2-0.5)*0.5 + (n3-0.5)*0.25;
      const amp = baseAmp * sCurve(t);
      const bow = (0.5 - Math.abs(0.5 - t)) * 0.65;
      const ox = nx * (jitter * amp + bow * 6);
      const oy = ny * (jitter * amp + bow * 6);
      d += ` L ${(px+ox).toFixed(2)} ${(py+oy).toFixed(2)}`;
    }
    return d;
  }

  function getAudioEnergy(){
    if (!audio.analyser) return 0.2;
    const A = audio.analyser;
    const buf = new Uint8Array(A.fftSize);
    A.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i=0;i<buf.length;i++){ const v = (buf[i]-128)/128; sum += v*v; }
    const rms = Math.sqrt(sum / buf.length);
    return clamp(rms*2.2, 0, 1);
  }

  function animate(){
    const t = performance.now()/1000;
    const energy = getAudioEnergy();
    ampSmooth = ampSmooth*0.9 + energy*0.1;

    const pcs = activePCs();
    if (pcs.length >= 2){
      for (let i=0;i<pcs.length;i++){
        for (let j=i+1;j<pcs.length;j++){
          const a = pcs[i], b = pcs[j];
          const entry = ensureArc(a,b);
          const pa = posOfPC(a), pb = posOfPC(b);

          const d0 = buildPath(pa,pb,t,entry.seed,0);
          const d1 = buildPath(pa,pb,t+0.11,entry.seed+10,1);
          const d2 = buildPath(pa,pb,t+0.23,entry.seed+20,2);

          entry.back.setAttribute("d", d1);
          entry.mid.setAttribute("d", d0);
          entry.front.setAttribute("d", d2);

          const k = 0.6 + 0.8*ampSmooth;
          entry.back.setAttribute("stroke-width", String(6.5 * k));
          entry.front.setAttribute("stroke-width", String(1.8 * k));
          const flick = 0.85 + 0.15*Math.abs(Math.sin((t+entry.seed)*1.4));
          entry.back.setAttribute("opacity", String(0.22 + 0.20*flick));
          entry.front.setAttribute("opacity", String(0.78 + 0.22*flick));

          const baseFlow = 80 + 40*Math.sin((t+entry.seed)*0.6);
          entry.mid.style.strokeDashoffset  = String(-(t*baseFlow)%1000);
          entry.front.style.strokeDashoffset= String(-((t*baseFlow*1.2)+25)%1000);

          const pathNode = entry.front;
          const len = pathNode.getTotalLength ? pathNode.getTotalLength() : 0;
          const sPos = ( (t*0.5 + entry.seed) % 1 ) * (len||1);
          if (len){
            const pt = pathNode.getPointAtLength(sPos);
            entry.spark.setAttribute("cx", pt.x);
            entry.spark.setAttribute("cy", pt.y);
            const sGlow = 0.8 + 0.2*Math.sin((t+entry.seed)*3.1);
            entry.spark.setAttribute("r", String(2.2 + 1.2*sGlow));
          }
        }
      }
    }
    requestAnimationFrame(animate);
  }

  function updateNoteStates(){
    for (const [pc, btn] of noteButtons){
      btn.classList.remove("home");
      const on = sustained.has(pc);
      btn.classList.toggle("active", on);
      btn.classList.toggle("inactive", !isNoteAllowed(pc));
    }
    const homePC = getHomePC();
    if (homePC != null){
      const btn = noteButtons.get(homePC);
      if (btn) btn.classList.add("home");
    }
  }

  // ---------- controls ----------
  const powerBtn = header.querySelector("#powerBtn");
  powerBtn.addEventListener("click", () => {
    if (!audio.started || audio.muted) { resumeAudio(); powerBtn.classList.add("on"); }
    else { suspendAudio(); powerBtn.classList.remove("on"); }
  });

  const intervalToggle = ctrlTop.querySelector("#intervalToggle");
  const intervalSel = ctrlTop.querySelector("#intervalSel");
  intervalToggle.addEventListener("click", () => intervalToggle.classList.toggle("on"));

  const keyToggle = ctrlTop.querySelector("#keyToggle");
  const keySel = ctrlTop.querySelector("#keySel");
  keyToggle.addEventListener("click", () => { keyToggle.classList.toggle("on"); updateNoteStates(); });
  keySel.addEventListener("change", updateNoteStates);

  function isNoteAllowed(pc){
    if (!keyToggle.classList.contains("on")) return true;
    const v = keySel.value; if (v==="none") return true;
    const [mode, rootIdxStr] = v.split(":"); const rootIdx = parseInt(rootIdxStr,10);
    const scale = mode === "M" ? MAJOR : MINOR;
    return scale.map(s=>PC(rootIdx+s)).includes(pc);
  }
  function getHomePC(){
    if (!keyToggle.classList.contains("on")) return null;
    const v = keySel.value; if (v==="none") return null;
    const [_, rootIdxStr] = v.split(":"); return parseInt(rootIdxStr,10);
  }

  const randBtn = ctrlTop.querySelector("#randChord");
  randBtn.addEventListener("click", () => {
    const current = [...sustained.keys()]; const count = current.length; if (!count) return;
    stopAllSustain();
    const pool = []; for (let pc=0; pc<12; pc++) if (isNoteAllowed(pc)) pool.push(pc);
    if (!pool.length) return;
    const chosen = new Set();
    while (chosen.size < Math.min(count, pool.length)) chosen.add(pool[Math.floor(Math.random()*pool.length)]);
    for (const pc of chosen) startSustain(pc, 4);
    updateNoteStates(); syncArcs();
  });

  // drag to move host
  (() => {
    let dragging=false,sx=0,sy=0,bx=0,by=0;
    header.addEventListener("mousedown", e => { dragging=true; sx=e.clientX; sy=e.clientY;
      const r = host.getBoundingClientRect(); bx=r.right; by=r.bottom; header.style.cursor="grabbing"; e.preventDefault();
    });
    window.addEventListener("mousemove", e => {
      if (!dragging) return; const dx=e.clientX-sx, dy=e.clientY-sy;
      host.style.right = (document.documentElement.clientWidth - bx - dx) + "px";
      host.style.bottom = (document.documentElement.clientHeight - by - dy) + "px";
    });
    window.addEventListener("mouseup", ()=>{ dragging=false; header.style.cursor="grab"; });
  })();

  const lfoTargetSel = lfoTargetWrap.querySelector("#lfoTarget");
  lfoTargetSel.addEventListener("change", ()=>{ audio.lfoTarget=lfoTargetSel.value; for (const v of voices.values()) attachLFOToVoice(v); });
  waveformSel.addEventListener("change", ()=>{ audio.settings.waveform = waveformSel.value; });

  // minimize pellet
  const minBtn = header.querySelector("#minBtn");
  const pelletBtn = pellet;
  const miniMute = pellet.querySelector("#miniMute");
  const miniOpen = pellet.querySelector("#miniOpen");
  const orig = {w: SIZE.w, h: SIZE.h};
  let minimized = false;

  function setMinimized(v){
    minimized = v;
    if (v){
      host.classList.add("minimized");
      host.style.width = "120px";  // match .pellet width
      host.style.height = "60px";  // match .pellet height
    } else {
      host.classList.remove("minimized");
      host.style.width = orig.w+"px";
      host.style.height = orig.h+"px";
    }
  }

  minBtn.addEventListener("click", ()=> setMinimized(true));
  miniOpen.addEventListener("click", (e)=>{ e.stopPropagation(); setMinimized(false); });
  miniMute.addEventListener("click", (e)=>{
    e.stopPropagation();
    if (!audio.started || audio.muted){ resumeAudio(); powerBtn.classList.add("on"); }
    else { suspendAudio(); powerBtn.classList.remove("on"); }
  });
  pelletBtn.addEventListener("click", ()=> setMinimized(false));

  // start audio on first pointer inside widget
  root.addEventListener("pointerdown", () => { if (!audio.started){ resumeAudio(); powerBtn.classList.add("on"); } }, {once:false});

  // ---------- arcs orchestration ----------
  function syncArcs(){ clearStaleArcs(); }

  // layout refresh
  function placeNotes(){
    for(const [pc,btn] of noteButtons){
      const idx=FIFTHS.indexOf(pc); const p=posFor(idx);
      btn.style.left=(p.x-NOTE_DIAM/2)+"px"; btn.style.top=(p.y-NOTE_DIAM/2)+"px";
    }
  }
  function refresh(){ placeNotes(); updateNoteStates(); syncArcs(); }

  // go
  requestAnimationFrame(animate);
  refresh();
})();
