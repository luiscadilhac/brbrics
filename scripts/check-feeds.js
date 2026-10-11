// Checagem de feeds RSS dos tribunais (uso pontual)
var Parser = require('rss-parser');
var fetch = require('node-fetch');
var parser = new Parser();
var FEEDS = [
  'https://noticias.stf.jus.br/feed/',
  'https://www.cnj.jus.br/feed/',
  'https://www.stj.jus.br/feed/',
  'https://www.tst.jus.br/feed/',
  'https://www.tst.jus.br/rss',
  'https://www.tse.jus.br/feed/',
  'https://www.stm.jus.br/feed/',
  'https://www.trf1.jus.br/feed/',
  'https://www.trf2.jus.br/feed/',
  'https://www.trf3.jus.br/feed/',
  'https://www.trf4.jus.br/feed/',
  'https://www.trf5.jus.br/feed/',
  'https://www.trf6.jus.br/feed/',
  'https://www.tjsp.jus.br/feed/',
  'https://www.tjrj.jus.br/feed/',
  'https://www.tjmg.jus.br/feed/',
  'https://www.tjrs.jus.br/feed/',
  'https://www.tjpr.jus.br/feed/',
  'https://www.tjba.jus.br/feed/',
  'https://www.tjsc.jus.br/feed/',
  'https://www.tjgo.jus.br/feed/',
  'https://www.tjpe.jus.br/feed/',
  'https://www.tjce.jus.br/feed/',
  'https://www.tjpa.jus.br/feed/',
  'https://www.tjma.jus.br/feed/',
  'https://www.tjmt.jus.br/feed/',
  'https://www.tjms.jus.br/feed/',
  'https://www.tjes.jus.br/feed/',
  'https://www.tjpb.jus.br/feed/',
  'https://www.tjrn.jus.br/feed/',
  'https://www.tjal.jus.br/feed/',
  'https://www.tjse.jus.br/feed/',
  'https://www.tjpi.jus.br/feed/',
  'https://www.tjto.jus.br/feed/',
  'https://www.tjro.jus.br/feed/',
  'https://www.tjac.jus.br/feed/',
  'https://www.tjam.jus.br/feed/',
  'https://www.tjrr.jus.br/feed/',
  'https://www.tjap.jus.br/feed/',
  'https://www.tjdft.jus.br/feed/',
  'https://www.trt1.jus.br/feed/',
  'https://www.trt2.jus.br/feed/',
  'https://www.trt3.jus.br/feed/',
  'https://www.trt4.jus.br/feed/'
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
      }).catch(function(e){ return 'FAIL ' + url + ' PARSE ' + String(e.message||e).slice(0,60); });
    })
    .catch(function(e){ return 'FAIL ' + url + ' ' + String((e&&e.message)||e).slice(0,60); })
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
