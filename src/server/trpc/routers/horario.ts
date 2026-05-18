import { z } from 'zod';
import { createTRPCRouter, baseProcedure, adminProcedure, protectedProcedure, representanteProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { AvailabilityService } from '@/server/services/availability';
import { ScheduleEngine } from '@/server/services/schedule-engine';
import { AssignmentService } from '@/server/services/assignment.service';

export const horarioRouter = createTRPCRouter({
  // ─── Availability (Real-time) ────────────────────────

  /** Availability matrix for a single aula (raw — no docente constraints) */
  aulaAvailability: baseProcedure
    .input(z.object({ periodoId: z.string(), aulaId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);
      return service.getAulaAvailability(input.periodoId, input.aulaId);
    }),

  /** Availability matrix for a single aula annotated with docente-specific constraints */
  docenteAulaAvailability: baseProcedure
    .input(z.object({ periodoId: z.string(), aulaId: z.string(), docenteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);
      return service.getDocenteAulaAvailability(input.periodoId, input.aulaId, input.docenteId);
    }),

  // ─── Assignments ───────────────────────────────────

  list: baseProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.asignacion.findMany({
        where: { periodoId: input.periodoId },
        include: {
          grupo: { include: { curso: true } },
          docente: true,
          aula: true,
          franjaHoraria: true,
        },
      });
    }),

  byAula: baseProcedure
    .input(z.object({ aulaId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.asignacion.findMany({
        where: { aulaId: input.aulaId, periodoId: input.periodoId },
        include: {
          grupo: { include: { curso: true } },
          docente: true,
          aula: true,
          franjaHoraria: true,
        },
      });
    }),

  byDocente: baseProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.asignacion.findMany({
        where: { docenteId: input.docenteId, periodoId: input.periodoId },
        include: {
          grupo: { include: { curso: true } },
          aula: true,
          docente: true,
          franjaHoraria: true,
        },
      });
    }),

  /** Stats for dashboard/management */
  stats: baseProcedure
    .input(z.object({ periodoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [asignaciones, grupos, docentesConCargaCount] = await Promise.all([
        ctx.prisma.asignacion.findMany({
          where: { periodoId: input.periodoId },
          include: { docente: true },
        }),
        ctx.prisma.grupo.findMany({
          where: { periodoAcademicoId: input.periodoId },
        }),
        ctx.prisma.asignacion.groupBy({
          by: ['docenteId'],
          where: { periodoId: input.periodoId },
        }),
      ]);

      const totalAsignaciones = asignaciones.length;
      const totalGrupos = grupos.length;

      // Unique groups that have at least one assignment
      const assignedGroupIds = new Set(asignaciones.map((a) => a.grupoId));
      const gruposAsignados = assignedGroupIds.size;
      const gruposSinAsignar = totalGrupos - gruposAsignados;

      const docenteCarga = new Map<string, { nombre: string; horasAsignadas: number }>();

      asignaciones.forEach((a) => {
        const d = a.docente;
        const current = docenteCarga.get(d.id) || { nombre: d.nombre, horasAsignadas: 0 };
        docenteCarga.set(d.id, { ...current, horasAsignadas: current.horasAsignadas + 1 });
      });

      return {
        totalAsignaciones,
        totalGrupos,
        gruposAsignados,
        gruposSinAsignar,
        docentesConCarga: docentesConCargaCount.length,
        cargaDocente: Array.from(docenteCarga.values()),
      };
    }),

  /** Create a single assignment (from filling session or admin) */
  create: protectedProcedure
    .input(z.object({
      docenteId: z.string(),
      aulaId: z.string(),
      grupoId: z.string(),
      franjaHorariaId: z.string(),
      periodoId: z.string(),
      tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);

      // Validate against all constraints
      const validation = await service.validateSlotSelection(
        input.docenteId,
        input.aulaId,
        input.grupoId,
        input.franjaHorariaId,
        input.periodoId
      );

      if (!validation.valid) {
        throw new Error(validation.reasons.join(', '));
      }

      return ctx.prisma.asignacion.create({
        data: {
          docenteId: input.docenteId,
          aulaId: input.aulaId,
          grupoId: input.grupoId,
          franjaHorariaId: input.franjaHorariaId,
          periodoId: input.periodoId,
          tipo: input.tipo,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.asignacion.delete({ where: { id: input.id } });
    }),

  // ─── Auto Scheduling (Batch) ───────────────────────

  autoGenerate: adminProcedure
    .input(z.object({
      periodoId: z.string(),
      overwrite: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch all data needed for the engine
      const [docentes, grupos, aulas, franjas, docenteGrupos, restricciones, mantenimientos] = await Promise.all([
        ctx.prisma.docente.findMany({ where: { activo: true } }),
        ctx.prisma.grupo.findMany({ 
          where: { periodoAcademicoId: input.periodoId },
          include: { curso: true }
        }),
        ctx.prisma.aula.findMany(),
        ctx.prisma.franjaHoraria.findMany(),
        ctx.prisma.docenteGrupo.findMany({
          where: { grupo: { periodoAcademicoId: input.periodoId } }
        }),
        ctx.prisma.restriccionDocente.findMany(),
        ctx.prisma.mantenimientoAula.findMany()
      ]);

      const docenteGrupoMap = new Map<string, string[]>();
      docenteGrupos.forEach(dg => {
        const current = docenteGrupoMap.get(dg.docenteId) || [];
        docenteGrupoMap.set(dg.docenteId, [...current, dg.grupoId]);
      });

      const engineInput = {
        docentes: docentes.map(d => ({
          id: d.id,
          nombre: d.nombre,
          categoria: d.categoria,
          tipo: d.tipo,
          antiguedad: d.antiguedad
        })),
        grupos: grupos.map(g => ({
          id: g.id,
          nombre: g.nombre,
          cursoId: g.cursoId,
          cursoNombre: g.curso.nombre,
          cursoCodigo: g.curso.codigo,
          horasTeoria: g.curso.horasTeoria,
          horasLaboratorio: g.curso.horasLaboratorio,
          requiereLaboratorio: g.curso.requiereLaboratorio
        })),
        aulas: aulas.map(a => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          capacidad: a.capacidad,
          tipo: a.tipo
        })),
        franjas: franjas.map(f => ({
          id: f.id,
          dia: f.dia,
          horaInicio: f.horaInicio,
          horaFin: f.horaFin,
          numeroBloque: f.numeroBloque
        })),
        docenteGrupoMap,
        blockedDocenteSlots: new Set(restricciones.map(r => `${r.docenteId}-${r.franjaHorariaId}`)),
        blockedAulaSlots: new Set(mantenimientos.map(m => `${m.aulaId}-${m.franjaHorariaId}`))
      };

      const engine = new ScheduleEngine(engineInput);
      const result = engine.generate();

      // 2. Persist assignments if requested
      if (input.overwrite) {
        await ctx.prisma.asignacion.deleteMany({
          where: { periodoId: input.periodoId }
        });
      }

      const createdCount = await ctx.prisma.$transaction(
        result.assignments.map(a => 
          ctx.prisma.asignacion.create({
            data: {
              ...a,
              periodoId: input.periodoId
            }
          })
        )
      );

      return {
        success: true,
        reason: undefined as string | undefined,
        createdCount: createdCount.length,
        unassignedCount: result.unassigned.length,
        unassigned: result.unassigned
      };
    }),

  /** Run automatic assignment based on postulations and hierarchy */
  processAssignments: protectedProcedure
    .input(z.object({ periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.role !== 'REPRESENTANTE_ESCUELA' && ctx.session.role !== 'ADMIN') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const service = new AssignmentService(ctx.prisma);
      return service.processPostulations(input.periodoId);
    }),

  /** Select a slot for a group/docente/aula (Session filling) */
  selectSlot: baseProcedure
    .input(z.object({
      docenteId: z.string(),
      aulaId: z.string(),
      grupoId: z.string(),
      franjaHorariaId: z.string(),
      periodoId: z.string(),
      tipo: z.enum(['TEORIA', 'PRACTICA', 'LABORATORIO']),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);
      const validation = await service.validateSlotSelection(
        input.docenteId,
        input.aulaId,
        input.grupoId,
        input.franjaHorariaId,
        input.periodoId
      );

      if (!validation.valid) {
        return { success: false, reasons: validation.reasons };
      }

      await ctx.prisma.asignacion.create({
        data: {
          docenteId: input.docenteId,
          aulaId: input.aulaId,
          grupoId: input.grupoId,
          franjaHorariaId: input.franjaHorariaId,
          periodoId: input.periodoId,
          tipo: input.tipo,
        },
      });

      return { success: true, reasons: [] };
    }),

  /** Release an assigned slot */
  releaseSlot: baseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.asignacion.delete({ where: { id: input.id } });
    }),

  /** Suggest an aula based on business rules */
  suggestAula: protectedProcedure
    .input(z.object({ grupoId: z.string(), periodoId: z.string(), tipo: z.enum(['TEORIA', 'LABORATORIO']) }))
    .query(async ({ ctx, input }) => {
      const service = new AvailabilityService(ctx.prisma);
      return service.suggestAulaForGroup(input.grupoId, input.periodoId, input.tipo);
    }),

  /** Confirm schedule for a docente (marks turn as completed) */
  confirmSchedule: baseProcedure
    .input(z.object({ docenteId: z.string(), periodoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find current active turn for this docente
      const turn = await ctx.prisma.turnoDocente.findFirst({
        where: {
          docenteId: input.docenteId,
          sesion: { estado: 'EN_CURSO' }
        },
      });

      if (turn) {
        await ctx.prisma.turnoDocente.update({
          where: { id: turn.id },
          data: { estado: 'COMPLETADO' }
        });
      }

      return { success: true };
    }),
});
