// BrBRICS - modulo Comércio exterior: API oficial ComexStat/MDIC (sem chave)
var fetch=null; try{fetch=require('node-fetch');}catch(e){}
var BASE='https://api-comexstat.mdic.gov.br';
var DIA=86400000;
function postComex(path, body){
  var ctrl=new AbortController(); var timer=setTimeout(function(){ctrl.abort();},30000);
  return fetch(BASE+path+'?language=pt',{method:'POST',signal:ctrl.signal,
    headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'BrBRICS/1.0'},
    body:JSON.stringify(body)})
    .then(function(r){return r.text().then(function(t){return {status:r.status,text:t};});})
    .then(function(x){try{return {status:x.status,data:JSON.parse(x.text)};}catch(e){return {status:x.status,data:x.text};}})
    .finally(function(){clearTimeout(timer);});
}
function getComex(path, getJSON){
  return getJSON(BASE+path+'?language=pt',{},30000);
}
function linhasDe(j){
  if(Array.isArray(j))return j;
  if(!j||typeof j!=='object')return [];
  var cands=[j.data,j.result,j.rows,j.items,j.registros];
  for(var i=0;i<cands.length;i++){if(Array.isArray(cands[i]))return cands[i];}
  if(j.data&&typeof j.data==='object'){var d2=[j.data.list,j.data.data,j.data.result,j.data.rows];for(var k=0;k<d2.length;k++){if(Array.isArray(d2[k]))return d2[k];}}
  return [];
}
function esperar(ms){return new Promise(function(r){setTimeout(r,ms);});}
// ComexStat atende devagar e limita o ritmo. O navegador nunca espera mais que
// LIMITE: ao estourar, devolve aviso honesto e marca falha em cache curto (NEGATIVO_TTL)
// para nao martelar a origem a cada clique. Se a origem responder depois, o dado bom
// entra no cache de 1 dia e a proxima visita ja ve o resultado real.
var LIMITE=18000; var NEGATIVO_TTL=120000;
function respostaPrazo(promise, fallback, cacheia, res){
  var respondido=false;
  var t=setTimeout(function(){
    if(respondido) return; respondido=true;
    var f=fallback(); cacheia(f, true); res.json(f);
  }, LIMITE);
  promise.then(function(v){
    if(!respondido){ respondido=true; clearTimeout(t); cacheia(v, false); res.json(v); }
    else if(v) cacheia(v, false);
  }).catch(function(e){
    if(!respondido){ respondido=true; clearTimeout(t); var f=fallback(); cacheia(f, true); res.json(f); }
  });
}
function fluxoRobusto(body, tent){
  tent=tent||0;
  function tenta(){
    return postComex('/general',body).then(function(r){
      if(linhasDe(r.data).length) return r;
      if(tent>=2) return r;
      return esperar(8000).then(function(){return fluxoRobusto(body,tent+1);});
    }).catch(function(e){
      if(tent>=2) return {error:String((e&&e.message)||e)};
      return esperar(8000).then(function(){return fluxoRobusto(body,tent+1);});
    });
  }
  return tenta();
}
function campo(r, nomes){
  var keys=Object.keys(r||{});
  for(var i=0;i<nomes.length;i++){
    for(var k=0;k<keys.length;k++){if(keys[k].toLowerCase()===nomes[i].toLowerCase()&&r[keys[k]]!=null)return r[keys[k]];}
  }
  return null;
}
function numBR(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isNaN(n)?0:n;}
function agrega(rows, rotuloKeys, valorKeys){
  var map={};
  rows.forEach(function(r){
    var rot=String(campo(r,rotuloKeys)||'—');
    var v=numBR(campo(r,valorKeys));
    map[rot]=(map[rot]||0)+v;
  });
  return Object.keys(map).map(function(k){return {rotulo:k, valor:Math.round(map[k])};})
    .sort(function(a,b){return b.valor-a.valor;});
}
function registrarComex(app, cacheGet, cacheSet, getJSON){
  // Metadados rápidos (anos + última atualização)
  app.get('/api/comex/meta', function(req,res){
    var hit=cacheGet('cx_meta'); if(hit) return res.json(hit);
    Promise.allSettled([getComex('/general/dates/years',getJSON),getComex('/general/dates/updated',getJSON)]).then(function(rs){
      var out={fonte:'MDIC / ComexStat',
        anos:rs[0].status==='fulfilled'?rs[0].value.data:null,
        atualizadoEm:rs[1].status==='fulfilled'?rs[1].value.data:null};
      cacheSet('cx_meta',out,DIA); res.json(out);
    });
  });
  // Balança por UF: /api/comex/resumo?ano=2025
  app.get('/api/comex/resumo', function(req,res){
    var ano=String(req.query.ano||new Date().getFullYear()).replace(/\D/g,'')||String(new Date().getFullYear());
    var ck='cx_res_'+ano; var hit=cacheGet(ck); if(hit) return res.json(hit);
    function corpo(f){ return {flow:f, monthDetail:false,
      period:{from:ano+'-01', to:ano+'-12'}, details:['state'], metrics:['metricFOB']}; }
    function tot(a){return a.reduce(function(s,x){return s+x.valor;},0);}
    // sequencial com intervalo (a API limita o ritmo)
    var tarefa=fluxoRobusto(corpo('export')).then(function(rE){
      return esperar(3000).then(function(){
        return fluxoRobusto(corpo('import')).then(function(rI){ return [rE,rI]; });
      });
    }).then(function(rs){
      var ex=linhasDe(rs[0].data), im=linhasDe(rs[1].data);
      var porUFex=agrega(ex,['state','uf','sgUF','noUF'],['metricFOB','fob','FOB','valorFob','value']);
      var porUFim=agrega(im,['state','uf','sgUF','noUF'],['metricFOB','fob','FOB','valorFob','value']);
      var tE=tot(porUFex), tI=tot(porUFim);
      var mapa={};
      porUFex.forEach(function(x){mapa[x.rotulo]=mapa[x.rotulo]||{uf:x.rotulo,exp:0,imp:0};mapa[x.rotulo].exp=x.valor;});
      porUFim.forEach(function(x){mapa[x.rotulo]=mapa[x.rotulo]||{uf:x.rotulo,exp:0,imp:0};mapa[x.rotulo].imp=x.valor;});
      var ufs=Object.keys(mapa).map(function(k){var o=mapa[k];o.saldo=o.exp-o.imp;o.mov=o.exp+o.imp;return o;})
        .sort(function(a,b){return b.mov-a.mov;});
      return {fonte:'MDIC / ComexStat', ano:ano, exportTotal:tE, importTotal:tI, saldo:tE-tI,
        ufs:ufs.slice(0,15),
        aviso:(!ex.length&&!im.length)?'ComexStat limitou o ritmo (tente de novo em 1 minuto) — doc em api-comexstat.mdic.gov.br/docs':null,
        atualizadoEm:new Date().toISOString()};
    });
    function semResposta(){ return {fonte:'MDIC / ComexStat', ano:ano, exportTotal:0, importTotal:0, saldo:0, ufs:[],
      aviso:'A base ComexStat não respondeu dentro do prazo (ela fila os pedidos). Nova consulta automática em instantes — doc em api-comexstat.mdic.gov.br/docs.',
      atualizadoEm:new Date().toISOString()}; }
    function guarda(v, falhou){ cacheSet(ck, v, (!falhou && (v.exportTotal||v.importTotal)) ? DIA : NEGATIVO_TTL); }
    respostaPrazo(tarefa, semResposta, guarda, res);
  });
  // Top parceiros: /api/comex/parceiros?ano=2025&fluxo=export
  app.get('/api/comex/parceiros', function(req,res){
    var ano=String(req.query.ano||new Date().getFullYear()).replace(/\D/g,'')||String(new Date().getFullYear());
    var fluxo=(String(req.query.fluxo||'export').toLowerCase()==='import')?'import':'export';
    var ck='cx_par_'+ano+'_'+fluxo; var hit=cacheGet(ck); if(hit) return res.json(hit);
    var tarefa=fluxoRobusto({flow:fluxo, monthDetail:false,
      period:{from:ano+'-01', to:ano+'-12'}, details:['country'], metrics:['metricFOB']}).then(function(r){
      var rows=linhasDe(r.data||(r&&r.data));
      var pars=agrega(rows,['country','pais','noPais','partner'],['metricFOB','fob','FOB','valorFob','value']);
      return {fonte:'MDIC / ComexStat', ano:ano, fluxo:fluxo, parceiros:pars.slice(0,15),
        aviso:pars.length?null:'ComexStat limitou o ritmo (tente de novo em 1 minuto) — doc em api-comexstat.mdic.gov.br/docs.',
        atualizadoEm:new Date().toISOString()};
    });
    function semResposta(){ return {fonte:'MDIC / ComexStat', ano:ano, fluxo:fluxo, parceiros:[],
      aviso:'A base ComexStat não respondeu dentro do prazo (ela fila os pedidos). Nova consulta automática em instantes.',
      atualizadoEm:new Date().toISOString()}; }
    function guarda(v, falhou){ cacheSet(ck, v, (!falhou && (v.parceiros||[]).length) ? DIA : NEGATIVO_TTL); }
    respostaPrazo(tarefa, semResposta, guarda, res);
  });
}
module.exports={registrarComex:registrarComex};
