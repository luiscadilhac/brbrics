# BrBRICS — portal de transparência

Portal público com **dados reais** de fontes oficiais brasileiras (DOU, PNCP, Câmara, Senado,
DataJud, BCB, IBGE, INPE, ANA, Fipe), servidos por um backend próprio em Express e por páginas
estáticas em `frontend/`.

- Deploy: Render, serviço `brbrics-portal` (ver `render.yaml`), reimplanta no push da `main`
- Ar no ar: https://brbrics.com.br
- O domínio `brbrics.com.br` ainda **não** serve esta aplicação (apontamento por resolver)

## Rodar localmente

```powershell
npm install
npm start        # ou dar dois cliques em iniciar.bat
# abrir http://localhost:3000
```

Variáveis de ambiente usadas pelo backend (opcionalmente num `.env`, que está no `.gitignore`):

| Variável | Para quê |
|---|---|
| `TRANSPARENCIA_TOKEN` | consultas ao Portal da Transparência |
| `BRAPI_TOKEN` | geocoding/rotas |
| `PAINEL_TOKEN` | acesso ao `painel.html` |
| `SITE_URL` | URL base usada em SEO/links |

## Estrutura

```
backend/     Express, um módulo por domínio de dados; server.js faz o require e o registro das rotas
frontend/    páginas estáticas + common.js (menu, rodapé, tickers) + sw.js
render.yaml  definição do serviço no Render
iniciar.bat  atalho para rodar no Windows
```

Cada módulo de `backend/` exporta `registrarX(app, cacheGet, cacheSet, getJSON)` e é montado em
`backend/server.js`. Não há build: o `frontend/` é servido como está por `express.static`.

## Menu: fonte única de verdade

O menu principal vem de `BRBRICS_NAV` em [frontend/common.js](frontend/common.js) e é injectado por
`buildNav()` em todos os elementos `<nav class="nav">`. Várias páginas trazem também o menu escrito
no HTML, que serve de fallback antes do JavaScript correr — **ao mexer em `BRBRICS_NAV`, sincroniza
esses blocos fixos**, senão ficam desactualizados. O rodapé é gerado por `buildFooter()` no mesmo
ficheiro, e o ticker de manchetes/mercado também.

Ícones do menu: apenas as chaves definidas em `NAV_ICONS` em `common.js` produzem ícone; chave
desconhecida significa item sem ícone, sem erro.

## APIs

O backend expõe ~65 rotas sob `/api/*`, todas com cache em memória. As principais por família:

| Família | Rotas |
|---|---|
| Diário Oficial | `/api/dou`, `/api/edicao/destaques`, `/api/resumo` |
| Licitações | `/api/licitacoes`, `/api/licitacao/*` |
| Congresso | `/api/proposicoes`, `/api/proposicao/:id`, `/api/deputados`, `/api/deputado/:id`, `/api/legislacao/*` |
| Tribunais | `/api/tribunais`, `/api/tribunais/{buscar,detalhe,feed,noticias,recentes,tema}` |
| Economia | `/api/indicadores`, `/api/focus`, `/api/economia`, `/api/mercado/{resumo,bolsa,cripto,ptax}` |
| Territórios e ambiente | `/api/ibge/*`, `/api/clima`, `/api/clima/capitais`, `/api/mapas/{satelite,avioes,embarcacoes,cameras}` |
| Contas e energia | `/api/contas/*`, `/api/energia/*`, `/api/repasses`, `/api/repasses/ranking`, `/api/emendas`, `/api/comex/*`, `/api/fipe/*` |
| Conteúdo agregado | `/api/manchetes`, `/api/reguladores`, `/api/rss/{fontes,buscar}`, `/api/calendario` |
| Infraestrutura | `/api/health`, `/api/status`, `/api/visita`, `/api/visitas/resumo` |

SEO: `backend/seo.js` gera `robots.txt` e `sitemap.xml`; as páginas listadas em `PAGINAS` nesse
ficheiro entram no sitemap — nova página precisa de entrada lá e, se quiser offline, também na
lista `CORE` de `frontend/sw.js` (com `CACHE_NAME` incremented).

O mesmo módulo publica o feed **do próprio portal** em `/rss.xml` (alias `/feed`, `application/rss+xml`,
cache de 15 min). É o mecanismo de "aviso" do BrBRICS: não guarda nada em servidor nem pede cadastro —
quem quer ser avisado assina o endereço, e a página `rss.html` explica e dá o link para copiar.

## Convenções e cuidados

- **Encoding**: os ficheiros são UTF-8 e alguns `.html` têm BOM. Não corras scripts avulsos de
  "correção de encoding" sobre o `frontend/` — foi isso que, uma vez, corrompeu o `common.js`
  (perdeu o prefixo `var BRBRICS_NAV=`, as funções do topo e a linha de boot, e trocou acentos por
  lixo tipo `Licitae7fces`).
- **Dados pessoais**: o portal não cadastra ninguém e não envia e-mail — as rotas de newsletter e
  alerta de busca foram removidas por isso (guardavam e-mail em `dados/`, que o plano free do Render
  apaga a cada deploy). Nenhum endpoint deve guardar dado pessoal em cache nem entregá-lo ao
  navegador: é o que sustenta a promessa do `privacidade.html`.
- **Validar antes de commitar**: `node --check` em cada `.js` tocado, e confirmar em
  `http://localhost:3000` que o menu e os dados aparecem.
- Não há testes automatizados nem linter; a verificação é feita a correr o servidor.

## Páginas

34 páginas estáticas em `frontend/`. As de entrada do menu: `index`, `edicao`, `licitacoes`,
`proposicoes`, `legislacao`, `mapa-brasil`, `mapa-satelite`, `mapa-avioes`, `mapa-embarcacoes`,
`mapa-cameras`, `mapas`, `indicadores`, `tribunais`, `manchetes`, `reguladores`, `diretorios`,
`territorio`, `clima`, `contas`, `energia`, `comex`, `fipe`, `agro`, `rss`, `calendario`,
`areas`, `busca`, `sobre`, `contato`, `privacidade`, `painel`. Detalhe: `licitacao-detalhe`,
`proposicao-detalhe`, `deputado-detalhe` (rotas servidas por `server.js`).
