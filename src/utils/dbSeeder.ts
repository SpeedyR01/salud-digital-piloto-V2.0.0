// src/utils/dbSeeder.ts
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Ajusta la ruta según tu proyecto

export const patientsFromExcel = [
  {
    name: "Ana Astrid Beltrán Agudelo",
    docType: "CC",
    docNumber: "65501115",
    role: "pacientes",
    biometrics: {
      peso_kg: 102.8,
      imc: "36.42 (Obesidad Clase II)",
      spo2: 0.99,
      frecuencia_cardiaca: "104 lpm",
      cintura_cadera: "105 cm / 133 cm",
      glucosa_ppg: "No mencionada"
    },
    clinical_profile: {
      perfil_farmacologico: "No especificados: Menciona que compra lo que le envían, pero niega ser diabética actualmente.",
      interpretacion_clinica: "La paciente presenta un perfil de alto riesgo metabólico caracterizado por obesidad grado II y una distribución de grasa de predominio ginoide (cadera 133 cm). Se observa una taquicardia en reposo (104 lpm) que, junto con el exceso de peso, sugiere un desacondicionamiento cardiovascular importante o un estado de estrés fisiológico.",
      veredicto: "APTO CONDICIONALMENTE",
      conclusion: "Ana Astrid es una paciente con obesidad significativa y riesgo cardiovascular evidente (taquicardia y distribución de grasa abdominal) que requiere una clarificación diagnóstica urgente sobre su estado glucémico. Su aptitud para el programa depende de validar su literacidad digital."
    },
    lifestyle: {
      nutricion_carga_glucemica: "La dieta de la paciente tiene una carga glucémica alta y es monótona, basada en carbohidratos complejos como arepa, arroz y pastas. La cena suele repetir carbohidratos.",
      sueno_estado_neurocognitivo: "El patrón de sueño de la paciente es altamente irregular y fragmentado, condicionado por sus horarios laborales (variaciones de 4 a 8 horas). Privación de sueño recurrente."
    },
    flags: {
      critico: "Taquicardia en reposo: Frecuencia cardíaca de 104 lpm en reposo, lo cual requiere evaluación médica inmediata.",
      moderado: "Confusión diagnóstica (afirma no ser diabética pero menciona exámenes de diabetes y compra de medicinas) y privación de sueño.",
      preventivo: "Aislamiento social: Vive sola y es reservada con sus problemas."
    }
  },
  {
    name: "María del Rocio Murillo",
    docType: "CC",
    docNumber: "29549604",
    role: "pacientes",
    biometrics: {
      peso_kg: 69.0,
      imc: "27.3 (Sobrepeso)",
      spo2: 0.97,
      frecuencia_cardiaca: "59 lpm",
      cintura_cadera: "97 cm / 106 cm",
      glucosa_ppg: "No realizada en esta sesión"
    },
    clinical_profile: {
      perfil_farmacologico: "Vildagliptina: Toma diaria, antes del almuerzo para control de diabetes. Lactobacter: Posiblemente relacionado con salud digestiva.",
      interpretacion_clinica: "Diagnóstico de diabetes mellitus tipo 2 de aproximadamente dos años de evolución. Medidas antropométricas revelan una distribución de grasa abdominal significativa. Frecuencia cardíaca en el límite inferior.",
      veredicto: "APTO CONDICIONALMENTE",
      conclusion: "La paciente es apta para el programa debido a su diagnóstico confirmado, tratamiento activo y excelente hábito de actividad física. Sin embargo, está condicionada por su estado de salud mental actual (estrés y seguimiento psiquiátrico) y su baja literacidad digital."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Alta carga glucémica y estructura monótona basada en carbohidratos refinados (arroz en desayuno y almuerzo, arepa).",
      sueno_estado_neurocognitivo: "Patrón de sueño de seis horas por noche (bajo el mínimo recomendado). Manifiesta estado emocional de estrés vinculado a necesidad de atención psiquiátrica."
    },
    flags: {
      critico: "Salud Mental y Estrés: Manifiesta estar estresada y tener una cita pendiente con psiquiatría. El estado emocional inestable puede derivar en descontrol glucémico.",
      moderado: "Desconocimiento de HbA1c (no recuerda su último valor) y dieta alta en carbohidratos.",
      preventivo: "Literacidad Digital: Aunque usa WhatsApp, muestra cierta confusión o falta de hábito."
    }
  },
  {
    name: "Milena Plaza",
    docType: "CC",
    docNumber: "38850841",
    role: "pacientes",
    biometrics: {
      peso_kg: 70.0,
      imc: "No calculado (requiere talla)",
      spo2: 0.96,
      frecuencia_cardiaca: "No mencionada",
      cintura_cadera: "91 cm / 107 cm",
      glucosa_ppg: "No realizada en esta sesión"
    },
    clinical_profile: {
      perfil_farmacologico: "No especificado: Menciona tomar 'una pastilla' pero no identifica el nombre ni la dosis.",
      interpretacion_clinica: "Distribución de grasa de tipo ginoide (riesgo metabólico moderado). Brecha crítica respecto al diagnóstico formal de diabetes y los valores de HbA1c. Baja literacidad en salud.",
      veredicto: "APTO CONDICIONALMENTE",
      conclusion: "La paciente Milena es apta para el programa debido a su excelente adherencia a la actividad física. Sin embargo, está condicionada a un entrenamiento tecnológico intensivo dado su bajo nivel de WhatsApp (2/5)."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Base sólida de alimentos naturales pero con una carga glucémica que requiere ajuste (arepa o fruta en la noche). Prefiere agua sobre jugos.",
      sueno_estado_neurocognitivo: "Sufre de insomnio de manera explícita (factor neuroendocrino crítico). Emocionalmente se describe tranquila y normal."
    },
    flags: {
      critico: "Baja Literacidad Digital: Califica su uso de WhatsApp con un 2/5 y no lo usa a diario, lo que compromete el seguimiento.",
      moderado: "Insomnio Crónico (afecta regulación metabólica) y desconocimiento farmacológico.",
      preventivo: "Aislamiento Social: Vive sola la mayor parte del tiempo, reduciendo apoyo en cambios de hábitos."
    }
  },
  {
    name: "Julieth Natalia Moreno Ariza",
    docType: "CC",
    docNumber: "1143407018",
    role: "pacientes",
    biometrics: {
      peso_kg: 79.0,
      imc: "31.6 (Obesidad Clase I)",
      spo2: 0.99,
      frecuencia_cardiaca: "67 lpm",
      cintura_cadera: "90 cm / 116 cm",
      glucosa_ppg: "No mencionado"
    },
    clinical_profile: {
      perfil_farmacologico: "No menciona: La paciente niega cambios en medicamentos y niega antecedentes de diabetes.",
      interpretacion_clinica: "Obesidad grado I con distribución de grasa ginoide. A pesar de negar diabetes, su participación sugiere riesgo metabólico o prediabetes que debe monitorearse. Sedentarismo reportado.",
      veredicto: "APTO CONDICIONALMENTE",
      conclusion: "Estilo de vida marcado por la alta demanda de sus turnos de 12 horas en salud. Su adherencia al componente digital es frágil debido al agotamiento. Condicionada a una estrategia de micro-aprendizaje por WhatsApp."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Fuertemente influenciada por entorno laboral en hospital, donde recurre a comida chatarra (empanadas, sándwiches) por falta de tiempo.",
      sueno_estado_neurocognitivo: "Patrón de sueño reparador con inclusión de siesta post-almuerzo de una hora para compensar el cansancio físico de su labor como auxiliar de enfermería."
    },
    flags: {
      critico: "Sedentarismo Extremo: No realiza ninguna actividad física programada debido a jornadas de 12 horas y fatiga acumulada.",
      moderado: "Baja Adherencia Digital: Manifiesta que 'no le queda tiempo' para responder mensajes fuera del trabajo.",
      preventivo: "Entorno Alimentario Laboral deficiente y barrera de percepción de falta de tiempo."
    }
  },
  {
    name: "Marleny Zapata",
    docType: "CC",
    docNumber: "295449855",
    role: "pacientes",
    biometrics: {
      peso_kg: 74.0,
      imc: "No calculado (Falta talla)",
      spo2: 0.97,
      frecuencia_cardiaca: "87 lpm",
      cintura_cadera: "91 cm / 106 cm",
      glucosa_ppg: "No registrada en esta sesión"
    },
    clinical_profile: {
      perfil_farmacologico: "Medicamento para la presión: Menciona tomar medicación para la presión, pero no especifica nombre ni dosis exacta.",
      interpretacion_clinica: "Distribución de grasa ginoide, perímetro abdominal de 91 cm indica riesgo cardiometabólico aumentado. Brecha de información crítica (no recuerda su última HbA1c).",
      veredicto: "APTO",
      conclusion: "Marlene es una candidata ideal para el programa debido a su alta literacidad digital, rutina de ejercicio establecida y red de apoyo familiar. Perfil de riesgo moderado-bajo."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Estructura basada en tres comidas principales con aromáticas. Admite 'picar' frecuentemente snacks o carbohidratos.",
      sueno_estado_neurocognitivo: "Patrón de sueño estable. Estrés o preocupación relacionado con factores externos, pero afirma manejar bien sus emociones. Actitud colaborativa."
    },
    flags: {
      critico: "Desconocimiento de HbA1c: No recuerda su último valor, impidiendo establecer una línea base metabólica real.",
      moderado: "Soledad en gestión de salud: Asiste sola a citas médicas fuera de su localidad a pesar de vivir con familia.",
      preventivo: "Hábito de picoteo entre comidas (riesgo para la variabilidad glucémica)."
    }
  },
  {
    name: "María de los Ángeles López",
    docType: "CC",
    docNumber: "1104674525",
    role: "pacientes",
    biometrics: {
      peso_kg: 80.0,
      imc: "34.2 (Obesidad Clase I)",
      spo2: 0.97,
      frecuencia_cardiaca: "103 lpm",
      cintura_cadera: "100 cm / 115 cm",
      glucosa_ppg: "No mencionado"
    },
    clinical_profile: {
      perfil_farmacologico: "Ninguno: La paciente declara no tomar medicamentos actualmente.",
      interpretacion_clinica: "Riesgo metabólico significativo sin diagnóstico actual. Taquicardia en reposo (103 lpm). Predominio androide de grasa (eleva riesgo cardiovascular). Fuerte carga genética familiar.",
      veredicto: "PREVENTIVO CRÍTICO",
      conclusion: "María de los Ángeles presenta múltiples factores de riesgo: obesidad, taquicardia, estrés severo y antecedentes directos. Condicionada a evaluación médica de su FC y manejo del estrés (9/10)."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Alta carga glucémica, consumo de ultraprocesados y fritos. Desayuno y cena basados en café con galletas (pobre en proteínas).",
      sueno_estado_neurocognitivo: "Duerme 8 horas cuantitativamente adecuadas, pero el nivel de estrés autopercibido es extremadamente alto (9/10) debido al ámbito laboral."
    },
    flags: {
      critico: "Taquicardia en reposo: Frecuencia cardíaca de 103 lpm detectada durante la toma de biometría.",
      moderado: "Estrés laboral extremo (9/10 en escala) y hábitos nutricionales deficientes basados en carbohidratos simples.",
      preventivo: "Antecedentes familiares en primer grado (abuelos diabéticos) combinados con su estado de sobrepeso."
    }
  },
  {
    name: "Silvia Eliza Abadia",
    docType: "CC",
    docNumber: "29538163",
    role: "pacientes",
    biometrics: {
      peso_kg: 75.0,
      imc: "No calculado (requiere talla)",
      spo2: 0.91,
      frecuencia_cardiaca: "78 lpm",
      cintura_cadera: "105 cm / 110 cm",
      glucosa_ppg: "No registrada en transcripción"
    },
    clinical_profile: {
      perfil_farmacologico: "Metformina (diabetes), Empagliflozina (no disponible este mes), Losartán, Amlodipino (presión), ASA (corazón), Sertralina (ansiedad).",
      interpretacion_clinica: "Diabetes tipo 2 (3 años de evolución). Riesgo cardiovascular muy alto (cirugía de corazón abierto). Saturación de oxígeno en el límite inferior (91%). Glaucoma secundario detectado.",
      veredicto: "APTO CONDICIONALMENTE",
      conclusion: "Candidata con alta motivación pero perfil clínico complejo y barreras críticas de acceso a medicamentos por su EPS. Su participación es viable si el equipo se adapta a su comunicación exclusiva vía audios de WhatsApp."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Patrón alimentario irregular con ventana de ayuno prolongada hasta las 10 AM. Omisión frecuente de la cena. Dieta alta en carbohidratos simples.",
      sueno_estado_neurocognitivo: "Cuenta con una excelente red de apoyo familiar (esposo e hijas en Cali) que compensan las deficiencias de su EPS para conseguir medicamentos."
    },
    flags: {
      critico: "Desabastecimiento de Medicamentos: No está tomando su segundo antidiabético ni gotas para glaucoma este mes por fallas de la EPS.",
      moderado: "Riesgo Cardiovascular Post-Quirúrgico combinado con diabetes y obesidad abdominal (cintura 105 cm).",
      preventivo: "Barrera de Literacidad: Dificultad para escribir mensajes de texto. Se deben priorizar notas de voz."
    }
  },
  {
    name: "Nairth Rivera León",
    docType: "CC",
    docNumber: "1007645426",
    role: "pacientes",
    biometrics: {
      peso_kg: 65.3,
      imc: "23.7 (Normal)",
      spo2: 0.99,
      frecuencia_cardiaca: "62 lpm",
      cintura_cadera: "82 cm / 101 cm",
      glucosa_ppg: "No mencionado mg/dL"
    },
    clinical_profile: {
      perfil_farmacologico: "Ninguno: La paciente manifiesta no tomar ningún medicamento actualmente.",
      interpretacion_clinica: "Perfil biomédico estable con IMC normal. Buena condición cardiovascular por actividad física regular (gimnasio). Riesgo metabólico latente por herencia materna.",
      veredicto: "APTO (PREVENCIÓN)",
      conclusion: "Candidata con un perfil de estilo de vida sobresaliente (buena alimentación, ejercicio y sueño). Al ser 'No Diabética' con antecedente materno, requiere HbA1c para validar si entra desde prevención primaria."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Restricción consciente de carbohidratos simples al desayuno (proteínas y café). Carga glucémica controlada en almuerzo y cena. Ausencia de bebidas azucaradas.",
      sueno_estado_neurocognitivo: "Perfil de sueño altamente saludable y reparador (7 a 8 horas continuas). Higiene del sueño adecuada y bajos niveles de estrés."
    },
    flags: {
      critico: "Sin riesgo crítico aparente.",
      moderado: "Ausencia de Exámenes Recientes: Tiene antecedentes familiares pero no conoce su estado glucémico basal real.",
      preventivo: "Alimentación fuera de casa: Consumo ocasional de snacks de forma libre."
    }
  },
  {
    name: "Concepción Virginia Trujillo Sarmiento",
    docType: "CC",
    docNumber: "38862677",
    role: "pacientes",
    biometrics: {
      peso_kg: 66.0,
      imc: "No calculado (requiere talla)",
      spo2: 0.98,
      frecuencia_cardiaca: "68 lpm",
      cintura_cadera: "95 cm / 110 cm",
      glucosa_ppg: "No registrada en la sesión"
    },
    clinical_profile: {
      perfil_farmacologico: "Concerín (posiblemente Sertralina para depresión) y medicamento no especificado para el insomnio.",
      interpretacion_clinica: "Riesgo cardiovascular latente (obesidad abdominal, cintura 95 cm). Fuerte componente hereditario (ambos padres fallecidos por diabetes). Uso de medicación psiquiátrica añade complejidad metabólica.",
      veredicto: "APTO CONDICIONALMENTE",
      conclusion: "Candidata con excelente disposición tecnológica pero con riesgos psicosociales significativos (duelo activo por viudez y depresión). El programa puede darle la estructura que necesita."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Dieta predominantemente alta en carga glucémica (arroz, lentejas, arepa y coladas diariamente). Bajo consumo de agua y nula fibra/verduras.",
      sueno_estado_neurocognitivo: "Trastorno del sueño significativo (insomnio crónico). Estado emocional marcado por un duelo no resuelto y sentimientos de soledad."
    },
    flags: {
      critico: "Salud Mental y Duelo: Estrés crónico por viudez y diagnóstico de depresión activo que pueden sabotear la adherencia.",
      moderado: "Insomnio Severo (ritmo circadiano alterado) y dieta monótona altamente glucémica.",
      preventivo: "Soledad Domiciliaria: Vive sola la mayor parte del día, aumentando riesgos ante una emergencia."
    }
  },
  {
    name: "Yenny Milena Ortiz",
    docType: "CC",
    docNumber: "1013626029",
    role: "pacientes",
    biicientes: "pacientes",
    biometrics: {
      peso_kg: 72.7,
      imc: "30.26 (Obesidad Clase I)",
      spo2: 1.0,
      frecuencia_cardiaca: "86 lpm",
      cintura_cadera: "83 cm / 115 cm",
      glucosa_ppg: "No mencionado"
    },
    clinical_profile: {
      perfil_farmacologico: "Ninguno: La paciente refiere no tomar medicamentos actualmente.",
      interpretacion_clinica: "Riesgo metabólico significativo (obesidad grado I, distribución ginoide). Antecedente familiar de primer grado (padre). Hábitos sugieren prediabetes o resistencia a la insulina.",
      veredicto: "APTO CONDICIONALMENTE",
      conclusion: "Candidata valiosa para el perfil preventivo debido a su alta trayectoria de riesgo. Su éxito dependerá de adaptar las metas nutricionales a su realidad económica y horarios laborales."
    },
    lifestyle: {
      nutricion_carga_glucemica: "Dieta desbalanceada, exceso de carbohidratos refinados (pan, arroz, papa juntos) y ausencia de fibra. Periodos de ayuno prolongados por almuerzos tardíos.",
      sueno_estado_neurocognitivo: "Duerme 7-8 horas cuantitativas, pero la profundidad del descanso se ve afectada por presiones y estrés económico/familiar constante (6/10)."
    },
    flags: {
      critico: "Riesgo de Diabetes No Diagnosticada por sintomatología metabólica latente + herencia activa.",
      moderado: "Hábitos Nutricionales Disfuncionales y sedentarismo obligado por extensión de horario laboral.",
      preventivo: "Barrera Económica para la compra constante de alimentación saludable (frutas/verduras)."
    }
  }
];

export async function seedPatientsToDatabase() {
  try {
    const patientsRef = collection(db, 'pacientes');
    for (const patient of patientsFromExcel) {
      const docRef = doc(db, 'pacientes', patient.docNumber);
      await setDoc(docRef, { 
        ...patient, 
        cedula: patient.docNumber,
        nombre: patient.name,
        createdAt: new Date().toISOString() 
      });
      console.log(`Paciente ${patient.name} insertado exitosamente.`);
    }
    alert('¡Los 10 pacientes han sido registrados en Firestore con éxito!');
  } catch (error) {
    console.error("Error al poblar la base de datos:", error);
  }
}