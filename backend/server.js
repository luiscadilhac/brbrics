// BrBRICS - Backend com integracoes reais + cache + fallback
var express = require('express');
var cors = require('cors');
var path = require('path');
var app = express();
var PORT = process.env.PORT || 3000;
var seoCabecalhos = require('./seo');
app.use(cors());
app.use(express.json());
seoCabecalhos.aplicarCabecalhos(app);
app.use(express.static(path.join(__dirname, '..', 'frontend')));
var fetch = require('node-fetch');
var dou = require('./dou.js');

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
function siteBase(){ return (process.env.SITE_URL||'https://brbrics.com.br').replace(/\/+$/,''); }
function addDays(d, n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function fmtPNCP(d){function p(n){return String(n).padStart(2,'0');}return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate());}
function fmtDOU(d){function p(n){return String(n).padStart(2,'0');}return p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+d.getFullYear();}


// ---- PNCP ----
// A consulta do PNCP devolve lista VAZIA quando tamanhoPagina passa de 50, entao
// pedidos maiores sao montados varrendo varias paginas de 50 itens na fonte.
var PNCP_UP = 50;
var PNCP_LIMITE_UP = 12;
app.get('/api/licitacoes', function(req, res){
  var hoje = new Date();
  var ini = req.query.dataInicial || fmtPNCP(addDays(hoje, -7));
  var fim = req.query.dataFinal || fmtPNCP(hoje);
  var pagina = parseInt(req.query.pagina||'1',10)||1;
  var tamanho = parseInt(req.query.tamanhoPagina||'20',10)||20;
  tamanho = Math.min(Math.max(tamanho,1),200);
  var modalidade = req.query.modalidade || 6;
  var q = String(req.query.q||'').toLowerCase().trim();
  var ck = 'lic_'+ini+'_'+fim+'_'+pagina+'_'+tamanho+'_'+modalidade+'_'+q;
  var hit = cacheGet(ck); if(hit) return res.json(hit);
  var base = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial='+ini+'&dataFinal='+fim+'&codigoModalidadeContratacao='+modalidade+'&tamanhoPagina='+PNCP_UP+'&pagina=';
  function pegaUp(n){
    return getJSON(base+n).then(function(r){
      // JSON de erro/429 vem como texto: nao pode virar "nenhuma licitacao".
      if(r.status !== 200 || !r.data || typeof r.data !== 'object'){
        var e = new Error('PNCP respondeu HTTP ' + r.status); e.falha = true; throw e;
      }
      var dados=(r.data.data)?r.data.data:(Array.isArray(r.data)?r.data:[]);
      var tot=(r.data.totalRegistros!=null)?r.data.totalRegistros:((r.data.totalElementos!=null)?r.data.totalElementos:dados.length);
      return { dados: dados, total: tot };
    });
  }
  var filtrar = function(o){
    var texto = (o.objetoCompra||'')+' '+(o.orgaoEntidade&&o.orgaoEntidade.razaoSocial||'')+' '+(o.unidadeOrgao&&o.unidadeOrgao.nomeUnidade||'')+' '+(o.numeroControlePNCP||'');
    return texto.toLowerCase().indexOf(q) !== -1;
  };
  // Sao preciso os (pagina*tamanho) primeiros itens; com busca, ate juntar essa
  // quantidade de coincidencias, porque o PNCP nao filtra por palavra-chave.
  var alvo = pagina*tamanho;
  var acumulado = [], total = null, varridas = 0, amostraLimitada = false;
  function caminha(n){
    if(n > PNCP_LIMITE_UP){ amostraLimitada = true; return Promise.resolve(); }
    return pegaUp(n).then(function(r){
      if(total === null) total = r.total;
      varridas++;
      acumulado = acumulado.concat(r.dados);
      var util = q ? acumulado.filter(filtrar) : acumulado;
      if(util.length >= alvo || r.dados.length < PNCP_UP) return Promise.resolve();
      return caminha(n+1);
    }).catch(function(e){
      if(n === 1) throw e;          // sem a primeira pagina nao ha nada a dizer
      return Promise.resolve();     // pagina extra falhou: fica com a amostra atual
    });
  }
  caminha(1).then(function(){
    var lista = q ? acumulado.filter(filtrar) : acumulado;
    var t = (total !== null) ? total : lista.length;
    var out = { fonte: 'PNCP', periodo: { ini: ini, fim: fim }, modalidade: modalidade, pagina: pagina, tamanhoPagina: tamanho, total: t, totalPaginas: t?Math.ceil(t/tamanho):1, dados: lista.slice((pagina-1)*tamanho, pagina*tamanho) };
    if(q){
      // Com busca, o que se pode prometer de paginaao e o numero de coincidencias encontradas.
      out.busca = q; out.paginasVarridas = varridas; out.coincidencias = lista.length;
      out.totalPaginas = Math.max(1, Math.ceil(lista.length/tamanho));
      if(amostraLimitada) out.amostraLimitada = true;
    }
    // Resultado vazio e guardado pouco: costuma ser instabilidade da fonte, nao ausencia de licitacoes.
    if(out.dados.length || out.total) cacheSet(ck, out); else cacheSet(ck, out, 20000);
    res.json(out);
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
  var secaoQ = String(req.query.secao || 'do1').toLowerCase();
  var secao = ['do1','do2','do3'].indexOf(secaoQ) >= 0 ? secaoQ : 'do1';
  var rotulo = 'Seção ' + secao.slice(2);
  var diaExato = /^\d{2}-\d{2}-\d{4}$/.test(String(req.query.data || '')) ? String(req.query.data) : null;
  var data = diaExato || dou.fmtData(new Date());
  var ck = 'dou_' + secao + '_' + data;
  var hit = cacheGet(ck); if(hit) return res.json(hit);
  var promessa = diaExato ? dou.baixarSecao(secao, diaExato) : dou.ultimosDias(secao, 7);
  promessa.then(function(r){
    var pesos = secao === 'do3' ? dou.EDITAIS : dou.NORMATIVOS;
    var atos = dou.destaques(r.atos, rotulo, 'dou', pesos, 20);
    var out = {
      fonte: 'Imprensa Nacional (DOU)', data: r.data, dataBR: String(r.data || '').split('-').join('/'), secao: secao, rotulo: rotulo,
      total: (r.atos || []).length, atos: atos,
      linkBusca: 'https://www.in.gov.br/consulta/-/buscar/dou?q=*&s=' + secao + '&exactDate=' + r.data + '&sortType=0',
      linkEdicao: 'https://www.in.gov.br/leiturajornal?data=' + r.data + '&secao=' + secao,
      aviso: atos.length ? null : ('Nenhum ato publicado na ' + rotulo + ' em ' + r.data + '. Fins de semana e feriados não têm edição.' + (r.erro ? ' (' + String(r.erro).slice(0,80) + ')' : '')),
      atualizadoEm: new Date().toISOString()
    };
    cacheSet(ck, out, atos.length ? 3600000 : 120000);
    res.json(out);
  }).catch(function(e){
    res.status(502).json({ fonte:'Imprensa Nacional (DOU)', data:data, secao:secao, total:0, atos:[],
      erro:'DOU indisponível', aviso:'A Imprensa Nacional não respondeu agora. Tente novamente em alguns minutos.',
      detalhe:String((e && e.message) || e).slice(0,160),
      linkBusca:'https://www.in.gov.br/consulta/-/buscar/dou?q=*&s=' + secao + '&exactDate=' + data + '&sortType=0' });
  });
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

// ---- Edição Semanal - Destaques do DOU (fonte oficial: página de leitura da Imprensa Nacional) ----
app.get('/api/edicao/destaques', function(req, res){
  var hit = cacheGet('edicao_destaques');
  if(hit) return res.json(hit);
  Promise.all([dou.ultimosDias('do1', 7), dou.ultimosDias('do3', 7)]).then(function(rs){
    var d1 = rs[0], d3 = rs[1];
    var sec1 = dou.destaques(d1.atos, 'Seção 1', 'normativo', dou.NORMATIVOS, 10);
    var sec3 = dou.destaques(d3.atos, 'Seção 3', 'edital', dou.EDITAIS, 10);
    var dias = [];
    if(d1.data) dias.push(d1.data);
    if(d3.data && d3.data !== d1.data) dias.push(d3.data);
    var out = {
      fonte: 'Imprensa Nacional — DOU (edições oficiais)',
      periodo: dias.length ? dias.map(function(d){ return d.split('-').join('/'); }).join(' e ') : 'últimos 7 dias',
      secao1: sec1, secao3: sec3,
      totalSecao1: (d1.atos || []).length, totalSecao3: (d3.atos || []).length,
      linkEdicao: 'https://www.in.gov.br/leiturajornal?data=' + (d1.data || dou.fmtData(new Date())) + '&secao=do1',
      aviso: (sec1.length || sec3.length) ? null
        : 'A Imprensa Nacional não publicou (ou não respondeu) nas últimas 7 dias. Consulte diretamente em in.gov.br.',
      atualizadoEm: new Date().toISOString()
    };
    cacheSet('edicao_destaques', out, (sec1.length || sec3.length) ? 3600000 : 120000);
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
  // O indice de orgaos varre as 12 modalidades do PNCP (~1 minuto de chamadas em sequencia).
  // So comeca depois de o poeira baixar, para nao disputar a janela de 429 com a homepage.
  setTimeout(function(){ getJSON(base+'/api/orgao/nomes', {}, 120000).catch(function(){}); }, 90000);
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
  var mapas = require('./mapas');
  mapas.registrarMapas(app, cacheGet, cacheSet, getJSON);
  var extras = require('./extras');
  extras.registrarExtras(app, cacheGet, cacheSet, getJSON);
  seo.registrarSEO(app, cacheGet, cacheSet);
  visitas.registrarVisitas(app);
  // (legislacao registrada uma única vez acima via `leg`; sem duplicar rotas)
  emendas.registrarEmendas(app, cacheGet, cacheSet, getJSON);
  repasses.registrarRepasses(app, cacheGet, cacheSet, getJSON);
  deputados.registrarDeputados(app, cacheGet, cacheSet, getJSON, getJSONFast);
  var orgaos = require('./orgaos');
  orgaos.registrarOrgaos(app, cacheGet, cacheSet, getJSON);
  var contratos = require('./contratos');
  contratos.registrarContratos(app, cacheGet, cacheSet, getJSON);
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

app.listen(PORT, function(){ console.log('BrBRICS em http://localhost:'+PORT); });
