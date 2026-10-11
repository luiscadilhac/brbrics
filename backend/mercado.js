// BrBRICS - modulo Mercado: bolsa (Brapi, sem chave), cripto (CoinGecko) e dolar oficial (BCB PTAX)
var DIA=86400000;
function numBR(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n;}
function registrarMercado(app, cacheGet, cacheSet, getJSON){
  // ---- Bolsa: blue chips (lote e índice exigem token gratuito da Brapi) ----
  var ACOES=['PETR4','VALE3','ITUB4'];
  var ACOES_EXTRA=['BBDC4','BBAS3','WEGE3'];
  function brapiToken(){return process.env.BRAPI_TOKEN||'';}
  function normPapel(p){return {symbol:p.symbol, nome:p.longName||p.shortName||p.symbol,
    preco:p.regularMarketPrice, varAbs:p.regularMarketChange, varPct:p.regularMarketChangePercent,
    max:p.regularMarketDayHigh, min:p.regularMarketDayLow, prevClose:p.regularMarketPreviousClose,
    volume:p.regularMarketVolume, logo:p.logourl||''};}
  app.get('/api/mercado/bolsa', function(req,res){
    var hit=cacheGet('mkt_bolsa'); if(hit) return res.json(hit);
    var tk=brapiToken();
    if(tk){
      getJSON('https://brapi.dev/api/quote/'+encodeURIComponent('^BVSP,'+ACOES.join(','))+'?token='+encodeURIComponent(tk),{},30000).then(function(r){
        var arr=(r.data&&r.data.results)||[];
        var out={fonte:'Brapi / B3', atualizadoEm:(r.data&&r.data.requestedAt)||new Date().toISOString(), papeis:arr.map(normPapel)};
        if(out.papeis.length)cacheSet('mkt_bolsa',out,5*60000); res.json(out);
      }).catch(function(e){res.status(502).json({erro:'Bolsa indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
      return;
    }
    function coletar(syms,espera){
      var out=[];
      function prox(i){
        if(i>=syms.length) return Promise.resolve(out);
        return getJSON('https://brapi.dev/api/quote/'+syms[i],{},20000)
          .then(function(r){var p=r.data&&r.data.results&&r.data.results[0];if(p)out.push(p);else out.push({__falha:syms[i]});})
          .catch(function(){out.push({__falha:syms[i]});})
          .then(function(){return new Promise(function(rr){setTimeout(rr,espera);});})
          .then(function(){return prox(i+1);});
      }
      return prox(0);
    }
    coletar(ACOES,2000).then(function(ps){
      var faltam=ps.filter(function(p){return p.__falha;}).map(function(p){return p.__falha;});
      function fim(lista){
        var arr=lista.filter(function(p){return !p.__falha;}).map(normPapel);
        var out={fonte:'Brapi / B3', atualizadoEm:new Date().toISOString(), papeis:arr,
          aviso:'Índice Ibovespa e lote exigem token gratuito (brapi.dev → BRAPI_TOKEN no servidor).'};
        if(arr.length)cacheSet('mkt_bolsa',out,5*60000); res.json(out);
      }
      if(!faltam.length) return fim(ps);
      setTimeout(function(){coletar(faltam,3000).then(function(ps2){
        fim(ps.concat(ps2));
      });},4000);
    }).catch(function(e){res.status(502).json({erro:'Bolsa indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
  // ---- Cripto: /api/mercado/cripto ----
  var COINS=[['bitcoin','Bitcoin','BTC'],['ethereum','Ethereum','ETH'],['solana','Solana','SOL'],['cardano','Cardano','ADA'],['dogecoin','Dogecoin','DOGE']];
  app.get('/api/mercado/cripto', function(req,res){
    var hit=cacheGet('mkt_cripto'); if(hit) return res.json(hit);
    var ids=COINS.map(function(c){return c[0];}).join(',');
    getJSON('https://api.coingecko.com/api/v3/simple/price?ids='+ids+'&vs_currencies=usd,brl&include_24hr_change=true',{},20000).then(function(r){
      var d=r.data||{};
      var out={fonte:'CoinGecko', atualizadoEm:new Date().toISOString(),
        moedas:COINS.map(function(c){var o=d[c[0]]||{};return {id:c[0], nome:c[1], sigla:c[2],
          usd:o.usd??null, brl:o.brl??null,
          varUsd:o.usd_24h_change??null, varBrl:o.brl_24h_change??null};}).filter(function(m){return m.usd!=null;})};
      if(out.moedas.length)cacheSet('mkt_cripto',out,5*60000); res.json(out);
    }).catch(function(e){res.status(502).json({erro:'Cripto indisponível', detalhe:String((e&&e.message)||e).slice(0,160)});});
  });
  // ---- Dolar oficial PTAX: /api/mercado/ptax (último dia útil) ----
  function ptaxData(d){
    var m=String(d.getMonth()+1).padStart(2,'0'), dia=String(d.getDate()).padStart(2,'0');
    return m+'-'+dia+'-'+d.getFullYear();
  }
  app.get('/api/mercado/ptax', function(req,res){
    var hit=cacheGet('mkt_ptax'); if(hit) return res.json(hit);
    var tentativas=[]; var hoje=new Date();
    for(var i=0;i<7;i++){var d=new Date(hoje.getTime()-i*DIA);tentativas.push(d);}
    (function prox(k){
      if(k>=tentativas.length) return res.status(502).json({erro:'PTAX indisponível'});
      var url='https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=\''+ptaxData(tentativas[k])+'\'&$top=1&$format=json';
      getJSON(url,{},20000).then(function(r){
        var v=(r.data&&r.data.value&&r.data.value[0])||null;
        if(!v) return prox(k+1);
        var out={fonte:'BCB - PTAX', compra:v.cotacaoCompra, venda:v.cotacaoVenda, data:v.dataHoraCotacao};
        cacheSet('mkt_ptax',out,6*3600000); res.json(out);
      }).catch(function(){prox(k+1);});
    })(0);
  });
  // ---- Resumo combinado p/ a home ----
  app.get('/api/mercado/resumo', function(req,res){
    var hit=cacheGet('mkt_res'); if(hit) return res.json(hit);
    var base='http://localhost:'+(process.env.PORT||3000);
    Promise.allSettled([getJSON(base+'/api/mercado/bolsa',{},25000),getJSON(base+'/api/mercado/cripto',{},25000),getJSON(base+'/api/mercado/ptax',{},25000)]).then(function(rs){
      var out={bolsa:rs[0].status==='fulfilled'?rs[0].value.data:null,
        cripto:rs[1].status==='fulfilled'?rs[1].value.data:null,
        ptax:rs[2].status==='fulfilled'?rs[2].value.data:null,
        atualizadoEm:new Date().toISOString()};
      var cheio=(out.bolsa&&out.bolsa.papeis&&out.bolsa.papeis.length)&&(out.cripto&&out.cripto.moedas&&out.cripto.moedas.length);
      cacheSet('mkt_res',out,cheio?5*60000:30000); res.json(out);
    });
  });
}
module.exports={registrarMercado:registrarMercado};
