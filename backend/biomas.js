// BrBRICS - modulo Biomas: MapBiomas (cobertura, alertas, alertas de fogo)
var DIA=86400000;
function numBR(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n;}
function registrarBiomas(app, cacheGet, cacheSet, getJSON){
  var MAPBIOMAS_API='https://plataforma.brasil.mapbiomas.org/api';
  var ALERTA_API='https://alerta.mapbiomas.org/en/api';
  var CACHE_TTL=6*3600000; // 6h

  // ----- Cobertura por bioma/estado/municipio (MapBiomas Collection 11) -----
  app.get('/api/biomas/cobertura', function(req,res){
    var hit=cacheGet('bio_cob'); if(hit) return res.json(hit);
    // Dados estáticos de referência (Coleção 11 - 2024)
    var biomas=['Amazônia','Cerrado','Mata Atlântica','Caatinga','Pampa','Pantanal'];
    var classes=['Floresta','Formação Savânica','Mangue','Campo','Pastagem','Agricultura','Silvicultura','Área Urbanizada','Mineração','Corpo D\'Água','Não Observado'];
    var ufs=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
    var cacheKey='bio_cob_v2';
    var hit=cacheGet(cacheKey); if(hit) return res.json(hit);
    // Dados de referência (estáticos - coleção 11)
    var ref={biomas:biomas, classes:classes, ufs:ufs, fonte:'MapBiomas Coleção 11 (1985-2024)', atualizadoEm:new Date().toISOString()};
    cacheSet('bio_cob_v2',ref,7*DIA); res.json(ref);
  });

  // Alertas de desmatamento (MapBiomas Alerta)
  app.get('/api/biomas/alertas', function(req,res){
    var uf=String(req.query.uf||'').toUpperCase();
    var tipo=String(req.query.tipo||'');
    var ck='bio_alt_'+uf+'_'+tipo; var hit=cacheGet('bio_alt_'+uf+'_'+tipo); if(hit) return res.json(hit);
    var url='https://alerta.mapbiomas.org/en/api/alerts?'+(uf?'state='+uf+'&':'')+(tipo?'type='+tipo+'&':'')+'limit=100';
    getJSON(url,{},30000).then(function(r){
      var alerts=(r.data||[]).map(function(a){
        return {id:a.id, tipo:a.type||a.alert_type, area_ha:a.area_ha||a.area, estado:a.state||a.state_code, municipio:a.municipality||a.city, data:a.detected_at||a.created_at, fonte:'MapBiomas Alerta'};
      });
      var out={fonte:'MapBiomas Alerta', total:alerts.length, alertas:alerts, atualizadoEm:new Date().toISOString()};
      cacheSet('bio_alt_'+uf+'_'+tipo,out,3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'MapBiomas Alerta indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });

  // Alertas de fogo (MapBiomas Fogo)
  app.get('/api/biomas/fogo', function(req,res){
    var uf=String(req.query.uf||'').toUpperCase();
    var ck='bio_fogo_'+uf; var hit=cacheGet('bio_fogo_'+uf); if(hit) return res.json(hit);
    var url='https://alerta.mapbiomas.org/en/api/fire-alerts?'+(uf?'state='+uf+'&':'')+'limit=100';
    getJSON(url,{},30000).then(function(r){
      var fires=(r.data||[]).map(function(f){
        return {id:f.id, area_ha:f.area_ha||f.area, bioma:f.biome, estado:f.state||f.state_code, municipio:f.municipality||f.city, data:f.detected_at||f.created_at, fonte:'MapBiomas Fogo'};
      });
      var out={fonte:'MapBiomas Fogo', total:fires.length, focos:fires, atualizadoEm:new Date().toISOString()};
      cacheSet('bio_fogo_'+uf,out,3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'MapBiomas Fogo indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });

  // Estatísticas de área por bioma/estado (MapBiomas API v1)
  app.get('/api/biomas/estatisticas', function(req,res){
    var tipo=String(req.query.tipo||'area'); // area, desmatamento, regeneracao
    var nivel=String(req.query.nivel||'bioma'); // bioma, estado, municipio
    var uf=String(req.query.uf||'').toUpperCase();
    var ck='bio_est_'+tipo+'_'+nivel+'_'+uf; var hit=cacheGet(ck); if(hit) return res.json(hit);
    // Endpoint MapBiomas API v1 - estatísticas
    var url='https://plataforma.brasil.mapbiomas.org/api/statistics/area/'+tipo+'/'+nivel;
    if(uf) url+='/'+uf;
    getJSON(url,{},30000).then(function(r){
      var out={fonte:'MapBiomas API v1', tipo:tipo, nivel:nivel, uf:uf||'Brasil', dados:r.data||[], atualizadoEm:new Date().toISOString()};
      cacheSet('bio_est_'+tipo+'_'+nivel+'_'+uf,out,6*3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'MapBiomas API indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });

  // Saldos por bioma/estado (área nativa vs convertida)
  app.get('/api/biomas/saldo', function(req,res){
    var uf=String(req.query.uf||'').toUpperCase();
    var ck='bio_saldo_'+uf; var hit=cacheGet(ck); if(hit) return res.json(hit);
    // Usa estatísticas de área nativa vs convertida
    getJSON('https://plataforma.brasil.mapbiomas.org/api/statistics/area/native_vs_converted',{},30000).then(function(r){
      var data=(r.data||[]).filter(function(d){return !uf||d.state===uf;});
      var out={fonte:'MapBiomas', uf:uf||'Brasil', dados:r.data||[], atualizadoEm:new Date().toISOString()};
      cacheSet('bio_saldo_'+uf,out,6*3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'MapBiomas saldo indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });

  // Ranking de desmatamento por estado/municipio
  app.get('/api/biomas/ranking', function(req,res){
    var tipo=String(req.query.tipo||'desmatamento');
    var nivel=String(req.query.nivel||'estado');
    var uf=String(req.query.uf||'').toUpperCase();
    var ck='bio_rank_'+tipo+'_'+nivel+'_'+uf; var hit=cacheGet(ck); if(hit) return res.json(hit);
    var url='https://plataforma.brasil.mapbiomas.org/api/statistics/ranking/'+tipo+'/'+nivel;
    if(uf) url+='/'+uf;
    getJSON(url,{},30000).then(function(r){
      var out={fonte:'MapBiomas', tipo:tipo, nivel:nivel, uf:uf||'Brasil', dados:r.data||[], atualizadoEm:new Date().toISOString()};
      cacheSet('bio_rank_'+tipo+'_'+nivel+'_'+uf,out,6*3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'MapBiomas ranking indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
}
module.exports={registrarBiomas:registrarBiomas};