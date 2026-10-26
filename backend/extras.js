// BrBRICS - Rotas extras de conteúdo agregado (RSS, dados abertos, clima/ar, calendário)
module.exports.registrarExtras = function(app, cacheGet, cacheSet, getJSON) {

  // ---- RSS: agregador de feeds oficiais ----
  app.get('/api/rss/fontes', function(req, res) {
    var ck = 'rss_fontes';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var fontes = [
      { id: 'dou1', nome: 'Diário Oficial - Seção 1', url: 'https://www.in.gov.br/leiturajornal?secao=dou1&format=xml', tipo: 'normativo' },
      { id: 'dou3', nome: 'Diário Oficial - Seção 3', url: 'https://www.in.gov.br/leiturajornal?secao=dou3&format=xml', tipo: 'edital' },
      { id: 'agenciabrasil', nome: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss', tipo: 'noticia' },
      { id: 'ibge', nome: 'IBGE - Agência de Notícias', url: 'https://agenciadenoticias.ibge.gov.br/noticias?format=rss', tipo: 'noticia' },
      { id: 'aneel', nome: 'ANEEL - Notícias', url: 'https://www.aneel.gov.br/agencia/rss', tipo: 'noticia' }
    ];
    var out = { fontes: fontes, total: fontes.length, atualizadoEm: new Date().toISOString() };
    cacheSet(ck, out, 3600000);
    res.json(out);
  });

  app.get('/api/rss/buscar', function(req, res) {
    var id = req.query.id;
    var qtd = parseInt(req.query.qtd || '10', 10);
    var ck = 'rss_' + id + '_' + qtd;
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var fontes = {
      dou1: 'https://www.in.gov.br/leiturajornal?secao=dou1&format=xml',
      dou3: 'https://www.in.gov.br/leiturajornal?secao=dou3&format=xml',
      agenciabrasil: 'https://agenciabrasil.ebc.com.br/rss',
      ibge: 'https://agenciadenoticias.ibge.gov.br/noticias?format=rss',
      aneel: 'https://www.aneel.gov.br/agencia/rss'
    };
    var url = fontes[id];
    if (!url) return res.status(400).json({ erro: 'Fonte não encontrada' });

    var Parser = null;
    try { Parser = require('rss-parser'); } catch(e){}
    if (!Parser) return res.json({ fonte: id, itens: [], erro: 'rss-parser não instalado' });

    var parser = new Parser();
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 20000);
    fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'BrBRICS/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' } })
      .then(function(r){ return r.text(); })
      .then(function(t){ clearTimeout(timer); return parser.parseString(t); })
      .then(function(feed){
        var itens = (feed.items || []).slice(0, qtd).map(function(item){
          var title = (item.title || '').trim();
          var orgao = '';
          var m = title.match(/^([A-ZÇÃÕ\s\.\-]+?)\s*[-–—]\s*(.+)$/);
          if(m){ orgao = m[1].trim(); title = m[2].trim(); }
          return {
            titulo: title,
            link: item.link || '',
            data: item.pubDate || item.isoDate || '',
            orgao: orgao,
            resumo: (item.content || item['content:encoded'] || item.summary || '').slice(0, 200)
          };
        });
        var out = { fonte: id, total: itens.length, itens: itens, atualizadoEm: new Date().toISOString() };
        cacheSet(ck, out, 600000);
        res.json(out);
      })
      .catch(function(e){
        res.json({ fonte: id, total: 0, itens: [], erro: String((e && e.message) || e).slice(0, 160), atualizadoEm: new Date().toISOString() });
      });
  });

  // ---- Calendário oficial (feriados nacionais e sessões) ----
  app.get('/api/calendario', function(req, res) {
    var ck = 'calendario_' + (req.query.ano || new Date().getFullYear());
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var ano = req.query.ano || new Date().getFullYear();
    var feriados = [
      { data: ano + '-01-01', nome: 'Confraternização Universal', tipo: 'feriado nacional' },
      { data: ano + '-04-21', nome: 'Tiradentes', tipo: 'feriado nacional' },
      { data: ano + '-05-01', nome: 'Dia do Trabalho', tipo: 'feriado nacional' },
      { data: ano + '-09-07', nome: 'Independência do Brasil', tipo: 'feriado nacional' },
      { data: ano + '-10-12', nome: 'Nossa Senhora Aparecida', tipo: 'feriado nacional' },
      { data: ano + '-11-02', nome: 'Finados', tipo: 'feriado nacional' },
      { data: ano + '-11-15', nome: 'Proclamação da República', tipo: 'feriado nacional' },
      { data: ano + '-12-25', nome: 'Natal', tipo: 'feriado nacional' }
    ];
    var sessoes = [
      { data: ano + '-02-02', nome: 'Retorno dos trabalhos do Congresso', tipo: 'sessão legislativa' },
      { data: ano + '-07-15', nome: 'Recesso branco (início)', tipo: 'recesso' },
      { data: ano + '-08-01', nome: 'Retorno após recesso branco', tipo: 'sessão legislativa' },
      { data: ano + '-12-22', nome: 'Recesso final de ano', tipo: 'recesso' }
    ];
    var out = { fonte: 'Calendário oficial público', ano: ano, feriados: feriados, sessoes: sessoes, total: feriados.length + sessoes.length, atualizadoEm: new Date().toISOString() };
    cacheSet(ck, out, 86400000);
    res.json(out);
  });

};