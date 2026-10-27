// BrBRICS - DOU (Imprensa Nacional): a fonte oficial nao tem RSS.
// A pagina de leitura embute um JSON (script#params -> jsonArray) com todos os atos do dia.
var fetch = require('node-fetch');

var BASE = 'https://www.in.gov.br';
var DIACRITICOS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
var TIMEOUT = 20000;

function fmtData(d) {
  function p(n) { return String(n).padStart(2, '0'); }
  return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
}
function dataParaBR(iso) {
  var partes = String(iso || '').split('-');
  if (partes.length !== 3) return iso || '';
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

// Baixa os atos de uma secao (do1|do2|do3) de um dia DD-MM-YYYY.
function baixarSecao(secao, data) {
  var url = BASE + '/leiturajornal?data=' + data + '&secao=' + secao;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
  return fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'BrBRICS/1.0', 'Accept': 'text/html' } })
    .then(function (r) {
      clearTimeout(timer);
      if (r.status !== 200) throw new Error('DOU HTTP ' + r.status);
      return r.text();
    })
    .then(function (html) {
      var m = html.match(/<script id="params"[^>]*>([\s\S]*?)<\/script>/i);
      if (!m) throw new Error('DOU: bloco de atos nao encontrado na pagina');
      var j;
      try { j = JSON.parse(m[1]); } catch (e) { throw new Error('DOU: JSON de atos invalido'); }
      var atos = Array.isArray(j.jsonArray) ? j.jsonArray : [];
      return { data: j.dateUrl || data, secao: String(j.section || secao).toUpperCase(), atos: atos };
    });
}

// Hoje nao tem edicao (fim de semana/feriado) ou a origem falhou: volta ate 7 dias.
function ultimosDias(secao, tentativas) {
  var lista = [];
  var agora = new Date();
  for (var i = 0; i < (tentativas || 7); i++) lista.push(fmtData(new Date(agora.getTime() - i * 86400000)));
  function tenta(i, ultimoErro) {
    if (i >= lista.length) {
      return Promise.resolve({ data: lista[lista.length - 1], secao: String(secao).toUpperCase(), atos: [], erro: ultimoErro });
    }
    return baixarSecao(secao, lista[i]).then(function (r) {
      if (r.atos.length) return r;
      return tenta(i + 1, ultimoErro);
    }).catch(function (e) {
      return tenta(i + 1, ultimoErro || String((e && e.message) || e));
    });
  }
  return tenta(0, null);
}

var NORMATIVOS = ['lei', 'decreto', 'decreto legislativo', 'medida provisoria', 'resolucao',
  'resolucao normativa', 'deliberacao', 'deliberacao normativa', 'regimento', 'portaria',
  'portaria conjunta', 'ato', 'ato declaratorio', 'alvara', 'termo de homologacao', 'ordem'];
var EDITAIS = ['edital', 'aviso', 'extrato', 'extrato de contrato', 'contrato', 'termo',
  'resultado', 'homologacao', 'adjudicacao', 'notificacao', 'intimacao', 'pregao', 'dispensa', 'ata'];

function chave(t) { return String(t || '').normalize('NFD').replace(DIACRITICOS, '').toLowerCase(); }

function prioridade(ato, pesos) {
  var tipo = chave(ato.artType);
  for (var i = 0; i < pesos.length; i++) if (chave(pesos[i]) === tipo) return i;
  return pesos.length + 10;
}

// Converte um ato bruto no formato que o frontend ja usa (titulo/link/data/orgao/secao).
function mapeiaAto(ato, rotuloSecao, tipo) {
  var titulo = String(ato.title || ato.titulo || '').trim() || String(ato.artType || 'Ato') + ' sem titulo';
  var hier = String(ato.hierarchyStr || '').split('/').filter(Boolean);
  var orgao = hier.length ? hier[0].trim() : (hier[1] || '').trim();
  var link = ato.urlTitle ? (BASE + '/web/dou/-/' + ato.urlTitle) : (BASE + '/leiturajornal?data=' + dataParaBR(ato.pubDate || ''));
  return {
    secao: rotuloSecao,
    tipo: tipo,
    artType: ato.artType || '',
    titulo: titulo,
    link: link,
    data: ato.pubDate || '',
    orgao: orgao,
    pagina: ato.numberPage || '',
    resumo: String(ato.content || '').replace(/\s+/g, ' ').slice(0, 260)
  };
}

// Seleciona destaques: tipos relevantes primeiro, órgãos centrais primeiro e
// teto por tipo/orgao para a lista nao virar repeticao de uma autarquia so.
function destaques(atos, rotuloSecao, tipo, pesos, limite) {
  limite = limite || 10;
  var ordenados = (atos || [])
    .map(function (a) { return { a: a, p: prioridade(a, pesos), h: String(a.hierarchyStr || '').split('/').filter(Boolean).length || 9 }; })
    .sort(function (x, y) { return x.p - y.p || x.h - y.h; });
  var porTipo = {}, porOrgao = [], sair = [];
  for (var i = 0; i < ordenados.length && sair.length < limite; i++) {
    var m = mapeiaAto(ordenados[i].a, rotuloSecao, tipo);
    var t = chave(m.artType), o = chave(m.orgao);
    if (String(m.titulo).trim().length < 12 || o.indexOf('ineditoriais') >= 0) continue;
    if ((porTipo[t] || 0) >= 3) continue;
    if (porOrgao.filter(function (x) { return x === o; }).length >= 2) continue;
    porTipo[t] = (porTipo[t] || 0) + 1;
    porOrgao.push(o);
    sair.push(m);
  }
  return sair;
}

module.exports = {
  fmtData: fmtData,
  baixarSecao: baixarSecao,
  ultimosDias: ultimosDias,
  mapeiaAto: mapeiaAto,
  destaques: destaques,
  NORMATIVOS: NORMATIVOS,
  EDITAIS: EDITAIS,
  BASE: BASE
};
