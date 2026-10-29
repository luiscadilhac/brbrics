// BrBRICS - modulo Orgaos: ficha de cada orgao publico montada a partir dos contratos do PNCP
// O que a consulta do PNCP permite:
//   GET /v1/contratos?cnpjOrgao=  -> contratos daquele orgao (com fornecedor, valor e objeto)
//   Nao existe busca por CNPJ de fornecedor, entao a pagina e de orgaos, nao de fornecedores.
var BASE = 'https://pncp.gov.br/api/consulta/v1';
// O indice de nomes so pode ser montado varrendo publicacoes: o PNCP nao tem busca por nome de
// orgao, nem por UF, nem por municipio (medido em 2026-10-28: ufSigla e municipioNome ignorados).
// Varre as 12 modalidades, duas paginas de 50 em cada, uma chamada por vez com pausa.
var MODALIDADES_IDX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
var PAGINAS_IDX = [1, 2];
var PAUSA = 700;

function dois(n){ return String(n).padStart(2, '0'); }
function fmtPNCP(d){ return d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()); }
function espera(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function soDigitos(v){ return String(v || '').replace(/\D/g, ''); }

// O PNCP e instavel (a mesma consulta fez 0,2s e 38s). Guarda o ultimo resultado bom
// para a pagina nao ficar em branco quando a fonte atrasa ou da erro, e faz um
// trabalho por vez porque ele fecha a porta para pedidos em paralelo.
var ULTIMO = {};
var EM_IDX = false;
var TRABALHO = {};
var AUSENTE = {};

function guardaChave(k, corpo){ ULTIMO[k] = { em: Date.now(), corpo: corpo }; }
function pegaReserva(k){
  return ULTIMO[k] ? Object.assign({}, ULTIMO[k].corpo, { reserva: true, dadosDe: ULTIMO[k].em }) : null;
}

function registrarOrgaos(app, cacheGet, cacheSet, getJSON){

  // ---- indice de orgaos que publicaram contratos (para o campo de busca) ----
  app.get('/api/orgao/nomes', function(req, res){
    var q = String(req.query.q || '').toLowerCase().trim();
    var digitos = q.replace(/\D/g, '');
    var ck = 'orgao_idx';
    var limitar = function(o){
      if(!q) return { orgaos: o.orgaos };
      return { orgaos: o.orgaos.filter(function(x){
        return x.nome.toLowerCase().indexOf(q) >= 0 ||
               (x.unidade || '').toLowerCase().indexOf(q) >= 0 ||
               (x.municipio || '').toLowerCase().indexOf(q) >= 0 ||
               (digitos.length >= 3 && x.cnpj.indexOf(digitos) >= 0);
      }) };
    };
    var hit = cacheGet(ck);
    if(hit) return res.json(Object.assign({ filtro: q || null, atualizando: EM_IDX }, limitar(hit)));
    var reserva = pegaReserva('idx');
    // A varredura dura de 1 a varios minutos (o PNCP chega a levar 20s por chamada), entao
    // quem chega enquanto ela roda leva o que ja foi coletado, marcado "atualizando".
    if(EM_IDX){
      if(reserva) return res.json(Object.assign({ filtro: q || null, atualizando: true }, limitar(reserva)));
      return res.json({ orgaos: [], construindo: true, aviso: 'Montando a lista de orgaos a partir do PNCP.' });
    }
    EM_IDX = true;
    var inicioIdx = Date.now();

    var hoje = new Date();
    var ini = fmtPNCP(new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1));
    var fim = fmtPNCP(hoje);
    var mapa = {};
    var falhas = 0;

    // 35s e o prazo real: com 20s a varredura parou em 213 orgaos porque as chamadas mais
    // lentas (medido: ate 25s) morriam no prazo e a modalidade inteira se perdia.
    // 429 e diferente de vazio: o PNCP fecha a porta quando o ritmo sobe (medido em 2026-10-29:
    // pagina 2 inteira comecou a levar 429 na sequencia), entao a pausa cresce e a varredura
    // para de bater na porta em vez de queimar o resto das modalidades.
    var pausaAtual = PAUSA;
    var recusa = 0;

    function chama(url, tentativa){
      return getJSON(url, {}, 35000).then(function(r){
        if(r.status === 204) return { data: [] };   // pagina sem publicacoes: resposta boa
        if(r.status === 200 && r.data && typeof r.data === 'object') return r.data;
        if(r.status === 429){ recusa++; pausaAtual = Math.min(pausaAtual + 1200, 6000); }
        else recusa = 0;
        if(tentativa < 2 && recusa < 4)
          return espera(r.status === 429 ? 12000 : 1500).then(function(){ return chama(url, tentativa + 1); });
        return null;
      }).catch(function(){
        if(tentativa < 2 && recusa < 4) return espera(1500).then(function(){ return chama(url, tentativa + 1); });
        return null;
      });
    }

    // Duas paginas por modalidade: com uma so o indice fica em ~360 orgaos; com duas,
    // se o PNCP cooperativear, passa de 800 (medido em 2026-10-28).
    function varre(i, pagina){
      if(i >= MODALIDADES_IDX.length || recusa >= 4) return Promise.resolve();
      var url = BASE + '/contratacoes/publicacao?dataInicial=' + ini + '&dataFinal=' + fim +
                '&codigoModalidadeContratacao=' + MODALIDADES_IDX[i] + '&pagina=' + pagina + '&tamanhoPagina=50';
      return chama(url, 1).then(function(d){
        if(!d){ falhas++; return; }
        (d.data || []).forEach(function(x){
          var oe = x.orgaoEntidade || {}, un = x.unidadeOrgao || {};
          var cnpj = soDigitos(oe.cnpj);
          if(cnpj.length !== 14) return;
          if(!mapa[cnpj]) mapa[cnpj] = { cnpj: cnpj, nome: oe.razaoSocial || '', unidade: un.nomeUnidade || '',
            uf: un.ufSigla || '', municipio: un.municipioNome || '', vistas: 0 };
          mapa[cnpj].vistas++;
        });
      }).then(function(){ publica('curto'); }).then(function(){ return espera(pausaAtual); })
        .then(function(){ return varre(i + 1, pagina); });
    }

    function corpoDa(){
      return { fonte: 'PNCP',
        orgaos: Object.keys(mapa).map(function(k){ return mapa[k]; })
          .sort(function(a, b){ return b.vistas - a.vistas || a.nome.localeCompare(b.nome); }),
        atualizadoEm: Date.now(),
        amostra: { inicio: ini, fim: fim, modalidades: MODALIDADES_IDX, paginas: PAGINAS_IDX } };
    }

    // A cada chamada ja coletada vai indo para o cache e para a reserva: assim a lista
    // aparece em segundos e cresce sozinha, em vez de ficar em branco ate o fim da varredura.
    function publica(depois){
      var corpo = corpoDa();
      if(!corpo.orgaos.length) return corpo;
      if(depois === 'curto'){ cacheSet(ck, corpo, 60000); guardaChave('idx', corpo); }
      else { cacheSet(ck, corpo, falhas ? 2 * 3600000 : 12 * 3600000); guardaChave('idx', corpo); }
      return corpo;
    }

    // Quem chegou no comeco espera no maximo 20s; depois disso a resposta sai com o que
    // houver e a varredura continua em segundo plano. O vigia e repetido porque a primeira
    // chamada do PNCP pode levar 25s: com um timer so, quem chegou antes ficava preso
    // ate o fim da varredura inteira.
    var respondido = false;
    function atende(corpo){
      if(respondido || res.headersSent) return;
      respondido = true;
      clearInterval(vigia);
      res.json(Object.assign({ filtro: q || null, atualizando: true, parcial: falhas > 0 }, limitar(corpo)));
    }
    function garimpador(){
      if(respondido || res.headersSent) return;
      var corpo = corpoDa();
      if(corpo.orgaos.length >= 30 || Date.now() - inicioIdx > 20000) atende(corpo);
    }
    var vigia = setInterval(garimpador, 3000);

    varre(0, PAGINAS_IDX[0]).then(function(){
      return varre(0, PAGINAS_IDX[1]);
    }).then(function(){
      var corpo = publica('fim');
      if(respondido || res.headersSent) return;
      if(!corpo.orgaos.length){
        var reso = pegaReserva('idx');
        if(reso) return res.json(Object.assign({ filtro: q || null }, limitar(reso)));
        res.status(503).json({ erro: 'PNCP ocupado agora', detalhe: 'tente de novo em alguns minutos' });
        return;
      }
      respondido = true;
      res.json(Object.assign({ filtro: q || null, parcial: falhas > 0 }, limitar(corpo)));
    }).catch(function(e){
      if(res.headersSent) return;
      var reso = pegaReserva('idx');
      if(reso) return res.json(Object.assign({ filtro: q || null }, limitar(reso)));
      res.status(500).json({ erro: 'Indice de orgaos indisponivel', detalhe: e.message });
    }).then(function(){ clearInterval(vigia); EM_IDX = false; });
  });

  // ---- leitura do orgao no PNCP ----
  // O PNCP leva de 0,2s a 38s para responder a MESMA consulta e fica mais lento quando
  // recebe pedidos em sequencia, entao a ficha nao roda numa chamada so de 50 contratos:
  // ela puxa paginas de 10 ate a fonte enrolar. Quando enrola, o pedido responde na hora
  // "aguardando" (com o tanto que ja coletou) e o proximo pedido continua de onde parou.
  var TAM_PG = 10;
  var MAX_PG = 2;
  var ALVO = 20;
  var CORRE_MS = 8000;   // tempo que o trabalho fica puxando paginas sozinho num so pedido

  function novoTrabalho(cnpj, ano){
    return { cnpj: cnpj, ano: ano, ini: fmtPNCP(new Date(ano, 0, 1)), fim: fmtPNCP(new Date()),
      pagina: 1, dados: [], totalReg: null, tenta: 0, falha: false, pronto: false,
      inicio: Date.now(), correndo: false };
  }

  // Junta o que o trabalho coletou, guarda no cache e devolve a ficha.
  function fechar(ck){
    var t = TRABALHO[ck];
    if(!t) return null;
    delete TRABALHO[ck];
    delete AUSENTE[ck];
    if(!t.dados.length && t.falha){
      var e = new Error('O PNCP nao devolveu os contratos deste orgao'); e.codigo = 502; throw e;
    }
    var out = monta(t.cnpj, t.ano, t.ini, t.fim, t.dados.slice(0, ALVO),
                    t.totalReg !== null ? t.totalReg : t.dados.length);
    if(t.falha) out.parcial = true;
    cacheSet(ck, out, t.falha ? 30 * 60000 : 6 * 3600000);
    guardaChave(ck, out);
    return out;
  }
  // fechar() pode lancar; assim o erro vira rejeicao e o trabalho e sempre liberado
  function fechaDePOCO(ck){ return Promise.resolve().then(function(){ return fechar(ck); }); }

  // Uma pagina de contratos do orgao.
  function umaPagina(t, ck){
    var n = t.pagina;
    var url = BASE + '/contratos?cnpjOrgao=' + t.cnpj + '&dataInicial=' + t.ini + '&dataFinal=' + t.fim +
              '&pagina=' + n + '&tamanhoPagina=' + TAM_PG;
    return getJSON(url, {}, 35000).then(function(r){
      if(r.status === 422){
        AUSENTE[ck] = { em: Date.now(), corpo: { erro: 'Esse CNPJ nao aparece no PNCP', detalhe: 'pode ser orgao sem contratos publicados no periodo ou CNPJ digitado errado' } };
        delete TRABALHO[ck];
        var e = new Error('Esse CNPJ nao aparece no PNCP'); e.codigo = 404; throw e;
      }
      if(r.status !== 200 || !r.data || typeof r.data !== 'object'){
        t.falha = true; t.tenta++;
      } else {
        t.tenta = 0;
        if(typeof r.data.totalRegistros === 'number') t.totalReg = r.data.totalRegistros;
        var dados = r.data.data || [];
        t.dados = t.dados.concat(dados);
        if(dados.length < TAM_PG || t.dados.length >= ALVO) t.pronto = true; else t.pagina = n + 1;
      }
      if(t.tenta >= 3) t.pronto = true;
    }, function(){
      t.tenta++;
      if(t.tenta >= 3) t.pronto = true;
    });
  }

  // Puxa paginas em sequencia enquanto a fonte responde rapido; se ela enrolar, para,
  // deixa o "aguardando" responder e o proximo pedido do navegador continua de onde parou.
  function rodaPaginas(t, ck){
    if(t.pronto) return fechaDePOCO(ck);
    return umaPagina(t, ck).then(function(){
      if(t.pronto) return fechaDePOCO(ck);
      if(Date.now() - t.inicio < CORRE_MS && t.pagina <= MAX_PG) return rodaPaginas(t, ck);
      return null;
    });
  }

  // Devolve a ficha quando terminar, ou null se o trabalho ainda esta em andamento.
  function umPasso(cnpj, ano, ck){
    var t = TRABALHO[ck] || (TRABALHO[ck] = novoTrabalho(cnpj, ano));
    if(t.pronto) return fechaDePOCO(ck);
    if(t.correndo) return Promise.resolve(null);
    t.correndo = true;
    return Promise.resolve().then(function(){ return rodaPaginas(t, ck); }).then(function(out){
      t.correndo = false;
      return out;
    }, function(e){
      t.correndo = false;
      throw e;
    });
  }

  function monta(cnpj, ano, ini, fim, dados, total){
    if(!dados.length) return { fonte: 'PNCP', cnpj: cnpj, ano: ano, total: 0, periodo: { ini: ini, fim: fim },
      contratos: [], fornecedores: [], unidades: [] };
    var primeiro = dados[0].orgaoEntidade || {}, un0 = dados[0].unidadeOrgao || {};
    var fornecedores = {}, unidades = {}, soma = 0;

    var contratos = dados.map(function(x){
      var valor = Number(x.valorGlobal || x.valorInicial || 0) || 0;
      soma += valor;
      var forn = x.nomeRazaoSocialFornecedor || 'SEM FORNECEDOR INFORMADO';
      fornecedores[forn] = (fornecedores[forn] || { total: 0, qtd: 0 });
      fornecedores[forn].total += valor; fornecedores[forn].qtd++;
      var uni = (x.unidadeOrgao && x.unidadeOrgao.nomeUnidade) || un0.nomeUnidade || '';
      unidades[uni] = (unidades[uni] || { total: 0, qtd: 0 });
      unidades[uni].total += valor; unidades[uni].qtd++;
      return {
        id: x.numeroControlePncpCompra || x.numeroControlePNCP || '',
        objeto: String(x.objetoContrato || '').replace(/\s+/g, ' ').slice(0, 300),
        fornecedor: forn,
        cnpjFornecedor: soDigitos(x.niFornecedor),
        valor: valor,
        data: x.dataPublicacaoPncp || x.dataAssinatura || '',
        vigencia: x.dataVigenciaFim || '',
        unidade: uni,
        tipo: x.tipoContrato || '',
        emenda: x.emendaParlamentar ? String(x.emendaParlamentar) : ''
      };
    });

    var lista = function(obj){
      return Object.keys(obj).map(function(k){ return { nome: k, total: obj[k].total, qtd: obj[k].qtd }; })
        .sort(function(a, b){ return b.total - a.total; });
    };

    return {
      fonte: 'PNCP', cnpj: cnpj, ano: ano,
      orgao: primeiro.razaoSocial || '', esfera: primeiro.esferaId || '', poder: primeiro.poderId || '',
      unidade: un0.nomeUnidade || '', uf: un0.ufSigla || '', municipio: un0.municipioNome || '',
      periodo: { ini: ini, fim: fim },
      total: total,
      amostra: contratos.length,
      amostraLimitada: total > contratos.length,
      somaAmostra: soma,
      contratos: contratos,
      fornecedores: lista(fornecedores).slice(0, 12),
      unidades: lista(unidades).slice(0, 8),
      linkOficial: 'https://pncp.gov.br/app/editais?cnpj=' + cnpj
    };
  }

  // ---- rota da ficha ----
  // ?fundo=1 da um passo e devolve na hora (a pagina volta a perguntar ate chegar a ficha);
  // sem esse parametro a rota espera o que couber no prazo, para quem chega por link direto.
  app.get('/api/orgao', function(req, res){
    var cnpj = soDigitos(req.query.cnpj);
    if(cnpj.length !== 14) return res.status(400).json({ erro: 'CNPJ precisa ter 14 digitos' });
    var ano = parseInt(req.query.ano || '', 10) || new Date().getFullYear();
    if(ano < 2021 || ano > new Date().getFullYear() + 1) return res.status(400).json({ erro: 'Ano fora do intervalo' });
    var ck = 'orgao_' + cnpj + '_' + ano;
    var respostaParcial = function(){
      var t = TRABALHO[ck];
      return { aguardando: true, coletados: t ? t.dados.length : 0,
        total: (t && t.totalReg !== null) ? t.totalReg : null,
        aviso: 'Buscando os contratos deste orgao no PNCP.' };
    };

    var hit = cacheGet(ck);
    if(hit) return res.json(hit);
    var reserva = pegaReserva(ck);

    if(req.query.fundo){
      if(AUSENTE[ck] && (Date.now() - AUSENTE[ck].em) < 3600000) return res.status(404).json(AUSENTE[ck].corpo);
      // segura a resposta ate 4s: se a fonte responder logo, a ficha ja vem neste pedido
      Promise.race([umPasso(cnpj, ano, ck), espera(4000).then(function(){ return null; })])
        .then(function(out){
          if(out) return res.json(out);
          if(reserva) return res.json(reserva);
          res.json(respostaParcial());
        })
        .catch(function(e){
          if(e.codigo === 404) return res.status(404).json({ erro: e.message, detalhe: 'pode ser orgao sem contratos no periodo ou CNPJ digitado errado' });
          if(reserva) return res.json(reserva);
          res.json(respostaParcial());
        });
      return;
    }

    var prazo = Date.now() + 28000;
    (function varre(){
      var pronto = cacheGet(ck);
      if(pronto) return Promise.resolve(pronto);
      return umPasso(cnpj, ano, ck).then(function(out){
        if(out) return out;
        if(Date.now() > prazo) return null;
        return espera(300).then(varre);
      });
    })().then(function(out){
      if(out) return res.json(out);
      if(reserva) return res.json(reserva);
      res.json(respostaParcial());
    }).catch(function(e){
      if(reserva) return res.json(reserva);
      if(e.codigo === 404) return res.status(404).json({ erro: e.message, detalhe: 'pode ser orgao sem contratos no periodo ou CNPJ digitado errado' });
      res.status(e.codigo || 500).json({ erro: 'Ficha do orgao indisponivel', detalhe: e.message });
    });
  });
}

module.exports = { registrarOrgaos: registrarOrgaos };
