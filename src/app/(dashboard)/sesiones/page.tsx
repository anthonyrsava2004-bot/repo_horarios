'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Play, Users, Clock, CheckCircle, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const ESTADO_BADGES: Record<string, string> = {
  PROGRAMADA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  EN_CURSO: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  FINALIZADA: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function SesionesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    nombre: '', fecha: '', horaInicio: '08:00', horaFin: '13:00', intervalo: 15,
  });

  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: sesiones = [], isLoading } = useQuery({
    ...trpc.sesion.list.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id,
  });

  const createMutation = useMutation(
    trpc.sesion.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.sesion.list.queryKey() });
        setShowModal(false);
        setForm({ nombre: '', fecha: '', horaInicio: '08:00', horaFin: '13:00', intervalo: 15 });
      },
    })
  );

  const iniciarMutation = useMutation(
    trpc.sesion.iniciar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.sesion.list.queryKey() });
      },
    })
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sesiones de Llenado</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión del proceso presencial de asignación de horarios
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!periodoActivo}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Nueva Sesión
        </button>
      </div>

      {!periodoActivo ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
          Configure un periodo académico activo primero
        </div>
      ) : isLoading ? (
        <div className="text-center text-gray-600 py-12">Cargando...</div>
      ) : sesiones.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-500 mb-2">No hay sesiones programadas</p>
          <p className="text-xs text-gray-600">Cree una sesión para iniciar el proceso de llenado</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sesiones.map((s) => (
            <div key={s.id} className={`rounded-xl border p-5 ${
              s.estado === 'EN_CURSO'
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-gray-800 bg-gray-900'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    s.estado === 'EN_CURSO' ? 'bg-emerald-600/20' : 'bg-gray-800'
                  }`}>
                    {s.estado === 'FINALIZADA'
                      ? <CheckCircle className="h-5 w-5 text-gray-500" />
                      : s.estado === 'EN_CURSO'
                        ? <Play className="h-5 w-5 text-emerald-400" />
                        : <Clock className="h-5 w-5 text-blue-400" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-white">{s.nombre}</h3>
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${ESTADO_BADGES[s.estado]}`}>
                        {s.estado.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {new Date(s.fecha).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}
                      {s.horaInicio} — {s.horaFin}
                      {' · '}
                      <Users className="inline h-3 w-3 -mt-0.5" /> {s._count.turnos} docentes
                      {' · '}
                      Intervalo: {s.intervalo} min
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {s.estado === 'PROGRAMADA' && (
                    <button
                      onClick={() => iniciarMutation.mutate({ sesionId: s.id })}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                    >
                      <Play className="h-3.5 w-3.5" /> Iniciar
                    </button>
                  )}
                  {s.estado === 'EN_CURSO' && (
                    <Link
                      href={`/sesiones/${s.id}`}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Gestionar <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {s.estado === 'FINALIZADA' && (
                    <Link
                      href={`/sesiones/${s.id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:bg-gray-800"
                    >
                      Ver resultados <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Nueva Sesión de Llenado</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!periodoActivo) return;
              createMutation.mutate({
                periodoId: periodoActivo.id,
                nombre: form.nombre,
                fecha: new Date(form.fecha),
                horaInicio: form.horaInicio,
                horaFin: form.horaFin,
                intervalo: form.intervalo,
              });
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
                <input type="text" required value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Sesión 1 — Nombrados Principales"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Fecha</label>
                <input type="date" required value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Hora Inicio</label>
                  <input type="time" required value={form.horaInicio}
                    onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Hora Fin</label>
                  <input type="time" required value={form.horaFin}
                    onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Intervalo</label>
                  <select value={form.intervalo}
                    onChange={(e) => setForm({ ...form, intervalo: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none">
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                <p className="text-xs text-gray-400">
                  📋 Los turnos se generarán automáticamente según la jerarquía:
                  <br />
                  <span className="text-gray-500">Nombrado Principal → Asociado → Auxiliar → JP → Contratado Principal → ...</span>
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">Cancelar</button>
                <button type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  disabled={createMutation.isPending}>Crear Sesión</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
