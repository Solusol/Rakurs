from pathlib import Path
import hashlib
import re
import subprocess
import tempfile

EXPECTED = {
    'app.js': 'e8a0801923fb0e6fc706120deb32f328f0baa44a',
    'styles.css': '58d6087081100f8caee131fe5ccc00edd1700260',
    'sw.js': 'a0e00809d794f0aebcfe7bb8913b56bf27bca883',
}
MARK = 'RK_VISIBLE_INSERT_V1'
CSS_MARK = 'RK_CHECKBOX_BODY_FONT_V1'
VERSION = '20261113-visible-insert-checkbox-font-1'

def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()

def once(text, old, new):
    if text.count(old) != 1:
        raise RuntimeError('Unexpected source anchor: ' + old[:100])
    return text.replace(old, new, 1)

POSITION = '''  /* RK_VISIBLE_INSERT_V1: current viewport, overlaps allowed */
  const ccRect=stage.getBoundingClientRect();
  const ccScale=ccRect.width>0?ccRect.width/1000:Math.max(scale,0.01);
  const ccPane=scroller?scroller.getBoundingClientRect():null;
  const ccTop=Math.max(0,viewTop(),tools.getBoundingClientRect().bottom,ccRect.top);
  const ccBottom=Math.min(window.innerHeight,viewBottom());
  const ccLeft=Math.max(0,ccRect.left,ccPane?ccPane.left:0);
  const ccRight=Math.min(window.innerWidth,ccRect.right,ccPane?ccPane.right:window.innerWidth);
  if(ccRight>ccLeft&&ccBottom>ccTop){
    const ccWidth=(ccRight-ccLeft)/ccScale,ccHeight=(ccBottom-ccTop)/ccScale;
    it.x=clamp((ccLeft-ccRect.left)/ccScale+Math.max(0,(ccWidth-it.w)/2),0,1000-it.w);
    it.y=clamp((ccTop-ccRect.top)/ccScale+Math.max(0,(ccHeight-it.h)/2),0,200000-it.h);
  }
'''

CSS = '''
/* RK_CHECKBOX_BODY_FONT_V1: labels only; headings keep their font */
html body label:has(input[type=checkbox]),
html body label:has(input[type=checkbox]) :where(span,.label-text),
html body :is(#view,#view2Body) .rk-character-designer .cc-row:has(>input[type=checkbox]) .cc-input {
  font-family: var(--prose, serif) !important;
}
'''

def transform_app(text):
    designer=text.index('function rkCharacterDesigner(')
    start=text.index(' function add(type)',designer)
    end=text.index('\n function remove(it)',start)
    original=text[start:end]
    changed=once(original,'y:model.items.length?Math.max(...model.items.map(x=>x.y+x.h))+40:40','y:40')
    changed=once(changed,'  model.items.push(it);',POSITION+'  model.items.push(it);')
    scroll="if(commit(true))stage.querySelector('[data-element=\"'+CSS.escape(it.id)+'\"]')?.scrollIntoView({block:'nearest'});"
    changed=once(changed,scroll,'commit(true);')
    return text[:start]+changed+text[end:]

def main():
    raw={name:Path(name).read_bytes() for name in EXPECTED}
    source={name:value.decode('utf-8') for name,value in raw.items()}
    if MARK in source['app.js'] and CSS_MARK in source['styles.css'] and VERSION in source['sw.js']:
        print('Patch already installed')
        return
    for name,expected in EXPECTED.items():
        if blob(raw[name]) != expected:
            raise RuntimeError(name + ' changed; refusing to overwrite author changes')
    app=transform_app(source['app.js'])
    css=source['styles.css']+CSS
    worker,n=re.subn(r"const V='[^']+';","const V='"+VERSION+"';",source['sw.js'],count=1)
    if n != 1:
        raise RuntimeError('Service worker version anchor not found')
    with tempfile.TemporaryDirectory() as directory:
        for name,value in [('app.js',app),('sw.js',worker)]:
            temporary=Path(directory)/name
            temporary.write_text(value,encoding='utf-8')
            subprocess.run(['node','--check',str(temporary)],check=True)
    for name in EXPECTED:
        if Path(name).read_bytes()!=raw[name]:
            raise RuntimeError('Source changed during patch: '+name)
    for name,value in [('app.js',app),('styles.css',css),('sw.js',worker)]:
        Path(name).write_bytes(value.encode('utf-8'))
    print('Only insertion geometry, checkbox font and cache version changed')

if __name__=='__main__':
    main()
