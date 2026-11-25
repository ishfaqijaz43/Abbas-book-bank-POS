// Print only receipt content, never the POS shell or modal backdrop.
export function printThermal(source) {
  if (!source) { alert('Receipt is not available.'); return; }
  const popup = window.open('', '_blank', 'width=420,height=650');
  if (!popup) { alert('Allow pop-ups for this POS, then print again.'); return; }
  const doc = popup.document;
  doc.open(); doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title></head><body></body></html>'); doc.close();
  const style = doc.createElement('style');
  style.textContent = `@page{margin:0;size:58mm 100mm} *{box-sizing:border-box} html,body{margin:0;padding:0;background:white;color:black} body{font: bold 12px/1.35 Arial,sans-serif} main{width:46mm;max-width:100%;margin:0 auto;padding:1mm 0;overflow-wrap:anywhere} main *{color:black!important;position:static!important;max-width:100%;height:auto;min-height:0;box-shadow:none!important} h2{font-size:14px;margin:3px 0} p{margin:3px 0} .thermal-center,.thermal-footer,h2{text-align:center} .thermal-logo{display:block;width:24mm;margin:2px auto} .thermal-meta,.abb-print-item>div{display:flex;justify-content:space-between;gap:4px;flex-wrap:wrap} .thermal-rule{border-top:1px dashed black;margin:4px 0} .abb-print-item{margin:4px 0;break-inside:avoid} .thermal-footer{margin-top:6px} .thermal-grand{font-size:14px} html,body{width:58mm;height:auto!important;min-height:0!important} main{display:flow-root;break-inside:auto} @media print{main{margin:0 auto} body{padding:0}}`;
  doc.head.append(style);
  const main = doc.createElement('main');
  const copy = doc.importNode(source,true);
  copy.querySelectorAll('button,input,select,textarea,.ext-print-hide,.ext-modal-actions').forEach(n=>n.remove());
  // Discard outer modal layout and inline sizing inherited from the app.
  while(copy.firstChild) main.append(copy.firstChild);
  doc.body.append(main);
  const images = Array.from(main.querySelectorAll('img'));
  images.forEach(img=>{img.src=new URL(img.getAttribute('src'),window.location.href).href;});
  const ready = Promise.all(images.map(img=>img.decode().catch(()=>{img.remove();})));
  Promise.race([ready,new Promise(resolve=>setTimeout(resolve,2500))]).then(async()=>{
    if(popup.closed)return;
    images.forEach(img=>{if(!img.complete||!img.naturalWidth)img.remove();});
    if(doc.fonts)await doc.fonts.ready;
    if(popup.closed)return;
    // Measure at the exact same width used in print, including padding.
    const mm = Math.ceil(main.getBoundingClientRect().height * 25.4 / 96) + 2;
    const page = doc.createElement('style');
    page.textContent = `@page{size:58mm ${mm}mm;margin:0} @media print{html,body{width:58mm!important;height:auto!important;margin:0!important;padding:0!important}}`;
    doc.head.append(page);
    popup.requestAnimationFrame(()=>popup.requestAnimationFrame(()=>{if(!popup.closed){popup.focus();popup.print();}}));
  });
}
export function printReturnSlip(slip) {
  const root=document.createElement('div');
  const add=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;root.append(el);};
  add('h2','ABBAS BOOK BANK');add('div','RETURN SLIP','thermal-center');
  add('p','Receipt: '+slip.receipt);add('p','Return ID: '+slip.id);add('p','Date: '+slip.date);add('p','Reason: '+slip.reason);
  add('div','','thermal-rule');
  slip.items.forEach(item=>{add('div',item.name,'abb-print-item');add('p','Quantity returned: '+item.quantity);});
  add('div','','thermal-rule');add('h2','Refund due: '+slip.refund);add('p','Refund payment recorded separately.');
  printThermal(root);
}
