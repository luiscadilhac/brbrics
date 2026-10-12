// BrBRICS - modulo Emendas: Portal da Transparência (emendas parlamentares)
function registrarEmendas(app, cacheGet, cacheSet, getJSON){
  // Emendas parlamentares - dados do Portal da Transparência / dados.gov.br
  app.get('/api/emendas', function(req, res){
    var ano = String(req.query.ano || new Date().getFullYear()).replace(/\D/g,'');
    var uf = String(req.query.uf || '').toUpperCase();
    var autor = String(req.query.autor || '').toUpperCase();
    var ck = 'emendas_'+ano+'_'+uf+'_'+autor;
    var hit = cacheGet(ck); if(hit) return res.json(hit);

    // Portal da Transparência - emendas parlamentares
    // https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares
    // O dataset está em dados.gov.br
    var url = 'https://dados.gov.br/api/3/action/package_show?id=emendas-parlamentares';
    getJSON(url).then(function(pkg){
      var resources = (pkg.data && pkg.data.result && pkg.data.result.resources) || [];
      var csvUrl = null;
      for(var i=0;i<resources.length;i++){
        if(String(resources[i].format||'').toUpperCase()==='CSV' && resources[i].url){
          csvUrl = resources[i].url; break;
        }
      }
      if(!csvUrl) throw new Error('CSV de emendas nao encontrado no pacote dados.gov.br');

      return fetch(csvUrl, {headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){return r.text();}).then(function(t){
        var rows = parseCSV(t);
        if(rows.length<2) return res.json({fonte:'Portal da Transparência / dados.gov.br', total:0, emendas:[]});
        var head = rows[0].map(function(h){return String(h||'').toLowerCase();});
        function col(n){ for(var i=0;i<head.length;i++) if(head[i]===n) return i; return -1; }

        var iAno = col('ano'); var iUf = col('uf'); var iAutor = col('autor'); var iValor = col('valor');
        var iObjeto = col('objeto'); var iTipo = col('tipo'); var iSituacao = col('situacao');
        var out = [];
        for(var i=1;i<rows.length;i++){
          var r = rows[i];
          var rAno = String(r[iAno]||'').replace(/\D/g,'');
          if(ano && rAno!==ano) continue;
          var rUf = String(r[iUf]||'').toUpperCase();
          if(uf && rUf!==uf) continue;
          var rAutor = String(r[iAutor]||'').toUpperCase();
          if(autor && rAutor.indexOf(autor)===-1) continue;
          out.push({
            ano: rAno, uf: rUf, autor: r[iAutor]||'',
            tipo: r[iTipo]||'', objeto: r[iObjeto]||'',
            valor: parseBR(r[iValor]), situacao: r[iSituacao]||''
          });
        }
        var result = {fonte:'Portal da Transparência / dados.gov.br', total:out.length, emendas:out.slice(0,200), atualizadoEm:new Date().toISOString()};
        cacheSet(ck, result, 3600000);
        res.json(result);
      });
    }).catch(function(e){
      res.status(502).json({erro:'Emendas indisponível no momento', detalhe:String((e&&e.message)||e).slice(0,160), fonte:'Portal da Transparência / dados.gov.br', linkOficial:'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares', emendas:[]});
    });
  });

  // Detalhe de uma emenda
  app.get('/api/emenda/:id', function(req, res){
    var id = String(req.params.id||'');
    if(!id) return res.status(400).json({erro:'Informe ID da emenda'});
    var ck = 'emenda_'+id;
    var hit = cacheGet(ck); if(hit) return res.json(hit);

    getJSON('https://dados.gov.br/api/3/action/package_show?id=emendas-parlamentares').then(function(pkg){
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
        var iId = col('id_emenda'); if(iId<0) iId = col('codigo');
        for(var i=1;i<rows.length;i++){
          if(String(rows[i][iId]||'').trim()===id){
            var r = rows[i];
            var out = {fonte:'Portal da Transparência / dados.gov.br', emenda:{}};
            head.forEach(function(h,idx){ out.emenda[h] = rows[i][idx]; });
            cacheSet(ck, out, 3600000);
            return res.json(out);
          }
        }
        res.status(404).json({erro:'Emenda nao encontrada'});
      });
    }).catch(function(e){
      res.status(502).json({erro:'Emendas indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});
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
module.exports = { registrarEmendas: registrarEmendas };