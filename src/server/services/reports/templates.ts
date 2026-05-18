/**
 * PDF Report Templates — HTML generators for Puppeteer rendering.
 *
 * Two report types:
 * 1. Operational: Schedule by aula, lab, or docente
 * 2. Management: Executive summary with stats
 */

const STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.4;
    }
    .page { page-break-after: always; padding: 20mm 15mm; }
    .page:last-child { page-break-after: auto; }

    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h1 { font-size: 16px; color: #1e1b4b; margin-bottom: 2px; }
    .header h2 { font-size: 12px; color: #4f46e5; font-weight: 500; }
    .header p { font-size: 10px; color: #6b7280; margin-top: 4px; }

    /* Grid Table */
    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    .schedule-table th {
      background: #4f46e5;
      color: white;
      padding: 6px 4px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 8px;
      letter-spacing: 0.5px;
    }
    .schedule-table td {
      border: 1px solid #e5e7eb;
      padding: 4px;
      vertical-align: top;
      min-height: 40px;
    }
    .schedule-table tr:nth-child(even) td { background: #f9fafb; }
    .hora-cell {
      background: #f3f4f6 !important;
      font-weight: 600;
      text-align: center;
      width: 50px;
      color: #374151;
    }
    .slot-content {
      background: #eef2ff;
      border-radius: 3px;
      padding: 2px 4px;
      margin: 1px 0;
      border-left: 2px solid #6366f1;
    }
    .slot-content .curso { font-weight: 600; color: #1e1b4b; }
    .slot-content .detalle { color: #6b7280; font-size: 8px; }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .stat-card .value { font-size: 24px; font-weight: 700; color: #4f46e5; }
    .stat-card .label { font-size: 9px; color: #6b7280; margin-top: 4px; }

    /* Lists */
    .section { margin-bottom: 16px; }
    .section h3 {
      font-size: 12px;
      color: #1e1b4b;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .carga-table { width: 100%; border-collapse: collapse; }
    .carga-table th {
      background: #f3f4f6;
      padding: 6px 8px;
      text-align: left;
      font-size: 9px;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    .carga-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #f3f4f6;
    }
    .carga-table tr:nth-child(even) { background: #fafafa; }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 600;
    }
    .badge-nombrado { background: #dbeafe; color: #1e40af; }
    .badge-contratado { background: #fef3c7; color: #92400e; }
    .badge-confirmed { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fee2e2; color: #991b1b; }

    .footer {
      position: fixed;
      bottom: 10mm;
      left: 15mm;
      right: 15mm;
      text-align: center;
      font-size: 8px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 4px;
    }
  </style>
`;

const DIAS_LABELS: Record<string, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes',
};

const DIAS_ORDER = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

interface SlotData {
  dia: string;
  horaInicio: string;
  cursoCodigo: string;
  cursoNombre: string;
  grupoNombre: string;
  docenteNombre: string;
  aulaCodigo: string;
  tipo: string;
}

interface AulaReportData {
  aulaCodigo: string;
  aulaNombre: string;
  tipo: string;
  capacidad: number;
  slots: SlotData[];
}

interface DocenteReportData {
  docenteNombre: string;
  tipo: string;
  categoria: string;
  slots: SlotData[];
}

interface CicloReportData {
  ciclo: number;
  slots: SlotData[];
}

interface ManagementData {
  periodoNombre: string;
  totalDocentes: number;
  docentesConCarga: number;
  totalGrupos: number;
  gruposAsignados: number;
  totalAsignaciones: number;
  asignacionesConfirmadas: number;
  cargaDocente: Array<{
    nombre: string;
    tipo: string;
    categoria: string;
    horasAsignadas: number;
  }>;
  ocupacionAulas: Array<{
    codigo: string;
    tipo: string;
    slotsOcupados: number;
    totalSlots: number;
    ocupacion: number;
  }>;
}

function header(title: string, subtitle: string, periodo: string): string {
  return `
    <div class="header">
      <h1>Universidad Nacional de Trujillo</h1>
      <h2>Escuela de Ingeniería de Sistemas — ${title}</h2>
      <p>${subtitle} · Periodo: ${periodo} · Generado: ${new Date().toLocaleDateString('es-PE', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })}</p>
    </div>
  `;
}

function scheduleGrid(slots: SlotData[], horas: string[]): string {
  const rendered = new Set<string>(); // Keep track of rendered cells for rowSpan

  return `
    <table class="schedule-table">
      <thead>
        <tr>
          <th>Hora</th>
          ${DIAS_ORDER.map((d) => `<th>${DIAS_LABELS[d]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${horas.map((hora, rowIndex) => `
          <tr>
            <td class="hora-cell">${hora}</td>
            ${DIAS_ORDER.map((dia) => {
              const key = `${dia}-${hora}`;
              if (rendered.has(key)) return '';

              const s = slots.find((sl) => sl.dia === dia && sl.horaInicio === hora);
              if (!s) return '<td></td>';

              // Calculate rowSpan
              let rowSpan = 1;
              for (let i = rowIndex + 1; i < horas.length; i++) {
                const nextHora = horas[i];
                const nextS = slots.find((sl) => sl.dia === dia && sl.horaInicio === nextHora);
                if (nextS && nextS.cursoCodigo === s.cursoCodigo && nextS.grupoNombre === s.grupoNombre && nextS.aulaCodigo === s.aulaCodigo) {
                  rowSpan++;
                  rendered.add(`${dia}-${nextHora}`);
                } else {
                  break;
                }
              }

              return `
                <td rowspan="${rowSpan}">
                  <div class="slot-content">
                    <div class="curso">${s.cursoCodigo} G${s.grupoNombre}</div>
                    <div class="detalle">${s.docenteNombre.split(' ').slice(0, 2).join(' ')}</div>
                    <div class="detalle">${s.aulaCodigo} · ${s.tipo}</div>
                  </div>
                </td>
              `;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── OPERATIONAL REPORTS ────────────────────────────

export function generateAulaReportHTML(
  aulas: AulaReportData[],
  periodoNombre: string
): string {
  const allHoras = [...new Set(aulas.flatMap((a) => a.slots.map((s) => s.horaInicio)))].sort();
  const defaultHoras = allHoras.length > 0 ? allHoras : Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

  const pages = aulas.map((aula) => `
    <div class="page">
      ${header(
        `Horario por ${aula.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Aula'}`,
        `${aula.aulaCodigo} — ${aula.aulaNombre} (Cap: ${aula.capacidad})`,
        periodoNombre
      )}
      ${scheduleGrid(aula.slots, defaultHoras)}
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head>${STYLES}</head><body>${pages}<div class="footer">Sistema de Horarios ISI — UNT</div></body></html>`;
}

export function generateDocenteReportHTML(
  docentes: DocenteReportData[],
  periodoNombre: string
): string {
  const defaultHoras = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

  const pages = docentes.map((doc) => `
    <div class="page">
      ${header(
        'Horario por Docente',
        `${doc.docenteNombre} — ${doc.tipo} ${doc.categoria}`,
        periodoNombre
      )}
      ${scheduleGrid(doc.slots, defaultHoras)}
      <div class="section" style="margin-top: 12px;">
        <p style="font-size: 10px; color: #6b7280;">
          Total de horas asignadas: <strong>${doc.slots.length}</strong>
        </p>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head>${STYLES}</head><body>${pages}<div class="footer">Sistema de Horarios ISI — UNT</div></body></html>`;
}

export function generateCicloReportHTML(
  ciclos: CicloReportData[],
  periodoNombre: string
): string {
  const defaultHoras = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

  const pages = ciclos.map((c) => `
    <div class="page">
      ${header(
        'Horario por Ciclo',
        `Ciclo Académico ${c.ciclo}`,
        periodoNombre
      )}
      ${scheduleGrid(c.slots, defaultHoras)}
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head>${STYLES}</head><body>${pages}<div class="footer">Sistema de Horarios ISI — UNT</div></body></html>`;
}

// ─── MANAGEMENT REPORT ──────────────────────────────

export function generateManagementReportHTML(data: ManagementData): string {
  const completionRate = data.totalGrupos > 0
    ? Math.round((data.gruposAsignados / data.totalGrupos) * 100) : 0;
  const confirmRate = data.totalAsignaciones > 0
    ? Math.round((data.asignacionesConfirmadas / data.totalAsignaciones) * 100) : 0;

  return `
    <!DOCTYPE html>
    <html><head>${STYLES}</head>
    <body>
      <div class="page">
        ${header('Reporte de Gestión', 'Resumen Ejecutivo de Asignación de Horarios', data.periodoNombre)}

        <!-- KPIs -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="value">${data.totalDocentes}</div>
            <div class="label">Docentes Activos</div>
          </div>
          <div class="stat-card">
            <div class="value">${completionRate}%</div>
            <div class="label">Cobertura de Grupos</div>
          </div>
          <div class="stat-card">
            <div class="value">${data.totalAsignaciones}</div>
            <div class="label">Asignaciones Totales</div>
          </div>
          <div class="stat-card">
            <div class="value">${confirmRate}%</div>
            <div class="label">Tasa de Confirmación</div>
          </div>
        </div>

        <!-- Resumen -->
        <div class="section">
          <h3>Resumen de Asignación</h3>
          <table class="carga-table">
            <tr><th>Indicador</th><th>Valor</th><th>Observación</th></tr>
            <tr>
              <td>Docentes con carga</td>
              <td><strong>${data.docentesConCarga}</strong> / ${data.totalDocentes}</td>
              <td>${data.totalDocentes - data.docentesConCarga} docentes sin carga asignada</td>
            </tr>
            <tr>
              <td>Grupos asignados</td>
              <td><strong>${data.gruposAsignados}</strong> / ${data.totalGrupos}</td>
              <td>${data.totalGrupos - data.gruposAsignados > 0 ? `⚠ ${data.totalGrupos - data.gruposAsignados} sin asignar` : '✅ Completo'}</td>
            </tr>
            <tr>
              <td>Asignaciones confirmadas</td>
              <td><strong>${data.asignacionesConfirmadas}</strong> / ${data.totalAsignaciones}</td>
              <td><span class="badge ${confirmRate >= 80 ? 'badge-confirmed' : 'badge-pending'}">${confirmRate >= 80 ? 'OK' : 'PENDIENTE'}</span></td>
            </tr>
          </table>
        </div>

        <!-- Carga Docente -->
        <div class="section">
          <h3>Carga Horaria por Docente</h3>
          <table class="carga-table">
            <tr><th>#</th><th>Docente</th><th>Tipo</th><th>Categoría</th><th>Horas</th></tr>
            ${data.cargaDocente
              .sort((a, b) => b.horasAsignadas - a.horasAsignadas)
              .map((d, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${d.nombre}</td>
                  <td><span class="badge ${d.tipo === 'NOMBRADO' ? 'badge-nombrado' : 'badge-contratado'}">${d.tipo}</span></td>
                  <td>${d.categoria}</td>
                  <td><strong>${d.horasAsignadas}</strong></td>
                </tr>
              `).join('')}
          </table>
        </div>
      </div>

      <!-- Page 2: Ocupación de Aulas -->
      <div class="page">
        ${header('Reporte de Gestión', 'Ocupación de Ambientes', data.periodoNombre)}

        <div class="section">
          <h3>Ocupación de Aulas y Laboratorios</h3>
          <table class="carga-table">
            <tr><th>Ambiente</th><th>Tipo</th><th>Slots Usados</th><th>Total</th><th>Ocupación</th></tr>
            ${data.ocupacionAulas
              .sort((a, b) => b.ocupacion - a.ocupacion)
              .map((a) => `
                <tr>
                  <td><strong>${a.codigo}</strong></td>
                  <td>${a.tipo}</td>
                  <td>${a.slotsOcupados}</td>
                  <td>${a.totalSlots}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <div style="width:60px;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
                        <div style="width:${a.ocupacion}%;height:100%;background:${a.ocupacion > 75 ? '#ef4444' : a.ocupacion > 50 ? '#f59e0b' : '#10b981'};border-radius:4px;"></div>
                      </div>
                      <span>${a.ocupacion}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
          </table>
        </div>
      </div>

      <div class="footer">Sistema de Horarios ISI — UNT</div>
    </body></html>
  `;
}
