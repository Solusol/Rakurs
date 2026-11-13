
 /* Per-item background, stored in the same model as the other block settings. */
 function ccAutoInk(hex){
  const c=hex.slice(1).match(/../g).map(x=>{const v=parseInt(x,16)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});
  const l=c[0]*.2126+c[1]*.7152+c[2]*.0722;
  return (l+.05)/.05>=1.05/(l+.05)?'#000000':'#ffffff';
 }
 function ccPaintBlock(n,it){
  const bg=/^#[0-9a-f]{6}$/i.test(it.blockColor||'')?it.blockColor:null;
  if(!bg){if(n.dataset.ccOwnColor){['background-color','color','--ci','--cp'].forEach(k=>n.style.removeProperty(k));delete n.dataset.ccOwnColor;}return;}
  const ink=ccAutoInk(bg);n.dataset.ccOwnColor='1';
  n.style.setProperty('background-color',bg,'important');n.style.setProperty('color',ink,'important');
  n.style.setProperty('--ci',ink,'important');n.style.setProperty('--cp',bg,'important');
 }
 function ccColorSettings(it){
  const m=document.getElementById('specialModal'),ok=m?.querySelector('#spOk'),body=m?.querySelector('.dlgbox-body');
  if(!m||m.hidden||!ok||!body||body.querySelector('[data-cc-block-color]'))return;
  const current=model.items.find(x=>x.id===it.id);if(!current)return;
  const own=/^#[0-9a-f]{6}$/i.test(current.blockColor||'');
  const section=document.createElement('fieldset');section.dataset.ccBlockColor='1';
  section.innerHTML='<legend>Цвет блока</legend><label style="display:flex;gap:12px;align-items:center">Цвет фона <input type="color" aria-label="Цвет фона блока"></label><label style="display:flex;gap:10px;align-items:center;margin-top:10px"><input type="checkbox"> Как у карточки — без собственной заливки</label><p class="muted" style="margin-top:8px">Текст и линии автоматически станут чёрными или белыми для контраста.</p>';
  const color=section.querySelector('input[type=color]'),reset=section.querySelector('input[type=checkbox]');
  const inherited=getComputedStyle(root).getPropertyValue('--cp').trim();
  color.value=own?current.blockColor:(/^#[0-9a-f]{6}$/i.test(inherited)?inherited:'#e5e0cf');reset.checked=!own;
  color.addEventListener('input',()=>{reset.checked=false;});body.appendChild(section);
  const original=ok.onclick;
  if(typeof original!=='function'){section.remove();return;}
  ok.onclick=function(e){
   if(!editable())return;
   const value=reset.checked?null:color.value;
   original.call(this,e);
   if(!m.hidden)return;
   const target=model.items.find(x=>x.id===it.id);if(!target||!editable())return;
   if((target.blockColor||null)===value)return;
   change(()=>{if(value)target.blockColor=value;else delete target.blockColor;},true);
  };
 }
 function ccEnhanceBlock(n,it){
  ccPaintBlock(n,it);if(!editable())return;
  const bar=n.querySelector('.cc-item-tools');if(!bar)return;
  const buttons=[...bar.querySelectorAll('button')];
  const button=buttons.find(b=>/настрой|редакт|параметр/i.test(b.title||b.getAttribute('aria-label')||''))||(buttons[0]?.classList.contains('cc-move')?buttons[1]:null);
  if(!button||button.dataset.ccColorHook||typeof button.onclick!=='function')return;
  const original=button.onclick;button.dataset.ccColorHook='1';
  button.onclick=function(e){const result=original.call(this,e);ccColorSettings(it);return result;};
 }
