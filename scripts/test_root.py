const https=require('https');
// cada orgao: lista de URLs candidatas
const cands={
  CVM:['https://www.gov.br/cvm/RSS'],
  ANVISA:['https://www.gov.br/anvisa/RSS','https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/RSS','https://www.gov.br/anvisa/pt-br/RSS'],
  ANATEL:['https://www.gov.br/anatel/RSS','https://www.gov.br/anatel/pt-br/assuntos/noticias/RSS','https://www.gov.br/anatel/pt-br/RSS'],
  ANEEL:['https://www.gov.br/aneel/RSS','https://www.gov.br/aneel/pt-br/assuntos/noticias/RSS','https://www.gov.br/aneel/pt-br/RSS'],
  ANS:['https://www.gov.br/ans/RSS','https://www.gov.br/ans/pt-br/assuntos/noticias-ans/RSS','https://www.gov.br/ans/pt-br/RSS'],
  CADE:['https://www.gov.br/cade/RSS','https://www.gov.br/cade/pt-br/assuntos/noticias/RSS','https://www.gov.br/cade/pt-br/RSS'],
  INMETRO:['https://www.gov.br/inmetro/RSS','https://www.gov.br/inmetro/pt-br/assuntos/noticias/RSS','https://www.gov.br/inmetro/pt-br/RSS'],
  ANAC:['https://www.gov.br/anac/RSS','https://www.gov.br/anac/pt-br/assuntos/noticias/RSS','https://www.gov.br/anac/pt-br/RSS'],
  ANCINE:['https://www.gov.br/ancine/RSS','https://www.gov.br/ancine/pt-br/assuntos/noticias/RSS','https://www.gov.br/ancine/pt-br/RSS'],
  ANP:['https://www.gov.br/anp/RSS','https://www.gov.br/anp/pt-br/assuntos/noticias/RSS','https://www.gov.br/anp/pt-br/RSS'],
  SUSEP:['https://www.gov.br/susep/RSS','https://www.gov.br/susep/pt-br/assuntos/noticias/RSS','https://www.gov.br/susep/pt-br/RSS']
};
function get(u){
  return new Promise(function(res,rej){
    var req=https.get(u,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Accept':'application/rss+xml,application/xml,text/xml,*/*'},timeout:15000},function(r){
      if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.destroy();return get(r.headers.location).then(res,rej);}
      var d='';r.setEncoding('utf8');r.on('data',function(c){d+=c;});r.on('end',function(){res({status:r.statusCode,ct:r.headers['content-type']||'',body:d});});
    });
    req.on('error',function(e){rej(e);});req.on('timeout',function(){req.destroy(new Error('timeout'));});
  });
}
(async function(){
  for(const k of Object.keys(cands)){
    let found=false;
    for(const u of cands[k]){
      if(found)break;
      try{
        const r=await get(u);
        const items=(r.body.match(/<item[\s>]|<entry[\s>]/g)||[]).length;
        if(r.status===200&&items>0){
          console.log('OK  ',(k+'        ').slice(0,10),'items='+String(items).padStart(3),'ct='+r.ct.slice(0,24),'|',u);
          found=true;
        }
      }catch(e){}
    }
    if(!found)console.log('    ',(k+'        ').slice(0,10),'NENHUM RSS valido');
  }
})();
