// Preserve the authored cutout area while filtering small shrub leaves.
// This runs once per shared atlas, before any material uploads the texture.
// RGB is filtered in linear light with alpha weighting to exclude atlas padding.
export function foliageMipmaps(texture,cutoff=.26){
 const image=texture.image,canvas=document.createElement('canvas');
 canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 let width=canvas.width,height=canvas.height,data=ctx.getImageData(0,0,width,height).data;
 const threshold=cutoff*255;
 let covered=0;for(let i=3;i<data.length;i+=4)if(data[i]>=threshold)covered++;
 const coverage=covered/(width*height),mips=[image],diagnostics=[];
 const linear=Array.from({length:256},(_,v)=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
 const encode=v=>Math.round(255*(v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055));
 while(width>1||height>1){
  const w=Math.max(1,width>>1),h=Math.max(1,height>>1),next=new Uint8ClampedArray(w*h*4),hist=new Uint32Array(256);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let a=0,red=0,green=0,blue=0;
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const i=(Math.min(height-1,y*2+dy)*width+Math.min(width-1,x*2+dx))*4,weight=data[i+3];
    a+=weight;red+=linear[data[i]]*weight;green+=linear[data[i+1]]*weight;blue+=linear[data[i+2]]*weight;
   }
   const i=(y*w+x)*4;
   if(a){next[i]=encode(red/a);next[i+1]=encode(green/a);next[i+2]=encode(blue/a);}
   next[i+3]=Math.round(a*.25);
  }
  // At gameplay distance, a photographed leaf cluster can collapse into many
  // unrelated one-pixel alpha islands.  Alpha-test then turns those islands
  // into the black/bright "pepper" noise visible in motion and against sky.
  // Once a mip is small enough that individual photographed leaf tips are no
  // longer resolvable, blend alpha with a one-texel tent filter.  This does not
  // touch the base texture or RGB detail; it only lets tiny neighbouring leaves
  // resolve as the coherent branchlet mass they represent from that distance.
  if(Math.max(w,h)<=256&&w>2&&h>2){
   const source=new Uint8ClampedArray(next),mix=Math.max(w,h)<=64?.76:.60;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let sum=0,weight=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const xx=Math.min(w-1,Math.max(0,x+dx)),yy=Math.min(h-1,Math.max(0,y+dy));
     const kernel=(dx===0&&dy===0)?4:(dx===0||dy===0)?2:1;
     sum+=source[(yy*w+xx)*4+3]*kernel;weight+=kernel;
    }
    const i=(y*w+x)*4,filtered=sum/weight;
    next[i+3]=Math.round(source[i+3]*(1-mix)+filtered*mix);
   }
  }
  for(let i=3;i<next.length;i+=4)hist[next[i]]++;
  // Bounded, per-level correction. Never propagate scaled alpha to the next
  // level: that would progressively fill the real holes between branches.
  let lo=.5,hi=2;
  for(let step=0;step<14;step++){
   const scale=(lo+hi)*.5;let survivors=0;
   for(let a=Math.ceil(threshold/scale);a<256;a++)survivors+=hist[a];
   if(survivors/(w*h)<coverage)lo=scale;else hi=scale;
  }
  const scale=w*h>=64?(lo+hi)*.5:1,output=new Uint8ClampedArray(next);
  for(let i=3;i<output.length;i+=4)output[i]=Math.min(255,Math.round(output[i]*scale));
  // Preserve RGB underneath zero-alpha texels. A canvas would premultiply
  // them to black and reintroduce a fringe when the GPU samples a mip edge.
  // ImageData is a supported TexImageSource and retains those hidden bytes.
  let filled=new Uint8Array(w*h);
  for(let p=0;p<filled.length;p++)filled[p]=next[p*4+3]>0?1:0;
  for(let pass=0;pass<2;pass++){
   const previous=new Uint8ClampedArray(output),oldFilled=filled;filled=new Uint8Array(oldFilled);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x;if(oldFilled[p])continue;let n=0,red=0,green=0,blue=0;
    for(const q of [x>0?p-1:-1,x+1<w?p+1:-1,y>0?p-w:-1,y+1<h?p+w:-1]){
     if(q<0||!oldFilled[q])continue;n++;red+=previous[q*4];green+=previous[q*4+1];blue+=previous[q*4+2];
    }
    if(n){output[p*4]=red/n;output[p*4+1]=green/n;output[p*4+2]=blue/n;filled[p]=1;}
   }
  }
  mips.push(new ImageData(output,w,h));
  diagnostics.push({width:w,height:h,scale});data=next;width=w;height=h;
 }
 texture.mipmaps=mips;texture.generateMipmaps=false;texture.needsUpdate=true;
 texture.userData.foliageMips={cutoff,coverage,levels:diagnostics};
 return texture;
}
