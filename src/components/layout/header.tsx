'use client';

import Link from 'next/link';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { LogIn, User as UserIcon, Bell, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function Header() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ ...trpc.auth.me.queryOptions() });
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({ 
    ...trpc.notification.unreadCount.queryOptions(),
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: notifications = [] } = useQuery({
    ...trpc.notification.list.queryOptions(),
    enabled: !!user && showNotifications,
  });

  const markAllRead = useMutation(
    trpc.notification.markAllAsRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.notification.unreadCount.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.notification.list.queryKey() });
      },
    })
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 right-0 left-64 z-40 h-16 border-b border-gray-800 bg-gray-950/50 backdrop-blur-md flex items-center justify-end px-8">
      {!user && (
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
        >
          <LogIn className="h-4 w-4" />
          Iniciar Sesión
        </Link>
      )}
      {user && (
        <div className="flex items-center gap-6">
          {/* Notificaciones */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-all hover:border-gray-700"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-gray-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                  <h3 className="text-sm font-bold text-white">Notificaciones</h3>
                  <button 
                    onClick={() => markAllRead.mutate()}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider"
                  >
                    Marcar todo como leído
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-xs text-gray-500">No hay notificaciones nuevas</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link || '#'}
                        onClick={() => setShowNotifications(false)}
                        className={`block p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${!n.leida ? 'bg-indigo-500/5' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-gray-200">{n.titulo}</h4>
                          {!n.leida && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{n.mensaje}</p>
                        <p className="text-[9px] text-gray-600 mt-2 font-medium">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
                <div className="p-3 bg-gray-900/50 text-center border-t border-gray-800">
                  <Link href="/notificaciones" className="text-[10px] font-bold text-gray-500 hover:text-gray-300 uppercase tracking-widest">
                    Ver todo el historial
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{user.nombre}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</p>
            </div>
            <Link href="/perfil" className="h-9 w-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors">
              <UserIcon className="h-5 w-5 text-gray-400" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
