'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { GraduationCap, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const registerMutation = useMutation(
    trpc.auth.registerDocente.mutationOptions({
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      },
      onError: (err) => {
        setError(err.message || 'Error en el registro');
      },
    })
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    registerMutation.mutate({
      nombreCompleto: formData.nombreCompleto,
      email: formData.email,
      password: formData.password,
    });
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-md text-center space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">¡Registro Exitoso!</h2>
          <p className="text-gray-400">
            Tu cuenta ha sido creada y vinculada correctamente. Serás redirigido al login en unos segundos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">Registro de Docente</h2>
          <p className="mt-2 text-sm text-gray-400">Vincula tu cuenta con tu registro docente ISI-UNT</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Nombre Completo (como figura en sistema)</label>
              <div className="mt-1 relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  required
                  value={formData.nombreCompleto}
                  onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
                  className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Juan Perez Garcia"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Correo Institucional</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="ejemplo@unt.edu.pe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Contraseña</label>
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Confirmar</label>
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950 disabled:opacity-50"
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verificando y creando cuenta...
              </>
            ) : (
              'Registrarme'
            )}
          </button>

          <div className="flex items-center justify-center text-sm">
            <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
