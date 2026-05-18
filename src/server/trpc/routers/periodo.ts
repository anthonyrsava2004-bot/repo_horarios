import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure } from '../init';

const periodoInput = z.object({
  nombre: z.string().min(3, 'El nombre es obligatorio (ej: 2026-I)'),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date(),
  activo: z.boolean().optional().default(false),
});

export const periodoRouter = createTRPCRouter({
  list: baseProcedure.query(async ({ ctx }) => {
    return ctx.prisma.periodoAcademico.findMany({
      include: {
        _count: { select: { grupos: true, asignaciones: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    });
  }),

  active: baseProcedure.query(async ({ ctx }) => {
    return ctx.prisma.periodoAcademico.findFirst({
      where: { activo: true },
    });
  }),

  byId: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          grupos: {
            include: { curso: true },
            orderBy: { curso: { ciclo: 'asc' } },
          },
        },
      });
    }),

  create: adminProcedure.input(periodoInput).mutation(({ ctx, input }) => {
    return ctx.prisma.periodoAcademico.create({ data: input });
  }),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(periodoInput))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.periodoAcademico.update({ where: { id }, data });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.prisma.periodoAcademico.delete({ where: { id: input.id } });
  }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.string(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.activo) {
        await ctx.prisma.periodoAcademico.updateMany({
          where: { activo: true },
          data: { activo: false },
        });
      }
      return ctx.prisma.periodoAcademico.update({
        where: { id: input.id },
        data: { activo: input.activo },
      });
    }),

  // ── Franjas Horarias ──────────────────────────
  franjas: baseProcedure.query(async ({ ctx }) => {
    return ctx.prisma.franjaHoraria.findMany({
      orderBy: [{ dia: 'asc' }, { numeroBloque: 'asc' }],
    });
  }),
});
