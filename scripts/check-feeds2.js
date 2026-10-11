// Checagem rodada 2 - URLs alternativas oficiais
var Parser = require('rss-parser');
var fetch = require('node-fetch');
var parser = new Parser();
var FEEDS = [
  // STJ / TSE / CNJ - tentativas alternativas
  'https://www.stj.jus.br/sites/portalp/SiteAssets/rss.xml',
  'https://www.stj.jus.br/sites/portalp/Paginas/rss.aspx',
  'https://www.stj.jus.br/sites/portalp/rss/noticias.xml',
  'https://www.stj.jus.br/rss/noticias.xml',
  'https://www.tse.jus.br/feed',
  'https://www.tse.jus.br/imprensa/noticias-tse/rss',
  'https://www.tse.jus.br/rss.xml',
  'https://www.cnj.jus.br/noticias-cnj/feed/',
  'https://www.cnj.jus.br/feed',
  'https://www.cnj.jus.br/rss.xml',
  // TRFs
  'https://www.trf1.jus.br/trf1/noticias/feed',
  'https://portal.trf1.jus.br/feed/',
  'https://www.trf2.jus.br/feed',
  'https://www10.trf2.jus.br/feed/',
  'https://www.trf3.jus.br/feed',
  'https://web.trf3.jus.br/feed/',
  'https://www.trf4.jus.br/feed',
  'https://www.trf4.jus.br/trf4/noticias/feed',
  'https://www.trf5.jus.br/feed',
  'https://www.trf5.jus.br/noticias/feed',
  // TJs grandes - alternativas
  'https://www.tjsp.jus.br/Noticias/Feed',
  'https://www.tjsp.jus.br/feed',
  'https://www.tjrj.jus.br/rss/noticias.xml',
  'https://www.tjrj.jus.br/noticias/feed',
  'https://www.tjmg.jus.br/portal-tjmg/noticias/feed.htm',
  'https://www.tjmg.jus.br/feed',
  'https://www.tjrs.jus.br/novo/feed/',
  'https://www.tjrs.jus.br/feed/',
  'https://www.tjpr.jus.br/noticias/-/asset_publisher/rss.xml',
  'https://www.tjba.jus.br/feed',
  'https://www.tjsc.jus.br/feed',
  'https://www.tjgo.jus.br/feed',
  'https://www.tjpe.jus.br/feed',
  'https://www.tjdft.jus.br/feed',
  'https://www.tjdft.jus.br/noticias/feed'
];
function check(url){
  var ctrl = new AbortController();
  var t = setTimeout(function(){ ctrl.abort(); }, 10000);
  return fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'BrBRICS/1.0' } })
    .then(function(r){ return r.text().then(function(x){ return { status: r.status, text: x }; }); })
    .then(function(x){
      if(x.status !== 200) return 'FAIL ' + url + ' HTTP ' + x.status;
      return parser.parseString(x.text).then(function(f){
        return 'OK ' + url + ' count=' + ((f.items||[]).length) + ' title=' + String(f.title||'').slice(0,60);
      }).catch(function(e){ return 'FAIL ' + url + ' PARSE ' + String(e.message||e).slice(0,50); });
    })
    .catch(function(e){ return 'FAIL ' + url + ' ' + String((e&&e.message)||e).slice(0,50); })
    .finally(function(){ clearTimeout(t); });
}
(function(){
  var B = 8, i = 0;
  function next(){
    if(i >= FEEDS.length) return;
    var chunk = FEEDS.slice(i, i + B); i += B;
    Promise.all(chunk.map(check)).then(function(rs){ rs.forEach(function(r){ console.log(r); }); next(); });
  }
  next();
})();
