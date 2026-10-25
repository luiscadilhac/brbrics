// BrBRICS - Rotas de mapas geoespaciais (satélite federal, aviões, embarcações, câmeras)
module.exports.registrarMapas = function(app, cacheGet, cacheSet, getJSON) {

  // ---- Satélite federal (INPE - BDQueimadas focos de calor) ----
  app.get('/api/mapas/satelite', function(req, res) {
    var ck = 'mapa_satelite_' + (req.query.estado || 'BR');
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var uf = req.query.estado || 'BR';
    var brasilBounds = { latMin: -34, latMax: 6, lonMin: -75, lonMax: -32 };

    var url = 'https://queimadas.dgi.inpe.br/api/focos?estado=' + encodeURIComponent(uf) +
              '&pais=Brasil&periodo=48h&formato=json';

    getJSON(url, {}, 20000).then(function(r) {
      var focos = [];
      var dados = r.data || [];
      if (Array.isArray(dados)) {
        dados.forEach(function(f) {
          var lat = Number(f.latitude || f.lat);
          var lon = Number(f.longitude || f.lon);
          if (lat >= brasilBounds.latMin && lat <= brasilBounds.latMax &&
              lon >= brasilBounds.lonMin && lon <= brasilBounds.lonMax) {
            focos.push({
              lat: lat, lon: lon, tipo: 'foco_calor',
              municipio: f.municipio || '—', uf: f.estado || f.uf || uf,
              bioma: f.bioma || '—', satelite: f.satelite || 'INPE/CBERS',
              datahora: f.datahora || f.dataHora || new Date().toISOString(),
              intensidade: f.intensidade || f.risco_fogo || '—'
            });
          }
        });
      }
      var out = {
        fonte: 'INPE - BDQueimadas (focos de calor via satélite CBERS/GOES)',
        estado: uf, total: focos.length, focos: focos,
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 300000);
      res.json(out);
    }).catch(function(e) {
      res.json({ fonte: 'INPE - BDQueimadas', estado: uf, total: 0, focos: [],
        erro: String((e && e.message) || e).slice(0, 160), atualizadoEm: new Date().toISOString() });
    });
  });

  // ---- Aviões (OpenSky Network - ADS-B, sem chave) ----
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

    getJSON(url, {}, 20000).then(function(r) {
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
      var out = {
        fonte: 'OpenSky Network (ADS-B)', regiao: 'Brasil',
        total: avioes.length, avioes: avioes,
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 60000);
      res.json(out);
    }).catch(function(e) {
      res.json({ fonte: 'OpenSky Network', regiao: 'Brasil', total: 0, avioes: [],
        erro: String((e && e.message) || e).slice(0, 160), atualizadoEm: new Date().toISOString() });
    });
  });

  // ---- Embarcações (AIS - dados públicos de rastreio) ----
  app.get('/api/mapas/embarcacoes', function(req, res) {
    var ck = 'mapa_embarcacoes';
    var hit = cacheGet(ck);
    if (hit) return res.json(hit);

    var url2 = 'https://www.vesseltracker.com/app/map/vessels';
    getJSON(url2, {}, 15000).then(function(r) {
      var embarcoes = [];
      var dados = r.data || r.vessels || [];
      if (Array.isArray(dados)) {
        dados.slice(0, 100).forEach(function(v) {
          embarcoes.push({
            nome: v.nome || v.name || '—', mmsi: v.mmsi || '—',
            tipo: v.tipo || v.shipType || 'Embarcação',
            lat: Number(v.lat || v.latitude) || 0, lon: Number(v.lon || v.longitude) || 0,
            velocidade: v.velocidade || v.speed || '—', direcao: v.direcao || v.course || '—',
            bandeira: v.bandeira || v.flag || '—'
          });
        });
      }
      var out = {
        fonte: 'AIS - Rastreamento de embarcações', regiao: 'Costeira brasileira',
        total: embarcoes.length, embarcacoes: embarcoes,
        atualizadoEm: new Date().toISOString()
      };
      cacheSet(ck, out, 300000);
      res.json(out);
    }).catch(function(e) {
      res.json({
        fonte: 'AIS - Rastreamento de embarcações', regiao: 'Costeira brasileira',
        total: 0, embarcacoes: [],
        aviso: 'Fontes públicas de AIS (MarineTraffic, VesselFinder) exigem API key.',
        erro: String((e && e.message) || e).slice(0, 160),
        atualizadoEm: new Date().toISOString()
      });
    });
  });

  // ---- Câmeras online (lista de câmeras públicas do Brasil) ----
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
      atualizadoEm: new Date().toISOString()
    };
    cacheSet(ck, out, 3600000);
    res.json(out);
  });

};