
 /* MULTI_SELECT_V1 */
 const ccIds=new Set();let ccSkipClick=false;
 const ccStyle=document.createElement('style');ccStyle.textContent='html body :is(#view,#view2Body) .rk-character-designer .cc-multi-selected{outline:1px solid currentColor;outline-offset:2px}html body :is(#view,#view2Body) .rk-character-designer .cc-marquee{position:absolute;pointer-events:none;z-index:9999;border:1px solid currentColor;background:color-mix(in srgb,currentColor 12%,transparent)}';root.appendChild(ccStyle);
 function ccRefreshSelection(){
  const live=new Set(model.items.map(it=>it.id));for(const id of ccIds)if(!live.has(id))ccIds.delete(id);
  if(!editable()){ccIds.clear();selected='';}
  stage.querySelectorAll('.cc-item').forEach(n=>{n.classList.toggle('cc-selected',editable()&&n.dataset.element===selected);n.classList.toggle('cc-multi-selected',editable()&&ccIds.has(n.dataset.element));});
 }
 function ccPick(id){if(!id){ccIds.clear();selected='';}else{if(!ccIds.has(id)){ccIds.clear();ccIds.add(id);}selected=id;}ccRefreshSelection();}
 function ccPoint(e){const r=stage.getBoundingClientRect();return {x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale};}
 function ccIntersects(it,box){return it.x<box.x+box.w&&it.x+it.w>box.x&&it.y<box.y+box.h&&it.y+it.h>box.y;}
 function ccDelta(items,anchor,dx,dy,snap){
  if(snap){dx=Math.round((anchor.x+dx)/20)*20-anchor.x;dy=Math.round((anchor.y+dy)/20)*20-anchor.y;}
  return {x:Math.max(-Math.min(...items.map(x=>x.x)),Math.min(1000-Math.max(...items.map(x=>x.x+x.w)),dx)),y:Math.max(-Math.min(...items.map(x=>x.y)),Math.min(200000-Math.max(...items.map(x=>x.y)),dy))};
 }
 function ccScroll(place){
  let last=null,raf=0;
  function tick(){raf=0;if(!last)return;if(!editable()){cancelDrag?.();return;}const y=last.clientY,top=viewTop(),bottom=viewBottom();const delta=y>bottom-48?Math.min(24,(y-bottom+48)*.6):y<top+48?-Math.min(24,(top+48-y)*.6):0;if(!delta)return;if(scroller)scroller.scrollTop+=delta;else window.scrollBy(0,delta);place(last);raf=requestAnimationFrame(tick);}
  return {move(e){last=e;place(e);if(!raf)raf=requestAnimationFrame(tick);},stop(){last=null;if(raf)cancelAnimationFrame(raf);raf=0;}};
 }
 function ccSuppressClick(){ccSkipClick=true;setTimeout(()=>{ccSkipClick=false;},0);}
 function ccDragGroup(e,it){
  if(!editable()||e.button!==0||e.isPrimary===false)return;
  const originals=model.items.filter(x=>ccIds.has(x.id)).map(x=>({id:x.id,x:x.x,y:x.y,w:x.w,h:x.h}));if(originals.length<2)return;
  e.preventDefault();e.stopPropagation();const before=clone(model),length=history.undo.length,start=ccPoint(e),anchor=originals.find(x=>x.id===it.id);checkpoint();
  const ac=new AbortController();let changed=false;
  function place(ev){const p=ccPoint(ev),d=ccDelta(originals,anchor,p.x-start.x,p.y-start.y,model.grid&&!ev.altKey);changed=changed||d.x!==0||d.y!==0;for(const old of originals){const item=model.items.find(x=>x.id===old.id);if(!item)continue;item.x=old.x+d.x;item.y=old.y+d.y;const node=[...stage.querySelectorAll('.cc-item')].find(n=>n.dataset.element===old.id);if(node)geometry(node,item);}fit();}
  const scroll=ccScroll(place);
  function clean(){scroll.stop();ac.abort();cancelDrag=null;}
  function cancel(){clean();model=before;history.undo.splice(length);draw();ccRefreshSelection();}
  function end(){if(!editable()){cancel();return;}clean();if(changed)commit(false);else{history.undo.splice(length);buttons();}ccSuppressClick();}
  cancelDrag=cancel;
  window.addEventListener('pointermove',ev=>{if(!editable()){cancel();return;}scroll.move(ev);},{signal:ac.signal});
  window.addEventListener('pointerup',end,{once:true,signal:ac.signal});window.addEventListener('pointercancel',cancel,{once:true,signal:ac.signal});
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}},{capture:true,signal:ac.signal});signal.addEventListener('abort',cancel,{once:true,signal:ac.signal});
 }
 function ccMarquee(e){
  e.preventDefault();e.stopImmediatePropagation();const start=ccPoint(e),old=new Set(ccIds),previous=selected,add=e.shiftKey||e.ctrlKey||e.metaKey,ac=new AbortController();
  if(!add)ccPick('');const base=add?old:new Set();
  const box=document.createElement('div');box.className='cc-marquee';box.hidden=true;stage.appendChild(box);
  stage.focus({preventScroll:true});
  function place(ev){const p=ccPoint(ev),r={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};if(Math.hypot(r.w,r.h)*scale<3)return;box.hidden=false;Object.assign(box.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});ccIds.clear();for(const id of base)ccIds.add(id);for(const it of model.items)if(ccIntersects(it,r))ccIds.add(it.id);selected=[...ccIds].pop()||'';ccRefreshSelection();}
  const scroll=ccScroll(place);
  function clean(){scroll.stop();ac.abort();box.remove();cancelDrag=null;}
  function cancel(){clean();ccIds.clear();for(const id of old)ccIds.add(id);selected=previous;ccRefreshSelection();}
  function end(){clean();ccSuppressClick();}
  cancelDrag=cancel;
  window.addEventListener('pointermove',ev=>{if(!editable()){cancel();return;}scroll.move(ev);},{signal:ac.signal});window.addEventListener('pointerup',end,{once:true,signal:ac.signal});window.addEventListener('pointercancel',cancel,{once:true,signal:ac.signal});
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}},{capture:true,signal:ac.signal});signal.addEventListener('abort',cancel,{once:true,signal:ac.signal});
 }
 stage.tabIndex=0;
 stage.addEventListener('pointerdown',e=>{
  if(!editable()||e.button!==0||e.isPrimary===false||cancelDrag)return;
  const target=e.target instanceof Element?e.target:null;if(!target)return;
  if(target.closest('input,textarea,select,[contenteditable=true],.cc-item-tools,.cc-resize'))return;
  const item=target.closest('.cc-item');
  if(!item){if(target===stage)ccMarquee(e);return;}
  const id=item.dataset.element;
  if(e.shiftKey||e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();if(ccIds.has(id))ccIds.delete(id);else ccIds.add(id);selected=ccIds.has(id)?id:([...ccIds].pop()||'');ccRefreshSelection();ccSkipClick=true;window.addEventListener('pointerup',ccSuppressClick,{once:true,signal});}
  else if(!ccIds.has(id)){ccIds.clear();ccIds.add(id);selected=id;ccRefreshSelection();}
 },{capture:true,signal});
 stage.addEventListener('click',e=>{if(ccSkipClick){ccSkipClick=false;e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal});
 stage.addEventListener('keydown',e=>{if(e.key==='Escape'&&!cancelDrag&&!(e.target instanceof Element&&e.target.closest('input,textarea,[contenteditable=true]'))){ccPick('');}},{signal});
 function ccMultiGeometry(n,it){
  n.classList.toggle('cc-multi-selected',editable()&&ccIds.has(it.id));
  const title=n.querySelector('.cc-title');if(title)title.style.setProperty('display',it.hideTitle||(!editable()&&!String(it.title||'').trim())?'none':'block','important');
 }
