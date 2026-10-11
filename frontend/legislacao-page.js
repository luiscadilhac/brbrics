// BrBRICS - pagina Legislacao (busca + tramitacao + votacoes)
function buscarLeg(){
var q=document.getElementById('q').value;
var tipo=document.getElementById('tipo').value;
var ano=document.getElementById('ano').value;
var st=document.getElementById('st');
st.textContent='Buscando...';
document.getElementById('res').innerHTML='<div class="skel"></div><div class="skel"></div>';
var url='/api/legislacao/buscar?itens=15&q='+encodeURIComponent(q)+'&tipo='+encodeURIComponent(tipo)+'&ano='+encodeURIComponent(ano);
jget(url).then(function(r){
st.textContent=(r.total||0)+' resultado(s)';
var html=(r.proposicoes||[]).map(function(x){
return '<article class="clickable" onclick="verTramitacao('+x.id+')" title="Clique para ver a tramitacao"><span class="tag">'+esc(x.siglaTipo)+' '+esc(x.numero)+'/'+esc(x.ano)+'</span><h4>'+esc((x.ementa||'').slice(0,180))+'</h4><small class="muted"><button class="btn ghost" onclick="event.stopPropagation();verTramitacao('+x.id+')">Ver tramitacao</button></small></article>';
}).join('');
document.getElementById('res').innerHTML=html||'<p class="muted">Nada encontrado. Tente outro tema.</p>';
}).catch(function(e){st.textContent='Erro: '+e.message;});
}
function verTramitacao(id){
var card=document.getElementById('det-card');card.style.display='block';
document.getElementById('det').innerHTML='<div class="skel"></div>';
card.scrollIntoView({behavior:'smooth'});
jget('/api/legislacao/proposicao?id='+id).then(function(r){
var p=r.proposicao||{};
var html='<h3>'+esc((p.siglaTipo||'')+' '+(p.numero||'')+'/'+(p.ano||''))+'</h3><p class="muted">'+esc(p.ementa||'')+'</p>';
html+='<p><span class="pill">Situacao: '+esc((p.statusProposicao&&p.statusProposicao.descricaoSituacao)||'-')+'</span></p>';
html+='<h3>Linha do tempo (ultimas movimentacoes)</h3>';
html+=(r.tramitacao||[]).reverse().map(function(t){
return '<article><h4>'+esc(t.descricaoTramitacao||t.despacho||'-')+'</h4><small class="muted">'+esc(t.dataHora||'')+(t.siglaOrgao?' | '+esc(t.siglaOrgao):'')+'</small></article>';
}).join('')||'<p class="muted">Sem tramitacao registrada.</p>';
document.getElementById('det').innerHTML=html;
}).catch(function(e){document.getElementById('det').innerHTML='<p class="muted">Erro: '+e.message+'</p>';});
}
function verVotos(id){
  var card=document.getElementById('votos-card');card.style.display='block';
  document.getElementById('votos').innerHTML='<div class="skel"></div><div class="skel"></div>';
  card.scrollIntoView({behavior:'smooth'});
  jget('/api/legislacao/votacao?id='+encodeURIComponent(id)).then(function(r){
    var pl=r.placar||{};var votoClass=function(v){if(v==='Sim')return 'v-sim';if(v==='Não'||v==='Nao')return 'v-nao';return 'v-out';};
    var tS=+pl.Sim||0,tN=+pl.Nao||0,tT=+pl.Total||(tS+tN+(+pl.Abstencao||0)+(+pl.Obstrucao||0));
    var pS=tT?Math.round(tS/tT*100):0,pN=tT?Math.round(tN/tT*100):0,pO=Math.max(0,100-pS-pN);
    var h='<div class="placar" title="Sim '+tS+' × Não '+tN+' (total '+tT+')">'
      +'<span class="pl-sim" style="width:'+pS+'%">'+(pS>=12?('Sim '+tS):'')+'</span>'
      +'<span class="pl-nao" style="width:'+pN+'%">'+(pN>=12?('Não '+tN):'')+'</span>'
      +'<span class="pl-out" style="width:'+pO+'%">'+(pO>=18?'Outros':'')+'</span></div>'
      +'<div class="toolbar" style="gap:10px;margin-bottom:10px">'
      +'<span class="pill v-sim">Sim '+esc(pl.Sim||0)+'</span>'
      +'<span class="pill v-nao">Não '+esc(pl.Nao||0)+'</span>'
      +'<span class="pill v-out">Abstenção '+esc(pl.Abstencao||0)+'</span>'
      +'<span class="pill v-out">Obstrução '+esc(pl.Obstrucao||0)+'</span>'
      +'<span class="muted">Total '+esc(pl.Total||0)+' votos</span></div>';
    // resumo por partido
    if(r.partidos&&r.partidos.length){
      h+='<h3>Placar por partido</h3><table><thead><tr><th>Partido</th><th>Sim</th><th>Nao</th><th>Abst.</th><th>Total</th></tr></thead><tbody>';
      r.partidos.slice(0,15).forEach(function(p){h+='<tr><td>'+esc(p.partido)+'</td><td>'+esc(p.Sim||0)+'</td><td>'+esc(p.Nao||0)+'</td><td>'+esc(p.Abstencao||0)+'</td><td>'+esc(p.Total||0)+'</td></tr>';});
      h+='</tbody></table>';
    }
    // votos nominais
    h+='<h3>Votos nominais</h3><table><thead><tr><th>Deputado</th><th>Partido</th><th>UF</th><th>Voto</th></tr></thead><tbody>';
    (r.votos||[]).forEach(function(v){h+='<tr><td>'+esc(v.nome)+'</td><td>'+esc(v.partido)+'</td><td>'+esc(v.uf)+'</td><td class="'+votoClass(v.voto)+'">'+esc(v.voto)+'</td></tr>';});
    h+='</tbody></table>';
    h+='<p><a class="btn ghost" href="https://www.camara.leg.br/presenca-comissoes/votacao?legislatura=57" target="_blank" rel="noopener">Ver votacoes no site da Camara</a></p>';
    document.getElementById('votos').innerHTML=h;
  }).catch(function(e){document.getElementById('votos').innerHTML='<p class="muted">Votos nao disponiveis para esta votacao ('+esc(e.message)+'). A Camara divulga o detalhe nominal principalmente em votacoes do Plenario.</p>';});
}
function carregarAgenda(){
  var el=document.getElementById('agenda');
  jget('/api/legislacao/agenda').then(function(r){
    var evs=(r.eventos||[]).map(function(e){
      var dt=new Date(e.dataHoraInicio);
      e._dt=isNaN(dt)?null:dt;
      e._dia=e._dt?(e._dt.toLocaleDateString('pt-BR')):String(e.dataHoraInicio||'').slice(0,10);
      e._hora=e._dt?e._dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
      return e;
    });
    if(!evs.length){el.innerHTML=emptyHTML('Nenhum evento público nos próximos 7 dias','Pode ser recesso ou agenda em atualização.');return;}
    var dias={},ordem=[];
    evs.forEach(function(e){if(!dias[e._dia]){dias[e._dia]=[];ordem.push(e._dia);}dias[e._dia].push(e);});
    var hoje=new Date().toLocaleDateString('pt-BR');
    var html='<div class="agenda-grid">'+ordem.map(function(d){
      var dt0=dias[d][0]._dt;
      var sem=dt0?dt0.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''):'';
      var evHtml=dias[d].map(function(e){
        return '<div class="ag-ev"><b class="hora">'+esc(e._hora||'--:--')+'</b> <span class="tag">'+esc(e.descricaoTipo||'Evento')+'</span><br>'+esc((e.descricao||'Compromisso').slice(0,140))+(e.localCamara?'<br><small class="muted">'+esc(e.localCamara)+'</small>':'')+'</div>';
      }).join('');
      return '<div class="ag-dia'+(d===hoje?' hoje':'')+'"><h4>'+esc(sem?sem+' · ':'')+esc(d)+(d===hoje?' · hoje':'')+'</h4>'+evHtml+'</div>';
    }).join('')+'</div>';
    el.innerHTML=html;
  }).catch(function(){el.innerHTML='<p class="muted">Agenda indisponível. <button class="btn ghost" onclick="carregarAgenda()">Tentar de novo</button></p>';});
}
function carregarVot(){
jget('/api/legislacao/votacoes').then(function(r){
var html=(r.votacoes||[]).slice(0,8).map(function(v){
var pid=(String(v.id||'').split('-')[0]).replace(/\D/g,'')||(String(v.uriProposicaoObjeto||'').match(/proposicoes\/(\d+)/)||[])[1]||'';var a=pid?('<a href="https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao='+pid+'" target="_blank" rel="noopener">'+esc((v.descricao||v.proposicaoObjeto||'Votacao').slice(0,120))+'</a>'):esc((v.descricao||v.proposicaoObjeto||'Votacao').slice(0,120));return '<article><span class="tag">'+esc(v.siglaOrgao||'VOT')+'</span><h4>'+a+'</h4><small class="muted">'+esc(v.dataHoraRegistro||'')+(v.aprovada!=null?(' | '+(v.aprovada?'Aprovada':'Rejeitada')):'')+'</small><br><button class="btn ghost" onclick="verVotos(\''+esc(v.id)+'\')">Votos nominais</button></article>';
}).join('');
document.getElementById('vot').innerHTML=html||'<p class="muted">Sem votacoes recentes.</p>';
}).catch(function(){document.getElementById('vot').innerHTML='<p class="muted">Votacoes indisponiveis.</p>';});
}
document.getElementById('btn-buscar').onclick=buscarLeg;
document.getElementById('btn-vot').onclick=carregarVot;
document.getElementById('btn-agenda').onclick=carregarAgenda;
document.getElementById('q').addEventListener('keydown',function(e){if(e.key==='Enter')buscarLeg();});
carregarVot();
carregarAgenda();
