'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Building2, FlaskConical, User, Calendar, CheckCircle2, FileDown } from 'lucide-react';
import Link from 'next/link';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
const DIA_LABELS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie',
};

const SLOT_COLORS = [
  'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
  'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
  'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  'bg-amber-500/20 border-amber-500/30 text-amber-300',
  'bg-purple-500/20 border-purple-500/30 text-purple-300',
  'bg-rose-500/20 border-rose-500/30 text-rose-300',
  'bg-teal-500/20 border-teal-500/30 text-teal-300',
  'bg-orange-500/20 border-orange-500/30 text-orange-300',
];

type ViewMode = 'general' | 'aula' | 'docente' | 'mi-horario';

type HorarioAsignacion = {
  id: string;
  tipo: 'TEORIA' | 'PRACTICA' | 'LABORATORIO';
  grupo: {
    nombre: string;
    cursoId?: string;
    curso: { id: string; codigo: string; nombre: string; ciclo: number };
  };
  docente?: { nombre: string; tipo: string; categoria: string };
  aula?: { codigo: string; nombre: string; tipo: string };
  franjaHoraria: { dia: string; horaInicio: string; horaFin: string };
};

export default function HorariosPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const isAdmin = user?.role === 'ADMIN';
  const isDocente = user?.role === 'DOCENTE';

  const [viewMode, setViewMode] = useState<ViewMode>(isDocente ? 'mi-horario' : 'general');
  const [selectedAulaId, setSelectedAulaId] = useState<string | null>(null);
  const [selectedDocenteId, setSelectedDocenteId] = useState<string | null>(null);
  const [showAutoModal, setShowAutoModal] = useState(false);

  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: aulas = [] } = useQuery({ ...trpc.aula.list.queryOptions({}) });
  const { data: docentes = [] } = useQuery({ ...trpc.docente.list.queryOptions({}) });
  const { data: franjas = [] } = useQuery({ ...trpc.periodo.franjas.queryOptions() });

  const { data: personalStats } = useQuery({
    ...trpc.docente.personalStats.queryOptions(),
    enabled: isDocente,
  });

  const queryInput = viewMode === 'aula' && selectedAulaId
    ? { aulaId: selectedAulaId, periodoId: periodoActivo?.id ?? '' }
    : viewMode === 'docente' && selectedDocenteId
      ? { docenteId: selectedDocenteId, periodoId: periodoActivo?.id ?? '' }
      : viewMode === 'mi-horario' && user?.docenteId
        ? { docenteId: user.docenteId, periodoId: periodoActivo?.id ?? '' }
        : { periodoId: periodoActivo?.id ?? '' };

  const queryOpts = viewMode === 'aula' && selectedAulaId
    ? trpc.horario.byAula.queryOptions(queryInput as { aulaId: string; periodoId: string })
    : (viewMode === 'docente' && selectedDocenteId) || (viewMode === 'mi-horario' && user?.docenteId)
      ? trpc.horario.byDocente.queryOptions(queryInput as { docenteId: string; periodoId: string })
      : trpc.horario.list.queryOptions({ periodoId: periodoActivo?.id ?? '' });

  const queryResult = useQuery({
    ...queryOpts,
    enabled: !!periodoActivo?.id,
  });

  const asignaciones = (queryResult.data ?? []) as HorarioAsignacion[];
  const isLoading = queryResult.isLoading;

  const downloadBase64PDF = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    link.click();
  };

  const generatePDFMutation = useMutation(
    trpc.reporte.generatePDF.mutationOptions({
      onSuccess: (data) => {
        downloadBase64PDF(data.pdf, data.filename);
      },
      onError: () => alert('Error al generar el PDF'),
    })
  );

  const autoGenerateMutation = useMutation(
    trpc.horario.autoGenerate.mutationOptions({
      onSuccess: (data) => {
        if (!data.success) {
          alert(data.reason ?? 'No se pudo autogenerar el horario.');
          return;
        }

        setShowAutoModal(false);
        queryClient.invalidateQueries({ queryKey: trpc.horario.list.queryKey() });
        if (selectedAulaId && periodoActivo?.id) {
          queryClient.invalidateQueries({
            queryKey: trpc.horario.byAula.queryKey({
              aulaId: selectedAulaId,
              periodoId: periodoActivo.id,
            }),
          });
        }
        if (selectedDocenteId && periodoActivo?.id) {
          queryClient.invalidateQueries({
            queryKey: trpc.horario.byDocente.queryKey({
              docenteId: selectedDocenteId,
              periodoId: periodoActivo.id,
            }),
          });
        }
        queryClient.invalidateQueries({ queryKey: trpc.horario.stats.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.aula.stats.queryKey() });

        alert(
          `Autogeneracion completada.\nAsignaciones creadas: ${data.createdCount}\nSin asignar: ${data.unassignedCount}`
        );
      },
      onError: () => {
        alert('Error al autogenerar el horario.');
      },
    })
  );

  // Build grid
  const horas = [...new Set(asignaciones.map((a) => a.franjaHoraria.horaInicio))].sort();

  const cursoColorMap = new Map<string, string>();
  let colorIdx = 0;
  asignaciones.forEach((a) => {
    const key = (a.grupo.cursoId ?? a.grupo.curso.id ?? a.id) as string;
    if (!cursoColorMap.has(key)) {
      cursoColorMap.set(key, SLOT_COLORS[colorIdx % SLOT_COLORS.length]);
      colorIdx++;
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Horarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {periodoActivo?.nombre ?? 'Sin periodo activo'}
            {asignaciones.length > 0 && ` · ${asignaciones.length} asignaciones`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'mi-horario' && (
            <button
              onClick={() => {
                if (!periodoActivo || !user?.docenteId) return;
                generatePDFMutation.mutate({
                  periodoId: periodoActivo.id,
                  tipo: 'por-docente',
                });
              }}
              disabled={generatePDFMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/10 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-600/20 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" /> {generatePDFMutation.isPending ? 'Generando...' : 'Descargar PDF'}
            </button>
          )}
          {isAdmin && (
            <>
              <button
                onClick={() => setShowAutoModal(true)}
                disabled={!periodoActivo}
                className="rounded-lg border border-indigo-500/40 bg-indigo-600/10 px-4 py-2.5 text-sm font-medium text-indigo-300 hover:bg-indigo-600/20 disabled:opacity-50"
              >
                Autogenerar
              </button>
              <Link
                href="/sesiones"
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25"
              >
                Ir a Sesiones de Llenado
              </Link>
            </>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-800 p-1 mb-4">
        {isDocente && (
          <button onClick={() => { setViewMode('mi-horario'); setSelectedAulaId(null); setSelectedDocenteId(null); }}
            className={`flex-1 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'mi-horario' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-400 hover:text-gray-200'}`}>
            <Calendar className="h-3.5 w-3.5" /> Mi Horario
          </button>
        )}
        <button onClick={() => { setViewMode('general'); setSelectedAulaId(null); setSelectedDocenteId(null); }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'general' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
          General
        </button>
        <button onClick={() => setViewMode('aula')}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'aula' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
          <Building2 className="h-3.5 w-3.5" /> Por Aula
        </button>
        <button onClick={() => setViewMode('docente')}
          className={`flex-1 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${viewMode === 'docente' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
          <User className="h-3.5 w-3.5" /> Por Docente
        </button>
      </div>

      {/* Docente Info Header for "Mi Horario" */}
      {viewMode === 'mi-horario' && personalStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold">
              {personalStats.docente.nombre.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Docente</p>
              <p className="text-sm text-white font-bold">{personalStats.docente.nombre}</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Carga Horaria</p>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${personalStats.workload >= personalStats.limits.min ? 'text-emerald-400' : 'text-amber-400'}`}>
                {personalStats.workload}h
              </span>
              <span className="text-xs text-gray-600">/ {personalStats.limits.max}h max</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Categoría / Tipo</p>
            <p className="text-sm text-gray-200 font-semibold">{personalStats.docente.categoria} · {personalStats.docente.tipo}</p>
          </div>
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Cursos</p>
              <p className="text-sm text-gray-200 font-semibold">{personalStats.coursesCount} asignados</p>
            </div>
            {personalStats.workload >= personalStats.limits.min && (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
          </div>
        </div>
      )}

      {/* Entity Selector */}
      {viewMode === 'aula' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {aulas.map((a) => (
            <button key={a.id} onClick={() => setSelectedAulaId(a.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                selectedAulaId === a.id
                  ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
              }`}>
              {a.codigo}
              <span className="ml-1 text-gray-500">
                {a.tipo === 'LABORATORIO' ? <FlaskConical className="inline h-3 w-3" /> : null}
              </span>
            </button>
          ))}
        </div>
      )}
      {viewMode === 'docente' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {docentes.slice(0, 20).map((d) => (
            <button key={d.id} onClick={() => setSelectedDocenteId(d.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                selectedDocenteId === d.id
                  ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
              }`}>
              {d.nombre.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {!periodoActivo ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
          Configure un periodo activo
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">Cargando...</div>
      ) : asignaciones.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-500">No hay asignaciones</p>
          <p className="text-xs text-gray-600 mt-1">Use las sesiones de llenado para asignar horarios</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="sticky left-0 bg-gray-900 px-3 py-2 text-left font-medium text-gray-400 w-16">Hora</th>
                {DIAS.map((dia) => (
                  <th key={dia} className="px-2 py-2 text-center font-medium text-gray-400 min-w-35">
                    {DIA_LABELS[dia]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map((hora, rowIndex) => (
                <tr key={hora} className="border-b border-gray-800/50">
                  <td className="sticky left-0 bg-gray-900 px-3 py-1.5 font-mono text-gray-500">{hora}</td>
                  {DIAS.map((dia) => {
                    const slotAsignaciones = asignaciones.filter(
                      (a) => a.franjaHoraria.dia === dia && a.franjaHoraria.horaInicio === hora
                    );
                    
                    if (slotAsignaciones.length === 0) return <td key={dia} className="px-1 py-1" />;

                    // Simplified unification: only for single-assignment slots (non-conflicting)
                    if (slotAsignaciones.length === 1) {
                      const a = slotAsignaciones[0];
                      const prevHora = horas[rowIndex - 1];
                      const prevAsignaciones = prevHora ? asignaciones.filter(
                        (pa) => pa.franjaHoraria.dia === dia && pa.franjaHoraria.horaInicio === prevHora
                      ) : [];
                      
                      const isSameAsPrev = prevAsignaciones.length === 1 && 
                        prevAsignaciones[0].grupo.curso.codigo === a.grupo.curso.codigo &&
                        prevAsignaciones[0].grupo.nombre === a.grupo.nombre &&
                        prevAsignaciones[0].aula?.codigo === a.aula?.codigo;

                      if (isSameAsPrev) return null;

                      // Calculate rowSpan
                      let rowSpan = 1;
                      for (let i = rowIndex + 1; i < horas.length; i++) {
                        const nextHora = horas[i];
                        const nextAsignaciones = asignaciones.filter(
                          (na) => na.franjaHoraria.dia === dia && na.franjaHoraria.horaInicio === nextHora
                        );
                        if (nextAsignaciones.length === 1 && 
                            nextAsignaciones[0].grupo.curso.codigo === a.grupo.curso.codigo &&
                            nextAsignaciones[0].grupo.nombre === a.grupo.nombre &&
                            nextAsignaciones[0].aula?.codigo === a.aula?.codigo) {
                          rowSpan++;
                        } else {
                          break;
                        }
                      }

                      const key = (a.grupo.cursoId ?? a.grupo.curso.id ?? a.id) as string;
                      return (
                        <td key={dia} className="px-1 py-1" rowSpan={rowSpan}>
                          <div
                            className={`rounded-md border p-2 h-full min-h-[45px] transition-all flex flex-col justify-center ${cursoColorMap.get(key)}`}
                          >
                            <p className="font-bold text-[11px] leading-tight">{a.grupo.curso.codigo}</p>
                            <p className="text-[10px] font-medium opacity-90 truncate mt-0.5">{a.grupo.curso.nombre}</p>
                            <div className="mt-1 pt-1 border-t border-white/10 flex flex-wrap gap-x-2 gap-y-0.5">
                              {viewMode !== 'docente' && a.docente && (
                                <p className="text-[9px] opacity-75 font-medium">
                                  {a.docente.nombre.split(' ').slice(0, 2).join(' ')}
                                </p>
                              )}
                              {viewMode !== 'aula' && a.aula && (
                                <p className="text-[9px] opacity-75 font-medium">
                                  {a.aula.codigo}
                                </p>
                              )}
                              <p className="text-[9px] opacity-75 font-bold">G{a.grupo.nombre}</p>
                              <p className="text-[9px] opacity-90 font-black text-white/50">{a.tipo}</p>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // Conflict case (multiple assignments in same slot)
                    return (
                      <td key={dia} className="px-1 py-1">
                        <div className="bg-red-500/20 border border-red-500/30 rounded-md p-1">
                          {slotAsignaciones.map((a) => (
                            <div key={a.id} className="text-[9px] text-red-300 border-b border-red-500/10 last:border-0 py-0.5">
                              {a.grupo.curso.codigo} - G{a.grupo.nombre}
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Autogenerar horario</h2>
            <p className="mt-2 text-sm text-gray-400">
              Esto eliminara las asignaciones actuales del periodo y generara un nuevo horario
              automaticamente segun la jerarquia y restricciones.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowAutoModal(false)}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!periodoActivo) return;
                  autoGenerateMutation.mutate({
                    periodoId: periodoActivo.id,
                    overwrite: true,
                  });
                }}
                disabled={autoGenerateMutation.isPending || !periodoActivo}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {autoGenerateMutation.isPending ? 'Generando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
