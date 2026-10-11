// BrBRICS - modulo Guia Fipe: preços de veículos (Parallelum, sem chave)
var BASE='https://fipe.parallelum.com.br/api/v1';
var DIA=86400000;
function registrarFipe(app, cacheGet, cacheSet, getJSON){
  var TIPOS={carros:1,motos:1,caminhoes:1};
  function tipoOk(t){ t=String(t||'carros').toLowerCase(); return TIPOS[t]?t:'carros'; }
  app.get('/api/fipe/marcas', function(req,res){
    var t=tipoOk(req.query.tipo);
    var ck='fipe_marcas_'+t; var hit=cacheGet(ck); if(hit) return res.json(hit);
    getJSON(BASE+'/'+t+'/marcas').then(function(r){
      var out={fonte:'Tabela Fipe (Parallelum)', tipo:t, marcas:r.data||[]};
      cacheSet(ck,out,DIA); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'Fipe indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
  app.get('/api/fipe/modelos', function(req,res){
    var t=tipoOk(req.query.tipo), marca=String(req.query.marca||'').replace(/\D/g,'');
    if(!marca) return res.status(400).json({erro:'Informe marca (código).'});
    var ck='fipe_mod_'+t+'_'+marca; var hit=cacheGet(ck); if(hit) return res.json(hit);
    getJSON(BASE+'/'+t+'/marcas/'+marca+'/modelos').then(function(r){
      var out={fonte:'Tabela Fipe (Parallelum)', modelos:(r.data&&r.data.modelos)||[]};
      cacheSet(ck,out,DIA); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'Fipe indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
  app.get('/api/fipe/anos', function(req,res){
    var t=tipoOk(req.query.tipo), marca=String(req.query.marca||'').replace(/\D/g,''), modelo=String(req.query.modelo||'').replace(/\D/g,'');
    if(!marca||!modelo) return res.status(400).json({erro:'Informe marca e modelo (códigos).'});
    var ck='fipe_anos_'+t+'_'+marca+'_'+modelo; var hit=cacheGet(ck); if(hit) return res.json(hit);
    getJSON(BASE+'/'+t+'/marcas/'+marca+'/modelos/'+modelo+'/anos').then(function(r){
      var out={fonte:'Tabela Fipe (Parallelum)', anos:r.data||[]};
      cacheSet(ck,out,DIA); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'Fipe indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
  app.get('/api/fipe/valor', function(req,res){
    var t=tipoOk(req.query.tipo), marca=String(req.query.marca||'').replace(/\D/g,''),
        modelo=String(req.query.modelo||'').replace(/\D/g,''), ano=String(req.query.ano||'');
    if(!marca||!modelo||!ano) return res.status(400).json({erro:'Informe marca, modelo e ano (códigos).'});
    var ck='fipe_val_'+t+'_'+marca+'_'+modelo+'_'+ano; var hit=cacheGet(ck); if(hit) return res.json(hit);
    getJSON(BASE+'/'+t+'/marcas/'+marca+'/modelos/'+modelo+'/anos/'+encodeURIComponent(ano)).then(function(r){
      var out={fonte:'Tabela Fipe (Parallelum)', avaliacao:r.data||null};
      cacheSet(ck,out,DIA); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'Fipe indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
}
module.exports={registrarFipe:registrarFipe};
