// BrBRICS - Rotas de mapas geoespaciais (focos INPE/BDQueimadas, avioes ADS-B, embarcacoes AIS,
// satelites em orbita por TLE, cameras publicas). Nenhuma fonte pede chave ou cadastro.
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
  function espera(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

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

  // ---- Avioes (ADS-B) ----
  // A OpenSky vive expirando na producao (medido em 2026-10-30: 25s e "The user aborted a
  // request" e o mapa sem nenhum aviao). A adsb.lol respondeu em 1,2s com 187 aeronaves na
  // caixa do Sudeste, sem chave, entao ela passa a ser a fonte primaria e a OpenSky a reserva.
  var ADSB_CENTROS = [
    { nome: 'Sudeste', lat: -23.55, lon: -46.63, dist: 1200 },
    { nome: 'Centro-Oeste', lat: -15.79, lon: -47.89, dist: 1500 },
    { nome: 'Nordeste', lat: -8.05, lon: -34.90, dist: 1200 },
    { nome: 'Norte', lat: -3.10, lon: -60.02, dist: 1200 }
  ];

  // Origem estimada pelo prefixo da matricula: o ADS-B nao traz a nacionalidade da aeronave
  var MATRICULA_PAIS = {
    PP: 'Brasil', PR: 'Brasil', PS: 'Brasil', PT: 'Portugal', LU: 'Luxemburgo',
    N: 'Estados Unidos', C: 'Canadá', B: 'China', CC: 'Chile', VH: 'Austrália', EC: 'Espanha', EI: 'Irlanda',
    EL: 'Grécia', EN: 'Noruega', ES: 'Suécia', OY: 'Dinamarca', PH: 'Países Baixos',
    OO: 'Países Baixos', D: 'Alemanha', F: 'França', G: 'Reino Unido', I: 'Itália',
    M: 'Malásia', O: 'Áustria', T: 'Turquia', VU: 'Índia', VT: 'Índia', JA: 'Japão',
    HL: 'Coreia do Sul', VP: 'Reino Unido', VQ: 'Reino Unido', VX: 'Canadá',
    '9V': 'Singapura', '9H': 'Malta', '9A': 'Croácia', LY: 'Lituânia', TF: 'Islândia',
    A2: 'Essuatíni', ZS: 'África do Sul', YU: 'Sérvia', YR: 'Romênia', SU: 'Egito',
    AP: 'Paquistão', HA: 'Hungria', HB: 'Suíça', HZ: 'Arábia Saudita', OZ: 'Hungria'
  };
  function paisDaMatricula(r){
    var s = String(r || '').toUpperCase();
    return MATRICULA_PAIS[s.slice(0, 2)] || MATRICULA_PAIS[s.slice(0, 1)] || '—';
  }
  var MODELOS_AERO = {
    A21N: 'Airbus A320neo', A20N: 'Airbus A321neo', A320: 'Airbus A320', A359: 'Airbus A350',
    A21: 'Airbus A321', A333: 'Airbus A330-300', B38M: 'Boeing 737 MAX 8', B37M: 'Boeing 737 MAX 7',
    B738: 'Boeing 737-800', B739: 'Boeing 737-900', B77W: 'Boeing 777-200LR', B763: 'Boeing 767-300',
    E75L: 'Embraer E190/E195', E190: 'Embraer E190', E275: 'Embraer E195-E2', C182: 'Cessna 182',
    C56X: 'Cessna Citation', C68A: 'Cessna Grand Caravan', PC12: 'Pilatus PC-12',
    AS3N: 'Airbus Helicopters', B35M: 'Bell/Helikóptero', DV20: 'Diamond', PA28: 'Piper', PA34: 'Piper'
  };

  function deAdsb(d, centro){
    var agora = Math.floor(Date.now() / 1000);
    return (d.ac || []).map(function(a){
      if (a.lat == null || a.lon == null) return null;
      var alt = typeof a.alt_baro === 'number' ? a.alt_baro : (typeof a.alt_geom === 'number' ? a.alt_geom : null);
      return {
        icao24: a.hex || '—', callsign: (a.flight || '').trim() || String(a.r || '').trim() || '—',
        matricula: a.r || '', pais: paisDaMatricula(a.r),
        modelo: MODELOS_AERO[String(a.t || '').toUpperCase()] || '',
        lat: a.lat, lon: a.lon,
        altitude_ft: alt !== null ? alt : '—',
        altitude_m: alt !== null ? Math.round(alt * 0.3048) : '—',
        velocidade_kt: typeof a.gs === 'number' ? Math.round(a.gs) : '—',
        velocidade_kmh: typeof a.gs === 'number' ? Math.round(a.gs * 1.852) : '—',
        vertical_ft_min: typeof a.baro_rate === 'number' ? a.baro_rate : '—',
        direcao: typeof a.track === 'number' ? a.track : '—',
        squawk: a.squawk || '', emergencia: (a.emergency && a.emergency !== 'none') ? a.emergency : '',
        visto_ha: typeof a.seen === 'number' ? Math.round(a.seen) : null,
        atualizado: agora, origem: centro
      };
    }).filter(Boolean);
  }

  // varre os centros em sequencia (a fonte fecha a porta para pedidos em paralelo) e deduplica
  function varreAdsb(i, mapa, out){
    if (i >= ADSB_CENTROS.length) return Promise.resolve(out);
    var c = ADSB_CENTROS[i];
    var url = 'https://api.adsb.lol/v2/lat/' + c.lat + '/lon/' + c.lon + '/dist/' + c.dist;
    return getJSON(url, {}, 12000).then(function(r){
      if (r.status === 200 && r.data && r.data.ac) {
        deAdsb(r.data, c.nome).forEach(function(a){
          var k = a.icao24 + '_' + a.callsign;
          if (!mapa[k]) { mapa[k] = 1; out.push(a); }
        });
      }
      return espera(250);
    }).catch(function(){ return espera(250); })
      .then(function(){ return varreAdsb(i + 1, mapa, out); });
  }

  // Reserva: a OpenSky costuma responder, mas nao se pode depender dela
  function pelaOpenSky(){
    var url = 'https://opensky-network.org/api/states/all?lamin=-34&lamax=6&lomin=-75&lomax=-32';
    return getJSON(url, {}, 15000).then(function(r){
      return ((r.data && r.data.states) || []).map(function(s){
        if (s[6] == null || s[5] == null) return null;
        return {
          icao24: s[0] || '—', callsign: (s[1] || '').trim() || '—', matricula: '',
          pais: s[2] || '—', modelo: '', lat: s[6], lon: s[5],
          altitude_ft: s[7] != null ? Math.round(s[7] / 0.3048) : '—',
          altitude_m: s[7] != null ? Math.round(s[7]) : '—',
          velocidade_kt: s[9] != null ? Math.round(s[9] * 1.94384) : '—',
          velocidade_kmh: s[9] != null ? Math.round(s[9] * 3.6) : '—',
          vertical_ft_min: s[11] != null ? Math.round(s[11] * 196.85) : '—',
          direcao: s[10] != null ? s[10] : '—', squawk: '', emergencia: '', visto_ha: null,
          atualizado: s[4] || Math.floor(Date.now() / 1000), origem: 'OpenSky'
        };
      }).filter(Boolean);
    });
  }

  app.get('/api/mapas/avioes', function(req, res) {
    var ck = 'mapa_avioes';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    varreAdsb(0, {}, []).then(function(avioes){
      if (!avioes.length) throw new Error('adsb.lol sem resposta');
      var boa = {
        fonte: 'adsb.lol (ADS-B comunitário)', regiao: 'Brasil', aoVivo: true,
        total: avioes.length, avioes: avioes, atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, boa, 45000); guardarBoa(ck, boa);
      res.json(boa);
    }).catch(function() {
      pelaOpenSky().then(function(avioes){
        if (!avioes.length) throw new Error('OpenSky também vazia');
        var reserva = {
          fonte: 'OpenSky Network (ADS-B)', regiao: 'Brasil', aoVivo: true,
          total: avioes.length, avioes: avioes, atualizadoEm: new Date().toISOString(),
          aviso: 'A adsb.lol não respondeu agora; a lista veio da OpenSky Network.'
        };
        cacheSet(ck, reserva, 45000); guardarBoa(ck, reserva);
        res.json(reserva);
      }).catch(function(e2) {
        var boa = UltimaBOA(ck);
        if (boa && Date.now() - boa.t < 1800000) {
          var velho = JSON.parse(JSON.stringify(boa.v));
          velho.aviso = 'As duas fontes ADS-B não responderam; última leitura às ' + horaLegivel(boa.v.atualizadoEm) + '.';
          velho.stale = true;
          return res.json(velho);
        }
        res.json({ fonte: 'adsb.lol / OpenSky Network', regiao: 'Brasil', total: 0, avioes: [],
          erro: String((e2 && e2.message) || e2).slice(0, 160),
          aviso: 'Nenhuma das duas fontes de transponder ADS-B respondeu. Recarregue em instantes.',
          atualizadoEm: new Date().toISOString() });
      });
    });
  });

  // ---- Embarcacoes (AIS ao vivo pela rede aberta Open Waters; portos ficam como camada de referencia) ----
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

    // Rede aberta Open Waters AIS: devolve GeoJSON de navios por caixa, sem chave e sem
    // cadastro (medido em 2026-10-30: Santos 237, Rio 355, Itajai 129, Manaus 49 navios).
    // Caixa grande demais da 400, entao o pais e coberto em varias caixas pequenas.
    // As caixas sao leidas uma a uma e os nomes precisam bater com o que a caixa realmente
    // alcanca: ate aqui a caixa "Itajaí e Paranaguá" ia de -26.4 para norte e deixava o canal
    // de Itajaí/Navegantes (-26.9) inteiro de fora — por isso nao aparecia nenhuma embarcacao
    // ali, nao por falta de trafego (medido: 79 navios nessa caixa, 104 ate São Francisco do
    // Sul). Cada caixa abaixo foi medida no Open Waters em 2026-10-30.
    var CAIXAS_AIS = [
      { nome: 'Santos e São Sebastião', bbox: '-25.4,-47.6,-23.0,-45.2' },
      { nome: 'Paranaguá, Joinville e São Francisco do Sul', bbox: '-26.45,-49.00,-25.10,-48.20' },
      { nome: 'Itajaí, Navegantes e Florianópolis', bbox: '-28.20,-49.40,-26.45,-48.20' },
      { nome: 'Rio Grande e Lagoa dos Patos', bbox: '-32.60,-52.70,-31.60,-51.20' },
      { nome: 'Rio de Janeiro e Espírito Santo', bbox: '-23.6,-44.2,-20.5,-40.0' },
      { nome: 'Vitória, Açu e litoral norte do ES', bbox: '-21.40,-41.60,-19.40,-39.60' },
      { nome: 'Salvador e Aracaju', bbox: '-14.0,-39.4,-11.6,-37.4' },
      { nome: 'Suape, Recife e Pecém', bbox: '-9.2,-39.1,-3.4,-34.6' },
      { nome: 'Itaqui, São Luís e Belém', bbox: '-3.2,-50.6,-0.8,-44.0' },
      { nome: 'Manaus e rio Negro', bbox: '-4.2,-61.0,-1.8,-58.6' },
      { nome: 'Santarém e baixo Amazonas', bbox: '-3.4,-55.6,-1.0,-54.0' }
    ];

    var TIPO_AIS = { 30: 'Pesca', 31: 'Reboque', 32: 'Draga / operação submersa', 33: 'Mergulho',
      34: 'Prático (pilotos)', 35: 'Apoio a embarcação', 36: 'Embarcação especial', 37: 'Antipoluição',
      38: 'Gelo / polar', 39: 'Embarcação especial' };
    function tipoDeAIS(t){
      var n = Number(t);
      if (!isFinite(n)) return 'Embarcação';
      if (TIPO_AIS[n]) return TIPO_AIS[n];
      if (n >= 130) return 'Bóia / marca de navegação';
      if (n <= 19) return 'Efeito de superfície (WIG)';
      if (n <= 29) return 'Hovercraft';
      if (n <= 49) return 'Lancha de alta velocidade';
      if (n <= 59) return 'Navio de serviço';
      if (n <= 69) return 'Navio de passageiros';
      if (n <= 79) return 'Navio de carga';
      if (n <= 89) return 'Navio-tanque';
      if (n <= 99) return 'Veleiro / recreio';
      return 'Embarcação';
    }
    var STATUS_NAV = { 0: 'em navegação', 1: 'ancorado', 2: 'sem governo', 3: 'manobra restrita',
      4: 'encalhado (reservado)', 5: 'encalhado', 6: 'operação restrita', 7: 'à deriva com máquina parada',
      8: 'amarado a boia', 9: 'encalhado', 10: 'pescando', 11: 'à vela', 14: 'plataforma fixa',
      15: 'status não informado' };
    var BANDEIRAS = { BR: 'Brasil', US: 'Estados Unidos', PA: 'Panamá', LR: 'Libéria', MH: 'Ilhas Marshall',
      HK: 'Hong Kong', SG: 'Singapura', CN: 'China', NO: 'Noruega', DK: 'Dinamarca', DE: 'Alemanha',
      NL: 'Países Baixos', BE: 'Bélgica', PT: 'Portugal', ES: 'Espanha', IT: 'Itália', GR: 'Grécia',
      MT: 'Malta', GB: 'Reino Unido', JP: 'Japão', KR: 'Coreia do Sul', TW: 'Taiwan', VN: 'Vietnã',
      TH: 'Tailândia', MY: 'Malásia', ID: 'Indonésia', IN: 'Índia', PH: 'Filipinas', AE: 'Emirados Árabes',
      SA: 'Arábia Saudita', TR: 'Turquia', EG: 'Egito', LR2: 'Libéria', BS: 'Bahamas', BB: 'Barbados',
      VG: 'Ilhas Virgens Britânicas', CY: 'Chipre', LB: 'Líbano', GE: 'Geórgia', KZ: 'Cazaquistão',
      FI: 'Finlândia', SE: 'Suécia', PL: 'Polônia', LT: 'Lituânia', IS: 'Islândia', IE: 'Irlanda',
      FR: 'França', CA: 'Canadá', MX: 'México', VE: 'Venezuela', CO: 'Colômbia', AR: 'Argentina',
      CL: 'Chile', UY: 'Uruguai', PE: 'Peru', EC: 'Equador', ZA: 'África do Sul', AU: 'Austrália',
      NZ: 'Nova Zelândia', RU: 'Rússia', MA: 'Marrocos', TN: 'Tunísia' };
    function paisDaBandeira(f){
      var c = String(f || '').toUpperCase();
      return BANDEIRAS[c] || (c ? c : '—');
    }

    function deGeoJSONNavios(fc, caixa, mapa, out){
      (fc && fc.features ? fc.features : []).forEach(function(ft){
        var co = ft.geometry && ft.geometry.coordinates;
        var p = ft.properties || {};
        if (!co || co.length < 2) return;
        var lon = Number(co[0]), lat = Number(co[1]);
        if (!isFinite(lat) || !isFinite(lon)) return;
        var chave = String(p.mmsi || (p.name || '') + lat);
        if (mapa[chave]) return;
        mapa[chave] = 1;
        var sog = typeof p.sog === 'number' ? p.sog : null;
        out.push({
          nome: p.name || 'Sem nome', mmsi: p.mmsi || '—', imo: p.imo || '',
          indicativo: p.callsign || '', tipo: tipoDeAIS(p.type), tipoAis: p.type,
          bandeira: paisDaBandeira(p.flag), status: STATUS_NAV[p.nav_status] || ('status ' + p.nav_status),
          lat: lat, lon: lon,
          velocidade_kt: sog !== null ? Math.round(sog * 10) / 10 : '—',
          velocidade_kmh: sog !== null ? Math.round(sog * 1.852 * 10) / 10 : '—',
          rumo: typeof p.cog === 'number' ? p.cog : (typeof p.heading === 'number' ? p.heading : '—'),
          navegando: sog !== null && sog >= 0.5,
          destino: p.destination || '', comprimento: p.length || '', calado: p.draught || '',
          vistoEm: p.seen || '', fonteAis: p.source || '', caixa: caixa.nome
        });
      });
    }

    function varreAis(i, mapa, out){
      if (i >= CAIXAS_AIS.length) return Promise.resolve(out);
      var c = CAIXAS_AIS[i];
      var url = 'https://ais.openwaters.io/v1/vessels?bbox=' + c.bbox;
      return getJSON(url, {}, 12000).then(function(r){
        if (r.status === 200 && r.data && r.data.features) deGeoJSONNavios(r.data, c, mapa, out);
        return espera(150);
      }).catch(function(){ return espera(150); })
        .then(function(){ return varreAis(i + 1, mapa, out); });
    }

    function soPortos(){
      return {
        fonte: 'Rede portuária brasileira — compilação BrBRICS (coordenadas aproximadas dos portos organizadores)',
        regiao: 'Costa e hidrovias brasileiras', aoVivo: false, portos: PORTOS,
        aviso: 'O AIS ao vivo não respondeu agora. O mapa mostra a rede portuária de referência.',
        total: PORTOS.length, embarcacoes: PORTOS.map(function(p) {
          return { nome: p.nome, mmsi: '—', tipo: 'Porto', lat: p.lat, lon: p.lon,
                   velocidade_kt: '—', direcao: '—', bandeira: 'Brasil', uf: p.uf, navegando: false };
        }),
        atualizadoEm: new Date().toISOString()
      };
    }

    varreAis(0, {}, []).then(function(embarcoes){
      if (!embarcoes.length) throw new Error('AIS sem resposta');
      var navegando = embarcoes.filter(function(e){ return e.navegando }).length;
      var boa = {
        fonte: 'Open Waters AIS (rede aberta de receptores)', regiao: 'Costa e rios do Brasil',
        aoVivo: true, total: embarcoes.length, navegando: navegando,
        embarcacoes: embarcoes, portos: PORTOS, atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, boa, 120000); guardarBoa(ck, boa);
      res.json(boa);
    }).catch(function() {
      var boa = UltimaBOA(ck);
      if (boa && Date.now() - boa.t < 1800000) {
        var velho = JSON.parse(JSON.stringify(boa.v));
        velho.aviso = 'O AIS ao vivo não respondeu agora; última leitura às ' + horaLegivel(boa.v.atualizadoEm) + '.';
        velho.stale = true;
        return res.json(velho);
      }
      var fora = soPortos();
      cacheSet(ck, fora, 600000);
      res.json(fora);
    });
  });

  // ---- Satelites em orbita: TLEs, propagados no navegador (satellite.js) ----
  // O CelesTrak nao aceita duas leituras do mesmo grupo antes de atualizar (responde 403
  // "GP data has not updated since your last request"), entao o cache e de 6h e o prazo da
  // reserva e de 4 dias. Os grupos cobrem navegacao (BeiDou/GPS/GLONASS/Galileo), estacoes
  // orbitais, internet por satellite, meteorologia e observacao da Terra.
  // Do Render o CelesTrak nunca respondeu — a conexao fica pendurada ate o timeout, grupo
  // apos grupo. Por isso ele e tentado primeiro, mas abandonado ja no segundo silencio, e
  // existe uma segunda fonte: a base TLE publica da SATNOGS, um unico pedido que traz ~1.700
  // objetos que a gente classifica por nome em grupos aqui mesmo. Vale para orbita real; so
  // nao traz as constelacoes inteiras (GPS, Galileo) que a SATNOGS nao acompanha.
  var GRUPOS_ORBITA = [
    { g: 'stations', rot: 'Estações orbitais', cap: 30 },
    { g: 'beidou', rot: 'Navegação — BeiDou', cap: 60 },
    { g: 'gps-ops', rot: 'Navegação — GPS', cap: 40 },
    { g: 'glo-ops', rot: 'Navegação — GLONASS', cap: 40 },
    { g: 'galileo', rot: 'Navegação — Galileo', cap: 40 },
    { g: 'starlink', rot: 'Internet — Starlink', cap: 140 },
    { g: 'oneweb', rot: 'Internet — OneWeb', cap: 100 },
    { g: 'weather', rot: 'Meteorológicos', cap: 80 },
    { g: 'resource', rot: 'Observação da Terra', cap: 170 }
  ];
  var BLOCO_PAIS = { eua: 'Estados Unidos', china: 'China', russia: 'Rússia',
    europa: 'Europa e Reino Unido', brasil: 'Brasil', outros: 'Outro ou não informado' };
  var REGRA_BLOCO = [
    ['china', /^(CSS|TIANGONG|SHENZHOU|TIANHE|WENTIAN|MENGTIAN|BEIDOU|FENGYUN|YAOGAN|GAOFEN|GAOJING|ZIYUAN|HAI YANG|YUNHAI|SHI JIAN|TIANQI|GUOGUAN|JILIN|PIESAT|CENTERSPACE|QIANFAN|TAIJING|CHINA)|^(G60|GEESAT|SATNET)/],
    ['russia', /^(COSMOS|KOSMOS|GLONASS|KANOPUS|RESURS|ARCTIKA|MOLNIYA|GEO-IKON|STRELSA|PARUS|CONDOR|LITCHMAN|ZEBRA|RUSSIA|MERIDIAN)/],
    ['brasil', /^(SCD|CBERS|AMAZONIA|SGDC|GES-|CUCA|APEX|START1|BRIS)/],
    ['europa', /^(GALILEO|SENTINEL|METEOSAT|MTG|MSG|IRS|SPOT|PLEIADES|SWARM|CRYOSAT|SARAL|ONEWEB|EUTELSAT|INMARSAT|SES|KAFLAX|ATLANTIC|AVISO|CDS|NIMS)/],
    ['eua', /^(ISS|GPS|GOES|NOAA|TERRA|AQUA|LANDSAT|WORLDVIEW|STARLINK|IRIDIUM|GLOBALSTAR|ORBCOMM|TDRS|JPSS|SUOMI|NPP|AURA|CALSPHERE|SWOT|LADEE|KEPLER|SPITZER|OGA|PLANET|SKYSAT|LEMUR|FALCON|SPACEX)/]
  ];
  function blocoDe(nome, grupo){
    var n = semAcento(String(nome || ''));
    for (var i = 0; i < REGRA_BLOCO.length; i++) {
      if (REGRA_BLOCO[i][1].test(n)) return REGRA_BLOCO[i][0];
    }
    if (grupo === 'beidou') return 'china';
    if (grupo === 'gps-ops' || grupo === 'starlink') return 'eua';
    if (grupo === 'glo-ops') return 'russia';
    if (grupo === 'galileo' || grupo === 'oneweb') return 'europa';
    return 'outros';
  }

  // Quando a lista chega sem grupos (a reserva da SATNOGS), o grupo é deduzido pelo nome.
  var GRUPO_POR_NOME = [
    [/^(ISS|TIANGONG|CSS |SHENZHOU|TIANHE|WENTIAN|MENGTIAN|ORION)/, 'Estações orbitais'],
    [/^(GPS|BEIDOU|GLONASS|GALILEO|NAVIC|QZS|IRNSS)/, 'Navegação por satélite'],
    [/^(STARLINK|ONEWEB|KUIPER|ASTRANIS|AMAZON|INMARSAT|EUTELSAT|SES |TELESAT|TELSTAR)/, 'Internet e telecomunicações'],
    [/^(GOES|NOAA|METEOSAT|MTG|MSG|METSAT|HIMAWARI|FENGYUN|FY |YUNHAI|JPSS|SUOMI|NPP|AQUA|TERRA|CALIPSO|CLOUDSAT)/, 'Meteorológicos'],
    [/^(LANDSAT|SENTINEL|CBERS|AMAZONIA|YAOGAN|GAOFEN|GAOJING|ZIYUAN|RESURS|KANOPUS|WORLDVIEW|PLANET|SPOT|PLEIADES|SWOT|CARTOSAT|TIANPIN|IRS |RADARSAT|ICEEYE|DAITOU|HUIYAN)/, 'Observação da Terra'],
    [/^(IRIDIUM|GLOBALSTAR|ORBCOMM|SPIRE|LEMUR|FALCON|SPACEX|AISTRE)/, 'Telecom e cubesats']
  ];
  function grupoDeNome(nome){
    var n = semAcento(String(nome || ''));
    for (var i = 0; i < GRUPO_POR_NOME.length; i++) if (GRUPO_POR_NOME[i][0].test(n)) return GRUPO_POR_NOME[i][1];
    return 'Outros satélites';
  }

  // Reserva: a base TLE publica da SATNOGS cabe num pedido so (~1.700 objetos, ~540 kB).
  function daSatnogs(){
    return getJSON('https://db.satnogs.org/api/tle/?format=json', {}, 12000).then(function(r){
      var lista = (r.status === 200 && Array.isArray(r.data)) ? r.data : [];
      var baldes = {};
      lista.forEach(function(o){
        var nome = String(o.tle0 || '').replace(/^0 /, '').trim();
        var l1 = String(o.tle1 || ''), l2 = String(o.tle2 || '');
        if (!nome || !/^[12] /.test(l1) || !/^[12] /.test(l2)) return;
        var rot = grupoDeNome(nome);
        var g = baldes[rot] || (baldes[rot] = { rot: rot, grupo: 'satnogs', qtd: 0, sats: [] });
        if (g.qtd >= 170) return;
        var bloco = blocoDe(nome, '');
        g.sats.push({ nome: nome.slice(0, 40), id: parseInt(o.norad_cat_id, 10) || 0,
          l1: l1, l2: l2, bloco: bloco, pais: BLOCO_PAIS[bloco] });
        g.qtd++;
      });
      return Object.keys(baldes).map(function(k){ return baldes[k] });
    });
  }

  // TLE em texto: nome, entao as duas linhas. O CelesTrak traz 16 caracteres por campo.
  function parseTLE(texto){
    var linhas = String(texto || '').split(/\r?\n/).filter(function(l){ return l.trim() !== '' });
    var sats = [];
    for (var i = 0; i < linhas.length - 2; i++) {
      var l1 = linhas[i + 1], l2 = linhas[i + 2];
      if (!/^[12] /.test(l1) || !/^[12] /.test(l2)) continue;
      sats.push({ nome: linhas[i].trim().slice(0, 40), id: parseInt(l1.substr(2, 5), 10) || 0,
        l1: l1, l2: l2 });
      i += 2;
    }
    return sats;
  }

  app.get('/api/mapas/orbita', function(req, res) {
    var ck = 'mapa_orbita';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var grupos = [];
    var falhas = 0;
    var respondido = false;
    var inicio = Date.now();
    var fonte = 'CelesTrak (TLE)';

    function corpo(extra){
      var total = grupos.reduce(function(a, g){ return a + g.qtd; }, 0);
      var c = {
        fonte: fonte + ' + satellite.js no navegador', total: total, grupos: grupos,
        atualizadoEm: new Date().toISOString()
      };
      if (fonte === 'CelesTrak (TLE)' && falhas)
        c.aviso = 'Nem todo grupo respondeu agora (' + falhas + ' de ' + GRUPOS_ORBITA.length + ' falharam).';
      return Object.assign(c, extra || {});
    }

    // A varredura dos grupos leva ~15s: quem chegou primeiro nao pode esperar tanto.
    // Libera o que ja veio e a varredura continua ate o fim, enchendo o cache.
    function libera(parcial){
      if (respondido || res.headersSent) return;
      respondido = true;
      var c = corpo(parcial ? {
        atualizando: true,
        aviso: 'Chegaram ' + grupos.length + ' de ' + GRUPOS_ORBITA.length +
               ' grupos; a pagina busca o resto sozinha em instantes.'
      } : null);
      if (parcial) { c.grupos = c.grupos.slice(); cacheSet(ck, c, 120000); }
      res.json(c);
    }

    function grava(){
      clearInterval(vigia);
      var boa = corpo();
      var ttl = fonte === 'SATNOGS (TLE)' ? 4 * 3600000 : (falhas ? 2 * 3600000 : 6 * 3600000);
      cacheSet(ck, boa, ttl);
      guardarBoa(ck, boa);
      libera(false);
    }

    function semFonte(){
      clearInterval(vigia);
      if (respondido || res.headersSent) return;
      respondido = true;
      var boa = UltimaBOA(ck);
      if (boa && Date.now() - boa.t < 4 * 86400000) {
        var velho = JSON.parse(JSON.stringify(boa.v));
        velho.stale = true;
        velho.aviso = 'Nenhuma fonte de elementos orbitais respondeu agora; mostrando os de ' +
                      horaLegivel(new Date(boa.t)) + ' (ainda servem para alguns dias).';
        return res.json(velho);
      }
      res.json({ fonte: 'CelesTrak / SATNOGS (TLE)', total: 0, grupos: [],
        erro: 'Elementos orbitais indisponíveis agora',
        aviso: 'O CelesTrak e a SATNOGS não responderam. Recarregue em instantes.',
        atualizadoEm: new Date().toISOString() });
    }

    var vigia = setInterval(function(){
      if (grupos.length && Date.now() - inicio > 20000) { clearInterval(vigia); libera(true); }
    }, 3000);

    function varreCelesTrak(){
      return new Promise(function(resolve){
        var mudos = 0;
        function passo(i){
          if (i >= GRUPOS_ORBITA.length) return resolve();
          var conf = GRUPOS_ORBITA[i];
          var url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=' + conf.g + '&FORMAT=tle';
          getJSON(url, {}, 6000).then(function(r){
            var texto = (r.status === 200 && typeof r.data === 'string') ? r.data : '';
            var sats = parseTLE(texto).slice(0, conf.cap);
            if (!sats.length) { falhas++; return; }
            sats.forEach(function(s){
              s.bloco = blocoDe(s.nome, conf.g);
              s.pais = BLOCO_PAIS[s.bloco];
            });
            grupos.push({ rot: conf.rot, grupo: conf.g, qtd: sats.length, sats: sats });
            if (grupos.length >= 4) { clearInterval(vigia); libera(true); }
          }).catch(function(){ falhas++; mudos++; })
            .then(function(){
              // Dois silencios seguidos querem dizer que o host nao atende de IP de servidor:
              // esperar os 9 grupos custaria quase um minuto para uma pagina que ja tem reserva.
              if (mudos >= 2 || i + 1 >= GRUPOS_ORBITA.length) return resolve();
              return espera(400).then(function(){ passo(i + 1) });
            });
        }
        passo(0);
      });
    }

    varreCelesTrak().then(function(){
      if (grupos.length) return void grava();
      fonte = 'SATNOGS (TLE)';
      return daSatnogs().then(function(lista){
        if (!lista.length) return void semFonte();
        grupos = lista;
        grava();
      });
    }).catch(function(){ semFonte(); });
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
