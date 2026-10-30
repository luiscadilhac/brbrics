// BrBRICS - modulo Contas públicas: Tesouro SICONFI (sem chave) + CGU Transparência (token gratuito)
var fetch=null; try{fetch=require('node-fetch');}catch(e){}
function fetchJSON(url, headers, timeout){
  timeout=timeout||25000;
  var ctrl=new AbortController(); var timer=setTimeout(function(){ctrl.abort();},timeout);
  return fetch(url,{signal:ctrl.signal, headers:headers||{'Accept':'application/json','User-Agent':'BrBRICS/1.0'}})
    .then(function(r){return r.text().then(function(t){return {status:r.status, text:t};});})
    .then(function(x){try{return {status:x.status, data:JSON.parse(x.text)};}catch(e){return {status:x.status, data:x.text};}})
    .finally(function(){clearTimeout(timer);});
}
function registrarContas(app, cacheGet, cacheSet, getJSON){
  var SIC='https://apidatalake.tesouro.gov.br/ords/siconfi/tt';
  function siconfi(path,q){
    var url=SIC+path+'?'+Object.keys(q).filter(function(k){return q[k]!==''&&q[k]!=null;})
      .map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(q[k]);}).join('&');
    return getJSON(url,{},30000);
  }
  function normSiconfi(r,demonstrativo){
    var items=(r.data&&r.data.items)||[];
    return {fonte:'Tesouro Nacional / SICONFI', demonstrativo:demonstrativo,
      total:(r.data&&r.data.count!=null)?r.data.count:items.length,
      continua:!!(r.data&&r.data.hasMore), dados:items.slice(0,300)};
  }
  // RREO: /api/contas/rreo?ente=35&ano=2024&periodo=6&anexo=RREO-Anexo 01&esfera=E
  app.get('/api/contas/rreo', function(req,res){
    var ente=String(req.query.ente||'').replace(/\D/g,'');
    var ano=String(req.query.ano||new Date().getFullYear()).replace(/\D/g,'');
    var per=String(req.query.periodo||'6').replace(/\D/g,'');
    var anexo=String(req.query.anexo||'RREO-Anexo 01');
    if(!ente) return res.status(400).json({erro:'Informe ente (código IBGE da UF ou município).'});
    var ck='ct_rreo_'+ente+'_'+ano+'_'+per+'_'+anexo; var hit=cacheGet(ck); if(hit) return res.json(hit);
    var q={an_exercicio:ano, nr_periodo:per, co_tipo_demonstrativo:'RREO', no_anexo:anexo, id_ente:ente};
    if(req.query.esfera) q.co_esfera=String(req.query.esfera);
    siconfi('/rreo',q).then(function(r){
      var out=normSiconfi(r,'RREO'); cacheSet(ck,out,6*3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'SICONFI indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
  // RGF: /api/contas/rgf?ente=35&ano=2024&periodo=3&anexo=RGF-Anexo 01&poder=E
  app.get('/api/contas/rgf', function(req,res){
    var ente=String(req.query.ente||'').replace(/\D/g,'');
    var ano=String(req.query.ano||new Date().getFullYear()).replace(/\D/g,'');
    var per=String(req.query.periodo||'3').replace(/\D/g,'');
    var anexo=String(req.query.anexo||'RGF-Anexo 01');
    if(!ente) return res.status(400).json({erro:'Informe ente (código IBGE da UF ou município).'});
    var ck='ct_rgf_'+ente+'_'+ano+'_'+per+'_'+anexo; var hit=cacheGet(ck); if(hit) return res.json(hit);
    var q={an_exercicio:ano, nr_periodo:per, co_tipo_demonstrativo:'RGF', no_anexo:anexo, id_ente:ente};
    if(req.query.esfera) q.co_esfera=String(req.query.esfera);
    if(req.query.poder) q.co_poder=String(req.query.poder);
    siconfi('/rgf',q).then(function(r){
      var out=normSiconfi(r,'RGF'); cacheSet(ck,out,6*3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'SICONFI indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
}
module.exports={registrarContas:registrarContas};
