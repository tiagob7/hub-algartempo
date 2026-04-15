(function() {
  const COLLECTION = 'clientes';
  const HEADER_ROW_INDEX = 1;
  const DATA_START_ROW_INDEX = 2;
  const MAX_BATCH_OPERATIONS = 400;

  const COLUMN_ALIASES = {
    numeroCliente: ['n cliente', 'no cliente', 'numero cliente', 'num cliente', 'n cliente ', 'n cliente'],
    nome: ['cliente', 'nome cliente', 'hotel', 'nome'],
    grupo: ['grupo'],
    escritorio: ['escritorio', 'escritório', 'office'],
    categoria: ['categoria'],
    preco22Dias: ['preco 22 dias', 'preço 22 dias', 'preco22dias', 'preco 22d'],
    valorDia: ['valor dia', 'valor/dia', 'valor dia ', 'valordia'],
    precoHora: ['preco hora', 'preço hora', 'preco/hora', 'preco hora '],
    propostaData: ['data proposta contrato', 'data proposta / contrato', 'data proposta', 'proposta data', 'contrato'],
    obs: ['obs', 'observacoes', 'observações', 'observacao', 'observação'],
  };

  function db() {
    return firebase.firestore();
  }

  function collection() {
    return db().collection(COLLECTION);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function normalizeDocString(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeCategoryKey(value) {
    return normalizeText(value).replace(/\s+/g, '-');
  }

  function stringifyCell(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (value instanceof Date) return value.toISOString();
    return String(value).trim();
  }

  function parseNumeric(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const raw = String(value).trim();
    if (!raw) return null;

    const compact = raw.replace(/\s/g, '').replace(/€/g, '');
    const normalizedBase = /^\d{1,3}(\.\d{3})+$/.test(compact)
      ? compact.replace(/\./g, '')
      : /^\d{1,3}(,\d{3})+$/.test(compact)
        ? compact.replace(/,/g, '')
        : compact;
    const normalized = normalizedBase.includes(',') && normalizedBase.includes('.')
      ? normalizedBase.replace(/\./g, '').replace(',', '.')
      : normalizedBase.includes(',')
        ? normalizedBase.replace(',', '.')
        : normalizedBase;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatNumberForDoc(value) {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.round(value * 10000) / 10000;
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function buildColumnMap(headers) {
    const normalizedHeaders = headers.map(normalizeText);
    const result = {};

    Object.keys(COLUMN_ALIASES).forEach(key => {
      const aliases = COLUMN_ALIASES[key];
      const idx = normalizedHeaders.findIndex(header => aliases.some(alias => header === normalizeText(alias)));
      result[key] = idx;
    });

    return result;
  }

  function requireColumns(columnMap, requiredKeys) {
    const missing = requiredKeys.filter(key => columnMap[key] == null || columnMap[key] < 0);
    if (missing.length) {
      throw new Error('Colunas em falta no ficheiro: ' + missing.join(', '));
    }
  }

  function parseWorkbook(buffer) {
    if (!window.XLSX) throw new Error('A biblioteca XLSX não está disponível nesta página.');

    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('O ficheiro não contém folhas para importar.');

    const worksheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
    const headers = matrix[HEADER_ROW_INDEX] || [];
    const columnMap = buildColumnMap(headers);

    requireColumns(columnMap, ['nome', 'categoria']);

    return {
      sheetName: firstSheetName,
      columnMap,
      rows: matrix.slice(DATA_START_ROW_INDEX),
    };
  }

  function buildCurrentPricesMap(lines) {
    const map = {};

    (lines || []).forEach(line => {
      const key = normalizeCategoryKey(line.categoria);
      if (!key) return;

      map[key] = {
        categoria: line.categoria,
        preco22Dias: line.preco22Dias,
        valorDia: line.valorDia,
        precoHora: line.precoHora,
        obsLinha: line.obsLinha || '',
      };
    });

    return map;
  }

  function summarizeRevision(lines) {
    const rows = Array.isArray(lines) ? lines : [];
    return {
      totalCategorias: rows.length,
      comPrecoHora: rows.filter(line => line.precoHora != null).length,
      comValorDia: rows.filter(line => line.valorDia != null).length,
      comPreco22Dias: rows.filter(line => line.preco22Dias != null).length,
    };
  }

  function parseClientRows(parsedWorkbook) {
    const groups = new Map();
    const ignoredRows = [];

    parsedWorkbook.rows.forEach((row, index) => {
      const rowNumber = DATA_START_ROW_INDEX + index + 1;
      const numeroCliente = normalizeDocString(row[parsedWorkbook.columnMap.numeroCliente]);
      const nome = normalizeDocString(row[parsedWorkbook.columnMap.nome]);
      const categoria = normalizeDocString(row[parsedWorkbook.columnMap.categoria]);
      const grupo = normalizeDocString(row[parsedWorkbook.columnMap.grupo]);
      const escritorio = normalizeDocString(row[parsedWorkbook.columnMap.escritorio]);
      const propostaDataRaw = stringifyCell(row[parsedWorkbook.columnMap.propostaData]);
      const obs = normalizeDocString(row[parsedWorkbook.columnMap.obs]);

      if (!nome || !categoria) {
        ignoredRows.push({
          rowNumber,
          reason: !nome ? 'Linha ignorada sem nome de cliente.' : 'Linha ignorada sem categoria.',
        });
        return;
      }

      const groupingKey = numeroCliente ? 'num:' + numeroCliente : 'name:' + normalizeText(nome);
      if (!groups.has(groupingKey)) {
        groups.set(groupingKey, {
          groupingKey,
          numeroCliente,
          nome,
          grupo,
          escritorioOrigem: escritorio,
          obs,
          propostaDataRaw,
          linhas: [],
        });
      }

      const current = groups.get(groupingKey);
      if (!current.grupo && grupo) current.grupo = grupo;
      if (!current.escritorioOrigem && escritorio) current.escritorioOrigem = escritorio;
      if (!current.obs && obs) current.obs = obs;
      if (!current.propostaDataRaw && propostaDataRaw) current.propostaDataRaw = propostaDataRaw;

      current.linhas.push({
        categoria,
        preco22Dias: formatNumberForDoc(parseNumeric(row[parsedWorkbook.columnMap.preco22Dias])),
        valorDia: formatNumberForDoc(parseNumeric(row[parsedWorkbook.columnMap.valorDia])),
        precoHora: formatNumberForDoc(parseNumeric(row[parsedWorkbook.columnMap.precoHora])),
        obsLinha: obs,
        sourceRowNumber: rowNumber,
      });
    });

    return {
      clients: Array.from(groups.values()),
      ignoredRows,
    };
  }

  async function fetchExistingClientes() {
    const snap = await collection().get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  function matchExistingClient(importClient, existingClientes) {
    if (importClient.numeroCliente) {
      const byNumber = existingClientes.find(item => normalizeDocString(item.numeroCliente) === importClient.numeroCliente);
      if (byNumber) return { client: byNumber, matchType: 'numeroCliente' };
    }

    const normalizedName = normalizeText(importClient.nome);
    if (!normalizedName) return { client: null, matchType: 'novo' };

    const candidates = existingClientes.filter(item => !normalizeDocString(item.numeroCliente) && normalizeText(item.nome) === normalizedName);
    if (candidates.length === 1) return { client: candidates[0], matchType: 'nomeExato' };
    if (candidates.length > 1) return { client: null, matchType: 'nomeExatoMultiplo' };

    return { client: null, matchType: 'novo' };
  }

  async function previewImport(file) {
    if (!file) throw new Error('Seleciona um ficheiro para importar.');

    const buffer = await readFileAsArrayBuffer(file);
    const parsedWorkbook = parseWorkbook(buffer);
    const extracted = parseClientRows(parsedWorkbook);
    const existingClientes = await fetchExistingClientes();

    const previewItems = extracted.clients.map(item => {
      const match = matchExistingClient(item, existingClientes);
      const existing = match.client || null;
      const ambiguous = match.matchType === 'nomeExatoMultiplo';

      return {
        clientId: existing ? existing.id : '',
        matchType: match.matchType,
        isExisting: !!existing,
        isAmbiguous: ambiguous,
        isBlocked: ambiguous,
        numeroCliente: item.numeroCliente,
        nome: item.nome,
        grupo: item.grupo,
        escritorioOrigem: item.escritorioOrigem,
        obs: item.obs,
        propostaDataRaw: item.propostaDataRaw,
        linhas: clone(item.linhas),
        precosAtuais: buildCurrentPricesMap(item.linhas),
        summary: summarizeRevision(item.linhas),
        warnings: [
          !item.numeroCliente ? 'Sem numero de cliente no Excel; o match depende do nome.' : '',
          ambiguous ? 'Encontrados varios clientes existentes com o mesmo nome sem numero associado.' : '',
        ].filter(Boolean),
      };
    });

    return {
      fileName: file.name,
      sourceSheet: parsedWorkbook.sheetName,
      importedAtPreview: Date.now(),
      clients: previewItems,
      ignoredRows: extracted.ignoredRows,
        summary: {
          totalClientes: previewItems.length,
          novos: previewItems.filter(item => !item.isExisting).length,
          existentes: previewItems.filter(item => item.isExisting).length,
          ambiguos: previewItems.filter(item => item.isAmbiguous).length,
          bloqueados: previewItems.filter(item => item.isBlocked).length,
          linhasIgnoradas: extracted.ignoredRows.length,
          totalCategorias: previewItems.reduce((acc, item) => acc + item.summary.totalCategorias, 0),
        },
      };
  }

  async function commitBatches(operations) {
    if (!operations.length) return;

    for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
      const slice = operations.slice(index, index + MAX_BATCH_OPERATIONS);
      const batch = db().batch();
      slice.forEach(operation => batch.set(operation.ref, operation.data, { merge: true }));
      await batch.commit();
    }
  }

  async function applyImport(previewPayload) {
    if (!previewPayload || !Array.isArray(previewPayload.clients) || !previewPayload.clients.length) {
      throw new Error('Não existe preview válido para aplicar.');
    }

    const importableClients = previewPayload.clients.filter(item => !item.isBlocked);
    if (!importableClients.length) {
      throw new Error('O preview so contem clientes bloqueados por ambiguidade de correspondencia.');
    }

    const now = Date.now();
    const uid = window.currentUser ? window.currentUser.uid : '';
    const profile = window.userProfile || {};
    const importedByName = profile.nomeCompleto || profile.nome || (window.currentUser && window.currentUser.email) || '';

    const existingSnapshots = await Promise.all(
      importableClients
        .filter(item => item.clientId)
        .map(item => collection().doc(item.clientId).get())
    );

    const existingMap = new Map();
    existingSnapshots.forEach(snap => {
      if (snap.exists) existingMap.set(snap.id, { id: snap.id, ...snap.data() });
    });

    const operations = [];
    const resultClients = [];

    importableClients.forEach(item => {
      const current = item.clientId ? existingMap.get(item.clientId) : null;
      const ref = current ? collection().doc(current.id) : collection().doc();
      const revision = {
        importedAt: now,
        importedBy: uid,
        importedByName,
        sourceFile: previewPayload.fileName,
        sourceSheet: previewPayload.sourceSheet,
        propostaDataRaw: item.propostaDataRaw || '',
        linhas: clone(item.linhas),
      };

      const revisoes = (current && Array.isArray(current.revisoes) ? current.revisoes.slice() : []);
      revisoes.push(revision);

      const data = {
        numeroCliente: item.numeroCliente || '',
        nome: item.nome,
        grupo: item.grupo || '',
        escritorioOrigem: item.escritorioOrigem || '',
        obs: item.obs || (current && current.obs) || '',
        ultimaPropostaRef: current && current.ultimaPropostaRef ? current.ultimaPropostaRef : '',
        ultimaPropostaData: item.propostaDataRaw || (current && current.ultimaPropostaData) || '',
        updatedAt: now,
        updatedBy: uid,
        updatedByName: importedByName,
        revisoes,
        precosAtuais: buildCurrentPricesMap(item.linhas),
        ultimaRevisaoResumo: {
          ...summarizeRevision(item.linhas),
          importedAt: now,
          importedByName,
          sourceFile: previewPayload.fileName,
        },
      };

      if (!current) {
        data.createdAt = now;
        data.createdBy = uid;
        data.createdByName = importedByName;
      }

      operations.push({ ref, data });
      resultClients.push({
        id: ref.id,
        nome: item.nome,
        numeroCliente: item.numeroCliente || '',
        action: current ? 'updated' : 'created',
        totalCategorias: item.linhas.length,
      });
    });

    await commitBatches(operations);

    return {
      importedAt: now,
      sourceFile: previewPayload.fileName,
      totalClientes: resultClients.length,
      clients: resultClients,
    };
  }

  function listenAll(options) {
    const cfg = options || {};
    const onData = cfg.onData || function() {};
    const onError = cfg.onError || function() {};

    const primary = collection().orderBy('nome', 'asc').onSnapshot(snap => {
      onData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => {
      console.warn('[ClientesService] orderBy fallback:', err);
      const fallback = collection().onSnapshot(snap => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-PT'));
        onData(list);
      }, onError);

      if (typeof cfg.onFallback === 'function') cfg.onFallback(fallback);
    });

    return primary;
  }

  async function listClientes() {
    return fetchExistingClientes();
  }

  async function getCliente(id) {
    if (!id) throw new Error('ID de cliente em falta.');
    const snap = await collection().doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  window.ClientesService = {
    listenAll,
    listClientes,
    getCliente,
    previewImport,
    applyImport,
  };
})();
