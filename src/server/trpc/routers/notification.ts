import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { TRPCError } from '@trpc/server';

export const notificationRouter = createTRPCRouter({
  /** Get all notifications for the current docente */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.docenteId) {
      return [];
    }

    return ctx.prisma.notification.findMany({
      where: { docenteId: ctx.session.docenteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }),

  /** Mark a notification as read */
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notification.update({
        where: { id: input.id },
        data: { leida: true },
      });
    }),

  /** Mark all notifications as read */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.session?.docenteId) return { count: 0 };

    return ctx.prisma.notification.updateMany({
      where: { docenteId: ctx.session.docenteId, leida: false },
      data: { leida: true },
    });
  }),

  /** Get count of unread notifications */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.docenteId) return 0;

    return ctx.prisma.notification.count({
      where: { docenteId: ctx.session.docenteId, leida: false },
    });
  }),
});
