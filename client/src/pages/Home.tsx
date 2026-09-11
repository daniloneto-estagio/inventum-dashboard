import { useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Archive,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Download,
  FileJson,
  Filter,
  Flag,
  Handshake,
  Layers3,
  LayoutDashboard,
  ListFilter,
  Loader2,
  MapPin,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "../contexts/AuthContext";
import { useInventumData, type Activity, type Demand, type Frente } from "../lib/useInventumData";
import { detectConflicts, type ConflictPair } from "../lib/conflicts";

type Tab = "overview" | "activities" | "frentes" | "demands" | "pending" | "sponsors";

function interesseTone(grau: string) {
  const normalized = grau.toLowerCase();
  if (normalized === "altissimo") return "green";
  if (normalized === "alto") return "violet";
  if (normalized === "médio" || normalized === "medio") return "amber";
  if (normalized === "baixo") return "coral";
  return "slate";
}

const eventDays = [
  { key: "2026-11-04", weekday: "QUA", label: "04 NOV" },
  { key: "2026-11-05", weekday: "QUI", label: "05 NOV" },
  { key: "2026-11-06", weekday: "SEX", label: "06 NOV" },
  { key: "2026-11-07", weekday: "SÁB", label: "07 NOV" },
  { key: "2026-11-08", weekday: "DOM", label: "08 NOV" },
];

const FRENTE_COLORS = [
  { key: "lime", hex: "#8fae3d" },
  { key: "blue", hex: "#4f83c4" },
  { key: "coral", hex: "#d9673f" },
  { key: "amber", hex: "#c99a2e" },
  { key: "violet", hex: "#8467d1" },
  { key: "teal", hex: "#3f9484" },
  { key: "rose", hex: "#c65a86" },
  { key: "slate", hex: "#64748b" },
];

function frenteHex(cor: string) {
  return FRENTE_COLORS.find((item) => item.key === cor)?.hex ?? "#64748b";
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function compactText(value: string, length = 74) {
  return value.length > length ? `${value.slice(0, length).trim()}…` : value;
}

function daysUntil(prazo: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${prazo}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatPrazo(prazo: string) {
  const [year, month, day] = prazo.split("-");
  return `${day}/${month}`;
}

function PrazoBadge({ prazo }: { prazo: string | null }) {
  if (!prazo) return <span className="type-label">Sem prazo</span>;
  const delta = daysUntil(prazo);
  const tone = delta < 0 ? "coral" : delta <= 3 ? "amber" : "slate";
  return (
    <span className={`status-pill status-${tone}`}>
      <span className="status-dot" />
      {formatPrazo(prazo)}
      {delta < 0 ? " · vencido" : delta === 0 ? " · hoje" : delta <= 3 ? ` · ${delta}d` : ""}
    </span>
  );
}

function EditedByAvatar({ name, avatarUrl, at }: { name: string | null; avatarUrl: string | null; at: string | null }) {
  if (!name) return <span className="type-label">—</span>;
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const when = at ? new Date(at).toLocaleString("pt-BR") : "";
  return (
    <span title={`Editado por ${name}${when ? ` em ${when}` : ""}`} className="avatar" style={{ overflow: "hidden" }}>
      {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </span>
  );
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("validado")) return "green";
  if (normalized.includes("licitação") || normalized.includes("orçament")) return "amber";
  if (normalized.includes("definição") || normalized.includes("análise")) return "violet";
  if (normalized.includes("estrutura") || normalized.includes("desenvolvimento")) return "coral";
  return "slate";
}

function StatusPill({ value, emptyLabel = "Sem status" }: { value: string; emptyLabel?: string }) {
  const display = value || emptyLabel;
  return (
    <span className={`status-pill status-${statusTone(value)}`}>
      <span className="status-dot" />
      {display}
    </span>
  );
}

function FrenteBadge({ frente }: { frente: Frente | undefined }) {
  const hex = frente ? frenteHex(frente.cor) : "#94a3b8";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: hex,
        background: `${hex}1a`,
        border: `1px solid ${hex}55`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: hex }} />
      {frente ? frente.nome : "Sem frente"}
    </span>
  );
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="section-title-row">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent, trend }: { label: string; value: string | number; sub: string; icon: React.ReactNode; accent: string; trend?: string }) {
  return (
    <article className={`stat-card accent-${accent}`}>
      <div className="stat-topline">
        <span className="stat-icon">{icon}</span>
        {trend ? <span className="stat-trend">{trend}</span> : null}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </article>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <Archive size={20} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function ActivityModal({
  activity,
  frentes,
  onClose,
  onSave,
  onCreateFrente,
}: {
  activity: Activity | null;
  frentes: Frente[];
  onClose: () => void;
  onSave: (value: Activity) => void;
  onCreateFrente: (nome: string) => Promise<Frente>;
}) {
  const [form, setForm] = useState<Activity>(() => activity ?? {
    id: 0,
    atividade: "",
    tipo: "Mostra",
    realizadoPor: "",
    tipoLocal: "Interno",
    local: "",
    codigoMapa: "",
    detalhes: "",
    publico: "",
    infraestrutura: "",
    situacao: "Em Análise",
    responsavel: "",
    status: "Em definição",
    horario: "",
    dias: Object.fromEntries(eventDays.map((day) => [day.key, false])),
    frenteId: null,
    prazo: null,
    lastModifiedByEmail: null,
    lastModifiedByName: null,
    lastModifiedByAvatar: null,
    lastModifiedAt: null,
  });
  const [newFrenteName, setNewFrenteName] = useState("");
  const [showNewFrente, setShowNewFrente] = useState(false);
  const [savingFrente, setSavingFrente] = useState(false);

  const update = (key: keyof Activity, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggleDay = (key: string) => setForm((current) => ({ ...current, dias: { ...current.dias, [key]: !current.dias[key] } }));

  const createFrente = async () => {
    const nome = newFrenteName.trim();
    if (!nome) return;
    setSavingFrente(true);
    try {
      const created = await onCreateFrente(nome);
      setForm((current) => ({ ...current, frenteId: created.id }));
      setNewFrenteName("");
      setShowNewFrente(false);
      toast.success("Frente criada e associada");
    } catch (err) {
      toast.error("Não foi possível criar a frente");
    } finally {
      setSavingFrente(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card large-modal" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title">
        <div className="modal-header">
          <div>
            <div className="eyebrow">{activity ? "Atualizar registro" : "Novo registro"}</div>
            <h3 id="activity-modal-title">{activity ? "Editar atividade" : "Adicionar atividade"}</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label className="field field-span-2"><span>Atividade</span><input autoFocus value={form.atividade} onChange={(e) => update("atividade", e.target.value)} placeholder="Ex.: Oficina de inovação" /></label>
          <label className="field"><span>Tipo</span><select value={form.tipo} onChange={(e) => update("tipo", e.target.value)}><option>Mostra</option><option>Experiência</option><option>Oficina</option><option>Palestra</option><option>Competição</option><option>Institucional</option></select></label>
          <div className="field">
            <span>Frente de atuação</span>
            <select
              value={form.frenteId ?? ""}
              onChange={(e) => {
                if (e.target.value === "__new__") { setShowNewFrente(true); return; }
                setForm((current) => ({ ...current, frenteId: e.target.value ? Number(e.target.value) : null }));
              }}
            >
              <option value="">Sem frente</option>
              {frentes.map((frente) => <option key={frente.id} value={frente.id}>{frente.nome}</option>)}
              <option value="__new__">+ nova frente…</option>
            </select>
            {showNewFrente ? (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input
                  autoFocus
                  value={newFrenteName}
                  onChange={(e) => setNewFrenteName(e.target.value)}
                  placeholder="Nome da nova frente"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createFrente())}
                />
                <button type="button" className="button button-dark" disabled={savingFrente} onClick={createFrente}>Criar</button>
              </div>
            ) : null}
          </div>
          <label className="field"><span>Situação</span><select value={form.situacao} onChange={(e) => update("situacao", e.target.value)}><option>Confirmado</option><option>Em Análise</option></select></label>
          <label className="field"><span>Status operacional</span><input value={form.status} onChange={(e) => update("status", e.target.value)} placeholder="Ex.: Validado" /></label>
          <label className="field"><span>Horário</span><input value={form.horario} onChange={(e) => update("horario", e.target.value)} placeholder="Tempo todo ou faixa horária" /></label>
          <label className="field"><span>Prazo</span><input type="date" value={form.prazo ?? ""} onChange={(e) => setForm((current) => ({ ...current, prazo: e.target.value || null }))} /></label>
          <label className="field field-span-2"><span>Local</span><input value={form.local} onChange={(e) => update("local", e.target.value)} placeholder="Centro de Eventos / área externa" /></label>
          <label className="field"><span>Tipo do local</span><input value={form.tipoLocal} onChange={(e) => update("tipoLocal", e.target.value)} placeholder="Interno" /></label>
          <label className="field"><span>Cód. mapa</span><input value={form.codigoMapa} onChange={(e) => update("codigoMapa", e.target.value)} placeholder="Ex.: 77, 78" /></label>
          <label className="field"><span>Realizado por</span><input value={form.realizadoPor} onChange={(e) => update("realizadoPor", e.target.value)} /></label>
          <label className="field"><span>Responsável</span><input value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} /></label>
          <label className="field field-span-2"><span>Detalhes</span><textarea rows={3} value={form.detalhes} onChange={(e) => update("detalhes", e.target.value)} /></label>
          <label className="field field-span-2"><span>Público estimado</span><input value={form.publico} onChange={(e) => update("publico", e.target.value)} /></label>
          <label className="field field-span-2"><span>Infraestrutura</span><textarea rows={2} value={form.infraestrutura} onChange={(e) => update("infraestrutura", e.target.value)} /></label>
          <div className="field field-span-2"><span>Dias previstos</span><div className="day-selector">{eventDays.map((day) => <button key={day.key} type="button" className={form.dias[day.key] ? "selected" : ""} onClick={() => toggleDay(day.key)}><b>{day.weekday}</b><small>{day.label}</small></button>)}</div></div>
        </div>
        <div className="modal-footer"><button className="button button-ghost" onClick={onClose}>Cancelar</button><button className="button button-dark" onClick={() => form.atividade.trim() ? onSave({ ...form, atividade: form.atividade.trim() }) : toast.error("Informe o nome da atividade")}>{activity ? "Salvar alterações" : "Adicionar atividade"}<ArrowUpRight size={16} /></button></div>
      </div>
    </div>
  );
}

function DemandModal({ demand, onClose, onSave }: { demand: Demand | null; onClose: () => void; onSave: (value: Demand) => void }) {
  const [form, setForm] = useState<Demand>(() => demand ?? { id: 0, entidade: "", necessidade: "", proposta: "" });
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="demand-modal-title">
        <div className="modal-header"><div><div className="eyebrow">{demand ? "Atualizar registro" : "Novo registro"}</div><h3 id="demand-modal-title">{demand ? "Editar demanda" : "Adicionar entidade"}</h3></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
        <div className="form-stack">
          <label className="field"><span>Entidade</span><input autoFocus value={form.entidade} onChange={(e) => setForm({ ...form, entidade: e.target.value })} /></label>
          <label className="field"><span>Necessidade de espaço</span><textarea rows={4} value={form.necessidade} onChange={(e) => setForm({ ...form, necessidade: e.target.value })} /></label>
          <label className="field"><span>Proposta de atividades</span><textarea rows={5} value={form.proposta} onChange={(e) => setForm({ ...form, proposta: e.target.value })} /></label>
        </div>
        <div className="modal-footer"><button className="button button-ghost" onClick={onClose}>Cancelar</button><button className="button button-dark" onClick={() => form.entidade.trim() ? onSave({ ...form, entidade: form.entidade.trim() }) : toast.error("Informe a entidade")}>Salvar registro<ArrowUpRight size={16} /></button></div>
      </div>
    </div>
  );
}

function FrentesManager({
  frentes,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: {
  frentes: Frente[];
  onAdd: (nome: string, cor: string) => Promise<unknown>;
  onUpdate: (value: Frente) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  onReorder: (id: number, direction: "up" | "down") => Promise<unknown>;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const ordered = [...frentes].sort((a, b) => a.ordem - b.ordem);

  const addFrente = async () => {
    const nome = newName.trim();
    if (!nome) return;
    const cor = FRENTE_COLORS[frentes.length % FRENTE_COLORS.length].key;
    try {
      await onAdd(nome, cor);
      setNewName("");
      toast.success("Frente criada");
    } catch {
      toast.error("Não foi possível criar a frente");
    }
  };

  const saveName = async (frente: Frente) => {
    const nome = editingName.trim();
    if (!nome || nome === frente.nome) { setEditingId(null); return; }
    try {
      await onUpdate({ ...frente, nome });
      toast.success("Frente atualizada");
    } catch {
      toast.error("Não foi possível atualizar a frente");
    } finally {
      setEditingId(null);
    }
  };

  const removeFrente = async (frente: Frente) => {
    if (!window.confirm(`Excluir a frente "${frente.nome}"? As atividades associadas ficam sem frente.`)) return;
    try {
      await onDelete(frente.id);
      toast.success("Frente removida");
    } catch {
      toast.error("Não foi possível remover a frente");
    }
  };

  return (
    <section className="content-section">
      <SectionTitle
        eyebrow="ORGANIZAÇÃO"
        title="Frentes de atuação"
        description="Crie, renomeie, recolora e reordene as frentes (ex.: Competições e Caravanas, INFRA) usadas para agrupar as atividades."
      />
      <div className="table-panel">
        <div className="table-scroll">
          {ordered.length === 0 ? (
            <EmptyState title="Nenhuma frente cadastrada" description="Adicione a primeira frente abaixo." />
          ) : (
            <table>
              <thead><tr><th /><th>Nome</th><th>Cor</th><th /></tr></thead>
              <tbody>
                {ordered.map((frente, index) => (
                  <tr key={frente.id}>
                    <td style={{ width: 64 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="icon-button subtle" disabled={index === 0} onClick={() => onReorder(frente.id, "up")} aria-label="Mover para cima">↑</button>
                        <button className="icon-button subtle" disabled={index === ordered.length - 1} onClick={() => onReorder(frente.id, "down")} aria-label="Mover para baixo">↓</button>
                      </div>
                    </td>
                    <td>
                      {editingId === frente.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => saveName(frente)}
                          onKeyDown={(e) => e.key === "Enter" && saveName(frente)}
                        />
                      ) : (
                        <button className="text-button" onClick={() => { setEditingId(frente.id); setEditingName(frente.nome); }}>
                          <FrenteBadge frente={frente} />
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {FRENTE_COLORS.map((color) => (
                          <button
                            key={color.key}
                            onClick={() => onUpdate({ ...frente, cor: color.key })}
                            aria-label={color.key}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: color.hex,
                              border: frente.cor === color.key ? "2px solid var(--navy)" : "1px solid rgba(0,0,0,.1)",
                              cursor: "pointer",
                            }}
                          />
                        ))}
                      </div>
                    </td>
                    <td style={{ width: 48 }}>
                      <button className="icon-button subtle" onClick={() => removeFrente(frente)} aria-label={`Excluir ${frente.nome}`}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderTop: "1px solid var(--line)" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nova frente (ex.: INFRA)"
            onKeyDown={(e) => e.key === "Enter" && addFrente()}
            style={{ flex: 1 }}
          />
          <button className="button button-dark" onClick={addFrente}><Plus size={16} /> Adicionar frente</button>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user, signOut } = useAuth();
  const {
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
  } = useInventumData(user);

  const [tab, setTab] = useState<Tab>("overview");
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos os status");
  const [typeFilter, setTypeFilter] = useState("Todos os tipos");
  const [locationFilter, setLocationFilter] = useState("Todos os locais");
  const [dayFilter, setDayFilter] = useState("Todos os dias");
  const [situationFilter, setSituationFilter] = useState("Todas as situações");
  const [frenteFilter, setFrenteFilter] = useState("all");
  const [activityEditor, setActivityEditor] = useState<Activity | null | undefined>(undefined);
  const [demandEditor, setDemandEditor] = useState<Demand | null | undefined>(undefined);
  const [mobileNav, setMobileNav] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const frenteById = useMemo(() => new Map(data.frentes.map((f) => [f.id, f])), [data.frentes]);

  const types = useMemo(() => ["Todos os tipos", ...Array.from(new Set(data.activities.map((item) => item.tipo).filter(Boolean))).sort()], [data.activities]);
  const statuses = useMemo(() => ["Todos os status", ...Array.from(new Set(data.activities.map((item) => item.status).filter(Boolean))).sort()], [data.activities]);
  const locations = useMemo(() => ["Todos os locais", ...Array.from(new Set(data.activities.map((item) => item.local).filter(Boolean))).sort()], [data.activities]);
  const situations = ["Todas as situações", "Confirmado", "Em Análise"];
  const days = ["Todos os dias", ...eventDays.map((day) => `${day.label} — ${day.weekday}`)];
  const frenteFilterOptions = useMemo(() => [
    { value: "all", label: "Todas as frentes" },
    { value: "none", label: "Sem frente" },
    ...data.frentes.map((f) => ({ value: String(f.id), label: f.nome })),
  ], [data.frentes]);

  const filteredActivities = useMemo(() => {
    const term = search.toLocaleLowerCase();
    return data.activities.filter((item) => {
      const searchable = `${item.atividade} ${item.local} ${item.realizadoPor} ${item.tipo} ${item.status}`.toLocaleLowerCase();
      const matchesSearch = !term || searchable.includes(term);
      const matchesStatus = statusFilter === "Todos os status" || item.status === statusFilter;
      const matchesType = typeFilter === "Todos os tipos" || item.tipo === typeFilter;
      const matchesLocation = locationFilter === "Todos os locais" || item.local === locationFilter;
      const matchesSituation = situationFilter === "Todas as situações" || item.situacao === situationFilter;
      const matchesFrente = frenteFilter === "all" || (frenteFilter === "none" ? item.frenteId === null : item.frenteId === Number(frenteFilter));
      const selectedDay = eventDays.find((day) => `${day.label} — ${day.weekday}` === dayFilter);
      const matchesDay = !selectedDay || Boolean(item.dias[selectedDay.key]);
      return matchesSearch && matchesStatus && matchesType && matchesLocation && matchesSituation && matchesFrente && matchesDay;
    });
  }, [data.activities, search, statusFilter, typeFilter, locationFilter, dayFilter, situationFilter, frenteFilter]);

  const stats = useMemo(() => {
    const confirmed = data.activities.filter((item) => item.situacao === "Confirmado").length;
    const valid = data.activities.filter((item) => item.status === "Validado").length;
    const activeDays = eventDays.map((day) => ({ ...day, count: data.activities.filter((item) => item.dias[day.key]).length }));
    const byType = Array.from(new Set(data.activities.map((item) => item.tipo).filter(Boolean))).map((type) => ({ type, count: data.activities.filter((item) => item.tipo === type).length })).sort((a, b) => b.count - a.count);
    const byStatus = Array.from(new Set(data.activities.map((item) => item.status || "Sem status"))).map((status) => ({ status, count: data.activities.filter((item) => (item.status || "Sem status") === status).length })).sort((a, b) => b.count - a.count);
    const byFrente = [
      ...data.frentes.map((frente) => ({ label: frente.nome, count: data.activities.filter((item) => item.frenteId === frente.id).length })),
      { label: "Sem frente", count: data.activities.filter((item) => item.frenteId === null).length },
    ].sort((a, b) => b.count - a.count);
    return { confirmed, valid, activeDays, byType, byStatus, byFrente };
  }, [data.activities, data.frentes]);

  const conflicts = useMemo(() => detectConflicts(data.activities), [data.activities]);

  const conflictsByActivity = useMemo(() => {
    const map = new Map<number, ConflictPair[]>();
    conflicts.forEach((pair) => {
      map.set(pair.a.id, [...(map.get(pair.a.id) ?? []), pair]);
      map.set(pair.b.id, [...(map.get(pair.b.id) ?? []), pair]);
    });
    return map;
  }, [conflicts]);

  const notifications = useMemo(() => {
    const matchesUser = (responsavel: string) => {
      if (!user) return false;
      const term = responsavel.toLocaleLowerCase();
      return Boolean(term) && (term.includes(user.name.toLocaleLowerCase()) || term.includes(user.email.toLocaleLowerCase()));
    };
    const activityItems = data.activities
      .filter((item) => item.prazo && daysUntil(item.prazo) <= 3)
      .filter((item) => !onlyMine || matchesUser(item.responsavel))
      .map((item) => ({ kind: "activity" as const, id: item.id, title: item.atividade, prazo: item.prazo as string }));
    const pendingItems = data.pending
      .filter((item) => item.prazo && !item.concluida && daysUntil(item.prazo) <= 3)
      .map((item) => ({ kind: "pending" as const, id: item.id, title: item.texto, prazo: item.prazo as string }));
    return [...(onlyMine ? [] : pendingItems), ...activityItems].sort((a, b) => a.prazo.localeCompare(b.prazo));
  }, [data.activities, data.pending, onlyMine, user]);

  const saveActivity = async (value: Activity) => {
    try {
      if (value.id) await updateActivity(value); else await addActivity(value);
      setActivityEditor(undefined);
      toast.success(value.id ? "Atividade atualizada" : "Atividade adicionada");
    } catch {
      toast.error("Não foi possível salvar a atividade");
    }
  };

  const saveDemand = async (value: Demand) => {
    try {
      if (value.id) await updateDemand(value); else await addDemand(value);
      setDemandEditor(undefined);
      toast.success(value.id ? "Demanda atualizada" : "Demanda adicionada");
    } catch {
      toast.error("Não foi possível salvar a demanda");
    }
  };

  const exportJson = () => {
    downloadFile("inventum-2026-backup.json", JSON.stringify(data, null, 2), "application/json");
    toast.success("Backup JSON exportado");
  };

  const exportCsv = () => {
    const headers = ["Atividade", "Frente", "Tipo", "Realizado por", "Tipo do local", "Local", "Cód. mapa", "Situação", "Status", "Horário", ...eventDays.map((day) => day.label)];
    const rows = data.activities.map((item) => [
      item.atividade,
      item.frenteId ? frenteById.get(item.frenteId)?.nome ?? "" : "",
      item.tipo,
      item.realizadoPor,
      item.tipoLocal,
      item.local,
      item.codigoMapa,
      item.situacao,
      item.status,
      item.horario,
      ...eventDays.map((day) => item.dias[day.key] ? "Sim" : "Não"),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadFile("inventum-2026-atividades.csv", `﻿${csv}`, "text/csv;charset=utf-8");
    toast.success("Atividades exportadas em CSV");
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.activities) || !Array.isArray(parsed.demands) || !Array.isArray(parsed.pending)) throw new Error("Formato inválido");
        await importBackup({ frentes: parsed.frentes ?? [], activities: parsed.activities, demands: parsed.demands, pending: parsed.pending, sponsors: parsed.sponsors ?? [] });
        toast.success("Backup importado com sucesso");
      } catch {
        toast.error("Não foi possível importar este arquivo");
      }
    };
    reader.readAsText(file);
  };

  const navItems: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Visão geral", icon: <LayoutDashboard size={17} /> },
    { id: "activities", label: "Atividades", icon: <ActivityIcon size={17} />, count: data.activities.length },
    { id: "frentes", label: "Frentes", icon: <Flag size={17} />, count: data.frentes.length },
    { id: "demands", label: "Entidades & demandas", icon: <Building2 size={17} />, count: data.demands.length },
    { id: "pending", label: "Pendências", icon: <Target size={17} />, count: data.pending.filter((item) => !item.concluida).length },
    { id: "sponsors", label: "Patrocinadores", icon: <Handshake size={17} />, count: data.sponsors.length },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", gap: 12 }}>
        <Loader2 size={28} className="animate-spin" />
        <span>Carregando dados da INVENTUM…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <AlertCircle size={28} />
        <strong>Não foi possível carregar os dados</strong>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span>IN</span><i /></div>
          <div><strong>INVENTUM</strong><small>2026 · operação</small></div>
        </div>
        <div className="sidebar-label">Painel de controle</div>
        <nav className="side-nav">{navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setMobileNav(false); }}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.count !== undefined ? <em>{item.count}</em> : null}</button>)}</nav>
        <div className="sidebar-rule" />
        <div className="sidebar-label">Base de dados</div>
        <div className="sidebar-actions">
          <button onClick={exportCsv}><Download size={16} /> Exportar CSV</button>
          <button onClick={exportJson}><FileJson size={16} /> Exportar backup</button>
          <button onClick={() => fileInput.current?.click()}><Upload size={16} /> Importar backup</button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && importJson(event.target.files[0])} />
        </div>
        <div className="sidebar-bottom"><div className="sync-badge"><span className="live-dot" />Sincronizado com a equipe</div><button className="profile-row" onClick={() => window.confirm("Sair da conta?") && signOut()}><span className="avatar" style={{ overflow: "hidden" }}>{user?.avatarUrl ? <img src={user.avatarUrl} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (user?.name.slice(0, 2).toUpperCase() ?? "OP")}</span><span><b>{user?.name ?? "Operação"}</b><small>{user?.email ?? "INVENTUM 2026"}</small></span><MoreHorizontal size={16} /></button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir menu"><Menu size={21} /></button><div className="breadcrumb"><span>INVENTUM 2026</span><ChevronDown size={14} /><b>{navItems.find((item) => item.id === tab)?.label}</b></div><div className="topbar-actions"><span className="date-chip"><CalendarDays size={15} /> 04 — 08 NOV 2026</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="top-icon" aria-label="Notificações"><Bell size={17} />{notifications.length > 0 ? <i /> : null}</button>
            </PopoverTrigger>
            <PopoverContent align="end" style={{ background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 12, padding: 0, width: 320 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
                <strong style={{ fontSize: 12, color: "var(--ink)" }}>Prazos próximos</strong>
                <button className="filter-toggle" style={onlyMine ? { background: "#edf3c9", borderColor: "#d9eaa1", color: "#4c6736" } : undefined} onClick={() => setOnlyMine((value) => !value)}>Somente minhas</button>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: "18px 14px", fontSize: 11, color: "#9aa3a1" }}>Nenhum prazo vencido ou próximo.</div>
                ) : notifications.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    onClick={() => setTab(item.kind === "activity" ? "activities" : "pending")}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 14px", borderBottom: "1px solid #eeeae2", background: "transparent" }}
                  >
                    <span style={{ flex: 1, fontSize: 11, color: "#56666b" }}>{compactText(item.title, 46)}</span>
                    <PrazoBadge prazo={item.prazo} />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button className="top-icon"><Settings2 size={17} /></button></div></header>

        <div className="page-content">
          {tab === "overview" ? <>
            <div className="hero-row"><div><div className="eyebrow">CENTRO DE COMANDO · ATUALIZAÇÃO PRELIMINAR</div><h1>Visão geral <span>da operação.</span></h1><p className="hero-copy">Uma leitura rápida do que está confirmado, do que está em movimento e do que ainda precisa de decisão.</p></div><div className="hero-actions"><button className="button button-dark" onClick={() => setActivityEditor(null)}><Plus size={16} /> Nova atividade</button></div></div>
            {conflicts.length > 0 ? (
              <div className="conflict-banner">
                <div className="conflict-banner-head"><AlertTriangle size={16} /><strong>{conflicts.length} conflito{conflicts.length > 1 ? "s" : ""} de agenda detectado{conflicts.length > 1 ? "s" : ""}</strong></div>
                <div className="conflict-list">
                  {conflicts.map((pair, index) => {
                    const day = eventDays.find((d) => d.key === pair.dayKey);
                    return (
                      <button className="conflict-row" key={`${pair.a.id}-${pair.b.id}-${pair.dayKey}-${index}`} onClick={() => { setTab("activities"); setLocationFilter(pair.a.local); }}>
                        <span><b>{pair.a.atividade}</b> e <b>{pair.b.atividade}</b></span>
                        <span className="conflict-meta">{pair.a.local} · {day ? `${day.label} ${day.weekday}` : pair.dayKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="kpi-grid"><StatCard label="Atividades mapeadas" value={data.activities.length} sub="na programação preliminar" icon={<Layers3 size={18} />} accent="lime" trend="base" /><StatCard label="Confirmadas" value={`${percent(stats.confirmed, data.activities.length)}%`} sub={`${stats.confirmed} atividades com situação confirmada`} icon={<CheckCircle2 size={18} />} accent="blue" trend="+12%" /><StatCard label="Em análise" value={data.activities.length - stats.confirmed} sub="dependem de validação ou definição" icon={<Clock3 size={18} />} accent="coral" trend="atenção" /><StatCard label="Pendências abertas" value={data.pending.filter((item) => !item.concluida).length} sub={`${data.pending.filter((item) => item.concluida).length} resolvidas até agora`} icon={<Target size={18} />} accent="amber" trend="ação" /></div>
            <div className="dashboard-grid overview-grid">
              <section className="panel span-7"><div className="panel-heading"><div><div className="eyebrow">DISTRIBUIÇÃO</div><h3>Atividades por tipo</h3></div><span className="panel-note">{stats.byType.length} categorias</span></div><div className="bar-chart">{stats.byType.slice(0, 6).map((item, index) => <div className="bar-row" key={item.type}><div className="bar-label"><span>{item.type || "Sem tipo"}</span><b>{item.count}</b></div><div className="bar-track"><div className={`bar-fill fill-${index + 1}`} style={{ width: `${Math.max(7, percent(item.count, data.activities.length))}%` }} /></div></div>)}</div><div className="chart-footer"><span><i className="legend-dot lime" />Maior concentração: <b>{stats.byType[0]?.type || "—"}</b></span><button className="text-button" onClick={() => setTab("activities")}>Ver todas <ArrowUpRight size={14} /></button></div></section>
              <section className="panel span-5 accent-panel"><div className="panel-heading"><div><div className="eyebrow">COBERTURA</div><h3>Presença por dia</h3></div><CalendarDays size={18} className="panel-icon" /></div><div className="day-bars">{stats.activeDays.map((day) => <div className="day-bar-row" key={day.key}><div className="day-key"><b>{day.weekday}</b><span>{day.label}</span></div><div className="day-track"><div style={{ width: `${Math.max(4, percent(day.count, Math.max(...stats.activeDays.map((item) => item.count))))}%` }} /></div><strong>{day.count}</strong></div>)}</div><div className="coverage-callout"><Sparkles size={15} /><span><b>{Math.max(...stats.activeDays.map((item) => item.count))} atividades</b> no dia de maior cobertura.</span></div></section>
              <section className="panel span-7"><div className="panel-heading"><div><div className="eyebrow">FLUXO DE VALIDAÇÃO</div><h3>Próximos movimentos</h3></div><span className="panel-note">status atuais</span></div><div className="status-summary">{stats.byStatus.slice(0, 5).map((item) => <div className="status-summary-row" key={item.status}><div className="status-summary-label"><span className={`status-marker marker-${statusTone(item.status)}`} /><span>{item.status}</span><b>{item.count}</b></div><div className="status-progress"><div className={`progress-fill progress-${statusTone(item.status)}`} style={{ width: `${percent(item.count, data.activities.length)}%` }} /></div></div>)}</div><div className="chart-footer"><span><i className="legend-dot violet" />{stats.valid} registros já <b>validados</b></span><button className="text-button" onClick={() => setTab("activities")}>Abrir matriz <ArrowUpRight size={14} /></button></div></section>
              <section className="panel span-5 pending-panel"><div className="panel-heading"><div><div className="eyebrow">AÇÃO NECESSÁRIA</div><h3>Pendências abertas</h3></div><button className="mini-link" onClick={() => setTab("pending")}>Ver lista <ArrowUpRight size={13} /></button></div>{data.pending.filter((item) => !item.concluida).slice(0, 4).map((item) => <button className="pending-preview" key={item.id} onClick={() => setTab("pending")}><span className="pending-index">{String(item.id).padStart(2, "0")}</span><span>{compactText(item.texto, 63)}</span><ArrowUpRight size={14} /></button>)}{data.pending.every((item) => item.concluida) ? <EmptyState title="Tudo em dia" description="Nenhuma pendência aberta." /> : null}</section>
              <section className="panel" style={{ gridColumn: "span 12" }}>
                <div className="panel-heading"><div><div className="eyebrow">ORGANIZAÇÃO</div><h3>Atividades por frente</h3></div><span className="panel-note">{data.frentes.length} frentes cadastradas</span></div>
                <div className="bar-chart">
                  {stats.byFrente.filter((item) => item.count > 0).map((item, index) => (
                    <div className="bar-row" key={item.label}>
                      <div className="bar-label"><span>{item.label}</span><b>{item.count}</b></div>
                      <div className="bar-track"><div className={`bar-fill fill-${(index % 6) + 1}`} style={{ width: `${Math.max(7, percent(item.count, data.activities.length))}%` }} /></div>
                    </div>
                  ))}
                  {stats.byFrente.every((item) => item.count === 0) ? <EmptyState title="Nenhuma frente em uso" description="Associe atividades a frentes na aba Atividades." /> : null}
                </div>
                <div className="chart-footer"><span />
                  <button className="text-button" onClick={() => setTab("frentes")}>Gerenciar frentes <ArrowUpRight size={14} /></button>
                </div>
              </section>
            </div>
          </> : null}

          {tab === "activities" ? <section className="content-section"><SectionTitle eyebrow="MATRIZ OPERACIONAL" title="Atividades" description="Edite os registros da programação e acompanhe a situação de cada entrega." action={<button className="button button-dark" onClick={() => setActivityEditor(null)}><Plus size={16} /> Nova atividade</button>} /><div className="filter-bar"><div className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar atividade, local ou entidade…" /></div><div className="select-wrap"><Filter size={15} /><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>{types.map((type) => <option key={type}>{type}</option>)}</select></div><div className="select-wrap"><Flag size={15} /><select value={frenteFilter} onChange={(e) => setFrenteFilter(e.target.value)}>{frenteFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="select-wrap"><MapPin size={15} /><select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>{locations.map((location) => <option key={location}>{location}</option>)}</select></div><div className="select-wrap"><CalendarDays size={15} /><select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>{days.map((day) => <option key={day}>{day}</option>)}</select></div><div className="select-wrap"><CircleDot size={15} /><select value={situationFilter} onChange={(e) => setSituationFilter(e.target.value)}>{situations.map((situation) => <option key={situation}>{situation}</option>)}</select></div><div className="select-wrap"><ListFilter size={15} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>{(search || statusFilter !== "Todos os status" || typeFilter !== "Todos os tipos" || locationFilter !== "Todos os locais" || dayFilter !== "Todos os dias" || situationFilter !== "Todas as situações" || frenteFilter !== "all") ? <button className="clear-filter" onClick={() => { setSearch(""); setStatusFilter("Todos os status"); setTypeFilter("Todos os tipos"); setLocationFilter("Todos os locais"); setDayFilter("Todos os dias"); setSituationFilter("Todas as situações"); setFrenteFilter("all"); }}>Limpar</button> : null}</div><div className="table-panel"><div className="table-meta"><span><b>{filteredActivities.length}</b> de {data.activities.length} atividades</span><span className="table-hint"><Pencil size={13} /> Clique em editar para atualizar a base</span></div><div className="table-scroll"><table><thead><tr><th>Atividade</th><th>Frente</th><th>Tipo</th><th>Local</th><th>Dias</th><th>Prazo</th><th>Situação</th><th>Status operacional</th><th>Editado por</th><th /></tr></thead><tbody>{filteredActivities.map((item) => <tr key={item.id}><td><div className="activity-cell"><span className="activity-bullet" /><div><b>{item.atividade}</b><small>{item.realizadoPor || "Realizador não informado"}</small></div></div></td><td><FrenteBadge frente={item.frenteId ? frenteById.get(item.frenteId) : undefined} /></td><td><span className="type-label">{item.tipo || "—"}</span></td><td><div className="location-cell"><MapPin size={13} /><span>{compactText(item.local || "Local a definir", 36)}</span>{conflictsByActivity.has(item.id) ? <span title={`Conflito de horário e local com ${conflictsByActivity.get(item.id)!.length} atividade(s)`}><AlertTriangle size={13} className="conflict-icon" /></span> : null}</div></td><td><div className="day-mini-list">{eventDays.map((day) => <span key={day.key} className={item.dias[day.key] ? "on" : ""}>{day.weekday.slice(0, 1)}</span>)}</div></td><td><PrazoBadge prazo={item.prazo} /></td><td><span className={`situation-tag ${item.situacao === "Confirmado" ? "confirmed" : "analysis"}`}>{item.situacao || "Sem situação"}</span></td><td><StatusPill value={item.status} /></td><td><EditedByAvatar name={item.lastModifiedByName} avatarUrl={item.lastModifiedByAvatar} at={item.lastModifiedAt} /></td><td><button className="row-edit" onClick={() => setActivityEditor(item)}><Pencil size={14} /> Editar</button></td></tr>)}</tbody></table>{filteredActivities.length === 0 ? <EmptyState title="Nenhum registro encontrado" description="Ajuste os filtros para ampliar a busca." /> : null}</div></div></section> : null}

          {tab === "frentes" ? (
            <FrentesManager
              frentes={data.frentes}
              onAdd={addFrente}
              onUpdate={updateFrente}
              onDelete={deleteFrente}
              onReorder={reorderFrente}
            />
          ) : null}

          {tab === "demands" ? <section className="content-section"><SectionTitle eyebrow="MAPA DE ARTICULAÇÃO" title="Entidades & demandas" description="Centralize o que cada parceiro precisa e o que está sendo proposto para a INVENTUM." action={<button className="button button-dark" onClick={() => setDemandEditor(null)}><Plus size={16} /> Nova entidade</button>} /><div className="demand-intro"><div className="demand-intro-icon"><Users size={22} /></div><div><strong>{data.demands.length} entidades mapeadas</strong><span>Necessidades de espaço e propostas de atividades extraídas da aba Página2.</span></div><div className="intro-stat"><b>{data.demands.filter((item) => item.proposta).length}</b><span>com proposta registrada</span></div></div><div className="demand-grid">{data.demands.map((item, index) => <article className="demand-card" key={item.id}><div className="demand-card-top"><span className="demand-number">{String(index + 1).padStart(2, "0")}</span><span className="entity-avatar">{item.entidade.slice(0, 2).toUpperCase()}</span><button className="icon-button subtle" onClick={() => setDemandEditor(item)} aria-label={`Editar ${item.entidade}`}><Pencil size={15} /></button></div><h3>{item.entidade}</h3><div className="demand-block"><span className="block-label">Necessidade de espaço</span><p>{item.necessidade || "Não informado"}</p></div><div className="demand-block proposal"><span className="block-label">Proposta na INVENTUM</span><p>{item.proposta || "Não informado"}</p></div><button className="card-link" onClick={() => setDemandEditor(item)}>Editar registro <ArrowUpRight size={14} /></button></article>)}</div></section> : null}

          {tab === "pending" ? <section className="content-section"><SectionTitle eyebrow="LISTA DE DECISÕES" title="Pendências" description="Transforme os pontos de atenção da planilha em uma fila clara de resolução." action={<div className="pending-progress"><div><b>{data.pending.filter((item) => item.concluida).length}/{data.pending.length}</b><span>resolvidas</span></div><div className="small-progress"><div style={{ width: `${percent(data.pending.filter((item) => item.concluida).length, data.pending.length)}%` }} /></div></div>} /><div className="pending-layout"><div className="pending-list-card">{data.pending.map((item) => <div className={`pending-row ${item.concluida ? "done" : ""}`} key={item.id}><button className="check-button" onClick={() => togglePending(item.id)} aria-label={item.concluida ? "Reabrir pendência" : "Marcar como concluída"}>{item.concluida ? <Check size={15} /> : null}</button><span className="pending-row-number">{String(item.id).padStart(2, "0")}</span><p>{item.texto}</p><input type="date" value={item.prazo ?? ""} onChange={(e) => updatePending({ ...item, prazo: e.target.value || null })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "5px 7px", fontSize: 10, color: "#647278", background: "#fff" }} /><EditedByAvatar name={item.lastModifiedByName} avatarUrl={item.lastModifiedByAvatar} at={item.lastModifiedAt} /><span className={`pending-state ${item.concluida ? "done" : "open"}`}>{item.concluida ? "Concluída" : "Aberta"}</span></div>)}{data.pending.length === 0 ? <EmptyState title="Sem pendências" description="A base ainda não possui pontos de atenção." /> : null}</div><aside className="pending-aside"><div className="aside-orbit"><Target size={26} /></div><div className="eyebrow">COMO USAR</div><h3>Uma fila viva, não uma lista esquecida.</h3><p>Marque uma decisão como concluída assim que ela for resolvida. As mudanças aparecem para toda a equipe em tempo real.</p><div className="aside-note"><AlertCircle size={15} /><span>Use o backup JSON para guardar uma cópia de segurança periodicamente.</span></div></aside></div></section> : null}
          {tab === "sponsors" ? <section className="content-section"><SectionTitle eyebrow="PROSPECÇÃO" title="Patrocinadores & expositores" description="Sincronizado automaticamente da planilha POTENCIAIS EXPOSITORES — edite direto na planilha, o site atualiza sozinho." /><div className="table-panel"><div className="table-meta"><span><b>{data.sponsors.length}</b> entidades em prospecção</span><span className="table-hint">Somente leitura aqui — edição é feita na planilha</span></div><div className="table-scroll"><table><thead><tr><th>Entidade</th><th>Interesse</th><th>Tipo</th><th>Estande potencial</th><th>Responsável</th><th>Proposta enviada</th><th>Contato</th><th>Observações</th></tr></thead><tbody>{data.sponsors.map((item) => <tr key={item.id}><td><b>{item.entidade}</b></td><td><span className={`status-pill status-${interesseTone(item.grauInteresse)}`}><span className="status-dot" />{item.grauInteresse || "—"}</span></td><td><span className="type-label">{item.tipoPotencial || "—"}</span></td><td><span className="type-label">{item.estandePotencial || "—"}</span></td><td><span className="type-label">{item.respContato || "—"}</span></td><td><span className="type-label">{item.envioProposta || "—"}</span></td><td><span className="type-label">{item.contato || "—"}</span></td><td><span className="type-label">{compactText(item.obs || item.obsExtra || "—", 60)}</span></td></tr>)}</tbody></table>{data.sponsors.length === 0 ? <EmptyState title="Nenhum patrocinador ainda" description="Configure o Apps Script na planilha POTENCIAIS EXPOSITORES para trazer os dados." /> : null}</div></div></section> : null}
        </div>
      </main>
      {activityEditor !== undefined ? <ActivityModal activity={activityEditor} frentes={data.frentes} onClose={() => setActivityEditor(undefined)} onSave={saveActivity} onCreateFrente={(nome) => addFrente(nome, FRENTE_COLORS[data.frentes.length % FRENTE_COLORS.length].key)} /> : null}
      {demandEditor !== undefined ? <DemandModal demand={demandEditor} onClose={() => setDemandEditor(undefined)} onSave={saveDemand} /> : null}
    </div>
  );
}
