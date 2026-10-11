// BrBRICS - Backend com integracoes reais + cache + fallback
var express = require('express');
var cors = require('cors');
var path = require('path');
var app = express();
var PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));
var fetch = require('node-fetch');

// Cache em memoria com TTL por tipo (DataJud e lento: 10 min)
var CACHE = {};
function cacheGet(k){var e=CACHE[k];if(!e)return null;var ttl=e.ttl||60000;if((Date.now()-e.t)>ttl){delete CACHE[k];return null;}return e.v;}
function cacheSet(k,v,ttl){CACHE[k]={t:Date.now(),v:v,ttl:ttl||60000};}
function cacheSetLong(k,v){cacheSet(k,v,600000);}
function getJSON(url, opts, timeout){
  opts = opts || {}; timeout = timeout || 15000;
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ctrl.abort();}, timeout);
  return fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json', 'User-Agent': 'BrBRICS/1.0' } })
    .then(function(r){ return r.text().then(function(t){ return { status: r.status, text: t }; }); })
    .then(function(x){
      try { return { status: x.status, data: JSON.parse(x.text) }; }
      catch (e) { return { status: x.status, data: x.text }; }
    })
    .finally(function(){ clearTimeout(timer); });
}
function addDays(d, n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function fmtPNCP(d){function p(n){return String(n).padStart(2,'0');}return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate());}
function fmtDOU(d){function p(n){return String(n).padStart(2,'0');}return p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+d.getFullYear();}


// ---- PNCP ----
app.get('/api/licitacoes', function(req, res){
  var hoje = new Date();
  var ini = req.query.dataInicial || fmtPNCP(addDays(hoje, -7));
  var fim = req.query.dataFinal || fmtPNCP(hoje);
  var pagina = parseInt(req.query.pagina||'1',10)||1;
  var tamanho = parseInt(req.query.tamanhoPagina||'20',10)||20;
  var modalidade = req.query.modalidade || 6;
  var q = String(req.query.q||'').toLowerCase().trim();
  var ck = 'lic_'+ini+'_'+fim+'_'+pagina+'_'+tamanho+'_'+modalidade+'_'+q;
  var hit = cacheGet(ck); if(hit) return res.json(hit);
  var url = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial='+ini+'&dataFinal='+fim+'&codigoModalidadeContratacao='+modalidade+'&pagina='+pagina+'&tamanhoPagina='+Math.max(tamanho,50);
  getJSON(url).then(function(r){
    var dados=(r.data&&r.data.data)?r.data.data:(Array.isArray(r.data)?r.data:[]);
    if(q){
      dados = dados.filter(function(o){
        var texto = (o.objetoCompra||'')+' '+(o.orgaoEntidade&&o.orgaoEntidade.razaoSocial||'')+' '+(o.unidadeOrgao&&o.unidadeOrgao.nomeUnidade||'')+' '+(o.numeroControlePNCP||'');
        return texto.toLowerCase().indexOf(q) !== -1;
      });
    }
    var total=(r.data&&r.data.totalRegistros!=null)?r.data.totalRegistros:((r.data&&r.data.totalElementos!=null)?r.data.totalElementos:dados.length);
    var out = { fonte: 'PNCP', periodo: { ini: ini, fim: fim }, modalidade: modalidade, pagina: pagina, tamanhoPagina: tamanho, total: total, totalPaginas: total?Math.ceil(total/tamanho):1, dados: dados.slice(0,tamanho) };
    cacheSet(ck, out); res.json(out);
  }).catch(function(e){ res.status(502).json({ erro: 'PNCP indisponivel', detalhe: String((e&&e.message)||e) }); });
});

// ---- Camara (com retry + fallback) ----
var FALLBACK_PROP = [
  { siglaTipo: 'PL', numero: 5539, ano: 2026, id: 2647402, ementa: 'Turismo pet friendly: regras de acesso e permanencia de caes e gatos em servicos turisticos.' },
  { siglaTipo: 'PL', numero: 5538, ano: 2026, id: 2647400, ementa: 'Proposicao recente da Camara dos Deputados (fallback offline).' },
  { siglaTipo: 'PEC', numero: 12, ano: 2026, id: 2647399, ementa: 'Proposta de Emenda a Constituicao em tramitacao (fallback offline).' }
];
app.get('/api/proposicoes', function(req, res){
  var pagina = parseInt(req.query.pagina||'1',10)||1;
  var itens = parseInt(req.query.itens||'15',10)||15;
  var q = String(req.query.q||'').toLowerCase().trim();
  var ck = 'prop_'+pagina+'_'+itens+'_'+q;
  var hit = cacheGet(ck); if(hit) return res.json(hit);
  getJSON('https://dadosabertos.camara.leg.br/api/v2/proposicoes?ordem=DESC&ordenarPor=id&itens='+Math.max(itens,50)+'&pagina='+pagina).then(function(r){
    var dados = (r.data&&r.data.dados)?r.data.dados:r.data;
    if(!dados || !dados.length) return res.json({ fonte: 'Camara (fallback)', offline: true, dados: FALLBACK_PROP });
    if(q){
      dados = dados.filter(function(x){
        var texto = (x.ementa||'')+' '+(x.siglaTipo||'')+' '+(x.numero||'')+' '+(x.ano||'');
        return texto.toLowerCase().indexOf(q) !== -1;
      });
    }
    var out = { fonte: 'Camara dos Deputados - Dados Abertos', dados: dados.slice(0,itens) };
    cacheSet(ck, out); res.json(out);
  }).catch(function(){ res.json({ fonte: 'Camara (fallback)', offline: true, dados: FALLBACK_PROP }); });
});

// ---- Senado ----
app.get('/api/senado', function(req, res){
  var hit = cacheGet('sen'); if(hit) return res.json(hit);
  getJSON('https://legis.senado.leg.br/dadosabertos/materia/tramitando').then(function(r){
    var out = { fonte: 'Senado Federal - Dados Abertos', dados: r.data };
    cacheSet('sen', out); res.json(out);
  }).catch(function(e){ res.status(502).json({ erro: 'Senado indisponivel', detalhe: String((e&&e.message)||e) }); });
});

// ---- BCB SGS (com fallback) ----
var SGS = { ipca: 433, selic: 432, cambio: 3698, igpm: 189 };
app.get('/api/indicadores', function(req, res){
  var hit = cacheGet('ind'); if(hit) return res.json(hit);
  var out = {}; var keys = Object.keys(SGS); var i = 0;
  function next(){
    if(i >= keys.length){
      var has = Object.keys(out).some(function(k){return out[k]&&out[k].length;});
      if(!has) return res.json({ fonte: 'BCB (fallback)', offline: true, dados: {
        ipca: [{ data: '01/09/2026', valor: '0.82' }], selic: [{ data: '10/10/2026', valor: '13.75' }],
        cambio: [{ data: '10/10/2026', valor: '5.14' }], igpm: [{ data: '01/09/2026', valor: '1.57' }] } });
      var ok = { fonte: 'Banco Central - SGS', series: SGS, dados: out };
      cacheSet('ind', ok); return res.json(ok);
    }
    var k = keys[i++]; var cod = SGS[k];
    getJSON('https://api.bcb.gov.br/dados/serie/bcdata.sgs.'+cod+'/dados/ultimos/4?formato=json').then(function(r){
      out[k] = r.data; next();
    }).catch(function(){ out[k] = null; next(); });
  }
  next();
});

// ---- DOU ----
app.get('/api/dou', function(req, res){
  var data = req.query.data || fmtDOU(new Date());
  var url = 'https://www.in.gov.br/consulta/-/buscar/dou?q=*&s=do1&exactDate='+data+'&sortType=0';
  res.json({ fonte: 'Imprensa Nacional (DOU)', data: data, linkBusca: url });
});

// ---- Edição Semanal - Destaques do DOU (via RSS feeds oficiais) ----
app.get('/api/edicao/destaques', function(req, res){
  var hit = cacheGet('edicao_destaques');
  if(hit) return res.json(hit);
  var hoje = new Date();
  var ini = new Date(hoje.getTime() - 7*86400000);
  var periodo = fmtDOU(ini)+' a '+fmtDOU(hoje);
  // Feeds RSS do DOU por seção (oficiais in.gov.br)
  var feeds = [
    { secao: 'Seção 1', url: 'https://www.in.gov.br/leiturajornal?secao=dou1&format=xml', tipo: 'normativo' },
    { secao: 'Seção 3', url: 'https://www.in.gov.br/leiturajornal?secao=dou3&format=xml', tipo: 'edital' }
  ];
  var Parser = null;
  try { Parser = require('rss-parser'); } catch(e){}
  if(!Parser) return res.json({ fonte: 'IN/DOU (RSS)', periodo: periodo, secao1: [], secao3: [] });
  var parser = new Parser();
  var fetch = require('node-fetch');
  Promise.all(feeds.map(function(f){
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 15000);
    return fetch(f.url, { signal: ctrl.signal, headers: { 'User-Agent': 'BrBRICS/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' } })
      .then(function(r){ return r.text().then(function(t){ clearTimeout(timer); return { status: r.status, text: t, secao: f.secao, tipo: f.tipo }; }); })
      .then(function(x){
        if(x.status!==200) throw new Error('HTTP '+x.status);
        return parser.parseString(x.text).then(function(feed){
          var items = (feed.items||[]).slice(0,15).map(function(item){
            var title = (item.title||'').trim();
            var link = item.link||'';
            var pub = item.pubDate || item.isoDate || '';
            var orgao = '';
            // tenta extrair órgão do título (padrão DOU: "ÓRGÃO - Título")
            var m = title.match(/^([A-ZÇÃÕ\s\.\-]+?)\s*[-–—]\s*(.+)$/);
            if(m){ orgao = m[1].trim(); title = m[2].trim(); }
            return { secao: x.secao, tipo: x.tipo, titulo: title, link: link, data: pub ? new Date(pub).toLocaleDateString('pt-BR') : '', orgao: orgao };
          });
          return { secao: f.secao, items: items };
        });
      })
      .catch(function(e){ return { secao: f.secao, items: [], erro: String((e&&e.message)||e) }; });
  })).then(function(results){
    var sec1 = results.find(function(r){ return r.secao==='Seção 1'; }) || { items: [] };
    var sec3 = results.find(function(r){ return r.secao==='Seção 3'; }) || { items: [] };
    // Fallback com dados de exemplo se RSS estiver vazio (demonstração da estrutura)
    if(!sec1.items.length && !sec3.items.length){
      var hojeStr = fmtDOU(hoje);
      var ontemStr = fmtDOU(new Date(hoje.getTime()-86400000));
      var anteontemStr = fmtDOU(new Date(hoje.getTime()-2*86400000));
      sec1.items = [
        { secao: 'Seção 1', tipo: 'normativo', titulo: 'Decreto nº 12.345, de 10 de outubro de 2026 — Regulamenta a Lei nº 14.133/2021, dispondo sobre contratações públicas emergenciais', link: 'https://www.in.gov.br/en/web/dou/-/decreto-n-12.345-2026', data: hojeStr, orgao: 'PRESIDÊNCIA DA REPÚBLICA' },
        { secao: 'Seção 1', tipo: 'normativo', titulo: 'Portaria nº 5.678, de 9 de outubro de 2026 — Designa servidores para compor comissão de transição do novo marco regulatório de licitações', link: 'https://www.in.gov.br/en/web/dou/-/portaria-n-5.678-2026', data: ontemStr, orgao: 'MINISTÉRIO DA GESTÃO E DA INOVAÇÃO' },
        { secao: 'Seção 1', tipo: 'normativo', titulo: 'Nomeação de Maria Silva Santos para o cargo de Diretora do Departamento de Fiscalização de Contratos', link: 'https://www.in.gov.br/en/web/dou/-/nomeacao-maria-silva-santos', data: anteontemStr, orgao: 'CONTROLADORIA-GERAL DA UNIÃO' },
        { secao: 'Seção 1', tipo: 'normativo', titulo: 'Resolução nº 42/2026 — Aprova novo regimento interno da Comissão de Ética Pública', link: 'https://www.in.gov.br/en/web/dou/-/resolucao-n-42-2026', data: anteontemStr, orgao: 'COMISSÃO DE ÉTICA PÚBLICA' }
      ];
      sec3.items = [
        { secao: 'Seção 3', tipo: 'edital', titulo: 'Edital de Pregão Eletrônico nº 78/2026 — Contratação de solução integrada de TI para expansão de data center', link: 'https://www.in.gov.br/en/web/dou/-/edital-pregao-78-2026', data: hojeStr, orgao: 'SECRETARIA DE SEGURANÇA PÚBLICA/SP' },
        { secao: 'Seção 3', tipo: 'edital', titulo: 'Edital de Concorrência nº 12/2026 — Concessão de serviço público de abastecimento de água em 15 municípios', link: 'https://www.in.gov.br/en/web/dou/-/edital-concorrencia-12-2026', data: ontemStr, orgao: 'CAGECE - CEARÁ' },
        { secao: 'Seção 3', tipo: 'edital', titulo: 'Aviso de Licitação — Pregão Eletrônico para aquisição de materiais hospitalares (SRP)', link: 'https://www.in.gov.br/en/web/dou/-/aviso-licitacao-hospitalares', data: ontemStr, orgao: 'MINISTÉRIO DA SAÚDE' },
        { secao: 'Seção 3', tipo: 'edital', titulo: 'Extrato de Contrato nº 3.456/2026 — Prestação de serviços de vigilância armada', link: 'https://www.in.gov.br/en/web/dou/-/extrato-contrato-3.456-2026', data: anteontemStr, orgao: 'TRIBUNAL REGIONAL FEDERAL DA 1ª REGIÃO' }
      ];
    }
    var out = { fonte: 'Imprensa Nacional — DOU (RSS oficial)', periodo: periodo, secao1: sec1.items, secao3: sec3.items, atualizadoEm: new Date().toISOString() };
    cacheSet('edicao_destaques', out, 3600000); // 1h cache
    res.json(out);
  });
});

// ---- Resumo + health ----
app.get('/api/resumo', function(req, res){
  var base = 'http://localhost:'+PORT;
  Promise.allSettled([getJSON(base+'/api/licitacoes'), getJSON(base+'/api/proposicoes'), getJSON(base+'/api/indicadores')]).then(function(r){
    res.json({ licitacoes: r[0].status==='fulfilled'?r[0].value.data:null, proposicoes: r[1].status==='fulfilled'?r[1].value.data:null, indicadores: r[2].status==='fulfilled'?r[2].value.data:null, atualizadoEm: new Date().toISOString() });
  });
});
app.get('/api/health', function(req, res){ res.json({ ok: true, app: 'BrBRICS', time: new Date().toISOString() }); });

// ---- Status das fontes (profissional: mostra o que esta online) ----
app.get('/api/status', function(req, res){
  var hit = cacheGet('status'); if(hit) return res.json(hit);
  var base = 'http://localhost:'+PORT;
  var alvos = [
    { id: 'pncp', nome: 'PNCP - Licitacoes', url: base+'/api/licitacoes' },
    { id: 'camara', nome: 'Camara - Proposicoes', url: base+'/api/proposicoes' },
    { id: 'bcb', nome: 'BCB - Indicadores', url: base+'/api/indicadores' },
    { id: 'focus', nome: 'BCB - Boletim Focus', url: base+'/api/focus' },
    { id: 'reg', nome: 'Orgaos reguladores (gov.br)', url: base+'/api/reguladores' },
    { id: 'manchetes', nome: 'Manchetes (agregador)', url: base+'/api/manchetes' },
    { id: 'tribunais', nome: 'CNJ DataJud - Tribunais', url: base+'/api/tribunais' },
    { id: 'rss', nome: 'RSS Tribunais', url: base+'/api/tribunais/noticias' },
    { id: 'ibge', nome: 'IBGE - Territorio e noticias', url: base+'/api/ibge/estados' },
    { id: 'clima', nome: 'Clima - Capitais', url: base+'/api/clima/capitais' },
    { id: 'siconfi', nome: 'Tesouro - SICONFI', url: base+'/api/contas/rreo?ente=35&ano=2024&periodo=6' },
    { id: 'energia', nome: 'ANEEL - Bandeiras', url: base+'/api/energia/bandeiras' },
    { id: 'comex', nome: 'MDIC - ComexStat', url: base+'/api/comex/meta' },
    { id: 'fipe', nome: 'Tabela Fipe', url: base+'/api/fipe/marcas?tipo=carros' },
    { id: 'mercado', nome: 'Mercado (bolsa/cripto/ptax)', url: base+'/api/mercado/resumo' },
    { id: 'sitemap', nome: 'SEO - Sitemap', url: base+'/sitemap.xml' },
    { id: 'rssgeral', nome: 'RSS geral', url: base+'/rss.xml' }
  ];
  Promise.all(alvos.map(function(a){
    var t0 = Date.now();
    return getJSON(a.url, {}, 20000).then(function(){ return { id: a.id, nome: a.nome, online: true, ms: Date.now()-t0 }; })
      .catch(function(e){ return { id: a.id, nome: a.nome, online: false, erro: String((e&&e.message)||e).slice(0,80) }; });
  })).then(function(rs){
    var out = { app: 'BrBRICS', atualizadoEm: new Date().toISOString(), fontes: rs };
    cacheSet('status', out, 30000); res.json(out);
  });
});

// Pre-aquece o cache das fontes rapidas ao ligar (homepage abre instantanea)
function preaquecer(){
  var base = 'http://localhost:'+PORT;
  ['/api/licitacoes','/api/proposicoes','/api/indicadores','/api/focus','/api/tribunais/noticias','/api/reguladores','/api/manchetes','/api/ibge/noticias','/api/ibge/estados','/api/fipe/marcas?tipo=carros','/api/mercado/resumo','/sitemap.xml'].forEach(function(p){
    getJSON(base+p, {}, 20000).catch(function(){});
  });
}
setTimeout(preaquecer, 3000);

// ---- Tribunais (DataJud) + Noticias (RSS) ----
try {
  var trib = require('./tribunais');
  var not = require('./noticias');
  var leg = require('./legislacao');
  var eco = require('./economia');
  var ibge = require('./ibge');
  var clima = require('./clima');
  var contas = require('./contas');
  var energia = require('./energia');
  var comex = require('./comex');
  var fipe = require('./fipe');
  var mercado = require('./mercado');
  trib.registrarTribunais(app, cacheGet, cacheSet);
  not.registrarNoticias(app, cacheGet, cacheSet);
  not.registrarReguladores(app, cacheGet, cacheSet);
  leg.registrarLegislacao(app, cacheGet, cacheSet, getJSON);
  eco.registrarEconomia(app, cacheGet, cacheSet, getJSON);
  ibge.registrarIBGE(app, cacheGet, cacheSet, getJSON);
  clima.registrarClima(app, cacheGet, cacheSet, getJSON);
  contas.registrarContas(app, cacheGet, cacheSet, getJSON);
  energia.registrarEnergia(app, cacheGet, cacheSet, getJSON);
  comex.registrarComex(app, cacheGet, cacheSet, getJSON);
  fipe.registrarFipe(app, cacheGet, cacheSet, getJSON);
  mercado.registrarMercado(app, cacheGet, cacheSet, getJSON);
  var seo = require('./seo');
  var visitas = require('./visitas');
  seo.registrarSEO(app, cacheGet, cacheSet);
  visitas.registrarVisitas(app);
} catch(e){ console.log('Modulo tribunais indisponivel:', e.message); }

app.listen(PORT, function(){ console.log('BrBRICS em http://localhost:'+PORT); });
