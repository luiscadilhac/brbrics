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

// Global error handlers to catch silent crashes
process.on('uncaughtException', function(err) {
  console.error('UNCAUGHT EXCEPTION:', err.stack || err);
});
process.on('unhandledRejection', function(reason, promise) {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason.stack || reason);
});

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

// getJSON com timeout de conexão (Promise.race) — sem travar a rota se a fonte enrolar
function getJSONFast(url, timeout){
  timeout = timeout || 5000;
  return Promise.race([
    fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'BrBRICS/1.0' } })
      .then(function(r){ return r.json(); })
      .then(function(d){ return { status: 200, data: d }; })
      .catch(function(e){ return { status: 0, error: String(e) }; }),
    new Promise(function(_, reject){
      setTimeout(function(){ reject(new Error('Timeout '+timeout+'ms')); }, timeout);
    })
  ]);
}
// Base pública do site (Render + domínio próprio). Defina SITE_URL no Render.
function siteBase(){ return (process.env.SITE_URL||'https://brbrics.onrender.com').replace(/\/+$/,''); }
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

// ---- Camara (sem dados inventados: se a API falhar, erro honesto + lista vazia) ----
app.get('/api/proposicoes', function(req, res){
  var pagina = parseInt(req.query.pagina||'1',10)||1;
  var itens = parseInt(req.query.itens||'15',10)||15;
  var q = String(req.query.q||'').toLowerCase().trim();
  var ck = 'prop_'+pagina+'_'+itens+'_'+q;
  var hit = cacheGet(ck); if(hit) return res.json(hit);
  getJSON('https://dadosabertos.camara.leg.br/api/v2/proposicoes?ordem=DESC&ordenarPor=id&itens='+Math.max(itens,50)+'&pagina='+pagina).then(function(r){
    var dados = (r.data&&r.data.dados)?r.data.dados:(Array.isArray(r.data)?r.data:[]);
    if(q){
      dados = dados.filter(function(x){
        var texto = (x.ementa||'')+' '+(x.siglaTipo||'')+' '+(x.numero||'')+' '+(x.ano||'');
        return texto.toLowerCase().indexOf(q) !== -1;
      });
    }
    var out = { fonte: 'Camara dos Deputados - Dados Abertos', dados: dados.slice(0,itens) };
    cacheSet(ck, out); res.json(out);
  }).catch(function(e){ res.status(502).json({ fonte: 'Camara dos Deputados - Dados Abertos', erro: 'Camara indisponivel', detalhe: String((e&&e.message)||e).slice(0,160), dados: [] }); });
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
      if(!has) return res.status(502).json({ fonte: 'Banco Central - SGS', erro: 'BCB indisponivel', dados: { ipca: [], selic: [], cambio: [], igpm: [] } });
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

// ---- Detail pages (canonical URLs para SEO e compartilhamento) ----
// Licitação PNCP (wildcard: numeroControlePNCP contém "/" — máscara CNPJ-1-SEQ/ANO).
// Detalhe correto (doc PNCP): GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial} (+ /itens).
app.get('/api/licitacao/*', function(req, res){
  var id = String((req.params&&req.params[0])||'').trim();
  if(!id) return res.status(400).json({erro:'Informe ID da licitação (numeroControlePNCP)'});
  var linkPortal = 'https://pncp.gov.br/app/editais?q='+encodeURIComponent(id);
  var m = id.match(/^(\d{14})-1-(\d{1,6})\/(\d{4})$/);
  if(!m) return res.status(400).json({erro:'ID fora do padrão numeroControlePNCP (CNPJ-1-SEQ/ANO)', linkPortal:linkPortal});
  var cnpj = m[1], seq = String(parseInt(m[2],10)), ano = m[3];
  var ck = 'lic_det_'+id;
  var hit = cacheGet(ck); if(hit) return res.json(hit);
  var baseDet = 'https://pncp.gov.br/api/consulta/v1/orgaos/'+cnpj+'/compras/'+ano+'/'+seq;
  getJSON(baseDet).then(function(r){
    var dados = (r.data&&r.data.dados)||r.data;
    if(!dados || (r.status!==200 && !dados.numeroControlePNCP && dados.sequencialCompra==null)) {
      return res.status(502).json({erro:'PNCP não retornou o detalhe', detalhe:String((r.data&&r.data.message)||('HTTP '+r.status)).slice(0,160), linkPortal:linkPortal});
    }
    // Itens em paralelo (não fatal se falhar)
    getJSON(baseDet+'/itens', {}, 10000).then(function(ri){
      var itens = (ri.data&&ri.data.dados)||(Array.isArray(ri.data)?ri.data:[]);
      if(itens&&itens.length) dados.itens = itens;
      var out = {fonte:'PNCP', licitacao:dados, canonical:siteBase()+'/licitacao/'+encodeURIComponent(id), linkPortal:linkPortal, atualizadoEm:new Date().toISOString()};
      cacheSet(ck, out, 3600000); res.json(out);
    }).catch(function(){
      var out = {fonte:'PNCP', licitacao:dados, canonical:siteBase()+'/licitacao/'+encodeURIComponent(id), linkPortal:linkPortal, atualizadoEm:new Date().toISOString()};
      cacheSet(ck, out, 3600000); res.json(out);
    });
  }).catch(function(e){ res.status(502).json({erro:'PNCP indisponível', detalhe:String((e&&e.message)||e).slice(0,160), linkPortal:linkPortal}); });
});

// Proposição Câmara
app.get('/api/proposicao/:id', function(req, res){
  var id = String(req.params.id||'').replace(/\D/g,'');
  if(!id) return res.status(400).json({erro:'Informe ID da proposição'});
  var ck = 'prop_det_'+id;
  var hit = cacheGet(ck); if(hit) return res.json(hit);
  var base = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/'+id;
  getJSON(base).then(function(r1){
    var prop0 = (r1.data&&r1.data.dados)||null;
    getJSON(base+'/tramitacoes').then(function(r2){
      if(!prop0) return res.status(404).json({erro:'Proposição não encontrada'});
      var out = {fonte:'Câmara dos Deputados', proposicao:prop0, tramitacao:((r2.data&&r2.data.dados)||[]).slice(-30), canonical:siteBase()+'/proposicao/'+id, atualizadoEm:new Date().toISOString()};
      cacheSet(ck, out, 3600000); res.json(out);
    }).catch(function(){
      if(!prop0) return res.status(404).json({erro:'Proposição não encontrada'});
      var out = {fonte:'Câmara dos Deputados', proposicao:prop0, tramitacao:[], canonical:siteBase()+'/proposicao/'+id, atualizadoEm:new Date().toISOString()};
      cacheSet(ck, out, 3600000); res.json(out);
    });
  }).catch(function(e){ res.status(502).json({erro:'Câmara indisponível', detalhe:String((e&&e.message)||e).slice(0,160)}); });
});

// (Removido stub de /api/deputado/:id — a rota real vive em backend/deputados.js.
 // O stub antigo reescrevia req.url sem responder e pendurava a requisição.)

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
  if(!Parser) return res.json({ fonte: 'IN/DOU (RSS)', periodo: periodo, secao1: [], secao3: [], erro: 'rss-parser não instalado' });
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
    // SEM FALLBACK FAKE - retorna vazio se RSS falhar
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
    { id: 'proposicao', nome: 'Câmara - Detalhe proposição', url: base+'/api/proposicao/2647402' },
    { id: 'deputados', nome: 'Câmara - Deputados', url: base+'/api/deputados' },
    { id: 'emendas', nome: 'Emendas parlamentares', url: base+'/api/emendas' },
    { id: 'repasses', nome: 'Repasses federais', url: base+'/api/repasses' },
    { id: 'dou_edicao', nome: 'DOU - Edição da semana', url: base+'/api/edicao/destaques' },
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
  ['/api/licitacoes','/api/proposicoes','/api/indicadores','/api/focus','/api/tribunais/noticias','/api/reguladores','/api/manchetes','/api/ibge/noticias','/api/ibge/estados','/api/fipe/marcas?tipo=carros','/api/mercado/resumo','/sitemap.xml',
   '/api/legislacao/votacoes','/api/legislacao/agenda','/api/legislacao/senado',
   '/api/dou','/api/edicao/destaques',
   '/api/emendas','/api/repasses','/api/deputados','/api/deputados/gastos/ranking'].forEach(function(p){
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
  var emendas = require('./emendas');
  var repasses = require('./repasses');
  var deputados = require('./deputados');
  seo.registrarSEO(app, cacheGet, cacheSet);
  visitas.registrarVisitas(app);
  // (legislacao registrada uma única vez acima via `leg`; sem duplicar rotas)
  emendas.registrarEmendas(app, cacheGet, cacheSet, getJSON);
  repasses.registrarRepasses(app, cacheGet, cacheSet, getJSON);
  deputados.registrarDeputados(app, cacheGet, cacheSet, getJSON, getJSONFast);
} catch(e){ console.log('Modulo tribunais indisponivel:', e.message); }

// ---- Canonical HTML pages (SEO + social cards) ----
// /licitacao/<numeroControlePNCP> (wildcard: o id do PNCP contém "/")
app.get('/licitacao/*', function(req, res){
  var id = String((req.params&&req.params[0])||'').trim();
  if(!id) return res.redirect(301, '/licitacoes.html');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'licitacao-detalhe.html'));
});

// /proposicao/:id.html
app.get('/proposicao/:id', function(req, res){
  var id = String(req.params.id||'').replace(/\D/g,'');
  if(!id) return res.redirect(301, '/proposicoes.html');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'proposicao-detalhe.html'));
});

// /deputado/:id.html
app.get('/deputado/:id', function(req, res){
  var id = String(req.params.id||'').replace(/\D/g,'');
  if(!id) return res.redirect(301, '/proposicoes.html');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'deputado-detalhe.html'));
});

// Newsletter subscription (+ alerta de busca). Arquivos em dados/ (efêmero no plano free).
var DADOS_DIR = path.join(__dirname, '..', 'dados');
var NEWSLETTER_FILE = path.join(DADOS_DIR, 'newsletter.json');
var ALERTAS_FILE = path.join(DADOS_DIR, 'alertas.json');
function lerListaJSON(f){
  var fs = require('fs');
  try{
    if(!fs.existsSync(f)) return [];
    var v = JSON.parse(fs.readFileSync(f,'utf8'));
    return Array.isArray(v)?v:[];
  }catch(e){ return []; }
}
function salvarListaJSON(f, list){
  var fs = require('fs');
  try{
    if(!fs.existsSync(DADOS_DIR)) fs.mkdirSync(DADOS_DIR, {recursive:true});
    fs.writeFileSync(f, JSON.stringify(list, null, 2));
    return true;
  }catch(e){ return false; }
}
app.post('/api/newsletter', function(req, res){
  var email = String((req.body&&req.body.email)||'').trim().toLowerCase();
  if(!email || email.indexOf('@')<0 || email.length>120) return res.status(400).json({erro:'Email inválido'});
  var list = lerListaJSON(NEWSLETTER_FILE);
  if(list.indexOf(email)<0){ list.push(email); }
  if(!salvarListaJSON(NEWSLETTER_FILE, list)) return res.status(500).json({erro:'Falha ao salvar (disco indisponível)'});
  res.json({ok:true, message:'Inscrito com sucesso', total:list.length});
});
app.get('/api/newsletter/total', function(req, res){
  res.json({total: lerListaJSON(NEWSLETTER_FILE).length});
});

// Search alerts (salva busca para alerta futuro)
app.post('/api/alertas', function(req, res){
  var termo = String((req.body&&req.body.termo)||'').trim().toLowerCase().slice(0,80);
  var email = String((req.body&&req.body.email)||'').trim().toLowerCase();
  if(!termo || !email || email.indexOf('@')<0) return res.status(400).json({erro:'Informe termo + email válido'});
  var list = lerListaJSON(ALERTAS_FILE);
  var key = email+'|'+termo;
  if(list.indexOf(key)<0){ list.push(key); }
  if(!salvarListaJSON(ALERTAS_FILE, list)) return res.status(500).json({erro:'Falha ao salvar alerta'});
  res.json({ok:true, message:'Alerta criado para "'+termo+'"'});
});

app.listen(PORT, function(){ console.log('BrBRICS em http://localhost:'+PORT); });
