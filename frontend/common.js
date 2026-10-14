// BrBRICS - biblioteca compartilhada (usada em todas as páginas)
function jget(url){return fetch(url).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});}
function esc(s){var m={'&':'&','<':'<','>':'>'};return String(s==null?'':s).replace(/[&<>]/g,function(c){return m[c];});}
function toast(m){var t=document.getElementById('toast');if(!t){alert(m);return;}t.textContent=m;t.style.display='block';clearTimeout(t._x);t._x=setTimeout(function(){t.style.display='none';},3200);}
function last(a){return (Array.isArray(a)&&a.length)?a[a.length-1]:null;}
function setActiveNav(){var f=(location.pathname.split('/').pop()||'index.html');var map=document.querySelectorAll('.nav a');for(var i=0;i<map.length;i++){var h=map[i].getAttribute('href');if(h===f)map[i].classList.add('active');}}
function initSearch(){
  var inputs=document.querySelectorAll('.topbar .actions input[type="search"]');
  for(var k=0;k<inputs.length;k++){
    (function(b){
      if(b.getAttribute('data-bound')==='1')return; b.setAttribute('data-bound','1');
      b.addEventListener('keydown',function(e){
        if(e.key==='Enter'){
          e.preventDefault();
          var q=b.value.trim();
          if(!q) return;
          location.href='busca.html?q='+encodeURIComponent(q);
        }
      });
    })(inputs[k]);
  }
}
function initBackTop(){
  var bt=document.getElementById('backtop');
  if(bt){
    if(!bt.querySelector('svg')){bt.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';bt.setAttribute('aria-label','Voltar ao topo');}
    addEventListener('scroll',function(){bt.style.display=scrollY>600?'flex':'none';});
    bt.onclick=function(){scrollTo({top:0,behavior:'smooth'});};
  }
}
function initLightbox(){
  var c=document.getElementById('lb-close');
  if(c)c.onclick=function(){var lb=document.getElementById('lightbox');if(lb)lb.classList.remove('on');};
  var lb=document.getElementById('lightbox');
  if(lb)lb.addEventListener('click',function(e){if(e.target.id==='lightbox')lb.classList.remove('on');});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){var l2=document.getElementById('lightbox');if(l2)l2.classList.remove('on');}});
}
// (initStatus removido: lista Fontes Ativas retirada da abertura e do rodapé)
// Service Worker: network-first + força atualização
if('serviceWorker' in navigator && location.protocol!=='file:'){
  var __brbrics_reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(__brbrics_reloading) return; __brbrics_reloading = true; location.reload();
  });
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function(reg){
    function __urge(){ if(reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
    if(reg.waiting) __urge();
    reg.addEventListener('updatefound', function(){
      var nw = reg.installing;
      if(nw) nw.addEventListener('statechange', function(){ if(nw.state==='installed' && navigator.serviceWorker.controller) __urge(); });
    });
  }).catch(function(){});
}
// ===== Ícones temáticos do menu (amarelos via .nav-ico) =====
var NAV_SVG_A='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
var NAV_ICONS={
  home: NAV_SVG_A+'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  file: NAV_SVG_A+'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  search: NAV_SVG_A+'<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  chart: NAV_SVG_A+'<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>',
  landmark: NAV_SVG_A+'<path d="M2 10l10-6 10 6"/><path d="M5 10v11"/><path d="M9.5 10v11"/><path d="M14.5 10v11"/><path d="M19 10v11"/><path d="M3 21h18"/></svg>',
  scale: NAV_SVG_A+'<path d="M12 4v16"/><path d="M8 20h8"/><path d="M3 7h18"/><path d="M6 7l-2.5 6a2.9 2.9 0 0 0 5 0L6 7z"/><path d="M18 7l-2.5 6a2.9 2.9 0 0 0 5 0L18 7z"/></svg>',
  news: NAV_SVG_A+'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6"/><path d="M7 13h10"/><path d="M7 17h7"/></svg>',
  info: NAV_SVG_A+'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  calendar: NAV_SVG_A+'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
  pin: NAV_SVG_A+'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  book: NAV_SVG_A+'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  trend: NAV_SVG_A+'<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  clipcheck: NAV_SVG_A+'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12l2 2 4-4"/></svg>',
  building: NAV_SVG_A+'<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M12 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>',
  folder: NAV_SVG_A+'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  clock: NAV_SVG_A+'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  users: NAV_SVG_A+'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  sliders: NAV_SVG_A+'<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>',
  clima: NAV_SVG_A+'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  zap: NAV_SVG_A+'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  globe: NAV_SVG_A+'<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  car: NAV_SVG_A+'<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><rect x="3" y="11" width="18" height="6" rx="1"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  leaf: NAV_SVG_A+'<path d="M11 20A7 7 0 0 1 4 13c0-4 3-8 9-9 4-.8 7-1 7-1s-.3 4-1.5 7.5C17 15 14 18.5 11 20z"/><path d="M4 21c4-6 8-9 12-11"/></svg>',
  banknote: NAV_SVG_A+'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>'
};
function navIco(key){
  if(!key||!NAV_ICONS[key])return null;
  var s=document.createElement('span');s.className='nav-ico';s.setAttribute('aria-hidden','true');s.innerHTML=NAV_ICONS[key];return s;
}
// ===== Menu principal com submenus =====
var BRBRICS_NAV=[
  {t:'Início',h:'index.html',ic:'home'},
  {t:'Diário Oficial',h:'edicao.html',ic:'file',sub:[{t:'Edição da Semana',h:'edicao.html',ic:'calendar'},{t:'Manchetes do Dia',h:'manchetes.html',ic:'news'},{t:'Buscar no DOU',h:'busca.html?q=dou',ic:'search'}]},
  {t:'Licitações',h:'licitacoes.html',ic:'clipcheck',sub:[{t:'Todas (PNCP)',h:'licitacoes.html',ic:'file'}]},
  {t:'Congresso',h:'proposicoes.html',ic:'landmark',sub:[{t:'Proposições Recentes',h:'proposicoes.html',ic:'clock'},{t:'Busca Avançada',h:'legislacao.html',ic:'sliders'},{t:'Buscar no Congresso',h:'busca.html?q=proposicao',ic:'search'}]},
  {t:'Indicadores',h:'indicadores.html',ic:'chart',sub:[{t:'Séries BCB',h:'indicadores.html',ic:'chart'},{t:'Boletim Focus 2026',h:'indicadores.html',ic:'trend'},{t:'Bolsa e cripto',h:'index.html#mercado'},{t:'IPCA 12m & Desemprego',h:'indicadores.html',ic:'users'}]},
  {t:'Tribunais',h:'tribunais.html',ic:'scale',sub:[{t:'Consulta Processual (DataJud)',h:'tribunais.html',ic:'search'},{t:'Jurisprudência por Tema',h:'tribunais.html',ic:'book'},{t:'Notícias dos Tribunais',h:'tribunais.html',ic:'news'}]},
  {t:'Notícias',h:'manchetes.html',ic:'news',sub:[{t:'Manchetes',h:'manchetes.html',ic:'news'},{t:'Agências & Ministérios',h:'reguladores.html',ic:'building'},{t:'Diretórios Oficiais',h:'diretorios.html',ic:'folder'},{t:'Por Órgão/UF',h:'diretorios.html',ic:'pin'}]},
  {t:'Mais dados',h:'territorio.html',ic:'globe',sub:[{t:'Território (IBGE)',h:'territorio.html',ic:'pin'},{t:'Clima nas capitais',h:'clima.html',ic:'clima'},{t:'Contas públicas',h:'contas.html',ic:'banknote'},{t:'Energia',h:'energia.html',ic:'zap'},{t:'Comércio exterior',h:'comex.html',ic:'trend'},{t:'Guia Fipe',h:'fipe.html',ic:'car'},{t:'Agro e safra',h:'agro.html',ic:'leaf'}]},
  {t:'Sobre',h:'sobre.html',ic:'info'}
];
function brbricsCur(){var p=(location.pathname.split('/').pop()||'index.html').split('?')[0];return p;}
function buildNav(){
  var navs=document.querySelectorAll('.nav');
  for(var i=0;i<navs.length;i++){
    var nav=navs[i];var cur=brbricsCur();nav.innerHTML='';
    BRBRICS_NAV.forEach(function(item){
      if(item.sub){
        var g=document.createElement('div');g.className='navgrp';
        var top=document.createElement('a');top.className='navtop';top.href=item.h;top.textContent=item.t;
        var topIco=navIco(item.ic);if(topIco)top.appendChild(topIco);
        var box=document.createElement('div');box.className='sub';var act=false;
        item.sub.forEach(function(sp){var a=document.createElement('a');a.href=sp.h;var spFile=sp.h.split('?')[0];a.textContent=sp.t;var spIco=navIco(sp.ic);if(spIco)a.appendChild(spIco);if(spFile===cur){a.classList.add('active');act=true;}box.appendChild(a);});
        if(item.h.split('?')[0]===cur||act)top.classList.add('active');
        top.addEventListener('click',function(e){if(window.innerWidth<=900){e.preventDefault();var wasOpen=g.classList.contains('open');var abertos=nav.querySelectorAll('.navgrp.open');for(var gi=0;gi<abertos.length;gi++){abertos[gi].classList.remove('open');}if(!wasOpen)g.classList.add('open');}});
        g.appendChild(top);g.appendChild(box);nav.appendChild(g);
      } else {
        var a=document.createElement('a');a.href=item.h;a.textContent=item.t;var aIco=navIco(item.ic);if(aIco)a.appendChild(aIco);if(item.h===cur)a.classList.add('active');nav.appendChild(a);
      }
    });
  }
}
var KPI_ICONS={ipca:'chart',selic:'trend',cambio:'globe',igpm:'chart'};
function kpiIco(k){var ic=navIco(KPI_ICONS[k]||'chart');return ic?'<span class="nav-ico">'+ic.innerHTML+'</span>':'';}
function tituloIco(t){
  var s=String(t||'').toLowerCase();
  try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
  function tem(){for(var i=0;i<arguments.length;i++){if(s.indexOf(arguments[i])>=0)return true;}return false;}
  if(tem('licita','pncp','pregao','edital','contrato','contrata'))return 'clipcheck';
  if(tem('congresso','proposi','camara','senado','tramita','votac','agenda','placar'))return 'landmark';
  if(tem('tribun','justi','datajud','processo','jurisprud'))return 'scale';
  if(tem('dou','secao','norma','nomea','guia','trilha'))return 'file';
  if(tem('manchete','noticia','imprensa','jornal'))return 'news';
  if(tem('regulador','agencia','ministerio','mapa','tcu','ibama','rss','governo'))return 'building';
  if(tem('conta','tesouro','siconfi','rreo','rgf','transparencia','gasto','receita','bolsa'))return 'banknote';
  if(tem('indicador','focus','mercado','fipe','cambio','moeda','cripto','bitcoin','ipca','selic','pib','econom','tabela','preco','valor'))return 'chart';
  if(tem('clima','tempo','chuva','temperatura','previsao','hoje','proximo'))return 'clima';
  if(tem('comex','comercio','export','import','balanca','parceiro','resumo','moviment','saldo'))return 'trend';
  if(tem('agro','safra','pam','lavoura','colheita','pesc','producao','produto'))return 'leaf';
  if(tem('territorio','ibge','municipio','popul','nome','cnpj','empresa','uf'))return 'pin';
  if(tem('energia','eletric','bandeira','siga','geracao','solar','eolic','aneel','anp'))return 'zap';
  if(tem('busca','resultado','filtro','pesquis'))return 'search';
  if(tem('edicao','semana','destaque','carrossel'))return 'calendar';
  if(tem('salvos','favorito'))return 'book';
  if(tem('lidas'))return 'trend';
  if(tem('diretorio','orgao','cadastro','dado'))return 'folder';
  if(tem('fonte','metodologia','diretriz','regra','termo','privacidade','lgpd','ajuda','contato','status'))return 'info';
  return null;
}
function kickerIco(t){
  var s=String(t||'').toLowerCase();
  try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
  function tem(){for(var i=0;i<arguments.length;i++){if(s.indexOf(arguments[i])>=0)return true;}return false;}
  if(tem('ibge'))return 'pin';
  if(tem('tesouro','siconfi'))return 'banknote';
  if(tem('mdic','comex'))return 'trend';
  if(tem('aneel'))return 'zap';
  if(tem('contratac','pncp','licitac'))return 'clipcheck';
  if(tem('camara','senado','congresso'))return 'landmark';
  if(tem('bcb','banco central','focus'))return 'chart';
  if(tem('cnj','datajud','tribun'))return 'scale';
  if(tem('portal'))return 'globe';
  if(tem('rss','gov.br'))return 'building';
  if(tem('clima','previsao','capital'))return 'clima';
  if(tem('fipe'))return 'chart';
  if(tem('sobre','brbrics'))return 'info';
  return tituloIco(t);
}
var FOOT_ICONS=['folder','globe','info','building'];
function decorateTitles(){
  var hs=document.querySelectorAll('.card-h h2, section.card > h2');
  for(var i=0;i<hs.length;i++){
    var h=hs[i];
    if(h.querySelector('svg')||h.querySelector('.nav-ico'))continue;
    var ic=navIco(tituloIco(h.textContent));
    if(ic)h.insertBefore(ic,h.firstChild);
  }
  var ks=document.querySelectorAll('.kicker');
  for(var k=0;k<ks.length;k++){
    var kb=ks[k];
    if(kb.querySelector('svg')||kb.querySelector('.nav-ico'))continue;
    var ki=navIco(kickerIco(kb.textContent));
    if(ki)kb.insertBefore(ki,kb.firstChild);
  }
  var fh=document.querySelectorAll('.f-col h4');
  for(var f=0;f<fh.length;f++){
    if(fh[f].querySelector('svg'))continue;
    var fi=navIco(FOOT_ICONS[f]||'info');
    if(fi)fh[f].insertBefore(fi,fh[f].firstChild);
  }
  var st=document.querySelectorAll('.stat');
  for(var s2=0;s2<st.length;s2++){
    var sb=st[s2];
    if(sb.querySelector('svg'))continue;
    var si=navIco(tituloIco(sb.textContent));
    if(si)sb.insertBefore(si,sb.firstChild);
  }
}
function initHamburger(){
  var acts=document.querySelectorAll('.actions');
  for(var i=0;i<acts.length;i++){
    if(acts[i].querySelector('.hamb'))continue;
    var b=document.createElement('button');b.className='hamb';b.innerHTML='&#9776;';b.setAttribute('aria-label','Menu');
    var bar=acts[i].closest('.topbar-in');var nav=bar?bar.querySelector('.nav'):null;
    b.addEventListener('click',function(){if(nav)nav.classList.toggle('open');});
    acts[i].insertBefore(b,acts[i].firstChild);
  }
}
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var abertos=document.querySelectorAll('.navgrp.open');for(var i=0;i<abertos.length;i++){abertos[i].classList.remove('open');}}});
// ===== Utilitários visuais (tempo relativo, leitura, vídeo, share, favoritos, fonte, progresso) =====
function escA(s){return esc(s).replace(/"/g,'&quot;');}
function tempoRel(d){try{var t=new Date(d).getTime();if(isNaN(t))return '';var s=(Date.now()-t)/1000;if(s<0)s=0;if(s<90)return 'agora mesmo';if(s<3600){var m=Math.floor(s/60);return 'há '+m+' min';}if(s<86400){var h=Math.floor(s/3600);return 'há '+h+'h';}var dd=Math.floor(s/86400);if(dd<7)return 'há '+dd+' dias';if(dd<30){var w=Math.floor(dd/7);return w>1?('há '+w+' semanas'):'há 1 semana';}var mo=Math.floor(dd/30);if(mo<12)return mo>1?('há '+mo+' meses'):'há 1 mês';var an=Math.floor(mo/12);return an>1?('há '+an+' anos'):'há 1 ano';}catch(e){return '';}}
function tempoLeitura(txt){var w=String(txt||'').trim().split(/\s+/);var n=(w.length===1&&w[0]==='')?0:w.length;return Math.max(1,Math.round(n/180))+' min de leitura';}
function ytId(u){try{var m=String(u||'').match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);return m?m[1]:'';}catch(e){return '';}}
function ytThumb(id){return id?('https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'):'';}
function playIco(){return '<span class="play-btn" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';}
function shareHTML(url,titulo){
  var u=encodeURIComponent(url||location.href), t=encodeURIComponent(String(titulo||document.title).slice(0,140));
  return '<div class="share-row">'
  +'<a class="share-btn" target="_blank" rel="noopener" title="Compartilhar no WhatsApp" href="https://wa.me/?text='+t+'%20'+u+'"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg><span>WhatsApp</span></a>'
  +'<a class="share-btn" target="_blank" rel="noopener" title="Compartilhar no X" href="https://twitter.com/intent/tweet?text='+t+'&url='+u+'"><svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20"/></svg><span>X</span></a>'
  +'<a class="share-btn" target="_blank" rel="noopener" title="Compartilhar no LinkedIn" href="https://www.linkedin.com/sharing/share-offsite/?url='+u+'"><svg viewBox="0 0 24 24"><path d="M6 9v12M6 5v.01M11 21v-7a3 3 0 0 1 6 0v7M11 9v3"/></svg><span>LinkedIn</span></a>'
  +'<button class="share-btn" type="button" data-copy="'+escA(url||'')+'" title="Copiar link"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg><span>Copiar</span></button>'
  +'</div>';
}
function favGet(){try{return JSON.parse(localStorage.getItem('brbrics_favs')||'[]');}catch(e){return [];}}
function favHas(link){var l=favGet();for(var i=0;i<l.length;i++){if(l[i].u===link)return true;}return false;}
function favToggle(link,titulo,fonte){var l=favGet();var ix=-1;for(var i=0;i<l.length;i++){if(l[i].u===link){ix=i;break;}}if(ix>=0){l.splice(ix,1);}else{l.unshift({u:link,t:String(titulo||link).slice(0,140),f:fonte||''});l=l.slice(0,50);}try{localStorage.setItem('brbrics_favs',JSON.stringify(l));}catch(e){}return ix<0;}
function favBtnHTML(link,titulo){var on=favHas(link);return '<button class="fav-btn'+(on?' on':'')+'" type="button" data-fav="'+escA(link)+'" data-ft="'+escA(titulo||'')+'" title="'+(on?'Remover dos salvos':'Salvar para ler depois')+'"><svg viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg></button>';}
function salvosHTML(){var l=favGet();if(!l.length)return '<p class="muted">Nenhum item salvo ainda. Toque na estrela dos cards.</p>';return l.slice(0,8).map(function(x){return '<div class="rank"><span class="n">★</span><div><a href="'+escA(x.u)+'" target="_blank" rel="noopener">'+esc(x.t)+'</a>'+(x.f?'<div class="r-meta">'+esc(x.f)+'</div>':'')+'</div></div>';}).join('');}
function renderSalvos(){var els=document.querySelectorAll('[data-salvos]');for(var i=0;i<els.length;i++){els[i].innerHTML=salvosHTML();}}
function trackLeitura(link,titulo,fonte){try{var k='brbrics_leituras';var c=JSON.parse(localStorage.getItem(k)||'{}');var e=c[link]||{n:0,t:'',f:''};e.n++;if(titulo)e.t=String(titulo).slice(0,120);if(fonte)e.f=fonte;var keys=Object.keys(c);if(!c[link]&&keys.length>200){delete c[keys[0]];}c[link]=e;localStorage.setItem(k,JSON.stringify(c));renderMaisLidas();}catch(e){}}
function maisLidasHTML(n){try{var c=JSON.parse(localStorage.getItem('brbrics_leituras')||'{}');var arr=Object.keys(c).map(function(k){return {u:k,n:c[k].n||0,t:c[k].t||k,f:c[k].f||''};});arr.sort(function(a,b){return b.n-a.n;});arr=arr.slice(0,n||5);if(!arr.length)return '<p class="muted">Clique nas notícias para montar seu ranking.</p>';return arr.map(function(r,i){return '<div class="rank"><span class="n">'+(i+1)+'</span><div><a href="'+escA(r.u)+'" target="_blank" rel="noopener">'+esc(r.t||r.u)+'</a><div class="r-meta">'+r.n+' clique'+(r.n>1?'s':'')+(r.f?' · '+esc(r.f):'')+'</div></div></div>';}).join('');}catch(e){return '';}}
function renderMaisLidas(){var els=document.querySelectorAll('[data-mais]');for(var i=0;i<els.length;i++){  els[i].innerHTML=maisLidasHTML(4);}}
document.addEventListener('click',function(e){
  var cp=e.target.closest?e.target.closest('[data-copy]'):null;
  if(cp){e.preventDefault();e.stopPropagation();var url=cp.getAttribute('data-copy');if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){toast('Link copiado');}).catch(function(){toast('Não foi possível copiar');});}else{toast(url);}return;}
  var fv=e.target.closest?e.target.closest('[data-fav]'):null;
  if(fv){e.preventDefault();e.stopPropagation();var lk=fv.getAttribute('data-fav');var on=favToggle(lk,fv.getAttribute('data-ft')||'');var all=document.querySelectorAll('[data-fav]');for(var i=0;i<all.length;i++){if(all[i].getAttribute('data-fav')===lk){all[i].classList.toggle('on',on);all[i].setAttribute('title',on?'Remover dos salvos':'Salvar para ler depois');}}renderSalvos();toast(on?'Salvo para ler depois':'Removido dos salvos');return;}
  var a=e.target.closest?e.target.closest('a[target="_blank"]'):null;
  if(a&&a.href&&!(a.classList&&a.classList.contains('share-btn'))){var art=a.closest('article');var tag=art?art.querySelector('.tag,.badge'):null;trackLeitura(a.href,(a.textContent||'').trim().slice(0,120),tag?tag.textContent.trim():'');}
},true);
function sparkSVG(vals,w,h,color){
  w=w||90;h=h||28;color=color||'#FFC400';
  var nums=(vals||[]).map(function(v){return parseFloat(String(v).replace(',','.'));}).filter(function(v){return !isNaN(v);});
  if(nums.length<2)return '';
  var min=Math.min.apply(null,nums),max=Math.max.apply(null,nums),rg=(max-min)||1;
  var pts=nums.map(function(v,i){var x=(i/(nums.length-1))*(w-4)+2;var y=h-3-((v-min)/rg)*(h-6);return x.toFixed(1)+','+y.toFixed(1);}).join(' ');
  return '<svg class="spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"><polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round"/></svg>';
}
function emptyHTML(msg,dica){return '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg><p><b>'+esc(msg||'Nada por aqui')+'</b></p>'+(dica?'<small class="muted">'+esc(dica)+'</small>':'')+'</div>';}
function modPNCP(nome){var s=String(nome||'').toLowerCase();if(s.indexOf('preg')>=0)return 'mod-pregao';if(s.indexOf('concorr')>=0||s.indexOf('concurso')>=0)return 'mod-conc';if(s.indexOf('dispensa')>=0)return 'mod-disp';if(s.indexOf('inexig')>=0)return 'mod-inex';return 'mod-out';}
function prazoPNCP(o){try{var agora=Date.now();var abe=o.dataAberturaProposta?new Date(o.dataAberturaProposta).getTime():NaN;var enc=o.dataEncerramentoProposta?new Date(o.dataEncerramentoProposta).getTime():NaN;var dia=86400000;if(!isNaN(enc)&&enc<agora)return {txt:'Encerrado',cls:'off'};if(!isNaN(abe)&&abe>agora){var da=Math.ceil((abe-agora)/dia);return {txt:'Abre em '+da+'d',cls:da<=3?'urg':'warn'};}if(!isNaN(enc)){var de=Math.ceil((enc-agora)/dia);if(de<=3)return {txt:'Encerra em '+de+'d',cls:'urg'};if(de<=10)return {txt:'Encerra em '+de+'d',cls:'warn'};return {txt:'Encerra em '+de+'d',cls:'ok'};}return null;}catch(e){return null;}}
function aplicarFonte(nv){document.documentElement.style.fontSize=(14+nv)+'px';}
function salvarFonte(nv){try{localStorage.setItem('brbrics_fs',String(nv));}catch(e){}}
function initFonte(){
  var acts=document.querySelectorAll('.topbar .actions');
  for(var i=0;i<acts.length;i++){
    if(acts[i].querySelector('.font-ctl'))continue;
    var nv=0;try{nv=parseInt(localStorage.getItem('brbrics_fs')||'0',10)||0;}catch(e){}nv=Math.max(-2,Math.min(2,nv));aplicarFonte(nv);
    (function(box,n0){
      var n=n0;
      var bm=document.createElement('button');bm.className='font-btn';bm.type='button';bm.title='Diminuir letra';bm.textContent='A-';
      var bp=document.createElement('button');bp.className='font-btn';bp.type='button';bp.title='Aumentar letra';bp.textContent='A+';
      bm.onclick=function(){n=Math.max(-2,n-1);aplicarFonte(n);salvarFonte(n);};
      bp.onclick=function(){n=Math.min(2,n+1);aplicarFonte(n);salvarFonte(n);};
      box.appendChild(bm);box.appendChild(bp);
    })((function(){var s=document.createElement('span');s.className='font-ctl';acts[i].appendChild(s);return s;})(),nv);
  }
}
function initLogoHome(){
  // Clicar na logo (banner) sempre carrega o conteúdo de INÍCIO:
  // - se já está no início, recarrega + volta ao topo (novo conteúdo das APIs)
  // - se está em outra página, navega para index.html
  var brands=document.querySelectorAll('a.brand');
  for(var i=0;i<brands.length;i++){
    (function(a){
      if(a.getAttribute('data-home-bound')==='1')return; a.setAttribute('data-home-bound','1');
      a.setAttribute('href','index.html');
      a.addEventListener('click',function(e){
        var cur='';
        try{cur=(location.pathname.split('/').pop()||'index.html').split('?')[0];}catch(err){cur='';}
        if(cur===''||cur==='/'||cur==='index.html'){
          e.preventDefault();
          try{location.reload();}catch(err){location.href='index.html';}
          try{window.scrollTo({top:0,behavior:'smooth'});}catch(err2){window.scrollTo(0,0);}
        }
      });
    })(brands[i]);
  }
}
function initVisita(){
  try{
    var ua=navigator.userAgent||'';
    if(/bot|crawl|spider|slurp|mediapartners/i.test(ua))return;
    var img=new Image();
    img.src='/api/visita?pag='+encodeURIComponent(location.pathname)+'&ref='+encodeURIComponent(document.referrer||'');
  }catch(e){}
}
function initProgresso(){
  if(document.getElementById('leitura-bar'))return;
  var b=document.createElement('div');b.id='leitura-bar';b.innerHTML='<span></span>';document.body.appendChild(b);
  var fill=b.firstChild;
  function upd(){var h=document.documentElement;var max=h.scrollHeight-h.clientHeight;var p=max>0?(h.scrollTop/max):0;fill.style.width=(p*100)+'%';}
  addEventListener('scroll',upd,{passive:true});upd();
}
function buildFooter(){
  var fts=document.querySelectorAll('footer');
  for(var i=0;i<fts.length;i++){
    fts[i].innerHTML='<div class="wrap foot-grid">'
    +'<div class="f-brand"><img src="logo-brics.png" alt="BrBRICS"><div><b>BrBRICS</b><p class="muted">Transparência de dados do setor público — direto das fontes oficiais, sem intermediários.</p></div></div>'
    +'<div class="f-col"><h4>Seções</h4><a href="index.html">Início</a><a href="edicao.html">Diário Oficial</a><a href="licitacoes.html">Licitações</a><a href="proposicoes.html">Congresso</a><a href="indicadores.html">Indicadores</a><a href="tribunais.html">Tribunais</a></div>'
    +'<div class="f-col"><h4>Mais dados</h4><a href="territorio.html">Território</a><a href="clima.html">Clima</a><a href="contas.html">Contas públicas</a><a href="energia.html">Energia</a><a href="comex.html">Comércio exterior</a><a href="fipe.html">Guia Fipe</a><a href="agro.html">Agro</a></div>'
    +'<div class="f-col"><h4>Institucional</h4><a href="sobre.html">Sobre</a><a href="sobre.html">Como produzimos</a><a href="sobre.html">Fontes</a><a href="sobre.html">Termos</a><a href="sobre.html">Privacidade (LGPD)</a><a href="painel.html">Painel de visitas</a><a href="/rss.xml">RSS</a></div>'
    +'<div class="f-col"><h4>Fontes oficiais</h4><a href="https://pncp.gov.br" target="_blank" rel="noopener">PNCP</a><a href="https://dadosabertos.camara.leg.br/" target="_blank" rel="noopener">Câmara</a><a href="https://www.bcb.gov.br/" target="_blank" rel="noopener">BCB</a><a href="https://servicodados.ibge.gov.br/api/docs/" target="_blank" rel="noopener">IBGE</a><a href="https://www.gov.br/cgu/pt-br" target="_blank" rel="noopener">CGU</a><a href="https://dadosabertos.aneel.gov.br/" target="_blank" rel="noopener">ANEEL</a></div>'
    +'</div><div class="wrap foot-base"><small class="muted">© '+new Date().getFullYear()+' BrBRICS · Dados públicos com link de conferência na fonte.</small></div>';
  }
}
  if(!document.getElementById('ticker-in')){
    var h=document.querySelector('header');
    if(h){h.insertAdjacentHTML('beforeend','<div class="ticker"><div class="ticker-track" id="ticker-in">BrBRICS — carregando mercado...</div></div>  <div class="ticker mkt-ticker"><div class="ticker-track" id="ticker-mkt"><span class="muted">Carregando mercado...</span></div></div>');}
  }
  if(typeof renderTicker==='function'){renderTicker();}
  buildNav();buildFooter();initHamburger();initLogoHome();setActiveNav();initSearch();initBackTop();initLightbox();initFonte();initProgresso();renderMaisLidas();renderSalvos();decorateTitles();initVisita();