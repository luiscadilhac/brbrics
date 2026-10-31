// BrBRICS - modulo Contratos: contratos assinados publicados no PNCP (sem chave)
var PORTA_PNC = 50;      // o PNCP devolve lista vazia acima de 50 por pagina
var MAX_VARRIDAS = 10;   // teto de paginas lidas na fonte por consulta

function registrarContratos(app, cacheGet, cacheSet, getJSON){

  function datasValidas(a, b){
    return /^\d{8}$/.test(a) && /^\d{8}$/.test(b) && a <= b;
  }
  function hoje(){
    var d = new Date();
    return String(d.getFullYear()) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  }
  function diasAtras(n){
    var d = new Date(Date.now() - n * 86400000);
    return String(d.getFullYear()) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  }
  function espera(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function normaliza(c){
    var org = c.orgaoEntidade || {}, un = c.unidadeOrgao || {};
    var valor = typeof c.valorGlobal === 'number' ? c.valorGlobal
              : (typeof c.valorInicial === 'number' ? c.valorInicial : null);
    var emenda = c.emendaParlamentar;
    return {
      controle: c.numeroControlePNCP || c.numeroControlePncpCompra || '',
      objeto: String(c.objetoContrato || '').replace(/\s+/g, ' ').slice(0, 400),
      orgao: org.razaoSocial || '',
      unidade: un.nomeUnidade || '',
      uf: un.ufSigla || '', municipio: un.municipioNome || '', codigoIbge: un.codigoIbge || '',
      esfera: org.esferaId || '', poder: org.poderId || '', cnpj: org.cnpj || '',
      fornecedor: c.nomeRazaoSocialFornecedor || '', docFornecedor: c.niFornecedor || '',
      tipoPessoa: c.tipoPessoa || '',
      tipo: (c.tipoContrato && c.tipoContrato.nome) || '',
      categoria: (c.categoriaProcesso && c.categoriaProcesso.nome) || '',
      valor: valor,
      assinado: (c.dataAssinatura || '').slice(0, 10),
      publicado: (c.dataPublicacaoPncp || '').slice(0, 10),
      vigendoAte: (c.dataVigenciaFim || '').slice(0, 10),
      emenda: emenda ? (emenda.autorNome || emenda.tipo || 'emenda parlamentar') : ''
    };
  }

  app.get('/api/contratos', function(req, res){
    var ini = String(req.query.dataInicial || '').replace(/\D/g, '') || diasAtras(7);
    var fim = String(req.query.dataFinal || '').replace(/\D/g, '') || hoje();
    if (!datasValidas(ini, fim)) { ini = diasAtras(7); fim = hoje(); }
    var pagina = Math.max(1, parseInt(req.query.pagina || '1', 10) || 1);
    var tamanho = Math.min(Math.max(parseInt(req.query.tamanhoPagina || '20', 10) || 20, 5), 50);
    var uf = String(req.query.uf || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    var esfera = String(req.query.esfera || '').toUpperCase().replace(/[^FEM]/g, '').slice(0, 1);
    var q = String(req.query.q || '').toLowerCase().trim();
    var ck = 'contr_' + ini + '_' + fim + '_' + pagina + '_' + tamanho + '_' + uf + '_' + esfera + '_' + q;
    var hit = cacheGet(ck); if (hit) return res.json(hit);

    var base = 'https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=' + ini +
               '&dataFinal=' + fim + '&tamanhoPagina=' + PORTA_PNC + '&pagina=';

    // O PNCP nao filtra por UF, esfera nem por palavra: a varredura junta o que serviu
    // e filtra aqui, entao o "total" so e prometido quando nao ha filtro local.
    function serve(c){
      if (uf && String(c.uf || '') !== uf) return false;
      if (esfera && String(c.esfera || '') !== esfera) return false;
      if (!q) return true;
      return (c.objeto + ' ' + c.orgao + ' ' + c.unidade + ' ' + c.fornecedor + ' ' + c.controle)
        .toLowerCase().indexOf(q) !== -1;
    }
    function pegaUp(n){
      return getJSON(base + n, {}, 15000).then(function(r){
        if (r.status !== 200 || !r.data || typeof r.data !== 'object') {
          var e = new Error('PNCP respondeu HTTP ' + r.status); e.falha = r.status === 429; throw e;
        }
        return { dados: (r.data.data || []).map(normaliza), total: r.data.totalRegistros || 0 };
      });
    }

    var alvo = pagina * tamanho, acumulado = [], total = null, varridas = 0, teto = false, atras = false;
    function caminha(n){
      if (n > MAX_VARRIDAS) { teto = true; return Promise.resolve(); }
      return pegaUp(n).then(function(r){
        if (total === null) total = r.total;
        varridas++;
        acumulado = acumulado.concat(r.dados);
        if (r.dados.length < PORTA_PNC) return Promise.resolve();
        if (acumulado.filter(serve).length >= alvo) return Promise.resolve();
        return espera(300).then(function(){ return caminha(n + 1); });
      }).catch(function(e){
        if (n === 1) throw e;
        if (e && e.falha) atras = true;
        return Promise.resolve();
      });
    }

    caminha(1).then(function(){
      var lista = acumulado.filter(serve);
      var filtrando = !!(uf || esfera || q);
      var soma = 0;
      lista.forEach(function(c){ if (typeof c.valor === 'number') soma += c.valor; });
      var out = {
        fonte: 'PNCP — contratos publicados', periodo: { ini: ini, fim: fim },
        filtro: { uf: uf, esfera: esfera, q: q },
        pagina: pagina, tamanhoPagina: tamanho,
        total: filtrando ? lista.length : (total !== null ? total : lista.length),
        totalPaginas: Math.max(1, Math.ceil((filtrando ? lista.length : (total || 0)) / tamanho)),
        lidosNaFonte: acumulado.length, paginasVarridas: varridas,
        somaAmostra: Math.round(soma * 100) / 100,
        dados: lista.slice((pagina - 1) * tamanho, pagina * tamanho),
        atualizadoEm: new Date().toISOString()
      };
      if (filtrando) {
        out.aviso = 'O PNCP não filtra por UF, esfera nem por palavra: a busca corre sobre as ' +
          acumulado.length + ' leituras trazidas da fonte nesta varredura.' +
          (teto ? ' A varredura parou no teto de ' + MAX_VARRIDAS + ' páginas da fonte, então pode haver mais contratos fora da amostra.' : '');
      }
      if (atras) out.aviso = (out.aviso ? out.aviso + ' ' : '') + 'A fonte respondeu devagar no meio da varredura; a lista pode estar menor do que o dia teve.';
      if (out.dados.length || out.total) cacheSet(ck, out, 10 * 60000); else cacheSet(ck, out, 20000);
      res.json(out);
    }).catch(function(e){
      res.status(502).json({
        erro: 'PNCP indisponível agora', detalhe: String((e && e.message) || e).slice(0, 160),
        fonte: 'PNCP — contratos publicados', dados: []
      });
    });
  });
}
module.exports = { registrarContratos: registrarContratos };
