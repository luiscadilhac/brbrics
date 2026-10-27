// BrBRICS - Rotas de mapas geoespaciais (focos INPE/BDQueimadas, avioes OpenSky, embarcacoes, cameras)
module.exports.registrarMapas = function(app, cacheGet, cacheSet, getJSON) {

  // Ultima resposta boa por rota: se a fonte falhar, entrega o ultimo dado com aviso
  var ULTIMA_BOA = {};
  function guardarBoa(k, v){ ULTIMA_BOA[k] = { t: Date.now(), v: v }; }
  function UltimaBOA(k){ return ULTIMA_BOA[k] || null; }

// Nome do estado (sem acento) -> sigla da UF
  var NOME_UF = {
    ACRE: 'AC', ALAGOAS: 'AL', AMAPA: 'AP', AMAZONAS: 'AM', BAHIA: 'BA', CEARA: 'CE',
    DISTRITOFEDERAL: 'DF', ESPIRITOSANTO: 'ES', GOIAS: 'GO', MARANHAO: 'MA',
    MATOGROSSO: 'MT', MATOGROSSODOSUL: 'MS', MINASGERAIS: 'MG', PARA: 'PA', PARAIBA: 'PB',
    PARANA: 'PR', PERNAMBUCO: 'PE', PIAUI: 'PI', RIODEJANEIRO: 'RJ',
    RIOGRANDEDONORTE: 'RN', RIOGRANDEDOSUL: 'RS',
    RONDONIA: 'RO', RORAIMA: 'RR', SANTACATARINA: 'SC', SAOPAULO: 'SP',
    SERGIPE: 'SE', TOCANTINS: 'TO'
  };
  // Sigla da UF -> padrao LIKE para o campo 'estado' do BDQueimadas ('_' cobre acento)
  var UF_PRA_CQL = {
    AC: 'ACRE', AL: 'ALAGOAS', AM: 'AMAZONAS', AP: 'AMAP_', BA: 'BAHIA', CE: 'CEAR_',
    DF: 'DISTRITO FEDERAL', ES: 'ESP_RITO SANTO', GO: 'GOI_S', MA: 'MARANH_O',
    MG: 'MINAS GERAIS', MS: 'MATO GROSSO DO SUL', MT: 'MATO GROSSO', PA: 'PAR_',
    PB: 'PARA_BA', PR: 'PARAN_', PE: 'PERNAMBUCO', PI: 'PIAU_', RJ: 'RIO DE JANEIRO',
    RN: 'RIO GRANDE DO NORTE', RS: 'RIO GRANDE DO SUL', RO: 'ROND_NIA', RR: 'RORAIMA',
    SC: 'SANTA CATARINA', SE: 'SERGIPE', SP: 'S_O PAULO', TO: 'TOCANTINS'
  };
  function semEspaco(s){ return String(s || '').split(' ').join(''); }

  function semAcento(s){
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  }
  function horaLegivel(iso){
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  // ---- Satelite: focos de calor do BDQueimadas/INPE (GeoServer WFS, publico e sem chave) ----
  app.get('/api/mapas/satelite', function(req, res) {
    var uf = String(req.query.estado || 'BR').toUpperCase();
    if (uf === 'BRASIL') uf = 'BR';
    var ck = 'mapa_satelite_' + uf;
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var limiteInferior = new Date(Date.now() - 48 * 3600 * 1000).toISOString().slice(0, 19) + 'Z';
    var cql = "pais='Brasil' AND data_hora_gmt >= '" + limiteInferior + "'";
    var filtroUf = uf && uf !== 'BR' ? UF_PRA_CQL[uf] : null;
    if (uf && uf !== 'BR' && !filtroUf) {
      return res.json({ fonte: 'INPE - BDQueimadas', estado: uf, total: 0, focos: [],
        erro: 'UF desconhecida: ' + uf, atualizadoEm: new Date().toISOString() });
    }
    if (filtroUf) cql += " AND estado LIKE '" + filtroUf + "'";
    var url = 'https://data.inpe.br/queimadas/geoserver/bdqueimadas/ows' +
              '?service=WFS&version=1.0.0&request=GetFeature&typeName=focos' +
              '&maxFeatures=1500&outputFormat=application%2Fjson&srsName=EPSG%3A4326' +
              '&sortBy=data_hora_gmt%20DESC&cql_filter=' + encodeURIComponent(cql);

    getJSON(url, {}, 25000).then(function(r) {
      var colecao = r.data && r.data.features ? r.data : null;
      if (!colecao) {
        var err = new Error('Resposta inesperada do GeoServer (HTTP ' + r.status + ')');
        err.status = r.status;
        throw err;
      }
      var todos = [];
      var br = { latMin: -34, latMax: 6, lonMin: -75, lonMax: -32 };
      (colecao.features || []).forEach(function(ft) {
        var p = ft.properties || {};
        var lat = Number(p.latitude), lon = Number(p.longitude);
        if (!isFinite(lat) || !isFinite(lon)) return;
        if (lat < br.latMin || lat > br.latMax || lon < br.lonMin || lon > br.lonMax) return;
        var ufFoco = NOME_UF[semEspaco(semAcento(p.estado))] || semAcento(p.estado);
        if (uf && uf !== 'BR' && ufFoco !== uf) return;
        var frp = Number(p.frp);
        var risco = semAcento(p.risco_fogo);
        var intensidade = (risco && risco !== 'NONE' && risco !== '') ? risco
          : (isFinite(frp) && frp >= 30 ? 'ALTO' : isFinite(frp) ? 'MODERADO' : '—');
        todos.push({
          lat: lat, lon: lon, tipo: 'foco_calor',
          municipio: p.municipio ? String(p.municipio).toLowerCase().replace(/\b\w/g, function(c){ return c.toUpperCase(); }) : '—',
          uf: ufFoco, ufNome: p.estado || '—', bioma: p.bioma || '—', satelite: p.satelite || '—',
          datahora: p.data_hora_gmt || new Date().toISOString(),
          intensidade: intensidade, frp: isFinite(frp) ? frp : null
        });
      });
      if (!todos.length) {
        var vazio = new Error('A fonte não devolveu focos');
        vazio.vazio = true;
        throw vazio;
      }
      var out = {
        fonte: 'INPE - BDQueimadas (GeoServer WFS, satélites GOES/Sentinel/CBERS)',
        estado: uf, total: todos.length,
        totalNas48h: Number(colecao.numberMatched) || todos.length,
        periodo: 'últimas 48h', focos: todos,
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 300000);
      guardarBoa(ck, out);
      res.json(out);
    }).catch(function(e) {
      var boa = UltimaBOA(ck);
      if (boa && Date.now() - boa.t < 3600000) {
        var velho = JSON.parse(JSON.stringify(boa.v));
        velho.aviso = 'Fonte do INPE indisponível agora; mostrando a última coleta (' + horaLegivel(boa.v.atualizadoEm) + ').';
        velho.stale = true;
        return res.json(velho);
      }
      res.json({ fonte: 'INPE - BDQueimadas', estado: uf, total: 0, focos: [],
        erro: String((e && e.message) || e).slice(0, 160),
        aviso: 'Não foi possível consultar o BDQueimadas agora. Tente recarregar em instantes.',
        atualizadoEm: new Date().toISOString() });
    });
  });

  // ---- Avioes (OpenSky Network - ADS-B, sem chave) ----
  app.get('/api/mapas/avioes', function(req, res) {
    var ck = 'mapa_avioes';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var lamin = -34, lamax = 6, lomin = -75, lomax = -32;
    if (req.query.lamin) lamin = parseFloat(req.query.lamin);
    if (req.query.lamax) lamax = parseFloat(req.query.lamax);
    if (req.query.lomin) lomin = parseFloat(req.query.lomin);
    if (req.query.lomax) lomax = parseFloat(req.query.lomax);

    var url = 'https://opensky-network.org/api/states/all?' +
              'lamin=' + lamin + '&lamax=' + lamax +
              '&lomin=' + lomin + '&lomax=' + lomax;

    getJSON(url, {}, 25000).then(function(r) {
      var estados = r.data && r.data.states || [];
      var avioes = [];
      estados.forEach(function(s) {
        var lon = s[5], lat = s[6];
        if (lat == null || lon == null) return;
        avioes.push({
          icao24: s[0] || '—', callsign: (s[1] || '').trim() || '—',
          pais: s[2] || '—', lat: lat, lon: lon,
          altitude: s[7] != null ? s[7] : '—',
          velocidade: s[9] != null ? s[9] : '—',
          direcao: s[10] != null ? s[10] : '—',
          vertical_rate: s[11] != null ? s[11] : '—', tipo: 'aviao'
        });
      });
      if (!avioes.length) { var v = new Error('OpenSky devolveu zero aeronaves'); v.vazio = true; throw v; }
      var out = {
        fonte: 'OpenSky Network (ADS-B)', regiao: 'Brasil',
        total: avioes.length, avioes: avioes,
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 60000);
      guardarBoa(ck, out);
      res.json(out);
    }).catch(function(e) {
      var boa = UltimaBOA(ck);
      if (boa && Date.now() - boa.t < 1800000) {
        var velho = JSON.parse(JSON.stringify(boa.v));
        velho.aviso = 'OpenSky indisponível agora; última coleta às ' + horaLegivel(boa.v.atualizadoEm) + '.';
        velho.stale = true;
        return res.json(velho);
      }
      res.json({ fonte: 'OpenSky Network', regiao: 'Brasil', total: 0, avioes: [],
        erro: String((e && e.message) || e).slice(0, 160),
        aviso: 'A fonte de transponder ADS-B (OpenSky) não respondeu. Recarregue em instantes.',
        atualizadoEm: new Date().toISOString() });
    });
  });

  // ---- Embarcações (AIS ao vivo exige chave; portos oficiais entram como camada de referência) ----
  var PORTOS = [
    { nome: 'Porto de Santos', uf: 'SP', lat: -23.9510, lon: -46.3100, tipo: 'porto', hidrovia: 'Santos' },
    { nome: 'Porto de São Sebastião', uf: 'SP', lat: -23.7600, lon: -45.4100, tipo: 'porto', hidrovia: 'São Sebastião' },
    { nome: 'Porto de Paranaguá', uf: 'PR', lat: -25.5160, lon: -48.3060, tipo: 'porto', hidrovia: 'Paranaguá' },
    { nome: 'Porto do Rio de Janeiro', uf: 'RJ', lat: -22.8840, lon: -43.1900, tipo: 'porto', hidrovia: 'Baía de Guanabara' },
    { nome: 'Porto de Itaguaí (Sepetiba)', uf: 'RJ', lat: -22.9300, lon: -43.6800, tipo: 'porto', hidrovia: 'Baía de Sepetiba' },
    { nome: 'Porto de Vitória', uf: 'ES', lat: -20.0880, lon: -40.0960, tipo: 'porto', hidrovia: 'Vitória' },
    { nome: 'Porto do Açu', uf: 'RJ', lat: -22.3700, lon: -41.6200, tipo: 'porto', hidrovia: 'São João da Barra' },
    { nome: 'Porto de Suape', uf: 'PE', lat: -8.2800, lon: -34.9600, tipo: 'porto', hidrovia: 'Cabo de Santo Agostinho' },
    { nome: 'Porto de Recife', uf: 'PE', lat: -8.0300, lon: -34.8700, tipo: 'porto', hidrovia: 'Recife' },
    { nome: 'Porto de Maceió', uf: 'AL', lat: -9.6660, lon: -35.7500, tipo: 'porto', hidrovia: 'Maceió' },
    { nome: 'Porto de Salvador', uf: 'BA', lat: -12.9700, lon: -38.5200, tipo: 'porto', hidrovia: 'Baía de Todos os Santos' },
    { nome: 'Porto de Ilhéus', uf: 'BA', lat: -14.8000, lon: -39.0500, tipo: 'porto', hidrovia: 'Ilhéus' },
    { nome: 'Porto de Aracaju (Vila do Porto)', uf: 'SE', lat: -11.0000, lon: -37.1000, tipo: 'porto', hidrovia: 'Aracaju' },
    { nome: 'Porto de Natal (Pecém)', uf: 'CE', lat: -3.4700, lon: -38.8000, tipo: 'porto', hidrovia: 'Pecém' },
    { nome: 'Porto de Fortaleza (MPEC)', uf: 'CE', lat: -3.7200, lon: -38.5200, tipo: 'porto', hidrovia: 'Fortaleza' },
    { nome: 'Porto de São Luís (Itaqui)', uf: 'MA', lat: -2.5200, lon: -44.3000, tipo: 'porto', hidrovia: 'Bacoaba/Itaqui' },
    { nome: 'Porto de Belém', uf: 'PA', lat: -1.4600, lon: -48.5000, tipo: 'porto', hidrovia: 'Baía de Guajará' },
    { nome: 'Porto de Vila do Conde', uf: 'PA', lat: -1.1900, lon: -47.5300, tipo: 'porto', hidrovia: 'Marajó' },
    { nome: 'Porto de Santarém', uf: 'PA', lat: -2.4400, lon: -54.7100, tipo: 'porto', hidrovia: 'Rio Amazonas' },
    { nome: 'Porto de Manaus (CODAM)', uf: 'AM', lat: -3.0700, lon: -60.0100, tipo: 'porto', hidrovia: 'Rio Negro' },
    { nome: 'Porto de Cáceres', uf: 'MT', lat: -16.0700, lon: -57.6800, tipo: 'porto', hidrovia: 'Rio Paraguai' },
    { nome: 'Porto de Corumbá', uf: 'MS', lat: -19.0000, lon: -57.6600, tipo: 'porto', hidrovia: 'Rio Paraguai' }
  ];

  app.get('/api/mapas/embarcacoes', function(req, res) {
    var ck = 'mapa_embarcacoes';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var url = 'https://www.vesseltracker.com/app/map/vessels';
    getJSON(url, {}, 12000).then(function(r) {
      var embarcoes = [];
      var dados = r.data || r.vessels || [];
      if (Array.isArray(dados)) {
        dados.slice(0, 200).forEach(function(v) {
          var lat = Number(v.lat || v.latitude), lon = Number(v.lon || v.longitude);
          if (!isFinite(lat) || !isFinite(lon)) return;
          embarcoes.push({
            nome: v.nome || v.name || '—', mmsi: v.mmsi || '—',
            tipo: v.tipo || v.shipType || 'Embarcação',
            lat: lat, lon: lon,
            velocidade: v.velocidade || v.speed || '—', direcao: v.direcao || v.course || '—',
            bandeira: v.bandeira || v.flag || '—', aoVivo: true
          });
        });
      }
      if (!embarcoes.length) { var v = new Error('Sem embarcações na fonte'); v.vazio = true; throw v; }
      var out = {
        fonte: 'AIS ao vivo - rastreamento público', regiao: 'Costa brasileira',
        total: embarcoes.length, embarcacoes: embarcoes,
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 300000);
      guardarBoa(ck, out);
      res.json(out);
    }).catch(function() {
      var out = {
        fonte: 'Rede portuária brasileira — compilação BrBRICS (coordenadas aproximadas dos portos organizadores)',
        regiao: 'Costa e hidrovias brasileiras', aoVivo: false,
        aviso: 'Rastreamento AIS ao vivo exige chave de API (MarineTraffic, VesselFinder, AISstream). Sem chave, o mapa mostra a rede portuária de referência.',
        total: PORTOS.length, embarcacoes: PORTOS.map(function(p) {
          return { nome: p.nome, mmsi: '—', tipo: p.tipo, lat: p.lat, lon: p.lon,
                   velocidade: '—', direcao: '—', bandeira: 'Brasil', uf: p.uf, hidrovia: p.hidrovia, aoVivo: false };
        }),
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 3600000);
      res.json(out);
    });
  });

  // ---- Cameras online (lista de cameras publicas do Brasil) ----
  app.get('/api/mapas/cameras', function(req, res) {
    var ck = 'mapa_cameras';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var cameras = [
      { nome: 'CET-SP - Av. Paulista', lat: -23.5616, lon: -46.6533, tipo: 'transito', cidade: 'São Paulo', uf: 'SP', url: 'https://www.cetsp.com.br/' },
      { nome: 'CET-SP - Marginal Pinheiros', lat: -23.5600, lon: -46.6900, tipo: 'transito', cidade: 'São Paulo', uf: 'SP', url: 'https://www.cetsp.com.br/' },
      { nome: 'CET-SP - Av. dos Estados', lat: -23.5900, lon: -46.7100, tipo: 'transito', cidade: 'São Paulo', uf: 'SP', url: 'https://www.cetsp.com.br/' },
      { nome: 'DNIT - BR-116 (SP)', lat: -23.5500, lon: -46.6333, tipo: 'rodovia', cidade: 'São Paulo', uf: 'SP', url: 'https://www.dnit.gov.br/' },
      { nome: 'DNIT - BR-040 (DF/GO)', lat: -15.8267, lon: -47.9218, tipo: 'rodovia', cidade: 'Brasília', uf: 'DF', url: 'https://www.dnit.gov.br/' },
      { nome: 'DNIT - BR-101 (BA)', lat: -12.9714, lon: -38.5014, tipo: 'rodovia', cidade: 'Salvador', uf: 'BA', url: 'https://www.dnit.gov.br/' },
      { nome: 'DNIT - BR-277 (PR)', lat: -25.4284, lon: -49.2733, tipo: 'rodovia', cidade: 'Curitiba', uf: 'PR', url: 'https://www.dnit.gov.br/' },
      { nome: 'INMET - Brasília', lat: -15.8267, lon: -47.9218, tipo: 'clima', cidade: 'Brasília', uf: 'DF', url: 'https://portal.inmet.gov.br/' },
      { nome: 'INMET - São Paulo', lat: -23.5505, lon: -46.6333, tipo: 'clima', cidade: 'São Paulo', uf: 'SP', url: 'https://portal.inmet.gov.br/' },
      { nome: 'INMET - Rio de Janeiro', lat: -22.9068, lon: -43.1729, tipo: 'clima', cidade: 'Rio de Janeiro', uf: 'RJ', url: 'https://portal.inmet.gov.br/' },
      { nome: 'Rio - Centro (Orla)', lat: -22.9711, lon: -43.2253, tipo: 'cidade', cidade: 'Rio de Janeiro', uf: 'RJ', url: 'https://www.rio.rj.gov.br/' },
      { nome: 'Salvador - Pelourinho', lat: -12.9714, lon: -38.5014, tipo: 'cidade', cidade: 'Salvador', uf: 'BA', url: 'https://www.salvador.ba.gov.br/' },
      { nome: 'Florianópolis - Beira-Mar', lat: -27.5949, lon: -48.5480, tipo: 'cidade', cidade: 'Florianópolis', uf: 'SC', url: 'https://www.florianopolis.sc.gov.br/' }
    ];

    var out = {
      fonte: 'Câmeras públicas municipais, estaduais e federais (Brasil)',
      total: cameras.length, cameras: cameras,
      aviso: 'Lista de referência com portais oficiais; o vídeo ao vivo está em cada órgão.',
      atualizadoEm: new Date().toISOString()
    };
    cacheSet(ck, out, 3600000);
    res.json(out);
  });

};
