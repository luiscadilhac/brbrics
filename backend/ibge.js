// BrBRICS - modulo IBGE: territorio, nomes, noticias e PAM/SIDRA (sem chave)
var IBGE1 = 'https://servicodados.ibge.gov.br/api/v1';
var IBGE2 = 'https://servicodados.ibge.gov.br/api/v2';
var IBGE3 = 'https://servicodados.ibge.gov.br/api/v3';
var DIA = 86400000;
// As 27 UFs sao informacao fixa: estados nao mudam de codigo, nome nem regiao.
// A fonte atende navegadores no Brasil mas deixa o servidor no exterior pendurado,
// e a lista indisponivel derrubava o coroplote e os seletores de tres paginas.
var UFS = [
  [11,'RO','Rondônia','Norte'],[12,'AC','Acre','Norte'],[13,'AM','Amazonas','Norte'],
  [14,'RR','Roraima','Norte'],[15,'PA','Pará','Norte'],[16,'AP','Amapá','Norte'],
  [17,'TO','Tocantins','Norte'],[21,'MA','Maranhão','Nordeste'],[22,'PI','Piauí','Nordeste'],
  [23,'CE','Ceará','Nordeste'],[24,'RN','Rio Grande do Norte','Nordeste'],[25,'PB','Paraíba','Nordeste'],
  [26,'PE','Pernambuco','Nordeste'],[27,'AL','Alagoas','Nordeste'],[28,'SE','Sergipe','Nordeste'],
  [29,'BA','Bahia','Nordeste'],[31,'MG','Minas Gerais','Sudeste'],[32,'ES','Espírito Santo','Sudeste'],
  [33,'RJ','Rio de Janeiro','Sudeste'],[35,'SP','São Paulo','Sudeste'],[41,'PR','Paraná','Sul'],
  [42,'SC','Santa Catarina','Sul'],[43,'RS','Rio Grande do Sul','Sul'],[50,'MS','Mato Grosso do Sul','Centro-Oeste'],
  [51,'MT','Mato Grosso','Centro-Oeste'],[52,'GO','Goiás','Centro-Oeste'],[53,'DF','Distrito Federal','Centro-Oeste']
];
function numBR(v){ var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.')); return isNaN(n)?null:n; }
function registrarIBGE(app, cacheGet, cacheSet, getJSON){
  function erro502(res,e){ res.status(502).json({erro:'IBGE indisponível', detalhe:String((e&&e.message)||e).slice(0,200)}); }

  // UFs
  app.get('/api/ibge/estados', function(req,res){
    res.json({fonte:'IBGE - Localidades (tabela embutida)', total:UFS.length,
      estados:UFS.map(function(u){return {id:u[0], sigla:u[1], nome:u[2], regiao:u[3]};})});
  });

  // Municípios por UF (sigla ou código)
  app.get('/api/ibge/municipios', function(req,res){
    var uf=String(req.query.uf||'').trim();
    if(!uf) return res.status(400).json({erro:'Informe uf (sigla ou código IBGE).'});
    var ck='ibge_mun_'+uf.toLowerCase(); var hit=cacheGet(ck); if(hit) return res.json(hit);
    getJSON(IBGE1+'/localidades/estados/'+encodeURIComponent(uf)+'/municipios?orderBy=nome').then(function(r){
      var out={fonte:'IBGE - Localidades', uf:uf, total:(r.data||[]).length,
        municipios:(r.data||[]).map(function(m){return {id:m.id, nome:m.nome};})};
      cacheSet(ck,out,7*DIA); res.json(out);
    }).catch(function(e){erro502(res,e);});
  });

  // Detalhe do município + população estimada
  app.get('/api/ibge/municipio/:codigo', function(req,res){
    var cod=String(req.params.codigo||'').replace(/\D/g,'');
    if(cod.length!==7) return res.status(400).json({erro:'Código IBGE deve ter 7 dígitos.'});
    var ck='ibge_m_'+cod; var hit=cacheGet(ck); if(hit) return res.json(hit);
    var ano=new Date().getFullYear()-2;
    Promise.all([
      getJSON(IBGE1+'/localidades/municipios/'+cod),
      getJSON(IBGE3+'/agregados/6579/periodos/'+ano+'/variaveis/9324?localidades=N6['+cod+']').catch(function(){return null;})
    ]).then(function(rs){
      var m=rs[0].data||{};
      var ufSigla='', regiao='';
      try{ufSigla=m.microrregiao.mesorregiao.UF.sigla; regiao=m.microrregiao.mesorregiao.UF.regiao.nome;}catch(e){}
      var pop=null;
      try{var s=rs[1]&&rs[1].data&&rs[1].data[0].resultados[0].series[0].serie; pop={ano:ano, valor:numBR(s[ano])};}catch(e){}
      var out={fonte:'IBGE - Localidades + Estimativas de População',
        municipio:{id:m.id, nome:m.nome, uf:ufSigla, regiao:regiao, regiaoImediata:((m['regiao-imediata']||{}).nome)||''},
        populacao:pop};
      cacheSet(ck,out,7*DIA); res.json(out);
    }).catch(function(e){erro502(res,e);});
  });

  // Ranking de nomes
  app.get('/api/ibge/nomes', function(req,res){
    var nome=String(req.query.nome||'').trim();
    if(!nome) return res.status(400).json({erro:'Informe nome.'});
    var ck='ibge_n_'+nome.toLowerCase(); var hit=cacheGet(ck); if(hit) return res.json(hit);
    getJSON(IBGE2+'/censos/nomes/'+encodeURIComponent(nome)).then(function(r){
      var out={fonte:'IBGE - Nomes no Brasil', nome:nome, resultados:r.data||[]};
      cacheSet(ck,out,7*DIA); res.json(out);
    }).catch(function(e){erro502(res,e);});
  });

  // Notícias da Agência IBGE
  app.get('/api/ibge/noticias', function(req,res){
    var qtd=Math.min(Math.max(parseInt(req.query.qtd||'10',10)||10,1),30);
    var tipo=String(req.query.tipo||'');
    var ck='ibge_not_'+qtd+'_'+tipo; var hit=cacheGet(ck); if(hit) return res.json(hit);
    var url=IBGE3+'/noticias/?qtd='+qtd+(tipo?'&tipo='+encodeURIComponent(tipo):'');
    getJSON(url).then(function(r){
      var d=r.data||{};
      var items=(d.items||[]).map(function(n){
        var img='';
        try{var im=JSON.parse(n.imagens||'{}');var p=im.image_intro||im.image_fulltext||'';if(p)img='https://agenciadenoticias.ibge.gov.br/'+p;}catch(e){}
        return {titulo:n.titulo, link:n.link, data:n.data_publicacao, resumo:n.introducao||'', editoria:n.editorias||'', tipo:n.tipo||'', imagem:img, destaque:!!n.destaque};
      });
      var out={fonte:'Agência IBGE de Notícias', total:d.count||items.length, noticias:items};
      cacheSet(ck,out,3600000); res.json(out);
    }).catch(function(e){erro502(res,e);});
  });

  // PAM - safra: /api/ibge/pam?produto=40124&uf=35&ano=2024&vars=214,215 (uf=all|UF|mun7d; produto=all p/ ranking)
  app.get('/api/ibge/pam', function(req,res){
    var prod=String(req.query.produto||'40124');
    var uf=String(req.query.uf||'all');
    var ano=String(req.query.ano||'2024').replace(/\D/g,'')||'2024';
    var vars=String(req.query.vars||'214,215');
    var loc = uf==='all' ? 'N3[all]' : (/^\d{7}$/.test(uf) ? 'N6['+uf+']' : 'N3['+uf+']');
    var cat = (prod==='all') ? '782[all]' : '782['+prod.replace(/\D/g,'')+']';
    var ck='ibge_pam_'+prod+'_'+uf+'_'+ano+'_'+vars; var hit=cacheGet(ck); if(hit) return res.json(hit);
    var url=IBGE3+'/agregados/5457/periodos/'+ano+'/variaveis/'+vars+'?localidades='+loc+'&classificacao='+cat;
    getJSON(url,{},30000).then(function(r){
      var series=(r.data||[]).map(function(s){
        var dados=[];
        (s.resultados||[]).forEach(function(rr){
          var prodNome='';
          try{var cats=(rr.classificacoes||[])[0];var keys=Object.keys(cats.categoria||{});prodNome=keys.length?cats.categoria[keys[0]]:'';}catch(e){}
          (rr.series||[]).forEach(function(x){
            dados.push({localidade:x.localidade.nome, ibge:x.localidade.id, produto:prodNome, valor:numBR((x.serie||{})[ano]), bruto:(x.serie||{})[ano]});
          });
        });
        dados.sort(function(a,b){return (b.valor||0)-(a.valor||0);});
        return {variavel:s.variavel, unidade:s.unidade, dados:dados.slice(0,60)};
      });
      var out={fonte:'IBGE/PAM - Produção Agrícola Municipal', ano:ano, series:series};
      cacheSet(ck,out,7*DIA); res.json(out);
    }).catch(function(e){erro502(res,e);});
  });
}
module.exports={registrarIBGE:registrarIBGE};
