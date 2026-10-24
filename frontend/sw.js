// BrBRICS - Service Worker (rede primeiro em tudo; cache so como fallback offline)
// iOS Safari: sem skipWaiting/clients.claim para evitar travamento
var CACHE_NAME = 'brbrics-v45';
var CORE = ['/index.html','/tribunais.html','/reguladores.html','/manchetes.html','/areas.html','/legislacao.html','/licitacoes.html','/proposicoes.html','/indicadores.html','/edicao.html','/sobre.html','/busca.html','/diretorios.html','/territorio.html','/clima.html','/contas.html','/energia.html','/comex.html','/fipe.html','/agro.html','/style.css?v=33','/pro.css?v=33','/common.js?v=33','/app.js?v=33','/tribunais-page.js?v=33','/legislacao-page.js?v=33','/areas.js?v=33','/logo-brics.png','/favicon.ico','/favicon.png','/manifest.json'];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE_NAME).then(function(c){
    return Promise.all(CORE.map(function(u){
      return fetch(u).then(function(r){ if(r && r.ok) return c.put(u, r); }).catch(function(){});
    }));
  }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CACHE_NAME) return caches.delete(k); }));
  }));
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
        return r;      }).catch(function(){
        return caches.match(req).then(function(h){ return h || caches.match('/index.html'); });      })    );
    return;
  }
  // Estaticos (css/js/img): REDE PRIMEIRO.
  e.respondWith(
    fetch(req).then(function(r){
      if(r && r.ok){ var cp = r.clone(); caches.open(CACHE_NAME).then(function(c){ c.put(req, cp); }); }
      return r;    }).catch(function(){ return caches.match(req); })  );
});
