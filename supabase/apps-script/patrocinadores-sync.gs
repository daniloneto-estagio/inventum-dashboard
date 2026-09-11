/**
 * INVENTUM 2026 — sincroniza a planilha "POTENCIAIS EXPOSITORES" (aba Prospecção)
 * com a tabela `sponsors` do Supabase.
 *
 * Instalação: igual ao script da planilha de atividades (veja atividades-sync.gs).
 * Resumo:
 * 1. Extensões → Apps Script nesta planilha → cole este arquivo.
 * 2. Propriedades do script: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 * 3. Rode syncSponsors() uma vez manualmente pra carga inicial.
 * 4. Gatilho: syncSponsors · Do Google Sheets · Ao editar.
 */

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

/** Lê a primeira aba (Prospecção) e devolve linhas como objetos {cabeçalho: valor}.
 * A planilha repete a coluna "OBS" duas vezes — a segunda ocorrência vira "OBS_2". */
function readProspeccao_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
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

function syncSponsors() {
  const rows = readProspeccao_();
  const payload = rows
    .filter((r) => String(r['ENTIDADE / EMPRESA'] || '').trim())
    .map((r) => ({
      entidade: String(r['ENTIDADE / EMPRESA'] || '').trim(),
      grau_interesse: String(r['GRAU DE INTERESSE'] || ''),
      tipo_potencial: String(r['TIPO POTENCIAL'] || ''),
      envio_proposta: String(r['ENVIO PROPOSTA'] || ''),
      estande_potencial: String(r['ESTANDE POTENCIAL'] || ''),
      obs: String(r['OBS'] || ''),
      resp_contato: String(r['RESP CONTATO'] || ''),
      contrapartida: String(r['CONTRAPARTIDA'] || ''),
      contato: String(r['CONTATO'] || ''),
      datas_contato: String(r['DATAS CONTATO'] || ''),
      forma: String(r['FORMA'] || ''),
      membro_gt: String(r['MEMBRO GT'] || ''),
      ideia: String(r['IDEIA'] || ''),
      site: String(r['SITE'] || ''),
      principal_atracao: String(r['PRINCIPAL ATRAÇÃO'] || ''),
      obs_extra: String(r['OBS_2'] || ''),
    }));
  upsertRows_('sponsors', payload, 'entidade');
}
