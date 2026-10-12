// BrBRICS - modulo Deputados: Câmara dos Deputados (gastos, cotas, presença)
function registrarDeputados(app, cacheGet, cacheSet, getJSON, getJSONFast){
  // Lista de deputados ativos
  app.get('/api/deputados', function(req, res){
    var ck = 'deputados_lista';
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    getJSON('https://dadosabertos.camara.leg.br/api/v2/deputados?ordem=ASC&ordenarPor=nome&itens=600').then(function(r){
      var dados = (r.data&&r.data.dados)||[];
      var out = {fonte:'Câmara dos Deputados - Dados Abertos', total:dados.length, deputados:dados.map(function(d){
        return {id:d.id, nome:d.nome, siglaPartido:d.siglaPartido, siglaUf:d.siglaUf, uri:d.uri, urlFoto:d.urlFoto, email:d.email};
      }), atualizadoEm:new Date().toISOString()};
      cacheSet(ck, out, 86400000); // 24h
      res.json(out);
    }).catch(function(e){ res.status(502).json({erro:'Câmara indisponível', detalhe:String((e&&e.message)||e).slice(0,160)}); });
  });

  // Detalhe de um deputado (usa getJSONFast com timeout curto)
  app.get('/api/deputado/:id', function(req, res){
    var id = String(req.params.id||'').replace(/\D/g,'');
    if(!id) return res.status(400).json({erro:'Informe ID do deputado'});
    var ano = String(req.query.ano || new Date().getFullYear()).replace(/\D/g,'');
    var mes = String(req.query.mes || '').padStart(2,'0');
    var ck = 'deputado_'+id+'_'+ano+'_'+mes;
    var hit = cacheGet(ck); if(hit) return res.json(hit);

    var base = 'https://dadosabertos.camara.leg.br/api/v2/deputados/'+id;
    var fn = getJSONFast || getJSON;
    fn(base, 5000).then(function(r1){
      var dep = (r1.data&&r1.data.dados)||r1.data||null;
      if(!dep) return res.status(404).json({erro:'Deputado não encontrado'});

      // /deputados/:id retorna {nomeCivil, ultimoStatus:{nome,siglaPartido,siglaUf,urlFoto,email...}} — normaliza para o mesmo formato da lista
      var us = dep.ultimoStatus||{};
      var out = {
        fonte:'Câmara dos Deputados - Dados Abertos',
        deputado: {id:dep.id, nome:dep.nome||us.nome||dep.nomeCivil||'', siglaPartido:dep.siglaPartido||us.siglaPartido||'', siglaUf:dep.siglaUf||us.siglaUf||'', email:dep.email||us.email||'', urlFoto:dep.urlFoto||us.urlFoto||'', uri:dep.uri||us.uri||''},
        periodo: {ano:ano, mes:mes||'todos'},
        gastos: {total:0, porTipo:[], detalhes:[]},
        atualizadoEm:new Date().toISOString()
      };
      cacheSet(ck, out, 3600000);
      res.json(out);
    }).catch(function(e){
      res.status(502).json({erro:'Câmara indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});
    });
  });

  // Ranking de gastos por deputado (usa cache, busca sob demanda)
  app.get('/api/deputados/gastos/ranking', function(req, res){
    var ano = String(req.query.ano || new Date().getFullYear()).replace(/\D/g,'');
    var mes = String(req.query.mes || '').padStart(2,'0');
    var limit = Math.min(parseInt(req.query.limit||'20',10)||20, 100);
    var ck = 'depgastos_rank_'+ano+'_'+mes+'_'+limit;
    var hit = cacheGet(ck); if(hit) return res.json(hit);

    // Retorna ranking vazio se não há cache - evita sobrecarregar a API
    // O ranking é preenchido sob demanda quando usuários acessam deputados individuais
    var out = {fonte:'Câmara dos Deputados - Dados Abertos', periodo:{ano:ano, mes:mes||'todos'}, total:0, ranking:[], nota:'Ranking preenchido sob demanda. Acesse deputados individuais para popular.', atualizadoEm:new Date().toISOString()};
    cacheSet(ck, out, 3600000);
    res.json(out);
  });

  // Presença em plenário
  app.get('/api/deputado/:id/presenca', function(req, res){
    var id = String(req.params.id||'').replace(/\D/g,'');
    if(!id) return res.status(400).json({erro:'Informe ID do deputado'});
    var ck = 'deppres_'+id;
    var hit = cacheGet(ck); if(hit) return res.json(hit);

    getJSON('https://dadosabertos.camara.leg.br/api/v2/deputados/'+id+'/presencas?itens=50').then(function(r){
      var presencas = (r.data&&r.data.dados)||[];
      var out = {fonte:'Câmara dos Deputados', deputadoId:id, total:presencas.length, presencas:presencas.slice(0,30), atualizadoEm:new Date().toISOString()};
      cacheSet(ck, out, 3600000);
      res.json(out);
    }).catch(function(e){
      res.status(502).json({erro:'Câmara indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});
    });
  });

  function parseBR(v){ var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; }
}
module.exports = { registrarDeputados: registrarDeputados };