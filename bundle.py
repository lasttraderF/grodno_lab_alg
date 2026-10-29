from pathlib import Path
p=Path(__file__).parent
html=(p/'src/index.html').read_text()
for key,file in [('STYLE','style.css'),('CATALOG','catalog.js'),('MODEL','model.js')]:
 html=html.replace('/*__'+key+'__*/',(p/'src'/file).read_text())
app='\n'.join((p/'src'/name).read_text() for name in ('app.js','views.js','events.js'))
html=html.replace('/*__APP__*/',app)
(p/'dist').mkdir(exist_ok=True)
(p/'dist/index.html').write_text(html)
print('Built standalone HTML:',len(html.encode()),'bytes')
