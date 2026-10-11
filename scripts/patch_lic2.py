import io
p='frontend/licitacoes.html'
s=io.open(p,encoding='utf-8').read()

# estado de paginacao + reescrita do carregar()
old_carregar="""function carregar(){
var st=document.getElementById('status');st.textContent='Buscando PNCP...';
var uf=document.getElementById('uf').value;
var chain=jget('/api/licitacoes?pagina=1').then(function(d1){
return jget('/api/licitacoes?pagina=2').then(function(d2){
var all=[];if(Array.isArray(d1.dados))all=all.concat(d1.dados);if(Array.isArray(d2.dados))all=all.concat(d2.dados);
if(uf)all=all.filter(function(o){return o.unidadeOrgao&&o.unidadeOrgao.ufSigla===uf;});
var q='';try{q=new URLSearchParams(location.search).get('q')||document.getElementById('filtro').value||'';}catch(e){q=document.getElementById('filtro').value||'';}
q=q.toLowerCase();if(q)all=all.filter(function(o){return (o.objetoCompra||'').toLowerCase().indexOf(q)>=0;});
window._lic=all;renderLic(all);
st.textContent=all.length+' resultados'+(uf?' UF '+uf:'')+(q?' filtro "'+q+'"':'')+' (total PNCP: '+(d1.total||'-')+')';
});});
chain.catch(function(e){st.textContent='PNCP indisponivel: '+e.message;document.getElementById('tb').innerHTML='<tr><td colspan="5">Erro ao carregar. <button class="btn ghost" onclick="carregar()">Tentar de novo</button></td></tr>';});
}"""

new_carregar="""var _pg=1,_totalPg=1,_tam=20;
function renderPager(){
  var el=document.getElementById('pager');if(!el)return;
  var h='<button class="btn ghost" ' + (_pg<=1?'disabled':'') + ' onclick="irPag(' + (_pg-1) + ')">&laquo; Anterior</button>';
  h+='<span class="muted" style="align-self:center">Pagina '+_pg+' de '+_totalPg+' &middot; '+(_tam*_pg+1)+'-'+Math.min(_tam*_pg,(_tam*_totalPg))+'</span>';
  h+='<button class="btn ghost" ' + (_pg>=_totalPg?'disabled':'') + ' onclick="irPag(' + (_pg+1) + ')">Proxima &raquo;</button>';
  el.innerHTML=h;
}
function irPag(n){ if(n<1||n>_totalPg)return; _pg=n; carregar(); }
function carregar(){
var st=document.getElementById('status');st.textContent='Buscando PNCP (pagina '+_pg+')...';
var uf=document.getElementById('uf').value;
jget('/api/licitacoes?pagina='+_pg+'&tamanhoPagina='+_tam).then(function(d1){
  _totalPg=(d1.totalPaginas&&d1.totalPaginas>0)?d1.totalPaginas:1;
  var all=Array.isArray(d1.dados)?d1.dados.slice():[];
  if(uf)all=all.filter(function(o){return o.unidadeOrgao&&o.unidadeOrgao.ufSigla===uf;});
  var q='';try{q=new URLSearchParams(location.search).get('q')||document.getElementById('filtro').value||'';}catch(e){q=document.getElementById('filtro').value||'';}
  q=q.toLowerCase();if(q)all=all.filter(function(o){return (o.objetoCompra||'').toLowerCase().indexOf(q)>=0;});
  window._lic=all;renderLic(all);
  st.textContent='Pagina '+_pg+' de '+_totalPg+' - '+all.length+' exibidos'+(uf?' UF '+uf:'')+(q?' filtro "'+q+'"':'')+' (total PNCP: '+(d1.total||'-')+')';
  renderPager();
}).catch(function(e){st.textContent='PNCP indisponivel: '+e.message;document.getElementById('tb').innerHTML='<tr><td colspan="5">Erro ao carregar. <button class="btn ghost" onclick="carregar()">Tentar de novo</button></td></tr>';});
}"""
assert old_carregar in s, 'carregar() nao encontrado'
s=s.replace(old_carregar,new_carregar)

# insere a barra de paginacao logo apos o card da tabela
old_card="""<div class="card"><table><thead><tr><th>Objeto</th><th>\u00d3rg\u00e3o</th><th>UF/Munic\u00edpio</th><th>Publica\u00e7\u00e3o</th><th>A\u00e7\u00e3o</th></tr></thead><tbody id="tb"><tr><td colspan="5" class="muted">Clique em carregar.</td></tr></tbody></table></div></main>"""
new_card="""<div class="card"><table><thead><tr><th>Objeto</th><th>\u00d3rg\u00e3o</th><th>UF/Munic\u00edpio</th><th>Publica\u00e7\u00e3o</th><th>A\u00e7\u00e3o</th></tr></thead><tbody id="tb"><tr><td colspan="5" class="muted">Clique em carregar.</td></tr></tbody></table></div>
<div class="toolbar" id="pager" style="justify-content:center;gap:12px;margin-top:14px"></div></main>"""
assert old_card in s, 'card tabela nao encontrado'
s=s.replace(old_card,new_card)

io.open(p,'w',encoding='utf-8').write(s)
print('licitacoes.html OK')
