// BrBRICS - modulo Legislacao: Camara rica + Senado + atalhos Planalto/LexML
function registrarLegislacao(app, cacheGet, cacheSet, getJSON){
  // Busca de proposicoes com filtros (tipo, ano, tema) - estilo LexML
  app.get('/api/legislacao/buscar', function(req, res){
    var q = String(req.query.q||'').slice(0,120);
    var tipo = String(req.query.tipo||'').toUpperCase();
    var ano = String(req.query.ano||'');
    var itens = Math.min(parseInt(req.query.itens||'15',10)||15, 50);
    var ck = 'leg_'+q.toLowerCase()+'_'+tipo+'_'+ano+'_'+itens;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    var url = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes?ordem=DESC&ordenarPor=id&itens=50';
    getJSON(url).then(function(r){
      var dados = (r.data&&r.data.dados)||[];
      // filtro local por tema/tipo/ano (a API da Camara nao busca substring em ementa)
      if(q){
        var ql = q.toLowerCase();
        dados = dados.filter(function(x){
          return String(x.ementa||'').toLowerCase().indexOf(ql) !== -1;
        });
      }
      if(tipo) dados = dados.filter(function(x){ return String(x.siglaTipo||'') === tipo; });
      if(ano) dados = dados.filter(function(x){ return String(x.ano||'') === ano; });
      dados = dados.slice(0, itens);
      var out = { fonte: 'Camara dos Deputados - Dados Abertos', filtros: { q: q, tipo: tipo, ano: ano }, total: dados.length, proposicoes: dados };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'Camara indisponivel', detalhe: String((e&&e.message)||e) }); });
  });
  // Detalhe + tramitacao de uma proposicao (linha do tempo estilo Jusbrasil)
  app.get('/api/legislacao/proposicao', function(req, res){
    var id = String(req.query.id||'').replace(/\D/g,'');
    if(!id) return res.status(400).json({ erro: 'Informe o id da proposicao.' });
    var ck = 'legprop_'+id;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    var base = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/'+id;
    getJSON(base).then(function(r1){
      getJSON(base+'/tramitacoes').then(function(r2){
        var out = { fonte: 'Camara dos Deputados', proposicao: (r1.data&&r1.data.dados)||null, tramitacao: ((r2.data&&r2.data.dados)||[]).slice(-20) };
        cacheSet(ck, out); res.json(out);
      }).catch(function(){ var out2 = { fonte: 'Camara dos Deputados', proposicao: (r1.data&&r1.data.dados)||null, tramitacao: [] }; cacheSet(ck, out2); res.json(out2); });
    }).catch(function(e){ res.status(502).json({ erro: 'Camara indisponivel', detalhe: String((e&&e.message)||e) }); });
  });
  // Votacoes recentes da Camara (placar estilo Congresso em Foco)
  app.get('/api/legislacao/votacoes', function(req, res){
    var ck = 'legvot';
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    getJSON('https://dadosabertos.camara.leg.br/api/v2/votacoes?ordem=DESC&ordenarPor=dataHoraRegistro&itens=10').then(function(r){
      var out = { fonte: 'Camara dos Deputados', votacoes: (r.data&&r.data.dados)||[] };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'Camara indisponivel', detalhe: String((e&&e.message)||e) }); });
  });
  // Votos nominais de uma votacao (como cada deputado votou) - placar detalhado
  app.get('/api/legislacao/votacao', function(req, res){
    var id = String(req.query.id||'').trim();
    if(!id) return res.status(400).json({ erro: 'Informe o id da votacao (ex: 2611313-34).' });
    var ck = 'legvotdet_'+id;
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    getJSON('https://dadosabertos.camara.leg.br/api/v2/votacoes/'+encodeURIComponent(id)+'/votos').then(function(r){
      var votos = (r.data&&r.data.dados)||[];
      var resumo = { Sim:0, Nao:0, Abstencao:0, Obstrucao:0, Artigo17:0, Branco:0, Total: votos.length };
      votos.forEach(function(v){
        var t = v.tipoVoto || '';
        if(t==='Sim') resumo.Sim++; else if(t==='Nao'||t==='Não') resumo.Nao++;
        else if(t==='Abstencao'||t==='Abstenção') resumo.Abstencao++;
        else if(t==='Obstrucao'||t==='Obstrução') resumo.Obstrucao++;
        else if(t==='Artigo 17') resumo.Artigo17++;
        else if(t==='Branco') resumo.Branco++;
      });
      // agrupa por partido
      var porPartido = {};
      votos.forEach(function(v){
        var p = (v.deputado_ && v.deputado_.siglaPartido) || 'N/D';
        (porPartido[p] = porPartido[p] || { Sim:0, Nao:0, Abstencao:0, Obstrucao:0, Total:0 });
        var o = porPartido[p]; o.Total++;
        var t = v.tipoVoto || '';
        if(t==='Sim') o.Sim++; else if(t==='Nao'||t==='Não') o.Nao++;
        else if(t==='Abstencao'||t==='Abstenção') o.Abstencao++;
        else if(t==='Obstrucao'||t==='Obstrução') o.Obstrucao++;
      });
      var partidos = Object.keys(porPartido).map(function(p){ var o = porPartido[p]; o.partido = p; return o; });
      partidos.sort(function(a,b){ return b.Total - a.Total; });
      var out = { fonte: 'Camara dos Deputados - Dados Abertos', votacaoId: id, placar: resumo, partidos: partidos,
        votos: votos.map(function(v){
          return { nome: (v.deputado_ && v.deputado_.nome)||'', partido: (v.deputado_ && v.deputado_.siglaPartido)||'', uf: (v.deputado_ && v.deputado_.siglaUf)||'', voto: v.tipoVoto||'' };
        }) };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'Votos indisponiveis para esta votacao', detalhe: String((e&&e.message)||e) }); });
  });

  // Agenda do Congresso (eventos/sessoes/audiencias) - dados abertos, formato ISO
  app.get('/api/legislacao/agenda', function(req, res){
    var ck = 'legagenda';
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    var hoje = new Date();
    var d = function(x){ return (x<10?'0':'')+x; };
    var ini = hoje.getFullYear()+'-'+d(hoje.getMonth()+1)+'-'+d(hoje.getDate());
    var fim = new Date(hoje.getTime()+7*86400000);
    var fimStr = fim.getFullYear()+'-'+d(fim.getMonth()+1)+'-'+d(fim.getDate());
    var url = 'https://dadosabertos.camara.leg.br/api/v2/eventos?ordem=ASC&ordenarPor=dataHoraInicio&dataInicio='+ini+'&dataFim='+fimStr+'&itens=20';
    getJSON(url).then(function(r){
      var eventos = ((r.data&&r.data.dados)||[]).map(function(e){
        return {
          id: e.id, descricaoTipo: (e.descricaoTipo||''), descricao: (e.descricao||''),
          dataHoraInicio: e.dataHoraInicio||'', localCamara: (e.localCamara && e.localCamara.nome)||'',
          situacao: e.situacao||'', orgaos: (e.orgaos||[]).map(function(o){return o.sigla||o.nome||'';}).filter(Boolean).slice(0,4)
        };
      });
      var out = { fonte: 'Camara dos Deputados - Dados Abertos', periodo: { ini: ini, fim: fimStr }, eventos: eventos };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'Agenda indisponivel', detalhe: String((e&&e.message)||e) }); });
  });

  // Materias do Senado ( Leis & Politica )
  app.get('/api/legislacao/senado', function(req, res){
    var ck = 'legsen';
    var hit = cacheGet(ck); if(hit) return res.json(hit);
    getJSON('https://legis.senado.leg.br/dadosabertos/materia/tramitando').then(function(r){
      var out = { fonte: 'Senado Federal - Dados Abertos', dados: r.data };
      cacheSet(ck, out); res.json(out);
    }).catch(function(e){ res.status(502).json({ erro: 'Senado indisponivel', detalhe: String((e&&e.message)||e) }); });
  });
}
module.exports = { registrarLegislacao: registrarLegislacao };
