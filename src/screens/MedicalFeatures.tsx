import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, FlatList, TouchableOpacity, Alert, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';

import { styles } from '../theme/globalStyles';
import { usePatient } from '../context/PatientContext';
import { Nav } from '../config/types';
import { LargePrimaryButton, ScreenChrome } from '../components/SharedComponents';
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
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  return (
    <ScreenChrome title="Mi historial médico" subtitle="Consultas pasadas (piloto con datos simulados).">
      <ScrollView contentContainerStyle={styles.content}>
        {historyEntries.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => nav.navigate('MedicalHistoryDetail', { historyId: h.id })}
            style={({ pressed }) => [styles.rowCard, pressed ? styles.rowCardPressed : null]}
          >
            <Text style={styles.rowTitle}>{h.title}</Text>
            <Text style={styles.rowSubtitle}>
              {h.serviceLabel} - Fecha: {formatDate(h.date)}
            </Text>
            <Text style={styles.badgeMuted}>Ver detalle</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenChrome>
  );
}

export function MedicalHistoryDetailScreen({ route }: { route: { params: { historyId: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const h = historyEntries.find((x) => x.id === route.params.historyId);
  if (!h) {
    return (
      <ScreenChrome title="Historial" subtitle="No encontrado.">
        <ScrollView contentContainerStyle={styles.content}>
          <LargePrimaryButton label="Volver" onPress={() => nav.navigate('MedicalHistory')} />
        </ScrollView>
      </ScreenChrome>
    );
  }

  const linkedExams = h.linkedExamIds.map((id) => exams.find((e) => e.id === id)).filter(Boolean) as Exam[];

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
        {h.recomendaciones.map((r, idx) => (
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
  const [step, setStep] = useState<'confirm' | 'locating' | 'ready'>('confirm');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const emergencyNumber = emergencyNumberDefault;

  async function obtainLocation() {
    setStep('locating');
    setErrorMessage(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCoords(null);
        setStep('ready');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setCoords({ lat: current.coords.latitude, lng: current.coords.longitude });
      setStep('ready');
    } catch {
      setErrorMessage('No se pudo obtener ubicación. Mostramos hospitales de ejemplo.');
      setCoords(null);
      setStep('ready');
    }
  }

  const hospitalsSorted = useMemo(() => {
    if (!coords) return mockHospitals.map((h) => ({ ...h, distanceKm: null as number | null }));
    return mockHospitals
      .map((h) => ({ ...h, distanceKm: haversineKm(coords.lat, coords.lng, h.lat, h.lng) }))
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }, [coords]);

  const shareText = useMemo(() => {
    const locPart = coords
      ? `Mi ubicación aproximada: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}.`
      : `Mi ubicación no está disponible. Local: ${manualLocation || 'por favor intente otra vez'}.`;
    return `EMERGENCIA. Necesito ayuda urgente. ${locPart} (App piloto Salud Digital)`;
  }, [coords, manualLocation]);

  return (
    <ScreenChrome title="EMERGENCIA" subtitle="Botón siempre disponible (piloto).">
      <ScrollView contentContainerStyle={styles.content}>
        {step === 'confirm' ? (
          <>
            <Text style={styles.bigText}>¿Es una emergencia?</Text>
            <Text style={styles.normalText}>Si necesita ayuda ahora, presione “Sí”. Si no, presione “No”.</Text>
            <View style={{ height: 16 }} />
            <LargePrimaryButton tone="danger" label="Sí, necesito ayuda ahora" onPress={obtainLocation} />
            <View style={{ height: 12 }} />
            <LargePrimaryButton tone="muted" label="No, volver" onPress={() => nav.goBack()} />
            <Text style={styles.disclaimer}>
              Este botón ayuda a contactarse con emergencias. No sustituye atención médica presencial.
            </Text>
          </>
        ) : null}

        {step === 'locating' ? (
          <>
            <ActivityIndicator size="large" />
            <Text style={styles.normalText}>Buscando su ubicación…</Text>
            <Text style={styles.disclaimer}>Si falla, igual podrá llamar a emergencias.</Text>
          </>
        ) : null}

        {step === 'ready' ? (
          <>
            <Text style={styles.sectionLabel}>Hospitales cercanos (ejemplo)</Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {coords ? (
              <Text style={styles.normalText}>
                Ubicación aproximada: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </Text>
            ) : (
              <Text style={styles.normalText}>Ubicación no disponible. Se muestran opciones de ejemplo.</Text>
            )}

            <View style={{ height: 12 }} />
            {hospitalsSorted.map((h) => (
              <View key={h.id} style={styles.hospitalCard}>
                <Text style={styles.rowTitle}>{h.name}</Text>
                {h.distanceKm === null ? (
                  <Text style={styles.rowSubtitle}>Distancia: no disponible</Text>
                ) : (
                  <Text style={styles.rowSubtitle}>Distancia aproximada: {h.distanceKm.toFixed(1)} km</Text>
                )}
              </View>
            ))}

            <View style={styles.sectionDivider} />
            {coords ? null : (
              <>
                <Text style={styles.sectionLabel}>Si puede, ingrese su ubicación (ciudad/barrio)</Text>
                <TextInput
                  value={manualLocation}
                  onChangeText={setManualLocation}
                  placeholder="Ej: Centro / Barrio 1"
                  placeholderTextColor="#6b7280"
                  style={styles.input}
                />
                <View style={{ height: 12 }} />
              </>
            )}

            <LargePrimaryButton tone="danger" label={`Llamar emergencias (${emergencyNumber})`} onPress={() => Linking.openURL(`tel:${emergencyNumber}`)} />
            <View style={{ height: 12 }} />
            <LargePrimaryButton
              label="Compartir mi ubicación"
              tone="muted"
              onPress={async () => {
                try {
                  const available = await Sharing.isAvailableAsync();
                  if (!available) {
                    alert('Compartir no está disponible en este dispositivo.');
                    return;
                  }
                  await Sharing.shareAsync(shareText);
                } catch {
                  alert('No se pudo compartir la información. Intente de nuevo.');
                }
              }}
            />
            <View style={{ height: 12 }} />
            <LargePrimaryButton label="Volver al inicio" onPress={() => nav.navigate('HomeServices')} />
            <Text style={styles.disclaimer}>
              Importante: para una atención real, use el teléfono de emergencias y siga instrucciones del operador.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </ScreenChrome>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
         {nav.canGoBack() && (
            <Pressable onPress={() => nav.goBack()} style={{ paddingRight: 15, paddingTop: 5 }}>
               <Text style={{ fontSize: 36, color: '#007AFF', lineHeight: 36 }}>‹</Text>
            </Pressable>
         )}
         <Text style={[styles.title, { marginBottom: 0 }]}>Reportar Síntomas</Text>
      </View>

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
  const [activeTab, setActiveTab] = useState<'agenda' | 'sintomas' | 'examenes'>('agenda');
  const [doctorData, setDoctorData] = useState<any>(null);

  const [selectedDoctorDate, setSelectedDoctorDate] = useState<string>('');
  const [doctorSlots, setDoctorSlots] = useState<{ [hora: string]: boolean }>({});
  const [savingAgenda, setSavingAgenda] = useState(false);
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

  const cargarDisponibilidadDia = async (cedula: string, fecha: string) => {
    try {
      const q = query(collection(db, 'disponibilidad_doctores'), where('doctorId', '==', cedula), where('fecha', '==', fecha));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setDoctorSlots(snapshot.docs[0].data().slots || {});
      } else {
        setDoctorSlots({});
      }
    } catch (e) {}
  };

  const toggleSlot = (hora: string) => {
    setDoctorSlots(prev => ({ ...prev, [hora]: !prev[hora] }));
  };

  const guardarDisponibilidad = async () => {
    if (!doctorData?.cedula || !selectedDoctorDate) return;
    setSavingAgenda(true);
    try {
      const q = query(collection(db, 'disponibilidad_doctores'), where('doctorId', '==', doctorData.cedula), where('fecha', '==', selectedDoctorDate));
      const snapshot = await getDocs(q);
      const datosAGuardar = {
        doctorId: doctorData.cedula,
        nombre: doctorData.nombre || '',
        especialidad: doctorData.especialidad || 'Médico General',
        fecha: selectedDoctorDate,
        slots: doctorSlots
      };
      if (!snapshot.empty) {
        await setDoc(doc(db, 'disponibilidad_doctores', snapshot.docs[0].id) as any, datosAGuardar, { merge: true });
      } else {
        await addDoc(collection(db, 'disponibilidad_doctores'), datosAGuardar);
      }
      Alert.alert("Guardado", "Disponibilidad actualizada.");
    } catch (e) {
      Alert.alert("Error", "No se pudo sincronizar.");
    } finally {
      setSavingAgenda(false);
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
      } catch (e) {}
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
            if (doctorData?.cedula) cargarDisponibilidadDia(doctorData.cedula, day.dateString);
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
              return (
                <Pressable
                  key={hora}
                  onPress={() => toggleSlot(hora)}
                  style={{
                    backgroundColor: isAvailable ? '#007AFF' : '#f3f4f6', paddingVertical: 10, paddingHorizontal: 15,
                    borderRadius: 8, borderWidth: 1, borderColor: isAvailable ? '#007AFF' : '#d1d5db', width: '30%'
                  }}
                >
                  <Text style={{ textAlign: 'center', fontWeight: 'bold', color: isAvailable ? '#fff' : '#4b5563' }}>{hora}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={[styles.button, savingAgenda && styles.buttonLoading, { marginTop: 30, marginBottom: 50 }]} onPress={guardarDisponibilidad} disabled={savingAgenda}>
            {savingAgenda ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Aceptar y Guardar</Text>}
          </Pressable>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel del Especialista</Text>
        <Text style={styles.doctorName}>Dr. {doctorData?.nombre || 'Cargando...'}</Text>
      </View>
      <View style={styles.tabSelector}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'agenda' && styles.tabButtonActive]} onPress={() => setActiveTab('agenda')}>
          <Text style={[styles.tabText, activeTab === 'agenda' && styles.tabTextActive]}>📅 Agenda</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'sintomas' && styles.tabButtonActive]} onPress={() => setActiveTab('sintomas')}>
           <Text style={[styles.tabText, activeTab === 'sintomas' && styles.tabTextActive]}>🩺 Síntomas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'examenes' && styles.tabButtonActive]} onPress={() => setActiveTab('examenes')}>
          <Text style={[styles.tabText, activeTab === 'examenes' && styles.tabTextActive]}>📋 Exámenes</Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'agenda' && renderAgenda()}
      {activeTab === 'sintomas' && renderSintomas()}
      {activeTab === 'examenes' && renderExamenes()}
    </SafeAreaView>
  );
}
