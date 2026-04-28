import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, FlatList, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, getDoc, addDoc, doc, setDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';

import { styles } from '../theme/globalStyles';
import { usePatient } from '../context/PatientContext';
import { Nav, RootStackParamList } from '../config/types';
import { LargePrimaryButton, ScreenChrome, callEmergency, AppHeader } from '../components/SharedComponents';
import { historyEntries, exams, mockHospitals, Exam, emergencyNumberDefault } from '../utils/mockData';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  if (!d) return iso;
  return `${d}/${m}/${y}`;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


// --- 1. HISTORIAL MEDICO ---

export function MedicalHistoryScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
      return;
    }

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'citas'),
          where('pacienteDoc', '==', String(profile.docNumber)),
          where('estado', '==', 'Completada')
        );
        const snapshot = await getDocs(q);

        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        const results: any[] = [];
        for (const d of snapshot.docs) {
          const data = d.data();
          const citaDate = new Date(`${data.fecha}T00:00:00`);
          if (now.getTime() - citaDate.getTime() <= thirtyDaysMs) {
            results.push({ ...data, id: d.id });
          }
        }

        results.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setHistory(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [profile, nav]);

  return (
    <ScreenChrome title="Mi historial médico" subtitle="Consultas completadas en los últimos 30 días.">
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
        ) : history.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: '#6b7280' }}>No tienes consultas recientes completadas.</Text>
        ) : (
          history.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => nav.navigate('MedicalHistoryDetail', { historyId: h.id })}
              style={({ pressed }) => [styles.rowCard, pressed ? styles.rowCardPressed : null]}
            >
              <Text style={styles.rowTitle}>Consulta {h.especialidad}</Text>
              <Text style={styles.rowSubtitle}>
                Dr(a). {h.doctorNombre} - Fecha: {formatDate(h.fecha)}
              </Text>
              <Text style={styles.badgeMuted}>Ver detalle</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ScreenChrome>
  );
}

export function MedicalHistoryDetailScreen({ route }: { route: { params: { historyId: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [h, setH] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
      return;
    }
    const fetchDocData = async () => {
      try {
        const mockH = historyEntries.find(x => x.id === route.params.historyId);
        if (mockH) {
          setH(mockH);
          return;
        }

        const docSnap = await getDoc(doc(db, 'citas', route.params.historyId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setH({
            id: docSnap.id,
            title: `Consulta ${data.especialidad}`,
            serviceLabel: `Dr(a). ${data.doctorNombre}`,
            date: data.fecha,
            motivo: data.notas_motivo || 'Consulta médica general.',
            diagnostico: data.notas_diagnostico || 'Evaluación clínica completada satisfactoriamente.',
            recomendaciones: data.notas_recomendaciones || ['Continuar tratamiento según indicaciones médicas.'],
            linkedExamIds: []
          });
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchDocData();
  }, [profile, nav, route.params.historyId]);

  if (loading) {
    return (
      <ScreenChrome title="Detalle de consulta" subtitle="Cargando...">
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
      </ScreenChrome>
    );
  }

  if (!h) {
    return (
      <ScreenChrome title="Historial" subtitle="No encontrado.">
        <ScrollView contentContainerStyle={styles.content}>
          <LargePrimaryButton label="Volver" onPress={() => nav.navigate('MedicalHistory')} />
        </ScrollView>
      </ScreenChrome>
    );
  }

  const linkedExams = (h.linkedExamIds || []).map((id: string) => exams.find((e) => e.id === id)).filter(Boolean) as Exam[];

  return (
    <ScreenChrome title="Detalle de consulta" subtitle="Vista de historial (piloto).">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.rowCard}>
          <Text style={styles.rowTitle}>{h.title}</Text>
          <Text style={styles.rowSubtitle}>
            {h.serviceLabel} - {formatDate(h.date)}
          </Text>
          <Text style={[styles.normalText, { marginTop: 12 }]}>
            <Text style={styles.bold}>Motivo:</Text> {h.motivo}
          </Text>
          <Text style={styles.normalText}>
            <Text style={styles.bold}>Diagnóstico:</Text> {h.diagnostico}
          </Text>
        </View>

        <View style={styles.sectionDivider} />
        <Text style={styles.sectionLabel}>Recomendaciones</Text>
        <View style={{ height: 10 }} />
        {h.recomendaciones?.map((r: string, idx: number) => (
          <View key={`${h.id}-${idx}`} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.normalText}>{r}</Text>
          </View>
        ))}

        <View style={styles.sectionDivider} />
        <Text style={styles.sectionLabel}>Exámenes relacionados</Text>
        <View style={{ height: 10 }} />
        {linkedExams.length ? (
          linkedExams.map((e) => (
            <LargePrimaryButton
              key={e.id}
              label={e.name}
              tone="muted"
              onPress={() => nav.navigate('ExamDetail', { examId: e.id })}
            />
          ))
        ) : (
          <Text style={styles.normalText}>Sin exámenes asociados (piloto).</Text>
        )}

        <View style={{ height: 16 }} />
        <LargePrimaryButton label="Volver al historial" onPress={() => nav.navigate('MedicalHistory')} />
      </ScrollView>
    </ScreenChrome>
  );
}


// --- 2. EMERGENCIAS ---

export function EmergencyFlowScreen() {
  const nav = useNavigation<Nav>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff1f2' }}>
      <AppHeader
        title="🚨 EMERGENCIAS"
        showBack={true}
        onBack={() => nav.goBack()}
      />

      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#fecaca', justifyContent: 'center', alignItems: 'center', shadowColor: '#dc2626', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
            <Text style={{ fontSize: 48 }}>🆘</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#7f1d1d', marginTop: 14, textAlign: 'center' }}>
            ¿Necesita ayuda ahora?
          </Text>
          <Text style={{ fontSize: 15, color: '#b91c1c', marginTop: 6, textAlign: 'center', lineHeight: 22 }}>
            Pulse el botón para llamar directamente{'\n'}al número nacional de emergencias.
          </Text>
        </View>

        <Pressable
          onPress={callEmergency}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#b91c1c' : '#dc2626',
            borderRadius: 18, paddingVertical: 22,
            flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12,
            shadowColor: '#dc2626', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
          })}
        >
          <Text style={{ fontSize: 28 }}>📞</Text>
          <View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Llamar al 123</Text>
            <Text style={{ color: '#fecaca', fontSize: 13 }}>Número nacional de emergencias</Text>
          </View>
        </Pressable>

        <View style={{ backgroundColor: '#fee2e2', borderRadius: 14, padding: 16, borderLeftWidth: 4, borderLeftColor: '#dc2626' }}>
          <Text style={{ fontWeight: '700', color: '#7f1d1d', marginBottom: 6 }}>⚠️ Información importante</Text>
          <Text style={{ color: '#991b1b', lineHeight: 20 }}>
            Al presionar "Llamar ahora", su dispositivo iniciará una llamada al número 123. Mantenga la calma y siga las instrucciones del operador.
          </Text>
        </View>

        <View style={{ backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: '700', color: '#374151', marginBottom: 4 }}>📍 Ubicación (próximamente)</Text>
          <Text style={{ color: '#6b7280', fontSize: 13, lineHeight: 20 }}>
            En la próxima fase del piloto, la app detectará automáticamente su ubicación y la enviará a los servicios de emergencia.
          </Text>
        </View>

        <Pressable
          onPress={() => nav.goBack()}
          style={({ pressed }) => ({ marginTop: 8, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: pressed ? '#f3f4f6' : '#fff', borderWidth: 1, borderColor: '#e5e7eb' })}
        >
          <Text style={{ color: '#6b7280', fontWeight: '600', fontSize: 15 }}>Volver sin llamar</Text>
        </Pressable>

        <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, lineHeight: 18 }}>
          Este botón no sustituye la atención médica presencial.{'\n'}Para emergencias siempre consulte un profesional.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}


// --- 3. SINTOMAS ---

export function SymptomReportScreen() {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [userProfile, setUserProfile] = useState<{ docNumber: string, name: string } | null>(null);

  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { especialistaId } = route.params || {};

  useEffect(() => {
    const getSession = async () => {
      try {
        const sessionString = await AsyncStorage.getItem('userSession');
        if (sessionString) {
          const session = JSON.parse(sessionString);
          setUserProfile({
            docNumber: session.cedula || session.docNumber,
            name: session.nombre || session.name
          });
        }
      } catch (e) {
        console.error("Error cargando sesión", e);
      }
    };
    getSession();
  }, []);

  const handleSave = async () => {
    setStatusMessage(null);
    if (!userProfile) {
      setStatusMessage({ type: 'error', text: 'Error: No se encontró tu sesión de usuario.' });
      return;
    }
    if (!symptoms.trim()) {
      setStatusMessage({ type: 'error', text: 'Escribe tus síntomas antes de enviar.' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const oneJan = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.ceil((((now.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);

      const nuevoRegistro = {
        pacienteDoc: String(userProfile.docNumber),
        pacienteNombre: userProfile.name,
        semana: weekNumber,
        sintomas: symptoms.trim(),
        fecha: now.toISOString(),
        especialistaId: String(especialistaId || "1234567890"),
        revisado: false,
        enviadoAHistoriaClinica: false
      };

      await addDoc(collection(db, 'reportes_sintomas'), nuevoRegistro);

      setStatusMessage({ type: 'success', text: '¡Síntomas enviados con éxito!' });
      setSymptoms('');

      setTimeout(() => nav.goBack(), 2000);

    } catch (error: any) {
      setStatusMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Reportar Síntomas"
        showBack={nav.canGoBack()}
        onBack={() => nav.goBack()}
      />

      <Text style={styles.sessionInfo}>
        Reportando como: {userProfile ? userProfile.name : 'Cargando sesión...'}
      </Text>

      {statusMessage && (
        <View style={[styles.statusBox, statusMessage.type === 'success' ? styles.statusSuccess : styles.statusError]}>
          <Text style={[styles.statusText, statusMessage.type === 'success' ? styles.statusTextSuccess : styles.statusTextError]}>
            {statusMessage.text}
          </Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="¿Cómo te sientes hoy?"
        multiline
        value={symptoms}
        onChangeText={setSymptoms}
        editable={!loading}
      />

      <Pressable onPress={handleSave} disabled={loading} style={styles.button}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar Reporte Real</Text>}
      </Pressable>
    </SafeAreaView>
  );
}


// --- 4. DASHBOARD DOCTOR ---

export function DoctorDashboardScreen() {
  const [bottomTab, setBottomTab] = useState<'home' | 'schedule' | 'clinical' | 'profile'>('home');
  const [activeTab, setActiveTab] = useState<'sintomas' | 'examenes'>('sintomas');
  const [doctorData, setDoctorData] = useState<any>(null);

  const [selectedDoctorDate, setSelectedDoctorDate] = useState<string>('');
  const [doctorSlots, setDoctorSlots] = useState<{ [hora: string]: boolean }>({});
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [citasDelDia, setCitasDelDia] = useState<any[]>([]);
  const baseSlots = useMemo(() => ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'], []);

  const [allReportes, setAllReportes] = useState<any[]>([]);
  const [filteredReportes, setFilteredReportes] = useState<any[]>([]);
  const [loadingSintomas, setLoadingSintomas] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  const [examPatientDoc, setExamPatientDoc] = useState('');
  const [examName, setExamName] = useState('');
  const [examDetails, setExamDetails] = useState('');
  const [savingExam, setSavingExam] = useState(false);
  const nav: any = useNavigation();

  const cargarSintomas = async (cedula: string) => {
    setLoadingSintomas(true);
    try {
      const q = query(collection(db, 'reportes_sintomas'), where('especialistaId', '==', String(cedula).trim()));
      const snapshot = await getDocs(q);
      setAllReportes(snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id })));
    } catch (error: any) {
      Alert.alert("Error", "No se pudieron cargar los síntomas.");
    } finally {
      setLoadingSintomas(false);
    }
  };

  const cargarDisponibilidadDia = async (cedula: string, fecha: string, docInfo?: any) => {
    try {
      // Carga slots del doctor
      const q = query(collection(db, 'disponibilidad_doctores'), where('doctorId', '==', cedula), where('fecha', '==', fecha));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setDoctorSlots(snapshot.docs[0].data().slots || {});
      } else {
        const defaultSlots: { [key: string]: boolean } = {};
        ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].forEach(s => defaultSlots[s] = true);
        setDoctorSlots(defaultSlots);

        const dataToUse = docInfo || doctorData;
        if (dataToUse && dataToUse.cedula) {
          await addDoc(collection(db, 'disponibilidad_doctores'), {
            doctorId: dataToUse.cedula,
            nombre: dataToUse.nombre || '',
            especialidad: dataToUse.especialidad || 'Médico General',
            fecha: fecha,
            slots: defaultSlots
          });
        }
      }
    } catch (e) { }
  };

  useEffect(() => {
    if (!doctorData?.cedula || !selectedDoctorDate) return;

    const qCitas = query(collection(db, 'citas'), where('doctorId', '==', doctorData.cedula), where('fecha', '==', selectedDoctorDate));
    const qInmediatas = query(collection(db, 'citas'), where('doctorId', '==', ''), where('especialidad', '==', 'Médico General'), where('fecha', '==', selectedDoctorDate));

    let citasAsignadas: any[] = [];
    let citasInmediatas: any[] = [];

    const updateCitas = () => {
      setCitasDelDia([...citasAsignadas, ...citasInmediatas]);
    };

    const unsubCitas = onSnapshot(qCitas, (snap) => {
      citasAsignadas = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      updateCitas();
    });

    const unsubInmediatas = onSnapshot(qInmediatas, (snap) => {
      citasInmediatas = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      updateCitas();
    });

    return () => {
      unsubCitas();
      unsubInmediatas();
    };
  }, [doctorData?.cedula, selectedDoctorDate]);

  const toggleSlot = async (hora: string) => {
    if (!doctorData?.cedula || !selectedDoctorDate) return;

    // Calcular el nuevo estado localmente
    const newSlots = { ...doctorSlots, [hora]: !doctorSlots[hora] };
    
    // Actualizar la interfaz instantáneamente
    setDoctorSlots(newSlots);

    // Guardar automáticamente en Firebase
    try {
      const q = query(collection(db, 'disponibilidad_doctores'), where('doctorId', '==', doctorData.cedula), where('fecha', '==', selectedDoctorDate));
      const snapshot = await getDocs(q);
      const datosAGuardar = {
        doctorId: doctorData.cedula,
        nombre: doctorData.nombre || '',
        especialidad: doctorData.especialidad || 'Médico General',
        fecha: selectedDoctorDate,
        slots: newSlots
      };
      
      if (!snapshot.empty) {
        await setDoc(doc(db, 'disponibilidad_doctores', snapshot.docs[0].id) as any, datosAGuardar, { merge: true });
      } else {
        await addDoc(collection(db, 'disponibilidad_doctores'), datosAGuardar);
      }
    } catch (e) {
      console.error("Error al autoguardar:", e);
      // Revertir en caso de error
      setDoctorSlots(doctorSlots);
      Alert.alert("Error", "No se pudo sincronizar el horario de forma automática.");
    }
  };

  const subirExamen = async () => {
    if (!examPatientDoc.trim() || !examName.trim() || !examDetails.trim()) {
      Alert.alert("Error", "Completa todos los campos del examen.");
      return;
    }
    setSavingExam(true);
    try {
      await addDoc(collection(db, 'resultados_examenes'), {
        pacienteId: examPatientDoc.trim(),
        doctorId: doctorData?.cedula || '123',
        doctorName: doctorData?.nombre || 'Especialista',
        name: examName.trim(),
        detalleText: examDetails.trim(),
        status: 'Disponible',
        fechaCreacion: new Date().toISOString()
      });
      Alert.alert("Éxito", "Documento enviado al paciente.");
      setExamPatientDoc(''); setExamName(''); setExamDetails('');
    } catch (e) {
      Alert.alert("Error", "Problema al subir el examen.");
    } finally {
      setSavingExam(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const sessionString = await AsyncStorage.getItem('userSession');
        if (!sessionString) return;
        const session = JSON.parse(sessionString);
        setDoctorData(session);
        await cargarSintomas(session.cedula);

        // Auto-load today's agenda for Home dashboard
        const today = new Date().toISOString().split('T')[0];
        setSelectedDoctorDate(today);
        await cargarDisponibilidadDia(session.cedula, today, session);

        // Auto-generate next 14 days of availability in background
        setTimeout(async () => {
          for (let i = 1; i <= 14; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const fechaStr = d.toISOString().split('T')[0];
            const q = query(collection(db, 'disponibilidad_doctores'), where('doctorId', '==', session.cedula), where('fecha', '==', fechaStr));
            const snap = await getDocs(q);
            if (snap.empty) {
              const defaultSlots: { [key: string]: boolean } = {};
              ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].forEach(s => defaultSlots[s] = true);
              await addDoc(collection(db, 'disponibilidad_doctores'), {
                doctorId: session.cedula,
                nombre: session.nombre || '',
                // Preserve the actual especialidad of the specialist; if missing, use default
                especialidad: session.especialidad || 'Médico General',
                fecha: fechaStr,
                slots: defaultSlots
              });
            }
          }
        }, 2000);
      } catch (e) { }
    };
    initialize();
  }, []);

  useEffect(() => {
    let result = allReportes;
    if (showOnlyPending) result = result.filter(r => r.revisado === false);
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(r => r.pacienteNombre?.toLowerCase().includes(lowerQuery) || String(r.pacienteDoc).includes(lowerQuery));
    }
    setFilteredReportes(result);
  }, [searchQuery, showOnlyPending, allReportes]);

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await setDoc(doc(db, 'reportes_sintomas', id) as any, { revisado: !currentStatus }, { merge: true });
      setAllReportes(allReportes.map(r => r.id === id ? { ...r, revisado: !currentStatus } : r));
    } catch (e) {
      Alert.alert("Error", "No se pudo actualizar el estado.");
    }
  };

  const renderAgenda = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeaderRow}>
        <Text style={styles.cardTitle}>Mi Disponibilidad (Firebase)</Text>
      </View>
      <View style={styles.calendarInfoBox}>
        <Text style={styles.calendarInfoText}>Toca un día para abrir o cerrar cupos.</Text>
      </View>
      <View style={{ height: 10 }} />
      <View style={styles.card}>
        <Calendar
          minDate={new Date().toISOString().split('T')[0]}
          onDayPress={(day: any) => {
            setSelectedDoctorDate(day.dateString);
            if (doctorData?.cedula) cargarDisponibilidadDia(doctorData.cedula, day.dateString, doctorData);
          }}
          markedDates={{ [selectedDoctorDate]: { selected: true, selectedColor: '#0056b3' } }}
        />
      </View>
      {selectedDoctorDate ? (
        <View style={{ marginTop: 20 }}>
          <Text style={styles.cardTitle}>Horarios: {selectedDoctorDate}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {baseSlots.map(hora => {
              const isAvailable = doctorSlots[hora];
              const citaReservada = citasDelDia.find(c => c.hora === hora && c.estado !== 'Cancelada' && c.estado !== 'Perdida');
              const isBooked = citaReservada != null;
              return (
                <Pressable
                  key={hora}
                  onPress={() => {
                    if (isBooked) {
                      nav.navigate('DoctorCitaDetail', {
                        citaId: citaReservada.id,
                        pacienteNombre: citaReservada.pacienteNombre,
                        pacienteDoc: citaReservada.pacienteDoc,
                        especialidad: citaReservada.especialidad,
                        fecha: citaReservada.fecha,
                        hora: citaReservada.hora,
                        modalidad: citaReservada.modalidad || 'Virtual',
                        estado: citaReservada.estado || 'Confirmada',
                      });
                    } else {
                      toggleSlot(hora);
                    }
                  }}
                  style={{
                    backgroundColor: isBooked ? '#fef3c7' : isAvailable ? '#007AFF' : '#f3f4f6',
                    paddingVertical: 10, paddingHorizontal: 8,
                    borderRadius: 8, borderWidth: 1,
                    borderColor: isBooked ? '#f59e0b' : isAvailable ? '#007AFF' : '#d1d5db',
                    width: '30%'
                  }}
                >
                  <Text style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12, color: isBooked ? '#92400e' : isAvailable ? '#fff' : '#4b5563' }}>
                    {hora}
                  </Text>
                  {isBooked && (
                    <Text style={{ textAlign: 'center', fontSize: 10, color: '#92400e', marginTop: 2 }} numberOfLines={1}>
                      👤 {citaReservada.pacienteNombre}
                    </Text>
                  )}
                  {!isBooked && (
                    <Text style={{ textAlign: 'center', fontSize: 10, color: isAvailable ? '#bfdbfe' : '#9ca3af', marginTop: 2 }}>
                      {isAvailable ? 'Disponible' : 'Cerrado'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          <View style={{ height: 40 }} />
        </View>
      ) : (
        <Text style={{ textAlign: 'center', marginTop: 30, color: '#6b7280', marginBottom: 50 }}>Selecciona un día.</Text>
      )}
    </ScrollView>
  );

  const renderSintomas = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <View style={styles.tabHeaderRow}>
          <TextInput style={styles.searchInput} placeholder="Buscar paciente..." value={searchQuery} onChangeText={setSearchQuery} />
          <TouchableOpacity onPress={() => cargarSintomas(doctorData?.cedula)} style={[styles.refreshBtn, { marginLeft: 10 }]}>
            <Text style={styles.refreshText}>↻</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterChip, showOnlyPending && styles.filterChipActive]} onPress={() => setShowOnlyPending(true)}>
            <Text style={showOnlyPending ? styles.chipTextActive : styles.chipText}>Pendientes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, !showOnlyPending && styles.filterChipActive]} onPress={() => setShowOnlyPending(false)}>
            <Text style={!showOnlyPending ? styles.chipTextActive : styles.chipText}>Todos</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loadingSintomas ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredReportes}
          keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
          ListEmptyComponent={<Text style={styles.empty}>No hay síntomas pendientes por evaluar.</Text>}
          renderItem={({ item }) => {
            const dateObj = new Date(item.fecha);
            return (
              <View style={styles.card}>
                <View style={styles.reportHeader}>
                  <Text style={styles.cardTitle}>{item.pacienteNombre}</Text>
                  <Text style={styles.weekBadge}>Sem. {item.semana}</Text>
                </View>
                <Text style={styles.symptomsText}>"{item.sintomas}"</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
                  <View>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>DNI: {item.pacienteDoc}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{dateObj.toLocaleDateString()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleStatus(item.id, item.revisado)} style={[styles.checkButton, item.revisado ? { backgroundColor: '#e5e7eb' } : { backgroundColor: '#059669' }]}>
                    <Text style={[styles.checkButtonText, item.revisado ? { color: '#6b7280' } : { color: '#fff' }]}>
                      {item.revisado ? 'Deshacer' : '✓ Marcar Revisado'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );

  const renderExamenes = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeaderRow}><Text style={styles.cardTitle}>Subir Resultado</Text></View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Cédula del Paciente:</Text>
        <TextInput style={styles.input} placeholder="Ej: 10203040" value={examPatientDoc} onChangeText={setExamPatientDoc} keyboardType="numeric" />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nombre del Examen:</Text>
        <TextInput style={styles.input} placeholder="Ej: Perfil Lipídico..." value={examName} onChangeText={setExamName} />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Texto del Resultado:</Text>
        <TextInput style={[styles.input, { height: 150, textAlignVertical: 'top' }]} placeholder="Detalles de laboratorio..." value={examDetails} onChangeText={setExamDetails} multiline />
      </View>
      <Pressable style={[styles.button, savingExam && styles.buttonLoading, { marginTop: 20, marginBottom: 50 }]} onPress={subirExamen} disabled={savingExam}>
        {savingExam ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>📤 Enviar Documento</Text>}
      </Pressable>
    </ScrollView>
  );

  const renderHome = () => {
    const todayCitas = citasDelDia || [];
    const pendingCitas = todayCitas.filter(c => c.estado === 'Confirmada' || c.estado === 'En Espera');
    const completedCount = todayCitas.filter(c => c.estado === 'Completada').length;

    pendingCitas.sort((a, b) => {
      const parseTime = (timeStr: string) => {
        if (!timeStr) return 0;
        let [time, modifier] = timeStr.split(' ');
        let parts = time.split(':');
        let h = parseInt(parts[0] || '0', 10);
        let m = parseInt(parts[1] || '0', 10);
        if (modifier === 'PM' && h < 12) h += 12;
        if (modifier === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };

      const timeA = parseTime(a.hora);
      const timeB = parseTime(b.hora);
      if (timeA === timeB) {
        return (a.creadaEn || 0) - (b.creadaEn || 0);
      }
      return timeA - timeB;
    });

    const currentCita = pendingCitas[0];
    const upcomingCitas = pendingCitas.slice(1);
    const doctorInitials = doctorData?.nombre ? doctorData.nombre.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() : 'DR';
    const doctorName = doctorData?.nombre ? doctorData.nombre.split(' ')[0] : 'Doctor';

    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <AppHeader
          title="Salud Digital"
          isDoctor={true}
          doctorInitials={doctorInitials}
          onProfilePress={() => nav.navigate('DoctorProfile')}
        />

        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#1d4ed8', marginBottom: 4, lineHeight: 32 }}>
            Hola, Dr.{'\n'}{doctorName}
          </Text>
          <Text style={{ fontSize: 13, color: '#475569', fontWeight: '700', marginBottom: 20 }}>
            {doctorData?.especialidad || 'Medicina General'} • Consulta Virtual
          </Text>

          <View style={{ backgroundColor: '#1d4ed8', borderRadius: 16, padding: 20, shadowColor: '#1d4ed8', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <Text style={{ fontSize: 16 }}>✢</Text>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>PACIENTE ACTUAL</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
              {currentCita ? `Turno ${currentCita.hora}` : 'Sin turno'}
            </Text>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 20 }}>
              {currentCita ? currentCita.pacienteNombre : 'No hay pacientes en espera'}
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12 }}>⏱</Text>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{currentCita ? 'En sala de espera' : 'Cola vacía'}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, gap: 15 }}>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 24, color: '#1d4ed8', marginBottom: 4 }}>👥</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#0f172a' }}>{pendingCitas.length}</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 1, marginTop: 4 }}>EN ESPERA</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 24, color: '#475569', marginBottom: 4 }}>✓</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#0f172a' }}>{completedCount}</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 1, marginTop: 4 }}>COMPLETADAS HOY</Text>
            </View>
          </View>

          <View style={{ alignItems: 'center', marginVertical: 30 }}>
            <Pressable
              onPress={() => {
                if (currentCita) {
                  nav.navigate('DoctorCitaDetail', {
                    citaId: currentCita.id,
                    pacienteNombre: currentCita.pacienteNombre,
                    pacienteDoc: currentCita.pacienteDoc,
                    especialidad: currentCita.especialidad,
                    fecha: currentCita.fecha,
                    hora: currentCita.hora,
                    modalidad: currentCita.modalidad || 'Virtual',
                    estado: currentCita.estado || 'Confirmada',
                  });
                } else {
                  Alert.alert("Aviso", "No hay paciente actual en la cola.");
                }
              }}
              style={({ pressed }) => ({
                width: 260, height: 260, borderRadius: 130,
                backgroundColor: pressed ? '#1e40af' : '#2563eb',
                justifyContent: 'center', alignItems: 'center',
                shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10
              })}
            >
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🧰</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1.5 }}>INICIAR</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1.5 }}>CONSULTA</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1e293b' }}>Próximos Pacientes</Text>
            <Pressable onPress={() => setBottomTab('schedule')}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563eb', padding: 4 }}>Ver Agenda</Text>
            </Pressable>
          </View>

          {upcomingCitas.length > 0 ? upcomingCitas.map((cita, idx) => (
            <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
              <View style={{ backgroundColor: '#dbeafe', width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                <Text style={{ color: '#1e40af', fontWeight: '700', fontSize: 16 }}>{cita.hora.split(':')[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>{cita.pacienteNombre}</Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Consulta Virtual • {cita.especialidad}</Text>
              </View>
              <Text style={{ color: '#cbd5e1', fontSize: 24, fontWeight: '300' }}>›</Text>
            </View>
          )) : (
            <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginVertical: 20 }}>No hay más pacientes pendientes por hoy</Text>
          )}
          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {bottomTab === 'home' && renderHome()}
      {bottomTab === 'schedule' && (
        <View style={{ flex: 1 }}>
          <AppHeader title="Panel de Agenda" />
          {renderAgenda()}
        </View>
      )}
      {bottomTab === 'clinical' && (
        <View style={{ flex: 1 }}>
          <AppHeader title="Panel Clínico" />
          <View style={styles.tabSelector}>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'sintomas' && styles.tabButtonActive]} onPress={() => setActiveTab('sintomas')}>
              <Text style={[styles.tabText, activeTab === 'sintomas' && styles.tabTextActive]}>🩺 Síntomas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'examenes' && styles.tabButtonActive]} onPress={() => setActiveTab('examenes')}>
              <Text style={[styles.tabText, activeTab === 'examenes' && styles.tabTextActive]}>📋 Exámenes</Text>
            </TouchableOpacity>
          </View>
          {activeTab === 'sintomas' && renderSintomas()}
          {activeTab === 'examenes' && renderExamenes()}
        </View>
      )}

      {/* Bottom Tab Bar */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', justifyContent: 'space-between' }}>
        {[
          { id: 'home', icon: '🏠', label: 'HOME' },
          { id: 'schedule', icon: '📅', label: 'SCHEDULE' },
          { id: 'clinical', icon: '🩺', label: 'CLINICAL' },
          { id: 'profile', icon: '👤', label: 'PROFILE' },
        ].map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              if (item.id === 'profile') {
                nav.navigate('DoctorProfile');
              } else {
                setBottomTab(item.id as any);
              }
            }}
            style={{ alignItems: 'center', flex: 1 }}
          >
            <Text style={{ fontSize: 20, color: bottomTab === item.id ? '#2563eb' : '#94a3b8', marginBottom: 4 }}>{item.icon}</Text>
            <Text style={{ fontSize: 9, fontWeight: '800', color: bottomTab === item.id ? '#2563eb' : '#94a3b8', letterSpacing: 0.5 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

// --- 5. DETALLE DE CITA (DOCTOR) ---

export function DoctorCitaDetailScreen({ route }: { route: { params: RootStackParamList['DoctorCitaDetail'] } }) {
  const nav = useNavigation<any>();
  const { citaId, pacienteNombre, pacienteDoc, especialidad, fecha, hora, modalidad, estado } = route.params;

  const [liveEstado, setLiveEstado] = useState(estado);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'citas', citaId), (snap) => {
      if (snap.exists()) {
        setLiveEstado(snap.data().estado);
      }
    });
    return () => unsub();
  }, [citaId]);

  const aceptarInmediato = async () => {
    try {
      const sessionString = await AsyncStorage.getItem('userSession');
      const session = sessionString ? JSON.parse(sessionString) : null;
      if (!session) return;

      await setDoc(doc(db, 'citas', citaId) as any, {
        estado: 'Confirmada',
        doctorId: session.cedula,
        doctorNombre: session.nombre
      }, { merge: true });

      nav.navigate('TelemedicineCall', { citaId, pacienteNombre, role: 'doctor' });
    } catch (e) {
      Alert.alert("Error", "No se pudo aceptar al paciente.");
    }
  };

  const cancelarYReasignar = async () => {
    try {
      if (Platform.OS === 'web') {
        const confirm = window.confirm("¿Estás seguro de cancelar esta cita? El sistema intentará reasignarla automáticamente a otro médico disponible.");
        if (confirm) {
          performReasignacion();
        }
      } else {
        Alert.alert(
          "Cancelar Cita",
          "¿Estás seguro de cancelar esta cita? El sistema intentará reasignarla automáticamente a otro médico disponible.",
          [
            { text: 'No, Volver', style: 'cancel' },
            { text: 'Sí, Cancelar', style: 'destructive', onPress: performReasignacion }
          ]
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const performReasignacion = async () => {
    try {
      const sessionString = await AsyncStorage.getItem('userSession');
      const session = sessionString ? JSON.parse(sessionString) : null;
      if (!session) return;

      // Obtener la disponibilidad de todos los doctores de la misma especialidad a partir de la fecha de la cita, excluyendo al doctor actual
      const snapDisp = await getDocs(collection(db, 'disponibilidad_doctores'));
      const allDisp = snapDisp.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(d => d.especialidad === especialidad && d.fecha >= fecha && d.doctorId !== session.cedula);

      allDisp.sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Obtener todas las citas para verificar colisiones
      const snapCitas = await getDocs(collection(db, 'citas'));
      const allCitas = snapCitas.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      let foundNewDoctor = false;
      let newDate = '';
      let newTime = '';
      let newDoctorId = '';
      let newDoctorName = '';

      // Primer intento: misma fecha y misma hora
      const sameDayDisp = allDisp.filter(d => d.fecha === fecha && d.slots && d.slots[hora]);
      for (const disp of sameDayDisp) {
        const isBusy = allCitas.some(c => c.doctorId === disp.doctorId && c.fecha === disp.fecha && c.hora === hora && c.estado !== 'Cancelada' && c.estado !== 'Perdida');
        if (!isBusy) {
          foundNewDoctor = true;
          newDate = fecha;
          newTime = hora;
          newDoctorId = disp.doctorId;
          newDoctorName = disp.nombre;
          break;
        }
      }

      // Segundo intento: el slot más cercano disponible (fecha futura o misma fecha pero hora posterior)
      if (!foundNewDoctor) {
        for (const disp of allDisp) {
          if (!disp.slots) continue;
          const availableTimes = Object.keys(disp.slots).filter(time => disp.slots[time]).sort();
          for (const time of availableTimes) {
            const isBusy = allCitas.some(c => c.doctorId === disp.doctorId && c.fecha === disp.fecha && c.hora === time && c.estado !== 'Cancelada' && c.estado !== 'Perdida');
            if (!isBusy) {
              if (disp.fecha > fecha || (disp.fecha === fecha && time >= hora)) {
                foundNewDoctor = true;
                newDate = disp.fecha;
                newTime = time;
                newDoctorId = disp.doctorId;
                newDoctorName = disp.nombre;
                break;
              }
            }
          }
          if (foundNewDoctor) break;
        }
      }

      if (foundNewDoctor) {
        // Se encontró un reemplazo, reasignar y notificar
        await setDoc(doc(db, 'citas', citaId) as any, {
          doctorId: newDoctorId,
          doctorNombre: newDoctorName,
          fecha: newDate,
          hora: newTime,
          mensajeReasignacion: (newDate === fecha && newTime === hora) 
            ? `El doctor canceló y tu cita fue reasignada al Dr(a). ${newDoctorName} a la misma hora.`
            : `El doctor canceló y tu cita fue reagendada para el ${newDate} a las ${newTime} con el Dr(a). ${newDoctorName}.`
        }, { merge: true });

        Alert.alert("Éxito", "La cita fue cancelada y reasignada automáticamente a otro especialista.");
        nav.goBack();
      } else {
        // No hay reemplazo disponible, cancelar definitivamente
        await setDoc(doc(db, 'citas', citaId) as any, {
          estado: 'Cancelada',
          mensajeReasignacion: 'El doctor canceló tu cita y no hay disponibilidad cercana para reasignarla.'
        }, { merge: true });
        Alert.alert("Cancelada", "No se encontraron especialistas disponibles. La cita ha sido cancelada.");
        nav.goBack();
      }
    } catch (e) {
      Alert.alert("Error", "Ocurrió un problema al intentar reasignar la cita.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
        <Pressable onPress={() => nav.goBack()} style={{ paddingRight: 16 }}>
          <Text style={{ fontSize: 34, color: '#007AFF', lineHeight: 36 }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }}>Detalle de Cita</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>

        {/* Estado badge */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: liveEstado === 'Cancelada' || liveEstado === 'Perdida' ? '#fee2e2' : '#d1fae5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ color: liveEstado === 'Cancelada' || liveEstado === 'Perdida' ? '#991b1b' : '#065f46', fontWeight: '700', fontSize: 13 }}>
            {liveEstado === 'Cancelada' ? '❌ Cancelada' : liveEstado === 'Perdida' ? '⚠️ Perdida' : `✅ ${liveEstado}`}
          </Text>
        </View>

        {/* Informacion del paciente */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Paciente</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 22 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>{pacienteNombre}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>Cédula: {pacienteDoc}</Text>
            </View>
          </View>
        </View>

        {/* Informacion de la cita */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Detalles de la Cita</Text>
          {[
            { icon: '🧑‍⚕️', label: 'Especialidad', value: especialidad },
            { icon: '📅', label: 'Fecha', value: fecha },
            { icon: '⏰', label: 'Hora', value: hora },
            { icon: '💻', label: 'Modalidad', value: modalidad },
            { icon: '🔖', label: 'ID de Cita', value: citaId.slice(0, 12) + '...' },
          ].map(item => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontSize: 18, width: 30 }}>{item.icon}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', width: 100 }}>{item.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 }}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Boton videollamada */}
        <View style={{ backgroundColor: '#eff6ff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#bfdbfe', borderStyle: 'solid' }}>
          <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Consulta Virtual</Text>

          {liveEstado === 'Cancelada' || liveEstado === 'Perdida' ? (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280', fontWeight: '700' }}>Esta cita ha sido cancelada o perdida.</Text>
            </View>
          ) : liveEstado === 'En Espera' ? (
            <Pressable
              onPress={aceptarInmediato}
              style={{ backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}
            >
              <Text style={{ fontSize: 22 }}>✋</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Aceptar y Llamar</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => nav.navigate('TelemedicineCall', { citaId, pacienteNombre, role: 'doctor' })}
              style={{ backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}
            >
              <Text style={{ fontSize: 22 }}>🎥</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{liveEstado === 'Confirmada' ? 'Reingresar a Videollamada' : 'Iniciar Videollamada'}</Text>
            </Pressable>
          )}
          <Text style={{ color: '#93c5fd', fontSize: 12, textAlign: 'center', marginTop: 8 }}>Conexión segura en tiempo real</Text>
        </View>

        {/* Boton Cancelar (solo si está activa) */}
        {liveEstado !== 'Cancelada' && liveEstado !== 'Perdida' && liveEstado !== 'Completada' && (
          <Pressable
            onPress={cancelarYReasignar}
            style={{ backgroundColor: '#fee2e2', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}
          >
            <Text style={{ fontSize: 22 }}>⚠️</Text>
            <Text style={{ color: '#dc2626', fontSize: 16, fontWeight: '700' }}>Cancelar Cita</Text>
          </Pressable>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- 6. PERFIL DOCTOR ---

export function DoctorProfileScreen() {
  const nav = useNavigation<any>();
  const [doctorData, setDoctorData] = React.useState<any>(null);

  React.useEffect(() => {
    const load = async () => {
      try {
        const s = await AsyncStorage.getItem('userSession');
        if (s) setDoctorData(JSON.parse(s));
      } catch { }
    };
    load();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userSession');
    nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
  };

  const initials = doctorData?.nombre
    ? doctorData.nombre.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : 'DR';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.resultsHeader}>
        <Pressable onPress={() => nav.goBack()} style={styles.resultsHeaderBtn}>
          <Text style={styles.resultsHeaderBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.resultsHeaderTitle}>Mi Perfil</Text>
        <View style={styles.resultsHeaderBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.pickContent}>
        {/* Avatar e info principal */}
        <View style={{ alignItems: 'center', marginVertical: 24 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: '#0056b3',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#0056b3', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6
          }}>
            <Text style={{ fontSize: 32, color: '#fff', fontWeight: '700' }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 14, color: '#0b1b33' }}>
            Dr. {doctorData?.nombre || 'Cargando...'}
          </Text>
          <Text style={{ fontSize: 15, color: '#4b5563', marginTop: 4 }}>
            {doctorData?.especialidad || 'Especialista Médico'}
          </Text>
          <View style={{ backgroundColor: '#dbeafe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: '#1d4ed8', fontWeight: '700' }}>SALUD DIGITAL • ESPECIALISTA</Text>
          </View>
        </View>

        {/* Informacion del medico */}
        <Text style={styles.resultsSectionTitle}>Información del Especialista</Text>
        {[
          { icon: '🏥', label: 'Cédula Profesional', value: doctorData?.cedula || '---' },
          { icon: '📞', label: 'Teléfono', value: doctorData?.telefono || 'No registrado' },
          { icon: '📧', label: 'Correo', value: doctorData?.email || 'No registrado' },
          { icon: '📍', label: 'Sede', value: doctorData?.sede || 'Salud Digital' },
        ].map(item => (
          <View key={item.label} style={[styles.resultsRow, { marginBottom: 2 }]}>
            <View style={styles.resultsRowIconBox}>
              <Text style={styles.resultsRowIcon}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsRowDate}>{item.label}</Text>
              <Text style={styles.resultsRowTitle}>{item.value}</Text>
            </View>
          </View>
        ))}

        {/* Cerrar sesion */}
        <Pressable
          style={({ pressed }) => [{
            marginTop: 40, alignItems: 'center', padding: 16, borderRadius: 14,
            backgroundColor: pressed ? '#fee2e2' : '#fef2f2',
            borderWidth: 1, borderColor: '#fecaca'
          }]}
          onPress={handleLogout}
        >
          <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 16 }}>🚪 Cerrar Sesión</Text>
          <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 3 }}>Volver al ingreso de documento</Text>
        </Pressable>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function DoctorPostCallScreen({ route }: any) {
  const { citaId, pacienteNombre } = route.params;
  const nav = useNavigation<any>();
  const [nextPatient, setNextPatient] = useState<any>(null);
  const [loadingNext, setLoadingNext] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'citas'),
      where('doctorId', '==', ''),
      where('especialidad', '==', 'Médico General'),
      where('estado', '==', 'En Espera'),
      orderBy('creadaEn', 'asc'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setNextPatient({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setNextPatient(null);
      }
      setLoadingNext(false);
    });
    return () => unsub();
  }, []);

  const acceptNextPatient = async () => {
    if (!nextPatient) return;
    try {
      const sessionString = await AsyncStorage.getItem('userSession');
      const session = sessionString ? JSON.parse(sessionString) : null;
      if (!session) return;

      await setDoc(doc(db, 'citas', nextPatient.id) as any, {
        estado: 'Confirmada',
        doctorId: session.cedula,
        doctorNombre: session.nombre
      }, { merge: true });

      nav.replace('TelemedicineCall', { citaId: nextPatient.id, pacienteNombre: nextPatient.pacienteNombre, role: 'doctor' });
    } catch (e) {
      Alert.alert("Error", "No se pudo aceptar al paciente.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
        <Pressable onPress={() => nav.navigate('DoctorDashboard')}>
          <Text style={{ fontSize: 24, color: '#94a3b8' }}>≡</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#1d4ed8' }}>CareConnect</Text>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>👨‍⚕️</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#10b981', marginRight: 10, fontSize: 12 }}>🟢</Text>
            <View>
              <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 11, letterSpacing: 1 }}>CALL FINISHED: {pacienteNombre.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={{ color: '#94a3b8', fontSize: 11 }}>12:45 PM</Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 8 }}>Session Summary</Text>
          <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>The video consultation has successfully ended. Your notes have been synced.</Text>

          <View style={{ flexDirection: 'row', gap: 15 }}>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#1e293b', letterSpacing: 1, marginBottom: 4 }}>DURATION</Text>
              <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '500' }}>18m 42s</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#1e293b', letterSpacing: 1, marginBottom: 4 }}>PRESCRIPTION</Text>
              <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '500' }}>Issued</Text>
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: '#dbeafe', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#bfdbfe' }}>
          <View style={{ backgroundColor: '#1d4ed8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>NEXT IN LINE</Text>
          </View>

          <View style={{ position: 'absolute', right: 20, top: 20, opacity: 0.1 }}>
            <Text style={{ fontSize: 60 }}>👥</Text>
          </View>

          {loadingNext ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : nextPatient ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 4 }}>Turn {nextPatient.id.substring(0, 4).toUpperCase()} - {nextPatient.pacienteNombre}</Text>
              <Text style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>Follow-up: Post-op recovery review</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 10, color: '#475569' }}>⏱</Text>
                  <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }}>WAITING 12m</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 10, color: '#475569' }}>🌐</Text>
                  <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }}>REMOTE</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b' }}>Queue is empty</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 15, marginBottom: 40 }}>
          <Pressable style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ backgroundColor: '#f8fafc', width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: '#2563eb' }}>📝</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e293b' }}>Add Notes</Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Post-session brief</Text>
          </Pressable>

          <Pressable style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ backgroundColor: '#f8fafc', width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: '#2563eb' }}>🕒</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e293b' }}>History</Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Patient records</Text>
          </Pressable>
        </View>

        {nextPatient ? (
          <View style={{ alignItems: 'center' }}>
            <Pressable onPress={acceptNextPatient} style={({ pressed }) => [{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#0256d3', justifyContent: 'center', alignItems: 'center', shadowColor: '#0256d3', shadowOpacity: 0.4, shadowRadius: 15, elevation: 8, marginBottom: 16, opacity: pressed ? 0.8 : 1 }]}>
              <Text style={{ fontSize: 30, color: '#fff', marginLeft: 4, marginBottom: 4 }}>▶</Text>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>START</Text>
            </Pressable>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#1d4ed8', letterSpacing: 1 }}>ACCEPT NEXT PATIENT</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Pressable onPress={() => nav.navigate('DoctorDashboard')} style={{ padding: 16, backgroundColor: '#cbd5e1', borderRadius: 12 }}>
              <Text style={{ fontWeight: '800', color: '#475569' }}>REGRESAR AL INICIO</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
