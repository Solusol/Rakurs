from pathlib import Path
import hashlib, re, subprocess
EXPECTED_BETA = 'e72ad14be64eff33821ba5dcec7a9fa8be3d4210'
EXPECTED_SW = '47462f30c2b74e52cc14ec15b4d68a814856a559'

def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def change(source, old, new):
    if source.count(old) != 1:
        raise RuntimeError('Source marker is not unique: ' + old[:100])
    return source.replace(old, new, 1)

def transform(s):
    parts=Path('scripts/manual_beta_fragments.js').read_text().split('/* AUTHOR_FRAGMENT */')
    if len(parts)!=2:raise RuntimeError('Invalid fragments')
    shared,author=parts
    s=change(s,'const api={',shared+'\nconst api={')
    s=change(s,'return data||[]; },\n  async insertComment',"if(!betaMatch&&where.owner_id===user()?.id){return (data||[]).concat(privateComments().filter(c=>c.author_id===user().id&&Object.entries(where).every(([k,v])=>Array.isArray(v)?v.includes(c[k]):c[k]===v)));} return data||[]; },\n  async insertComment")
    s=change(s,'async insertComment(row){ const',"async insertComment(row){ if(!betaMatch&&row.role==='author')return draftComment(row); const")
    s=change(s,'async setDone(id,done){ const','async setDone(id,done){ const draft=privateById(id);if(draft){savePrivate(privateComments().map(c=>c.id===id?{...c,done}:c));return;} const')
    s=change(s,'async deleteComment(id){ const','async deleteComment(id){ const draft=privateById(id);if(draft){savePrivate(privateComments().filter(c=>c.id!==id).map(c=>c.parent_id===id?{...c,parent_id:null}:c));return;} const')
    s=change(s,"  box.addEventListener('mousedown',e=>e.stopPropagation());","  attachPublishButtons(box,t,ctx);\n  box.addEventListener('mousedown',e=>e.stopPropagation());")
    s=change(s,"placeholder:'Ответ…',ok:'Отправить'","placeholder:'Ответ…',ok:ctx.role==='author'?'Сохранить':'Отправить'")
    for name,replacement in [('queuePush','function queuePush(id){}'),('onFlush','function onFlush(){}'),('pushAllShared','async function pushAllShared(){await loadShares();}')]:
        pattern=r'(?m)^  (?:async )?function '+name+r'\([^\n]*\n'
        s,n=re.subn(pattern,'  '+replacement+'\n',s)
        if n!=1:raise RuntimeError('Missing automatic publisher: '+name)
    s=change(s,'  /* --- окно «Доступ для беты» --- */',author+'\n  /* --- окно «Доступ для беты» --- */')
    s=change(s,'''<div class="rk-share-item${s.active?'':' off'}" data-id="${s.id}">''','''<div class="rk-share-item${s.active?'':' off'}" data-id="${s.id}"><button type="button" class="rk-manual-publish" data-publish-share="${s.id}" title="Отправить текущую версию глав бете" aria-label="Отправить текущую версию глав бете"${s.active?'':' disabled'}>${manualIcon}</button>''')
    marker="      m.querySelectorAll('[data-copy]').forEach"
    s=change(s,marker,"      m.querySelectorAll('[data-publish-share]').forEach(b=>b.onclick=()=>publishShare(list.find(x=>x.id===b.dataset.publishShare),b,say));\n"+marker)
    s=change(s,'if(!s.active) await pushChapters(s.chapters||[]); ','')
    s=change(s,"await pushChapters(ids); await render(null,'Список глав обновлён');","await render(null,'Список глав обновлён. Отправь их бете кнопкой обновления в карточке ссылки.');")
    s=change(s,'          await pushChapters(ids);','          /* First publication also requires the explicit refresh icon. */')
    s=change(s,'Ссылка создана и скопирована — отправь её бете.','Ссылка создана и скопирована. Сначала отправь главы кнопкой обновления в карточке ссылки, затем отправь ссылку бете.')
    color_line=next(line for line in s.splitlines() if "m.querySelectorAll('.rk-share-swatch').forEach" in line)
    new_color='''      m.querySelectorAll('.rk-share-swatch').forEach(b=>b.onclick=()=>{const ws=B().wsData();ws.betaColors=Object.assign({},colors(),{[b.dataset.role]:b.dataset.color});B().save();m.querySelectorAll(`.rk-share-swatch[data-role="${b.dataset.role}"]`).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));say('Цвет сохранён у автора. Для беты отправь обновление кнопкой в карточке ссылки.');decorateCurrent(true);});'''
    s=change(s,color_line,new_color)
    s=change(s,"const ctx={role:'author',uid:me,colors:col,canResolve:true,","const ctx={role:'author',uid:me,colors:col,canResolve:true,onPublish:async c=>{await publishPrivate(c);await decorate(p,host,true);},")
    start=s.index('function authorSide()');end=s.index('function betaScreen',start)
    part=s[start:end].replace('composer({',"composer({ok:'Сохранить',")
    s=s[:start]+part+s[end:]
    if len(re.findall(r'pushChapters\(',s))!=2:raise RuntimeError('Unexpected chapter publication path')
    return s

def main():
    bp,wp=Path('beta.js'),Path('sw.js')
    b,w=bp.read_bytes(),wp.read_bytes()
    if blob(b)!=EXPECTED_BETA or blob(w)!=EXPECTED_SW:raise RuntimeError('GitHub source changed; refusing to overwrite it')
    patched=transform(b.decode())
    cache=change(w.decode(),"const V='20261109-main-menu-logout-1';","const V='20261112-manual-beta-1';")
    temporary=Path('.manual-beta-syntax.js');temporary.write_text(patched)
    try:subprocess.run(['node','--check',str(temporary)],check=True)
    finally:temporary.unlink(missing_ok=True)
    bp.write_text(patched);wp.write_text(cache)

if __name__=='__main__':main()
