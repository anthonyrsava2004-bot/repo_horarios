'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { GraduationCap, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: () => {
        router.push('/');
        router.refresh();
      },
      onError: (err) => {
        setError(err.message || 'Error al iniciar sesión');
      },
    })
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">Bienvenido de nuevo</h2>
          <p className="mt-2 text-sm text-gray-400">Sistema de Horarios Académicos ISI-UNT</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Correo Institucional</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="ejemplo@unt.edu.pe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Contraseña</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-gray-800 bg-gray-950 py-2.5 pl-11 pr-4 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950 disabled:opacity-50"
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              'Entrar al sistema'
            )}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              Volver al inicio
            </Link>
            <Link href="/registro" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              ¿No tienes cuenta? Regístrate
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
