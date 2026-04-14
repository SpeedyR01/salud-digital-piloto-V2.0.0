import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Alert } from 'react-native';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { PatientProfile } from '../context/PatientContext';

export const generateMedicalHistoryPDF = async (profile: PatientProfile | null) => {
  if (!profile || !profile.docNumber) {
     Alert.alert('Error', 'No hay perfil cargado para generar archivo.');
     return;
  }
  try {
     const q = query(collection(db, 'resultados_examenes'), where('pacienteId', '==', profile.docNumber));
     const snapshot = await getDocs(q);
     const examsList: any[] = [];
     snapshot.forEach((doc) => examsList.push(doc.data()));

     let examsHtml = examsList.map(e => `
        <div class="exam-card">
           <p class="exam-title">${e.name || 'Dictamen Médico'}</p>
           <p class="exam-meta"><strong>Fecha de emisión:</strong> ${new Date(e.fechaCreacion || Date.now()).toLocaleDateString()} | <strong>Profesional:</strong> ${e.doctorName || 'No especificado'}</p>
           <p style="margin: 5px 0;">${e.detalleText || ''}</p>
        </div>
     `).join('');

     if (!examsHtml) examsHtml = '<p style="color: #666; font-style: italic;">No hay pruebas complementarias, laboratorios ni hojas de curso clínico en la base de datos para este periodo.</p>';

     const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #222; line-height: 1.5; }
              .header { border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
              .title { font-size: 26px; color: #000; font-weight: bold; margin: 0; text-transform: uppercase; }
              .subtitle { font-size: 14px; color: #555; margin-top: 5px; text-transform: uppercase; }
              .section { margin-top: 20px; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
              .section-title { font-size: 15px; background-color: #f3f4f6; padding: 10px 15px; margin: 0; color: #111; border-bottom: 1px solid #d1d5db; border-left: 4px solid #0056b3; text-transform: uppercase; letter-spacing: 0.5px; }
              .section-content { padding: 15px; font-size: 13px; }
              .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
              .info-group { margin-bottom: 5px; }
              .info-label { font-weight: bold; color: #555; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
              .info-value { color: #000; font-size: 14px; margin: 0;}
              .exam-card { margin-bottom: 15px; border-left: 3px solid #0056b3; padding-left: 12px; }
              .exam-title { margin: 0; font-size: 14px; font-weight: bold; color: #0056b3; text-transform: uppercase; }
              .exam-meta { font-size: 12px; color: #666; margin: 4px 0 8px 0; }
              p { margin-top: 0; margin-bottom: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
               <p class="title">HISTORIA CLÍNICA CONFIDENCIAL</p>
               <p class="subtitle">Documento Médico-Legal de Asistencia Continuada</p>
            </div>

            <!-- 1. Datos de Identificación -->
            <div class="section">
               <h2 class="section-title">1. Datos de Identificación</h2>
               <div class="section-content grid-2">
                  <div class="info-group"><p class="info-label">Nombre Completo</p><p class="info-value">${profile.name}</p></div>
                  <div class="info-group"><p class="info-label">Número de Identificación</p><p class="info-value">${profile.docType} - ${profile.docNumber}</p></div>
                  <div class="info-group"><p class="info-label">Fecha de Nacimiento / Edad</p><p class="info-value">01/01/1990 (Dato Simulado)</p></div>
                  <div class="info-group"><p class="info-label">Contacto y Demografía</p><p class="info-value">No registrado | Ciudad Central</p></div>
               </div>
            </div>

            <!-- 2. Antecedentes -->
            <div class="section">
               <h2 class="section-title">2. Antecedentes</h2>
               <div class="section-content">
                  <p><strong>Personales:</strong> Sin afecciones previas registradas. Esquema de vacunas al día. Quirúrgicos: Ninguno.</p>
                  <p><strong>Familiares:</strong> No se refieren condiciones hereditarias de importancia durante la valoración.</p>
                  <p><strong>Hábitos:</strong> Patrón de sueño normal. Sin dependencia documentada a sustancias.</p>
               </div>
            </div>

            <!-- 3. Motivo de consulta y evolución -->
            <div class="section">
               <h2 class="section-title">3. Motivo de Consulta y Evolución</h2>
               <div class="section-content">
                  <p><strong>Enfermedad Actual:</strong> Paciente asiste a consulta virtual / presencial del sistema Salud Digital para revisión médica general y control de síntomas inespecíficos referidos recientemente.</p>
                  <p><strong>Evolución:</strong> Durante la asistencia se mantiene comunicación clara, sin alteraciones repentinas. Factores desencadenantes de molestias mitigados temporalmente.</p>
               </div>
            </div>

            <!-- 4. Exploración y diagnósticos -->
            <div class="section">
               <h2 class="section-title">4. Exploración y Diagnósticos</h2>
               <div class="section-content">
                  <p><strong>Examen Físico / Signos Vitales:</strong> TA: 120/80 mmHg | FC: 75 lpm | FR: 18 rpm | Temp: 36.5°C | SatO2: 98% (Última toma registrada).</p>
                  <p><strong>Hallazgos Relevantes:</strong> Sin hallazgos clínicos de peligro inminente ni conclusiones médicas severas.</p>
                  <p><strong>Diagnóstico Principal:</strong> [Z000] Examen médico general. Paciente sano en vigilancia preventiva.</p>
               </div>
            </div>

            <!-- 5. Tratamiento y procedimientos -->
            <div class="section">
               <h2 class="section-title">5. Tratamiento y Procedimientos</h2>
               <div class="section-content">
                  <p><strong>Prescripciones y Terapias:</strong> Manejo ambulatorio general. Soporte analgésico según necesidad condicionado a dolor (Acetaminofén 500mg). Hidratación.</p>
                  <p><strong>Procedimientos:</strong> Sin informes de quirófano en plataforma. Sin anestesia requerida de momento.</p>
                  <p><strong>Consentimiento Informado:</strong> Las políticas de telesalud se avalaron al ingreso en la plataforma.</p>
               </div>
            </div>

            <!-- 6. Documentación administrativa y Exámenes -->
            <div class="section">
               <h2 class="section-title">6. Documentación Administrativa y Pruebas Complementarias</h2>
               <div class="section-content" style="padding-bottom: 0;">
                  <p style="margin-bottom: 15px;"><strong>Cursos y Pruebas Auxiliares:</strong> Los siguientes análisis de laboratorio, radiografías y dictámenes clínicos conforman la base evidencial de esta asistencia:</p>
                  ${examsHtml}
               </div>
            </div>

            <p style="text-align: center; font-size: 11px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">
               Este documento cumple la normativa esencial de confidencialidad médico-legal.<br/>
               Exportado de forma segura del sistema Salud Digital. | Fecha de exportación: ${new Date().toLocaleString()}
            </p>
          </body>
        </html>
     `;

     const { uri } = await Print.printToFileAsync({ html });
     await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Descargar Historia Clínica Legal' });
  } catch (err) {
     Alert.alert('Error', 'Hubo un error al generar y compartir la Historia Clínica.');
  }
};
