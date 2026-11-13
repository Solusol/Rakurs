 function ccPaletteColors(){
  const key=document.body.dataset.rkPalette||document.body.dataset.palette||'base',all=window.RK_BETA_BRIDGE?.PALETTES;
  const colors=new Set(),seen=new WeakSet();
  function visit(v){if(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)){colors.add(v.toLowerCase());return;}if(v&&typeof v==='object'&&!seen.has(v)){seen.add(v);Object.values(v).forEach(visit);}}
  visit(all?.[key]);
  if(!colors.size){const css=getComputedStyle(document.body);['--rk-dark','--rk-light','--rk-heading','--rk-primary','--rk-secondary','--rk-hover'].forEach(k=>visit(css.getPropertyValue(k).trim()));}
  return [...colors];
 }
/* PALETTE_CONTROLS */
  const swatches=section.querySelector('[data-cc-palette]');swatches.style.cssText='display:flex;flex-wrap:wrap;gap:10px;padding:4px;';
  function syncSwatches(){swatches.querySelectorAll('button').forEach(b=>{const on=!reset.checked&&b.dataset.hex===color.value.toLowerCase();b.setAttribute('aria-pressed',String(on));b.style.setProperty('outline',on?'2px solid var(--rk-text,var(--text))':'none','important');b.style.outlineOffset='2px';});}
  ccPaletteColors().forEach(hex=>{const b=document.createElement('button');b.type='button';b.dataset.hex=hex;b.title=hex;b.setAttribute('aria-label','Цвет '+hex);b.style.cssText='display:block;width:30px;height:30px;min-width:30px;padding:0;border:1px solid var(--line-strong);border-radius:50%;cursor:pointer;';b.style.setProperty('background',hex,'important');b.onclick=e=>{e.preventDefault();e.stopPropagation();color.value=hex;reset.checked=false;syncSwatches();};swatches.appendChild(b);});
  reset.addEventListener('change',syncSwatches);syncSwatches();
