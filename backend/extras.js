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

  // ---- Dados abertos: Banco Central (SGS) ----
  app.get('/api/dados/bc', function(req, res) {
    var ck = 'dados_bc';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var series = {
      ipca: 433,
      selic: 432,
      igpm: 189,
      ptax: 1
    };
    var resultados = {};
    var promises = Object.keys(series).map(function(chave){
      var codigo = series[chave];
      var url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs/' + codigo + '/dados/ultimos/10?formato=json';
      return getJSON(url, {}, 15000).then(function(r){
        var dados = r.data || [];
        resultados[chave] = dados;
      }).catch(function(){
        resultados[chave] = [];
      });
    });
    Promise.all(promises).then(function(){
      var resumo = {};
      if (resultados.ipca && resultados.ipca[0]) resumo.ipca = resultados.ipca[0].valor;
      if (resultados.selic && resultados.selic[0]) resumo.selic = resultados.selic[0].valor;
      if (resultados.igpm && resultados.igpm[0]) resumo.igpm = resultados.igpm[0].valor;
      if (resultados.ptax && resultados.ptax[0]) resumo.ptax = resultados.ptax[0].valor;
      var out = { fonte: 'Banco Central - SGS', series: resultados, resumo: resumo, atualizadoEm: new Date().toISOString() };
      cacheSet(ck, out, 900000);
      res.json(out);
    });
  });

  // ---- Dados abertos: IBGE estados e população ----
  app.get('/api/dados/ibge', function(req, res) {
    var ck = 'dados_ibge';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    getJSON('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome', {}, 15000)
      .then(function(r){
        var estados = (r.data || []).map(function(e){
          return { id: e.id, sigla: e.sigla, nome: e.nome, regiao: e.regiao && e.regiao.nome };
        });
        var out = { fonte: 'IBGE - Localidades', estados: estados, total: estados.length, atualizadoEm: new Date().toISOString() };
        cacheSet(ck, out, 3600000);
        res.json(out);
      }).catch(function(e){
        res.json({ fonte: 'IBGE - Localidades', estados: [], total: 0, erro: String((e && e.message) || e).slice(0, 160), atualizadoEm: new Date().toISOString() });
      });
  });

  // ---- Clima: temperatura atual (Open-Meteo via geocoding) ----
  app.get('/api/clima/tempo', function(req, res) {
    var ck = 'clima_tempo_' + (req.query.cidade || 'sao-paulo');
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var cidade = req.query.cidade || 'São Paulo';
    // 1) Geocodificação Open-Meteo para obter lat/lon
    var geoUrl = 'https://geocoding.api.open-meteo.com/v1/search?name=' + encodeURIComponent(cidade) + '&count=1&language=pt&format=json';
    getJSON(geoUrl, {}, 15000).then(function(r){
      var resultados = r.data && r.data.results || [];
      if (!resultados.length) throw new Error('Cidade não encontrada');
      var lat = resultados[0].latitude;
      var lon = resultados[0].longitude;
      var nome = resultados[0].name;

      // 2) Dados atuais do tempo
      var tempoUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
                     '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=America/Sao_Paulo';
      return getJSON(tempoUrl, {}, 15000).then(function(t){
        var cur = t.data && t.data.current || {};
        var codigo = cur.weather_code;
        var condicoes = {
          0: 'Céu limpo', 1: 'Quase limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
          45: 'Nevoeiro', 48: 'Nevoeiro geado', 51: 'Chuva fraca', 53: 'Chuva moderada',
          55: 'Chuva forte', 61: 'Chuva', 63: 'Chuva forte', 65: 'Chuva muito forte',
          71: 'Neve fraca', 73: 'Neve', 75: 'Neve forte', 80: 'Aguaceiros fracos',
          81: 'Aguaceiros', 82: 'Aguaceiros fortes', 95: 'Trovoada'
        };
        var out = {
          cidade: nome,
          temperatura: cur.temperature_2m != null ? cur.temperature_2m : null,
          umidade: cur.relative_humidity_2m != null ? cur.relative_humidity_2m : null,
          vento: cur.wind_speed_10m != null ? cur.wind_speed_10m : null,
          condicao: condicoes[codigo] != null ? condicoes[codigo] : '—',
          atualizadoEm: new Date().toISOString()
        };
        cacheSet(ck, out, 900000);
        res.json(out);
      });
    }).catch(function(e){
      res.json({ erro: String((e && e.message) || e).slice(0, 160), atualizadoEm: new Date().toISOString() });
    });
  });

  // ---- Qualidade do ar (OpenAQ) ----
  app.get('/api/clima/ar', function(req, res) {
    var ck = 'clima_ar_' + (req.query.cidade || 'sao-paulo');
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var cidade = req.query.cidade || 'sao-paulo';
    var url = 'https://api.openaq.org/v2/latest?city=' + encodeURIComponent(cidade) + '&limit=10';
    getJSON(url, {}, 15000).then(function(r){
      var dados = r.data || {};
      var resultados = (dados.results || []).map(function(item){
        return {
          cidade: item.city,
          pais: item.country,
          coordenadas: item.coordinates,
          mediçoes: (item.measurements || []).map(function(m){
            return { parametro: m.parameter, valor: m.value, unidade: m.unit, ultima: m.lastUpdated };
          })
        };
      });
      var out = { fonte: 'OpenAQ - Qualidade do Ar', cidade: cidade, total: resultados.length, resultados: resultados, atualizadoEm: new Date().toISOString() };
      cacheSet(ck, out, 900000);
      res.json(out);
    }).catch(function(e){
      res.json({ fonte: 'OpenAQ - Qualidade do Ar', cidade: cidade, total: 0, resultados: [], erro: String((e && e.message) || e).slice(0, 160), atualizadoEm: new Date().toISOString() });
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