import { PrismaClient, CategoriaDocente, TipoDocente } from '@/generated/prisma/client';

const CATEGORIA_PRIORITY: Record<CategoriaDocente, number> = {
  PRINCIPAL: 1,
  ASOCIADO: 2,
  AUXILIAR: 3,
  JEFE_PRACTICA: 4,
};

const TIPO_PRIORITY: Record<TipoDocente, number> = {
  NOMBRADO: 1,
  CONTRATADO: 2,
};

export class AssignmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Phase 1: Assign teachers to courses/groups based on postulations.
   */
  async processPostulations(periodoId: string) {
    const periodo = await this.prisma.periodoAcademico.findUniqueOrThrow({ where: { id: periodoId } });
    if (periodo.estado !== 'POSTULACION') {
      throw new Error('El periodo no está en fase de postulación');
    }

    // 1. Get all apertured courses and their groups
    const groups = await this.prisma.grupo.findMany({
      where: { periodoAcademicoId: periodoId, curso: { aperturado: true } },
      include: {
        curso: {
          include: {
            postulaciones: {
              include: { docente: true },
            },
          },
        },
      },
    });

    const assignments = [];

    // 2. Sort groups (maybe by cycle or importance)
    for (const grupo of groups) {
      const postulaciones = grupo.curso.postulaciones;
      
      // Filter by compatibility > 70%
      const validPostulations = postulaciones.filter(p => p.compatibilidad > 70);

      if (validPostulations.length === 0) continue;

      // Sort candidates by hierarchy and seniority
      const sortedCandidates = validPostulations.sort((a, b) => {
        // Hierarchy first
        const catA = CATEGORIA_PRIORITY[a.docente.categoria];
        const catB = CATEGORIA_PRIORITY[b.docente.categoria];
        if (catA !== catB) return catA - catB;

        const tipoA = TIPO_PRIORITY[a.docente.tipo];
        const tipoB = TIPO_PRIORITY[b.docente.tipo];
        if (tipoA !== tipoB) return tipoA - tipoB;

        // Seniority
        return a.docente.antiguedad.getTime() - b.docente.antiguedad.getTime();
      });

      // Find first candidate that hasn't exceeded their load limit
      // (This is tricky because we assign groups one by one)
      let selectedCandidate = null;
      for (const candidate of sortedCandidates) {
        const currentLoad = await this.calculateCurrentLoad(candidate.docenteId, periodoId);
        const groupLoad = grupo.curso.horasTeoria + grupo.curso.horasLaboratorio;
        const maxLoad = candidate.docente.tipo === 'NOMBRADO' ? 16 : 24;

        if (currentLoad + groupLoad <= maxLoad) {
          selectedCandidate = candidate;
          break;
        }
      }

      if (selectedCandidate) {
        await this.prisma.docenteGrupo.upsert({
          where: { docenteId_grupoId: { docenteId: selectedCandidate.docenteId, grupoId: grupo.id } },
          create: { docenteId: selectedCandidate.docenteId, grupoId: grupo.id },
          update: {},
        });
        assignments.push({ grupoId: grupo.id, docenteId: selectedCandidate.docenteId });
      }
    }

    // Update period state
    await this.prisma.periodoAcademico.update({
      where: { id: periodoId },
      data: { estado: 'ASIGNACION' },
    });

    return assignments;
  }

  private async calculateCurrentLoad(docenteId: string, periodoId: string): Promise<number> {
    const assignedGroups = await this.prisma.docenteGrupo.findMany({
      where: { docenteId, grupo: { periodoAcademicoId: periodoId } },
      include: { grupo: { include: { curso: true } } },
    });

    return assignedGroups.reduce((acc, ag) => {
      return acc + ag.grupo.curso.horasTeoria + ag.grupo.curso.horasLaboratorio;
    }, 0);
  }
}
