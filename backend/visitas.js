// BrBRICS - modulo Visitas: contagem própria, sem cookies e sem terceiros.
// Os dados ficam em arquivos mensais (dados/visitas-AAAA-MM.jsonl) e zeram a
// cada novo deploy no plano gratuito (disco efêmero) — o agregado do mês some,
// mas a privacidade é total: sem IP, sem cookie, sem fingerprint.
var fs=null,path=null;try{fs=require('fs');path=require('path');}catch(e){}
var DIR=path?path.join(__dirname,'..','dados'):[];
var BOT=/bot|crawl|spider|slurp|mediapartners|baidu|yandex|ahrefs|semrush|mj12|dotbot|petal|bytespider|gptbot|ccbot/i;
var GIF=Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==','base64');
function diaKey(t){var d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function hostDe(ref){try{var m=String(ref||'').match(/\/\/([^\/]+)/);return m?m[1]:'';}catch(e){return '';}}
function lerArquivo(f){
  var linhas=[];
  try{
    if(!fs.existsSync(f))return linhas;
    var st=fs.statSync(f);
    if(st.size>10*1024*1024)return linhas;
    var txt=fs.readFileSync(f,'utf8').split('\n');
    for(var i=0;i<txt.length;i++){
      if(!txt[i].trim())continue;
      try{var o=JSON.parse(txt[i]);if(o&&o.t&&o.pag)linhas.push(o);}catch(e){}
    }
  }catch(e){}
  return linhas;
}
function registrarVisitas(app){
  try{if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});}catch(e){}
  // Pixel de contagem (chamado por <img> em todas as páginas)
  app.get('/api/visita', function(req,res){
    try{
      var ua=String(req.headers['user-agent']||'');
      if(!BOT.test(ua)){
        var d=new Date();
        var linha=JSON.stringify({t:d.toISOString(),
          pag:String(req.query.pag||'/').slice(0,120),
          ref:hostDe(req.query.ref||''),
          mob:/mobile|android|iphone|ipad/i.test(ua)?1:0})+'\n';
        var f=path.join(DIR,'visitas-'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'.jsonl');
        fs.appendFile(f,linha,function(){});
      }
    }catch(e){}
    res.set('Cache-Control','no-store');
    res.set('Content-Type','image/gif');
    res.send(GIF);
  });
  // Resumo agregado (protegido por chave quando PAINEL_TOKEN definido)
  app.get('/api/visitas/resumo', function(req,res){
    var token=process.env.PAINEL_TOKEN||'';
    var aberto=!token;
    if(token&&String(req.query.chave||'')!==token){
      return res.status(403).json({erro:'acesso negado', dica:'informe ?chave= (defina PAINEL_TOKEN no servidor)'});
    }
    try{
      var agora=new Date();
      var arquivos=[];
      for(var m=0;m<2;m++){
        var dd=new Date(agora.getFullYear(),agora.getMonth()-m,1);
        arquivos.push(path.join(DIR,'visitas-'+dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'.jsonl'));
      }
      var todas=[];
      arquivos.forEach(function(f){lerArquivo(f).forEach(function(o){todas.push(o);});});
      var hoje=diaKey(agora), limite7=agora.getTime()-7*86400000, limite30=agora.getTime()-30*86400000, limite5=agora.getTime()-5*60000;
      var porDia={}, porPag={}, porRef={}, porPag30={}, online=0, nHoje=0, n7=0, n30=0;
      todas.forEach(function(o){
        var t=0;try{t=new Date(o.t).getTime();}catch(e){return;}
        if(isNaN(t))return;
        var dk=diaKey(o.t);
        porDia[dk]=(porDia[dk]||0)+1;
        porPag[o.pag]=(porPag[o.pag]||0)+1;
        if(o.ref)porRef[o.ref]=(porRef[o.ref]||0)+1;
        if(t>limite5)online++;
        if(dk===hoje)nHoje++;
        if(t>limite7)n7++;
        if(t>limite30){n30++;porPag30[o.pag]=(porPag30[o.pag]||0)+1;}
      });
      function top(obj,n){
        return Object.keys(obj).map(function(k){return {k:k,v:obj[k]};}).sort(function(a,b){return b.v-a.v;}).slice(0,n||10);
      }
      var dias=Object.keys(porDia).sort().slice(-30).map(function(k){return {dia:k.slice(5),total:porDia[k]};});
      res.json({aberto:aberto, total:todas.length, hoje:nHoje, dias7:n7, dias30:n30, online5min:online,
        porDia:dias, topPaginas:top(porPag30,10), topOrigens:top(porRef,10)});
    }catch(e){res.status(500).json({erro:'falha ao agregar', detalhe:String((e&&e.message)||e).slice(0,120)});}
  });
}
module.exports={registrarVisitas:registrarVisitas};
