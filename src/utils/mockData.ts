import { DocType } from '../context/PatientContext';

export const docTypeOptions: Array<{ id: DocType; label: string }> = [
  { id: 'CC', label: 'Cédula de ciudadanía (CC)' },
  { id: 'CE', label: 'Cédula de extranjería (CE)' },
  { id: 'Pasaporte', label: 'Pasaporte' },
];

export const emergencyNumberDefault = '123';

export type Slot = { id: string; label: string };

export const slotOptions: Slot[] = [
  { id: 's1', label: 'Hoy - 15:00' },
  { id: 's2', label: 'Hoy - 16:00' },
  { id: 's3', label: 'Mañana - 09:00' },
  { id: 's4', label: 'Mañana - 11:00' },
  { id: 's5', label: 'Esta semana - 10:00' },
];

export const specializations = ['Cardiología', 'Neurología', 'Oftalmología', 'Ortopedia', 'Psicología', 'Dermatología'];

export type Exam = {
  id: string;
  name: string;
  requestedAt: string; // ISO
  status: 'Disponible' | 'Pendiente';
  summary: string;
  mockContentLabel: string;
};

export const exams: Exam[] = [
  {
    id: 'e1',
    name: 'Análisis de sangre',
    requestedAt: '2026-03-12',
    status: 'Disponible',
    summary:
      'Resultado de ejemplo para análisis de sangre. Para interpretación real, consulte a su médico.',
    mockContentLabel: 'PDF/Imagen de ejemplo (simulado)',
  },
  {
    id: 'e2',
    name: 'Radiografía de tórax',
    requestedAt: '2026-02-05',
    status: 'Disponible',
    summary: 'Resultado de ejemplo para radiografía de tórax. Esto es solo una vista piloto.',
    mockContentLabel: 'Vista de documento (simulado)',
  },
  {
    id: 'e3',
    name: 'Examen general de orina',
    requestedAt: '2026-03-25',
    status: 'Pendiente',
    summary: 'Examen solicitado. En la versión piloto, este estado se muestra como ejemplo.',
    mockContentLabel: 'Documento aún no disponible',
  },
];

export type HistoryEntry = {
  id: string;
  date: string; // ISO
  serviceLabel: string; // Medico general / Especialista
  title: string;
  motivo: string;
  diagnostico: string;
  recomendaciones: string[];
  linkedExamIds: string[];
};

export const historyEntries: HistoryEntry[] = [
  {
    id: 'h1',
    date: '2026-01-10',
    serviceLabel: 'Médico general',
    title: 'Consulta general - Control',
    motivo: 'Dolor leve y seguimiento de síntomas',
    diagnostico: 'Diagnóstico de ejemplo (no clínico)',
    recomendaciones: ['Hidratación', 'Reposo relativo', 'Control con telemedicina si persiste'],
    linkedExamIds: ['e1'],
  },
  {
    id: 'h2',
    date: '2025-12-05',
    serviceLabel: 'Especialista (Cardiología)',
    title: 'Consulta especialista - Revisión',
    motivo: 'Revisión de presión arterial y síntomas ocasionales',
    diagnostico: 'Diagnóstico de ejemplo (no clínico)',
    recomendaciones: ['Registrar presión 3 días', 'Revisión programada', 'Seguir indicaciones de su médico'],
    linkedExamIds: ['e2'],
  },
];

export type MockHospital = { id: string; name: string; lat: number; lng: number };
export const mockHospitals: MockHospital[] = [
  { id: 'hosp1', name: 'Hospital Central (Ejemplo)', lat: 4.711, lng: -74.0721 },
  { id: 'hosp2', name: 'Clínica Santa Salud (Ejemplo)', lat: 4.69, lng: -74.05 },
  { id: 'hosp3', name: 'Centro Médico Norte (Ejemplo)', lat: 4.74, lng: -74.1 },
];
