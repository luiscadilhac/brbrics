// BrBRICS - modulo Satelites: órbitas, TLE, posição em tempo real, FIRMS
var DIA=86400000;
function numBR(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n;}
function registrarSatelites(app, cacheGet, cacheSet, getJSON){
  var SATNOGS='https://db.satnogs.org/api';
  var FIRMS='https://firms.modaps.eosdis.nasa.gov/api';
  var CACHE_TTL=6*3600000; // 6h
    // ----- TLE (Two-Line Elements) via SatNOGS -----
    // Lista de satélites populares
    var SATS_POPULARES={
      'ISS (ZARYA)':25544,
      'HUBBLE':20580,
      'TIANGONG':48274,
      'STARLINK-1':44235,
      'STARLINK-2':44236,
      'STARLINK-3':44237,
      'STARLINK-4':44238,
      'STARLINK-5':44239,
      'STARLINK-6':44240,
      'STARLINK-7':44241,
      'STARLINK-7':44242,
      'STARLINK-8':44243,
      'STARLINK-9':44243,
      'STARLINK-10':44244
    };
    function satKey(norad){return 'sat_'+norad;}
    function satCache(norad){return cacheGet('sat_'+norad);}
    function satCacheSet(norad,val){cacheSet('sat_'+norad,val,6*3600000);}

    // Busca TLE por NORAD ID
    app.get('/api/satelites/tle/:norad', function(req,res){
      var norad=String(req.params.norad||'').replace(/\D/g,'');
      if(!norad) return res.status(400).json({erro:'Informe NORAD ID (ex: 25544 para ISS)'});
      var hit=cacheGet('tle_'+norad); if(hit) return res.json(hit);
      var url='https://db.satnogs.org/api/tle/?norad_cat_id='+norad+'&format=json';
      fetch('https://db.satnogs.org/api/tle/?norad_cat_id='+norad+'&format=json',{headers:{'User-Agent':'BrBRICS/1.0'}})
        .then(function(r){return r.json();})
        .then(function(r){
          var tle=(r.data||[])[0];
          if(!tle) return res.status(404).json({erro:'TLE não encontrado para NORAD '+norad});
          var out={fonte:'SatNOGS',norad:norad,tle1:tle.tle1,tle2:tle.tle2,atualizado:tle.updated||new Date().toISOString()};
          cacheSet('tle_'+norad,out,3600000);
          res.json(out);
        }).catch(function(e){res.status(502).json({erro:'SatNOGS indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // Lista de satélites populares
    app.get('/api/satelites/populares', function(req,res){
      var hit=cacheGet('sats_pop'); if(hit) return res.json(hit);
      var out={fonte:'SatNOGS',satélites:Object.keys(SATS_POPULARES).map(function(n){return {nome:n,norad:SATS_POPULARES[n]};}),atualizadoEm:new Date().toISOString()};
      cacheSet('sats_pop',out,3600000); res.json(out);
    });

    // Posição atual estimada (via TLE + propagação simplificada - só retorna TLE)
    // Para posição real seria necessário propagador SGP4 (pesado), retornamos TLE + link para cálculo
    app.get('/api/satelites/posicao/:norad', function(req,res){
      var norad=String(req.params.norad||'').replace(/\D/g,'');
      if(!norad) return res.status(400).json({erro:'Informe NORAD ID'});
      // Retorna TLE + link para cálculo online
      fetch('https://db.satnogs.org/api/tle/?norad_cat_id='+norad+'&format=json',{headers:{'User-Agent':'BrBRICS/1.0'}})
        .then(function(r){return r.json();})
        .then(function(r){
          var tle=(r.data||[])[0];
          if(!tle) return res.status(404).json({erro:'TLE não encontrado'});
          res.json({fonte:'SatNOGS',norad:norad,tle1:tle.tle1,tle2:tle.tle2,
            calculo_online:'Use https://www.n2yo.com/satellite/?s='+norad+' ou https://in-the-sky.org/?norad='+norad,
            atualizado:new Date().toISOString()});
        }).catch(function(e){res.status(502).json({erro:'SatNOGS indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // ---------- FIRMS/NASA (Incêndios + Satélites que detectam) ----------
    var FIRMS_BASE='https://firms.modaps.eosdis.nasa.gov/api';
    var MAP_KEY=process.env.FIRMS_MAP_KEY||'';
    function firmsCache(key){return cacheGet(key);}
    function firmsCacheSet(key,val){cacheSet(key,val,6*3600000);}

    // Mapa de sensores
    var SENSORES={
      'modis':'MODIS_NRT','modis_sp':'MODIS_SP',
      'viirs_snpp':'VIIRS_SNPP_NRT','viirs_noaa20':'VIIRS_NOAA20_NRT',
      'viirs_noaa21':'VIIRS_NOAA21_NRT','landsat':'LANDSAT_NRT'
    };

    // Focos por área (bbox) - FIRMS
    app.get('/api/satelites/focos', function(req,res){
      var bbox=String(req.query.bbox||''); // minLon,minLat,maxLon,maxLat
      var sensor=String(req.query.sensor||'viirs_snpp').toLowerCase();
      var dias=parseInt(req.query.dias||'1',10);
      if(!bbox) return res.status(400).json({erro:'Informe bbox=minLon,minLat,maxLon,maxLat'});
      var sensor=SENSORES[sensor]||'VIIRS_SNPP_NRT';
      var url='https://firms.modaps.eosdis.nasa.gov/api/area/csv/'+MAP_KEY+'/'+sensor+'/'+bbox+'/'+dias;
      var ck='firms_'+sensor+'_'+bbox.replace(/[,\s]/g,'_'); var hit=cacheGet('firms_'+sensor+'_'+bbox); if(hit) return res.json(hit);
      if(!MAP_KEY) return res.status(501).json({erro:'FIRMS_MAP_KEY não configurada no servidor'});
      fetch('https://firms.modaps.eosdis.nasa.gov/api/area/csv/'+MAP_KEY+'/'+sensor+'/'+bbox+'/'+dias)
        .then(function(r){return r.text();})
        .then(function(t){
          var lines=t.trim().split('\n').slice(1);
          var rows=lines.map(function(l){return l.split(',');});
          if(lines.length<2) return res.json({fonte:'NASA FIRMS',total:0,dados:[]});
          var head=['latitude','longitude','brightness','scan','track','acq_date','acq_time','satellite','instrument','confidence','version','bright_t31','frp','daynight','type'];
          var dados=lines.slice(1).map(function(l){
            var c=l.split(',');
            return {lat:parseFloat(c[0]),lon:parseFloat(c[1]),brightness:c[2],scan:c[3],track:c[4],data:c[5],hora:c[4],sat:c[7],instrument:c[8],confianca:c[10],frp:parseFloat(c[12]),dia_not:c[13],tipo:c[14]};
          }).filter(function(d){return !isNaN(d.lat)&&!isNaN(d.lon);});
          var out={fonte:'NASA FIRMS',total:dados.length,dados:dados.slice(0,500)};
          cacheSet('firms_'+bbox,out,3600000);
          res.json(out);
        }).catch(function(e){res.status(502).json({erro:'FIRMS indisponível', detalhe:String(e).slice(0,160)});});
    });

    // Satélites ativos (lista NORAD) - via Celestrak
    app.get('/api/satelites/ativos', function(req,res){
      var hit=cacheGet('sats_ativos'); if(hit) return res.json(hit);
      fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json',{headers:{'User-Agent':'BrBRICS/1.0'}})
        .then(function(r){return r.json();})
        .then(function(r){
          var arr=(r||[]).map(function(s){return {nome:s.OBJECT_NAME,norad:NORAD_CAT_ID,satelite:s.OBJECT_NAME,tipo:s.OBJECT_TYPE,pais:s.COUNTRY,lançamento:s.LAUNCH_DATE};});
          var out={fonte:'Celestrak/Celestrak',total:arr.length,satelites:arr.slice(0,200),atualizadoEm:new Date().toISOString()};
          cacheSet('sats_ativos',out,3600000);
          res.json(out);
        }).catch(function(e){res.status(502).json({erro:'Celestrak indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // TLE de um satélite (Celestrak)
    app.get('/api/satelites/tle/:nome', function(req,res){
      var nome=encodeURIComponent(req.params.nome);
      fetch('https://celestrak.org/NORAD/elements/gp.php?NAME='+encodeURIComponent(req.params.nome)+'&FORMAT=json',{headers:{'User-Agent':'BrBRICS/1.0'}})
        .then(function(r){return r.json();})
        .then(function(r){
          if(!r||!r.length) return res.status(404).json({erro:'Satélite não encontrado'});
          var s=r[0];
          res.json({fonte:'Celestrak',nome:s.OBJECT_NAME,norad:s.NORAD_CAT_ID,tle1:s.TLE_LINE1,tle2:s.TLE_LINE2,atualizado:new Date().toISOString()});
        }).catch(function(e){res.status(502).json({erro:'Celestrak indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // Previsão de passagem (aproximada - usa TLE + SGP4 simplificado não implementado aqui, retorna TLE + link)
    app.get('/api/satelites/passagem/:norad', function(req,res){
      var norad=String(req.params.norad||'').replace(/\D/g,'');
      var lat=parseFloat(req.query.lat), lon=parseFloat(req.query.lon), alt=parseFloat(req.query.alt||'0');
      if(!norad||isNaN(lat)||isNaN(lon)) return res.status(400).json({erro:'Informe NORAD, lat, lon'});
      fetch('https://db.satnogs.org/api/tle/?norad_cat_id='+norad+'&format=json',{headers:{'User-Agent':'BrBRICS/1.0'}})
        .then(function(r){return r.json();})
        .then(function(r){
          var tle=(r.data||[])[0];
          if(!tle) return res.status(404).json({erro:'TLE não encontrado'});
          res.json({
            fonte:'SatNOGS',norad:norad,tle1:tle.tle1,tle2:tle.tle2,
            calculo_online:'Use https://www.n2yo.com/satellite/?s='+norad+' ou https://in-the-sky.org/?norad='+norad,
            previsao_local:'Use https://in-the-sky.org/?norad='+norad+'&lat='+lat+'&lon='+lon+' para previsão de passagem',
            atualizado:new Date().toISOString()
          });
        }).catch(function(e){res.status(502).json({erro:'SatNOGS indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
    });

    // ---------- FIRMS/NASA (Incêndios detectados por satélite) ----------
    // Já implementado em /api/satelites/focos (bbox + sensor)

    // ---------- Satélites ativos (Celestrak) ----------
    // Já implementado em /api/satelites/ativos
  }
  module.exports={registrarSatelites:registrarSatelites};