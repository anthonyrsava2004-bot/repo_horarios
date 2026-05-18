'use client';

import { useState } from 'react';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { User, Mail, Lock, Shield, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PerfilPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({ ...trpc.auth.getProfile.queryOptions() });
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Initialize nombre once user is loaded
  const [isInitialized, setIsInitialized] = useState(false);
  if (user && !isInitialized) {
    setNombre(user.nombre);
    setIsInitialized(true);
  }

  const updateMutation = useMutation(
    trpc.auth.updateProfile.mutationOptions({
      onSuccess: () => {
        setSuccess(true);
        setPassword('');
        setConfirmPassword('');
        queryClient.invalidateQueries({ queryKey: trpc.auth.getProfile.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.auth.me.queryKey() });
        setTimeout(() => setSuccess(false), 3000);
      },
      onError: (err) => {
        setError(err.message || 'Error al actualizar perfil');
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password && password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    updateMutation.mutate({
      nombre: nombre !== user?.nombre ? nombre : undefined,
      password: password || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Administra tu información personal y seguridad de la cuenta</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
              <User className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user?.nombre}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {user?.role}
                </span>
                <span className="text-sm text-gray-500">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-4 text-sm text-green-400 border border-green-500/20">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p>Perfil actualizado correctamente</p>
            </div>
          )}

          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nombre Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600" />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {user?.role === 'DOCENTE' && (
              <div className="p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Rol Docente</p>
                <p className="text-sm text-gray-300">
                  Como docente, tu nombre está vinculado a tu registro oficial. 
                  Los cambios realizados aquí se reflejarán en las listas de horarios.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
                <input
                  type="email"
                  disabled
                  value={user?.email}
                  className="block w-full rounded-lg border border-gray-800 bg-gray-900/50 py-2.5 pl-11 pr-4 text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-600">El correo institucional no puede ser modificado.</p>
            </div>

            <div className="pt-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-white mb-4">Cambiar Contraseña</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nueva Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Confirmar Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-600">Deja estos campos en blanco si no deseas cambiar tu contraseña.</p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>
        </form>
      </div>

      {user?.docente && (
        <div className="mt-6 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">Información de Docente Vinculada</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
            <div>
              <p className="text-gray-500">Categoría</p>
              <p className="text-gray-300 font-medium">{user.docente.categoria}</p>
            </div>
            <div>
              <p className="text-gray-500">Tipo</p>
              <p className="text-gray-300 font-medium">{user.docente.tipo}</p>
            </div>
            <div>
              <p className="text-gray-500">Antigüedad</p>
              <p className="text-gray-300 font-medium">{new Date(user.docente.antiguedad).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
