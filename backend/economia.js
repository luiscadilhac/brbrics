// BrBRICS - Economia: Boletim Focus (BCB Olinda) + indicadores extras (IPCA 12m, Desemprego)
var FOCUS_BASE = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoTop5Anuais';

function limparOlinda(txt){ return txt.replace(/^\/\*/,'').replace(/\*\/$/,'').trim(); }

// getJSONP: usa o mesmo getJSON mas remove o wrapper /* */ antes do parse
function getFocus(getJSON, indicador){
  var url = FOCUS_BASE+'?$format=json&$filter='+encodeURIComponent("Indicador eq '"+indicador+"' and DataReferencia eq '2026'")+'&$top=2&$orderby=Data%20desc';
  return getJSON(url, { 'Accept': 'application/json' }, 10000).then(function(r){
    var arr = null;
    try { arr = JSON.parse(limparOlinda(typeof r.data==='string'?r.data:JSON.stringify(r.data))); } catch(e){}
    var v = (arr && arr.value) || [];
    if(!v.length) return { indicador: indicador, disponivel: false };
    var atual = v[0], anterior = v[1];
    var med = parseFloat(atual.Mediana);
    var variacao = anterior ? (med - parseFloat(anterior.Mediana)) : null;
    return {
      indicador: indicador, disponivel: true,
      mediana: atual.Mediana, data: atual.Data,
      variacao: variacao, // diferenca semanal em pontos
      numeroRespondentes: atual.numeroRespondentes || null
    };
  });
}

function registrarEconomia(app, cacheGet, cacheSet, getJSON){
  // Boletim Focus para 2026 (IPCA, Selic, Cambio, PIB) + variacao semanal
  app.get('/api/focus', function(req, res){
    var hit = cacheGet('focus');
    if(hit) return res.json(hit);
    Promise.all([
      getFocus(getJSON, 'IPCA'),
      getFocus(getJSON, 'Selic'),
      getFocus(getJSON, 'Câmbio'),
      getFocus(getJSON, 'PIB')
    ]).then(function(rs){
      var out = {
        fonte: 'Banco Central - Boletim Focus (mediana top5)',
        referencia: '2026',
        atualizadoEm: new Date().toISOString(),
        indicadores: {
          ipca: rs[0], selic: rs[1], cambio: rs[2], pib: rs[3]
        }
      };
      cacheSet('focus', out, 600000); res.json(out);
    }).catch(function(e){
      res.status(502).json({ erro: 'Focus indisponivel', detalhe: String((e&&e.message)||e) });
    });
  });

  // Economia geral: Focus + IPCA 12m (SGS 13522) + Desemprego (SGS 24356)
  app.get('/api/economia', function(req, res){
    var hit = cacheGet('economia');
    if(hit) return res.json(hit);
    var base = 'http://localhost:'+(process.env.PORT||3000);
    var ipca12 = getJSON('https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/2?formato=json', {}, 10000)
      .then(function(r){ return Array.isArray(r.data)?r.data:[]; }).catch(function(){ return []; });
    var desemp = getJSON('https://api.bcb.gov.br/dados/serie/bcdata.sgs.24356/dados/ultimos/2?formato=json', {}, 10000)
      .then(function(r){ return Array.isArray(r.data)?r.data:[]; }).catch(function(){ return []; });
    var focus = getJSON(base+'/api/focus', {}, 12000)
      .then(function(r){ return r.data; }).catch(function(){ return null; });

    Promise.allSettled([focus, ipca12, desemp]).then(function(r){
      var f = r[0].status==='fulfilled'?r[0].value:null;
      var i12 = r[1].status==='fulfilled'?r[1].value:[];
      var des = r[2].status==='fulfilled'?r[2].value:[];
      function variacaoPP(arr){
        if(!arr || arr.length<2) return null;
        return (parseFloat(String(arr[arr.length-1].valor).replace(',','.')) - parseFloat(String(arr[arr.length-2].valor).replace(',','.')));
      }
      var out = {
        fonte: 'BCB - Focus (Olinda) + SGS',
        atualizadoEm: new Date().toISOString(),
        focus: f,
        ipca12m: i12.length ? { valor: i12[i12.length-1].valor, data: i12[i12.length-1].data, variacaoPP: variacaoPP(i12) } : null,
        desemprego: des.length ? { valor: des[des.length-1].valor, data: des[des.length-1].data, variacaoPP: variacaoPP(des) } : null
      };
      cacheSet('economia', out, 600000); res.json(out);
    });
  });
}

module.exports = { registrarEconomia: registrarEconomia };
