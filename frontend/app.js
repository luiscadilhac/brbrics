// BrBRICS - homepage
function pncpLink(ctrl){if(!ctrl)return '';var p=String(ctrl).split('-');if(p.length<3)return '';var na=p[2].split('/');if(na.length<2)return '';return 'https://pncp.gov.br/app/editais/'+p[0]+'/'+p[1]+'/'+na[1];}
function propLink(id){return 'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao='+encodeURIComponent(id);}
function propIdFromUri(uri){var m=String(uri||'').match(/proposicoes\/(\d+)/);return m?m[1]:'';}
function fail(id,msg){var el=document.getElementById(id);if(el)el.innerHTML='<p class="muted">'+msg+' <button class="btn ghost" onclick="location.reload()">Tentar de novo</button></p>';}

// ===== Home Carousel (manchetes with images/videos) =====
var _homeCarItems=[], _homeCarIdx=0, _homeCarTimer=null;
function _homeFmtData(d){if(!d)return '';try{return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return d.slice(0,16);}}
function tickerHTML(){
  var base=window._tickerBase||'BrBRICS';
  var html='<span class="tick-market">'+esc(base)+'</span>';
  (window._tickerHeads||[]).forEach(function(n){
    html+='<span class="tick-sep"> /// </span><a href="'+escA(n.link)+'" target="_blank" rel="noopener"><span class="tick-ico">'+NAV_ICONS.news+'</span>'+esc(String(n.titulo||'').slice(0,90))+'</a>';
  });
  return html;
}
function renderTicker(){
  var tk=document.getElementById('ticker-in'); if(!tk)return;
  var html=tickerHTML();
  tk.innerHTML=html+'<span class="tick-sep"> /// </span>'+html;
}
function _homeBadge(cat){var map={reg:['reg','Agência'],min:['min','Ministério'],trib:['trib','Tribunal']};return map[cat]||['','Fonte'];}
function _homeIrCar(i){
  if(!_homeCarItems.length)return;
  _homeCarIdx=(i+_homeCarItems.length)%_homeCarItems.length;
  document.getElementById('home-car-track').style.transform='translateX(-'+(_homeCarIdx*100)+'%)';
  var ds=document.querySelectorAll('#home-car-dots button');
  for(var k=0;k<ds.length;k++)ds[k].className=(k===_homeCarIdx?'active':'');
}
function _homeIniciarAuto(){if(_homeCarTimer)clearInterval(_homeCarTimer);_homeCarTimer=setInterval(function(){_homeIrCar(_homeCarIdx+1);},5500);}
function _homeMontarCar(items){
  _homeCarItems=items;_homeCarIdx=0;
  var box=document.getElementById('home-carousel'),track=document.getElementById('home-car-track'),dots=document.getElementById('home-car-dots');
  if(items.length<2){box.style.display='none';return;}
  box.style.display='block';
  track.innerHTML=items.map(function(n,i){
    var b=_homeBadge(n.cat);var vd=n.video||'';var src=n.imagem||(vd?ytThumb(ytId(vd)):'');
    var vid=vd?'▶ Vídeo · ':'';
    var img=src?'<img loading="lazy" src="'+esc(src)+'" alt="" style="width:100%;height:100%;object-fit:cover">':'<div style="width:100%;height:100%;background:linear-gradient(135deg,#16161c,#0c0c0e)"></div>';
    var rel=tempoRel(n.data);
    return '<div class="car-slide" data-idx="'+i+'">'+img+(vd?playIco():'')+'<div class="car-fade"></div><div class="car-cap"><span class="badge '+b[0]+'">'+vid+b[1]+'</span><h3>'+esc(n.titulo)+'</h3><div class="car-meta">'+esc(n.fonteNome||n.fonte)+(rel?' · '+esc(rel):(n.data?' · '+_homeFmtData(n.data):''))+' · '+tempoLeitura(n.resumo)+' · <span class="car-cta">Ler matéria &#8599;</span></div></div></div>';
  }).join('');
  dots.innerHTML=items.map(function(_,i){return '<button data-dot="'+i+'" class="'+(i===0?'active':'')+'"></button>';}).join('');
  _homeIrCar(0);_homeIniciarAuto();
}
function _homeThumb(n){
  var vd=n.video||'';var src=n.imagem||(vd?ytThumb(ytId(vd)):'');
  var inner=src?'<a class="vid-link" href="'+esc(vd||n.link)+'" target="_blank" rel="noopener" title="Abrir matéria original"><img loading="lazy" src="'+esc(src)+'" alt="" onerror="this.closest(\'a\').style.display=\'none\';var t=this.closest(\'.news-thumb\');if(t){var x=t.querySelector(\'.noimg\');if(x)x.style.display=\'flex\';}">'+(vd?playIco():'')+'</a>':'';
  var noimg=src?'<div class="noimg" style="display:none">📰</div>':'<div class="noimg">📰</div>';
  return '<div class="news-thumb">'+inner+noimg+(vd&&!src?'<span class="badge vid">Vídeo</span>':'')+'</div>';
}
function _homeMeta(n){
  var b=_homeBadge(n.cat);var rel=tempoRel(n.data);
  return '<div class="news-src"><span class="badge '+b[0]+'">'+b[1]+'</span><span>'+(rel?esc(rel):_homeFmtData(n.data))+' · '+tempoLeitura(n.resumo)+'</span></div>';
}
function _homeHero(n){
  var b=_homeBadge(n.cat);var vd=n.video||'';var src=n.imagem||(vd?ytThumb(ytId(vd)):'');var rel=tempoRel(n.data);
  return '<article class="hero-news">'+(src?'<a class="hero-link" href="'+esc(vd||n.link)+'" target="_blank" rel="noopener" title="Abrir matéria original"><img class="hero-bg" loading="lazy" src="'+esc(src)+'" alt=""></a>'+(vd?playIco():''):'')
  +'<div class="hero-fade"></div><div class="hero-body"><span class="badge '+b[0]+'">'+(vd?'Vídeo · ':'')+b[1]+'</span> '+favBtnHTML(n.link,n.titulo)
  +'<h2><a href="'+esc(vd||n.link)+'" target="_blank" rel="noopener" data-link="'+esc(n.link)+'">'+esc(n.titulo)+'</a></h2>'
  +(n.resumo?'<p class="muted">'+esc(n.resumo.slice(0,180))+'…</p>':'')
  +'<div class="car-meta">'+esc(n.fonteNome||n.fonte)+(rel?' · '+esc(rel):(n.data?' · '+_homeFmtData(n.data):''))+' · '+tempoLeitura(n.resumo)+' · <span class="car-cta">Ler matéria &#8599;</span></div>'
  +shareHTML(n.link,n.titulo)+'</div></article>';
}
function _homeRenderGrid(items){
  var grid=document.getElementById('home-car-grid');
  if(!items.length){grid.innerHTML=emptyHTML('Sem manchetes com foto no momento','Atualize em alguns minutos.');return;}
  grid.style.display='grid';
  var html=_homeHero(items[0]);
  html+=items.slice(1).map(function(n){
    return '<article class="news-card">'+_homeThumb(n)+'<div class="news-body"><div class="tag-row">'+favBtnHTML(n.link,n.titulo)+'</div><h4><a href="'+esc(n.video||n.link)+'" target="_blank" rel="noopener" data-link="'+esc(n.link)+'">'+esc(n.titulo)+'</a></h4>'+(n.resumo?'<p>'+esc(n.resumo.slice(0,120))+'…</p>':'')+_homeMeta(n)+shareHTML(n.link,n.titulo)+'</div></article>';
  }).join('');
  grid.innerHTML=html;
}

// ===== Indicadores =====
jget('/api/indicadores').then(function(ind){
var d=ind.dados||{};var html='';
['ipca','selic','cambio','igpm'].forEach(function(k){var a=d[k]||[];var v=last(a);
var nums=a.map(function(p){return parseFloat(String(p.valor).replace(',','.'));}).filter(function(x){return !isNaN(x);});
var dif=nums.length>1?(nums[nums.length-1]-nums[nums.length-2]):null;
var tHtml=dif==null?'':(' <span class="tend '+(dif>0?'var-up':(dif<0?'var-down':'var-flat'))+'">'+(dif>0?'▲':(dif<0?'▼':'＝'))+' '+Math.abs(dif).toFixed(2)+'</span>');
html+='<div class="kpi">'+kpiIco(k)+'<b>'+k.toUpperCase()+'</b> - '+(v?esc(v.valor)+tHtml+' <span class="muted">('+esc(v.data)+')</span>':'indisponivel')+sparkSVG(nums.slice(-12),90,26,'#FFC400')+'</div>';});
  html+='<small class="muted">Fonte: '+(esc(ind.fonte||'BCB'))+(ind.offline?' (offline)':'')+'</small>';
  document.getElementById('indicadores').innerHTML=html;
  var ipca=last(d.ipca),selic=last(d.selic),cam=last(d.cambio);
  var tk=document.getElementById('ticker-in');
  if(tk){window._tickerBase='IPCA '+(ipca?ipca.valor:'-')+' | Selic '+(selic?selic.valor:'-')+' | Câmbio '+(cam?cam.valor:'-')+' | ';renderTicker();}
  var si=document.getElementById('st-ipca');if(si&&ipca)si.textContent=ipca.valor+'%';
  var ss=document.getElementById('st-selic');if(ss&&selic)ss.textContent=selic.valor+'%';
}).catch(function(e){fail('indicadores','BCB indisponivel no momento.');});

// ===== Licitações =====
jget('/api/licitacoes').then(function(lic){
  var itens=Array.isArray(lic.dados)?lic.dados.slice(0,6):[];
  var html='';
  itens.forEach(function(o){
    var link=pncpLink(o.numeroControlePNCP);
    var tit=esc((o.objetoCompra||'Contratação').slice(0,140));
    var org=o.orgaoEntidade?esc(o.orgaoEntidade.razaoSocial):'';
    var uf=o.unidadeOrgao?esc(o.unidadeOrgao.ufSigla||''):'';
    var valor=o.valorTotalEstimado?('R$ '+Number(o.valorTotalEstimado).toLocaleString('pt-BR',{maximumFractionDigits:2})):'';
    var meta=[esc(o.modalidadeNome||''),esc(o.situacaoCompraNome||''),org,(uf?('UF '+uf):''),esc(valor),(o.numeroControlePNCP?esc(o.numeroControlePNCP):'')].filter(function(x){return x;}).join(' · ');
    html+='<article class="lic-card"'+(link?' data-lnk="'+link+'" onclick="if(event.target.tagName!==\'A\'&&event.target.tagName!==\'BUTTON\')window.open(this.dataset.lnk,\'_blank\')"':'')+'><span class="tag">PNCP</span><h4>'+(link?'<a href="'+link+'" target="_blank" rel="noopener">'+tit+'</a>':tit)+'</h4><small class="muted">'+meta+'</small>'+(link?'<div class="toolbar" style="margin-top:8px"><a class="btn ghost" href="'+link+'" target="_blank" rel="noopener">Abrir edital no PNCP</a></div>':'')+'</article>';
  });
  document.getElementById('licitacoes').innerHTML=html||'<p class="muted">Sem registros no período.</p>';
  var st=document.getElementById('st-lic');if(st&&lic.total)st.textContent=Number(lic.total).toLocaleString('pt-BR');
}).catch(function(e){fail('licitacoes','PNCP indisponivel no momento.');});

// ===== Congresso =====
jget('/api/proposicoes').then(function(p){
  var itens=(p.dados||[]).slice(0,6);var html='';
  itens.forEach(function(x){var tit=esc((x.ementa||'Proposição').slice(0,150));
  html+='<article><span class="tag">'+esc(x.siglaTipo)+' '+esc(x.numero)+'</span><h4><a href="'+propLink(x.id)+'" target="_blank" rel="noopener">'+tit+'</a></h4></article>';});
  document.getElementById('congresso').innerHTML=html||'<p class="muted">Sem dados.</p>';
  var st=document.getElementById('st-prop');if(st)st.textContent=(p.dados||[]).length+' recentes';
}).catch(function(e){fail('congresso','Câmara indisponivel no momento.');});

// ===== DOU =====
jget('/api/dou').then(function(dou){
  var el=document.getElementById('manchetes');if(!el)return;
  el.innerHTML='<article><span class="tag">DOU</span><h4>Edição de hoje no Diário Oficial</h4><p><a href="'+dou.linkBusca+'" target="_blank" rel="noopener">Abrir busca do dia '+esc(dou.data)+' na Imprensa Nacional</a></p></article>';
}).catch(function(e){fail('manchetes','DOU indisponivel no momento.');});

// ===== Justiça (Tribunais) =====
jget('/api/tribunais/noticias').then(function(r){
  var html='';var n=0;
  (r.tribunais||[]).forEach(function(t){(t.noticias||[]).slice(0,2).forEach(function(x){
    if(n<6){n++;
      var vd=x.video||'';var src=x.imagem||(vd?ytThumb(ytId(vd)):'');
      var img = src ? '<div class="rss-img vid-wrap" style="margin:6px 0"><a class="vid-link" href="'+esc(vd||x.link)+'" target="_blank" rel="noopener" title="Abrir matéria original"><img src="'+esc(src)+'" alt="" style="width:100%;height:auto;border-radius:8px;max-height:160px;object-fit:cover">'+(vd?playIco():'')+'</a></div>' : '';
      var rel=tempoRel(x.data);
      html+='<article>'+img+'<div class="tag-row"><span class="tag">'+esc(t.sigla)+'</span>'+(vd?'<span class="tag">Vídeo</span>':'')+favBtnHTML(x.link,x.titulo)+'</div><h4><a href="'+esc(vd||x.link)+'" target="_blank" rel="noopener">'+esc((x.titulo||'').slice(0,120))+'</a></h4><small class="muted">'+esc(x.data||'')+(rel?' · '+esc(rel):'')+' · '+tempoLeitura(x.resumo)+'</small>'+shareHTML(x.link,x.titulo)+'</article>';
    }});});
  var el=document.getElementById('justica');if(el)el.innerHTML=html||emptyHTML('Sem notícias no momento','Atualize em alguns minutos.');
}).catch(function(){var el=document.getElementById('justica');if(el)el.innerHTML='<p class="muted">Feed de justiça indisponivel.</p>';});

// ===== Focus =====
jget('/api/focus').then(function(f){
  var ind=(f&&f.indicadores)||{};
  var html='';
  function row(nome,o,suf){ if(!o||!o.disponivel)return '<div class="kpi"><b>'+nome+'</b> - indisponivel</div>';
    var varhtml=''; if(o.variacao!=null){var cls=o.variacao>0?'var-up':(o.variacao<0?'var-down':'var-flat');var sinal=o.variacao>0?'+':'';varhtml=' <span class="'+cls+'">'+sinal+o.variacao.toFixed(2)+' vs sem. anterior</span>';}
    return '<div class="kpi"><b>'+nome+' 2026</b> - '+esc(String(o.mediana))+suf+varhtml+' <span class="muted">('+esc(o.data)+')</span></div>'; }
  html+=row('IPCA',ind.ipca,'%');
  html+=row('Selic',ind.selic,'%');
  html+=row('Cambio',ind.cambio,' R$');
  html+=row('PIB',ind.pib,'%');
  html+='<small class="muted">Fonte: '+esc(f.fonte||'BCB')+' | projeção anual 2026 (mediana top 5)</small>';
  var el=document.getElementById('focus'); if(el)el.innerHTML=html;
}).catch(function(){var el=document.getElementById('focus'); if(el)el.innerHTML='<p class="muted">Boletim Focus indisponivel no momento.</p>';});

// ===== Home Carousel (manchetes) =====
jget('/api/manchetes').then(function(r){
  document.getElementById('home-car-loading').style.display='none';
  var items=(r.manchetes||[]).map(function(n){ if(!n.imagem&&n.video){n.imagem=ytThumb(ytId(n.video));} return n; });
  var comImg=items.filter(function(n){return n.imagem;});
  var paraCarrossel=comImg.slice(0,5);
  if(paraCarrossel.length<3)paraCarrossel=items.slice(0,5);
  if(paraCarrossel.length){_homeMontarCar(paraCarrossel);}
  _homeRenderGrid(comImg.slice(0,12));
  // Ticker: mercado + últimas manchetes (breaking, com links)
  window._tickerHeads=items.slice(0,5).map(function(n){return {titulo:n.titulo,link:n.link};});
  renderTicker();
}).catch(function(){document.getElementById('home-car-loading').textContent='Erro ao carregar manchetes.';});

// ===== Reguladores Home =====
jget('/api/reguladores').then(function(r){
  var html='';var count=0;
  (r.orgaos||[]).forEach(function(t){
    if(t.erro)return;
    (t.noticias||[]).slice(0,2).forEach(function(n){
      if(count>=8)return;count++;
      var vd=n.video||'';var src=n.imagem||(vd?ytThumb(ytId(vd)):'');
      var img = src ? '<div class="rss-img vid-wrap" style="margin:6px 0"><a class="vid-link" href="'+esc(vd||n.link)+'" target="_blank" rel="noopener" title="Abrir matéria original"><img src="'+esc(src)+'" alt="" style="width:100%;height:auto;border-radius:8px;max-height:140px;object-fit:cover">'+(vd?playIco():'')+'</a></div>' : '';
      var rel=tempoRel(n.data);
      html+='<article>'+img+'<div class="tag-row"><span class="tag">'+esc(t.sigla)+'</span>'+(vd?'<span class="tag">Vídeo</span>':'')+favBtnHTML(n.link,n.titulo)+'</div><h4><a href="'+esc(vd||n.link)+'" target="_blank" rel="noopener">'+esc((n.titulo||'').slice(0,110))+'</a></h4><small class="muted">'+(rel?esc(rel):_homeFmtData(n.data))+' · '+esc(t.sigla)+' · '+tempoLeitura(n.resumo)+'</small>'+shareHTML(n.link,n.titulo)+'</article>';
    });
  });
  document.getElementById('reguladores-home').innerHTML=html||emptyHTML('Sem atualizações no momento','Atualize em alguns minutos.');
}).catch(function(){document.getElementById('reguladores-home').innerHTML='<p class="muted">Feed de reguladores indisponivel.</p>';});

// ===== Carousel Navigation =====
document.getElementById('home-car-prev').onclick=function(){_homeIrCar(_homeCarIdx-1);_homeIniciarAuto();};
document.getElementById('home-car-next').onclick=function(){_homeIrCar(_homeCarIdx+1);_homeIniciarAuto();};
document.getElementById('home-car-dots').addEventListener('click',function(e){var d=e.target.getAttribute('data-dot');if(d!=null){_homeIrCar(parseInt(d,10));_homeIniciarAuto();}});

// ===== Carousel click to open (matéria original em nova aba) =====
document.getElementById('home-car-track').addEventListener('click',function(e){
  var slide=e.target.closest('.car-slide');
  if(slide&&slide.getAttribute('data-idx')!=null){
    var idx=parseInt(slide.getAttribute('data-idx'),10);
    var it=_homeCarItems[idx];
    if(it&&(it.video||it.link)){var dest=it.video||it.link;trackLeitura(dest,it.titulo,it.fonteNome||it.fonte);window.open(dest,'_blank','noopener');}
  }
});

// ===== Mercado (bolsa, câmbio, cripto) =====
function mktVar(v,suf){
  if(v==null||isNaN(+v))return '<span class="mkt-flat">—</span>';
  v=+v;var cls=v>0?'mkt-up':(v<0?'mkt-down':'mkt-flat');
  var sinal=v>0?'+':'';
  return '<span class="'+cls+'">'+sinal+Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})+(suf||'%')+'</span>';
}
jget('/api/mercado/resumo').then(function(m){
  var ps=((m.bolsa&&m.bolsa.papeis)||[]);
  var hb=ps.map(function(p){
    var isIdx=p.symbol==='^BVSP';
    return '<tr><td><span class="mkt-sym">'+esc(isIdx?'Ibovespa':p.symbol)+'</span><br><small class="muted">'+esc(isIdx?'B3':String(p.nome||'').slice(0,26))+'</small></td>'
    +'<td style="text-align:right"><b>'+(p.preco!=null?Number(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—')+'</b><br>'+mktVar(p.varPct)+'</td></tr>';
  }).join('');
  var elB=document.getElementById('mercado-bolsa');
  if(elB)elB.innerHTML=hb?('<table class="mkt-table">'+hb+'</table><small class="muted">Fonte: '+esc((m.bolsa&&m.bolsa.fonte)||'Brapi/B3')+(m.bolsa&&m.bolsa.aviso?' · '+esc(m.bolsa.aviso):'')+'</small>'):emptyHTML('Bolsa indisponível','Tente mais tarde.');
  var px=m.ptax||{};
  var elC=document.getElementById('mercado-cambio');
  if(elC)elC.innerHTML=px.venda?('<div class="kpis"><div class="kpi"><b>Dólar comercial (PTAX)</b> — R$ '+Number(px.venda).toLocaleString('pt-BR',{minimumFractionDigits:4})+' <span class="muted">('+esc(String(px.data||'').slice(0,10))+')</span></div><small class="muted">Compra R$ '+Number(px.compra).toLocaleString('pt-BR',{minimumFractionDigits:4})+' · Fonte: '+esc(px.fonte||'BCB')+'</small></div>'):emptyHTML('Câmbio indisponível','Tente mais tarde.');
  var cs=((m.cripto&&m.cripto.moedas)||[]);
  var hc=cs.map(function(c){
    return '<tr><td><span class="mkt-sym">'+esc(c.sigla)+'</span> <small class="muted">'+esc(c.nome)+'</small></td>'
    +'<td style="text-align:right">US$ '+(c.usd!=null?Number(c.usd).toLocaleString('pt-BR',{maximumFractionDigits:2}):'—')+'<br><small class="muted">R$ '+(c.brl!=null?Number(c.brl).toLocaleString('pt-BR',{maximumFractionDigits:2}):'—')+'</small></td>'
    +'<td style="text-align:right">'+mktVar(c.varUsd)+'</td></tr>';
  }).join('');
  var elK=document.getElementById('mercado-cripto');
  if(elK)elK.innerHTML=hc?('<table class="mkt-table">'+hc+'</table><small class="muted">Fonte: CoinGecko · variação 24h</small>'):emptyHTML('Cripto indisponível','Tente mais tarde.');
}).catch(function(){['mercado-bolsa','mercado-cripto','mercado-cambio'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='<p class="muted">Mercado indisponível.</p>';});});

// ===== Letreiro de mercado no topo (bolsa, câmbio, cripto) =====
function mktTickHTML(d){
  var html='';
  ((d.bolsa&&d.bolsa.papeis)||[]).slice(0,4).forEach(function(p){
    var v=+p.varPct||0, cls=v>0?'mkt-up':(v<0?'mkt-down':'mkt-flat'), s=v>0?'+':'';
    html+='<span class="tick-sep"> /// </span><a href="https://www.google.com/finance/quote/'+escA(p.symbol)+':BVMF" target="_blank" rel="noopener"><span class="tick-ico">'+NAV_ICONS.chart+'</span>'+esc(p.symbol)+' '+(p.preco!=null?Number(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—')+' <span class="'+cls+'">'+s+Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%</span></a>';
  });
  ((d.cripto&&d.cripto.moedas)||[]).slice(0,3).forEach(function(c){
    var v=+c.varUsd||0, cls=v>0?'mkt-up':(v<0?'mkt-down':'mkt-flat'), s=v>0?'+':'';
    html+='<span class="tick-sep"> /// </span><a href="https://www.coingecko.com/en/coins/'+escA(c.id)+'" target="_blank" rel="noopener"><span class="tick-ico">'+NAV_ICONS.trend+'</span>'+esc(c.sigla)+' US$ '+(c.usd!=null?Number(c.usd).toLocaleString('pt-BR',{maximumFractionDigits:2}):'—')+' <span class="'+cls+'">'+s+Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%</span></a>';
  });
  var px=d.ptax||{};
  if(px.venda){
    html+='<span class="tick-sep"> /// </span><a href="indicadores.html"><span class="tick-ico">'+NAV_ICONS.banknote+'</span>Dólar R$ '+Number(px.venda).toLocaleString('pt-BR',{minimumFractionDigits:4})+'</a>';
  }
  return html;
}
function renderMktTicker(d){
  var box=document.getElementById('ticker-mkt'); if(!box)return;
  var html=mktTickHTML(d);
  if(!html)return;
  box.innerHTML=html+'<span class="tick-sep"> /// </span>'+html;
}
jget('/api/mercado/resumo').then(function(m){renderMktTicker(m);}).catch(function(){var el=document.getElementById('ticker-mkt');if(el)el.innerHTML='<span class="muted">Mercado indisponível no momento</span>';});