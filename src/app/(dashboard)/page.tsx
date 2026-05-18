'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'indigo',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-600/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400',
    cyan: 'from-cyan-600/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400',
    emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-600/20 to-amber-600/5 border-amber-500/30 text-amber-400',
    red: 'from-red-600/20 to-red-600/5 border-red-500/30 text-red-400',
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <Icon className="h-8 w-8 opacity-60" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const { data: docenteStats } = useQuery({ ...trpc.docente.stats.queryOptions() });
  const { data: periodoActivo } = useQuery({ ...trpc.periodo.active.queryOptions() });
  const { data: personalDocente } = useQuery({
    ...trpc.docente.personalStats.queryOptions(),
    enabled: user?.role === 'DOCENTE',
  });

  const { data: sesionActiva } = useQuery({
    ...trpc.sesion.active.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: user?.role === 'DOCENTE' && !!periodoActivo?.id,
  });

  const isMyTurn = user?.role === 'DOCENTE' && sesionActiva?.turnoActualDocenteId === user?.docenteId;

  const isRepresentative = user?.role === 'REPRESENTANTE_ESCUELA';
  const isAdmin = user?.role === 'ADMIN';

  const horarioStats = useQuery({
    ...trpc.horario.stats.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id,
  });

  const aulaStats = useQuery({
    ...trpc.aula.stats.queryOptions({ periodoId: periodoActivo?.id ?? '' }),
    enabled: !!periodoActivo?.id,
  });

  const stats = horarioStats.data;
  const aulasData = aulaStats.data?.ocupacionPorAula;

  const startProcessMutation = useMutation(
    trpc.curso.startProcess.mutationOptions({
      onSuccess: () => {
        alert('Periodo de postulaciones iniciado');
        queryClient.invalidateQueries({ queryKey: trpc.periodo.active.queryKey() });
      },
    })
  );

  // --- Dashboard para Representante de Escuela ---
  if (isRepresentative) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Dirección de Escuela</h1>
            <p className="text-sm text-gray-500 mt-1">Gestión de semestre y apertura de cursos</p>
          </div>
          <div className="flex gap-3">
             <Link href="/cursos" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500">
               Gestionar Apertura
             </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Estado del Semestre"
            value={periodoActivo?.estado || '---'}
            subtitle={periodoActivo?.nombre}
            icon={TrendingUp}
            color="indigo"
          />
          <StatCard
            title="Cursos Registrados"
            value={stats?.totalGrupos || 0}
            subtitle="Grupos totales"
            icon={BookOpen}
            color="cyan"
          />
          <StatCard
            title="Docentes"
            value={docenteStats?.total || 0}
            subtitle="Plana docente activa"
            icon={Users}
            color="emerald"
          />
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center max-w-2xl mx-auto">
           <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-white">Control del Proceso</h2>
           <p className="text-gray-400 mt-2">
             Como representante de escuela, usted es responsable de definir qué cursos se dictarán y cuándo iniciar el periodo de postulaciones de los docentes.
           </p>
           
           <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 text-left">
                 <p className="text-xs font-bold text-indigo-400 uppercase mb-1">Paso 1: Apertura</p>
                 <p className="text-sm text-gray-300 mb-3">Seleccione los cursos del catálogo que se ofrecerán este ciclo.</p>
                 <Link href="/cursos" className="text-xs text-indigo-400 hover:underline font-medium">Ir a Cursos &rarr;</Link>
              </div>
              <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 text-left">
                 <p className="text-xs font-bold text-emerald-400 uppercase mb-1">Paso 2: Postulaciones</p>
                 <p className="text-sm text-gray-300 mb-3">Inicie el periodo para que los docentes elijan según su perfil.</p>
                 <button 
                   disabled={periodoActivo?.estado !== 'PLANIFICACION' || startProcessMutation.isPending}
                   onClick={() => startProcessMutation.mutate()}
                   className="px-4 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
                 >
                   {periodoActivo?.estado === 'PLANIFICACION' ? 'Iniciar Proceso' : 'Proceso Iniciado'}
                 </button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // --- Dashboard para Docente ---
  if (user?.role === 'DOCENTE' && personalDocente) {
    const { workload, coursesCount, limits } = personalDocente;
    const progress = (workload / limits.max) * 100;
    
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Mi Panel Docente</h1>
            <p className="text-sm text-gray-500 mt-1">Bienvenido, {user.nombre}</p>
          </div>
          <div className="flex gap-3">
            {isMyTurn && sesionActiva && (
              <Link 
                href={`/sesiones/${sesionActiva.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold animate-pulse shadow-lg shadow-emerald-500/25"
              >
                <Clock className="h-4 w-4" /> ¡Es tu turno! Llenar horario
              </Link>
            )}
            <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-widest">
                {personalDocente.docente.categoria} - {personalDocente.docente.tipo}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Horas Lectivas"
            value={`${workload}h`}
            subtitle={`Mín: ${limits.min}h · Máx: ${limits.max}h`}
            icon={Calendar}
            color={workload < limits.min ? 'amber' : workload > limits.max ? 'red' : 'emerald'}
          />
          <StatCard
            title="Cursos Asignados"
            value={coursesCount}
            subtitle="Grupos en este periodo"
            icon={BookOpen}
            color="indigo"
          />
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-400 uppercase mb-2">Progreso de Carga</p>
            <div className="w-full bg-gray-800 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  progress > 100 ? 'bg-red-500' : progress >= 80 ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 text-right">{Math.round(progress)}% de la carga máxima</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Mis Horarios Asignados</h2>
            {personalDocente.assignments.length > 0 ? (
              <div className="space-y-3">
                {personalDocente.assignments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                    <div>
                      <p className="text-sm font-medium text-white">{a.grupo.curso.nombre}</p>
                      <p className="text-xs text-gray-500">Grupo {a.grupo.nombre} · {a.aula.codigo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-indigo-400">{a.franjaHoraria.dia}</p>
                      <p className="text-[10px] text-gray-500">{a.franjaHoraria.horaInicio}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-600">No tienes horarios registrados</div>
            )}
          </div>
          
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col items-center justify-center text-center">
             <TrendingUp className="h-12 w-12 text-indigo-500/20 mb-4" />
             <h3 className="text-white font-medium">¿Buscas más cursos?</h3>
             <p className="text-sm text-gray-500 mt-2 max-w-xs">
               Recuerda que puedes postular a nuevos cursos en el módulo de Cursos según tu categoría docente.
             </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Dashboard para Admin o Público ---
  
  // Chart data
  const categoriaData = docenteStats
    ? [
        { name: 'Principal', value: docenteStats.porCategoria.PRINCIPAL },
        { name: 'Asociado', value: docenteStats.porCategoria.ASOCIADO },
        { name: 'Auxiliar', value: docenteStats.porCategoria.AUXILIAR },
        { name: 'J. Práctica', value: docenteStats.porCategoria.JEFE_PRACTICA },
      ]
    : [];

  const cargaDocenteData = stats?.cargaDocente
    ?.filter((d) => d.horasAsignadas > 0)
    .sort((a, b) => b.horasAsignadas - a.horasAsignadas)
    .slice(0, isAdmin ? 15 : 10) // Admin ve más
    .map((d) => ({
      nombre: d.nombre.split(' ').slice(0, 2).join(' '),
      horas: d.horasAsignadas,
    })) ?? [];

  const ocupacionData = (aulasData ?? [])
    .sort((a, b) => b.ocupacion - a.ocupacion)
    .slice(0, isAdmin ? 12 : 8) // Admin ve más
    .map((a) => ({
      nombre: a.codigo,
      ocupacion: a.ocupacion,
    }));

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isAdmin ? 'Panel de Administración' : 'Dashboard General'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Periodo activo: {periodoActivo?.nombre ?? 'Ninguno configurado'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              Vista Avanzada
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Docentes Activos"
          value={docenteStats?.total ?? 0}
          subtitle={isAdmin ? `${docenteStats?.nombrados ?? 0} nombrados · ${docenteStats?.contratados ?? 0} contratados` : undefined}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Grupos Asignados"
          value={stats?.gruposAsignados ?? 0}
          subtitle={isAdmin ? `de ${stats?.totalGrupos ?? 0} total` : undefined}
          icon={BookOpen}
          color="cyan"
        />
        <StatCard
          title="Total Asignaciones"
          value={stats?.totalAsignaciones ?? 0}
          subtitle={isAdmin ? `${stats?.docentesConCarga ?? 0} docentes con carga` : undefined}
          icon={Calendar}
          color="emerald"
        />
        <StatCard
          title={isAdmin ? "Grupos sin Asignar" : "Estado Cobertura"}
          value={isAdmin ? (stats?.gruposSinAsignar ?? 0) : (stats?.totalGrupos ? `${Math.round((stats.gruposAsignados / stats.totalGrupos) * 100)}%` : '0%')}
          subtitle={isAdmin ? (stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? '⚠ Requiere atención' : 'Todo asignado') : 'Avance del semestre'}
          icon={isAdmin && stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? AlertTriangle : TrendingUp}
          color={isAdmin && stats?.gruposSinAsignar && stats.gruposSinAsignar > 0 ? 'red' : 'amber'}
        />
      </div>

      {isAdmin && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
               <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Resumen Operativo</h4>
               <p className="text-sm text-gray-400">
                  Sistema operando al {(stats?.totalGrupos ? (stats.gruposAsignados / stats.totalGrupos * 100).toFixed(1) : 0)}% de capacidad. 
                  Se han registrado {stats?.totalAsignaciones} sesiones de clase.
               </p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
               <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">Ambientes</h4>
               <p className="text-sm text-gray-400">
                  Promedio de ocupación general: {aulasData?.length ? (aulasData.reduce((acc: number, curr: any) => acc + curr.ocupacion, 0) / aulasData.length).toFixed(1) : 0}% 
                  en {aulasData?.length} aulas activas.
               </p>
            </div>
         </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Categoría */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Docentes por Categoría</h2>
          {categoriaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoriaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoriaData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-600">
              Sin datos
            </div>
          )}
        </div>

        {/* Ocupación de Aulas */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Ocupación de Aulas (%)</h2>
          {ocupacionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ocupacionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="nombre" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
                <Bar dataKey="ocupacion" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-600">
              Genere un horario para ver la ocupación
            </div>
          )}
        </div>

        {/* Carga Docente */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
             {isAdmin ? 'Carga Docente Detallada (Top 15)' : 'Carga Docente (Top 10)'}
          </h2>
          {cargaDocenteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isAdmin ? 400 : 300}>
              <BarChart data={cargaDocenteData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis type="category" dataKey="nombre" stroke="#6b7280" fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
                <Bar dataKey="horas" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-600">
              Genere un horario para ver la carga docente
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
