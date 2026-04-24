import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

import { styles } from '../theme/globalStyles';
import { usePatient } from '../context/PatientContext';
import { Nav } from '../config/types';
import { LargePrimaryButton, ScreenChrome, EmergencyFAB, AppHeader } from '../components/SharedComponents';
import { slotOptions } from '../utils/mockData';

export function ListOfSlots({ title, onPick }: { title: string; onPick: (slotLabel: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={{ height: 10 }} />
      {slotOptions.map((s) => (
        <LargePrimaryButton key={s.id} label={s.label} onPress={() => onPick(s.label)} />
      ))}
    </ScrollView>
  );
}

export function BaseAppointmentScreen({ especialidad, targetRouteName }: { especialidad: string; targetRouteName: string }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();

  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string>(''); // format: "docId_hora"
  const [selectedDate, setSelectedDate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [disponibilidadDocId, setDisponibilidadDocId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorNombre, setDoctorNombre] = useState<string>('');
  
  const [doctoresDisponibles, setDoctoresDisponibles] = useState<any[]>([]);

  const fetchDisponibilidad = async (fecha: string) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'disponibilidad_doctores'),
        where('fecha', '==', fecha),
        where('especialidad', '==', especialidad)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        setDoctoresDisponibles(docs);
      } else {
        setDoctoresDisponibles([]);
      }
      setSelectedSlot('');
      setDisponibilidadDocId(null);
      setDoctorId(null);
      setDoctorNombre('');
    } catch (error) {
      console.error("Error cargando disponibilidad:", error);
    } finally {
      setLoading(false);
    }
  };

  const reservarCita = async () => {
    if (!selectedSlot || !selectedDate) return;
    if (!disponibilidadDocId) {
      Alert.alert('Error', 'No se encontró disponibilidad para reservar.');
      return;
    }

    setConfirming(true);
    try {
      // 1. Obtener datos de sesión del paciente
      const sessionString = await AsyncStorage.getItem('userSession');
      const session = sessionString ? JSON.parse(sessionString) : {};
      const pacienteNombre = session.nombre || profile?.name || 'Paciente';
      const pacienteDoc = session.cedula || profile?.docNumber || '';

      // 2. Bloquear el slot en disponibilidad_doctores
      const realSlot = selectedSlot.split('_')[1];
      const slotUpdate: Record<string, any> = {};
      slotUpdate[`slots.${realSlot}`] = false;
      await updateDoc(doc(db, 'disponibilidad_doctores', disponibilidadDocId), slotUpdate);

      // 3. Crear documento en colección 'citas'
      const citaData = {
        pacienteNombre,
        pacienteDoc: String(pacienteDoc),
        doctorId: doctorId || '',
        doctorNombre,
        especialidad,
        fecha: selectedDate,
        hora: realSlot,
        modalidad: 'Virtual',
        estado: 'Confirmada',
        creadaEn: serverTimestamp(),
      };
      await addDoc(collection(db, 'citas'), citaData);

      // 4. Navegar a pantalla de confirmación
      const slotLabel = `${selectedDate} a las ${realSlot}`;
      nav.navigate(targetRouteName as any, {
        specialization: especialidad,
        slotLabel,
        pacienteNombre,
        doctorNombre,
      });
    } catch (error: any) {
      console.error('Error al reservar cita:', error);
      Alert.alert('Error', 'No se pudo confirmar la cita. Intenta de nuevo.');
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={especialidad}
        showBack={true}
        onBack={() => nav.navigate('HomeServices')}
      />

      <ScrollView contentContainerStyle={styles.appointmentContent}>
        {doctorId && doctorNombre && (
          <View style={styles.appointmentDoctorCard}>
            <View style={styles.appointmentAvatar}><Text style={styles.appointmentAvatarText}>{doctorNombre.substring(0, 2).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.appointmentDoctorName}>Dr(a). {doctorNombre}</Text>
              <Text style={styles.appointmentDoctorMeta}>{especialidad} • Salud Digital</Text>
            </View>
          </View>
        )}

        <Text style={styles.appointmentStepTitle}>Paso 1: Disponibilidad Real</Text>

        <View style={styles.appointmentCalendarCard}>
          <Text style={styles.appointmentCalendarHint}>
            Horarios guardados dinámicamente por el especialista.
          </Text>
          <Calendar
            minDate={new Date().toISOString().split('T')[0]}
            onDayPress={(day: any) => {
              setSelectedDate(day.dateString);
              fetchDisponibilidad(day.dateString);
            }}
            markedDates={{
              [selectedDate]: {
                selected: true,
                disableTouchEvent: true,
                selectedColor: '#0056b3'
              }
            }}
            theme={{
              todayTextColor: '#0056b3',
              selectedDayBackgroundColor: '#0056b3',
              arrowColor: '#0056b3',
            }}
          />
        </View>

        <Text style={styles.appointmentStepTitle}>Paso 2: Seleccione una hora</Text>

        {!selectedDate ? (
          <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
            Seleccione un día en el calendario para ver disponibilidad.
          </Text>
        ) : (
          loading ? (
            <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
          ) : doctoresDisponibles.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 20 }}>
              No hay doctores disponibles para el {selectedDate}.
            </Text>
          ) : (
            <View style={{ gap: 20 }}>
              {doctoresDisponibles.map(docData => {
                const availableSlots = Object.keys(docData.slots || {}).filter(hora => docData.slots[hora] === true);
                if (availableSlots.length === 0) return null;
                
                availableSlots.sort((a, b) => a.localeCompare(b));
                return (
                  <View key={docData.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 12, color: '#1e293b' }}>Dr(a). {docData.nombre}</Text>
                    <View style={styles.appointmentSlotsGrid}>
                      {availableSlots.map(hora => {
                         const slotId = `${docData.id}_${hora}`;
                         const selected = selectedSlot === slotId;
                         return (
                           <Pressable
                             key={slotId}
                             onPress={() => {
                               setSelectedSlot(slotId);
                               setDisponibilidadDocId(docData.id);
                               setDoctorId(docData.doctorId);
                               setDoctorNombre(docData.nombre);
                             }}
                             style={[styles.appointmentSlotBtn, selected ? styles.appointmentSlotBtnSelected : null, { minWidth: '30%', marginBottom: 8 }]}
                           >
                             <Text style={[styles.appointmentSlotText, selected ? styles.appointmentSlotTextSelected : null]}>{hora}</Text>
                           </Pressable>
                         );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )
        )}

        <View style={styles.appointmentInfoBox}>
          <Text style={styles.appointmentInfoIcon}>ℹ️</Text>
          <Text style={styles.appointmentInfoText}>
            Esta cita apartará un cupo real con el {especialidad.toLowerCase()}.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.appointmentFooter}>
        <Pressable
          disabled={!selectedSlot || confirming}
          onPress={reservarCita}
          style={({ pressed }) => [
            styles.appointmentConfirmBtn,
            (!selectedSlot || confirming) && { backgroundColor: '#ccc' },
            pressed ? styles.btnPressed : null
          ]}
        >
          {confirming
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={styles.appointmentConfirmText}>Confirmar Cita Virtual</Text>
                <Text style={styles.appointmentConfirmIcon}>✓</Text>
              </>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function GeneralAppointmentScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [loading, setLoading] = useState(true);
  const [currentCita, setCurrentCita] = useState<any>(null);
  const [queuePosition, setQueuePosition] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const sessionDoc = String(profile.docNumber || '');
    
    const qUser = query(collection(db, 'citas'), where('pacienteDoc', '==', sessionDoc), where('modalidad', '==', 'Inmediata'), where('estado', 'in', ['En Espera', 'Confirmada']));
    
    const unsubscribeUser = onSnapshot(qUser, async (snap) => {
      if (!snap.empty) {
        const cita = { ...snap.docs[0].data(), id: snap.docs[0].id } as any;
        setCurrentCita(cita);
        
        if (cita.estado === 'En Espera') {
           const qAll = query(collection(db, 'citas'), where('modalidad', '==', 'Inmediata'), where('estado', '==', 'En Espera'));
           const snapAll = await getDocs(qAll);
           let countBefore = 0;
           snapAll.docs.forEach(d => {
              if (d.data().creadaEn < cita.creadaEn) countBefore++;
           });
           setQueuePosition(countBefore);
        }
      } else {
        setCurrentCita(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribeUser();
  }, [profile]);

  const solicitarAtencion = async () => {
    setLoading(true);
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      await addDoc(collection(db, 'citas'), {
        pacienteNombre: profile?.name || 'Paciente',
        pacienteDoc: String(profile?.docNumber || ''),
        doctorId: '', 
        doctorNombre: 'Médico de Turno',
        especialidad: 'Médico General',
        fecha: hoy,
        hora: ahora,
        modalidad: 'Inmediata',
        estado: 'En Espera',
        creadaEn: new Date().getTime() 
      });
    } catch (e) {
      Alert.alert("Error", "No se pudo solicitar la atención.");
      setLoading(false);
    }
  };

  const cancelarAtencion = async () => {
    if (!currentCita?.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'citas', currentCita.id), { estado: 'Cancelada' });
      // The onSnapshot listener will automatically handle clearing currentCita
    } catch (e) {
      Alert.alert("Error", "No se pudo cancelar la cita.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AppHeader
        title="Salud Digital"
        showBack={true}
        onBack={() => nav.goBack()}
        onProfilePress={() => nav.navigate('PatientProfile')}
      />

      <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: 'center' }}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : !currentCita ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 60, marginBottom: 20 }}>🚨</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 10 }}>Consulta General Inmediata</Text>
            <Text style={{ fontSize: 16, color: '#475569', textAlign: 'center', marginBottom: 40, lineHeight: 24 }}>
              Te conectaremos con el próximo médico general disponible mediante videollamada.
            </Text>
            <Pressable onPress={solicitarAtencion} style={{ backgroundColor: '#dc2626', padding: 20, borderRadius: 16, width: '100%', alignItems: 'center', shadowColor: '#dc2626', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>SOLICITAR TURNO AHORA</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#10b981', marginRight: 10, fontSize: 16 }}>🛡️</Text>
              <View>
                <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>CONNECTION STATUS</Text>
                <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 12 }}>Secure Patient Portal Active</Text>
              </View>
            </View>

            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 30, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 28, color: '#2563eb' }}>📋</Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#1e293b', textAlign: 'center', marginBottom: 10, lineHeight: 30 }}>
                {currentCita.estado === 'Confirmada' ? 'El doctor está listo' : 'El doctor lo\natenderá en\nbreve'}
              </Text>
              <Text style={{ fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                {currentCita.estado === 'Confirmada' ? 'Por favor ingrese a la sala virtual.' : 'Thank you for your patience.\nPlease stay on this screen.'}
              </Text>

              {currentCita.estado === 'En Espera' ? (
                <View style={{ width: '100%', gap: 15 }}>
                  <View style={{ flexDirection: 'row', gap: 15, width: '100%' }}>
                    <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1, marginBottom: 8 }}>YOUR TURN</Text>
                      <Text style={{ fontSize: 32, fontWeight: '900', color: '#2563eb' }}>{queuePosition + 1}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1, marginBottom: 8 }}>EST. WAIT</Text>
                      <Text style={{ fontSize: 32, fontWeight: '900', color: '#2563eb' }}>{(queuePosition + 1) * 15}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginTop: -4 }}>mins</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={cancelarAtencion}
                    style={{ backgroundColor: '#fee2e2', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#dc2626', fontSize: 14, fontWeight: '800' }}>CANCELAR SOLICITUD</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => nav.navigate('TelemedicineCall' as any, { citaId: currentCita.id, pacienteNombre: profile?.name || 'Paciente', role: 'patient' })}
                  style={{ backgroundColor: '#10b981', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>ENTRAR A LA SALA 🎥</Text>
                </Pressable>
              )}
            </View>

            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
              <View style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                 <Text style={{ fontSize: 30 }}>👨‍⚕️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563eb', letterSpacing: 1, textTransform: 'uppercase' }}>Your Physician</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b', marginTop: 2 }}>{currentCita.doctorNombre || 'Dr. Elena Rodriguez'}</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>General Practitioner</Text>
              </View>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '800' }}>i</Text>
              </View>
            </View>

            <Pressable onPress={() => nav.navigate('MedicalHistory')} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
              <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 18, color: '#2563eb' }}>🗂</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b' }}>Review Medical Records</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Prepare your history before the call</Text>
              </View>
              <Text style={{ color: '#cbd5e1', fontSize: 20 }}>›</Text>
            </Pressable>

            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 40, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
              <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 18, color: '#2563eb' }}>❓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b' }}>Need Help?</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Contact technical assistance</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function GeneralAppointmentConfirmScreen({ route }: { route: { params: { slotLabel: string; pacienteNombre?: string; doctorNombre?: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const { slotLabel, pacienteNombre, doctorNombre } = route.params;
  const code = useMemo(() => `AG-${slotLabel.replace(/[^0-9]/g, '').slice(0, 4).padEnd(4, '0')}`, [slotLabel]);
  return (
    <ScreenChrome title="¡Cita Confirmada!" subtitle="Tu cita virtual ha sido registrada exitosamente.">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.bigText}>✅ Cita Reservada</Text>
        <Text style={styles.normalText}>Paciente: {pacienteNombre || 'Paciente'}</Text>
        <Text style={styles.normalText}>Doctor: {doctorNombre || 'Especialista'}</Text>
        <Text style={styles.normalText}>Horario: {slotLabel}</Text>
        <Text style={styles.normalText}>Modalidad: Virtual</Text>
        <Text style={styles.normalText}>Código: {code}</Text>
        <View style={{ height: 16 }} />
        <LargePrimaryButton label="Volver al inicio" onPress={() => nav.navigate('HomeServices')} />
        <Text style={styles.disclaimer}>
          El especialista ya fue notificado. El cupo ha sido bloqueado automáticamente.
        </Text>
      </ScrollView>
    </ScreenChrome>
  );
}

export function SpecialistListScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);

  const specialtyCards = useMemo(
    () => [
      { id: 'Cardiología', subtitle: 'Corazón y circulación', color: '#ef4444', bg: '#fee2e2', icon: '❤️' },
      { id: 'Oftalmología', subtitle: 'Visión y ojos', color: '#2563eb', bg: '#dbeafe', icon: '👁️' },
      { id: 'Geriatría', subtitle: 'Salud del adulto mayor', color: '#16a34a', bg: '#dcfce7', icon: '👴' },
      { id: 'Médico General', subtitle: 'Agendamiento de citas', color: '#7c3aed', bg: '#ede9fe', icon: '🩺' },
    ],
    []
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Elegir Especialidad"
        showBack={true}
        onBack={() => nav.navigate('HomeServices')}
      />

      <ScrollView contentContainerStyle={styles.pickContent}>
        <View style={styles.pickInfoBox}>
          <Text style={styles.pickInfoTitle}>¿En qué podemos ayudarle hoy?</Text>
          <Text style={styles.pickInfoText}>Toque el botón grande de la especialidad que necesita.</Text>
        </View>

        <View style={{ height: 6 }} />

        {specialtyCards.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={s.id}
            onPress={() => nav.navigate('SpecialistAppointment', { specialization: s.id })}
            style={({ pressed }) => [styles.pickCard, pressed ? styles.pickCardPressed : null]}
          >
            <View style={[styles.pickIconCircle, { backgroundColor: s.bg }]}>
               <Text style={[styles.pickIcon, { color: s.color }]}>{s.icon}</Text>
            </View>
            <View style={styles.pickCardText}>
              <Text style={styles.pickCardTitle}>{s.id}</Text>
              <Text style={styles.pickCardSubtitle}>{s.subtitle}</Text>
            </View>
            <Text style={styles.pickChevron}>›</Text>
          </Pressable>
        ))}

        <View style={{ height: 8 }} />
        <Text style={styles.disclaimer}>Más especialidades se habilitarán en la siguiente fase del piloto.</Text>
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

export function SpecialistAppointmentScreen({ route }: { route: { params: { specialization: string } } }) {
  return <BaseAppointmentScreen especialidad={route.params.specialization} targetRouteName="SpecialistAppointmentConfirm" />;
}

export function SpecialistAppointmentConfirmScreen({ route }: { route: { params: { specialization: string; slotLabel: string; pacienteNombre?: string; doctorNombre?: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const { specialization, slotLabel, pacienteNombre, doctorNombre } = route.params;
  const code = useMemo(() => `ESP-${slotLabel.replace(/[^0-9]/g, '').slice(0, 4).padEnd(4, '0')}`, [slotLabel]);
  return (
    <ScreenChrome title="¡Cita Confirmada!" subtitle="Tu cita virtual ha sido registrada exitosamente.">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.bigText}>✅ Cita Reservada</Text>
        <Text style={styles.normalText}>Especialidad: {specialization}</Text>
        <Text style={styles.normalText}>Paciente: {pacienteNombre || 'Paciente'}</Text>
        <Text style={styles.normalText}>Doctor: {doctorNombre || 'Especialista'}</Text>
        <Text style={styles.normalText}>Horario: {slotLabel}</Text>
        <Text style={styles.normalText}>Modalidad: Virtual</Text>
        <Text style={styles.normalText}>Código: {code}</Text>
        <View style={{ height: 16 }} />
        <LargePrimaryButton label="Volver al inicio" onPress={() => nav.navigate('HomeServices')} />
        <Text style={styles.disclaimer}>
          El especialista ya fue notificado. El cupo ha sido bloqueado automáticamente.
        </Text>
      </ScrollView>
    </ScreenChrome>
  );
}

export function MisCitasScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
      return;
    }
    const fetchCitas = async () => {
      try {
        const sessionStr = await AsyncStorage.getItem('userSession');
        const session = sessionStr ? JSON.parse(sessionStr) : {};
        const pacienteDoc = session.cedula || profile.docNumber || '';

        const q = query(
          collection(db, 'citas'),
          where('pacienteDoc', '==', String(pacienteDoc))
        );
        const snapshot = await getDocs(q);

        const isPast = (fechaStr: string, horaStr: string): { past: boolean, msAgo: number } => {
          if (!fechaStr || !horaStr) return { past: false, msAgo: 0 };
          try {
            const now = new Date();
            let h = 0, m = 0;
            if (horaStr.includes(' ')) {
              const [time, mod] = horaStr.split(' ');
              const [hours, mins] = time.split(':');
              h = parseInt(hours, 10);
              m = parseInt(mins, 10);
              if (mod === 'PM' && h < 12) h += 12;
              if (mod === 'AM' && h === 12) h = 0;
            } else if (horaStr.includes(':')) {
              const [hours, mins] = horaStr.split(':');
              h = parseInt(hours, 10);
              m = parseInt(mins, 10);
            }
            const citaDate = new Date(`${fechaStr}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
            return { past: citaDate < now, msAgo: now.getTime() - citaDate.getTime() };
          } catch { return { past: false, msAgo: 0 }; }
        };

        const lista: any[] = [];
        for (const d of snapshot.docs) {
          const data = d.data();
          let estadoActual = data.estado;
          
          if (estadoActual === 'Completada' || estadoActual === 'Cancelada') {
            continue;
          }
          
          // Omitir citas inmediatas pendientes (se gestionan en la sala de espera)
          if (data.modalidad === 'Inmediata') {
            continue;
          }

          const { past, msAgo } = isPast(data.fecha, data.hora);
          
          if ((estadoActual === 'Confirmada' || estadoActual === 'En Espera') && past) {
            estadoActual = 'Perdida';
            try {
              await updateDoc(doc(db, 'citas', d.id), { estado: 'Perdida' });
            } catch (e) {}
          }
          
          // Auto-delete if missed and older than 1 day (24h = 86400000ms)
          if (estadoActual === 'Perdida' && past && msAgo > 86400000) {
             try {
               await deleteDoc(doc(db, 'citas', d.id));
             } catch (e) {}
             continue; // No agregar a la lista
          }

          lista.push({ ...data, estado: estadoActual, id: d.id });
        }

        lista.sort((a: any, b: any) => {
          if (a.fecha < b.fecha) return 1;
          if (a.fecha > b.fecha) return -1;
          return a.hora < b.hora ? 1 : -1;
        });

        setCitas(lista);
      } catch (e) {
        console.error('Error cargando citas:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchCitas();
  }, [profile]);

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'Confirmada': return { bg: '#d1fae5', text: '#065f46', dot: '#10b981' };
      case 'Cancelada':  return { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' };
      case 'Perdida':    return { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' };
      default:           return { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' };
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Mis Citas"
        showBack={true}
        onBack={() => nav.goBack()}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 60 }} />
      ) : citas.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: 32, alignItems: 'center', gap: 16 }}>
          <Text style={{ fontSize: 56 }}>📅</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#374151', textAlign: 'center' }}>
            No tienes citas agendadas
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 }}>
            Reserva una cita con un especialista y aparecerá aquí con toda su información.
          </Text>
          <View style={{ height: 12 }} />
          <LargePrimaryButton label="Agendar cita" onPress={() => nav.navigate('SpecialistList')} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '600', marginBottom: 2 }}>
            {citas.length} cita{citas.length !== 1 ? 's' : ''} encontrada{citas.length !== 1 ? 's' : ''}
          </Text>

          {citas.map((cita: any) => {
            const colores = estadoColor(cita.estado);
            return (
              <View key={cita.id} style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 18,
                shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
                borderLeftWidth: 4, borderLeftColor: colores.dot,
              }}>
                {/* Estado */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ backgroundColor: colores.bg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ color: colores.text, fontWeight: '700', fontSize: 12 }}>
                      ● {cita.estado || 'Pendiente'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>#{cita.id.slice(0, 8)}</Text>
                </View>

                {/* Especialidad */}
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
                  {cita.especialidad}
                </Text>

                {/* Info en fila */}
                <View style={{ gap: 6 }}>
                  {[
                    { icon: '👨‍⚕️', label: `Dr. ${cita.doctorNombre || 'Especialista'}` },
                    { icon: '📅', label: cita.fecha },
                    { icon: '⏰', label: cita.hora },
                    { icon: '💻', label: cita.modalidad || 'Virtual' },
                  ].map(item => (
                    <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                      <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Botón a videollamada para el Paciente */}
                {cita.estado === 'Confirmada' ? (
                  <Pressable
                    onPress={() => nav.navigate('TelemedicineCall' as any, { citaId: cita.id, pacienteNombre: profile?.name || 'Paciente', role: 'patient' })}
                    style={{ marginTop: 14, backgroundColor: '#2563eb', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                  >
                    <Text style={{ fontSize: 20 }}>🎥</Text>
                    <Text style={{ fontSize: 15, color: '#fff', fontWeight: '700' }}>
                      Ingresar a Sala Virtual
                    </Text>
                  </Pressable>
                ) : cita.estado === 'Perdida' ? (
                  <Pressable
                    onPress={() => {
                       nav.navigate('SpecialistAppointment' as any, { specialization: cita.especialidad });
                    }}
                    style={{ marginTop: 14, backgroundColor: '#dc2626', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                  >
                    <Text style={{ fontSize: 20 }}>🔄</Text>
                    <Text style={{ fontSize: 15, color: '#fff', fontWeight: '700' }}>
                      Reagendar Cita
                    </Text>
                  </Pressable>
                ) : (
                  <View style={{ marginTop: 14, backgroundColor: '#f3f4f6', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>🔒</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>
                      {cita.estado === 'Completada' ? 'Esta cita ya ha finalizado.' : 'La sala se habilitará cuando la cita esté confirmada.'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
