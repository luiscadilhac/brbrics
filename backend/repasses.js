// BrBRICS - modulo Repasses: Portal da Transparência (repasses federais)
function registrarRepasses(app, cacheGet, cacheSet, getJSON){
  // Repasses federais - dados do Portal da Transparência / dados.gov.br
  app.get('/api/repasses', function(req, res){
    var ano = String(req.query.ano || new Date().getFullYear()).replace(/\D/g,'');
    var uf = String(req.query.uf || '').toUpperCase();
    var municipio = String(req.query.municipio || '').toUpperCase();
    var ck = 'repasses_'+ano+'_'+uf+'_'+municipio;
    var hit = cacheGet(ck); if(hit) return res.json(hit);

    // Portal da Transparência - repasses federais
    var url = 'https://dados.gov.br/api/3/action/package_show?id=repasses-federais';
    getJSON(url).then(function(pkg){
      var resources = (pkg.data && pkg.data.result && pkg.data.result.resources) || [];
      var csvUrl = null;
      for(var i=0;i<resources.length;i++){
        if(String(resources[i].format||'').toUpperCase()==='CSV' && resources[i].url){
          csvUrl = resources[i].url; break;
        }
      }
      if(!csvUrl) throw new Error('CSV de repasses nao encontrado no pacote dados.gov.br');

      return fetch(csvUrl, {headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){return r.text();}).then(function(t){
        var rows = parseCSV(t);
        if(rows.length<2) return res.json({fonte:'Portal da Transparência / dados.gov.br', total:0, repasses:[]});
        var head = rows[0].map(function(h){return String(h||'').toLowerCase();});
        function col(n){ for(var i=0;i<head.length;i++) if(head[i]===n) return i; return -1; }

        var iAno = col('ano'); var iUf = col('uf'); var iMun = col('municipio');
        var iValor = col('valor'); var iFonte = col('fonte_recurso'); var iPrograma = col('programa');
        var out = [];
        for(var i=1;i<rows.length;i++){
          var r = rows[i];
          var rAno = String(r[iAno]||'').replace(/\D/g,'');
          if(ano && rAno!==ano) continue;
          var rUf = String(r[iUf]||'').toUpperCase();
          if(uf && rUf!==uf) continue;
          var rMun = String(r[iMun]||'').toUpperCase();
          if(municipio && rMun.indexOf(municipio)===-1) continue;
          out.push({
            ano: rAno, uf: rUf, municipio: r[iMun]||'',
            programa: r[iPrograma]||'', fonte_recurso: r[iFonte]||'',
            valor: parseBR(r[iValor])
          });
        }
        var result = {fonte:'Portal da Transparência / dados.gov.br', total:out.length, repasses:out.slice(0,500), atualizadoEm:new Date().toISOString()};
        cacheSet(ck, result, 3600000);
        res.json(result);
      });
    }).catch(function(e){
      res.status(502).json({erro:'Repasses indisponível no momento', detalhe:String((e&&e.message)||e).slice(0,160), fonte:'Portal da Transparência / dados.gov.br', linkOficial:'https://portaldatransparencia.gov.br/download-de-dados/transferencias', repasses:[]});
    });
  });

  // Ranking de municípios por repasses
  app.get('/api/repasses/ranking', function(req, res){
    var ano = String(req.query.ano || new Date().getFullYear()).replace(/\D/g,'');
    var uf = String(req.query.uf || '').toUpperCase();
    var limit = Math.min(parseInt(req.query.limit||'20',10)||20, 100);
    var ck = 'repasses_rank_'+ano+'_'+uf+'_'+limit;
    var hit = cacheGet(ck); if(hit) return res.json(hit);

    getJSON('https://dados.gov.br/api/3/action/package_show?id=repasses-federais').then(function(pkg){
      var resources = (pkg.data && pkg.data.result && pkg.data.result.resources) || [];
      var csvUrl = null;
      for(var i=0;i<resources.length;i++){
        if(String(resources[i].format||'').toUpperCase()==='CSV' && resources[i].url){
          csvUrl = resources[i].url; break;
        }
      }
      if(!csvUrl) throw new Error('CSV nao encontrado');
      return fetch(csvUrl, {headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){return r.text();}).then(function(t){
        var rows = parseCSV(t);
        var head = rows[0].map(function(h){return String(h||'').toLowerCase();});
        function col(n){ for(var i=0;i<head.length;i++) if(head[i]===n) return i; return -1; }
        var iAno = col('ano'); var iUf = col('uf'); var iMun = col('municipio'); var iValor = col('valor');
        var agg = {};
        for(var i=1;i<rows.length;i++){
          var r = rows[i];
          var rAno = String(r[iAno]||'').replace(/\D/g,'');
          if(ano && rAno!==ano) continue;
          var rUf = String(r[iUf]||'').toUpperCase();
          if(uf && rUf!==uf) continue;
          var key = rUf+'|'+(r[iMun]||'').toUpperCase();
          var v = parseBR(r[iValor]);
          if(!agg[key]) agg[key] = {uf:rUf, municipio:r[iMun]||'', total:0};
          agg[key].total += v;
        }
        var ranking = Object.values(agg).sort(function(a,b){return b.total-a.total;}).slice(0,limit);
        var result = {fonte:'Portal da Transparência / dados.gov.br', ano:ano, uf:uf||'BRASIL', total:ranking.length, ranking:ranking, atualizadoEm:new Date().toISOString()};
        cacheSet(ck, result, 3600000);
        res.json(result);
      });
    }).catch(function(e){
      res.status(502).json({erro:'Repasses indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});
    });
  });

  function parseCSV(t){
    var delim = (function(){ var h=String(t||'').split(/\r?\n/)[0]||''; var sc=(h.match(/;/g)||[]).length, cc=(h.match(/,/g)||[]).length; return sc>=cc?';':','; })();
    var rows=[], row=[], cur='', q=false;
    var s=String(t||'');
    for(var i=0;i<s.length;i++){
      var c=s[i];
      if(q){ if(c==='"'){ if(s[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
      else if(c==='"'){ q=true; }
      else if(c===delim){ row.push(cur); cur=''; }
      else if(c==='\n'||c==='\r'){ if(c==='\r'&&s[i+1]==='\n')i++; row.push(cur); cur=''; if(row.length>1||row[0]!=='') rows.push(row); row=[]; }
      else cur+=c;
    }
    if(cur!==''||row.length){ row.push(cur); rows.push(row); }
    return rows;
  }
  function parseBR(v){ var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; }
}
module.exports = { registrarRepasses: registrarRepasses };