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
| Órgãos | `/api/orgao` (`cnpj,ano,fundo`), `/api/orgao/nomes` (`q`) |
| Congresso | `/api/proposicoes`, `/api/proposicao/:id`, `/api/deputados`, `/api/deputado/:id`, `/api/legislacao/*` |
| Tribunais | `/api/tribunais`, `/api/tribunais/{buscar,detalhe,feed,noticias,recentes,tema}` |
| Economia | `/api/indicadores`, `/api/focus`, `/api/economia`, `/api/mercado/{resumo,bolsa,cripto,ptax}` |
| Territórios e ambiente | `/api/ibge/*`, `/api/clima`, `/api/clima/capitais`, `/api/mapas/{satelite,avioes,embarcacoes,orbita,cameras}` |
| Contas e energia | `/api/contas/*`, `/api/energia/*`, `/api/repasses`, `/api/repasses/ranking`, `/api/emendas`, `/api/comex/*`, `/api/fipe/*` |
| Conteúdo agregado | `/api/manchetes`, `/api/reguladores`, `/api/rss/{fontes,buscar}`, `/api/calendario` |
| Infraestrutura | `/api/health`, `/api/status`, `/api/visita`, `/api/visitas/resumo` |

SEO: `backend/seo.js` gera `robots.txt` e `sitemap.xml`; as páginas listadas em `PAGINAS` nesse
ficheiro entram no sitemap — nova página precisa de entrada lá e, se quiser offline, também na
lista `CORE` de `frontend/sw.js` (com `CACHE_NAME` incremented).

O mesmo módulo publica o feed **do próprio portal** em `/rss.xml` (alias `/feed`, `application/rss+xml`,
cache de 15 min). É o mecanismo de "aviso" do BrBRICS: não guarda nada em servidor nem pede cadastro —
quem quer ser avisado assina o endereço, e a página `rss.html` explica e dá o link para copiar.

A ficha de órgão ([frontend/orgao.html](frontend/orgao.html)) só usa o que a consulta pública do PNCP
permite: `GET /v1/contratos?cnpjOrgao=` devolve os contratos do órgão com fornecedor, valor e objeto,
mas **não existe busca por nome de órgão nem por CNPJ de fornecedor** — e `ufSigla`/`municipioNome`
são ignorados pelo `publicacao` (medido em 2026-10-28). Por isso o índice pesquisável
(`/api/orgao/nomes`) é montado varrendo as 12 modalidades em 2 páginas de 50 cada, uma chamada por vez
com pausa de 700ms. O tamanho do índice depende de quanto o PNCP aguenta o ritmo: na melhor medição
foram 808 órgãos (2026-10-28); num dia carregado, com 429 no meio da varredura, 669 (2026-10-29). A
primeira página sozinha rende ~360. Acima de `tamanhoPagina=50` a fonte dá 400, e chamada com prazo de
20s morre antes de responder — o prazo é 35s porque a mesma consulta já levou 25s. Quando vêm 429, a
pausa cresce sozinha e a varredura para de bater na porta em vez de queimar as modalidades restantes.
**A lista é publicada em pedaços**: depois de cada chamada o resultado parcial vai para o cache (60s)
e para a reserva, e quem chegou no começo é liberado em no máximo 20s com o que já existe, marcado
`atualizando` — a página busca de novo até 3 vezes, de 20 em 20 segundos, e a lista cresce sozinha sem
recarregar. Na medição, o primeiro visitante recebeu 46 órgãos em 9s e a lista chegou a 669 em 3min.
Se ainda não há nada, vem `{"construindo":true}` e o aviso aparece.
O PNCP também é instável: a mesma página de 10 contratos já levou 0,2s e 38s. Por isso a ficha é
coletada em páginas pequenas e *um passo por vez*: [backend/orgaos.js](backend/orgaos.js) puxa página
enquanto a fonte responde rápido (até 8s por pedido, alvo de 20 contratos) e, quando a fonte enrola,
`/api/orgao?fundo=1` responde na hora `{"aguardando":true,"coletados":N}` e o pedido seguinte continua
de onde parou — a página pergunta a cada 5s, até 90s. A ficha fica 6h no cache (30min se a coleta
veio incompleta, marcada `parcial`) e o último resultado bom serve de reserva quando a fonte falha.

## Mapas ao vivo (aviões, navios, satélites)

Três painéis que se mexem sozinhos, todos com fonte **sem chave e sem cadastro** — o portal não pede
registo a ninguém:

- `/api/mapas/avioes` lê a **adsb.lol** (`/v2/lat/{lat}/lon/{lon}/dist/{km}`), rede comunitária de
  receptores ADS-B, em quatro centros (Sudeste, Centro-Oeste, Nordeste, Norte) varridos **um de cada
  vez** com 250ms de pausa e dedupe por `icao24+callsign`. Medido em 2026-10-30: 229–240 aeronaves por
  leitura, ~1,2s por centro. A OpenSky Network ficou como reserva (em produção ela costuma estourar o
  prazo e devolvía zero aviões); abaixo disso serve a última leitura boa por 30min, marcada `stale`.
  Cache de 45s. A página `mapa-avioes.html` não usa mais aglomerado de bolinhas: cada aeronave é um
  glifo girado pelo rumo e, entre duas leituras, a posição avança por *dead reckoning* (velocidade e
  rumo que o próprio transponder reportou) a cada segundo.
- `/api/mapas/embarcacoes` lê o **Open Waters AIS** (`/v1/vessels?bbox=minLat,minLon,maxLat,maxLon`),
  GeoJSON aberto. A caixa grande (Brasil inteiro) dá **400**, por isso são 8 bboxes de porto/hidrovia
  varridos em sequência com 150ms de pausa. Medido: 1.230 embarcações, ~150 efetivamente navegando.
  Cache de 120s; a lista de portos deixou de ser o conteúdo e passou a camada fixa de referência
  (`portos` no payload). Na página, quem está acima de 0,9 km/h avança no mapa pelo rumo reportado.
- `/api/mapas/orbita` baixa TLEs do **CelesTrak** (`gp.php?GROUP=…&FORMAT=tle`) para 9 grupos
  (estações orbitais, BeiDou/GPS/GLONASS/Galileo, Starlink/OneWeb, meteorológicos, observação da
  Terra). O CelesTrak responde **403 "GP data has not updated since your last request"** se o mesmo
  grupo for lido duas vezes antes de actualizar — daí o cache de 6h (2h quando um grupo falha) e a
  reserva de até 4 dias. O texto do TLE chega como string (`getJSON` não parseia), tratado por
  `parseTLE`. Medido: 499–639 objetos por leitura, 56s na primeira varredura. **A conta é feita no
  navegador** com o SGP4 do [satellite.js](https://www.npmjs.com/package/satellite.js) 7.1.0
  (`cdn.jsdelivr.net/npm/satellite.js@7.1.0/+esm`, importado como módulo ES); o backend só entrega
  elementos orbitais. O país é *estimado* do nome e da constelação (REGRA_BLOCO), porque o TLE militar
  não traz bandeira.

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

36 páginas estáticas em `frontend/`. As de entrada do menu: `index`, `edicao`, `licitacoes`, `orgao`,
`proposicoes`, `legislacao`, `mapa-brasil`, `mapa-satelite`, `mapa-avioes`, `mapa-embarcacoes`,
`mapa-orbita`, `mapa-cameras`, `mapas`, `indicadores`, `tribunais`, `manchetes`, `reguladores`,
`diretorios`,
`territorio`, `clima`, `contas`, `energia`, `comex`, `fipe`, `agro`, `rss`, `calendario`,
`areas`, `busca`, `sobre`, `contato`, `privacidade`, `painel`. Detalhe: `licitacao-detalhe`,
`proposicao-detalhe`, `deputado-detalhe` (rotas servidas por `server.js`).
