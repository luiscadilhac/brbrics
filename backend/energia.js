// BrBRICS - modulo Energia: ANEEL via CKAN (bandeiras + SIGA geração por fonte)
var CKAN='https://dadosabertos.aneel.gov.br';
var DIA=86400000;
function parseCSV(t){
  var delim=(function(){var h=String(t||'').split(/\r?\n/)[0]||'';var sc=(h.match(/;/g)||[]).length,cc=(h.match(/,/g)||[]).length;return sc>=cc?';':',';})();
  var rows=[],row=[],cur='',q=false;
  var s=String(t||'');
  for(var i=0;i<s.length;i++){
    var c=s[i];
    if(q){ if(c==='"'){ if(s[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else if(c==='"'){q=true;}
    else if(c===delim){row.push(cur);cur='';}
    else if(c==='\n'||c==='\r'){ if(c==='\r'&&s[i+1]==='\n')i++; row.push(cur);cur=''; if(row.length>1||row[0]!=='')rows.push(row); row=[]; }
    else cur+=c;
  }
  if(cur!==''||row.length){row.push(cur);rows.push(row);}
  return rows;
}
function numBR(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n;}
function registrarEnergia(app, cacheGet, cacheSet, getJSON){
  function pkg(slug){
    return getJSON(CKAN+'/api/action/package_show?id='+encodeURIComponent(slug),{},30000).then(function(r){return r.data&&r.data.result;});
  }
  function csvRes(p){
    var rs=((p||{}).resources)||[];
    for(var i=0;i<rs.length;i++){if(String(rs[i].format||'').toUpperCase()==='CSV'&&rs[i].url)return rs[i];}
    return null;
  }
  // Bandeira tarifária vigente: /api/energia/bandeiras
  app.get('/api/energia/bandeiras', function(req,res){
    var hit=cacheGet('en_band'); if(hit) return res.json(hit);
    pkg('bandeiras-tarifarias').then(function(p){
      var r=csvRes(p); if(!r) throw new Error('recurso CSV não encontrado');
      return getJSON(r.url,{},60000).then(function(t){
        var rows=parseCSV(typeof t.data==='string'?t.data:'');
        if(rows.length<2) throw new Error('CSV vazio');
        var head=rows[0].map(function(h){return String(h||'').toLowerCase();});
        function col(){
          for(var a=0;a<arguments.length;a++){for(var i=0;i<head.length;i++){if(head[i].indexOf(arguments[a])>=0)return i;}}
          return -1;
        }
        var iData=col('compet','mes','data','ano'); if(iData<0)iData=0;
        var hist=rows.slice(1).map(function(rr){
          var o={}; head.forEach(function(h,i){o[h]=rr[i];}); return o;
        }).slice(-12);
        var out={fonte:'ANEEL - Bandeiras Tarifárias', atual:hist[hist.length-1]||null, historico:hist};
        cacheSet('en_band',out,DIA); res.json(out);
      });
    }).catch(function(e){res.status(502).json({erro:'ANEEL indisponível', detalhe:String((e&&e.message)||e).slice(0,200), portal:'https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias'});});
  });
  // Geração por fonte (SIGA): /api/energia/siga
  app.get('/api/energia/siga', function(req,res){
    var hit=cacheGet('en_siga'); if(hit) return res.json(hit);
    getJSON(CKAN+'/api/action/package_search?q=SIGA',{},30000).then(function(s){
      var rs=(s.data&&s.data.result&&s.data.result.results)||[];
      if(!rs.length) throw new Error('conjunto SIGA não encontrado');
      return pkg(rs[0].name||rs[0].id);
    }).then(function(p){
      var r=csvRes(p); if(!r) throw new Error('recurso CSV não encontrado');
      return getJSON(r.url,{},90000).then(function(t){
        var rows=parseCSV(typeof t.data==='string'?t.data:'');
        if(rows.length<2) throw new Error('CSV vazio');
        var head=rows[0].map(function(h){return String(h||'').toLowerCase();});
        var iF=-1,iP=-1;
        for(var i=0;i<head.length;i++){
          if(iF<0&&(head[i].indexOf('fonte')>=0))iF=i;
          if(iP<0&&(head[i].indexOf('pot')>=0||head[i].indexOf('kw')>=0||head[i].indexOf('mw')>=0))iP=i;
        }
        if(iF<0||iP<0) throw new Error('colunas de fonte/potência não identificadas');
        var kwHead=String(head[iP]||'').replace(/[^a-z]/g,'');
        var div=(kwHead.indexOf('mw')>=0&&kwHead.indexOf('kw')<0)?1:((kwHead.indexOf('w')>=0&&kwHead.indexOf('kw')<0&&kwHead.indexOf('mw')<0)?1000000:1000);
        var map={};
        for(var k=1;k<rows.length;k++){
          var f=String(rows[k][iF]||'').trim()||'Outras';
          var v=numBR(rows[k][iP])||0;
          map[f]=(map[f]||0)+v;
        }
        var fontes=Object.keys(map).map(function(f){return {fonte:f, mw:Math.round(map[f]/div*100)/100};});
        fontes.sort(function(a,b){return b.mw-a.mw;});
        var totalMW=fontes.reduce(function(a,b){return a+b.mw;},0)||1;
        fontes.forEach(function(f){f.pct=Math.round(f.mw/totalMW*1000)/10;});
        var out={fonte:'ANEEL - SIGA (capacidade instalada)', usinas:rows.length-1, totalMW:Math.round(totalMW*100)/100, unidade:'MW', fontes:fontes.slice(0,15)};
        cacheSet('en_siga',out,DIA); res.json(out);
      });
    }).catch(function(e){res.status(502).json({erro:'ANEEL indisponível', detalhe:String((e&&e.message)||e).slice(0,200), portal:'https://dadosabertos.aneel.gov.br/'});});
  });
  app.get('/api/energia/resumo', function(req,res){
    var hit=cacheGet('en_res'); if(hit) return res.json(hit);
    var base='http://localhost:'+(process.env.PORT||3000);
    Promise.allSettled([getJSON(base+'/api/energia/bandeiras',{},60000),getJSON(base+'/api/energia/siga',{},90000)]).then(function(rs){
      var out={bandeiras:rs[0].status==='fulfilled'?rs[0].value.data:null,
        siga:rs[1].status==='fulfilled'?rs[1].value.data:null, atualizadoEm:new Date().toISOString()};
      cacheSet('en_res',out,DIA); res.json(out);
    });
  });
}
module.exports={registrarEnergia:registrarEnergia};
