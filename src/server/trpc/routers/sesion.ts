import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, representanteProcedure, protectedProcedure } from '../init';
import { sortDocentesByHierarchy } from '@/server/services/schedule-engine/hierarchy';
import type { DocenteForSchedule } from '@/server/services/schedule-engine/types';
import { TRPCError } from '@trpc/server';

export const sesionRouter = createTRPCRouter({
  /** Create a filling session with auto-generated turns */
  create: representanteProcedure
    .input(z.object({
      periodoId: z.string(),
      nombre: z.string(),
      fecha: z.coerce.date(),
      horaInicio: z.string(), // "08:00"
      horaFin: z.string(),    // "13:00"
      intervalo: z.number().min(5).max(60).default(15),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get all active docentes and sort by hierarchy
      const docentesRaw = await ctx.prisma.docente.findMany({
        where: { activo: true },
      });

      const docentes: DocenteForSchedule[] = docentesRaw.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        categoria: d.categoria,
        tipo: d.tipo,
        antiguedad: d.antiguedad,
      }));

      const sortedDocentes = sortDocentesByHierarchy(docentes);

      // Create session
      const sesion = await ctx.prisma.sesionLlenado.create({
        data: {
          periodoId: input.periodoId,
          nombre: input.nombre,
          fecha: input.fecha,
          horaInicio: input.horaInicio,
          horaFin: input.horaFin,
          intervalo: input.intervalo,
        },
      });

      // Create turns
      const turnsData = sortedDocentes.map((d, index) => {
        const minutes = index * input.intervalo;
        const startTotalMinutes =
          parseInt(input.horaInicio.split(':')[0]) * 60 +
          parseInt(input.horaInicio.split(':')[1]);
        const turnMinutes = startTotalMinutes + minutes;
        const hours = Math.floor(turnMinutes / 60);
        const mins = turnMinutes % 60;
        const horaAsignada = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

        return {
          sesionId: sesion.id,
          docenteId: d.id,
          orden: index + 1,
          horaAsignada,
        };
      });

      await ctx.prisma.turnoDocente.createMany({
        data: turnsData,
      });

      return sesion;
    }),

  list: baseProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.sesionLlenado.findMany({
        where: { periodoId: input.periodoId },
        include: {
          _count: { select: { turnos: true } },
        },
        orderBy: { fecha: 'desc' },
      });
    }),

  byId: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.sesionLlenado.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          turnos: {
            include: { docente: true },
            orderBy: { orden: 'asc' },
          },
        },
      });
    }),

  updateStatus: representanteProcedure
    .input(z.object({ id: z.string(), estado: z.enum(['PROGRAMADA', 'EN_CURSO', 'FINALIZADA']) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.sesionLlenado.update({
        where: { id: input.id },
        data: { estado: input.estado },
      });
    }),

  updateTurnoActual: representanteProcedure
    .input(z.object({ id: z.string(), turnoActual: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.sesionLlenado.update({
        where: { id: input.id },
        data: { turnoActual: input.turnoActual },
      });
    }),

  delete: representanteProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.prisma.sesionLlenado.delete({ where: { id: input.id } });
  }),

  /** Get the currently active session and the docente in turn */
  active: baseProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sesion = await ctx.prisma.sesionLlenado.findFirst({
        where: { periodoId: input.periodoId, estado: 'EN_CURSO' },
        include: {
          turnos: {
            orderBy: { orden: 'asc' },
          },
        },
      });

      if (!sesion) return null;

      const turnoActual = sesion.turnos.find(t => t.orden === sesion.turnoActual);
      return {
        ...sesion,
        turnoActualDocenteId: turnoActual?.docenteId || null,
      };
    }),

  iniciar: representanteProcedure
    .input(z.object({ sesionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sesion = await ctx.prisma.sesionLlenado.update({
        where: { id: input.sesionId },
        data: { estado: 'EN_CURSO', turnoActual: 1 },
        include: { turnos: { where: { orden: 1 } } }
      });

      // Notify first docente
      const firstTurn = sesion.turnos[0];
      if (firstTurn) {
        await ctx.prisma.notification.create({
          data: {
            docenteId: firstTurn.docenteId,
            titulo: '¡Es tu turno!',
            mensaje: `La sesión "${sesion.nombre}" ha iniciado. Es tu turno para seleccionar tu horario.`,
            tipo: 'TURN_START',
            link: `/sesiones/${sesion.id}`
          }
        });
        
        await ctx.prisma.turnoDocente.update({
          where: { id: firstTurn.id },
          data: { estado: 'EN_TURNO' }
        });
      }

      return sesion;
    }),

  /** Docente finishes their turn */
  finalizarTurno: protectedProcedure
    .input(z.object({ sesionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.docenteId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const sesion = await ctx.prisma.sesionLlenado.findUniqueOrThrow({
        where: { id: input.sesionId },
        include: { 
          turnos: { 
            orderBy: { orden: 'asc' } 
          } 
        }
      });

      const currentTurn = sesion.turnos.find(t => t.orden === sesion.turnoActual);
      
      if (!currentTurn || currentTurn.docenteId !== ctx.session.docenteId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No es tu turno o el turno ya pasó.'
        });
      }

      // Mark current as completed
      await ctx.prisma.turnoDocente.update({
        where: { id: currentTurn.id },
        data: { estado: 'COMPLETADO' }
      });

      // Advance session
      if (sesion.turnoActual >= sesion.turnos.length) {
        await ctx.prisma.sesionLlenado.update({
          where: { id: input.sesionId },
          data: { estado: 'FINALIZADA' }
        });
        return { finished: true };
      }

      const nextOrden = sesion.turnoActual + 1;
      await ctx.prisma.sesionLlenado.update({
        where: { id: input.sesionId },
        data: { turnoActual: nextOrden }
      });

      // Notify next docente
      const nextTurn = sesion.turnos.find(t => t.orden === nextOrden);
      if (nextTurn) {
        await ctx.prisma.notification.create({
          data: {
            docenteId: nextTurn.docenteId,
            titulo: '¡Es tu turno!',
            mensaje: `El docente anterior ha finalizado. Ahora es tu turno en la sesión "${sesion.nombre}".`,
            tipo: 'TURN_START',
            link: `/sesiones/${sesion.id}`
          }
        });

        await ctx.prisma.turnoDocente.update({
          where: { id: nextTurn.id },
          data: { estado: 'EN_TURNO' }
        });
      }

      return { finished: false, nextOrden };
    }),

  /** Get full state of a session including turns and current progress */
  estado: baseProcedure
    .input(z.object({ sesionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sesion = await ctx.prisma.sesionLlenado.findUniqueOrThrow({
        where: { id: input.sesionId },
        include: {
          turnos: {
            include: { docente: true },
            orderBy: { orden: 'asc' },
          },
        },
      });

      const total = sesion.turnos.length;
      const completados = sesion.turnos.filter((t) => t.estado === 'COMPLETADO');
      const ausentes = sesion.turnos.filter((t) => t.estado === 'AUSENTE').length;
      
      const turnoActual = sesion.turnos.find((t) => t.orden === sesion.turnoActual);
      const siguientes = sesion.turnos.filter((t) => t.orden > sesion.turnoActual && t.estado === 'PENDIENTE');

      return {
        ...sesion,
        turnoActual,
        completados,
        siguientes,
        progreso: {
          total,
          completados: completados.length,
          ausentes,
          porcentaje: total > 0 ? Math.round((completados.length / total) * 100) : 0,
        },
      };
    }),

  /** Advance to next turn in session (Admin only) */
  avanzarTurno: representanteProcedure
    .input(z.object({ sesionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sesion = await ctx.prisma.sesionLlenado.findUniqueOrThrow({
        where: { id: input.sesionId },
        include: { turnos: { orderBy: { orden: 'asc' } } }
      });

      const currentTurn = sesion.turnos.find(t => t.orden === sesion.turnoActual);
      if (currentTurn && currentTurn.estado === 'EN_TURNO') {
        await ctx.prisma.turnoDocente.update({
          where: { id: currentTurn.id },
          data: { estado: 'COMPLETADO' }
        });
      }

      if (sesion.turnoActual >= sesion.turnos.length) {
        return ctx.prisma.sesionLlenado.update({
          where: { id: input.sesionId },
          data: { estado: 'FINALIZADA' }
        });
      }

      const nextOrden = sesion.turnoActual + 1;
      const updatedSesion = await ctx.prisma.sesionLlenado.update({
        where: { id: input.sesionId },
        data: { turnoActual: nextOrden, estado: 'EN_CURSO' }
      });

      // Notify next docente
      const nextTurn = sesion.turnos.find(t => t.orden === nextOrden);
      if (nextTurn) {
        await ctx.prisma.notification.create({
          data: {
            docenteId: nextTurn.docenteId,
            titulo: '¡Es tu turno! (Asignado por Admin)',
            mensaje: `El administrador ha avanzado el turno. Ahora es tu turno en la sesión "${sesion.nombre}".`,
            tipo: 'TURN_START',
            link: `/sesiones/${sesion.id}`
          }
        });

        await ctx.prisma.turnoDocente.update({
          where: { id: nextTurn.id },
          data: { estado: 'EN_TURNO' }
        });
      }

      return updatedSesion;
    }),

  /** Mark a docente as absent (Admin only) */
  marcarAusente: representanteProcedure
    .input(z.object({ sesionId: z.string(), turnoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const turnToMark = await ctx.prisma.turnoDocente.update({
        where: { id: input.turnoId },
        data: { estado: 'AUSENTE' }
      });
      
      const sesion = await ctx.prisma.sesionLlenado.findUniqueOrThrow({
        where: { id: input.sesionId },
        include: { turnos: { orderBy: { orden: 'asc' } } }
      });

      // If we marked the current turn as absent, advance
      if (sesion.turnoActual === turnToMark.orden) {
        if (sesion.turnoActual < sesion.turnos.length) {
          const nextOrden = sesion.turnoActual + 1;
          await ctx.prisma.sesionLlenado.update({
            where: { id: input.sesionId },
            data: { turnoActual: nextOrden }
          });

          // Notify next docente
          const nextTurn = sesion.turnos.find(t => t.orden === nextOrden);
          if (nextTurn) {
            await ctx.prisma.notification.create({
              data: {
                docenteId: nextTurn.docenteId,
                titulo: '¡Es tu turno!',
                mensaje: `El docente anterior fue marcado como ausente. Ahora es tu turno en la sesión "${sesion.nombre}".`,
                tipo: 'TURN_START',
                link: `/sesiones/${sesion.id}`
              }
            });

            await ctx.prisma.turnoDocente.update({
              where: { id: nextTurn.id },
              data: { estado: 'EN_TURNO' }
            });
          }
        } else {
          await ctx.prisma.sesionLlenado.update({
            where: { id: input.sesionId },
            data: { estado: 'FINALIZADA' }
          });
        }
      }
    }),
});
