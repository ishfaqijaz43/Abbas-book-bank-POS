// Native text receipts, 32 columns verified by the USB test.
const WIDTH = 32;
let busy = false;
const recent = new Map();
const DUPLICATE_MS = 8000;
async function logoRaster() {
  const img = new Image();
  img.src = '/branding/af-notebook.jpg';
  await img.decode();
  const width = 192, height = Math.max(1, Math.min(192, Math.round(width * img.naturalHeight / img.naturalWidth)));
  const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
  const scale=Math.min(width/img.naturalWidth,height/img.naturalHeight);
  const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);
  const pixels=ctx.getImageData(0,0,width,height).data;
  const bytes=new Uint8Array(width/8*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(pixels[i]*0.299+pixels[i+1]*0.587+pixels[i+2]*0.114<160)bytes[y*24+(x>>3)]|=128>>(x&7);
  }
  return {height,data:btoa(String.fromCharCode(...bytes))};
}
function ascii(value) {
  return String(value ?? '').replace(/×/g,'x').replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/·/g,'-').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?').replace(/ +/g,' ').trim();
}
function wrap(value) {
  let s=ascii(value), lines=[];
  while(s.length>WIDTH){let i=s.lastIndexOf(' ',WIDTH);if(i<=0)i=WIDTH;lines.push(s.slice(0,i));s=s.slice(i).trimStart();}
  if(s)lines.push(s);return lines;
}
function pair(a,b){a=ascii(a);b=ascii(b);return a.length+b.length<WIDTH?[a+' '.repeat(WIDTH-a.length-b.length)+b]:[...wrap(a),...wrap(b)];}
async function send(lines){
  const text=lines.join('\n');
  const now=Date.now();
  for(const [key,time] of recent)if(now-time>=DUPLICATE_MS)recent.delete(key);
  if(busy||recent.has(text))return;
  busy=true;
  recent.set(text,now);
  try {
    const logo=await logoRaster();
    const r=await fetch('http://localhost:18765/print',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,logo})});
    if(!r.ok)throw Error('Printer bridge returned '+r.status);
  } catch(e){alert('Native printing failed or status unknown. Check the Windows printer bridge and print queue before retrying. '+e.message);}
  finally{recent.set(text,Date.now());busy=false;}
}
export function printThermal(source){
  if(!source){alert('Receipt is not available.');return;}
  const lines=[];
  function visit(n){
    if(n.nodeType===3){lines.push(...wrap(n.textContent));return;}
    if(n.nodeType!==1||n.matches('button,input,select,textarea,img,.ext-print-hide,.ext-modal-actions'))return;
    if(n.matches('.thermal-rule')){lines.push('-'.repeat(WIDTH));return;}
    if(n.matches('.thermal-meta,.abb-print-item > div')&&n.children.length===2){lines.push(...pair(n.children[0].textContent,n.children[1].textContent));return;}
    if(!n.children.length){const a=wrap(n.textContent);lines.push(...(n.matches('h2,.thermal-center,.thermal-footer')?a.map(x=>' '.repeat(Math.floor((WIDTH-x.length)/2))+x):a));return;}
    if(n.matches('p,h2,strong,span')){lines.push(...wrap(n.textContent));return;}
    for(const child of n.childNodes)visit(child);
  }
  visit(source);return send(lines);
}
export function printReturnSlip(slip){
  const lines=['        ABBAS BOOK BANK','          RETURN SLIP',...wrap('Receipt: '+slip.receipt),...wrap('Return ID: '+slip.id),...wrap('Date: '+slip.date),...wrap('Reason: '+slip.reason),'-'.repeat(WIDTH)];
  for(const item of slip.items)lines.push(...wrap(item.name),...wrap('Quantity returned: '+item.quantity));
  lines.push('-'.repeat(WIDTH),...pair('Refund due:',slip.refund),...wrap('Refund payment recorded separately.'));return send(lines);
}
