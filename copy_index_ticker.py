import glob, os
with open('C:/Users/User/Desktop/projeto brics/frontend/index.html','r',encoding='utf-8',errors='ignore') as f:
    index_content = f.read()
# Extrair bloco ticker (do <div class="ticker"> até </div> do mkt-ticker)
start = index_content.find('<div class="ticker">')
end = index_content.find('<div class="ticker mkt-ticker">')
# Pegar até o </div> do segundo ticker
end2 = index_content.find('</div>', index_content.find('<div class="ticker mkt-ticker">'))
# Encontrar o fechamento completo do bloque do ticker (após o mkt-ticker div)
# Vamos pegar desde start até a próxima </section> ou </header> para ser simples
# Na verdade vamos extrair apenas os dois divs do ticker
ticker_block = index_content[start:index_content.find('  <section class=', start)]
print('bloco ticker extraido len:', len(ticker_block))
for f in glob.glob('C:/Users/User/Desktop/projeto brics/frontend/*.html'):
    if 'index.html' in f: continue
    with open(f,'r',encoding='utf-8',errors='ignore') as file:
        content = file.read()
    # Substituir o bloco atual do ticker pelo do index
    s = content.find('<div class="ticker">')
    if s == -1: continue
    # Encontrar o fim do bloco atual (próximo </section> após o ticker?)
    # Vamos usar uma heurística: até o </div> que fecha o mkt-ticker, depois </div> do container
    e = content.find('</div>', content.find('id="ticker-mkt"', s))
    # Pegar até o fechamento do div do mkt-ticker (incluindo </div>)
    # Melhor: substituir apenas o conteúdo interno, mas vamos tentar substituir todo o bloco
    # Como o bloco pode variar, vamos simplesmente substituir o conteúdo do ticker-in e ticker-mkt pelo do index
    # Vamos extrair o conteúdo interno do ticker-in da index
    tin_start = ticker_block.find('id="ticker-in">')
    tin_end = ticker_block.find('</div>', tin_start)
    tin_content = ticker_block[tin_start+len('id="ticker-in">'):tin_end]
    # Extrair conteúdo do mkt-ticker
    mkt_start = ticker_block.find('id="ticker-mkt">')
    mkt_end = ticker_block.find('</div>', mkt_start)
    mkt_content = ticker_block[mkt_start+len('id="ticker-mkt">'):mkt_end]
    # Substituir nas outras páginas
    content = content.replace('id="ticker-in">BrBRICS — carregando mercado...</div></div>', 'id="ticker-in">'+tin_content+'</div></div>')
    content = content.replace('<div class="ticker-track" id="ticker-mkt"><span class="muted">Carregando mercado...</span></div>', '<div class="ticker-track" id="ticker-mkt">'+mkt_content+'</div>')
    with open(f,'w',encoding='utf-8',errors='ignore') as file:
        file.write(content)
    print('fix', os.path.basename(f))
