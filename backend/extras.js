// BrBRICS - Rotas extras de conteúdo agregado (RSS, dados abertos, clima/ar, calendário)
var dou = require('./dou.js');

function limpaTag(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function(_, n){ return String.fromCharCode(Number(n)); })
    .replace(/&#x([0-9a-f]+);/gi, function(_, n){ return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

// Feed malformado (XML com < solto) faz o rss-parser jogar fora tudo: lê item a item.
function itensDeXmlLeniente(txt) {
  var blocos = String(txt || '').match(/<item[\s\S]*?<\/item>/gi) || [];
  function pega(bloco, tags) {
    for (var i = 0; i < tags.length; i++) {
      var m = bloco.match(new RegExp('<' + tags[i] + '[^>]*>([\\s\\S]*?)</' + tags[i] + '>', 'i'));
      if (m) return limpaTag(m[1]);
    }
    return '';
  }
  return blocos.map(function(b){
    var link = pega(b, ['link']);
    if (!link) { var ma = b.match(/href="([^"]+)"/); link = ma ? ma[1] : ''; }
    return { title: pega(b, ['title']), link: link, pubDate: pega(b, ['pubDate', 'updated', 'published', 'date']),
      content: pega(b, ['description', 'summary', 'content:encoded', 'content']) };
  }).filter(function(x){ return x.title; });
}

function remataItem(item) {
  var title = (item.title || '').trim();
  var orgao = '';
  var m = title.match(/^([A-ZÇÃÕ\s\.\-]+?)\s*[-–—]\s*(.+)$/);
  if (m) { orgao = m[1].trim(); title = m[2].trim(); }
  return {
    titulo: title,
    link: item.link || '',
    data: item.pubDate || item.isoDate || '',
    orgao: orgao,
    resumo: String(item.content || item['content:encoded'] || item.summary || '').slice(0, 200)
  };
}

module.exports.registrarExtras = function(app, cacheGet, cacheSet, getJSON) {

  // ---- RSS: agregador de feeds oficiais ----
  app.get('/api/rss/fontes', function(req, res) {
    var ck = 'rss_fontes';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var fontes = [
      { id: 'dou1', nome: 'Diário Oficial - Seção 1', url: 'https://www.in.gov.br/leiturajornal?secao=do1', tipo: 'normativo' },
      { id: 'dou2', nome: 'Diário Oficial - Seção 2', url: 'https://www.in.gov.br/leiturajornal?secao=do2', tipo: 'administrativo' },
      { id: 'dou3', nome: 'Diário Oficial - Seção 3', url: 'https://www.in.gov.br/leiturajornal?secao=do3', tipo: 'edital' },
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
      dou1: 'https://www.in.gov.br/leiturajornal?secao=do1',
      dou2: 'https://www.in.gov.br/leiturajornal?secao=do2',
      dou3: 'https://www.in.gov.br/leiturajornal?secao=do3',
      agenciabrasil: 'https://agenciabrasil.ebc.com.br/rss',
      ibge: 'https://agenciadenoticias.ibge.gov.br/noticias?format=rss',
      aneel: 'https://www.aneel.gov.br/agencia/rss'
    };
    var url = fontes[id];
    if (!url) return res.status(400).json({ erro: 'Fonte não encontrada' });

    // DOU nao tem RSS: a pagina de leitura embute o JSON da edicao (backend/dou.js)
    if (/^dou[123]$/.test(id)) {
      var secao = 'do' + id.slice(3);
      dou.ultimosDias(secao, 7).then(function(r){
        var pesos = secao === 'do3' ? dou.EDITAIS : dou.NORMATIVOS;
        var itens = dou.destaques(r.atos, 'Seção ' + secao.slice(2), 'dou', pesos, qtd);
        var out = {
          fonte: id, total: itens.length, itens: itens, data: r.data,
          aviso: itens.length ? null : 'Nenhum ato disponivel na ' + 'Seção ' + secao.slice(2) + ' em ' + r.data + '.',
          atualizadoEm: new Date().toISOString()
        };
        cacheSet(ck, out, itens.length ? 3600000 : 120000);
        res.json(out);
      });
      return;
    }

    var Parser = null;
    try { Parser = require('rss-parser'); } catch(e){}
    if (!Parser) return res.json({ fonte: id, itens: [], erro: 'rss-parser não instalado' });

    var parser = new Parser();
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 20000);
    fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'BrBRICS/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' } })
      .then(function(r){ clearTimeout(timer); if (r.status !== 200) throw new Error('Feed HTTP ' + r.status); return r.text(); })
      .then(function(t){
        return parser.parseString(t).catch(function(){ return { items: itensDeXmlLeniente(t) }; });
      })
      .then(function(feed){
        var itens = (feed.items || []).slice(0, qtd).map(remataItem);
        var out = { fonte: id, total: itens.length, itens: itens,
          aviso: itens.length ? null : 'Esta fonte não devolveu itens agora.',
          atualizadoEm: new Date().toISOString() };
        cacheSet(ck, out, itens.length ? 600000 : 120000);
        res.json(out);
      })
      .catch(function(e){
        res.json({ fonte: id, total: 0, itens: [], erro: 'Feed indisponível',
          aviso: 'A fonte não respondeu ou está com o XML inválido agora. Tente novamente em alguns minutos.',
          detalhe: String((e && e.message) || e).slice(0, 120), atualizadoEm: new Date().toISOString() });
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