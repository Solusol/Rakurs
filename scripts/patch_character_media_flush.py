from pathlib import Path
import hashlib,subprocess
APP_SHA='5a0ded783fedcef99bb6377143a6992b486f518e'
SW_SHA='ddc6dea0f982503fddbc7d4e5223c648f69d9056'
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def once(s,a,b):
    if s.count(a)!=1:raise RuntimeError('Unexpected source marker: '+a[:100])
    return s.replace(a,b,1)
def transform(s,fragment):
    marker=' function geometry(n,it){ccEnhanceBlock(n,it);'
    s=once(s,marker,fragment+'\n'+marker)
    if s.count('ccMultiGeometry(n,it);')!=2:raise RuntimeError('Unexpected render hooks')
    s=s.replace('ccMultiGeometry(n,it);','ccMultiGeometry(n,it);ccMediaGeometry(n,it);')
    old="+extra,m=>{if(!editable())return false;const found=model.items.find(x=>x.id===it.id);"
    new="+extra+(it.type==='media'&&it.media?.kind==='image'?'<label><input type=\"checkbox\" data-cc=\"roundMedia\"'+(it.roundMedia?' checked':'')+'> Скруглить углы</label>':''),m=>{if(!editable())return false;const found=model.items.find(x=>x.id===it.id);"
    s=once(s,old,new)
    old="const fit=m.querySelector('[data-cc=fit]');if(fit)it.fit=fit.value;"
    s=once(s,old,old+"const rounded=m.querySelector('[data-cc=roundMedia]');if(rounded)it.roundMedia=rounded.checked;")
    return s
def main():
    app,sw=Path('app.js'),Path('sw.js');a,w=app.read_bytes(),sw.read_bytes()
    if blob(a)!=APP_SHA or blob(w)!=SW_SHA:raise RuntimeError('Source changed; refusing to overwrite it')
    result=transform(a.decode(),Path('scripts/character_media_flush.fragment.js').read_text())
    worker=once(w.decode(),"const V='20261113-character-media-clean-1';","const V='20261113-character-media-flush-1';")
    temp=Path('.media-flush-check.js');temp.write_text(result)
    try:subprocess.run(['node','--check',str(temp)],check=True)
    finally:temp.unlink(missing_ok=True)
    app.write_text(result);sw.write_text(worker)
if __name__=='__main__':main()
