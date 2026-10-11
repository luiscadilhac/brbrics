// BrBRICS - modulo Comércio exterior: API oficial ComexStat/MDIC (sem chave)
var fetch=null; try{fetch=require('node-fetch');}catch(e){}
var BASE='https://api-comexstat.mdic.gov.br';
var DIA=86400000;
function postComex(path, body){
  var ctrl=new AbortController(); var timer=setTimeout(function(){ctrl.abort();},60000);
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
function fluxoRobusto(body, tent){
  tent=tent||0;
  function tenta(){
    return postComex('/general',body).then(function(r){
      if(linhasDe(r.data).length) return r;
      if(tent>=2) return r;
      return esperar(15000).then(function(){return fluxoRobusto(body,tent+1);});
    }).catch(function(e){
      if(tent>=2) return {error:String((e&&e.message)||e)};
      return esperar(15000).then(function(){return fluxoRobusto(body,tent+1);});
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
    function fluxo(f){
      return postComex('/general',{flow:f, monthDetail:false,
        period:{from:ano+'-01', to:ano+'-12'}, details:['state'], metrics:['metricFOB']});
    }
    // sequencial com intervalo (a API limita o ritmo); só cacheia com dados
    fluxoRobusto({flow:'export', monthDetail:false,
      period:{from:ano+'-01', to:ano+'-12'}, details:['state'], metrics:['metricFOB']}).then(function(rE){
      return esperar(5000).then(function(){
        return fluxoRobusto({flow:'import', monthDetail:false,
          period:{from:ano+'-01', to:ano+'-12'}, details:['state'], metrics:['metricFOB']}).then(function(rI){return [rE,rI];});
      });
    }).then(function(rs){
      var ex=linhasDe(rs[0].data), im=linhasDe(rs[1].data);
      var porUFex=agrega(ex,['state','uf','sgUF','noUF'],['metricFOB','fob','FOB','valorFob','value']);
      var porUFim=agrega(im,['state','uf','sgUF','noUF'],['metricFOB','fob','FOB','valorFob','value']);
      function tot(a){return a.reduce(function(s,x){return s+x.valor;},0);}
      var tE=tot(porUFex), tI=tot(porUFim);
      var mapa={};
      porUFex.forEach(function(x){mapa[x.rotulo]=mapa[x.rotulo]||{uf:x.rotulo,exp:0,imp:0};mapa[x.rotulo].exp=x.valor;});
      porUFim.forEach(function(x){mapa[x.rotulo]=mapa[x.rotulo]||{uf:x.rotulo,exp:0,imp:0};mapa[x.rotulo].imp=x.valor;});
      var ufs=Object.keys(mapa).map(function(k){var o=mapa[k];o.saldo=o.exp-o.imp;o.mov=o.exp+o.imp;return o;})
        .sort(function(a,b){return b.mov-a.mov;});
      var out={fonte:'MDIC / ComexStat', ano:ano, exportTotal:tE, importTotal:tI, saldo:tE-tI,
        ufs:ufs.slice(0,15),
        aviso:(!ex.length&&!im.length)?'ComexStat limitou o ritmo (tente de novo em 1 minuto) — doc em api-comexstat.mdic.gov.br/docs':null};
      if(tE||tI) cacheSet(ck,out,DIA); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'ComexStat indisponível', detalhe:String((e&&e.message)||e).slice(0,200), doc:'https://api-comexstat.mdic.gov.br/docs'});});
  });
  // Top parceiros: /api/comex/parceiros?ano=2025&fluxo=export
  app.get('/api/comex/parceiros', function(req,res){
    var ano=String(req.query.ano||new Date().getFullYear()).replace(/\D/g,'')||String(new Date().getFullYear());
    var fluxo=(String(req.query.fluxo||'export').toLowerCase()==='import')?'import':'export';
    var ck='cx_par_'+ano+'_'+fluxo; var hit=cacheGet(ck); if(hit) return res.json(hit);
    fluxoRobusto({flow:fluxo, monthDetail:false,
      period:{from:ano+'-01', to:ano+'-12'}, details:['country'], metrics:['metricFOB']}).then(function(r){
      var rows=linhasDe(r.data||(r&&r.data));
      var pars=agrega(rows,['country','pais','noPais','partner'],['metricFOB','fob','FOB','valorFob','value']);
      var out={fonte:'MDIC / ComexStat', ano:ano, fluxo:fluxo, parceiros:pars.slice(0,15)};
      if(pars.length) cacheSet(ck,out,DIA); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'ComexStat indisponível', detalhe:String((e&&e.message)||e).slice(0,200)});});
  });
}
module.exports={registrarComex:registrarComex};
