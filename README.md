# BrBRICS (Projeto BRICS) — portal de transparência

Clone educacional com **dados públicos reais** via backend próprio.

## Rodar
```powershell
cd "$env:USERPROFILE\Desktop\projeto brics"
npm install
npm start
# abrir http://localhost:3000
```

## Páginas
| Página | Conteúdo |
|---|---|
| `index.html` | Hero, ticker de mercado, manchetes DOU, KPIs BCB, licitações PNCP, Congresso |
| `edicao.html` | Edição semanal + link da busca do dia no DOU |
| `licitacoes.html` | Tabela PNCP (pregão eletrônico, últimos 7 dias) |
| `proposicoes.html` | Proposições recentes da Câmara |
| `indicadores.html` | Gráficos IPCA/Selic + tabela SGS (Chart.js) |
| `sobre.html` | Como produzimos, fontes, termos |

## APIs reais (backend `/api/*`)
- PNCP: `pncp.gov.br/api/consulta/v1/contratacoes/publicacao` ✔ validado (7.938 pregões/7 dias)
- Câmara: `dadosabertos.camara.leg.br/api/v2/proposicoes` ✔ validado
- Senado: `legis.senado.leg.br/dadosabertos/materia/tramitando` ✔
- BCB SGS 433/432/3698/189 ✔ validado (IPCA set/26: 0,82%)
- DOU/IN: link direto da busca do dia ✔

## Modelo usado
**free/muse-spark-1.3** (APInex)
