// BrBRICS - pagina Tribunais (DataJud + RSS)
function pncpJudLink(n){return 'https://comunica.pje.jus.br/consulta?termo='+encodeURIComponent(n);}
function fmtNum(n){n=String(n||'');if(n.length===20)return n.slice(0,7)+'-'+n.slice(7,9)+'.'+n.slice(9,13)+'.'+n.slice(13,14)+'.'+n.slice(14,16)+'.'+n.slice(16,20);return n;}
function fmtData(d){d=String(d||'');if(/^\d{14}$/.test(d))return d.slice(6,8)+'/'+d.slice(4,6)+'/'+d.slice(0,4);return d.slice(0,10);}
function abrirDetalhe(sigla,numero){
var st=document.getElementById('st-detalhe');
if(st)st.textContent='Buscando detalhe de '+fmtNum(numero)+'...';
document.getElementById('res-detalhe').innerHTML='<div class="skel"></div><div class="skel"></div>';
jget('/api/tribunais/detalhe?tribunal='+encodeURIComponent(sigla)+'&numero='+encodeURIComponent(numero)).then(function(r){
var p=r.processo;
if(!p){if(st)st.textContent='Processo nao encontrado no '+sigla+'.';
document.getElementById('res-detalhe').innerHTML='<article><span class="tag">'+esc(sigla)+'</span><h4>'+esc(fmtNum(numero))+'</h4><small class="muted">Sem detalhe disponivel. <a href="'+pncpJudLink(numero)+'" target="_blank" rel="noopener">Consultar no portal do CNJ</a></small></article>';
return;}
var html='<article><span class="tag">'+esc(sigla)+'</span><h4>'+esc(fmtNum(p.numeroProcesso))+' - '+esc(p.classe||'')+'</h4>';
html+='<small class="muted">Orgao: '+esc(p.orgaoJulgador||'')+' | Grau: '+esc(p.grau||'')+' | Ajuizado: '+esc(fmtData(p.dataAjuizamento))+'</small>';
if(p.assuntos&&p.assuntos.length)html+='<p><b>Assuntos:</b> '+esc(p.assuntos.join('; '))+'</p>';
if(p.movimentacoes&&p.movimentacoes.length){
html+='<div class="timeline">';
p.movimentacoes.forEach(function(m){html+='<div class="tl-item"><div class="tl-date">'+esc(fmtData(m.data))+'</div><div class="tl-body">'+esc(m.nome)+'</div></div>';});
html+='</div>';}
html+='<p><a class="btn ghost" href="'+pncpJudLink(numero)+'" target="_blank" rel="noopener">Ver no portal do CNJ</a></p>';
html+='</article>';
if(st)st.textContent='Detalhe de '+fmtNum(p.numeroProcesso);
document.getElementById('res-detalhe').innerHTML=html;
}).catch(function(e){if(st)st.textContent='Erro ao buscar detalhe: '+e.message;});
}
function pcDetalheHTML(p,numero){
  if(!p)return '<small class="muted">Sem detalhe. <a href="'+pncpJudLink(numero)+'" target="_blank" rel="noopener">Consultar no CNJ</a></small>';
  var h='<small class="muted">Orgao: '+esc(p.orgaoJulgador||'')+' | Grau: '+esc(p.grau||'')+' | Ajuizado: '+esc(fmtData(p.dataAjuizamento))+'</small>';
  if(p.assuntos&&p.assuntos.length)h+='<p><b>Assuntos:</b> '+esc(p.assuntos.join('; '))+'</p>';
  if(p.movimentacoes&&p.movimentacoes.length){h+='<div class="timeline">';p.movimentacoes.forEach(function(m){h+='<div class="tl-item"><div class="tl-date">'+esc(fmtData(m.data))+'</div><div class="tl-body">'+esc(m.nome)+'</div></div>';});h+='</div>';}
  else{h+='<p class="muted">Sem movimentacoes listadas.</p>';}
  h+='<p><a class="btn ghost" href="'+pncpJudLink(numero)+'" target="_blank" rel="noopener">Ver no portal do CNJ</a></p>';
  return h;
}
function carregarInline(sigla,numero){
  var box=document.getElementById('pc-'+numero);if(!box)return;
  if(box.getAttribute('data-done')==='1'){box.style.display=(box.style.display==='none'?'block':'none');return;}
  box.innerHTML='<div class="skel"></div><div class="skel"></div>';box.style.display='block';
  jget('/api/tribunais/detalhe?tribunal='+encodeURIComponent(sigla)+'&numero='+encodeURIComponent(numero)).then(function(r){
    box.innerHTML=pcDetalheHTML(r.processo,numero);box.setAttribute('data-done','1');
  }).catch(function(e){box.innerHTML='<small class="muted">Erro: '+esc(e.message)+'</small>';});
}
function abrirTodos(containerId){
  var c=document.getElementById(containerId);if(!c)return;
  var cards=c.querySelectorAll('.clickable[data-num]');
  for(var i=0;i<cards.length;i++){var el=cards[i];var sg=el.getAttribute('data-sg'),num=el.getAttribute('data-num');
    var box=document.getElementById('pc-'+num);
    if(box){if(box.getAttribute('data-done')!=='1'){carregarInline(sg,num);}else{box.style.display='block';}}}
}
function cardProc(p){
  var sigla=esc(p.tribunal||'');var sg=(p.siglaTrib||p.tribunal||'');var num=(p.numeroProcesso||'');
  return '<article class="clickable" data-sg="'+esc(sg)+'" data-num="'+esc(num)+'" onclick="abrirDetalhe(\''+esc(sg)+'\',\''+esc(num)+'\')" title="Clique para ver a movimentacao"><span class="tag">'+sigla+'</span><h4>'+esc(fmtNum(num))+'</h4><small class="muted">'+esc(p.classe||'')+' | '+esc(p.orgaoJulgador||'')+' | Ajuizado em '+esc(fmtData(p.dataAjuizamento))+'</small>'+(p.ultimaMovimentacao?'<br><small class="muted">Ultima movimentacao: '+esc(String(p.ultimaMovimentacao).slice(0,140))+'</small>':'')+'<div class="toolbar" style="margin-top:6px"><button class="btn ghost" onclick="event.stopPropagation();carregarInline(\''+esc(sg)+'\',\''+esc(num)+'\')">Ver movimentacao</button></div><div class="pc-det" id="pc-'+esc(num)+'" style="display:none;margin-top:8px"></div></article>';
}
function carregarListaTribunais(){
jget('/api/tribunais').then(function(r){
window._tribunais = r.tribunais||[];
montarSelects('');
var rf=document.getElementById('ramo-filter');
if(rf)rf.onchange=function(){montarSelects(rf.value);};
document.getElementById('trib').value='TST';
document.getElementById('trib2').value='STF';
carregarRecentes();
carregarFeed();
}).catch(function(e){document.getElementById('st-busca').textContent='Erro ao listar tribunais: '+e.message;});
}
function montarSelects(ramo){
var grupos={};(window._tribunais||[]).forEach(function(t){if(ramo&&t.ramo!==ramo)return;(grupos[t.ramo]=grupos[t.ramo]||[]).push(t);});
var html='';Object.keys(grupos).forEach(function(g){html+='<optgroup label="'+esc(g)+' ('+grupos[g].length+')">';grupos[g].forEach(function(t){html+='<option value="'+esc(t.sigla)+'">'+esc(t.sigla)+' - '+esc(t.nome)+'</option>';});html+='</optgroup>';});
document.getElementById('trib').innerHTML=html;
document.getElementById('trib2').innerHTML=html;
var tot=document.getElementById('st-total');
if(tot)tot.textContent=(window._tribunais||[]).length+' tribunais cobertos em '+Object.keys(grupos).length+' ramos';
}
function buscarProcesso(){
var sigla=document.getElementById('trib').value;
var numero=document.getElementById('numero').value.replace(/\D/g,'');
var st=document.getElementById('st-busca');
if(numero.length!==20){st.textContent='Digite os 20 digitos do numero CNJ.';return;}
st.textContent='Buscando no '+sigla+'...';
document.getElementById('res-busca').innerHTML='<div class="skel"></div>';
jget('/api/tribunais/buscar?tribunal='+encodeURIComponent(sigla)+'&numero='+encodeURIComponent(numero)).then(function(r){
st.textContent=(r.total||0)+' resultado(s) - '+((r.tribunal&&r.tribunal.nome)||sigla);
document.getElementById('res-busca').innerHTML=(r.processos||[]).map(cardProc).join('')||'<p class="muted">Nenhum processo encontrado.</p>';
}).catch(function(e){st.textContent='Erro: '+e.message;});
}
var _tpg=1,_ttotPg=1;
function irTemaPag(n){if(n<1||n>_ttotPg)return;_tpg=n;buscarTema();}
function renderTemaPager(){
  var el=document.getElementById('pager-tema');if(!el)return;
  if(_ttotPg<=1){el.innerHTML='';return;}
  var dis=_tpg<=1?' disabled':'';var dis2=_tpg>=_ttotPg?' disabled':'';
  var h='<button class="btn ghost"'+dis+' onclick="irTemaPag('+(_tpg-1)+')">&laquo; Anterior</button>';
  h+='<span class="muted" style="align-self:center">Pagina '+_tpg+' de '+_ttotPg+'</span>';
  h+='<button class="btn ghost"'+dis2+' onclick="irTemaPag('+(_tpg+1)+')">Proxima &raquo;</button>';
  el.innerHTML=h;
}
function buscarTema(){
var sigla=document.getElementById('trib3').value||'STJ';
var termo=document.getElementById('tema').value.trim();
var st=document.getElementById('st-tema');
if(termo.length<3){st.textContent='Digite ao menos 3 letras.';return;}
st.textContent='Pesquisando "'+termo+'" no '+sigla+'... (DataJud pode levar ~20s)';
document.getElementById('res-tema').innerHTML='<div class="skel"></div><div class="skel"></div>';
jget('/api/tribunais/tema?tribunal='+encodeURIComponent(sigla)+'&q='+encodeURIComponent(termo)+'&qtd=10&pagina='+_tpg).then(function(r){
_ttotPg=(r.totalPaginas&&r.totalPaginas>0)?r.totalPaginas:1;
st.textContent='Aprox. '+((r.totalAprox!=null)?Number(r.totalAprox).toLocaleString('pt-BR'):'-')+' processos sobre "'+r.tema+'" no '+sigla+' - pagina '+_tpg+'/'+_ttotPg;
document.getElementById('res-tema').innerHTML=(r.processos||[]).map(cardProc).join('')||'<p class="muted">Nada encontrado para este tema.</p>';
renderTemaPager();
}).catch(function(e){st.textContent='Erro: '+e.message;});
}
function carregarRecentes(){
var sigla=document.getElementById('trib2').value||'STF';
var st=document.getElementById('st-rec');st.textContent='Buscando...';
jget('/api/tribunais/recentes?tribunal='+encodeURIComponent(sigla)+'&qtd=10').then(function(r){
st.textContent=((r.tribunal&&r.tribunal.nome)||sigla)+' - '+(r.total||0)+' processos';
document.getElementById('tb-rec').innerHTML=(r.processos||[]).map(function(p){
return '<tr class="clickable" data-sg="'+esc(p.siglaTrib||sigla)+'" data-num="'+esc(p.numeroProcesso||'')+'" onclick="abrirDetalhe(\''+esc(p.siglaTrib||sigla)+'\',\''+esc(p.numeroProcesso||'')+'\')" title="Clique para ver a movimentacao"><td>'+esc(fmtNum(p.numeroProcesso))+'</td><td>'+esc((p.classe||'').slice(0,50))+'</td><td>'+esc((p.orgaoJulgador||'').slice(0,50))+'</td><td>'+esc(fmtData(p.dataAjuizamento))+'</td></tr>';}).join('')||'<tr><td colspan="4">Sem dados.</td></tr>';
}).catch(function(e){st.textContent='Erro: '+e.message;});
}
function carregarFeed(){
jget('/api/tribunais/feed?tribunais=STF,STJ,TST,TJSP,TJRJ,TJMG&qtd=2').then(function(r){
var html='';(r.tribunais||[]).forEach(function(t){
html+='<h3 style="color:#FFC400;margin:14px 0 4px">'+esc(t.sigla)+' - '+esc(t.nome||'')+'</h3>';
if(t.erro){html+='<p class="muted">Indisponivel no momento.</p>';}
else{(t.processos||[]).forEach(function(p){html+=cardProc(p);});}
});
document.getElementById('feed').innerHTML=html||'<p class="muted">Sem dados.</p>';
}).catch(function(){document.getElementById('feed').innerHTML='<p class="muted">Feed indisponivel.</p>';});
}
function carregarRSS(){
  jget('/api/tribunais/noticias').then(function(r){
    var html='';(r.tribunais||[]).forEach(function(t){
      html+='<h3 style="color:var(--ico);margin:14px 0 4px">'+esc(t.sigla)+' - '+esc(t.nome||'')+'</h3>';
      if(t.erro){html+='<p class="muted">RSS indisponivel.</p>';}
      else{(t.noticias||[]).forEach(function(n){
        var vd=n.video||'';var src=n.imagem||(vd?ytThumb(ytId(vd)):'');
        var img = src ? '<div class="rss-img vid-wrap" style="margin:8px 0"><a class="vid-link" href="'+esc(vd||n.link)+'" target="_blank" rel="noopener" title="Abrir matéria original"><img src="'+esc(src)+'" alt="" style="max-width:100%;height:auto;border-radius:8px;max-height:200px;object-fit:cover">'+(vd?playIco():'')+'</a></div>' : '';
        var rel=tempoRel(n.data);
        html+='<article>'+img+'<div class="tag-row"><span class="tag">'+esc(t.sigla)+'</span>'+(vd?'<span class="tag">Vídeo</span>':'')+favBtnHTML(n.link,n.titulo)+'</div><h4><a href="'+esc(vd||n.link)+'" target="_blank" rel="noopener">'+esc(n.titulo)+'</a></h4><small class="muted">'+esc(n.data||'')+(rel?' · '+esc(rel):'')+' · '+tempoLeitura(n.resumo)+'</small><p class="muted">'+esc((n.resumo||'').slice(0,160))+'</p>'+shareHTML(n.link,n.titulo)+'</article>';
      });}
    });
    document.getElementById('rss').innerHTML=html||'<p class="muted">Sem noticias.</p>';
  }).catch(function(){document.getElementById('rss').innerHTML='<p class="muted">RSS indisponivel.</p>';});
}
document.getElementById('btn-buscar').onclick=buscarProcesso;
document.getElementById('btn-rec').onclick=carregarRecentes;
document.getElementById('btn-feed').onclick=carregarFeed;
document.getElementById('btn-rss').onclick=carregarRSS;
document.getElementById('numero').addEventListener('keydown',function(e){if(e.key==='Enter')buscarProcesso();});
// Busca por tema (jurisprudencia) - DataJud multi_match
var TEMAS = ['consumidor','tributario','previdenciario','trabalhista','penal','ambiental'];
TEMAS.forEach(function(t){var s=document.querySelector('[data-tema="'+t+'"]');if(s){s.onclick=function(){document.getElementById('tema').value=t;_tpg=1;buscarTema();};}});
document.getElementById('btn-tema').onclick=buscarTema;
var trib3=document.getElementById('trib3');
if(trib3){var html='';(window._tribunais||[]).forEach(function(t){html+='<option value="'+esc(t.sigla)+'">'+esc(t.sigla)+' - '+esc(t.nome)+'</option>';});trib3.innerHTML=html;if(window._tribunais&&window._tribunais.length)trib3.value=(window._tribunais.filter(function(t){return t.sigla==='STJ';})[0]||window._tribunais[0]).sigla;}
carregarListaTribunais();
carregarRSS();
