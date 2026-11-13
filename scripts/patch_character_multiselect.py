from pathlib import Path
import hashlib,subprocess
APP_SHA='29dc53013d08831635df03947d35ff3b250d2255'
SW_SHA='37f4294f5f5902e16067b41f667e56dc5ca37683'
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def once(s,a,b):
    if s.count(a)!=1:raise RuntimeError('Unexpected source marker: '+a[:80])
    return s.replace(a,b,1)
def transform(s,fragment):
    marker=' function geometry(n,it){ccEnhanceBlock(n,it);'
    after="ccMultiGeometry(n,it);queueMicrotask(()=>{if(n.isConnected){ccEnhanceBlock(n,it);ccMultiGeometry(n,it);}});"
    s=once(s,marker,fragment+'\n'+marker+after)
    s=once(s," function pick(id){selected=id;stage.querySelectorAll('.cc-item').forEach(n=>n.classList.toggle('cc-selected',n.dataset.element===id));}"," function pick(id){ccPick(id);}")
    s=once(s,' function drag(e,it,node,resizing){',' function drag(e,it,node,resizing){if(!resizing&&ccIds.size>1&&ccIds.has(it.id)){ccDragGroup(e,it);return;}')
    old_font='''<div class="field"><label>Размер текста</label><input type="number" data-cc="font" min="12" max="48" value="'+it.font+'"></div>'''
    new_font=old_font+'''<label><input type="checkbox" data-cc="hideTitle"'+(it.hideTitle?' checked':'')+'> Убрать заголовок</label>'''
    s=once(s,old_font,new_font)
    s=once(s,"it.border=m.querySelector('[data-cc=border]').checked;","it.border=m.querySelector('[data-cc=border]').checked;it.hideTitle=m.querySelector('[data-cc=hideTitle]').checked;")
    return s
def main():
    a,w=Path('app.js'),Path('sw.js');raw,worker=a.read_bytes(),w.read_bytes()
    if blob(raw)!=APP_SHA or blob(worker)!=SW_SHA:raise RuntimeError('Source changed; refusing to overwrite it')
    out=transform(raw.decode(),Path('scripts/character_multiselect.fragment.js').read_text())
    sw=once(worker.decode(),"const V='20261113-character-block-colors-1';","const V='20261113-character-multiselect-1';")
    tmp=Path('.multi-check.js');tmp.write_text(out)
    try:subprocess.run(['node','--check',str(tmp)],check=True)
    finally:tmp.unlink(missing_ok=True)
    a.write_text(out);w.write_text(sw)
if __name__=='__main__':main()
