// BrBRICS - Areas do Direito (jurisprudencia + proposicoes + noticias por area)
function cnjLink(n){return 'https://comunica.pje.jus.br/consulta?termo='+encodeURIComponent(n||'');}
function camaraLink(id){return 'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao='+encodeURIComponent(id||'');}
function fmtNum(n){n=String(n||'');if(n.length===20)return n.slice(0,7)+'-'+n.slice(7,9)+'.'+n.slice(9,13)+'.'+n.slice(13,14)+'.'+n.slice(14,16)+'.'+n.slice(16,20);return n;}
var AREAS=[
 {k:'trabalhista',nome:'Trabalhista',tema:'trabalhista',kw:['trabalh','emprego','vinculo','fgts']},
 {k:'tributario',nome:'Tributário',tema:'tributário',kw:['tribut','icms','iss','imposto','taxa']},
 {k:'consumidor',nome:'Consumidor',tema:'consumidor',kw:['consumidor','plano','telefon']},
 {k:'penal',nome:'Penal',tema:'penal',kw:['penal','crime','pris','condena']},
 {k:'previdenciario',nome:'Previdenciário',tema:'previdenciario',kw:['previdenc','inss','aposentad','benefici']},
 {k:'ambiental',nome:'Ambiental',tema:'ambiental',kw:['ambient','licenci','ibama','meio ambiente']},
 {k:'civil',nome:'Civil',tema:'responsabilidade civil',kw:['civil','indeniza','dano','contrat']},
 {k:'administrativo',nome:'Administrativo',tema:'administrativo',kw:['administrat','licita','servidor','improbidade']},
 {k:'empresarial',nome:'Empresarial',tema:'empresarial',kw:['empresar','societ','recupera','falência','falencia']},
 {k:'eleitoral',nome:'Eleitoral',tema:'eleitoral',kw:['eleitor','tse','candidat','vot']},
 {k:'digital',nome:'Digital / LGPD',tema:'dados pessoais',kw:['dados','lgpd','digital','plataforma','big tech']},
 {k:'saude',nome:'Saúde',tema:'saúde',kw:['saude','saúde','ans','tratamento','ela']}
];
var _news=[];
function renderBar(){
 var bar=document.getElementById('areas-bar');
 bar.innerHTML=AREAS.map(function(a){return '<button class="btn ghost area-pill" data-k="'+a.k+'">'+esc(a.nome)+'</button>';}).join('');
 var pills=bar.querySelectorAll('.area-pill');
 for(var i=0;i<pills.length;i++){pills[i].onclick=function(){selectArea(this.getAttribute('data-k'),this);};}
}
function selectArea(k,btn){
 var a=AREAS.filter(function(x){return x.k===k;})[0];if(!a)return;
 var pills=document.querySelectorAll('.area-pill');
 for(var i=0;i<pills.length;i++)pills[i].classList.remove('active');
 if(btn)btn.classList.add('active');
 loadJur(a);loadProp(a);filterNews(a);
}
function loadJur(a){
 var st=document.getElementById('st-jur');st.textContent='Buscando...';
 document.getElementById('jur').innerHTML='<div class="skel"></div><div class="skel"></div>';
 jget('/api/tribunais/tema?tribunal=STJ&q='+encodeURIComponent(a.tema)+'&qtd=8').then(function(r){
  st.textContent=((r.totalAprox!=null)?Number(r.totalAprox).toLocaleString('pt-BR')+' processos':'-');
  document.getElementById('jur').innerHTML=(r.processos||[]).map(function(p){
   return '<article><span class="tag">'+esc(p.tribunal||'STJ')+'</span><h4><a href="'+cnjLink(p.numeroProcesso)+'" target="_blank" rel="noopener">'+esc(fmtNum(p.numeroProcesso))+'</a></h4><small class="muted">'+esc(p.classe||'')+' | '+esc(p.orgaoJulgador||'')+'</small></article>';
  }).join('')||'<p class="muted">Nada encontrado para esta área.</p>';
 }).catch(function(e){st.textContent='Erro: '+e.message;});
}
function loadProp(a){
 var st=document.getElementById('st-prop');st.textContent='Buscando...';
 document.getElementById('prop').innerHTML='<div class="skel"></div><div class="skel"></div>';
 jget('/api/legislacao/buscar?q='+encodeURIComponent(a.tema)+'&itens=8').then(function(r){
  st.textContent=(r.total||0)+' resultado(s)';
  document.getElementById('prop').innerHTML=(r.proposicoes||[]).map(function(x){
   return '<article><span class="tag">'+esc(x.siglaTipo)+' '+esc(x.numero)+'/'+esc(x.ano)+'</span><h4><a href="'+camaraLink(x.id)+'" target="_blank" rel="noopener">'+esc((x.ementa||'').slice(0,140))+'</a></h4></article>';
  }).join('')||'<p class="muted">Nada encontrado.</p>';
 }).catch(function(e){st.textContent='Erro: '+e.message;});
}
function filterNews(a){
 var st=document.getElementById('st-news');
 var all=[];_news.forEach(function(t){(t.noticias||[]).forEach(function(n){all.push({sigla:t.sigla,n:n});});});
 var kw=a.kw||[a.nome.toLowerCase()];
 var filt=all.filter(function(x){var s=(x.n.titulo||'').toLowerCase();return kw.some(function(k){return s.indexOf(k)>=0;});});
 var show=filt.length?filt:all.slice(0,4);
 st.textContent=filt.length?(filt.length+' relacionada(s)'):'destaques gerais';
  document.getElementById('news').innerHTML=show.map(function(x){
   var vd=x.n.video||'';var src=x.n.imagem||(vd?ytThumb(ytId(vd)):'');
   var img=src?'<div class="rss-img vid-wrap" style="margin:6px 0"><a class="vid-link" href="'+esc(vd||x.n.link)+'" target="_blank" rel="noopener" title="Abrir matéria original"><img src="'+esc(src)+'" alt="" style="max-width:100%;height:auto;border-radius:8px;max-height:160px;object-fit:cover">'+(vd?playIco():'')+'</a></div>':'';
   var rel=tempoRel(x.n.data);
   return '<article>'+img+'<div class="tag-row"><span class="tag">'+esc(x.sigla)+'</span>'+(vd?'<span class="tag">Vídeo</span>':'')+favBtnHTML(x.n.link,x.n.titulo)+'</div><h4><a href="'+esc(vd||x.n.link)+'" target="_blank" rel="noopener">'+esc((x.n.titulo||'').slice(0,150))+'</a></h4><small class="muted">'+esc(x.n.data||'')+(rel?' · '+esc(rel):'')+' · '+tempoLeitura(x.n.resumo)+'</small>'+shareHTML(x.n.link,x.n.titulo)+'</article>';
  }).join('')||emptyHTML('Sem notícias para esta área','Escolha outra área acima.');
}
function loadNews(){
 jget('/api/tribunais/noticias').then(function(r){
  _news=r.tribunais||[];
 }).catch(function(){});
}
renderBar();loadNews();
(function(){var first=document.querySelector('.area-pill');if(first){setTimeout(function(){first.click();},500);}})();
