-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DOCENTE', 'ESTUDIANTE', 'INVITADO', 'REPRESENTANTE_ESCUELA');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('PLANIFICACION', 'POSTULACION', 'ASIGNACION', 'FINALIZADO');

-- AlterEnum
ALTER TYPE "TipoAsignacion" ADD VALUE 'PRACTICA';

-- AlterTable
ALTER TABLE "cursos" ADD COLUMN     "aperturado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "especialidad_requerida" TEXT,
ADD COLUMN     "experiencia_minima" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grado_requerido" TEXT,
ADD COLUMN     "perfil_requerido" TEXT;

-- AlterTable
ALTER TABLE "docentes" ADD COLUMN     "especialidad" TEXT,
ADD COLUMN     "experiencia_anios" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grado_academico" TEXT,
ADD COLUMN     "perfil_academico" TEXT;

-- AlterTable
ALTER TABLE "periodos_academicos" ADD COLUMN     "estado" "EstadoPeriodo" NOT NULL DEFAULT 'PLANIFICACION';

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DOCENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "docente_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "accion" TEXT NOT NULL,
    "detalles" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidades_docentes" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "franja_horaria_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidades_docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postulaciones_cursos" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 1,
    "compatibilidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postulaciones_cursos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_docente_id_key" ON "users"("docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_docentes_docente_id_franja_horaria_id_key" ON "disponibilidades_docentes"("docente_id", "franja_horaria_id");

-- CreateIndex
CREATE UNIQUE INDEX "postulaciones_cursos_docente_id_curso_id_key" ON "postulaciones_cursos"("docente_id", "curso_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades_docentes" ADD CONSTRAINT "disponibilidades_docentes_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades_docentes" ADD CONSTRAINT "disponibilidades_docentes_franja_horaria_id_fkey" FOREIGN KEY ("franja_horaria_id") REFERENCES "franjas_horarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones_cursos" ADD CONSTRAINT "postulaciones_cursos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "docentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones_cursos" ADD CONSTRAINT "postulaciones_cursos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
