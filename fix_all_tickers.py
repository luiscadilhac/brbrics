import glob, os
files = glob.glob('C:/Users/User/Desktop/projeto brics/frontend/*.html')
insert = '<div class="ticker"><div class="ticker-track" id="ticker-in"><span class="tick-market">BrBRICS</span><span class="tick-sep"> /// </span><a href="manchetes.html" target="_blank" rel="noopener"><span class="tick-ico">●</span>Portal de Transparência — dados em tempo real</a><span class="tick-sep"> /// </span><span class="tick-market">BrBRICS</span><span class="tick-sep"> /// </span><a href="manchetes.html" target="_blank" rel="noopener"><span class="tick-ico">●</span>Portal de Transparência — dados em tempo real</a></div></div>  <div class="ticker mkt-ticker"><div class="ticker-track" id="ticker-mkt"><span class="muted">B3 • Câmbio • Cripto • Atualizado</span></div></div>'
for f in files:
    with open(f,'r',encoding='utf-8',errors='ignore') as file:
        content = file.read()
    if '<div class="ticker">' not in content:
        # inserir após </header>
        content = content.replace('</header>', '</header>\n'+insert)
        with open(f,'w',encoding='utf-8',errors='ignore') as file:
            file.write(content)
        print('inserido em', os.path.basename(f))
    else:
        print('ja tem', os.path.basename(f))
