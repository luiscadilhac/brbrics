// BrBRICS - Service Worker (network-first: dados sempre frescos; cache so para offline)
var CACHE_NAME = 'brbrics-v22';
var CORE = ['/index.html','/tribunais.html','/reguladores.html','/manchetes.html','/areas.html','/legislacao.html','/licitacoes.html','/proposicoes.html','/indicadores.html','/edicao.html','/sobre.html','/busca.html','/diretorios.html','/territorio.html','/clima.html','/contas.html','/energia.html','/comex.html','/fipe.html','/agro.html','/style.css','/pro.css','/common.js','/app.js','/tribunais-page.js','/legislacao-page.js','/areas.js','/logo-brics.png','/favicon.png','/manifest.json','/painel.html'];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(function(c){ return c.addAll(CORE); }).catch(function(){}));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CACHE_NAME) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING'){ self.skipWaiting(); }
});
self.addEventListener('fetch', function(e){
  var req = e.request;
  var url = new URL(req.url);
  // API: sempre da rede (dados vivos); fallback JSON amigavel se offline
  if(url.pathname.indexOf('/api/')===0){
    e.respondWith(fetch(req).catch(function(){
      return new Response(JSON.stringify({ erro: 'offline', aviso: 'Sem conexao. Dados podem estar desatualizados.' }), { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }
  // Navegacao (clique em links): REDE PRIMEIRO -> sempre versao nova; cache so como fallback offline
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(r){
        var cp = r.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put(req, cp); });
        return r;
      }).catch(function(){
        return caches.match(req).then(function(h){ return h || caches.match('/index.html'); });
      })
    );
    return;
  }
  // Estaticos (css/js/img): serve do cache e atualiza em segundo plano (rapido + fresco)
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(r){
        if(r && r.ok){ var cp = r.clone(); caches.open(CACHE_NAME).then(function(c){ c.put(req, cp); }); }
        return r;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});

