import io
p='frontend/reguladores.html'
s=io.open(p,encoding='utf-8').read()

# Substituir o render() antigo (lista de artigos sem foto) por grid de cards com foto
start=s.find("function render(){")
end=s.find("function buildFiltros(){")
assert start>0 and end>start, 'marcadores render/buildFiltros nao achados: %d %d'%(start,end)

new_render = r'''function render(){
 var feed=document.getElementById('feed');
 if(!_dados){feed.innerHTML='<p class="muted">Clique em carregar.</p>';return;}
 var q=_q.toLowerCase().trim();
 var cards=[];var count=0;
 (_dados.orgaos||[]).forEach(function(t){
  if(t.erro)return;
  if(_cat&&(t.cat||'reg')!==_cat)return;
  if(_org&&t.sigla!==_org)return;
  var noticias=(t.noticias||[]).filter(function(n){
   if(!q)return true;
   return ((n.titulo||'')+' '+(n.resumo||'')).toLowerCase().indexOf(q)>=0;
  });
  if(q&&!noticias.length)return;
  noticias.forEach(function(n){
   count++;
   var b=badgeCat(t.cat||'reg');
   var vid=n.video?'<span class="badge vid">▶ Vídeo</span>':'';
   var img=n.imagem
     ? '<div class="news-thumb"><img loading="lazy" src="'+limpar(n.imagem)+'" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><div class="noimg" style="display:none">📰</div>'+vid+'</div>'
     : '<div class="news-thumb"><div class="noimg">📰</div>'+vid+'</div>';
   cards.push('<article class="news-card">'+img+
     '<div class="news-body"><div class="news-src"><span class="badge '+b[0]+'">'+b[1]+'</span><span>'+limpar(t.sigla)+'</span></div>'+
     '<h4><a href="'+limpar(n.link)+'" target="_blank" rel="noopener">'+limpar(n.titulo)+'</a></h4>'+
     (n.resumo?'<p>'+limpar(n.resumo.slice(0,120))+'…</p>':'')+
     '<div class="news-src"><span>'+(n.data?limpar(new Date(n.data).toLocaleString('pt-BR')):'')+'</span></div></div></article>');
  });
 });
 if(!count){feed.innerHTML='<p class="muted">Nenhuma noticia encontrada'+(q?' para "'+limpar(_q)+'"':'')+'.</p>';return;}
 var st=document.getElementById('s');if(st)st.textContent=count+' noticia(s)'+(q?' para "'+_q+'"':'');
 feed.innerHTML='<div class="news-grid">'+cards.join('')+'</div>';
}
function badgeCat(cat){var map={reg:['reg','Agência'],min:['min','Ministério'],trib:['trib','Tribunal']};return map[cat]||['','Fonte'];}
'''
s=s[:start]+new_render+s[end:]

# garantir que feed inicia com classe adequada (mantem list, mas render usa news-grid interno)
io.open(p,'w',encoding='utf-8').write(s)
print('reguladores.html render atualizado. news-grid usados:', s.count('news-grid'), '| badgeCat def:', s.count('function badgeCat'))
