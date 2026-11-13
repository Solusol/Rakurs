from pathlib import Path
import hashlib, subprocess
APP_SHA = '1e13f8d52239d7386b2f9ac54930623a84d94aeb'
SW_SHA = 'f835ce0d234abc710cb5fb38bdca852f20f59d54'

def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def transform(source, helper):
    start=source.index('function rkCharacterDesigner(host,p,data){')
    marker=' function geometry(n,it){'
    at=source.index(marker,start)
    if source.count(marker)!=1 or 'function ccAutoInk(' in source:
        raise RuntimeError('Unexpected constructor version')
    return source[:at]+helper+'\n'+source[at:].replace(marker,marker+'ccEnhanceBlock(n,it);',1)

def main():
    app,sw=Path('app.js'),Path('sw.js')
    a,w=app.read_bytes(),sw.read_bytes()
    if blob(a)!=APP_SHA or blob(w)!=SW_SHA:
        raise RuntimeError('Source changed; refusing to overwrite it')
    updated=transform(a.decode(),Path('scripts/character_block_colors.fragment.js').read_text())
    old="const V='20261113-character-frames-3';"
    if w.decode().count(old)!=1:raise RuntimeError('Unexpected cache version')
    cache=w.decode().replace(old,"const V='20261113-character-block-colors-1';",1)
    tmp=Path('.character-colors-check.js');tmp.write_text(updated)
    try:subprocess.run(['node','--check',str(tmp)],check=True)
    finally:tmp.unlink(missing_ok=True)
    app.write_text(updated);sw.write_text(cache)

if __name__=='__main__':main()
