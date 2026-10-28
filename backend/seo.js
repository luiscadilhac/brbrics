// BrBRICS - modulo SEO: robots.txt + sitemap.xml + RSS geral (sem chave)
var PAGINAS=[
  ['/','daily'],['/index.html','daily'],['/manchetes.html','daily'],['/edicao.html','weekly'],
  ['/licitacoes.html','daily'],['/proposicoes.html','daily'],['/legislacao.html','weekly'],
  ['/indicadores.html','daily'],['/tribunais.html','weekly'],['/reguladores.html','daily'],
  ['/busca.html','weekly'],['/diretorios.html','monthly'],['/sobre.html','monthly'],
  ['/areas.html','weekly'],['/territorio.html','weekly'],['/clima.html','daily'],
  ['/contas.html','weekly'],['/energia.html','weekly'],['/comex.html','weekly'],
  ['/fipe.html','monthly'],['/agro.html','weekly'],['/painel.html','monthly'],
  ['/contato.html','monthly'],['/privacidade.html','monthly'],['/mapas.html','weekly'],
  ['/rss.html','daily'],['/calendario.html','monthly']
];
function escX(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
// Host canonico do portal. Sitemap, robots e RSS nao podem sair no host da
// requisicao: o site vai servir em www e na raiz ao mesmo tempo, e cada um
// gerar seu proprio sitemap duplica o conteudo aos olhos do Google.
function base(req){
  var host = req.get('host') || '';
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return req.protocol + '://' + host;
  return (process.env.SITE_URL || 'https://brbrics.com.br').replace(/\/+$/, '');
}
function interno(path){
  return new Promise(function(resolve){
    var http=require('http');var PORT=process.env.PORT||3000;
    try{
      var rq=http.get({host:'127.0.0.1',port:PORT,path:path,headers:{'Accept':'application/json'}},function(rs){
        var b='';rs.on('data',function(c){b+=c;});rs.on('end',function(){try{resolve(JSON.parse(b));}catch(e){resolve(null);}});
      });
      rq.on('error',function(){resolve(null);});rq.setTimeout(30000,function(){try{rq.destroy();}catch(e){}resolve(null);});
    }catch(e){resolve(null);}
  });
}
function dataRFC(d){
  try{
    var t=new Date(d);
    if(isNaN(t)){
      var m=String(d||'').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
      if(m)t=new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),+(m[6]||0));
    }
    if(isNaN(t))return '';
    return t.toUTCString();
  }catch(e){return '';}
}
function tituloRuim(t){
  t=String(t||'').trim();
  if(t.length<8)return true;
  return /\.(png|jpe?g|gif|svg|webp|pdf|mp4)$/i.test(t);
}
// HSTS: força HTTPS no navegador (evita downgrade e melhora segurança no iOS)
function hstsMiddleware(req, res, next) {
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
}
// www, o endereco provisorio do Render e a raiz sao o mesmo portal: um unico host
// canonico, para o site nao ficar indexado em tres enderecos diferentes.
function hostOficial(req, res, next) {
  var h = req.get('host') || '';
  if (h === 'www.brbrics.com.br' || h === 'brbrics.onrender.com') {
    return res.redirect(301, 'https://brbrics.com.br' + (req.originalUrl || '/'));
  }
  next();
}
// Estes dois precisam rodar ANTES do express.static, senao o arquivo servido na
// linha de cima encerra a resposta e nenhum header/redirect chega na pagina.
function aplicarCabecalhos(app) {
  app.use(hstsMiddleware);
  app.use(hostOficial);
}
function registrarSEO(app, cacheGet, cacheSet){
  app.get('/robots.txt', function(req,res){
    res.set('Content-Type','text/plain');
    res.send('User-agent: *\nAllow: /\nSitemap: '+base(req)+'/sitemap.xml\n');
  });
  app.get('/sitemap.xml', function(req,res){
    var b=base(req), hoje=new Date().toISOString().slice(0,10);
    var xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      +PAGINAS.map(function(p){return '  <url><loc>'+b+p[0]+'</loc><lastmod>'+hoje+'</lastmod><changefreq>'+p[1]+'</changefreq></url>';}).join('\n')
      +'\n</urlset>';
    res.set('Content-Type','application/xml'); res.send(xml);
  });
  function rss(req,res){
    var hit=cacheGet('rss_geral'); if(hit){res.set('Content-Type','application/rss+xml');return res.send(hit);}
    Promise.all([interno('/api/manchetes'),interno('/api/ibge/noticias?qtd=15')]).then(function(rs){
      var itens=[];
      var man=rs[0]||{};
      (man.manchetes||[]).forEach(function(n){itens.push({titulo:n.titulo,link:n.link,data:n.data,resumo:n.resumo,img:n.imagem,fonte:n.fonteNome||n.fonte});});
      (man.judiciario||[]).forEach(function(n){itens.push({titulo:n.titulo,link:n.link,data:n.data,resumo:n.resumo,img:n.imagem,fonte:n.fonteNome||n.fonte});});
      ((rs[1]&&rs[1].noticias)||[]).forEach(function(n){itens.push({titulo:n.titulo,link:n.link,data:n.data,resumo:n.resumo,img:n.imagem,fonte:'IBGE'});});
      itens=itens.filter(function(x){return x.titulo&&x.link&&!tituloRuim(x.titulo);}).slice(0,60);
      function ts(d){try{var t=new Date(d);if(isNaN(t)){var m=String(d||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);if(m)t=new Date(+m[3],+m[2]-1,+m[1]);}return isNaN(t)?0:t.getTime();}catch(e){return 0;}}
      itens.sort(function(a,b){return ts(b.data)-ts(a.data);});
      var b=base(req);
      var xml='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n'
        +'<title>BrBRICS - Manchetes oficiais</title>\n<link>'+b+'/manchetes.html</link>\n'
        +'<description>Notícias oficiais de tribunais, reguladores e IBGE.</description>\n'
        +'<language>pt-BR</language>\n<lastBuildDate>'+new Date().toUTCString()+'</lastBuildDate>\n'
        +itens.slice(0,40).map(function(n){
          var enc=(n.img&&/^https?:\/\//i.test(n.img))?'\n<enclosure url="'+escX(n.img)+'" type="image/jpeg"/>':'';
          return '<item>\n<title>'+escX(n.titulo)+'</title>\n<link>'+escX(n.link)+'</link>\n'
            +'<description>'+escX(String(n.resumo||'').slice(0,300))+'</description>\n'
            +'<pubDate>'+dataRFC(n.data)+'</pubDate>\n<source>'+escX(n.fonte||'BrBRICS')+'</source>'+enc+'\n</item>';
        }).join('\n')
        +'\n</channel>\n</rss>';
      cacheSet('rss_geral',xml,15*60000);
      res.set('Content-Type','application/rss+xml'); res.send(xml);
    });
  }
  app.get('/rss.xml',rss);
  app.get('/feed',rss);
  // ads.txt: autoriza Google AdSense a exibir anúncios neste domínio.
  app.get('/ads.txt', function(req,res){
    res.set('Content-Type','text/plain; charset=utf-8');
    res.send('google.com, pub-9633564064128096, DIRECT, f08c47fec0942fa0\n');
  });
}
module.exports={registrarSEO:registrarSEO, aplicarCabecalhos:aplicarCabecalhos};
