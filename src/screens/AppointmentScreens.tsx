import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

import { styles } from '../theme/globalStyles';
import { usePatient } from '../context/PatientContext';
import { Nav } from '../config/types';
import { LargePrimaryButton, ScreenChrome, EmergencyFAB } from '../components/SharedComponents';
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
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState('');

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
        const doctorData = snapshot.docs[0].data();
        const slotsObject = doctorData.slots || {};

        const availableSlots = Object.keys(slotsObject).filter(hora => slotsObject[hora]);

        const citasFormateadas = availableSlots.map(hora => {
          return {
            id: hora,
            start: `${fecha}T${hora}:00`,
          };
        });
        citasFormateadas.sort((a, b) => a.start.localeCompare(b.start));

        setCitas(citasFormateadas);
        if (citasFormateadas.length > 0) setSelectedSlot(citasFormateadas[0].id);
      } else {
        setCitas([]);
      }
    } catch (error) {
      console.error("Error cargando disponibilidad:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pickHeader}>
        <Pressable onPress={() => nav.navigate('HomeServices')} style={styles.pickBackBtn}>
          <Text style={styles.pickBackIcon}>‹</Text>
        </Pressable>
        <Text style={styles.pickHeaderTitle}>{especialidad}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.appointmentContent}>
        <View style={styles.appointmentDoctorCard}>
          <View style={styles.appointmentAvatar}><Text style={styles.appointmentAvatarText}>{especialidad.substring(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.appointmentDoctorName}>Dr. de Turno</Text>
            <Text style={styles.appointmentDoctorMeta}>{especialidad} • Salud Digital</Text>
          </View>
        </View>

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
          ) : citas.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 20 }}>
              No hay citas disponibles para el {selectedDate}.
            </Text>
          ) : (
            <View style={styles.appointmentSlotsGrid}>
              {citas.map((cita) => {
                const selected = cita.id === selectedSlot;
                const fechaCita = new Date(cita.start);
                const horaFormatted = fechaCita.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <Pressable
                    key={cita.id}
                    onPress={() => setSelectedSlot(cita.id)}
                    style={[
                      styles.appointmentSlotBtn,
                      selected ? styles.appointmentSlotBtnSelected : null,
                    ]}
                  >
                    <Text style={[styles.appointmentSlotText, selected ? styles.appointmentSlotTextSelected : null]}>
                      {horaFormatted}
                    </Text>
                  </Pressable>
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
          disabled={!selectedSlot}
          onPress={() => {
            const citaSeleccionada = citas.find(c => c.id === selectedSlot);
            nav.navigate(targetRouteName as any, {
              specialization: especialidad,
              slotLabel: citaSeleccionada ? new Date(citaSeleccionada.start).toLocaleString() : ''
            });
          }}
          style={({ pressed }) => [
            styles.appointmentConfirmBtn,
            !selectedSlot && { backgroundColor: '#ccc' },
            pressed ? styles.btnPressed : null
          ]}
        >
          <Text style={styles.appointmentConfirmText}>Confirmar Cita</Text>
          <Text style={styles.appointmentConfirmIcon}>✓</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function GeneralAppointmentScreen() {
  return <BaseAppointmentScreen especialidad="Médico General" targetRouteName="GeneralAppointmentConfirm" />;
}

export function GeneralAppointmentConfirmScreen({ route }: { route: { params: { slotLabel: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const { slotLabel } = route.params;
  const code = useMemo(() => `AG-${slotLabel.replace(/[^0-9]/g, '').slice(0, 4).padEnd(4, '0')}`, [slotLabel]);
  return (
    <ScreenChrome title="Confirmación de cita" subtitle="Cita virtual (simulada).">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.bigText}>Cita reservada</Text>
        <Text style={styles.normalText}>Horario: {slotLabel}</Text>
        <Text style={styles.normalText}>Código: {code}</Text>
        <View style={{ height: 16 }} />
        <LargePrimaryButton label="Volver al inicio" onPress={() => nav.navigate('HomeServices')} />
        <Text style={styles.disclaimer}>
          En la versión piloto no se realiza una reserva real, pero el flujo está listo para conectarse a Supabase.
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
      { id: 'Medicina General', subtitle: 'Consulta de rutina', color: '#7c3aed', bg: '#ede9fe', icon: '🩺' },
    ],
    []
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pickHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => nav.navigate('HomeServices')}
          style={({ pressed }) => [styles.pickBackBtn, pressed ? styles.pickBackBtnPressed : null]}
        >
          <Text style={styles.pickBackIcon}>‹</Text>
        </Pressable>
        <Text style={styles.pickHeaderTitle}>Elegir Especialidad</Text>
        <View style={{ width: 44 }} />
      </View>

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

export function SpecialistAppointmentConfirmScreen({ route }: { route: { params: { specialization: string; slotLabel: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const { specialization, slotLabel } = route.params;
  return (
    <ScreenChrome title="Confirmación de cita" subtitle="Cita virtual (simulada).">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.bigText}>Cita reservada</Text>
        <Text style={styles.normalText}>Especialidad: {specialization}</Text>
        <Text style={styles.normalText}>Horario: {slotLabel}</Text>
        <View style={{ height: 16 }} />
        <LargePrimaryButton label="Volver al inicio" onPress={() => nav.navigate('HomeServices')} />
      </ScrollView>
    </ScreenChrome>
  );
}
