// BrBRICS - Rotas de mapas geoespaciais (focos INPE/BDQueimadas, avioes ADS-B, embarcacoes AIS,
// satelites em orbita por TLE, cameras publicas, cabos submarinos, malha aerea e lancamentos).
// Cabos, OpenFlights e The Space Devs nao liberam leitura pelo navegador: passam por aqui.
// Nenhuma fonte pede chave ou cadastro.
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
    // cadastro. Caixa grande demais da 400 (o teto medido e ~100 graus quadrados), entao o
    // litoral e coberto em caixas pequenas, escolhidas por contagem real de navios e por
    // quanto cada uma acrescenta de embarcacoes novas (medido em 2026-11-01: 1.438 MMSIs
    // unicos no pais). Onde a rede nao tem antena — do Rio Grande do Norte ate Pernambuco,
    // e no delta do Paraiba — a caixa devolve zero e o mapa nao inventa navio.
    // 89% dos navios captados estao fundeados ou atracados, nao em movimento: e por isso
    // que a pagina mostra todos e deixa o "so em movimento" desligado por padrao.
    var CAIXAS_AIS = [
      { nome: 'Santos e São Sebastião', bbox: '-25.4,-47.6,-23.0,-45.2' },
      { nome: 'Angra dos Reis e Ilha Grande', bbox: '-24.9,-45.2,-22.6,-43.7' },
      { nome: 'Baía de Guanabara e Sepetiba', bbox: '-23.6,-44.0,-22.6,-43.0' },
      { nome: 'Cabo Frio e Búzios', bbox: '-23.4,-43.2,-22.2,-41.6' },
      { nome: 'Macaé e Imbetibe', bbox: '-23.6,-42.6,-21.9,-41.0' },
      { nome: 'São João da Barra (Açu)', bbox: '-22.6,-42.2,-21.2,-40.6' },
      { nome: 'Vitória e litoral do Espírito Santo', bbox: '-21.4,-42.0,-19.6,-39.9' },
      { nome: 'Salvador e Aracaju', bbox: '-14.0,-39.4,-11.6,-37.4' },
      { nome: 'Ceará (Fortaleza e Pecém)', bbox: '-4.6,-39.4,-3.2,-38.0' },
      { nome: 'São Luís e Itaqui', bbox: '-3.4,-45.6,-2.0,-44.0' },
      { nome: 'Baião e Marajó', bbox: '-1.6,-49.8,-0.4,-48.4' },
      { nome: 'Vila do Conde e Belém', bbox: '-1.6,-49.0,-0.2,-47.6' },
      { nome: 'Baixo Amazonas', bbox: '-3.4,-55.6,-1.0,-54.0' },
      { nome: 'Manaus e rio Negro', bbox: '-3.8,-61.2,-1.8,-59.8' },
      { nome: 'Paranaguá, Joinville e São Francisco do Sul', bbox: '-26.45,-49.0,-25.1,-48.2' },
      { nome: 'Itajaí e Navegantes', bbox: '-27.4,-49.2,-26.6,-48.4' },
      { nome: 'Florianópolis', bbox: '-28.2,-49.2,-27.2,-48.2' }
    ];
    // Posicao sem transmissao ha mais de um dia é fantasma: o navio ja foi embora e a
    // antena só esqueceu de apagar o registro. Medido em 2026-11-01: das 1.425 posicoes
    // unicas captadas, 1.051 tem menos de 24h (666 com menos de 15 minutos).
    var IDADE_MAXIMA_AIS = 24 * 3600 * 1000;

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

    function deGeoJSONNavios(fc, caixa, mapa, out, agora){
      (fc && fc.features ? fc.features : []).forEach(function(ft){
        var co = ft.geometry && ft.geometry.coordinates;
        var p = ft.properties || {};
        if (!co || co.length < 2) return;
        var lon = Number(co[0]), lat = Number(co[1]);
        if (!isFinite(lat) || !isFinite(lon)) return;
        var visto = p.seen ? new Date(p.seen).getTime() : NaN;
        var idade = isFinite(visto) ? agora - visto : null;
        if (idade !== null && idade > IDADE_MAXIMA_AIS) return;
        var chave = String(p.mmsi || (p.name || '') + lat);
        if (mapa[chave]) return;
        mapa[chave] = 1;
        var sog = typeof p.sog === 'number' ? p.sog : null;
        var frescor = idade === null ? 'antiga' : (idade <= 15 * 60000 ? 'agora' : (idade <= 3 * 3600000 ? 'recente' : 'antiga'));
        out.push({
          nome: p.name || 'Sem nome', mmsi: p.mmsi || '—', imo: p.imo || '',
          indicativo: p.callsign || '', tipo: tipoDeAIS(p.type), tipoAis: p.type,
          bandeira: paisDaBandeira(p.flag),
          status: p.nav_status === undefined || p.nav_status === null ? 'não informado'
                  : (STATUS_NAV[p.nav_status] || ('status ' + p.nav_status)),
          lat: lat, lon: lon,
          velocidade_kt: sog !== null ? Math.round(sog * 10) / 10 : '—',
          velocidade_kmh: sog !== null ? Math.round(sog * 1.852 * 10) / 10 : '—',
          rumo: typeof p.cog === 'number' ? p.cog : (typeof p.heading === 'number' ? p.heading : '—'),
          navegando: sog !== null && sog >= 0.5,
          destino: p.destination || '', comprimento: p.length || '', calado: p.draught || '',
          vistoEm: p.seen || '', idadeMin: idade !== null ? Math.max(0, Math.round(idade / 60000)) : '',
          frescor: frescor,
          fonteAis: p.source || '', caixa: caixa.nome
        });
      });
    }

    // As caixas sao lidas em grupos de cinco ao mesmo tempo: uma a uma a varredura
    // passava de trinta segundos e o visitante ficava olhando um mapa vazio.
    var GRUPO_AIS = 5;
    function varreAis(i, mapa, out){
      if (i >= CAIXAS_AIS.length) return Promise.resolve(out);
      var grupo = CAIXAS_AIS.slice(i, i + GRUPO_AIS);
      var agora = Date.now();
      return Promise.all(grupo.map(function(c){
        return getJSON('https://ais.openwaters.io/v1/vessels?bbox=' + c.bbox, {}, 15000)
          .then(function(r){
            if (r.status === 200 && r.data && r.data.features) deGeoJSONNavios(r.data, c, mapa, out, agora);
          })
          .catch(function(){});
      })).then(function(){ return espera(120); })
        .then(function(){ return varreAis(i + GRUPO_AIS, mapa, out); });
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
        parados: embarcoes.length - navegando, caixas: CAIXAS_AIS.length,
        avisoCobertura: 'A rede de antenas AIS não cobre todo o litoral: entre Natal e ' +
          'Recife, e no delta do Paraíba, quase nenhum navio transmite para ela. O que ' +
          'não aparece aí não é navio escondido — é falta de antena na região.',
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

  // ---- Cameras online ----
  // Três fontes que entregam a IMAGEM, não um link:
  //  1) transito: cameras municipais de Santo André (SP), vídeo MJPEG direto do servidor
  //     da prefeitura. O navegador abre o quadro em movimento sozinho, como numa TV.
  //     A lista (nome, endereço da câmera e coordenada) vem do OpenStreetMap, conferida
  //     câmera por câmera em 2026-11-01.
  //  2) praias, cidades, portos e mirantes: as cameras abertas da SkylineWebcams. O vídeo
  //     vivo delas é uma transmissão contínua no YouTube (conferido: isLive=true em todas),
  //     entao o cartao traz a miniatura do quadro e o clique abre a transmissão ao vivo.
  // As cameras de transito da CET-SP, DNIT, PRF e prefeituras que a gente testou ou sumiram
  // ou devolvem fotografia parada de anos atras; nao ha imagem viva por fora dos sites deles.
  var CAMERAS_YT = [
    { id: 604,  nome: 'Copacabana — Posto 6',        cidade: 'Rio de Janeiro',      uf: 'RJ', tipo: 'praia',   lat: -22.9711, lon: -43.1822, video: 'Bz9Hkrk1NcY' },
    { id: 4373, nome: 'Praia do Forte',              cidade: 'Cabo Frio',           uf: 'RJ', tipo: 'praia',   lat: -22.8770, lon: -42.0200, video: 'BCJtcc5lwC4' },
    { id: 5688, nome: 'Praça Ary Parreiras',         cidade: 'Miracema',            uf: 'RJ', tipo: 'cidade',  lat: -21.4140, lon: -42.1990, video: 'BCVoIpECdBs' },
    { id: 6208, nome: 'Praça central',               cidade: 'Santo Antônio de Pádua', uf: 'RJ', tipo: 'cidade', lat: -21.8850, lon: -42.2570, video: 'dkyI6rPJXXo' },
    { id: 2504, nome: 'Canal do Porto de Santos',    cidade: 'Santos',              uf: 'SP', tipo: 'porto',   lat: -23.9340, lon: -46.3000, video: 'fGYrAZAdHBU' },
    { id: 3583, nome: 'Praia Grande',                cidade: 'Praia Grande',        uf: 'SP', tipo: 'praia',   lat: -24.0091, lon: -46.4050, video: 'v8EHx_ixEKU' },
    { id: 5584, nome: 'Acapulco — Guarujá',          cidade: 'Guarujá',             uf: 'SP', tipo: 'praia',   lat: -23.9900, lon: -46.2600, video: 'v5Y6WsD577M' },
    { id: 4340, nome: 'Vista panorâmica',            cidade: 'Santa Fé do Sul',     uf: 'SP', tipo: 'mirante', lat: -20.2070, lon: -51.4160, video: 'kcDF1f2U0kI' },
    { id: 5821, nome: 'Estação de Santa Fé do Sul',  cidade: 'Santa Fé do Sul',     uf: 'SP', tipo: 'cidade',  lat: -20.2140, lon: -51.4250, video: 'MGIsnMzCR7w' },
    { id: 2682, nome: 'Barra Sul — Parque Unipraias', cidade: 'Balneário Camboriú', uf: 'SC', tipo: 'mirante', lat: -26.9900, lon: -48.6280, video: 'YAK0xJxzp_Y' },
    { id: 3913, nome: 'Barra Norte',                 cidade: 'Balneário Camboriú',  uf: 'SC', tipo: 'praia',   lat: -26.9780, lon: -48.6420, video: 'j4Wne61IJ3I' },
    { id: 5429, nome: 'Praia de Laranjeiras',        cidade: 'Balneário Camboriú',  uf: 'SC', tipo: 'praia',   lat: -27.0200, lon: -48.6100, video: 'yHbiTryu8WI' },
    { id: 5690, nome: 'Avenida Brasil',              cidade: 'Balneário Camboriú',  uf: 'SC', tipo: 'cidade',  lat: -26.9930, lon: -48.6310, video: '5Xl6pSgiy3A' },
    { id: 3886, nome: 'Barra da Lagoa',              cidade: 'Florianópolis',       uf: 'SC', tipo: 'praia',   lat: -27.7530, lon: -48.4810, video: 'SVVgY6TjIhg' },
    { id: 5301, nome: 'Praia de Balneário Rincão',   cidade: 'Balneário Rincão',    uf: 'SC', tipo: 'praia',   lat: -28.7770, lon: -49.0970, video: 'Ghb1EcQAPNU' },
    { id: 3584, nome: 'Vista panorâmica',            cidade: 'Porto Alegre',        uf: 'RS', tipo: 'mirante', lat: -30.0346, lon: -51.2177, video: 'Q7VS4S-fNFI' },
    { id: 5254, nome: 'Gramado',                     cidade: 'Gramado',             uf: 'RS', tipo: 'mirante', lat: -29.3700, lon: -50.8800, video: '0tMTEejJwhc' },
    { id: 4713, nome: 'Montenegro',                  cidade: 'Montenegro',          uf: 'RS', tipo: 'mirante', lat: -29.6900, lon: -51.4700, video: 'NsJATz4bNOw' },
    { id: 6032, nome: 'Praia dos Artistas',          cidade: 'Natal',               uf: 'RN', tipo: 'praia',   lat: -5.7900,  lon: -35.2060, video: '8quWDK9i-v0' },
    { id: 3984, nome: 'Praia de Boqueirão',          cidade: 'Boqueirão',           uf: 'PB', tipo: 'praia',   lat: -7.1300,  lon: -34.9570, video: 'kawl6kTUfaE' },
    { id: 3047, nome: 'Ponta Negra',                 cidade: 'Manaus',              uf: 'AM', tipo: 'praia',   lat: -3.0355,  lon: -60.0289, video: 'xt5k4nWXOEc' },
    { id: 5300, nome: 'Vieiralves',                  cidade: 'Manaus',              uf: 'AM', tipo: 'cidade',  lat: -3.0880,  lon: -60.0100, video: 'RzuMa_pzqkk' },
    { id: 6203, nome: 'Bom Jesus do Norte',          cidade: 'Bom Jesus do Norte',  uf: 'ES', tipo: 'mirante', lat: -21.1350, lon: -41.8400, video: 'x4nWJFbESLw' },
    { id: 6227, nome: 'Centro de Goioerê',           cidade: 'Goioerê',             uf: 'PR', tipo: 'cidade',  lat: -24.2370, lon: -52.9870, video: 'MEQ16z1xyJ4' }
  ];
  CAMERAS_YT.forEach(function (c) {
    c.modo = 'youtube';
    c.grupo = 'paisagem';
    // A miniatura "_live" é o quadro de agora da transmissão; a comum é pôster antigo.
    c.imagem = 'https://i.ytimg.com/vi/' + c.video + '/hqdefault_live.jpg';
    c.imagemPlano = 'https://i.ytimg.com/vi/' + c.video + '/hqdefault.jpg';
    c.player = 'https://www.youtube-nocookie.com/embed/' + c.video + '?autoplay=1&mute=1&playsinline=1&rel=0';
    c.url = 'https://www.youtube.com/watch?v=' + c.video;
    c.fonte = 'SkylineWebcams (transmissão contínua no YouTube)';
  });

  // 3) o mundo. Cada linha abaixo é uma transmissão contínua pública no YouTube, aberta
  //    pelo próprio dono da câmera: autoridade portuária (Helsinki, Roterdã, Dublin,
  //    Hamburgo), prefeitura (Hollywood Beach, Praga), concessionária de trem (ProRail),
  //    hotel ou rede profissional de câmeras (EarthCam, Africam, Explore.org).
  //    Nenhuma é cópia de sinal fechado nem câmera de segurança alheia.
  //    Todas foram conferidas em 2026-11-01 em dois pontos: o quadro ao vivo do YouTube
  //    respondeu (i.ytimg.com/vi/<id>/hqdefault_live.jpg = 200, que só existe em
  //    transmissão no ar) e o player abriu de fora do youtube.com.
  //    O "uf" dos cartões do mundo traz o país, para a linha de baixo ler
  //    "Helsinki — Finlândia" do mesmo jeito que lê "Santos — SP".
// Dia em que a última leva de transmissões foi conferida, quadro a quadro. Os textos
// das páginas leem este valor pelo /api/mapas/cameras, então basta mexer aqui
// quando o catálogo for conferido de novo.
var CONFERIDO_EM = '2026-11-02';
  var CAMERAS_MUNDO = [
    { id: 1000, nome: 'Porto de Helsinki — Porto Sul', cidade: 'Helsinki', uf: 'Finlândia', tipo: 'porto', lat: 60.1637, lon: 24.9520, video: 'CvOB-Is_yYU' },
    { id: 1001, nome: 'Porto de Roterdã — Amazonehaven', cidade: 'Roterdã', uf: 'Países Baixos', tipo: 'porto', lat: 51.9470, lon: 4.0930, video: 'M09NaBVPjAI' },
    { id: 1002, nome: 'Porto de Dublin — rio Liffey', cidade: 'Dublin', uf: 'Irlanda', tipo: 'porto', lat: 53.3440, lon: -6.2370, video: 'K_ye7QHXosQ' },
    { id: 1003, nome: 'Porto de Hamburgo — Cruise Center Altona', cidade: 'Hamburgo', uf: 'Alemanha', tipo: 'porto', lat: 53.5390, lon: 9.9130, video: 'GF1DYvxDq44' },
    { id: 1004, nome: 'Porto de Lyme Regis', cidade: 'Lyme Regis', uf: 'Reino Unido', tipo: 'porto', lat: 50.7560, lon: -2.9440, video: 'rulGLEdCHZU' },
    { id: 1005, nome: 'Porto de Stornoway', cidade: 'Stornoway', uf: 'Reino Unido', tipo: 'porto', lat: 58.2090, lon: -6.3860, video: 'Xajlompi7JA' },
    { id: 1006, nome: 'Porto de Friday Harbor', cidade: 'Friday Harbor', uf: 'Estados Unidos', tipo: 'porto', lat: 48.5340, lon: -123.0180, video: 'pr2p_uvmXh8' },
    { id: 1007, nome: 'Porto de Sydney', cidade: 'Sydney', uf: 'Austrália', tipo: 'porto', lat: -33.8570, lon: 151.2120, video: '5uZa3-RMFos' },
    { id: 1008, nome: 'Canal de Duluth', cidade: 'Duluth', uf: 'Estados Unidos', tipo: 'porto', lat: 46.7720, lon: -92.1060, video: 'HPS48TMmNag' },
    { id: 1009, nome: 'Hollywood Beach Broadwalk', cidade: 'Hollywood', uf: 'Estados Unidos', tipo: 'praia', lat: 26.0100, lon: -80.1160, video: 'cmkAbDUEoyA' },
    { id: 1010, nome: 'Maho Beach', cidade: 'Sint Maarten', uf: 'São Martinho', tipo: 'praia', lat: 18.0430, lon: -63.1080, video: 'iSeH45R-8R0' },
    { id: 1011, nome: 'Mambo Beach', cidade: 'Willemstad', uf: 'Curaçao', tipo: 'praia', lat: 11.9960, lon: -68.9610, video: 'loHbMM9JfCs' },
    { id: 1012, nome: 'White Bay Beach', cidade: 'Jost Van Dyke', uf: 'Ilhas Virgens Britânicas', tipo: 'praia', lat: 18.4320, lon: -64.7480, video: 'V_I168MM-ik' },
    { id: 1013, nome: 'Lamai Beach', cidade: 'Koh Samui', uf: 'Tailândia', tipo: 'praia', lat: 9.5760, lon: 100.0720, video: 'g-noWsNhRg0' },
    { id: 1014, nome: 'South Beach — Collins Avenue', cidade: 'Miami Beach', uf: 'Estados Unidos', tipo: 'praia', lat: 25.7830, lon: -80.1300, video: 'dyg7bu7QRjg' },
    { id: 1015, nome: 'Costa da Caparica', cidade: 'Almada', uf: 'Portugal', tipo: 'praia', lat: 35.6830, lon: -9.2280, video: 'oDbKeeojgyk' },
    { id: 1016, nome: 'Penha de França', cidade: 'Funchal', uf: 'Portugal', tipo: 'praia', lat: 32.6400, lon: -16.9080, video: 'CqyPIduELzA' },
    { id: 1017, nome: 'Tamariu', cidade: 'Tamariu', uf: 'Espanha', tipo: 'praia', lat: 41.9000, lon: 3.2100, video: 'wiVzU1mcCTA' },
    { id: 1018, nome: 'Los Angeles — Venice Beach', cidade: 'Los Angeles', uf: 'Estados Unidos', tipo: 'praia', lat: 33.9850, lon: -118.4690, video: 'EO_1LWqsCNE' },
    { id: 1019, nome: 'Sanibel Island', cidade: 'Sanibel', uf: 'Estados Unidos', tipo: 'praia', lat: 26.4500, lon: -82.0100, video: '4LTSTw4jnZc' },
    { id: 1020, nome: 'Veneza — Grande Canal em giro', cidade: 'Veneza', uf: 'Itália', tipo: 'cidade', lat: 45.4380, lon: 12.3300, video: 'a1mcaV3Sf9U' },
    { id: 1021, nome: 'Veneza — Ponte de Rialto', cidade: 'Veneza', uf: 'Itália', tipo: 'cidade', lat: 45.4380, lon: 12.3358, video: 'nviU2HYj-Jc' },
    { id: 1022, nome: 'Veneza — Bacia de São Marcos', cidade: 'Veneza', uf: 'Itália', tipo: 'cidade', lat: 45.4320, lon: 12.3400, video: '7-XBRpKSv4Q' },
    { id: 1023, nome: 'Londres — Notting Hill Gate', cidade: 'Londres', uf: 'Reino Unido', tipo: 'cidade', lat: 51.5090, lon: -0.1970, video: 'U-XyMFyX4x0' },
    { id: 1024, nome: 'Oxford — Broad Street', cidade: 'Oxford', uf: 'Reino Unido', tipo: 'cidade', lat: 51.7540, lon: -1.2570, video: 'h8glPXsnezU' },
    { id: 1025, nome: 'Amsterdã — Praça Dam', cidade: 'Amsterdã', uf: 'Países Baixos', tipo: 'cidade', lat: 52.3730, lon: 4.8930, video: 'Gd9d4q6WvUY' },
    { id: 1026, nome: 'Amsterdã — Estação Centraal', cidade: 'Amsterdã', uf: 'Países Baixos', tipo: 'cidade', lat: 52.3790, lon: 4.9000, video: 'FHJH2yMe6Hw' },
    { id: 1027, nome: 'Tóquio — Shinjuku Kabukicho', cidade: 'Tóquio', uf: 'Japão', tipo: 'cidade', lat: 35.6950, lon: 139.7050, video: 'DjdUEyjx8GM' },
    { id: 1028, nome: 'Tóquio — Cruzamento de Shibuya', cidade: 'Tóquio', uf: 'Japão', tipo: 'cidade', lat: 35.6595, lon: 139.7005, video: 'dfVK7ld38Ys' },
    { id: 1029, nome: 'Praga — centro', cidade: 'Praga', uf: 'Tchéquia', tipo: 'cidade', lat: 50.0870, lon: 14.4360, video: '3C8W4Rlgiog' },
    { id: 1030, nome: 'Lisboa — vista da cidade', cidade: 'Lisboa', uf: 'Portugal', tipo: 'cidade', lat: 38.7220, lon: -9.1390, video: 'tKIgNtEgLN0' },
    { id: 1031, nome: 'Melbourne — cruzamento', cidade: 'Melbourne', uf: 'Austrália', tipo: 'cidade', lat: -37.8140, lon: 144.9630, video: 'gEbrHdFRgpQ' },
    { id: 1032, nome: 'Nova York — World Trade Center', cidade: 'Nova York', uf: 'Estados Unidos', tipo: 'cidade', lat: 40.7120, lon: -74.0130, video: '5C9oM7C2Q9k' },
    { id: 1033, nome: 'Nova York — Times Square', cidade: 'Nova York', uf: 'Estados Unidos', tipo: 'cidade', lat: 40.7580, lon: -73.9860, video: 'KHy_n-EMWY8' },
    { id: 1034, nome: 'Dublin — vista da cidade', cidade: 'Dublin', uf: 'Irlanda', tipo: 'cidade', lat: 53.3480, lon: -6.2600, video: '3nyPER2kzqk' },
    { id: 1035, nome: 'Maiorca', cidade: 'Palma de Maiorca', uf: 'Espanha', tipo: 'cidade', lat: 39.5700, lon: 2.6500, video: 'jtdyLykT_XY' },
    { id: 1036, nome: 'Nova Orleans — vista da rua', cidade: 'Nova Orleans', uf: 'Estados Unidos', tipo: 'cidade', lat: 29.9550, lon: -90.0700, video: 'xqdukYhcGEU' },
    { id: 1037, nome: 'Londres — Abbey Road', cidade: 'Londres', uf: 'Reino Unido', tipo: 'mirante', lat: 51.5320, lon: -0.1780, video: 'zMCea32gpmg' },
    { id: 1038, nome: 'Sydney — Ponte e Casa de Ópera', cidade: 'Sydney', uf: 'Austrália', tipo: 'mirante', lat: -33.8570, lon: 151.2130, video: '3IPgK1Hqx6A' },
    { id: 1039, nome: 'Nova York — Ponte do Brooklyn', cidade: 'Nova York', uf: 'Estados Unidos', tipo: 'mirante', lat: 40.7060, lon: -73.9970, video: 'tErYxn2UM5Y' },
    { id: 1040, nome: 'Nova York — Estátua da Liberdade', cidade: 'Nova York', uf: 'Estados Unidos', tipo: 'mirante', lat: 40.6900, lon: -74.0450, video: 'o5Ie_LpZ9uk' },
    { id: 1041, nome: 'Washington — Monumento', cidade: 'Washington', uf: 'Estados Unidos', tipo: 'mirante', lat: 38.8890, lon: -77.0350, video: 'oDCAAfOSqvA' },
    { id: 1042, nome: 'Baía de Tóquio', cidade: 'Tóquio', uf: 'Japão', tipo: 'mirante', lat: 35.6260, lon: 139.7750, video: 'Ac0E6CrnDxA' },
    { id: 1043, nome: 'Amsterdã — telhado Mövenpick', cidade: 'Amsterdã', uf: 'Países Baixos', tipo: 'mirante', lat: 52.3900, lon: 4.9100, video: '9Pm6Ji6tm7s' },
    { id: 1044, nome: 'Bebedouro de Amboseli e o Kilimanjaro', cidade: 'Amboseli', uf: 'Quênia', tipo: 'natureza', lat: -2.6500, lon: 37.2600, video: 'XyPU5-pNg5E' },
    { id: 1045, nome: 'Bebedouro da Victoria Falls Safari Lodge', cidade: 'Victoria Falls', uf: 'Zimbábue', tipo: 'natureza', lat: -17.9250, lon: 25.8550, video: 'f9uqHbXChno' },
    { id: 1046, nome: 'Bebedouro de Senyati, Chobe', cidade: 'Chobe', uf: 'Botsuana', tipo: 'natureza', lat: -19.1500, lon: 24.9000, video: 'EdDdTrahHjI' },
    { id: 1047, nome: 'Travessia do Mara — grande migração', cidade: 'Masai Mara', uf: 'Quênia', tipo: 'natureza', lat: -1.4500, lon: 35.0500, video: 'Io1Kle7QR-E' },
    { id: 1048, nome: 'Ol Donyo Lodge', cidade: 'Taita-Taveta', uf: 'Quênia', tipo: 'natureza', lat: -3.2700, lon: 38.0500, video: 'XsOU8JnEpNM' },
    { id: 1049, nome: 'Bebedouro de Okaukuejo, Etosha', cidade: 'Etosha', uf: 'Namíbia', tipo: 'natureza', lat: -18.8500, lon: 16.1170, video: 'AeMUdOPFcXI' },
    { id: 1050, nome: 'Linkwasha, Hwange', cidade: 'Hwange', uf: 'Zimbábue', tipo: 'natureza', lat: -19.3000, lon: 26.5000, video: '-rXriX4SiQk' },
    { id: 1051, nome: 'Sabi Sand', cidade: 'Sabi Sand', uf: 'África do Sul', tipo: 'natureza', lat: -24.9000, lon: 31.4000, video: 'sQAhSkjRKGk' },
    { id: 1052, nome: 'Deserto do Namibe', cidade: 'Namibe', uf: 'Namíbia', tipo: 'natureza', lat: -24.7500, lon: 15.9130, video: 'ydYDqZQpim8' },
    { id: 1053, nome: 'Geleira Mendenhall', cidade: 'Juneau', uf: 'Estados Unidos', tipo: 'natureza', lat: 58.4700, lon: -134.6800, video: 'jJI5w_RVGtQ' },
    { id: 1054, nome: 'Dumpling Mountain, Katmai', cidade: 'Parque Katmai', uf: 'Estados Unidos', tipo: 'natureza', lat: 58.6300, lon: -154.7000, video: 'uLgdUiT9WZQ' },
    { id: 1055, nome: 'Aurora boreal de Churchill', cidade: 'Churchill', uf: 'Canadá', tipo: 'natureza', lat: 58.7700, lon: -94.1700, video: 'a0i1Kg6fROg' },
    { id: 1056, nome: 'Aurora boreal de Fairbanks', cidade: 'Fairbanks', uf: 'Estados Unidos', tipo: 'natureza', lat: 64.8400, lon: -147.7200, video: 'O52zDyxg5QI' },
    { id: 1057, nome: 'Lago Big Bear', cidade: 'Big Bear Lake', uf: 'Estados Unidos', tipo: 'natureza', lat: 34.2440, lon: -116.9100, video: 'pofGnqJbCBY' },
    { id: 1058, nome: 'Floresta dinamarquesa', cidade: 'Ikast', uf: 'Dinamarca', tipo: 'natureza', lat: 56.2640, lon: 9.5020, video: 'F0GOOP82094' },
    { id: 1059, nome: 'Aeroporto de Praga', cidade: 'Praga', uf: 'Tchéquia', tipo: 'aeroporto', lat: 50.1030, lon: 14.2640, video: 'Deo_lcwn8lk' },
    { id: 1060, nome: 'Aeroporto de Lisboa', cidade: 'Lisboa', uf: 'Portugal', tipo: 'aeroporto', lat: 38.7710, lon: -9.1300, video: 'cpNMQzMyMLQ' },
    { id: 1061, nome: 'Aeroporto de Heathrow', cidade: 'Londres', uf: 'Reino Unido', tipo: 'aeroporto', lat: 51.4700, lon: -0.4540, video: 'uDBYuEV4zjI' }
  ];
  CAMERAS_MUNDO.forEach(function (c) {
    c.modo = 'youtube';
    c.grupo = 'mundo';
    c.imagem = 'https://i.ytimg.com/vi/' + c.video + '/hqdefault_live.jpg';
    c.imagemPlano = 'https://i.ytimg.com/vi/' + c.video + '/hqdefault.jpg';
    c.player = 'https://www.youtube-nocookie.com/embed/' + c.video + '?autoplay=1&mute=1&playsinline=1&rel=0';
    c.url = 'https://www.youtube.com/watch?v=' + c.video;
    c.fonte = 'Câmera pública de ' + c.cidade + ' (' + c.uf + ') — transmissão contínua no YouTube';
  });

  app.get('/api/mapas/cameras', function(req, res) {
    var todas = CAMERAS_SA.concat(CAMERAS_YT, CAMERAS_MUNDO);
    var cidades = {}, ufs = {};
    todas.forEach(function (c) { cidades[c.cidade] = 1; ufs[c.uf] = 1; });
    var out = {
      fonte: 'Câmeras municipais de Santo André (SP) + SkylineWebcams + câmeras públicas do mundo',
      total: todas.length,
      transito: CAMERAS_SA.length,
      mundo: CAMERAS_MUNDO.length,
      paisesMundo: (function(){ var s={}; CAMERAS_MUNDO.forEach(function(c){ s[c.uf]=1; }); return Object.keys(s).length; })(),
      conferidoEm: CONFERIDO_EM,
      cidades: Object.keys(cidades).length,
      ufs: Object.keys(ufs).sort(),
      cameras: todas,
      aviso: 'As de trânsito abrem o vídeo no próprio quadro, sem sair do portal. ' +
             'Nas demais, o clique liga a transmissão ao vivo da câmera.',
      atualizadoEm: new Date().toISOString()
    };
    res.set('Cache-Control', 'public, max-age=300');
    res.json(out);
  });

  // Lista do OpenStreetMap, verificada câmera a câmera em 2026-11-01: das 28 cadastradas,
  // 16 devolvem JPEG novo (as outras respondem um XML de "objeto não encontrado").
  var CAMERAS_SA = [
    { id: 'coi04/ID_553', nome: 'Rio Tamanduateí — Rhodia',            cidade: 'Santo André', uf: 'SP', lat: -23.6524, lon: -46.5200 },
    { id: 'coi04/ID_644', nome: 'Av. das Nações × Rua América do Sul', cidade: 'Santo André', uf: 'SP', lat: -23.6340, lon: -46.5029 },
    { id: 'coi04/ID_593', nome: 'Av. Ramiro Colleoni × Rua Venezuela', cidade: 'Santo André', uf: 'SP', lat: -23.6642, lon: -46.5316 },
    { id: 'coi04/ID_642', nome: 'Av. Cap. Mário Toledo × Av. S. B. do Campo', cidade: 'Santo André', uf: 'SP', lat: -23.6983, lon: -46.5060 },
    { id: 'coi03/ID_261', nome: 'Rua André Ramalho × Av. dos Estados', cidade: 'Santo André', uf: 'SP', lat: -23.6519, lon: -46.5111 },
    { id: 'coi02/ID_139', nome: 'Av. dos Estados × Rua Caraguatatuba', cidade: 'Santo André', uf: 'SP', lat: -23.6521, lon: -46.5199 },
    { id: 'coi02/ID_078', nome: 'Rua João Pessoa × Av. Sapopemba',     cidade: 'Santo André', uf: 'SP', lat: -23.6149, lon: -46.5222 },
    { id: 'coi04/ID_650', nome: 'Câmera ID 650 (Centro)',              cidade: 'Santo André', uf: 'SP', lat: -23.6530, lon: -46.5631 },
    { id: 'coi02/ID_075', nome: 'Praça 14 Bis',                        cidade: 'Santo André', uf: 'SP', lat: -23.6636, lon: -46.5111 },
    { id: 'coi04/ID_558', nome: 'Rua Erato',                           cidade: 'Santo André', uf: 'SP', lat: -23.6647, lon: -46.5110 },
    { id: 'coi02/ID_102', nome: 'Câmera ID 102 (Centro)',              cidade: 'Santo André', uf: 'SP', lat: -23.6473, lon: -46.5246 },
    { id: 'coi03/ID_256', nome: 'Av. Mico Leão Dourado',               cidade: 'Santo André', uf: 'SP', lat: -23.7340, lon: -46.4804 },
    { id: 'coi02/ID_065', nome: 'Câmera ID 065 (Centro)',              cidade: 'Santo André', uf: 'SP', lat: -23.6251, lon: -46.5429 },
    { id: 'coi04/ID_594', nome: 'Viaduto Cassaquera',                  cidade: 'Santo André', uf: 'SP', lat: -23.6633, lon: -46.4975 },
    { id: 'coi03/ID_257', nome: 'Av. Eduardo Prado × Av. das Nações',  cidade: 'Santo André', uf: 'SP', lat: -23.6396, lon: -46.4999 },
    { id: 'coi04/ID_576', nome: 'Câmera ID 576 (Centro)',              cidade: 'Santo André', uf: 'SP', lat: -23.6526, lon: -46.5282 }
  ];
  CAMERAS_SA.forEach(function (c) {
    c.tipo = 'transito';
    c.modo = 'mjpeg';
    c.grupo = 'transito';
    c.stream = 'https://cameras.santoandre.sp.gov.br/' + c.id;
    // Para o cartao nao abre 16 videos de uma vez: aqui a gente colhe um unico quadro
    // do video e entrega como fotografia.
    c.imagem = '/api/mapas/camera/quadro?id=' + encodeURIComponent(c.id);
    c.player = '';
    c.url = 'https://www.santoandre.sp.gov.br/';
    c.fonte = 'Prefeitura de Santo André (SP) — monitoramento de trânsito';
  });

  // Um quadro do video MJPEG: abre o stream, pega o primeiro JPEG inteiro e fecha a conexao.
  // A moldura do cartao e servida daqui porque o servidor da camera nao aceita o navegador
  // do visitante chegando sem endereco dele proprio.
  var QUADROS = {};
  var IDADE_QUADRO = 45000;

  function cameraSA(id) {
    for (var i = 0; i < CAMERAS_SA.length; i++) if (CAMERAS_SA[i].id === id) return CAMERAS_SA[i];
    return null;
  }

  // O MJPEG vem com lixo de cabeçalho antes e depois; o JPEG verdadeiro esta entre
  // FFD8 (inicio) e FFD9 (fim). Sem achar os dois, nao ha quadro.
  function primeiroJpeg(buf) {
    var i = 0, n = buf.length;
    while (i < n - 3) { if (buf[i] === 0xFF && buf[i + 1] === 0xD8) break; i++; }
    if (i >= n - 3) return null;
    var j = i + 2;
    while (j < n - 2) { if (buf[j] === 0xFF && buf[j + 1] === 0xD9) return buf.slice(i, j + 2); j++; }
    return null;
  }

  app.get('/api/mapas/camera/quadro', function(req, res) {
    var id = String(req.query.id || '');
    var c = /^[a-z0-9]{2,8}\/ID_[0-9]{3}$/.test(id) ? cameraSA(id) : null;
    if (!c) return res.status(404).json({ erro: 'câmera não cadastrada' });
    var agora = Date.now(), guardado = QUADROS[id];
    function envia(buf, idade) {
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=40');
      res.set('X-Idade-do-Quadro', String(Math.round(idade / 1000)) + 's');
      res.send(buf);
    }
    if (guardado && agora - guardado.t < IDADE_QUADRO) return envia(guardado.buf, agora - guardado.t);

    var pedaco = [], bytes = 0, encerrado = false;
    var p = fetch(c.stream, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
                              signal: AbortSignal.timeout(12000) });
    p.then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var leitor = r.body.getReader();
      function ronda(){
        return leitor.read().then(function(resultado){
          if (resultado.done) throw new Error('fim do stream sem quadro');
          var fatia = Buffer.from(resultado.value);
          pedaco.push(fatia); bytes += fatia.length;
          var quadro = primeiroJpeg(Buffer.concat(pedaco));
          if (quadro) { encerrado = true; try { leitor.cancel(); } catch (e) {} return quadro; }
          if (bytes > 400000) throw new Error('stream pesado demais');
          return ronda();
        });
      }
      return ronda();
    }).then(function(quadro){
      QUADROS[id] = { t: Date.now(), buf: quadro };
      envia(quadro, 0);
    }).catch(function(){
      if (guardado) return envia(guardado.buf, agora - guardado.t);
      res.status(502).json({ erro: 'câmera sem imagem agora' });
    });
  });

  // ================= globos 3D: cabos, rotas aereas, lancamentos =================

  var MAX_CABOS = 320;
  var MAX_PONTOS_LINHA = 40;
  var MAX_ARCOS = 1400;

  function soNumeros(v) { return v !== null && v !== undefined && isFinite(v); }

  // A fonte traz 60 mil pontos por traco; o globo nao precisa de nada alem de 40 para
  // desenhar a curva, e sem afinar a pagina baixaria mais de um megabyte.
  function afinaLinha(pts, teto) {
    if (pts.length <= teto) return pts;
    var passo = pts.length / teto, saída = [];
    for (var i = 0; i < teto; i++) saída.push(pts[Math.floor(i * passo)]);
    var ultimo = pts[pts.length - 1];
    if (saída[saída.length - 1] !== ultimo) saída.push(ultimo);
    return saída;
  }

  // Duas varreduras a partir de qualquer ponta: e a aproximacao barata do diametro do traco.
  function pontaMaisLonga(pontas) {
    if (pontas.length < 2) return [];
    function quadrado(p, q) {
      var dx = p[0] - q[0], dy = p[1] - q[1];
      return dx * dx + dy * dy;
    }
    function maisDistante(de) {
      var melhor = de;
      pontas.forEach(function(p) { if (quadrado(p, de) > quadrado(melhor, de)) melhor = p; });
      return melhor;
    }
    var a = maisDistante(pontas[0]);
    var b = maisDistante(a);
    return a === b ? [] : [a, b];
  }

  // ---- Cabos submarinos (Submarine Cable Map) ----
  // A fonte nao envia CORS, entao o navegador nao consegue ler: passa pelo servidor.
  app.get('/api/mapas/cabos', function(req, res) {
    var ck = 'mapa_cabos';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    getJSON('https://www.submarinecablemap.com/api/v3/cable/cable-geo.json', {}, 40000)
      .then(function(r) {
        if (r.status !== 200 || !r.data || !r.data.features) throw new Error('HTTP ' + r.status);
        var porCabo = {}, ordem = [];
        r.data.features.forEach(function(f) {
          var p = f.properties || {}, g = f.geometry;
          if (!p.id || !g || !g.coordinates) return;
          var cabo = porCabo[p.id];
          if (!cabo) {
            cabo = porCabo[p.id] = { id: p.id, nome: p.name || p.id, cor: p.color || null,
              linhas: [], pontos: 0, pontas: [] };
            ordem.push(p.id);
          }
          g.coordinates.forEach(function(traaco) {
            var pts = (traaco || []).filter(function(xy) {
              return xy && soNumeros(xy[0]) && soNumeros(xy[1]);
            }).map(function(xy) {
              return [ +xy[0].toFixed(3), +xy[1].toFixed(3) ];
            });
            if (pts.length < 2) return;
            cabo.pontos += pts.length;
            cabo.linhas.push(afinaLinha(pts, MAX_PONTOS_LINHA));
            cabo.pontas.push(pts[0], pts[pts.length - 1]);
          });
        });
        var todos = ordem.map(function(k) { return porCabo[k]; })
          .filter(function(c) { return c.linhas.length; });
        // as duas pontas mais afastadas do traco: o globo marca como chegada de terra
        todos.forEach(function(c) {
          c.chegadas = pontaMaisLonga(c.pontas);
          delete c.pontas;
        });
        var mostrados = todos.slice().sort(function(a, b) { return b.pontos - a.pontos; })
          .slice(0, MAX_CABOS);
        var out = {
          fonte: 'Submarine Cable Map (TeleGeography)',
          total: mostrados.length,
          catalogados: todos.length,
          cabos: mostrados,
          aviso: todos.length > mostrados.length
            ? 'Há ' + todos.length + ' cabos catalogados; o globo desenha os ' + mostrados.length +
              ' traçados mais longos, que são os que sustentam o tráfego entre continentes.'
            : null,
          atualizadoEm: new Date().toISOString()
        };
        cacheSet(ck, out, 24 * 3600000);
        guardarBoa(ck, out);
        res.json(out);
      })
      .catch(function(e) {
        var boa = UltimaBOA(ck);
        if (boa) {
          var velho = JSON.parse(JSON.stringify(boa.v));
          velho.stale = true;
          velho.aviso = 'A fonte de cabos não respondeu agora (' + String(e.message || e) +
                        '); mostrando o mapa lido em ' + horaLegivel(new Date(boa.t)) + '.';
          return res.json(velho);
        }
        res.json({ fonte: 'Submarine Cable Map (TeleGeography)', total: 0, cabos: [],
          erro: 'Cabos indisponíveis agora',
          aviso: 'A fonte não respondeu. Recarregue em instantes.',
          atualizadoEm: new Date().toISOString() });
      });
  });

  // ---- Rotas aereas (OpenFlights) ----
  // CSV com aspas: os nomes de aeroporto tem virgula dentro do campo entre aspas.
  function separaCsv(linha) {
    var campos = [], atual = '', dentro = false;
    for (var i = 0; i < linha.length; i++) {
      var ch = linha[i];
      if (dentro) {
        if (ch === '"') {
          if (linha[i + 1] === '"') { atual += '"'; i++; }
          else dentro = false;
        } else atual += ch;
      } else if (ch === '"') dentro = true;
      else if (ch === ',') { campos.push(atual); atual = ''; }
      else atual += ch;
    }
    campos.push(atual);
    return campos;
  }

  function leAeroportos(texto) {
    var porId = {}, porIata = {};
    texto.split('\n').forEach(function(l) {
      if (!l || l.charAt(0) === '#') return;
      var c = separaCsv(l);
      if (c.length < 8) return;
      if (c[12] && c[12] !== 'airport' && c[12] !== 'heliport') return;
      var lat = parseFloat(c[6]), lng = parseFloat(c[7]);
      if (!soNumeros(lat) || !soNumeros(lng) || (lat === 0 && lng === 0)) return;
      var a = { id: c[0], nome: c[1], cidade: c[2], pais: c[3],
                iata: c[4] === '-' ? '' : c[4], lat: lat, lng: lng, grau: 0 };
      porId[a.id] = a;
      if (a.iata && !porIata[a.iata]) porIata[a.iata] = a;
    });
    return { porId: porId, porIata: porIata };
  }

  app.get('/api/mapas/rotas', function(req, res) {
    var ck = 'mapa_rotas';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var base = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/';
    var aero = null;
    Promise.all([
      getJSON(base + 'airports.dat', {}, 40000),
      getJSON(base + 'routes.dat', {}, 60000)
    ]).then(function(rs) {
      if (rs[0].status !== 200 || typeof rs[0].data !== 'string') throw new Error('aeroportos HTTP ' + rs[0].status);
      if (rs[1].status !== 200 || typeof rs[1].data !== 'string') throw new Error('rotas HTTP ' + rs[1].status);
      aero = leAeroportos(rs[0].data);
      var pares = {}, chaves = [];
      rs[1].data.split('\n').forEach(function(l) {
        if (!l || l.charAt(0) === '#') return;
        var c = separaCsv(l);
        if (c.length < 6) return;
        var de = aero.porId[c[3]] || aero.porIata[c[2]];
        var para = aero.porId[c[5]] || aero.porIata[c[4]];
        if (!de || !para || de.id === para.id) return;
        var k = de.id < para.id ? de.id + '|' + para.id : para.id + '|' + de.id;
        var par = pares[k];
        if (!par) {
          par = pares[k] = { de: de, para: para, voos: 0, cias: {} };
          chaves.push(k);
          de.grau++; para.grau++;
        }
        par.voos++;
        if (c[0]) par.cias[c[0]] = 1;
      });
      var lista = chaves.map(function(k) { return pares[k]; });
      function doBrasil(p) { return p.de.pais === 'Brazil' || p.para.pais === 'Brazil'; }
      // Do mundo entra o topo por frequencia; as brasileiras entram todas, porque o
      // publico do site quer ver a propria malha e ela nunca apareceria no corte global.
      var brasileiras = lista.filter(doBrasil);
      var selecionados = lista.filter(function(p) { return !doBrasil(p); })
        .sort(function(a, b) { return b.voos - a.voos; })
        .slice(0, MAX_ARCOS).concat(brasileiras);
      var usados = {}, arcos = [];
      selecionados.forEach(function(p) {
        [p.de, p.para].forEach(function(a) {
          if (!usados[a.id]) {
            usados[a.id] = { nome: a.nome, cidade: a.cidade, pais: a.pais,
              iata: a.iata, lat: a.lat, lng: a.lng, grau: 0 };
          }
          usados[a.id].grau++;
        });
        arcos.push({ d: p.de.lat, q: p.de.lng, p: p.para.lat, o: p.para.lng,
          de: p.de.iata || p.de.nome, para: p.para.iata || p.para.nome,
          pais: p.de.pais === 'Brazil' || p.para.pais === 'Brazil' ? 'BR' : '',
          voos: p.voos, cias: Object.keys(p.cias).length });
      });
      var out = {
        fonte: 'OpenFlights (airports.dat + routes.dat)',
        total: arcos.length,
        arcos: arcos,
        aeroportos: Object.keys(usados).map(function(k) { return usados[k]; }),
        aviso: 'São ' + chaves.length + ' pares de aeroportos no catálogo; o globo desenha as ' +
               arcos.length + ' ligações mais atendidas do mundo e todas as ' + brasileiras.length +
               ' com origem ou destino no Brasil. É a malha de rotas publicada pelo OpenFlights, ' +
               'não os voos de hoje: a espessura do arco conta quantas linhas áreas atendem o par.',
        atualizadoEm: new Date().toISOString()
      };
      // base estatica: um mes de cache evita baixar 3,5 MB de cada vez que alguem abre a pagina
      cacheSet(ck, out, 30 * 24 * 3600000);
      guardarBoa(ck, out);
      res.json(out);
    }).catch(function(e) {
      var boa = UltimaBOA(ck);
      if (boa) {
        var velho = JSON.parse(JSON.stringify(boa.v));
        velho.stale = true;
        velho.aviso = 'As listas do OpenFlights não responderam agora; mostrando a malha lida em ' +
                      horaLegivel(new Date(boa.t)) + '.';
        return res.json(velho);
      }
      res.json({ fonte: 'OpenFlights (airports.dat + routes.dat)', total: 0, arcos: [],
        aeroportos: [], erro: 'Rotas indisponíveis agora',
        aviso: 'A fonte não respondeu. Recarregue em instantes.',
        atualizadoEm: new Date().toISOString() });
    });
  });

  // ---- Proximos lancamentos espaciais (The Space Devs) ----
  app.get('/api/mapas/lancamentos', function(req, res) {
    var ck = 'mapa_lancamentos';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var base = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=50&offset=';
    var pagina = 0, colhidos = [], esgotou = false, anunciados = 0;

    function passo() {
      if (pagina >= 2) return Promise.resolve();
      return getJSON(base + (pagina * 50), {}, 20000).then(function(r) {
        var lista = (r.data && r.data.results) || [];
        if (r.status !== 200 || !lista.length) { esgotou = true; return; }
        if (r.data.count) anunciados = r.data.count;
        colhidos = colhidos.concat(lista);
        pagina++;
        return espera(400).then(passo);
      }).catch(function() { esgotou = true; });
    }

    passo().then(function() {
      var agora = Date.now();
      var atrasados = 0;
      var lancamentos = colhidos.map(function(L) {
        var pad = L.pad || {}, loc = pad.location || {};
        var lat = parseFloat(pad.latitude), lng = parseFloat(pad.longitude);
        var quando = L.net ? new Date(L.net).getTime() : 0;
        var mis = L.mission || {};
        return {
          nome: L.name || '—',
          foguete: (L.rocket && L.rocket.configuration && L.rocket.configuration.name) || '—',
          lsp: (L.launch_service_provider && L.launch_service_provider.name) || '—',
          local: pad.name || loc.name || '—',
          base: loc.name || '—',
          pais: loc.country_code || pad.country_code || '',
          lat: soNumeros(lat) ? lat : null,
          lng: soNumeros(lng) ? lng : null,
          quando: L.net || '',
          dias: quando ? Math.round((quando - agora) / 86400000) : null,
          status: (L.status && L.status.name) || '—',
          orbita: (mis.orbit && mis.orbit.name) || mis.mission_type || '',
          descricao: (mis.description || '').slice(0, 300),
          url: L.url || ''
        };
      }).filter(function(x) {
        if (x.lat === null || x.lng === null) return false;
        // a lista "upcoming" ainda traz o que acabou de voar: sem cortar, o globo mente
        var t = new Date(x.quando).getTime();
        if (t && t < agora - 3600000) { atrasados++; return false; }
        return true;
      })
        .sort(function(a, b) { return new Date(a.quando) - new Date(b.quando); });

      if (!lancamentos.length) {
        var boa = UltimaBOA(ck);
        if (boa) {
          var velho = JSON.parse(JSON.stringify(boa.v));
          velho.stale = true;
          velho.aviso = 'A The Space Devs não devolveu lançamentos agora; mostrando a lista lida em ' +
                        horaLegivel(new Date(boa.t)) + '. Recarregue em instantes.';
          return res.json(velho);
        }
        return res.json({ fonte: 'The Space Devs (API pública)', total: 0, lancamentos: [], bases: [],
          erro: 'Lançamentos indisponíveis agora',
          aviso: 'A The Space Devs não respondeu ou cortou o ritmo. Recarregue em instantes.',
          atualizadoEm: new Date().toISOString() });
      }

      var porBase = {};
      lancamentos.forEach(function(x) {
        var k = x.base || x.local;
        if (!porBase[k]) porBase[k] = { base: k, pais: x.pais, lat: x.lat, lng: x.lng, qtd: 0 };
        porBase[k].qtd++;
      });

      var out = {
        fonte: 'The Space Devs (API pública)',
        total: lancamentos.length,
        anunciados: anunciados,
        lancamentos: lancamentos,
        bases: Object.keys(porBase).map(function(k) { return porBase[k]; })
          .sort(function(a, b) { return b.qtd - a.qtd; }),
        aviso: 'A agenda da The Space Devs traz ' + (anunciados || colhidos.length) +
               ' lançamentos anunciados; o globo recebe as próximas duas páginas e mostra os ' +
               lancamentos.length + ' com data ainda à frente' +
               (atrasados ? ' (' + atrasados + ' já tinham voado)' : '') +
               '. ' + (esgotou ? 'A leitura veio parcial. ' : '') +
               'Ela fica guardada por uma hora: a API libera poucas consultas por dia sem chave. ' +
               'Data prevista muda com o tempo.',
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 3600000);
      guardarBoa(ck, out);
      res.json(out);
    });
  });

};
