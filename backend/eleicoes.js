// BrBRICS - módulo Eleições 2026: planilhas oficiais do TSE (dados abertos, sem chave).
// Só expõe o básico público: descartamos CPF, nascimento, e-mail e título de eleitor
// na leitura, para que nenhum dado pessoal chegue ao cache nem ao navegador.
var fetch=null; try{fetch=require('node-fetch');}catch(e){}
var AdmZip=null; try{AdmZip=require('adm-zip');}catch(e){}
var ZIP_CAND='https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip';

// Campos que o portal mostra. Qualquer outro nome some daqui para frente.
var CAMPOS=['NM_CANDIDATO','NM_URNA_CANDIDATO','NR_CANDIDATO','DS_CARGO','SG_PARTIDO','NM_PARTIDO',
  'SG_UF','NM_UE','DS_SITUACAO_CANDIDATURA','NM_COLIGACAO','DS_COMPOSICAO_COLIGACAO','DS_OCUPACAO',
  'NM_TIPO_ELEICAO','DT_ELEICAO','SG_UE'];
var IGNORAR=/^(NR_CPF_CANDIDATO|NR_TITULO_ELEITORAL_CANDIDATO|DT_NASCIMENTO|DS_EMAIL|CD_EMAIL)$/i;

function tiraAspas(campo){
  var t=String(campo==null?'':campo).trim();
  if(t.length>1 && t.charAt(0)==='"' && t.charAt(t.length-1)==='"') return t.slice(1,-1);
  return t;
}
// A planilha do TSE é CSV separado por ";" e codificado em latin1.
function parsearCSV(texto){
  var linhas=texto.split(/\r?\n/).filter(function(l){return l.trim();});
  if(linhas.length<2) return [];
  var cabecalho=linhas[0].split(';').map(tiraAspas);
  var nomes=[], guarda=[];
  cabecalho.forEach(function(c,i){
    if(CAMPOS.indexOf(c)>=0 && IGNORAR.test(c)===false){ nomes.push(c); guarda.push(i); }
  });
  var out=[];
  for(var r=1;r<linhas.length;r++){
    var v=linhas[r].split(';');
    if(v.length<cabecalho.length-1) continue;
    var o={};
    for(var k=0;k<nomes.length;k++) o[nomes[k]]=tiraAspas(v[guarda[k]]);
    if(!o.NM_CANDIDATO) continue;
    out.push(o);
  }
  return out;
}
function abreviar(o){
  return {
    nome:o.NM_CANDIDATO||'',
    nomeUrna:o.NM_URNA_CANDIDATO||o.NM_CANDIDATO||'',
    numero:o.NR_CANDIDATO||'',
    cargo:o.DS_CARGO||'',
    partido:o.SG_PARTIDO||'',
    nomePartido:o.NM_PARTIDO||'',
    uf:o.SG_UF||'',
    municipio:o.NM_UE||'',
    situacao:o.DS_SITUACAO_CANDIDATURA||'',
    coligacao:o.NM_COLIGACAO||'',
    ocupacao:o.DS_OCUPACAO||'',
    tipoEleicao:o.NM_TIPO_ELEICAO||''
  };
}
function registrarEleicoes(app, cacheGet, cacheSet, getJSON){
  if(!fetch || !AdmZip){
    app.get('/api/eleicoes', function(req,res){
      res.status(503).json({erro:'Módulo de eleições indisponível no servidor', detalhe:'falta node-fetch/adm-zip'});
    });
    return;
  }
  // Todas as planilhas do zip viram uma lista única, guardada em cache por 6 horas.
  function carregarCandidatos(){
    var ck='el_cand_2026'; var hit=cacheGet(ck); if(hit) return Promise.resolve(hit);
    return fetch(ZIP_CAND,{headers:{'User-Agent':'BrBRICS/1.0'},timeout:120000})
      .then(function(r){
        if(r.status!==200) throw new Error('TSE respondeu HTTP '+r.status);
        return r.buffer();
      })
      .then(function(buf){
        var zip=new AdmZip(buf);
        var todos=[];
        zip.getEntries().forEach(function(e){
          if(!/\.csv$/i.test(e.entryName)) return;
          var regs=parsearCSV(zip.readAsText(e.entryName,'latin1'));
          for(var i=0;i<regs.length;i++) todos.push(abreviar(regs[i]));
        });
        if(!todos.length) throw new Error('nenhum candidato nas planilhas');
        var out={fonte:'TSE / Dados Abertos (consulta_cand_2026)', total:todos.length,
          atualizadoEm:new Date().toISOString(), lista:todos};
        cacheSet(ck,out,6*3600000);
        return out;
      });
  }
  function filtra(lista,q){
    var termo=String(q.nome||'').trim().toLowerCase();
    var uf=String(q.uf||'').trim().toUpperCase();
    var cargo=String(q.cargo||'').trim().toUpperCase();
    var partido=String(q.partido||'').trim().toUpperCase();
    var sit=String(q.situacao||'').trim().toLowerCase();
    return lista.filter(function(c){
      if(uf && c.uf!==uf) return false;
      if(cargo && c.cargo.indexOf(cargo)<0) return false;
      if(partido && c.partido!==partido) return false;
      if(sit && String(c.situacao).toLowerCase().indexOf(sit)<0) return false;
      if(termo){
        var alvo=(c.nome+' '+c.nomeUrna+' '+c.municipio).toLowerCase();
        if(alvo.indexOf(termo)<0) return false;
      }
      return true;
    });
  }
  function conta(lista, chave){
    var m={};
    lista.forEach(function(c){ var k=c[chave]||'—'; m[k]=(m[k]||0)+1; });
    return Object.keys(m).map(function(k){return {nome:k,total:m[k]};})
      .sort(function(a,b){return b.total-a.total;});
  }
  // /api/eleicoes?uf=SP&cargo=DEPUTADO&partido=PSDB&nome=silva&situacao=indefer&pagina=1&tamanho=50
  app.get('/api/eleicoes', function(req,res){
    var pagina=Math.max(parseInt(String(req.query.pagina||'1'),10)||1,1);
    var tamanho=Math.min(Math.max(parseInt(String(req.query.tamanho||'50'),10)||50,1),200);
    carregarCandidatos().then(function(base){
      var filtrados=filtra(base.lista,req.query);
      var ini=(pagina-1)*tamanho;
      res.json({fonte:base.fonte, atualizadoEm:base.atualizadoEm,
        totalNoPortal:base.total, totalfiltrado:filtrados.length, pagina:pagina, tamanhoPagina:tamanho,
        candidatos:filtrados.slice(ini,ini+tamanho)});
    }).catch(function(e){
      res.status(502).json({erro:'Planilhas do TSE indisponíveis', detalhe:String((e&&e.message)||e).slice(0,160)});
    });
  });
  // /api/eleicoes/resumo → contadores e rankings que cabem no topo da página
  app.get('/api/eleicoes/resumo', function(req,res){
    var ck='el_resumo_2026'; var hit=cacheGet(ck); if(hit) return res.json(hit);
    carregarCandidatos().then(function(base){
      var out={fonte:base.fonte, atualizadoEm:base.atualizadoEm, total:base.total,
        porCargo:conta(base.lista,'cargo').slice(0,12),
        porPartido:conta(base.lista,'partido').slice(0,30),
        porUf:conta(base.lista,'uf').slice(0,28),
        porSituacao:conta(base.lista,'situacao').slice(0,10)};
      cacheSet(ck,out,6*3600000); res.json(out);
    }).catch(function(e){
      res.status(502).json({erro:'Planilhas do TSE indisponíveis', detalhe:String((e&&e.message)||e).slice(0,160)});
    });
  });
}
module.exports={registrarEleicoes:registrarEleicoes};
