// BrBRICS - modulo Minerais: ANM SIGMINE (processos, áreas, produção, barragens)
var DIA=86400000;
function numBR(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n;}
function registrarMinerais(app, cacheGet, cacheSet, getJSON){
    var CACHE_TTL=6*3600000; // 6h
    var SIGMINE_BASE='https://dadosabertos.anm.gov.br/SIGMINE';
    function pkg(slug){
      return fetch(SIGMINE_BASE+'/api/action/package_show?id='+encodeURIComponent(slug),{headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){return r.json();}).then(function(r){return r.data&&r.data.result;}).catch(function(){return null;});
    }
    function csvRes(p){
      var rs=(p||{}).resources||[];
      for(var i=0;i<rs.length;i++){if(String(rs[i].format||'').toUpperCase()==='CSV'&&rs[i].url)return rs[i];}
      return null;
    }
    function parseCSV(t){
      var delim=(function(){var h=String(t||'').split(/\r?\n/)[0]||'';var sc=(h.match(/;/g)||[]).length,cc=(h.match(/,/g)||[]).length;return sc>=cc?';':',';})();
      var rows=[],row=[],cur='',q=false;
      var s=String(t||'');
      for(var i=0;i<s.length;i++){
        var c=s[i];
        if(q){ if(c==='"'){ if(s[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
        else if(c==='"'){q=true;}
        else if(c===','){row.push(cur);cur='';}
        else if(c==='\n'||c==='\r'){ if(c==='\r'&&s[i+1]==='\n')i++; row.push(cur);cur=''; if(row.length>1||row[0]!=='')rows.push(row); row=[]; }
        else cur+=c;
      }
      if(cur!==''||row.length){row.push(cur);rows.push(row);}
      return rows;
    }
    function numBR(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n;}

    // ----- Processos minerários ativos (SIGMINE) -----
    app.get('/api/minerais/processos', function(req,res){
      var uf=String(req.query.uf||'').toUpperCase();
      var subst=String(req.query.substancia||'').toUpperCase();
      var fase=String(req.query.fase||'').toUpperCase();
      var ck='min_proc_'+uf+'_'+subst+'_'+fase; var hit=cacheGet(ck); if(hit) return res.json(hit);
      pkg('processos-minerarios-ativos').then(function(p){
        if(!p) throw new Error('Pacote SIGMINE não encontrado');
        var r=csvRes(p); if(!r) throw new Error('CSV não encontrado');
        return fetch(r.url,{headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){return r.text();}).then(function(t){
          var rows=parseCSV(t);
          if(rows.length<2) return {fonte:'ANM SIGMINE',total:0,processos:[]};
          var head=rows[0].map(function(h){return String(h||'').toLowerCase();});
          function col(idx){var i=head.indexOf(idx);return i>=0?i:-1;}
          var iProc=col('numero_processo')>=0?col('numero_processo'):col('processo');
          var iSubst=col('substancia')>=0?col('substancia'):col('substance');
          var iFase=col('fase')>=0?col('fase'):col('phase');
          var iUf=col('uf')>=0?col('uf'):col('state');
          var iMun=col('municipio')>=0?col('municipio'):col('municipality');
          var iArea=col('area_ha')>=0?col('area_ha'):col('area_hectares');
          var out=[];
          for(var i=1;i<rows.length;i++){
            var r=rows[i];
            if(!r[iProc]) continue;
            var ufv=String(r[iUf]||'').toUpperCase();
            if(uf && ufv!==uf) continue;
            var sub=String(r[iSubst]||'').toUpperCase();
            if(subst && sub!==subst) continue;
            var fa=String(r[iFase]||'').toUpperCase();
            if(fase && fa!==fase) continue;
            out.push({
              processo:r[iProc],
              substancia:r[iSubst]||'',
              fase:r[iFase]||'',
              uf:ufv,
              municipio:r[iMun]||'',
              area_ha:numBR(r[iArea])
            });
          }
          var out={fonte:'ANM SIGMINE',total:out.length,processos:out.slice(0,200)};
          cacheSet('min_proc_'+uf+'_'+subst+'_'+fase,out,3600000);
          return out;
        });
      }).then(function(out){res.json(out);}).catch(function(e){res.status(502).json({erro:'ANM SIGMINE indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // ----- Substâncias disponíveis -----
    app.get('/api/minerais/substancias', function(req,res){
      var hit=cacheGet('min_subst'); if(hit) return res.json(hit);
      pkg('processos-minerarios-ativos').then(function(p){
        var r=csvRes(p); if(!r) throw new Error('CSV não encontrado');
        return fetch(r.url,{headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){return r.text();}).then(function(t){
          var rows=parseCSV(t);
          if(rows.length<2) throw new Error('CSV vazio');
          var head=rows[0].map(function(h){return String(h||'').toLowerCase();});
          var iSubst=head.indexOf('substancia'); if(iSubst<0) iSubst=head.indexOf('substance');
          var set=new Set();
          for(var i=1;i<rows.length;i++){var s=String(rows[i][iSubst]||'').trim().toUpperCase(); if(s) set.add(s);}
          var arr=Array.from(set).sort();
          var out={fonte:'ANM SIGMINE',total:arr.length,substancias:arr};
          cacheSet('min_subst',out,7*86400000); res.json(out);
        }).catch(function(e){res.status(502).json({erro:'ANM SIGMINE indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
      }).catch(function(e){res.status(502).json({erro:'ANM SIGMINE indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // ----- Produção mineral por município (ANM) -----
    app.get('/api/minerais/producao', function(req,res){
      var uf=String(req.query.uf||'').toUpperCase();
      var subst=String(req.query.substancia||'').toUpperCase();
      var ano=String(req.query.ano||new Date().getFullYear()).replace(/\D/g,'');
      var ck='min_prod_'+(uf||'')+'_'+(subst||'')+'_'+ano;
      var hit=cacheGet('min_prod_'+(uf||'')+'_'+(subst||'')+'_'+ano); if(hit) return res.json(hit);
      // ANM disponibiliza CSV de produção por município (AMB)
      var url='https://dadosabertos.anm.gov.br/SIGMINE/PRODUCAO_MINERAL/'+encodeURIComponent(ano)+'.zip';
      // Como é ZIP, fazemos fallback para dataset via dados.gov.br
      var urlCSV='https://dadosabertos.anm.gov.br/SIGMINE/PRODUCAO_MINERAL/'+encodeURIComponent(ano)+'.csv';
      fetch(urlCSV,{headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){
        if(!r.ok) throw new Error('CSV não encontrado');
        return r.text();
      }).then(function(t){
        var rows=parseCSV(t);
        if(rows.length<2) throw new Error('CSV vazio');
        var head=rows[0].map(function(h){return String(h||'').toLowerCase();});
        function col(n){for(var i=0;i<head.length;i++)if(head[i]===n)return i;return -1;}
        var iSubst=col('substancia'); var iUf=col('uf'); var iMun=col('municipio'); var iQtd=col('quantidade'); var iValor=col('valor');
        var out=[];
        for(var i=1;i<rows.length;i++){
          var r=rows[i];
          var sub=String(r[col('substancia')]||'').toUpperCase();
          var ufv=String(r[col('uf')]||'').toUpperCase();
          if(sub && iSubst>=0 && r[col('substancia')].toUpperCase()!==subst) continue;
          if(uf && ufv!==uf) continue;
          out.push({
            substancia:String(r[col('substancia')]||''),
            uf:String(r[col('uf')]||''),
            municipio:r[col('municipio')]||'',
            quantidade:numBR(r[col('quantidade')]),
            valor:numBR(r[col('valor')])
          });
        }
        var out={fonte:'ANM - Produção Mineral',ano:ano,total:papeis.length,registros:papeis.slice(0,500)};
        cacheSet('min_prod_'+(uf||'')+'_'+(subst||'')+'_'+ano,out,86400000);
        res.json(out);
      }).catch(function(e){res.status(502).json({erro:'ANM produção indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // ----- Barragens de mineração (SIGBM) -----
    app.get('/api/minerais/barragens', function(req,res){
      var uf=String(req.query.uf||'').toUpperCase();
      var ck='min_bar_'+(uf||''); var hit=cacheGet(ck); if(hit) return res.json(hit);
      fetch('https://sigbm.anm.gov.br/Publico/Barragens',{headers:{'User-Agent':'BrBRICS/1.0'}})
        .then(function(r){return r.json();})
        .then(function(r){
          var arr=(r.data||r.data||[]).filter(function(b){return !uf||String(b.uf||'').toUpperCase()===uf;});
          var out={fonte:'ANM SIGBM',total:arr.length,barragens:arr.slice(0,200)};
          cacheSet('min_bar_'+(uf||''),out,6*3600000);
          res.json(out);
        }).catch(function(e){res.status(502).json({erro:'SIGBM indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // ----- CFEM (Compensação Financeira) -----
    app.get('/api/minerais/cfem', function(req,res){
      var uf=String(req.query.uf||'').toUpperCase();
      var ano=String(req.query.ano||new Date().getFullYear()).replace(/\D/g,'');
      var ck='min_cfem_'+(uf||'')+'_'+ano; var hit=cacheGet(ck); if(hit) return res.json(hit);
      var url='https://dados.gov.br/dados/api/3/action/package_show?id=sistema-arrecadacao';
      fetch('https://dados.gov.br/api/3/action/package_show?id=sistema-arrecadacao',{headers:{'User-Agent':'BrBRICS/1.0'}})
        .then(function(r){return r.json();})
        .then(function(p){
          var r=csvRes(p); if(!r) throw new Error('recurso CFEM não encontrado');
          return fetch(r.url,{headers:{'User-Agent':'BrBRICS/1.0'}}).then(function(r){return r.text();}).then(function(t){
            var rows=parseCSV(t);
            var head=rows[0].map(function(h){return String(h||'').toLowerCase();});
            function col(n){for(var i=0;i<head.length;i++)if(head[i]===n)return i;return -1;}
            var iUf=col('uf'), iMun=col('municipio'), iVal=col('valor'), iAno=col('ano');
            var out=[];
            for(var i=1;i<rows.length;i++){
              var r=rows[i];
              var ufv=String(r[col('uf')]||'').toUpperCase();
              if(uf && ufv!==uf) continue;
              var anoV=String(r[col('ano')]||'').replace(/\D/g,'');
              if(ano && anoV!==ano) continue;
              out.push({
                uf:ufv, municipio:r[col('municipio')]||'',
                valor:numBR(r[col('valor')]), ano:anoV
              });
            }
            var out={fonte:'ANM - CFEM',total:papeis.length,registros:papeis.slice(0,500)};
            cacheSet('min_cfem_'+(uf||'')+'_'+ano,out,86400000);
            res.json(out);
          });
        }).catch(function(e){res.status(502).json({erro:'CFEM indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });
}
module.exports={registrarMinerais:registrarMinerais};