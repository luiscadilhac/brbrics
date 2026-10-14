// BrBRICS - modulo Tribunais: DataJud (todos os tribunais) + RSS (noticias)
var DATAJUD_KEY = 'APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
var DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
var TRIBUNAIS = [
  { alias: 'api_publica_stf', sigla: 'STF', nome: 'Supremo Tribunal Federal', ramo: 'Superiores' },
  { alias: 'api_publica_stj', sigla: 'STJ', nome: 'Superior Tribunal de Justica', ramo: 'Superiores' },
  { alias: 'api_publica_tst', sigla: 'TST', nome: 'Tribunal Superior do Trabalho', ramo: 'Superiores' },
  { alias: 'api_publica_tse', sigla: 'TSE', nome: 'Tribunal Superior Eleitoral', ramo: 'Superiores' },
  { alias: 'api_publica_stm', sigla: 'STM', nome: 'Superior Tribunal Militar', ramo: 'Superiores' },
  { alias: 'api_publica_trf1', sigla: 'TRF1', nome: 'TRF 1a Regiao (AC,AP,AM,BA,DF,GO,MA,MT,PA,PI,RO,RR,TO)', ramo: 'Federal' },
  { alias: 'api_publica_trf2', sigla: 'TRF2', nome: 'TRF 2a Regiao (RJ,ES)', ramo: 'Federal' },
  { alias: 'api_publica_trf3', sigla: 'TRF3', nome: 'TRF 3a Regiao (SP,MS)', ramo: 'Federal' },
  { alias: 'api_publica_trf4', sigla: 'TRF4', nome: 'TRF 4a Regiao (RS,SC,PR)', ramo: 'Federal' },
  { alias: 'api_publica_trf5', sigla: 'TRF5', nome: 'TRF 5a Regiao (AL,CE,PB,PE,RN,SE)', ramo: 'Federal' },
  { alias: 'api_publica_trf6', sigla: 'TRF6', nome: 'TRF 6a Regiao (MG)', ramo: 'Federal' },
  { alias: 'api_publica_tjac', sigla: 'TJAC', nome: 'TJ do Acre', ramo: 'Estadual' },
  { alias: 'api_publica_tjal', sigla: 'TJAL', nome: 'TJ de Alagoas', ramo: 'Estadual' },
  { alias: 'api_publica_tjam', sigla: 'TJAM', nome: 'TJ do Amazonas', ramo: 'Estadual' },
  { alias: 'api_publica_tjap', sigla: 'TJAP', nome: 'TJ do Amapa', ramo: 'Estadual' },
  { alias: 'api_publica_tjba', sigla: 'TJBA', nome: 'TJ da Bahia', ramo: 'Estadual' },
  { alias: 'api_publica_tjce', sigla: 'TJCE', nome: 'TJ do Ceara', ramo: 'Estadual' },
  { alias: 'api_publica_tjdft', sigla: 'TJDFT', nome: 'TJ do DF e Territorios', ramo: 'Estadual' },
  { alias: 'api_publica_tjes', sigla: 'TJES', nome: 'TJ do Espirito Santo', ramo: 'Estadual' },
  { alias: 'api_publica_tjgo', sigla: 'TJGO', nome: 'TJ de Goias', ramo: 'Estadual' },
  { alias: 'api_publica_tjma', sigla: 'TJMA', nome: 'TJ do Maranhao', ramo: 'Estadual' },
  { alias: 'api_publica_tjmg', sigla: 'TJMG', nome: 'TJ de Minas Gerais', ramo: 'Estadual' },
  { alias: 'api_publica_tjms', sigla: 'TJMS', nome: 'TJ de Mato Grosso do Sul', ramo: 'Estadual' },
  { alias: 'api_publica_tjmt', sigla: 'TJMT', nome: 'TJ de Mato Grosso', ramo: 'Estadual' },
  { alias: 'api_publica_tjpa', sigla: 'TJPA', nome: 'TJ do Para', ramo: 'Estadual' },
  { alias: 'api_publica_tjpb', sigla: 'TJPB', nome: 'TJ da Paraiba', ramo: 'Estadual' },
  { alias: 'api_publica_tjpe', sigla: 'TJPE', nome: 'TJ de Pernambuco', ramo: 'Estadual' },
  { alias: 'api_publica_tjpi', sigla: 'TJPI', nome: 'TJ do Piaui', ramo: 'Estadual' },
  { alias: 'api_publica_tjpr', sigla: 'TJPR', nome: 'TJ do Parana', ramo: 'Estadual' },
  { alias: 'api_publica_tjrj', sigla: 'TJRJ', nome: 'TJ do Rio de Janeiro', ramo: 'Estadual' },
  { alias: 'api_publica_tjrn', sigla: 'TJRN', nome: 'TJ do Rio Grande do Norte', ramo: 'Estadual' },
  { alias: 'api_publica_tjro', sigla: 'TJRO', nome: 'TJ de Rondonia', ramo: 'Estadual' },
  { alias: 'api_publica_tjrr', sigla: 'TJRR', nome: 'TJ de Roraima', ramo: 'Estadual' },
  { alias: 'api_publica_tjrs', sigla: 'TJRS', nome: 'TJ do Rio Grande do Sul', ramo: 'Estadual' },
  { alias: 'api_publica_tjsc', sigla: 'TJSC', nome: 'TJ de Santa Catarina', ramo: 'Estadual' },
  { alias: 'api_publica_tjse', sigla: 'TJSE', nome: 'TJ de Sergipe', ramo: 'Estadual' },
  { alias: 'api_publica_tjsp', sigla: 'TJSP', nome: 'TJ de Sao Paulo', ramo: 'Estadual' },
  { alias: 'api_publica_tjto', sigla: 'TJTO', nome: 'TJ do Tocantins', ramo: 'Estadual' },
  { alias: 'api_publica_trt1', sigla: 'TRT1', nome: 'TRT 1a Regiao (RJ)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt2', sigla: 'TRT2', nome: 'TRT 2a Regiao (SP)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt3', sigla: 'TRT3', nome: 'TRT 3a Regiao (MG)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt4', sigla: 'TRT4', nome: 'TRT 4a Regiao (RS)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt5', sigla: 'TRT5', nome: 'TRT 5a Regiao (BA)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt6', sigla: 'TRT6', nome: 'TRT 6a Regiao (PE)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt7', sigla: 'TRT7', nome: 'TRT 7a Regiao (CE)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt8', sigla: 'TRT8', nome: 'TRT 8a Regiao (PA,AP)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt9', sigla: 'TRT9', nome: 'TRT 9a Regiao (PR)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt10', sigla: 'TRT10', nome: 'TRT 10a Regiao (DF,TO)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt11', sigla: 'TRT11', nome: 'TRT 11a Regiao (AM,RR)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt12', sigla: 'TRT12', nome: 'TRT 12a Regiao (SC)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt13', sigla: 'TRT13', nome: 'TRT 13a Regiao (PB)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt14', sigla: 'TRT14', nome: 'TRT 14a Regiao (RO,AC)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt15', sigla: 'TRT15', nome: 'TRT 15a Regiao (SP interior)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt16', sigla: 'TRT16', nome: 'TRT 16a Regiao (MA)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt17', sigla: 'TRT17', nome: 'TRT 17a Regiao (ES)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt18', sigla: 'TRT18', nome: 'TRT 18a Regiao (GO)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt19', sigla: 'TRT19', nome: 'TRT 19a Regiao (AL)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt20', sigla: 'TRT20', nome: 'TRT 20a Regiao (SE)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt21', sigla: 'TRT21', nome: 'TRT 21a Regiao (RN)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt22', sigla: 'TRT22', nome: 'TRT 22a Regiao (PI)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt23', sigla: 'TRT23', nome: 'TRT 23a Regiao (MT)', ramo: 'Trabalho' },
  { alias: 'api_publica_trt24', sigla: 'TRT24', nome: 'TRT 24a Regiao (MS)', ramo: 'Trabalho' },
  { alias: 'api_publica_tre-ac', sigla: 'TRE-AC', nome: 'TRE do Acre', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-al', sigla: 'TRE-AL', nome: 'TRE de Alagoas', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-am', sigla: 'TRE-AM', nome: 'TRE do Amazonas', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-ap', sigla: 'TRE-AP', nome: 'TRE do Amapa', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-ba', sigla: 'TRE-BA', nome: 'TRE da Bahia', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-ce', sigla: 'TRE-CE', nome: 'TRE do Ceara', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-es', sigla: 'TRE-ES', nome: 'TRE do Espirito Santo', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-go', sigla: 'TRE-GO', nome: 'TRE de Goias', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-ma', sigla: 'TRE-MA', nome: 'TRE do Maranhao', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-mg', sigla: 'TRE-MG', nome: 'TRE de Minas Gerais', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-ms', sigla: 'TRE-MS', nome: 'TRE de Mato Grosso do Sul', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-mt', sigla: 'TRE-MT', nome: 'TRE de Mato Grosso', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-pa', sigla: 'TRE-PA', nome: 'TRE do Para', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-pb', sigla: 'TRE-PB', nome: 'TRE da Paraiba', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-pe', sigla: 'TRE-PE', nome: 'TRE de Pernambuco', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-pi', sigla: 'TRE-PI', nome: 'TRE do Piaui', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-pr', sigla: 'TRE-PR', nome: 'TRE do Parana', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-rj', sigla: 'TRE-RJ', nome: 'TRE do Rio de Janeiro', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-rn', sigla: 'TRE-RN', nome: 'TRE do Rio Grande do Norte', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-ro', sigla: 'TRE-RO', nome: 'TRE de Rondonia', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-rr', sigla: 'TRE-RR', nome: 'TRE de Roraima', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-rs', sigla: 'TRE-RS', nome: 'TRE do Rio Grande do Sul', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-sc', sigla: 'TRE-SC', nome: 'TRE de Santa Catarina', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-se', sigla: 'TRE-SE', nome: 'TRE de Sergipe', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-sp', sigla: 'TRE-SP', nome: 'TRE de Sao Paulo', ramo: 'Eleitoral' },
  { alias: 'api_publica_tre-to', sigla: 'TRE-TO', nome: 'TRE do Tocantins', ramo: 'Eleitoral' },
  { alias: 'api_publica_tjmmg', sigla: 'TJMMG', nome: 'TJ Militar de Minas Gerais', ramo: 'Militar' },
  { alias: 'api_publica_tjmrs', sigla: 'TJMRS', nome: 'TJ Militar do Rio Grande do Sul', ramo: 'Militar' },
  { alias: 'api_publica_tjmsp', sigla: 'TJMSP', nome: 'TJ Militar de Sao Paulo', ramo: 'Militar' }
];
function datajudPost(alias, body, timeout){
  timeout = timeout || 45000;
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeout);
  return fetch(DATAJUD_BASE + '/' + alias + '/_search', {
    method: 'POST', signal: ctrl.signal,
    headers: { 'Content-Type': 'application/json', 'Authorization': DATAJUD_KEY, 'User-Agent': 'BrBRICS/1.0' },
    body: JSON.stringify(body)
  }).then(function(r){ return r.text().then(function(t){ return { status: r.status, text: t }; }); })
  .then(function(x){
    try { return { status: x.status, data: JSON.parse(x.text) }; }
    catch(e){ return { status: x.status, data: x.text }; }
  }).finally(function(){ clearTimeout(timer); });
}
function tribunalPorSigla(sigla){
  sigla = String(sigla||'').toUpperCase();
  for(var i=0;i<TRIBUNAIS.length;i++) if(TRIBUNAIS[i].sigla===sigla) return TRIBUNAIS[i];
  return null;
}
function resumoProcesso(h, sigla){
  var s = (h&&h._source)||{};
  return {
    numeroProcesso: s.numeroProcesso||'', tribunal: s.tribunal||'', siglaTrib: sigla||'',
    grau: s.grau||'', classe: (s.classe&&s.classe.nome)||'',
    assunto: ((s.assuntos||[]).map(function(a){return a.nome;}).join('; ')||'').slice(0,200),
    dataAjuizamento: s.dataAjuizamento||'',
    orgaoJulgador: (s.orgaoJulgador&&s.orgaoJulgador.nome)||'',
    ultimaMovimentacao: (s.movimentos&&s.movimentos.length)?(s.movimentos[s.movimentos.length-1].nome||''):((s.ultimaMovimentacaoProcessual&&s.ultimaMovimentacaoProcessual.nome)||'')
  };
}
function registrarTribunais(app, cacheGet, cacheSet){
  // Lista de todos os tribunais cobertos
  app.get('/api/tribunais', function(req, res){
    res.json({ fonte: 'CNJ DataJud - API Publica', total: TRIBUNAIS.length, tribunais: TRIBUNAIS });
  });
  // Busca por numero de processo (CNJ) em um tribunal
  app.get('/api/tribunais/buscar', function(req, res){
    var sigla = String(req.query.tribunal||'TST').toUpperCase();
    var numero = String(req.query.numero||'').replace(/\D/g,'');
    var t = tribunalPorSigla(sigla);
    if(!t) return res.status(400).json({ erro: 'Tribunal invalido. Use /api/tribunais para listar.' });
    if(numero.length!==20) return res.status(400).json({ erro: 'Numero CNJ deve ter 20 digitos (somente numeros).' });
    var ck = 'dj_busca_'+t.alias+'_'+numero;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    datajudPost(t.alias, { query: { match: { numeroProcesso: numero } } }).then(function(r){
      var hits = (r.data&&r.data.hits&&r.data.hits.hits)||[];
      var out = { fonte: 'CNJ DataJud', tribunal: t, numero: numero, total: hits.length, processos: hits.map(function(h){return resumoProcesso(h, t.sigla);}) };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'DataJud indisponivel', detalhe: String((e&&e.message)||e) }); });
  });
  // Ultimos processos de um tribunal (amostra por data de ajuizamento)
  app.get('/api/tribunais/recentes', function(req, res){
    var sigla = String(req.query.tribunal||'TST').toUpperCase();
    var qtd = Math.min(parseInt(req.query.qtd||'10',10)||10, 25);
    var t = tribunalPorSigla(sigla);
    if(!t) return res.status(400).json({ erro: 'Tribunal invalido. Use /api/tribunais para listar.' });
    var ck = 'dj_rec_'+t.alias+'_'+qtd;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    datajudPost(t.alias, { size: qtd, sort: [{ dataAjuizamento: { order: 'desc' } }], query: { match_all: {} } }).then(function(r){
      var hits = (r.data&&r.data.hits&&r.data.hits.hits)||[];
      var out = { fonte: 'CNJ DataJud', tribunal: t, total: hits.length, processos: hits.map(function(h){return resumoProcesso(h, t.sigla);}) };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'DataJud indisponivel', detalhe: String((e&&e.message)||e) }); });
  });
  // Agregado: amostra de varios tribunais de uma vez (para o feed geral)
  app.get('/api/tribunais/feed', function(req, res){
    var siglas = String(req.query.tribunais||'STF,STJ,TST,TJSP,TJRJ').split(',').map(function(s){return s.trim().toUpperCase();}).filter(Boolean).slice(0,8);
    var qtd = Math.min(parseInt(req.query.qtd||'3',10)||3, 5);
    var ck = 'dj_feed_'+siglas.join('_')+'_'+qtd;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    var jobs = siglas.map(function(sig){
      var t = tribunalPorSigla(sig);
      if(!t) return Promise.resolve({ sigla: sig, erro: 'desconhecido' });
      return datajudPost(t.alias, { size: qtd, sort: [{ dataAjuizamento: { order: 'desc' } }], query: { match_all: {} } }, 25000)
        .then(function(r){
          var hits = (r.data&&r.data.hits&&r.data.hits.hits)||[];
          return { sigla: t.sigla, nome: t.nome, ramo: t.ramo, total: hits.length, processos: hits.map(function(h){return resumoProcesso(h, t.sigla);}) };
        }).catch(function(e){ return { sigla: t.sigla, nome: t.nome, erro: String((e&&e.message)||e) }; });
    });
    Promise.all(jobs).then(function(rs){ var out = { fonte: 'CNJ DataJud', tribunais: rs, atualizadoEm: new Date().toISOString() }; cacheSet(ck, out); res.json(out); });
  });
  // Busca por assunto/classe (jurisprudencia por tema)
  app.get('/api/tribunais/tema', function(req, res){
    var sigla = String(req.query.tribunal||'STJ').toUpperCase();
    var termo = String(req.query.q||'').slice(0,120);
    var qtd = Math.min(parseInt(req.query.qtd||'10',10)||10, 25);
    var pagina = Math.max(1, Math.min(parseInt(req.query.pagina||'1',10)||1, 200));
    var t = tribunalPorSigla(sigla);
    if(!t) return res.status(400).json({ erro: 'Tribunal invalido. Use /api/tribunais para listar.' });
    if(termo.length<3) return res.status(400).json({ erro: 'Informe ao menos 3 letras (ex: tributario, consumidor, previdenciario).' });
    var ck = 'dj_tema_'+t.alias+'_'+termo.toLowerCase()+'_'+qtd+'_'+pagina;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    // multi_match apenas em classe/assuntos (movimentos.nome deixa a query no DataJud lenta e estoura timeout)
    var body = { size: qtd, from: (pagina-1)*qtd, sort: [{ dataAjuizamento: { order: 'desc' } }], query: { multi_match: { query: termo, fields: ['classe.nome^3','assuntos.nome^2'] } } };
    datajudPost(t.alias, body, 25000).then(function(r){
      var hits = (r.data&&r.data.hits&&r.data.hits.hits)||[];
      var tot = (r.data&&r.data.hits&&r.data.hits.total)||{};
      var totalAprox = (tot&&tot.value!=null)?tot.value:hits.length;
      var out = { fonte: 'CNJ DataJud', tribunal: t, tema: termo, pagina: pagina, qtd: qtd, totalAprox: totalAprox, totalPaginas: totalAprox?Math.min(200, Math.ceil(totalAprox/qtd)):1, processos: hits.map(function(h){return resumoProcesso(h, t.sigla);}) };
      cacheSet(ck, out, 600000); res.json(out);
    }).catch(function(e){ res.status(504).json({ erro: 'DataJud demorou demais ou esta indisponivel. Tente novamente.', detalhe: String((e&&e.message)||e) }); });
  });
  // Detalhe do processo com movimentacoes (andamento estilo Jusbrasil)
  app.get('/api/tribunais/detalhe', function(req, res){
    var sigla = String(req.query.tribunal||'TST').toUpperCase();
    var numero = String(req.query.numero||'').replace(/\D/g,'');
    var t = tribunalPorSigla(sigla);
    if(!t) return res.status(400).json({ erro: 'Tribunal invalido.' });
    if(numero.length!==20) return res.status(400).json({ erro: 'Numero CNJ deve ter 20 digitos.' });
    var ck = 'dj_det_'+t.alias+'_'+numero;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    datajudPost(t.alias, { query: { match: { numeroProcesso: numero } } }).then(function(r){
      var hits = (r.data&&r.data.hits&&r.data.hits.hits)||[];
      var s = (hits[0]&&hits[0]._source)||null;
      if(!s) return res.json({ fonte: 'CNJ DataJud', tribunal: t, numero: numero, total: 0, processo: null });
      var movs = (s.movimentos||[]).slice(-30).map(function(m){ return { data: m.dataHora||'', nome: m.nome||'', codigo: m.codigo||'' }; });
      var out = { fonte: 'CNJ DataJud', tribunal: t, numero: numero, total: 1,
        processo: { numeroProcesso: s.numeroProcesso||'', tribunal: s.tribunal||'', siglaTrib: sigla||'', grau: s.grau||'',
          classe: (s.classe&&s.classe.nome)||'', assuntos: (s.assuntos||[]).map(function(a){return a.nome;}),
          dataAjuizamento: s.dataAjuizamento||'', orgaoJulgador: (s.orgaoJulgador&&s.orgaoJulgador.nome)||'',
          movimentacoes: movs } };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'DataJud indisponivel', detalhe: String((e&&e.message)||e) }); });
  });
}
module.exports = { TRIBUNAIS: TRIBUNAIS, registrarTribunais: registrarTribunais };
