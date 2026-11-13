from pathlib import Path
import hashlib,subprocess
APP_SHA='81d45aa37d3c0e22a06ed5e05fd3d6c9a0a3cb76'
SW_SHA='ec68bc0e80fa42954ae8ba0898698f7112a24545'
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def once(s,a,b):
    if s.count(a)!=1:raise RuntimeError('Unexpected source marker: '+a[:90])
    return s.replace(a,b,1)
def transform(s,parts):
    helper,controls=parts.split('/* PALETTE_CONTROLS */')
    s=once(s,' function ccColorSettings(it){',helper+'\n function ccColorSettings(it){')
    s=once(s,'<input type="color" aria-label="Цвет фона блока">','<input type="hidden" data-cc-palette-value><span data-cc-palette role="group" aria-label="Цвета выбранной палитры"></span>')
    s=once(s,"section.querySelector('input[type=color]')","section.querySelector('input[data-cc-palette-value]')")
    s=once(s,'<p class="muted" style="margin-top:8px">Текст и линии автоматически станут чёрными или белыми для контраста.</p>','')
    marker="  color.addEventListener('input',()=>{reset.checked=false;});body.appendChild(section);"
    s=once(s,marker,controls+'\n'+marker)
    return s
def main():
    app,sw=Path('app.js'),Path('sw.js');a,w=app.read_bytes(),sw.read_bytes()
    if blob(a)!=APP_SHA or blob(w)!=SW_SHA:raise RuntimeError('Source changed; refusing to overwrite it')
    out=transform(a.decode(),Path('scripts/character_palette.fragment.js').read_text())
    worker=once(w.decode(),"const V='20261113-character-multiselect-1';","const V='20261113-character-palette-1';")
    temp=Path('.palette-check.js');temp.write_text(out)
    try:subprocess.run(['node','--check',str(temp)],check=True)
    finally:temp.unlink(missing_ok=True)
    app.write_text(out);sw.write_text(worker)
if __name__=='__main__':main()
