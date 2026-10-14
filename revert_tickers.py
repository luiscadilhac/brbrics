import glob, os, re
files = glob.glob('C:/Users/User/Desktop/projeto brics/frontend/*.html')
for f in files:
    with open(f,'r',encoding='utf-8',errors='ignore') as file:
        content = file.read()
    # Voltar ticker-in para simples (o renderTicker duplica)
    content = re.sub(
        r'<div class="ticker-track" id="ticker-in">.*?</div>',
        '<div class="ticker-track" id="ticker-in">BrBRICS — carregando mercado...</div>',
        content, flags=re.DOTALL)
    # Voltar mkt-ticker para simples
    content = re.sub(
        r'<div class="ticker-track" id="ticker-mkt">.*?</div>',
        '<div class="ticker-track" id="ticker-mkt"><span class="muted">Carregando mercado...</span></div>',
        content, flags=re.DOTALL)
    with open(f,'w',encoding='utf-8',errors='ignore') as file:
        file.write(content)
    print('revertido', os.path.basename(f))
