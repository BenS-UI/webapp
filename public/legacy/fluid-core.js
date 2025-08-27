// fluid-core.js
export class Fluid {
  constructor({ baseFactor = 90, iter = 20, dpr = 1 } = {}) {
    this.baseFactor = baseFactor;
    this.iter = iter;
    this.dpr = dpr;

    this.W = 0; this.H = 0; this.N = 0;
    this._alloc(); // minimal; N may be 0 until first resize
  }

  clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  IX(x,y){ return x + y * (this.N + 2); }

  pickGrid() {
    const area = (this.W/this.dpr) * (this.H/this.dpr);
    const target = Math.sqrt(area / 150000);
    return this.clamp(Math.floor(this.baseFactor * target), 128, 384)|0;
  }

  setBaseFactor(f) {
    this.baseFactor = f|0;
    const n = this.pickGrid();
    if (n !== this.N) this._resampleTo(n);
  }

  resize(W,H) {
    this.W = W; this.H = H;
    const n = this.pickGrid();
    if (this.N === 0) { this.N = n; this._alloc(); this.clearDye(); }
    else if (n !== this.N) this._resampleTo(n);
  }

  _alloc() {
    const s = (this.N + 2) * (this.N + 2);
    this.u = new Float32Array(s);
    this.v = new Float32Array(s);
    this.u0 = new Float32Array(s);
    this.v0 = new Float32Array(s);
    this.dR = new Float32Array(s);
    this.dG = new Float32Array(s);
    this.dB = new Float32Array(s);
    this.dR0 = new Float32Array(s);
    this.dG0 = new Float32Array(s);
    this.dB0 = new Float32Array(s);
  }

  _resampleTo(newN) {
    const oldN = this.N;
    const oIX = (x,y)=> x + y * (oldN + 2);
    const oR = this.dR, oG = this.dG, oB = this.dB;
    this.N = newN; this._alloc();
    const N = this.N;

    for (let j=1;j<=N;j++){
      const y = ((j)/(N+1))*(oldN+1);
      const y0 = Math.floor(y), y1 = Math.min(oldN, y0+1);
      const ty = y - y0;
      for (let i=1;i<=N;i++){
        const x = ((i)/(N+1))*(oldN+1);
        const x0 = Math.floor(x), x1 = Math.min(oldN, x0+1);
        const tx = x - x0;
        const i00=oIX(x0,y0), i10=oIX(x1,y0), i01=oIX(x0,y1), i11=oIX(x1,y1);
        const r=(1-tx)*(1-ty)*oR[i00] + tx*(1-ty)*oR[i10] + (1-tx)*ty*oR[i01] + tx*ty*oR[i11];
        const g=(1-tx)*(1-ty)*oG[i00] + tx*(1-ty)*oG[i10] + (1-tx)*ty*oG[i01] + tx*ty*oG[i11];
        const b=(1-tx)*(1-ty)*oB[i00] + tx*(1-ty)*oB[i10] + (1-tx)*ty*oB[i01] + tx*ty*oB[i11];
        const id=this.IX(i,j); this.dR[id]=r; this.dG[id]=g; this.dB[id]=b;
      }
    }
    this.u.fill(0); this.v.fill(0); this.u0.fill(0); this.v0.fill(0);
  }

  clearDye(){ this.dR.fill(2); this.dG.fill(4); this.dB.fill(8); }
  setCell(i,j,[r,g,b]){ const id=this.IX(i,j); this.dR[id]=r; this.dG[id]=g; this.dB[id]=b; }

  set_bnd(b,x){
    const N=this.N, IX=this.IX.bind(this);
    for(let i=1;i<=N;i++){
      x[IX(0,i)]=b===1?-x[IX(1,i)]:x[IX(1,i)];
      x[IX(N+1,i)]=b===1?-x[IX(N,i)]:x[IX(N,i)];
      x[IX(i,0)]=b===2?-x[IX(i,1)]:x[IX(i,1)];
      x[IX(i,N+1)]=b===2?-x[IX(i,N)]:x[IX(i,N)];
    }
    x[IX(0,0)]=.5*(x[IX(1,0)]+x[IX(0,1)]);
    x[IX(0,N+1)]=.5*(x[IX(1,N+1)]+x[IX(0,N)]);
    x[IX(N+1,0)]=.5*(x[IX(N,0)]+x[IX(N+1,1)]);
    x[IX(N+1,N+1)]=.5*(x[IX(N,N+1)]+x[IX(N+1,N)]);
  }
  lin_solve(b,x,x0,a,c){
    const N=this.N, IX=this.IX.bind(this), it=this.iter, cR=1/c;
    for(let k=0;k<it;k++){
      for(let j=1;j<=N;j++) for(let i=1;i<=N;i++)
        x[IX(i,j)]=(x0[IX(i,j)]+a*(x[IX(i-1,j)]+x[IX(i+1,j)]+x[IX(i,j-1)]+x[IX(i,j+1)]))*cR;
      this.set_bnd(b,x);
    }
  }
  diffuse(b,x,x0,dif,dt){ const a=dt*dif*this.N*this.N; this.lin_solve(b,x,x0,a,1+4*a); }
  advect(b,d,d0,u,v,dt){
    const N=this.N, IX=this.IX.bind(this), clamp=this.clamp;
    const dt0=dt*N;
    for(let j=1;j<=N;j++){
      for(let i=1;i<=N;i++){
        let x=i-dt0*u[IX(i,j)], y=j-dt0*v[IX(i,j)];
        if(x<.5)x=.5; if(x>N+.5)x=N+.5; if(y<.5)y=.5; if(y>N+.5)y=N+.5;
        const i0=x|0,i1=i0+1,j0=y|0,j1=j0+1,s1=x-i0,s0=1-s1,t1=y-j0,t0=1-t1;
        d[IX(i,j)]=s0*(t0*d0[IX(i0,j0)] + t1*d0[IX(i0,j1)])
                  +s1*(t0*d0[IX(i1,j0)] + t1*d0[IX(i1,j1)]);
      }
    }
    this.set_bnd(b,d);
  }
  project(u,v,p,div){
    const N=this.N, IX=this.IX.bind(this);
    for(let j=1;j<=N;j++) for(let i=1;i<=N;i++){
      div[IX(i,j)]=-.5*(u[IX(i+1,j)]-u[IX(i-1,j)] + v[IX(i,j+1)]-v[IX(i,j-1)])/N; p[IX(i,j)]=0;
    }
    this.set_bnd(0,div); this.set_bnd(0,p);
    this.lin_solve(0,p,div,1,4);
    for(let j=1;j<=N;j++) for(let i=1;i<=N;i++){
      u[IX(i,j)]-=.5*N*(p[IX(i+1,j)]-p[IX(i-1,j)]);
      v[IX(i,j)]-=.5*N*(p[IX(i,j+1)]-p[IX(i,j-1)]);
    }
    this.set_bnd(1,u); this.set_bnd(2,v);
  }
  vel_step(visc,dt){
    const {u,v,u0,v0}=this;
    for(let i=0;i<u.length;i++){ u[i]+=u0[i]; v[i]+=v0[i]; u0[i]=0; v0[i]=0; }
    this.diffuse(1,this.u0,this.u,visc,dt);
    this.diffuse(2,this.v0,this.v,visc,dt);
    this.project(this.u0,this.v0,this.u,this.v);
    this.advect(1,this.u,this.u0,this.u0,this.v0,dt);
    this.advect(2,this.v,this.v0,this.u0,this.v0,dt);
    this.project(this.u,this.v,this.u0,this.v0);
  }
  dens_step(diff,dt){
    this.diffuse(0,this.dR0,this.dR,diff,dt);
    this.diffuse(0,this.dG0,this.dG,diff,dt);
    this.diffuse(0,this.dB0,this.dB,diff,dt);
    this.advect(0,this.dR,this.dR0,this.u,this.v,dt);
    this.advect(0,this.dG,this.dG0,this.u,this.v,dt);
    this.advect(0,this.dB,this.dB0,this.u,this.v,dt);
  }

  gridFromPx(px,py){
    return [
      this.clamp((px/this.W)*(this.N+2),1,this.N),
      this.clamp((py/this.H)*(this.N+2),1,this.N)
    ];
  }

  drawTo(ctx){
    const W=this.W,H=this.H,N=this.N, IX=this.IX.bind(this), clamp=this.clamp;
    const img = ctx.createImageData(W,H), p=img.data;
    const sx=N/W, sy=N/H;
    let k=0;
    for(let y=0;y<H;y++){
      const gy=clamp((y*sy+1)|0,1,N);
      for(let x=0;x<W;x++){
        const gx=clamp((x*sx+1)|0,1,N), id=IX(gx,gy);
        p[k++]=clamp(this.dR[id],0,255)|0;
        p[k++]=clamp(this.dG[id],0,255)|0;
        p[k++]=clamp(this.dB[id],0,255)|0;
        p[k++]=255;
      }
    }
    ctx.putImageData(img,0,0);
  }
}
