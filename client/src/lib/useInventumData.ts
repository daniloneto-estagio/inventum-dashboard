import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import type { CurrentUser } from "../contexts/AuthContext";

export type Frente = { id: number; nome: string; cor: string; ordem: number };

export type AuditFields = {
  prazo: string | null;
  lastModifiedByEmail: string | null;
  lastModifiedByName: string | null;
  lastModifiedByAvatar: string | null;
  lastModifiedAt: string | null;
};

export type Activity = {
  id: number;
  atividade: string;
  tipo: string;
  realizadoPor: string;
  tipoLocal: string;
  local: string;
  codigoMapa: string;
  detalhes: string;
  publico: string;
  infraestrutura: string;
  situacao: string;
  responsavel: string;
  status: string;
  horario: string;
  dias: Record<string, boolean>;
  frenteId: number | null;
} & AuditFields;

export type Demand = { id: number; entidade: string; necessidade: string; proposta: string };
export type Pending = { id: number; texto: string; concluida: boolean } & AuditFields;

export type Sponsor = {
  id: number;
  entidade: string;
  grauInteresse: string;
  tipoPotencial: string;
  envioProposta: string;
  estandePotencial: string;
  obs: string;
  respContato: string;
  contrapartida: string;
  contato: string;
  datasContato: string;
  forma: string;
  membroGt: string;
  ideia: string;
  site: string;
  principalAtracao: string;
  obsExtra: string;
};

export type InventumData = {
  frentes: Frente[];
  activities: Activity[];
  demands: Demand[];
  pending: Pending[];
  sponsors: Sponsor[];
};

const EMPTY: InventumData = { frentes: [], activities: [], demands: [], pending: [], sponsors: [] };

function frenteFromRow(row: any): Frente {
  return { id: row.id, nome: row.nome, cor: row.cor, ordem: row.ordem };
}

function auditFromRow(row: any): AuditFields {
  return {
    prazo: row.prazo ?? null,
    lastModifiedByEmail: row.last_modified_by_email ?? null,
    lastModifiedByName: row.last_modified_by_name ?? null,
    lastModifiedByAvatar: row.last_modified_by_avatar ?? null,
    lastModifiedAt: row.last_modified_at ?? null,
  };
}

function activityFromRow(row: any): Activity {
  return {
    id: row.id,
    atividade: row.atividade,
    tipo: row.tipo,
    realizadoPor: row.realizado_por,
    tipoLocal: row.tipo_local,
    local: row.local,
    codigoMapa: row.codigo_mapa,
    detalhes: row.detalhes,
    publico: row.publico,
    infraestrutura: row.infraestrutura,
    situacao: row.situacao,
    responsavel: row.responsavel,
    status: row.status,
    horario: row.horario,
    dias: row.dias ?? {},
    frenteId: row.frente_id,
    ...auditFromRow(row),
  };
}

function activityToRow(value: Activity) {
  return {
    atividade: value.atividade,
    tipo: value.tipo,
    realizado_por: value.realizadoPor,
    tipo_local: value.tipoLocal,
    local: value.local,
    codigo_mapa: value.codigoMapa,
    detalhes: value.detalhes,
    publico: value.publico,
    infraestrutura: value.infraestrutura,
    situacao: value.situacao,
    responsavel: value.responsavel,
    status: value.status,
    horario: value.horario,
    dias: value.dias,
    frente_id: value.frenteId,
    prazo: value.prazo,
  };
}

function demandFromRow(row: any): Demand {
  return { id: row.id, entidade: row.entidade, necessidade: row.necessidade, proposta: row.proposta };
}

function pendingFromRow(row: any): Pending {
  return { id: row.id, texto: row.texto, concluida: row.concluida, ...auditFromRow(row) };
}

function pendingToRow(value: Pending) {
  return { texto: value.texto, concluida: value.concluida, prazo: value.prazo };
}

function sponsorFromRow(row: any): Sponsor {
  return {
    id: row.id,
    entidade: row.entidade,
    grauInteresse: row.grau_interesse,
    tipoPotencial: row.tipo_potencial,
    envioProposta: row.envio_proposta,
    estandePotencial: row.estande_potencial,
    obs: row.obs,
    respContato: row.resp_contato,
    contrapartida: row.contrapartida,
    contato: row.contato,
    datasContato: row.datas_contato,
    forma: row.forma,
    membroGt: row.membro_gt,
    ideia: row.ideia,
    site: row.site,
    principalAtracao: row.principal_atracao,
    obsExtra: row.obs_extra,
  };
}

async function fetchAll(): Promise<InventumData> {
  const [frentesRes, activitiesRes, demandsRes, pendingRes, sponsorsRes] = await Promise.all([
    supabase.from("frentes").select("*").order("ordem", { ascending: true }),
    supabase.from("activities").select("*").order("id", { ascending: true }),
    supabase.from("demands").select("*").order("id", { ascending: true }),
    supabase.from("pending").select("*").order("id", { ascending: true }),
    supabase.from("sponsors").select("*").order("entidade", { ascending: true }),
  ]);
  if (frentesRes.error) throw frentesRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (demandsRes.error) throw demandsRes.error;
  if (pendingRes.error) throw pendingRes.error;
  if (sponsorsRes.error) throw sponsorsRes.error;
  return {
    frentes: frentesRes.data.map(frenteFromRow),
    activities: activitiesRes.data.map(activityFromRow),
    demands: demandsRes.data.map(demandFromRow),
    pending: pendingRes.data.map(pendingFromRow),
    sponsors: sponsorsRes.data.map(sponsorFromRow),
  };
}

function stampFields(user: CurrentUser | null) {
  if (!user) return {};
  return {
    last_modified_by_email: user.email,
    last_modified_by_name: user.name,
    last_modified_by_avatar: user.avatarUrl,
    last_modified_at: new Date().toISOString(),
  };
}

export function useInventumData(user: CurrentUser | null) {
  const [data, setData] = useState<InventumData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = () => {
    fetchAll()
      .then((next) => setData(next))
      .catch((err) => setError(String(err?.message ?? err)));
  };

  useEffect(() => {
    fetchAll()
      .then((next) => setData(next))
      .catch((err) => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false));

    const scheduleRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(refetch, 200);
    };

    const channel = supabase
      .channel("inventum-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "frentes" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "demands" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "sponsors" }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const addActivity = async (value: Activity) => {
    const { error: err } = await supabase.from("activities").insert({ ...activityToRow(value), ...stampFields(user) });
    if (err) throw err;
    refetch();
  };

  const updateActivity = async (value: Activity) => {
    const { error: err } = await supabase
      .from("activities")
      .update({ ...activityToRow(value), ...stampFields(user) })
      .eq("id", value.id);
    if (err) throw err;
    refetch();
  };

  const addFrente = async (nome: string, cor: string) => {
    const ordem = data.frentes.length ? Math.max(...data.frentes.map((f) => f.ordem)) + 1 : 0;
    const { data: inserted, error: err } = await supabase
      .from("frentes")
      .insert({ nome, cor, ordem })
      .select()
      .single();
    if (err) throw err;
    refetch();
    return frenteFromRow(inserted);
  };

  const updateFrente = async (value: Frente) => {
    const { error: err } = await supabase
      .from("frentes")
      .update({ nome: value.nome, cor: value.cor, ordem: value.ordem })
      .eq("id", value.id);
    if (err) throw err;
    refetch();
  };

  const deleteFrente = async (id: number) => {
    const { error: err } = await supabase.from("frentes").delete().eq("id", id);
    if (err) throw err;
    refetch();
  };

  const reorderFrente = async (id: number, direction: "up" | "down") => {
    const ordered = [...data.frentes].sort((a, b) => a.ordem - b.ordem);
    const index = ordered.findIndex((f) => f.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[swapIndex];
    const { error: err1 } = await supabase.from("frentes").update({ ordem: b.ordem }).eq("id", a.id);
    if (err1) throw err1;
    const { error: err2 } = await supabase.from("frentes").update({ ordem: a.ordem }).eq("id", b.id);
    if (err2) throw err2;
    refetch();
  };

  const addDemand = async (value: Demand) => {
    const { error: err } = await supabase
      .from("demands")
      .insert({ entidade: value.entidade, necessidade: value.necessidade, proposta: value.proposta });
    if (err) throw err;
    refetch();
  };

  const updateDemand = async (value: Demand) => {
    const { error: err } = await supabase
      .from("demands")
      .update({ entidade: value.entidade, necessidade: value.necessidade, proposta: value.proposta })
      .eq("id", value.id);
    if (err) throw err;
    refetch();
  };

  const updatePending = async (value: Pending) => {
    const { error: err } = await supabase
      .from("pending")
      .update({ ...pendingToRow(value), ...stampFields(user) })
      .eq("id", value.id);
    if (err) throw err;
    refetch();
  };

  const togglePending = async (id: number) => {
    const current = data.pending.find((item) => item.id === id);
    if (!current) return;
    await updatePending({ ...current, concluida: !current.concluida });
  };

  const importBackup = async (next: InventumData) => {
    if (next.frentes.length) {
      const { error: err } = await supabase.from("frentes").upsert(next.frentes.map((f) => ({ id: f.id, nome: f.nome, cor: f.cor, ordem: f.ordem })));
      if (err) throw err;
    }
    if (next.activities.length) {
      const { error: err } = await supabase
        .from("activities")
        .upsert(next.activities.map((a) => ({ id: a.id, ...activityToRow(a) })));
      if (err) throw err;
    }
    if (next.demands.length) {
      const { error: err } = await supabase
        .from("demands")
        .upsert(next.demands.map((d) => ({ id: d.id, entidade: d.entidade, necessidade: d.necessidade, proposta: d.proposta })));
      if (err) throw err;
    }
    if (next.pending.length) {
      const { error: err } = await supabase
        .from("pending")
        .upsert(next.pending.map((p) => ({ id: p.id, ...pendingToRow(p) })));
      if (err) throw err;
    }
    refetch();
  };

  return {
    data,
    loading,
    error,
    addActivity,
    updateActivity,
    addFrente,
    updateFrente,
    deleteFrente,
    reorderFrente,
    addDemand,
    updateDemand,
    togglePending,
    updatePending,
    importBackup,
  };
}
