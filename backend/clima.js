// BrBRICS - modulo Clima: previsão nas capitais (Open-Meteo, sem chave) + atalhos INMET
var CAPS=[['AC','Rio Branco',-9.97,-67.81],['AL','Maceió',-9.67,-35.74],['AP','Macapá',0.04,-51.06],['AM','Manaus',-3.12,-60.02],['BA','Salvador',-12.97,-38.50],['CE','Fortaleza',-3.73,-38.52],['DF','Brasília',-15.79,-47.88],['ES','Vitória',-20.32,-40.34],['GO','Goiânia',-16.68,-49.25],['MA','São Luís',-2.53,-44.30],['MT','Cuiabá',-15.60,-56.10],['MS','Campo Grande',-20.47,-54.62],['MG','Belo Horizonte',-19.92,-43.94],['PA','Belém',-1.46,-48.49],['PB','João Pessoa',-7.12,-34.86],['PR','Curitiba',-25.43,-49.27],['PE','Recife',-8.05,-34.88],['PI','Teresina',-5.09,-42.80],['RJ','Rio de Janeiro',-22.91,-43.17],['RN','Natal',-5.79,-35.21],['RS','Porto Alegre',-30.03,-51.23],['RO','Porto Velho',-8.76,-63.90],['RR','Boa Vista',2.82,-60.67],['SC','Florianópolis',-27.60,-48.55],['SP','São Paulo',-23.55,-46.63],['SE','Aracaju',-10.91,-37.07],['TO','Palmas',-10.17,-48.33]];
function wmoInfo(c){
  c=+c;
  if(c===0)return {txt:'Céu limpo',ico:'sol'};
  if(c===1||c===2)return {txt:'Parcialmente nublado',ico:'sol'};
  if(c===3)return {txt:'Nublado',ico:'nuvem'};
  if(c===45||c===48)return {txt:'Nevoeiro',ico:'nevoa'};
  if((c>=51&&c<=57))return {txt:'Garoa',ico:'chuva'};
  if((c>=61&&c<=67)||(c>=80&&c<=82))return {txt:'Chuva',ico:'chuva'};
  if((c>=71&&c<=77)||c===85||c===86)return {txt:'Neve/Granizo',ico:'neve'};
  if(c>=95)return {txt:'Tempestade',ico:'tempest'};
  return {txt:'—',ico:'nuvem'};
}
function registrarClima(app, cacheGet, cacheSet, getJSON){
  function ponto(lat,lon,dias){
    dias=dias||5;
    var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&timezone=auto&forecast_days='+dias;
    return getJSON(url,{},20000).then(function(r){
      var d=(r.data&&r.data.daily)||{};
      return (d.time||[]).map(function(t,i){
        var w=wmoInfo((d.weathercode||[])[i]);
        return {data:t, max:(d.temperature_2m_max||[])[i], min:(d.temperature_2m_min||[])[i],
          chuva:(d.precipitation_sum||[])[i], vento:(d.windspeed_10m_max||[])[i], condicao:w.txt, icone:w.ico};
      });
    });
  }
  app.get('/api/clima/capitais', function(req,res){
    var hit=cacheGet('clima_caps'); if(hit) return res.json(hit);
    Promise.all(CAPS.map(function(c){
      return ponto(c[2],c[3]).then(function(dias){return {uf:c[0],cidade:c[1],dias:dias};})
        .catch(function(){return {uf:c[0],cidade:c[1],dias:[],erro:true};});
    })).then(function(rs){
      var out={fonte:'Open-Meteo (modelo numérico) · oficial: INMET', inmet:'https://portal.inmet.gov.br/',
        atualizadoEm:new Date().toISOString(), capitais:rs};
      cacheSet('clima_caps',out,3600000); res.json(out);
    });
  });
  app.get('/api/clima', function(req,res){
    var lat=parseFloat(req.query.lat), lon=parseFloat(req.query.lon);
    if(isNaN(lat)||isNaN(lon)) return res.status(400).json({erro:'Informe lat e lon.'});
    var ck='clima_'+lat+'_'+lon; var hit=cacheGet(ck); if(hit) return res.json(hit);
    ponto(lat,lon).then(function(dias){
      var out={fonte:'Open-Meteo', dias:dias};
      cacheSet(ck,out,3600000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'Clima indisponível', detalhe:String((e&&e.message)||e).slice(0,120)});});
  });
}
module.exports={registrarClima:registrarClima};
