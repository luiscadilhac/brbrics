// BrBRICS - modulo Noticias dos tribunais via RSS (feeds validados)
var RSS_FEEDS = [
  { sigla: 'STF', nome: 'Supremo Tribunal Federal', url: 'https://noticias.stf.jus.br/feed/' },
  { sigla: 'TST', nome: 'Tribunal Superior do Trabalho', url: 'https://www.tst.jus.br/rss' },
  { sigla: 'TRF6', nome: 'TRF 6a Regiao', url: 'https://www.trf6.jus.br/feed/' },
  { sigla: 'TJCE', nome: 'TJ do Ceara', url: 'https://www.tjce.jus.br/feed/' },
  { sigla: 'TJES', nome: 'TJ do Espirito Santo', url: 'https://www.tjes.jus.br/feed/' }
];
function registrarNoticias(app, cacheGet, cacheSet){
  var Parser = null; try { Parser = require('rss-parser'); } catch(e){}
  function fetchRSS(f){
    if(!Parser) return Promise.resolve({ sigla: f.sigla, nome: f.nome, erro: 'rss-parser ausente' });
    var parser = new Parser();
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 12000);
    var fetch = require('node-fetch');
    return fetch(f.url, { signal: ctrl.signal, headers: { 'User-Agent': 'BrBRICS/1.0' } })
      .then(function(r){ return r.text().then(function(t){ return { status: r.status, text: t }; }); })
      .then(function(x){
        if(x.status!==200) throw new Error('HTTP '+x.status);
        return parser.parseString(x.text);
      })
      .then(function(feed){
        return { sigla: f.sigla, nome: f.nome, total: (feed.items||[]).length,
          noticias: (feed.items||[]).slice(0,8).map(function(n){ return { titulo: n.title||'', link: n.link||'', data: n.pubDate||n.isoDate||'', resumo: String(n.contentSnippet||n.content||'').slice(0,220), imagem: extrairImagemFeed(n), video: detectarVideo(n) }; }) };
      })
      .catch(function(e){ return { sigla: f.sigla, nome: f.nome, erro: String((e&&e.message)||e) }; })
      .finally(function(){ clearTimeout(timer); });
  }
  app.get('/api/tribunais/noticias', function(req, res){
    var hit = cacheGet('rss_all_v2'); if(hit) return res.json(hit);
    Promise.all(RSS_FEEDS.map(fetchRSS)).then(function(rs){
      var jobs = [];
      rs.forEach(function(o){ if(!o.erro && o.noticias){ o.noticias.slice(0,6).forEach(function(n){ if(!n.imagem && n.link) jobs.push(n); }); } });
      return mapLimit(jobs, 8, function(n){ return ogImage(n.link).then(function(img){ n.imagem = img || ''; return n; }); }).then(function(){
        var out = { fonte: 'RSS oficiais dos tribunais', total: rs.length, tribunais: rs, atualizadoEm: new Date().toISOString() };
        cacheSet('rss_all_v2', out, 600000); res.json(out);
      });
    });
  });
}
module.exports.RSS_FEEDS = RSS_FEEDS;
module.exports.registrarNoticias = registrarNoticias;

// ---- Orgaos reguladores / governo federal (RSS gov.br raiz) ----
// categoria: 'reg' = agencia reguladora, 'min' = ministerio/orgao federal
var REG_FEEDS = [
  { sigla: 'ANP', nome: 'Agencia Nacional do Petroleo', cat: 'reg', url: 'https://www.gov.br/anp/RSS' },
  { sigla: 'ANEEL', nome: 'Agencia Nacional de Energia Eletrica', cat: 'reg', url: 'https://www.gov.br/aneel/RSS' },
  { sigla: 'ANAC', nome: 'Agencia Nacional de Aviacao Civil', cat: 'reg', url: 'https://www.gov.br/anac/RSS' },
  { sigla: 'ANTAQ', nome: 'Agencia Nac. Transportes Aquaviarios', cat: 'reg', url: 'https://www.gov.br/antaq/RSS' },
  { sigla: 'ANTT', nome: 'Agencia Nacional Transportes Terrestres', cat: 'reg', url: 'https://www.gov.br/antt/RSS' },
  { sigla: 'ANS', nome: 'Agencia Nacional de Saude Suplementar', cat: 'reg', url: 'https://www.gov.br/ans/RSS' },
  { sigla: 'ANM', nome: 'Agencia Nacional de Mineracao', cat: 'reg', url: 'https://www.gov.br/anm/RSS' },
  { sigla: 'CADE', nome: 'Conselho de Defesa Economica', cat: 'reg', url: 'https://www.gov.br/cade/RSS' },
  { sigla: 'CVM', nome: 'Comissao de Valores Mobiliarios', cat: 'reg', url: 'https://www.gov.br/cvm/RSS' },
  { sigla: 'INMETRO', nome: 'Instituto Nacional de Metrologia', cat: 'reg', url: 'https://www.gov.br/inmetro/RSS' },
  { sigla: 'INPI', nome: 'Propriedade Industrial', cat: 'reg', url: 'https://www.gov.br/inpi/RSS' },
  // ---- Ministerios e orgaos federais ----
  { sigla: 'RECEITA', nome: 'Receita Federal', cat: 'min', url: 'https://www.gov.br/receitafederal/RSS' },
  { sigla: 'INSS', nome: 'Previdencia Social (INSS)', cat: 'min', url: 'https://www.gov.br/inss/RSS' },
  { sigla: 'CGU', nome: 'Controladoria-Geral da Uniao', cat: 'min', url: 'https://www.gov.br/cgu/RSS' },
  { sigla: 'FAZENDA', nome: 'Ministerio da Fazenda', cat: 'min', url: 'https://www.gov.br/fazenda/RSS' },
  { sigla: 'JUSTICA', nome: 'Ministerio da Justica e Seguranca', cat: 'min', url: 'https://www.gov.br/mj/RSS' },
  { sigla: 'TRABALHO', nome: 'Ministerio do Trabalho e Emprego', cat: 'min', url: 'https://www.gov.br/trabalho-e-emprego/RSS' },
  { sigla: 'EDUCACAO', nome: 'Ministerio da Educacao (MEC)', cat: 'min', url: 'https://www.gov.br/mec/RSS' },
  { sigla: 'INEP', nome: 'Instituto Nacional de Estudos (INEP)', cat: 'min', url: 'https://www.gov.br/inep/RSS' },
  { sigla: 'CIENCIA', nome: 'Ciencia, Tecnologia e Inovacao', cat: 'min', url: 'https://www.gov.br/mcti/RSS' },
  { sigla: 'CNPQ', nome: 'CNPq', cat: 'min', url: 'https://www.gov.br/cnpq/RSS' },
  { sigla: 'AGRICULTURA', nome: 'Ministerio da Agricultura (MAPA)', cat: 'min', url: 'https://www.gov.br/agricultura/RSS' },
  { sigla: 'FAZENDA-ECON', nome: 'Fazenda - Economia', cat: 'min', url: 'https://www.gov.br/economia/RSS' },
  { sigla: 'DESENVOLVE', nome: 'Desenvolvimento e Comercio (MDIC)', cat: 'min', url: 'https://www.gov.br/mdic/RSS' },
  { sigla: 'MEIOAMBIENTE', nome: 'Meio Ambiente (MMA)', cat: 'min', url: 'https://www.gov.br/mma/RSS' },
  { sigla: 'IBAMA', nome: 'IBAMA', cat: 'min', url: 'https://www.gov.br/ibama/RSS' },
  { sigla: 'ICMBIO', nome: 'ICMBio', cat: 'min', url: 'https://www.gov.br/icmbio/RSS' },
  { sigla: 'CULTURA', nome: 'Ministerio da Cultura', cat: 'min', url: 'https://www.gov.br/cultura/RSS' },
  { sigla: 'TURISMO', nome: 'Ministerio do Turismo', cat: 'min', url: 'https://www.gov.br/turismo/RSS' },
  { sigla: 'MULHERES', nome: 'Mulheres / Direitos Humanos', cat: 'min', url: 'https://www.gov.br/mdh/RSS' },
  { sigla: 'DESENVSOCIAL', nome: 'Desenvolvimento Social (MDS)', cat: 'min', url: 'https://www.gov.br/mds/RSS' },
  { sigla: 'DNIT', nome: 'DNIT', cat: 'min', url: 'https://www.gov.br/dnit/RSS' },
  { sigla: 'DNOCS', nome: 'DNOCS', cat: 'min', url: 'https://www.gov.br/dnocs/RSS' },
  { sigla: 'AGU', nome: 'Advocacia-Geral da Uniao', cat: 'min', url: 'https://www.gov.br/agu/RSS' },
  { sigla: 'SAUDE', nome: 'Ministerio da Saude', cat: 'min', url: 'https://www.gov.br/saude/RSS' },
  { sigla: 'PLANALTO', nome: 'Presidencia da Republica', cat: 'min', url: 'https://www.gov.br/planalto/RSS' },
  { sigla: 'MME', nome: 'Ministerio de Minas e Energia', cat: 'min', url: 'https://www.gov.br/mme/RSS' }
];
var BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ---- Extracao de imagem/video das noticias ----
function extrairImagemFeed(n){
  try{
    if(n.enclosure && n.enclosure.url && /image/i.test(n.enclosure.type||'')) return n.enclosure.url;
    var mc = n['media:content'] || n.mediaContent;
    if(mc){ var arr = Array.isArray(mc)?mc:[mc]; for(var i=0;i<arr.length;i++){ if(arr[i] && arr[i].$ && arr[i].$.url && /image/i.test((arr[i].$&&arr[i].$.medium)||'image')) return arr[i].$.url; } if(arr[0] && arr[0].$ && arr[0].$.url) return arr[0].$.url; }
    var mt = n['media:thumbnail'] || n.mediaThumbnail;
    if(mt){ var a2 = Array.isArray(mt)?mt:[mt]; if(a2[0] && a2[0].$ && a2[0].$.url) return a2[0].$.url; }
    var html = n['content:encoded'] || n.content || n.contentSnippet || n.description || '';
    var m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
    if(m) return m[1];
  }catch(e){}
  return '';
}
function detectarVideo(n){
  try{
    if(n.enclosure && n.enclosure.url && /video/i.test(n.enclosure.type||'')) return n.enclosure.url;
    var html = String(n['content:encoded']||n.content||n.description||'');
    var m = html.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([\w-]+)/i);
    if(m) return 'https://www.youtube.com/watch?v='+m[1];
  }catch(e){}
  return '';
}
var _ogCache = {};
function ogImage(url){
  if(!url) return Promise.resolve('');
  if(_ogCache[url]!=null) return Promise.resolve(_ogCache[url]);
  var ctrl=new AbortController(); var t=setTimeout(function(){ctrl.abort();},9000);
  var f=require('node-fetch');
  return f(url,{signal:ctrl.signal,redirect:'follow',headers:{'User-Agent':BROWSER_UA,'Accept':'text/html'}})
    .then(function(r){return r.text();})
    .then(function(html){
      var m=String(html).match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        ||String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
        ||String(html).match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      var img=m?m[1]:''; if(/logo\.(png|svg|jpg)/i.test(img)) img='';
      _ogCache[url]=img; return img;
    })
    .catch(function(){_ogCache[url]='';return '';})
    .then(function(v){clearTimeout(t);return v;});
}

// concorrencia limitada: enriquece og:image sem derrubar as fontes
function mapLimit(items, limit, fn){
  return new Promise(function(resolve){
    var results = new Array(items.length); var idx=0, ativo=0, done=0;
    if(!items.length) return resolve(results);
    function next(){
      while(ativo<limit && idx<items.length){
        (function(cur){ ativo++;
          Promise.resolve(fn(items[cur], cur)).then(function(v){ results[cur]=v; })
            .catch(function(){ results[cur]=undefined; })
            .then(function(){ ativo--; done++; if(done===items.length) resolve(results); else next(); });
        })(idx++);
      }
    }
    next();
  });
}

function registrarReguladores(app, cacheGet, cacheSet){
  var Parser = null; try { Parser = require('rss-parser'); } catch(e){}
  var fetch = require('node-fetch');
  function fetchRSS(f){
    if(!Parser) return Promise.resolve({ sigla: f.sigla, nome: f.nome, erro: 'rss-parser ausente' });
    var parser = new Parser();
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 15000);
    return fetch(f.url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*' } })
      .then(function(r){ return r.text().then(function(t){ return { status: r.status, text: t }; }); })
      .then(function(x){
        if(x.status!==200) throw new Error('HTTP '+x.status);
        return parser.parseString(x.text).then(function(feed){
          if(!(feed.items||[]).length) throw new Error('feed sem itens');
          return { sigla: f.sigla, nome: f.nome, cat: f.cat||'reg', total: (feed.items||[]).length,
            noticias: (feed.items||[]).slice(0,6).map(function(n){ return { titulo: (n.title||'').trim(), link: n.link||'', data: n.pubDate||n.isoDate||'', resumo: String(n.contentSnippet||n.content||'').replace(/\s+/g,' ').slice(0,220), imagem: extrairImagemFeed(n), video: detectarVideo(n) }; }) };
        });
      })
      .catch(function(e){ return { sigla: f.sigla, nome: f.nome, erro: String((e&&e.message)||e) }; })
      .finally(function(){ clearTimeout(timer); });
  }
  app.get('/api/reguladores', function(req, res){
    var hit = cacheGet('reg_all_v2'); if(hit) return res.json(hit);
    Promise.all(REG_FEEDS.map(fetchRSS)).then(function(rs){
      var jobs = [];
      rs.forEach(function(o){ if(!o.erro && o.noticias){ o.noticias.slice(0,6).forEach(function(n){ if(!n.imagem && n.link) jobs.push(n); }); } });
      return mapLimit(jobs, 10, function(n){ return ogImage(n.link).then(function(img){ n.imagem = img || ''; return n; }); }).then(function(){
        var ok = rs.filter(function(r){ return !r.erro; });
        var out = { fonte: 'RSS gov.br - orgaos reguladores', total: rs.length, online: ok.length, orgaos: rs, atualizadoEm: new Date().toISOString() };
        cacheSet('reg_all_v2', out, 600000); res.json(out);
      });
    });
  });

  // Agregador de manchetes (todos os orgaos + tribunais), enriquecido com og:image.
  // Reaproveita os caches de /api/reguladores e /api/tribunais/noticias (fetch interno),
  // evitando 42 requisicoes simultaneas que derrubam os feeds de tribunais por timeout.
  app.get('/api/manchetes', function(req, res){
    var hit = cacheGet('manchetes_v2'); if(hit) return res.json(hit);
    var http = require('http');
    var PORT = process.env.PORT || 3000;
    function interno(path){
      return new Promise(function(resolve){
        var rq = http.get({ host:'127.0.0.1', port:PORT, path:path, headers:{'Accept':'application/json'} }, function(rs){
          var b=''; rs.on('data',function(c){b+=c;}); rs.on('end',function(){ try{ resolve(JSON.parse(b)); }catch(e){ resolve(null); } });
        });
        rq.on('error', function(){ resolve(null); });
        rq.setTimeout(45000, function(){ rq.destroy(); resolve(null); });
      });
    }
    Promise.all([interno('/api/reguladores'), interno('/api/tribunais/noticias')]).then(function(r){
      var reg = r[0]||{}, tri = r[1]||{};
      var todas = [], jud = [];
      (reg.orgaos||[]).forEach(function(o){
        if(!o.erro && o.noticias) o.noticias.forEach(function(n){
          var item = { titulo:n.titulo, link:n.link, data:n.data, resumo:n.resumo, imagem:n.imagem||'', video:n.video||'', fonte:o.sigla, fonteNome:o.nome, cat:(o.cat||'reg') };
          todas.push(item);
        });
      });
      (tri.tribunais||[]).forEach(function(o){
        if(!o.erro && o.noticias) o.noticias.forEach(function(n){
          var item = { titulo:n.titulo, link:n.link, data:n.data, resumo:n.resumo, imagem:n.imagem||'', video:n.video||'', fonte:o.sigla, fonteNome:o.nome, cat:'trib' };
          todas.push(item); jud.push(item);
        });
      });
      var ord = function(a,b){ return (new Date(b.data||0))-(new Date(a.data||0)); };
      todas.sort(ord); jud.sort(ord);
      var man = todas.slice(0,18);
      var judTop = jud.slice(0,6);
      var enriquecer = man.concat(judTop.filter(function(j){ return man.indexOf(j)<0; }));
      Promise.all(enriquecer.map(function(n){
        if(n.imagem || !n.link) return Promise.resolve(n);
        return ogImage(n.link).then(function(img){ n.imagem=img; return n; });
      })).then(function(){
        var out = { fonte:'Agregador de manchetes (RSS oficiais + og:image)', total: todas.length, manchetes: man, judiciario: judTop, atualizadoEm:new Date().toISOString() };
        cacheSet('manchetes_v2', out, 600000); res.json(out);
      });
    });
  });
}

module.exports.REG_FEEDS = REG_FEEDS;
module.exports.registrarReguladores = registrarReguladores;
