
 /* Flush image layout; keep controls outside the clipped image content. */
 function ccMediaGeometry(n,it){
  if(it.type!=='media')return;
  const media=n.querySelector('img.cc-media'),content=n.querySelector('.cc-content');if(!media||!content)return;
  content.style.setProperty('padding','0','important');content.style.setProperty('gap','0','important');
  content.style.setProperty('overflow','hidden','important');
  const radius=it.roundMedia?getComputedStyle(n).borderRadius:'0px';
  content.style.setProperty('border-radius',radius,'important');media.style.setProperty('border-radius',radius,'important');
  media.style.setProperty('display','block','important');media.style.setProperty('margin','0','important');media.style.setProperty('width','100%','important');
  if(!media.complete||!media.naturalWidth||!media.naturalHeight){
   if(!media.dataset.ccFlushLoad){media.dataset.ccFlushLoad='1';media.addEventListener('load',()=>{if(n.isConnected){geometry(n,it);fit();}},{once:true,signal});}return;
  }
  if(it.fit==='cover')return;
  const cs=getComputedStyle(n),horizontal=(parseFloat(cs.borderLeftWidth)||0)+(parseFloat(cs.borderRightWidth)||0),vertical=(parseFloat(cs.borderTopWidth)||0)+(parseFloat(cs.borderBottomWidth)||0);
  const title=n.querySelector('.cc-title'),titleHeight=title&&getComputedStyle(title).display!=='none'?title.getBoundingClientRect().height/scale:0;
  const wanted=Math.min(4000,Math.max(80,Math.round(((Math.max(1,it.w-horizontal)*media.naturalHeight/media.naturalWidth)+titleHeight+vertical)*1000)/1000));
  const changed=Math.abs(it.h-wanted)>.001;it.h=wanted;n.style.height=wanted+'px';if(changed)fit();
 }
