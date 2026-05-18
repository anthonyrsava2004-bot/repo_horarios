'use client';

import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ShieldCheck, User as UserIcon, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function UsuariosPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: usersData, isLoading } = useQuery({ ...trpc.auth.listUsers.queryOptions() });
  const users = (usersData as any[]) || [];

  const toggleStatusMutation = useMutation(
    trpc.auth.toggleUserStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.auth.listUsers.queryKey() });
      },
    })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Habilita o inhabilita cuentas de docentes y administradores</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 border border-gray-800">
          <ShieldCheck className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 border-b border-gray-800">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Docente Vinculado</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.nombre}</p>
                        <p className="text-[11px] text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      user.role === 'ADMIN' 
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.docente ? (
                      <div className="text-sm">
                        <p className="text-gray-300">{user.docente.nombre}</p>
                        <p className="text-[10px] text-gray-500">{user.docente.categoria}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600 italic">No vinculado</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {user.activo ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-emerald-500 font-medium">Activo</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-red-500 font-medium">Inactivo</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleStatusMutation.mutate({ userId: user.id, activo: !user.activo })}
                      disabled={toggleStatusMutation.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        user.activo 
                          ? 'text-red-400 hover:bg-red-500/10 border border-red-500/20' 
                          : 'text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20'
                      }`}
                    >
                      {user.activo ? 'Inhabilitar' : 'Habilitar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
