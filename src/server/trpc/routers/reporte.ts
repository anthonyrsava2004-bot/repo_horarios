import { z } from 'zod';
import { createTRPCRouter, adminProcedure } from '../init';
import {
  renderPDF,
  generateAulaReportHTML,
  generateDocenteReportHTML,
  generateManagementReportHTML,
  generateCicloReportHTML,
} from '@/server/services/reports';

export const reporteRouter = createTRPCRouter({
  /** Generate PDF report — returns base64-encoded PDF */
  generatePDF: adminProcedure
    .input(z.object({
      periodoId: z.string(),
      tipo: z.enum(['por-aula', 'por-laboratorio', 'por-docente', 'por-ciclo', 'gestion']),
    }))
    .mutation(async ({ ctx, input }) => {
      const periodo = await ctx.prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: input.periodoId },
      });

      let html = '';
      const options = { landscape: true };

      if (input.tipo === 'por-aula' || input.tipo === 'por-laboratorio') {
        const aulas = await ctx.prisma.aula.findMany({
          where: input.tipo === 'por-laboratorio' ? { tipo: 'LABORATORIO' } : { tipo: 'TEORIA' },
          include: {
            asignaciones: {
              where: { periodoId: input.periodoId },
              include: {
                grupo: { include: { curso: true } },
                docente: true,
                franjaHoraria: true,
              },
            },
          },
        });

        const reportData = aulas.map(aula => ({
          aulaCodigo: aula.codigo,
          aulaNombre: aula.nombre,
          tipo: aula.tipo,
          capacidad: aula.capacidad,
          slots: aula.asignaciones.map(a => ({
            dia: a.franjaHoraria.dia,
            horaInicio: a.franjaHoraria.horaInicio,
            cursoCodigo: a.grupo.curso.codigo,
            cursoNombre: a.grupo.curso.nombre,
            grupoNombre: a.grupo.nombre,
            docenteNombre: a.docente.nombre,
            aulaCodigo: aula.codigo,
            tipo: a.tipo,
          })),
        }));

        html = generateAulaReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'por-ciclo') {
        const cursos = await ctx.prisma.curso.findMany({
          where: { aperturado: true },
          include: {
            grupos: {
              where: { periodoAcademicoId: input.periodoId },
              include: {
                asignaciones: {
                  include: { docente: true, aula: true, franjaHoraria: true },
                },
              },
            },
          },
          orderBy: { ciclo: 'asc' },
        });

        const ciclos = [...new Set(cursos.map(c => c.ciclo))].sort((a, b) => a - b);
        
        const reportData = ciclos.map(ciclo => {
          const cursosCiclo = cursos.filter(c => c.ciclo === ciclo);
          const slots: any[] = [];
          
          cursosCiclo.forEach(c => {
            c.grupos.forEach(g => {
              g.asignaciones.forEach(a => {
                slots.push({
                  dia: a.franjaHoraria.dia,
                  horaInicio: a.franjaHoraria.horaInicio,
                  cursoCodigo: c.codigo,
                  cursoNombre: c.nombre,
                  grupoNombre: g.nombre,
                  docenteNombre: a.docente.nombre,
                  aulaCodigo: a.aula.codigo,
                  tipo: a.tipo,
                });
              });
            });
          });

          return {
            ciclo,
            slots,
          };
        });

        html = generateCicloReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'por-docente') {
        const docentes = await ctx.prisma.docente.findMany({
          where: { activo: true },
          include: {
            asignaciones: {
              where: { periodoId: input.periodoId },
              include: {
                grupo: { include: { curso: true } },
                aula: true,
                franjaHoraria: true,
              },
            },
          },
        });

        const reportData = docentes
          .filter(d => d.asignaciones.length > 0)
          .map(d => ({
            docenteNombre: d.nombre,
            tipo: d.tipo,
            categoria: d.categoria,
            slots: d.asignaciones.map(a => ({
              dia: a.franjaHoraria.dia,
              horaInicio: a.franjaHoraria.horaInicio,
              cursoCodigo: a.grupo.curso.codigo,
              cursoNombre: a.grupo.curso.nombre,
              grupoNombre: a.grupo.nombre,
              docenteNombre: d.nombre,
              aulaCodigo: a.aula.codigo,
              tipo: a.tipo,
            })),
          }));

        html = generateDocenteReportHTML(reportData, periodo.nombre);
      } else if (input.tipo === 'gestion') {
        const [totalDocentes, docentesConCarga, totalGrupos, gruposAsignados, asignaciones, aulas, franjasCount] = await Promise.all([
          ctx.prisma.docente.count({ where: { activo: true } }),
          ctx.prisma.asignacion.groupBy({
            by: ['docenteId'],
            where: { periodoId: input.periodoId },
          }),
          ctx.prisma.grupo.count({ where: { periodoAcademicoId: input.periodoId } }),
          ctx.prisma.asignacion.groupBy({
            by: ['grupoId'],
            where: { periodoId: input.periodoId },
          }),
          ctx.prisma.asignacion.findMany({
            where: { periodoId: input.periodoId },
            include: { docente: true, aula: true },
          }),
          ctx.prisma.aula.findMany({
            include: {
              asignaciones: {
                where: { periodoId: input.periodoId },
              },
            },
          }),
          ctx.prisma.franjaHoraria.count(),
        ]);

        const cargaDocente = await ctx.prisma.docente.findMany({
          where: { activo: true },
          include: {
            asignaciones: {
              where: { periodoId: input.periodoId },
            },
          },
        });

        const reportData = {
          periodoNombre: periodo.nombre,
          totalDocentes,
          docentesConCarga: docentesConCarga.length,
          totalGrupos,
          gruposAsignados: gruposAsignados.length,
          totalAsignaciones: asignaciones.length,
          asignacionesConfirmadas: asignaciones.length, // Or use a confirmed field if exists
          cargaDocente: cargaDocente.map(d => ({
            nombre: d.nombre,
            tipo: d.tipo,
            categoria: d.categoria,
            horasAsignadas: d.asignaciones.length,
          })),
          ocupacionAulas: aulas.map(a => ({
            codigo: a.codigo,
            tipo: a.tipo,
            slotsOcupados: a.asignaciones.length,
            totalSlots: franjasCount,
            ocupacion: franjasCount > 0 ? Math.round((a.asignaciones.length / franjasCount) * 100) : 0,
          })),
        };

        html = generateManagementReportHTML(reportData);
      }

      const pdfBuffer = await renderPDF(html, options);
      return { pdf: pdfBuffer.toString('base64'), filename: `reporte-${input.tipo}.pdf` };
    }),
});
