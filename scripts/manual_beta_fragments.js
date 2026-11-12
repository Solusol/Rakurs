/* MANUAL_BETA_PUBLICATION_V1: drafts stay in the owner's project, never in rk_comments. */
const manualIcon='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.6-3L20 8M4 16l2.3 3A7 7 0 0 0 17.9 16"/></svg>';
const manualStyle=document.createElement('style');manualStyle.textContent='.rk-manual-publish{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 28px;width:28px!important;height:28px!important;min-width:28px!important;padding:4px!important;background:transparent!important;color:inherit!important;border:0!important;cursor:pointer}.rk-manual-publish:focus-visible{outline:2px solid currentColor!important;outline-offset:2px}.rk-manual-publish[disabled]{opacity:.5;cursor:default}.rk-manual-publish[data-state=pending]{outline:1px dashed currentColor;outline-offset:1px}.rk-share-item{position:relative;padding-right:48px}.rk-share-item>.rk-manual-publish{position:absolute;right:10px;top:10px}';document.head.appendChild(manualStyle);
function manualWorkspace(write=false){const b=window.RK_BETA_BRIDGE;if(betaMatch||!b||!user())throw Error('Открой проект автора');if(write&&document.body.classList.contains('tab-readonly'))throw Error('Это окно только для чтения');return b.wsData();}
function privateComments(){return manualWorkspace().betaPrivateComments||[];}
function savePrivate(list){manualWorkspace(true).betaPrivateComments=list;window.RK_BETA_BRIDGE.save();}
function privateById(id){if(betaMatch||!window.RK_BETA_BRIDGE||!user())return null;return privateComments().find(c=>c.id===id&&c.author_id===user().id);}
function draftComment(row){if(row.owner_id!==user()?.id||row.author_id!==user()?.id)throw Error('Неверный аккаунт комментария');const c={...row,id:crypto.randomUUID(),done:false,created_at:new Date().toISOString(),_private:true};savePrivate([...privateComments(),c]);return c;}
async function publishPrivate(c){if(!c._private||c.author_id!==user()?.id)throw Error('Нет личного черновика');if(c.parent_id&&privateById(c.parent_id))throw Error('Сначала отправь родительский комментарий');const workspace=manualWorkspace(),account=user().id,row={...c};delete row._private;const {error}=await sb().from('rk_comments').upsert(row,{onConflict:'id'});if(error)throw error;if(user()?.id!==account||manualWorkspace()!==workspace)throw Error('Аккаунт или проект изменился; проверь статус отправки');savePrivate(privateComments().filter(x=>x.id!==c.id));}
function manualButton(title){const b=document.createElement('button');b.type='button';b.className='rk-manual-publish';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=manualIcon;return b;}
function attachPublishButtons(box,t,ctx){if(ctx.role!=='author')return;const messages=[t.root,...t.replies];box.querySelectorAll('.rk-bc-msg').forEach((node,i)=>{const c=messages[i];if(c?.role!=='author'||c.author_id!==ctx.uid)return;const b=manualButton(c._private?'Отправить комментарий бете — пока виден только тебе':'Комментарий уже отправлен бете');b.dataset.state=c._private?'pending':'sent';b.disabled=!c._private;b.onclick=async e=>{e.stopPropagation();b.disabled=true;try{await ctx.onPublish(c);}catch(err){toast(humanErr(err));if(b.isConnected)b.disabled=false;}};node.querySelector('.rk-bc-meta').appendChild(b);});}
/* AUTHOR_FRAGMENT */
  /* Manual publication only. Existing rk_chapters snapshots are shared by overlapping links. */
  async function publishShare(s,button,say){
    if(!ready()||!s.active)return;
    const affected=(shares||[]).filter(x=>x.active&&x.id!==s.id&&(x.chapters||[]).some(id=>(s.chapters||[]).includes(id)));
    if(affected.length&&!confirm('Эти главы также открыты другим бетам: '+affected.map(x=>x.editor_email).join(', ')+'. Их копии этих глав тоже обновятся. Отправить?'))return;
    const account=user().id,project=projectId();button.disabled=true;
    try{await pushChapters(s.chapters||[]);if(user()?.id!==account||projectId()!==project)throw Error('Аккаунт или проект изменился');const {error}=await sb().from('rk_shares').update({colors:colors()}).eq('id',s.id).eq('owner_id',account);if(error)throw error;button.dataset.state='sent';button.title='Главы отправлены бете';say('Главы отправлены бете. Личные комментарии не отправлялись.');}
    catch(e){button.dataset.state='pending';say(humanErr(e),true);}finally{if(button.isConnected)button.disabled=false;}
  }
  function legacySource(node,p){
    if(node.querySelector('textarea'))return null;
    const text=node.querySelector('.txt')?.textContent.trim(),bid=node.closest('.blk')?.dataset.id;if(!text||!bid)return null;
    const d=B().D,anns=Object.values(d.anns||{}).filter(a=>a.b1===bid&&(!a.pid||a.pid===p.id)&&String(a.text||'').trim()===text);
    if(anns.length===1){const a=anns[0];return {key:'ann:'+a.id,row:{body:a.text,block_id:a.b1,quote:a.q||'',o1:a.o1,o2:a.b1===a.b2?a.o2:null}};}
    const n=d.notes?.[bid],body=typeof n==='string'?n:n?.text;
    if(body&&String(body).trim()===text&&!anns.length)return {key:'note:'+bid,row:{body,block_id:bid}};
    return null;
  }
  function decorateLegacy(){
    if(!ready())return;
    document.querySelectorAll(':is(#view,#view2Body) .noteslot .note').forEach(node=>{
      let b=node.querySelector('[data-manual-legacy]');if(b)return;
      b=manualButton('Отправить сохранённый комментарий бете');b.dataset.manualLegacy='1';b.dataset.state='pending';
      b.onclick=async e=>{e.preventDefault();e.stopPropagation();const p=B().curPage,source=legacySource(node,p);if(!source){toast('Сначала сохрани комментарий. Если заметка не определилась однозначно, отправка отменена.');return;}
        b.disabled=true;
        try{await loadShares(true);if(!node.closest('#view'))throw Error('Отправляй заметку с основной страницы');const list=activeSharesForPage(p.id);if(!list.length)throw Error('Для главы нет активной ссылки беты');let target=list[0];if(list.length>1){const choice=prompt('Выбери номер беты:\n'+list.map((x,i)=>(i+1)+'. '+x.editor_email).join('\n'),'1');if(choice===null)return;target=list[Number(choice)-1];if(!target)throw Error('Неверный номер беты');}
          const ws=manualWorkspace(true),key=user().id+':'+p.id+':'+source.key+':'+target.id,previous=ws.betaPublishedNotes?.[key];
          const row={...source.row,id:previous?.id||crypto.randomUUID(),share_id:target.id,owner_id:user().id,page_id:p.id,role:'author',author_id:user().id,author_name:'Автор',done:false};
          const {error}=await sb().from('rk_comments').upsert(row,{onConflict:'id'});if(error)throw error;
          ws.betaPublishedNotes=ws.betaPublishedNotes||{};ws.betaPublishedNotes[key]={id:row.id,body:row.body,ts:Date.now()};B().save();b.dataset.state='sent';toast('Комментарий отправлен бете');await decorate(p,document.getElementById('view'),true);
        }catch(err){toast(humanErr(err));}finally{if(b.isConnected)b.disabled=false;}
      };
      const source=legacySource(node,B().curPage);if(source){const sent=Object.entries(manualWorkspace().betaPublishedNotes||{}).some(([k,v])=>k.startsWith(user().id+':'+B().curPage.id+':'+source.key+':')&&v.body===source.row.body);if(sent){b.dataset.state='sent';b.title='Эта редакция уже отправлена хотя бы одной бете. Нажми для выбора получателя и повторной отправки.';}}
      node.appendChild(b);
    });
  }
  let legacyFrame=0;new MutationObserver(()=>{if(!legacyFrame)legacyFrame=requestAnimationFrame(()=>{legacyFrame=0;decorateLegacy();});}).observe(document.body,{childList:true,subtree:true});
