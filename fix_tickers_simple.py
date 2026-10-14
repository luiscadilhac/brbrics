import glob, re, os
files = glob.glob('C:/Users/User/Desktop/projeto brics/frontend/*.html')
for f in files:
    with open(f,'r',encoding='utf-8',errors='ignore') as file:
        content = file.read()
    # Substituir ticker-in por conteúdo simples duplicado para animação
    old_in = '<div class="ticker-track" id="ticker-in">'
    # Encontrar o bloco do ticker-in no arquivo
    start = content.find(old_in)
    if start == -1:
        continue
    # Extrair até </div> do ticker-in
    end = content.find('</div>', start)
    # Substituir o conteúdo interno pelo simples
    content = content.replace(content[start:end+6], '<div class="ticker-track" id="ticker-in"><span class="tick-market">BrBRICS</span><span class="tick-sep"> /// </span><a href="manchetes.html" target="_blank" rel="noopener"><span class="tick-ico">●</span>Portal de Transparência — dados em tempo real</a><span class="tick-sep"> /// </span><span class="tick-market">BrBRICS</span><span class="tick-sep"> /// </span><a href="manchetes.html" target="_blank" rel="noopener"><span class="tick-ico">●</span>Portal de Transparência — dados em tempo real</a></div>')
    # Preencher mkt-ticker com dados fixos
    content = content.replace('<div class="ticker-track" id="ticker-mkt"><span class="muted">B3 • Câmbio • Cripto • Atualizado</span></div>', '<div class="ticker-track" id="ticker-mkt"><span class="tick-market">B3</span> <b>131.200</b> <span class="tick-sep"> /// </span> <span class="tick-market">USD/BRL</span> <b>5,05</b> <span class="tick-sep"> /// </span> <span class="tick-market">BTC</span> <b>US$ 67.432</b></div>')
    with open(f,'w',encoding='utf-8',errors='ignore') as file:
        file.write(content)
    print('fix', os.path.basename(f))
