/**
 * INVENTUM 2026 — sincroniza a planilha "Programação Preliminar" com o Supabase.
 *
 * Como instalar:
 * 1. Abra a planilha no navegador → menu Extensões → Apps Script.
 * 2. Apague o conteúdo de Code.gs e cole este arquivo inteiro.
 * 3. No menu lateral (ícone de engrenagem) → Propriedades do projeto → Propriedades
 *    do script → adicione duas propriedades:
 *      SUPABASE_URL              = https://xxxxx.supabase.co   (mesma do .env do site)
 *      SUPABASE_SERVICE_ROLE_KEY = a chave "service_role" (Project Settings → API no
 *                                  Supabase — NUNCA a "anon", e nunca coloque essa
 *                                  chave no site/.env, só aqui).
 * 4. Rode a função syncAll() uma vez pelo próprio editor (▶ Executar), autorize o
 *    acesso pedido pelo Google — isso faz a primeira carga.
 * 5. Menu Gatilhos (ícone de relógio) → + Adicionar Gatilho:
 *      Função: syncAll · Fonte do evento: Do Google Sheets · Tipo: Ao editar
 *    Isso faz toda edição na planilha refletir no site em poucos segundos.
 * 6. Adicione um SEGUNDO gatilho pro caminho inverso (site → planilha):
 *      Função: pullFromSupabase · Fonte do evento: Baseado em tempo · A cada 5 minutos
 *    Isso faz edições feitas no dashboard aparecerem na planilha em até 5 minutos.
 *
 * O que fica só no dashboard (a planilha nunca mexe nisso): frente associada, prazo
 * e quem editou por último — esses campos não existem na planilha.
 * Os campos que EXISTEM nas duas pontas (Confirmado, Status, Responsável, Horário,
 * Início, Fim, Estimativa Público, dias marcados etc.) agora sincronizam nos dois
 * sentidos — quem editou por último (na planilha ou no site) é o que vale, até a
 * próxima sincronização. "Confirmado" é a coluna de status/situação da planilha
 * (antes se chamava "Situação").
 * Atividade/entidade criada direto no dashboard também gera uma linha nova na
 * planilha (via pullFromSupabase) — não fica só no banco.
 * "Início"/"Fim" são colunas de data/hora (opcionais, só pra atividades que têm
 * um período real definido) usadas no site pra detectar conflito de agenda com
 * mais precisão do que só o texto livre de "Horário".
 */

function syncAll() {
  // Se um pullFromSupabase_ estiver escrevendo na planilha agora, não reage a essa
  // escrita — evita ciclo (pull escreve → dispara "ao editar" → push manda de volta).
  if (PropertiesService.getScriptProperties().getProperty('SYNC_PULL_WRITING') === 'true') return;
  syncAtividades();
  syncDemandas();
  syncPendencias();
}

function setPullLock_(active) {
  const props = PropertiesService.getScriptProperties();
  if (active) props.setProperty('SYNC_PULL_WRITING', 'true');
  else props.deleteProperty('SYNC_PULL_WRITING');
}

// Busca no Supabase os campos que também existem na planilha e escreve de volta —
// só nas células que realmente mudaram, pra gerar o mínimo de eventos "ao editar".
function pullFromSupabase() {
  setPullLock_(true);
  try {
    pullAtividades_();
    pullDemandas_();
  } finally {
    setPullLock_(false);
  }
}

// Célula de data/hora do Sheets (Date real quando a coluna é formatada como
// data, string em outros casos) -> ISO 8601, ou '' se vazia/inválida.
function cellToIso_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

// ISO 8601 (vindo do Supabase) -> Date real pra escrever na célula, ou '' se vazio.
function isoToCell_(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d;
}

function pullAtividades_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (!sheet) return;
  const { url, key } = getConfig_();
  const fields = 'atividade,tipo,realizado_por,tipo_local,local,codigo_mapa,detalhes,publico,infraestrutura,situacao,responsavel,status,horario,dias,data_inicio,data_fim,estimativa_publico';
  const res = UrlFetchApp.fetch(`${url}/rest/v1/activities?select=${fields}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    Logger.log('Erro ao buscar activities: %s', res.getContentText());
    return;
  }
  const byName = {};
  JSON.parse(res.getContentText()).forEach((r) => (byName[r.atividade] = r));

  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = range.getDisplayValues().shift();
  values.shift();
  const col = {};
  headers.forEach((h, i) => (col[String(h || '').trim()] = i));

  const fieldMap = {
    'Tipo': 'tipo',
    'Realizado por': 'realizado_por',
    'Tipo do Local': 'tipo_local',
    'Local': 'local',
    'Cód. Mapa': 'codigo_mapa',
    'Detalhes': 'detalhes',
    'Público estimado': 'publico',
    'Infraestrutura': 'infraestrutura',
    'Confirmado': 'situacao',
    'Responsável': 'responsavel',
    'Status': 'status',
    'Horário': 'horario',
    'Estimativa Público': 'estimativa_publico',
  };
  const dateFieldMap = {
    'Início': 'data_inicio',
    'Fim': 'data_fim',
  };
  const dayMap = {
    '04/11': '2026-11-04',
    '05/11': '2026-11-05',
    '06/11': '2026-11-06',
    '07/11': '2026-11-07',
    '08/11': '2026-11-08',
  };

  const nomeCol = col['Atividade'];
  const matched = {};
  if (nomeCol != null) {
    values.forEach((row, i) => {
      const nome = String(row[nomeCol] || '').trim();
      const data = byName[nome];
      if (!data) return;
      matched[nome] = true;
      Object.keys(fieldMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        const novo = data[fieldMap[header]] || '';
        if (String(row[cIdx] || '') !== String(novo)) {
          sheet.getRange(i + 2, cIdx + 1).setValue(novo);
        }
      });
      Object.keys(dateFieldMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        const novoIso = data[dateFieldMap[header]] || '';
        if (cellToIso_(row[cIdx]) !== novoIso) {
          sheet.getRange(i + 2, cIdx + 1).setValue(isoToCell_(novoIso));
        }
      });
      Object.keys(dayMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        const novo = !!(data.dias && data.dias[dayMap[header]]);
        if (isTrue_(row[cIdx]) !== novo) {
          sheet.getRange(i + 2, cIdx + 1).setValue(novo);
        }
      });
    });
  }

  // Atividade criada no dashboard (não existia na planilha ainda): acrescenta
  // como linha nova, senão ela nunca aparece na planilha.
  if (nomeCol != null) {
    const width = headers.length;
    Object.keys(byName).forEach((nome) => {
      if (matched[nome] || !nome.trim()) return;
      const data = byName[nome];
      const newRow = new Array(width).fill('');
      newRow[nomeCol] = nome;
      Object.keys(fieldMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        newRow[cIdx] = data[fieldMap[header]] || '';
      });
      Object.keys(dateFieldMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        newRow[cIdx] = isoToCell_(data[dateFieldMap[header]] || '');
      });
      Object.keys(dayMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        newRow[cIdx] = !!(data.dias && data.dias[dayMap[header]]);
      });
      sheet.appendRow(newRow);
    });
  }
}

function pullDemandas_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[1];
  if (!sheet) return;
  const { url, key } = getConfig_();
  const res = UrlFetchApp.fetch(`${url}/rest/v1/demands?select=entidade,necessidade,proposta`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    Logger.log('Erro ao buscar demands: %s', res.getContentText());
    return;
  }
  const byName = {};
  JSON.parse(res.getContentText()).forEach((r) => (byName[r.entidade] = r));

  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = range.getDisplayValues().shift();
  values.shift();
  const col = {};
  headers.forEach((h, i) => (col[String(h || '').trim()] = i));

  const fieldMap = {
    'Necessidade de espaço': 'necessidade',
    'Proposta de atividades na INVENTUM': 'proposta',
  };

  const nomeCol = col['Entidade'];
  const matched = {};
  if (nomeCol != null) {
    values.forEach((row, i) => {
      const nome = String(row[nomeCol] || '').trim();
      const data = byName[nome];
      if (!data) return;
      matched[nome] = true;
      Object.keys(fieldMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        const novo = data[fieldMap[header]] || '';
        if (String(row[cIdx] || '') !== String(novo)) {
          sheet.getRange(i + 2, cIdx + 1).setValue(novo);
        }
      });
    });
  }

  // Entidade/demanda criada no dashboard (não existia na planilha ainda):
  // acrescenta como linha nova, senão ela nunca aparece na planilha.
  if (nomeCol != null) {
    const width = headers.length;
    Object.keys(byName).forEach((nome) => {
      if (matched[nome] || !nome.trim()) return;
      const data = byName[nome];
      const newRow = new Array(width).fill('');
      newRow[nomeCol] = nome;
      Object.keys(fieldMap).forEach((header) => {
        const cIdx = col[header];
        if (cIdx == null) return;
        newRow[cIdx] = data[fieldMap[header]] || '';
      });
      sheet.appendRow(newRow);
    });
  }
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em Propriedades do script.');
  }
  return { url, key };
}

function upsertRows_(table, rows, onConflict) {
  if (!rows.length) return;
  const { url, key } = getConfig_();
  const endpoint = `${url}/rest/v1/${table}?on_conflict=${onConflict}`;
  const res = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 300) {
    Logger.log('Erro ao sincronizar %s (HTTP %s): %s', table, code, res.getContentText());
  }
}

/** Lê uma aba por posição (0 = primeira aba) e devolve linhas como objetos {cabeçalho: valor}. */
function readSheetByIndex_(index) {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  const sheet = sheets[index];
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  // Cabeçalho lido como TEXTO EXIBIDO (getDisplayValues), não como valor tipado.
  // Sheets às vezes converte um cabeçalho tipo "04/11" pra um valor de Data real —
  // se lêssemos getValues() aqui, a chave deixaria de bater com o dayMap e toda
  // coluna de dia virava "não encontrado" (zerando os dias de todas as atividades).
  const rawHeaders = range.getDisplayValues().shift() || [];
  values.shift();
  const seen = {};
  const headers = rawHeaders.map((h) => {
    const key = String(h || '').trim();
    if (seen[key] == null) {
      seen[key] = 0;
      return key;
    }
    seen[key] += 1;
    return `${key}_${seen[key] + 1}`;
  });
  return values
    .filter((row) => row.some((cell) => cell !== '' && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return obj;
    });
}

function isTrue_(value) {
  return value === true || String(value).trim().toUpperCase() === 'TRUE';
}

// Aba 1 (índice 0) — ATIVIDADES.
function syncAtividades() {
  const rows = readSheetByIndex_(0);
  const dayMap = {
    '04/11': '2026-11-04',
    '05/11': '2026-11-05',
    '06/11': '2026-11-06',
    '07/11': '2026-11-07',
    '08/11': '2026-11-08',
  };
  // Trava de segurança: se nenhuma das 5 colunas de dia foi encontrada nos
  // cabeçalhos (nome mudou, aba diferente do esperado etc.), NÃO manda "dias"
  // no payload — evita zerar os dias já salvos de todas as atividades.
  const foundDayColumns = rows.length > 0 && Object.keys(dayMap).some((col) => col in rows[0]);
  const payload = rows
    .filter((r) => String(r['Atividade'] || '').trim())
    .map((r) => {
      const base = {
        atividade: String(r['Atividade'] || '').trim(),
        tipo: String(r['Tipo'] || ''),
        realizado_por: String(r['Realizado por'] || ''),
        tipo_local: String(r['Tipo do Local'] || ''),
        local: String(r['Local'] || ''),
        codigo_mapa: String(r['Cód. Mapa'] || ''),
        detalhes: String(r['Detalhes'] || ''),
        publico: String(r['Público estimado'] || ''),
        infraestrutura: String(r['Infraestrutura'] || ''),
        situacao: String(r['Confirmado'] || ''),
        responsavel: String(r['Responsável'] || ''),
        status: String(r['Status'] || ''),
        horario: String(r['Horário'] || ''),
        estimativa_publico: String(r['Estimativa Público'] || ''),
        data_inicio: cellToIso_(r['Início']) || null,
        data_fim: cellToIso_(r['Fim']) || null,
      };
      if (!foundDayColumns) return base;
      const dias = {};
      Object.keys(dayMap).forEach((col) => {
        dias[dayMap[col]] = isTrue_(r[col]);
      });
      return { ...base, dias };
    });
  if (!foundDayColumns) {
    Logger.log('Aviso: colunas de dia (04/11 etc.) não encontradas — "dias" não foi sincronizado desta vez.');
  }
  upsertRows_('activities', payload, 'atividade');
}

// Aba 2 (índice 1) — entidades / demandas.
function syncDemandas() {
  const rows = readSheetByIndex_(1);
  const payload = rows
    .filter((r) => String(r['Entidade'] || '').trim())
    .map((r) => ({
      entidade: String(r['Entidade'] || '').trim(),
      necessidade: String(r['Necessidade de espaço'] || ''),
      proposta: String(r['Proposta de atividades na INVENTUM'] || ''),
    }));
  upsertRows_('demands', payload, 'entidade');
}

// Aba "Página3" — pendências (lista de texto, uma por linha/célula).
// "Página4" NÃO entra aqui: é outra aba (ata/plano de ação com uma tabela de
// possíveis expositores), não pendências — ler por nome evita confundir as duas.
// Não manda "concluida" no payload: se já existir no banco (marcada concluída pelo
// time no site), o upsert não mexe nesse campo — só cria/atualiza o texto.
// Remove marcador de lista no início ("- ", "• ", "* ") pra não tratar a mesma
// pendência como duas diferentes só por causa do traço.
function stripBullet_(text) {
  return text.replace(/^[-•*]\s+/, '').trim();
}

function syncPendencias() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Página3');
  if (!sheet) {
    const nomes = ss.getSheets().map((s) => s.getName());
    Logger.log('Aba "Página3" não encontrada. Abas existentes: %s', JSON.stringify(nomes));
  }
  const textos = new Set();
  if (sheet) {
    sheet
      .getDataRange()
      .getValues()
      .flat()
      .forEach((cell) => {
        const texto = stripBullet_(String(cell || '').trim());
        if (texto) textos.add(texto);
      });
  }
  const payload = Array.from(textos).map((texto) => ({ texto }));
  upsertRows_('pending', payload, 'texto');
}
