import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { addDoc } from 'firebase/firestore';
import { doc, setDoc, collection, query, where, getDocs, DocumentData, Query, CollectionReference, Firestore } from 'firebase/firestore';
import { db } from './firebaseConfig.js'; // <-- IMPORTANTE: Ajusta esta ruta según dónde guardaste el archivo anterior

const guardarNube = async (datos: any) => {
  try {
    const docRef = await firestore()
      .collection("reportes_semanales")
      .add({
        ...datos,
        fechaServidor: firestore.FieldValue.serverTimestamp(),
        procesado: false,
      });
    console.log("Documento escrito con ID: ", docRef.id);
  } catch (e) {
    console.error("Error añadiendo documento: ", e);
  }
};

type DocType = 'CC' | 'CE' | 'Pasaporte';
type PatientProfile = { 
  name: string;
  docType: DocType; 
  docNumber: string; 
  role: 'especialistas' | 'pacientes'; 
};

const LoginScreen = ({ navigation }: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>
}) => {

  useEffect(() => {
    navigation.replace('OnboardingDocument');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f7f7' }} />
  );
};

const validarAccesoLimitado = async (cedulaIngresada: string, rolSeleccionado: 'especialistas' | 'pacientes') => {
  const nav = useNavigation<OnboardingNavProp>();
  if (!cedulaIngresada.trim()) {
    Alert.alert("Error", "Por favor ingresa un número de documento.");
    return;
  }

  setLoading(true); // Asegúrate de tener este estado
  try {
    const cleanDoc = cedulaIngresada.trim();
    
    // Intento 1: Buscar por ID directo (lo que ya tenías)
    const userRef = firestore().collection(rolSeleccionado).doc(cleanDoc);
    const docSnapshot = await userRef.get();

    let userData = null;

    if (docSnapshot.exists()) {
      userData = docSnapshot.data();
    } else {
      // Intento 2: Buscar por campo 'cedula' dentro del documento (por si el ID es aleatorio)
      const querySnapshot = await firestore()
        .collection(rolSeleccionado)
        .where('cedula', '==', cleanDoc)
        .get();
      
      if (!querySnapshot.empty) {
        userData = querySnapshot.docs[0].data();
      }
    }

    if (userData) {
      // ÉXITO
      console.log(`Acceso concedido a ${rolSeleccionado}:`, userData.nombre);
      
      // Guardamos la sesión
      await AsyncStorage.setItem('userSession', JSON.stringify({
        ...userData,
        role: rolSeleccionado,
      }));

      // CAMBIO DE ESTADO PARA EL COLOR VERDE
      setIsVerified(true); 

      // REDIRECCIÓN A HOMESERVICES
      Alert.alert("Acceso Exitoso", `Bienvenido ${userData.nombre || ''}`);
      
      setTimeout(() => {
        // Usamos 'nav' o 'navigation' según como se llame tu variable de useNavigation
        nav.replace('HomeServices' as any); 
      }, 500);

    } else {
      // FALLO
      setIsVerified(false);
      Alert.alert(
        "Acceso Denegado", 
        `La cédula ${cleanDoc} no está registrada en ${rolSeleccionado}.`
      );
    }
  } catch (error) {
    console.error("Error de conexión:", error);
    Alert.alert("Error", "Asegúrate de tener Firestore activado y buena conexión.");
  } finally {
    setLoading(false);
  }
};

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

type RootStackParamList = {
  Login: undefined;
  DoctorScreen: undefined;
  DoctorDashboard: { doctorData: any; cedula: string };
  OnboardingDocument: undefined;
  MainTabs: undefined;
  HomeServices: { patientData: any; cedula: string } | undefined;
  GeneralAppointment: undefined;
  SymptomReport: undefined;
  GeneralAppointmentConfirm: { slotLabel: string };
  SpecialistList: undefined;
  SpecialistAppointment: { specialization: string };
  SpecialistAppointmentConfirm: { specialization: string; slotLabel: string };
  ExamsList: undefined;
  ExamDetail: { examId: string };
  ExamResultViewer: { examId: string };
  MedicalHistory: undefined;
  MedicalHistoryDetail: { historyId: string };
  EmergencyFlow: undefined;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;
const Stack = createNativeStackNavigator<RootStackParamList>();

type PatientContextValue = {
  profile: PatientProfile | null;
  setProfile: (p: PatientProfile) => void;
  clearProfile: () => void;
};

const PatientContext = createContext<PatientContextValue | null>(null);

function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error('PatientContext missing');
  return ctx;
}

const STORAGE_KEY_PROFILE = '@salud_digital_patient_profile_v1';

const docTypeOptions: Array<{ id: DocType; label: string }> = [
  { id: 'CC', label: 'Cédula de ciudadanía (CC)' },
  { id: 'CE', label: 'Cédula de extranjería (CE)' },
  { id: 'Pasaporte', label: 'Pasaporte' },
];

const emergencyNumberDefault = '123';

type Slot = { id: string; label: string };

const slotOptions: Slot[] = [
  { id: 's1', label: 'Hoy - 15:00' },
  { id: 's2', label: 'Hoy - 16:00' },
  { id: 's3', label: 'Mañana - 09:00' },
  { id: 's4', label: 'Mañana - 11:00' },
  { id: 's5', label: 'Esta semana - 10:00' },
];

const specializations = ['Cardiología', 'Neurología', 'Oftalmología', 'Ortopedia', 'Psicología', 'Dermatología'];

type Exam = {
  id: string;
  name: string;
  requestedAt: string; // ISO
  status: 'Disponible' | 'Pendiente';
  summary: string;
  mockContentLabel: string;
};

const exams: Exam[] = [
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

type HistoryEntry = {
  id: string;
  date: string; // ISO
  serviceLabel: string; // Medico general / Especialista
  title: string;
  motivo: string;
  diagnostico: string;
  recomendaciones: string[];
  linkedExamIds: string[];
};

const historyEntries: HistoryEntry[] = [
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

type MockHospital = { id: string; name: string; lat: number; lng: number };
const mockHospitals: MockHospital[] = [
  { id: 'hosp1', name: 'Hospital Central (Ejemplo)', lat: 4.711, lng: -74.0721 },
  { id: 'hosp2', name: 'Clínica Santa Salud (Ejemplo)', lat: 4.69, lng: -74.05 },
  { id: 'hosp3', name: 'Centro Médico Norte (Ejemplo)', lat: 4.74, lng: -74.1 },
];

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
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

function LargePrimaryButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'muted';
  disabled?: boolean;
}) {
  const palette = tone === 'danger' ? styles.btnDanger : tone === 'muted' ? styles.btnMuted : styles.btnPrimary;
  const textStyle = tone === 'danger' ? styles.btnDangerText : styles.btnText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btnBase, palette, disabled ? styles.btnDisabled : null, pressed ? styles.btnPressed : null]}
    >
      <Text style={[styles.btnLabel, textStyle]}>{label}</Text>
    </Pressable>
  );
}

function ServiceCard({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.serviceCard, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.serviceCardInner}>
        <Text style={styles.serviceTitle}>{title}</Text>
        <Text style={styles.serviceSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function EmergencyFAB() {
  const nav = useNavigation<Nav>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="EMERGENCIA"
      onPress={() => nav.navigate('EmergencyFlow')}
      style={({ pressed }) => [styles.emergencyFab, pressed ? styles.emergencyFabPressed : null]}
    >
      <Text style={styles.emergencyFabText}>EMERGENCIA</Text>
    </Pressable>
  );
}

function ScreenChrome({
  title,
  subtitle,
  children,
  showEmergency = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showEmergency?: boolean;
}) {
  return (
    <SafeAreaView style={[styles.safe, { flex: 1 }]}>
      {/* El View interno necesita flex: 1 para que el FAB absolute tenga espacio */}
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
        {showEmergency ? <EmergencyFAB /> : null}
      </View>
    </SafeAreaView>
  );
}

type OnboardingNavProp = NativeStackNavigationProp<RootStackParamList, 'OnboardingDocument'>;

export function OnboardingDocumentScreen() {
  const nav = useNavigation<any>();
  const [docNumber, setDocNumber] = useState('');
  const [userRole, setUserRole] = useState<'especialistas' | 'pacientes' | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  // NUEVO ESTADO: Para controlar el mensaje de error visual
  const [errorMessage, setErrorMessage] = useState<string | null>(null); 
  
  type DocType = 'CC' | 'TI' | 'CE' | 'PAS';
  const [docType, setDocType] = useState<DocType>('CC');

  const docTypeOptions = [
    { id: 'CC', label: 'Cédula de Ciudadanía' },
    { id: 'TI', label: 'Tarjeta de Identidad' },
    { id: 'CE', label: 'Cédula de Extranjería' },
    { id: 'PAS', label: 'Pasaporte' },
  ];

  const handleAuth = async () => {
    if (!userRole) {
      Alert.alert("Aviso", "Selecciona si eres Doctor o Paciente.");
      return;
    }

    if (docNumber.length < 10) {
      Alert.alert("Aviso", "La cédula debe tener 10 dígitos.");
      return;
    }

    setLoading(true);
    setErrorMessage(null); // Limpiamos errores previos al intentar de nuevo

    try {
      const cleanDoc = docNumber.trim();
      
      const q = query(collection(db, userRole), where('cedula', '==', cleanDoc));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setIsVerified(true);
        setErrorMessage(null); // Confirmamos que no hay error
        
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        await AsyncStorage.setItem('userSession', JSON.stringify({
          ...userData,
          role: userRole,
          id: userDoc.id
        }));

        Alert.alert("Éxito", `Bienvenido ${userData.nombre || 'Usuario'}`);
        
        setTimeout(() => {
          if (userRole === 'pacientes') {
            nav.replace('HomeServices'); 
          } else {
            nav.replace('DoctorDashboard'); 
          }
        }, 500);

      } else {
        // SI NO EXISTE: Quitamos el verde y activamos el texto rojo
        setIsVerified(false);
        setErrorMessage('Documento no válido');
      }
    } catch (error: any) {
      console.error("Error de conexión:", error);
      Alert.alert("Error de Firebase", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen} // Usa tus estilos aquí
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenChrome title="Identificación" subtitle="">
        <ScrollView contentContainerStyle={styles.idContent}>
          
          <View style={styles.idEmergencyBox}>
            <Text style={styles.idEmergencyIcon}>!</Text>
            <Text style={styles.idEmergencyText}>¿Es una emergencia? Llame al 911.</Text>
          </View>

          <Text style={styles.idWelcomeTitle}>Acceso al sistema</Text>
          <Text style={styles.idWelcomeSubtitle}>Seleccione su perfil e ingrese su documento.</Text>

          {/* Roles */}
          <View style={styles.idFieldGroup}>
            <Text style={styles.idFieldLabel}>Tipo de Usuario</Text>
            <View style={styles.docGrid}>
              <Pressable
                onPress={() => setUserRole('especialistas')}
                style={[styles.docOption, userRole === 'especialistas' && styles.docOptionSelected]}
              >
                <Text style={[styles.docOptionText, userRole === 'especialistas' && styles.docOptionTextSelected]}>Doctor</Text>
              </Pressable>
              <Pressable
                onPress={() => setUserRole('pacientes')}
                style={[styles.docOption, userRole === 'pacientes' && styles.docOptionSelected]}
              >
                <Text style={[styles.docOptionText, userRole === 'pacientes' && styles.docOptionTextSelected]}>Paciente</Text>
              </Pressable>
            </View>
          </View>

          {/* Tipos de Documento */}
          <View style={styles.idFieldGroup}>
            <Text style={styles.idFieldLabel}>Tipo de documento</Text>
            <View style={styles.docGrid}>
              {docTypeOptions.map((opt) => {
                const selected = opt.id === docType; 
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setDocType(opt.id as DocType);
                      setIsVerified(false);
                      setErrorMessage(null); // Limpiamos el error si cambian de tipo
                    }}
                    style={[styles.docOption, selected ? styles.docOptionSelected : null]}
                  >
                    <Text style={[styles.docOptionText, selected ? styles.docOptionTextSelected : null]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Input de Número */}
          <View style={styles.idFieldGroup}>
            <Text style={styles.idFieldLabel}>Número de documento</Text>
            <TextInput
              value={docNumber}
              onChangeText={(t) => {
                setDocNumber(t.replace(/[^\d]/g, ''));
                setIsVerified(false);
                setErrorMessage(null); // Al escribir de nuevo, se quita el color rojo
              }}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="Ej: 1234567890"
              placeholderTextColor="#9ca3af" // <-- ESTO HACE EL TEXTO MÁS CLARITO
              style={[
                styles.idNumberInput, 
                isVerified && { borderColor: '#0b764a', borderWidth: 2 }, // Borde Verde
                errorMessage ? { borderColor: '#dc2626', borderWidth: 2 } : null // <-- Borde Rojo
              ]}
            />
            
            {/* <-- MENSAJE DE ERROR ROJO DEBAJO DEL INPUT --> */}
            {errorMessage ? (
              <Text style={{ color: '#dc2626', fontSize: 14, marginTop: 6, fontWeight: '500' }}>
                {errorMessage}
              </Text>
            ) : null}
            
          </View>

          {/* Botón Principal */}
          <LargePrimaryButton
            label={loading ? "Verificando..." : "Continuar"}
            onPress={handleAuth}
            disabled={loading}
          />

          <View style={styles.idSecurityRow}>
            <Text style={styles.idSecurityIcon}>🔒</Text>
            <Text style={styles.idSecurityText}>Sus datos están protegidos y seguros.</Text>
          </View>

        </ScrollView>
      </ScreenChrome>
    </KeyboardAvoidingView>
  );
}

function HomeServicesScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderLeft}>
          <Pressable
            onPress={() => nav.navigate('SymptomReport')}
            style={({ pressed}) => [{ opacity: pressed ? 0.5 : 1}]}>
            <Text style={styles.homeHeaderIcon}>＋</Text>
          </Pressable>
          <Text style={styles.homeHeaderTitle}>Salud Principal</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver perfil"
          style={styles.homeHeaderProfile}
        >
          <Text style={styles.homeHeaderProfileIcon}>👤</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.homeContent}>
        {!profile ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Cédula no encontrada</Text>
            <Text style={styles.warningText}>
              Para usar los servicios, primero debe ingresar su documento. Será redirigido a la pantalla inicial.
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.homeWelcomeTitle}>
              Hola{profile ? ',' : ''} Bienvenido
            </Text>
            <Text style={styles.homeWelcomeSubtitle}>
              {profile ? `${profile.docType}: ${profile.docNumber}` : '¿Cómo podemos ayudarle hoy?'}
            </Text>
          </View>
        )}

        <View style={styles.homeCardsGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Médico general"
            onPress={() => nav.navigate('GeneralAppointment')}
            style={({ pressed }) => [styles.homeServiceCard, pressed ? styles.cardPressed : null]}
          >
            <View style={styles.homeServiceIconBox}>
              <Text style={styles.homeServiceIcon}>🩺</Text>
            </View>
            <View style={styles.homeServiceTextBox}>
              <Text style={styles.homeServiceTitle}>Médico General</Text>
              <Text style={styles.homeServiceSubtitle}>Consulta de medicina general inmediata</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Especialistas"
            onPress={() => nav.navigate('SpecialistList')}
            style={({ pressed }) => [styles.homeServiceCard, pressed ? styles.cardPressed : null]}
          >
            <View style={styles.homeServiceIconBox}>
              <Text style={styles.homeServiceIcon}>🧠</Text>
            </View>
            <View style={styles.homeServiceTextBox}>
              <Text style={styles.homeServiceTitle}>Especialistas</Text>
              <Text style={styles.homeServiceSubtitle}>Cardiología, Nutrición y más especialistas</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exámenes médicos"
            onPress={() => nav.navigate('ExamsList')}
            style={({ pressed }) => [styles.homeServiceCard, pressed ? styles.cardPressed : null]}
          >
            <View style={styles.homeServiceIconBox}>
              <Text style={styles.homeServiceIcon}>🧪</Text>
            </View>
            <View style={styles.homeServiceTextBox}>
              <Text style={styles.homeServiceTitle}>Exámenes Médicos</Text>
              <Text style={styles.homeServiceSubtitle}>Resultados y programación de pruebas</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.homeInfoBox}>
          <Text style={styles.homeInfoIcon}>ℹ️</Text>
          <Text style={styles.homeInfoText}>
            Conexión satelital activa. Sus consultas están seguras en zonas rurales.
          </Text>
        </View>
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

function ListOfSlots({ title, onPick }: { title: string; onPick: (slotLabel: string) => void }) {
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

function GeneralAppointmentScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  
  // 1. Estados para los datos de la API
  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState('');

  // 2. Función para obtener datos de Render
  const fetchCitas = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://salud-api-speedy.onrender.com/api/citas');
      const data = await response.json();
      
      setCitas(data);
      
      // Seleccionar la primera cita por defecto si hay alguna
      if (data.length > 0) {
        setSelectedSlot(data[0].id);
      }
    } catch (error) {
      console.error("Error cargando citas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    } else {
      fetchCitas(); // Llamamos a la API al entrar
    }
  }, [profile, nav]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header (se mantiene igual) */}
      <View style={styles.pickHeader}>
        <Pressable onPress={() => nav.navigate('HomeServices')} style={styles.pickBackBtn}>
          <Text style={styles.pickBackIcon}>‹</Text>
        </Pressable>
        <Text style={styles.pickHeaderTitle}>Agendar Médico</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.appointmentContent}>
        {/* Card del Doctor (se mantiene igual) */}
        <View style={styles.appointmentDoctorCard}>
          <View style={styles.appointmentAvatar}><Text style={styles.appointmentAvatarText}>DR</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.appointmentDoctorName}>Dr. Roberto Sánchez</Text>
            <Text style={styles.appointmentDoctorMeta}>Médico General • Rural Salento</Text>
          </View>
        </View>

        <Text style={styles.appointmentStepTitle}>Paso 1: Disponibilidad Real</Text>

    <View style={styles.appointmentCalendarCard}>
      {/* El texto informativo puede quedarse arriba o quitarse */}
      <Text style={styles.appointmentCalendarHint}>
        Horarios sincronizados con Google Calendar.
      </Text>

      {/* AQUÍ INSERTAMOS EL CALENDARIO */}
      <Calendar
        // REEMPLAZA/AÑADE ESTA LÓGICA:
        onDayPress={day => {
          setSelectedDate(day.dateString);
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

        {/* 1. Primero verificamos si ya tocó un día en el calendario */}
        {!selectedDate ? (
          <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
            Seleccione un día en el calendario para ver disponibilidad.
          </Text>
        ) : (
          /* 2. Si ya seleccionó fecha, ejecutamos tu lógica original */
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
            Esta cita es real y se leerá desde el calendario del doctor.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.appointmentFooter}>
        <Pressable
          disabled={!selectedSlot}
          onPress={() => {
            const citaSeleccionada = citas.find(c => c.id === selectedSlot);
            nav.navigate('GeneralAppointmentConfirm', { 
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

function GeneralAppointmentConfirmScreen({ route }: { route: { params: { slotLabel: string } } }) {
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

function SpecialistListScreen() {
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
      { id: 'Geriatría', subtitle: 'Salud del adulto mayor', color: '#16a34a', bg: '#dcfce7', icon: '🧓' },
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

function SpecialistAppointmentScreen({ route }: { route: { params: { specialization: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const { specialization } = route.params;
  return (
    <ScreenChrome title={specialization} subtitle="Elija un horario (ejemplo piloto).">
      <ListOfSlots
        title="Horarios disponibles"
        onPick={(slotLabel) => nav.navigate('SpecialistAppointmentConfirm', { specialization, slotLabel })}
      />
    </ScreenChrome>
  );
}

function SpecialistAppointmentConfirmScreen({ route }: { route: { params: { specialization: string; slotLabel: string } } }) {
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

function ExamsListScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const pending = exams.filter((e) => e.status === 'Pendiente');
  const available = exams.filter((e) => e.status === 'Disponible');
  const latest = useMemo(() => available[0] ?? pending[0] ?? null, [available, pending]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.resultsHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => nav.navigate('HomeServices')}
          style={({ pressed }) => [styles.resultsHeaderBtn, pressed ? styles.pickBackBtnPressed : null]}
        >
          <Text style={styles.resultsHeaderBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.resultsHeaderTitle}>Resultados</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notificaciones"
          style={({ pressed }) => [styles.resultsHeaderBtn, pressed ? styles.pickBackBtnPressed : null]}
        >
          <Text style={styles.resultsHeaderBell}>🔔</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.resultsContent}>
        {latest ? (
          <View style={styles.resultsFeaturedCard}>
            <View style={styles.resultsFeaturedTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.resultsStatusBadge}>
                  <View style={styles.resultsStatusDot} />
                  <Text style={styles.resultsStatusText}>{latest.status === 'Disponible' ? 'Listo' : 'En proceso'}</Text>
                </View>
                <Text style={styles.resultsFeaturedTitle}>{latest.name}</Text>
                <Text style={styles.resultsFeaturedDate}>{formatDate(latest.requestedAt)}</Text>
              </View>
              <View style={styles.resultsFeaturedIconBox}>
                <Text style={styles.resultsFeaturedIcon}>🧾</Text>
              </View>
            </View>

            <View style={styles.resultsAssistCard}>
              <View style={styles.resultsAssistHeader}>
                <Text style={styles.resultsAssistIcon}>✨</Text>
                <Text style={styles.resultsAssistLabel}>Diagnóstico asistido</Text>
              </View>
              <Text style={styles.resultsAssistText}>
                Vista piloto: este texto es un ejemplo de interpretación simple. En producción, esto vendrá de su médico o un
                sistema de apoyo clínico.
              </Text>
            </View>

            <View style={styles.resultsFeaturedActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver detalle"
                onPress={() => nav.navigate('ExamDetail', { examId: latest.id })}
                style={({ pressed }) => [styles.resultsPrimaryAction, pressed ? styles.btnPressed : null]}
              >
                <Text style={styles.resultsPrimaryActionText}>Ver Detalle</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Descargar"
                style={({ pressed }) => [styles.resultsIconAction, pressed ? styles.btnPressed : null]}
              >
                <Text style={styles.resultsIconActionText}>⬇️</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.resultsSectionTitle}>Historial Reciente</Text>

        {(available.length ? available : pending).map((e) => (
          <Pressable
            key={e.id}
            onPress={() => (e.status === 'Disponible' ? nav.navigate('ExamDetail', { examId: e.id }) : undefined)}
            style={({ pressed }) => [styles.resultsRow, pressed ? styles.rowCardPressed : null, e.status !== 'Disponible' ? { opacity: 0.8 } : null]}
          >
            <View style={styles.resultsRowIconBox}>
              <Text style={styles.resultsRowIcon}>{e.status === 'Disponible' ? '🧪' : '⏳'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.resultsRowTop}>
                <Text style={styles.resultsRowTitle}>{e.name}</Text>
                <Text style={e.status === 'Disponible' ? styles.resultsBadgeReady : styles.resultsBadgePending}>
                  {e.status === 'Disponible' ? 'Listo' : 'En proceso'}
                </Text>
              </View>
              <Text style={styles.resultsRowDate}>{formatDate(e.requestedAt)}</Text>
            </View>
            <Text style={styles.pickChevron}>{e.status === 'Disponible' ? '›' : '⏳'}</Text>
          </Pressable>
        ))}

        <View style={{ height: 10 }} />
        <View style={styles.resultsDownloadBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={styles.resultsDownloadIconBox}>
              <Text style={styles.resultsDownloadIcon}>📄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsDownloadTitle}>Carpeta Médica Completa</Text>
              <Text style={styles.resultsDownloadSubtitle}>Todos los resultados en un PDF</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Descargar PDF" style={styles.resultsDownloadBtn}>
            <Text style={styles.resultsDownloadBtnText}>⬇️</Text>
          </Pressable>
        </View>
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

function ExamDetailScreen({ route }: { route: { params: { examId: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const exam = exams.find((e) => e.id === route.params.examId);
  if (!exam) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.resultsHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => nav.navigate('ExamsList')}
            style={({ pressed }) => [styles.resultsHeaderBtn, pressed ? styles.pickBackBtnPressed : null]}
          >
            <Text style={styles.resultsHeaderBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.resultsHeaderTitle}>Examen</Text>
          <View style={styles.resultsHeaderBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.resultsContent}>
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>Examen no encontrado</Text>
            <View style={{ height: 12 }} />
            <LargePrimaryButton label="Volver" onPress={() => nav.navigate('ExamsList')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.resultsHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => nav.navigate('ExamsList')}
          style={({ pressed }) => [styles.resultsHeaderBtn, pressed ? styles.pickBackBtnPressed : null]}
        >
          <Text style={styles.resultsHeaderBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.resultsHeaderTitle}>Detalle</Text>
        <View style={styles.resultsHeaderBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.resultsDetailContent}>
        <View style={styles.resultsDetailCard}>
          <Text style={styles.resultsDetailTitle}>{exam.name}</Text>
          <Text style={styles.resultsDetailDate}>Fecha: {formatDate(exam.requestedAt)}</Text>
          <Text style={styles.resultsDetailStatus}>{exam.status}</Text>
          <Text style={styles.resultsDetailSummary}>{exam.summary}</Text>
        </View>

        <View style={styles.resultsDetailButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver resultado"
            onPress={() => nav.navigate('ExamResultViewer', { examId: exam.id })}
            style={({ pressed }) => [styles.resultsPrimaryAction, pressed ? styles.btnPressed : null]}
          >
            <Text style={styles.resultsPrimaryActionText}>Ver resultado</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Descargar"
            style={({ pressed }) => [styles.resultsIconAction, pressed ? styles.btnPressed : null]}
          >
            <Text style={styles.resultsIconActionText}>⬇️</Text>
          </Pressable>
        </View>

        <LargePrimaryButton label="Volver a exámenes" tone="muted" onPress={() => nav.navigate('ExamsList')} />
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

function ExamResultViewerScreen({ route }: { route: { params: { examId: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
    }
  }, [profile, nav]);
  const exam = exams.find((e) => e.id === route.params.examId);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.resultsHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => nav.goBack()}
          style={({ pressed }) => [styles.resultsHeaderBtn, pressed ? styles.pickBackBtnPressed : null]}
        >
          <Text style={styles.resultsHeaderBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.resultsHeaderTitle}>Resultado</Text>
        <View style={styles.resultsHeaderBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.resultsViewerContent}>
        <View style={styles.documentMock}>
          <Text style={styles.documentTitle}>{exam ? exam.name : 'Examen'}</Text>
          <Text style={styles.documentText}>{exam ? exam.mockContentLabel : ''}</Text>
          <Text style={styles.disclaimer}>
            Esto es un documento simulado para la versión piloto. En el futuro se cargará el PDF real desde Supabase/Storage.
          </Text>
        </View>
        <View style={{ height: 16 }} />
        <LargePrimaryButton label="Volver a exámenes" onPress={() => nav.navigate('ExamsList')} />
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

function MedicalHistoryScreen() {
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

function MedicalHistoryDetailScreen({ route }: { route: { params: { historyId: string } } }) {
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

function EmergencyFlowScreen() {
  
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
                    // eslint-disable-next-line no-alert
                    alert('Compartir no está disponible en este dispositivo.');
                    return;
                  }
                  await Sharing.shareAsync(shareText);
                } catch {
                  // eslint-disable-next-line no-alert
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

export function SymptomReportScreen() {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // ESTADO PARA LA SESIÓN REAL
  const [userProfile, setUserProfile] = useState<{ docNumber: string, name: string } | null>(null);

  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { especialistaId } = route.params || {};

  // 1. CARGAR LOS DATOS REALES AL INICIAR LA PANTALLA
  useEffect(() => {
    const getSession = async () => {
      try {
        const sessionString = await AsyncStorage.getItem('userSession');
        if (sessionString) {
          const session = JSON.parse(sessionString);
          // Mapeamos los campos según como los guardaste en el Login
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

    // Validación: Si no hay sesión, no puede enviar nada
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

      // 2. USAMOS LOS DATOS REALES DEL userProfile
      const nuevoRegistro = {
        pacienteDoc: String(userProfile.docNumber), // Cédula real del login
        pacienteNombre: userProfile.name,          // Nombre real del login
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
      <Text style={styles.title}>Reportar Síntomas</Text>
      
      {/* Mostramos a quién pertenece el reporte para confirmar que no es inventado */}
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

export function DoctorDashboardScreen() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'sintomas'>('sintomas');
  const [doctorData, setDoctorData] = useState<any>(null);

  // Estados de Síntomas
  const [allReportes, setAllReportes] = useState<any[]>([]);
  const [filteredReportes, setFilteredReportes] = useState<any[]>([]);
  const [loadingSintomas, setLoadingSintomas] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  // Estados de Agenda
  const [agenda, setAgenda] = useState<any[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);

  // =====================================================================
  // 1. FUNCIÓN DE CARGA DE SÍNTOMAS (Segura y Filtrada)
  // =====================================================================
  const cargarSintomas = async (cedula: string) => {
    setLoadingSintomas(true);
    try {
      const cedulaLimpia = String(cedula).trim();
      
      // La "válvula" está puesta de nuevo: solo los de este doctor
      const q = query(
        collection(db, 'reportes_sintomas'),
        where('especialistaId', '==', cedulaLimpia)
      );

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));
      setAllReportes(docs);
      
    } catch (error: any) {
      console.error("🚨 Error de Firebase:", error.message);
      Alert.alert("Error", "No se pudieron cargar los síntomas.");
    } finally {
      setLoadingSintomas(false);
    }
  };

  // =====================================================================
  // 2. FUNCIÓN DE CARGA DE AGENDA
  // =====================================================================
  const cargarAgendaRender = async (cedulaDoctor: string) => {
    setLoadingAgenda(true);
    try {
      // 1. Intentamos leer desde el backend
      const response = await fetch('https://salud-api-speedy.onrender.com/api/citas');
      
      if (!response.ok) {
         throw new Error("El backend devolvió error: " + response.status);
      }

      const data = await response.json();
      
      // 2. Mapeamos la respuesta al formato visual porque tu backend nos está
      // enviando "title" y "start", pero esta pantalla esperaba "fecha", "hora" y "nombrePaciente".
      const misCitas = data.map((evento: any) => {
        const fechaObj = new Date(evento.start);
        return {
          id: evento.id,
          idDoctor: cedulaDoctor, 
          fecha: fechaObj.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' }),
          hora: fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          nombrePaciente: evento.title || 'Paciente sin nombre',
          tipo: 'Consulta Calendario'
        };
      });

      setAgenda(misCitas);
    } catch (error) {
      console.error("Error cargando de API Render:", error);
      // Fallback para no dejar la vista vacía si sigue fallando el servidor
      setAgenda([
        { id: '1', idDoctor: cedulaDoctor, fecha: 'Fallback Server Down', hora: '--:--', nombrePaciente: 'Simulación de prueba', tipo: 'Backend no conectado' },
      ]);
    } finally {
      setLoadingAgenda(false);
    }
  };

  // =====================================================================
  // 3. INICIO DE LA PANTALLA
  // =====================================================================
  useEffect(() => {
    const initialize = async () => {
      try {
        const sessionString = await AsyncStorage.getItem('userSession');
        if (!sessionString) return; 
        
        const session = JSON.parse(sessionString);
        setDoctorData(session);

        await cargarSintomas(session.cedula);
        cargarAgendaRender(session.cedula);

      } catch (error) {
        console.error("Error crítico:", error);
      }
    };
    initialize();
  }, []);

  // =====================================================================
  // 4. LÓGICA DE FILTROS LOCALES (Buscador y Botones)
  // =====================================================================
  useEffect(() => {
    let result = allReportes;
    if (showOnlyPending) {
      result = result.filter(r => r.revisado === false);
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.pacienteNombre?.toLowerCase().includes(lowerQuery) || 
        String(r.pacienteDoc).includes(lowerQuery)
      );
    }
    setFilteredReportes(result);
  }, [searchQuery, showOnlyPending, allReportes]);

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      // 1. Agregamos 'as any' para apagar la alarma estricta de TypeScript
      const docRef = doc(db, 'reportes_sintomas', id) as any;

      // 2. Enviamos el cambio
      await setDoc(docRef, { revisado: !currentStatus }, { merge: true });

      // 3. Actualización Optimista (Local)
      const nuevaLista = allReportes.map(reporte => {
        if (reporte.id === id) {
          return { ...reporte, revisado: !currentStatus };
        }
        return reporte;
      });

      // 4. Redibujamos la tabla
      setAllReportes(nuevaLista);
      console.log("✅ Estado actualizado en la nube y en la pantalla");

    } catch (e: any) {
      console.error("🚨 Error al actualizar:", e.message);
      Alert.alert("Error", "No se pudo actualizar el estado.");
    }
  };

  // ================= RENDERIZADOS =================
  const renderAgenda = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeaderRow}>
        <Text style={styles.cardTitle}>Mi Calendario General</Text>
        <TouchableOpacity onPress={() => cargarAgendaRender(doctorData?.cedula)} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻ Actualizar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.calendarInfoBox}>
        <Text style={styles.calendarInfoText}>
          Las citas están conectadas al calendario general de la clínica vía Google Service Accounts. Se obtienen automáticamente.
        </Text>
      </View>
      <View style={{height: 15}}/>

      {loadingAgenda ? (
        <ActivityIndicator size="large" color="#007AFF" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={agenda}
          keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
          ListEmptyComponent={<Text style={styles.empty}>No tienes citas programadas.</Text>}
          renderItem={({ item }) => (
            <View style={styles.agendaCard}>
              <Text style={styles.agendaTime}>{item.fecha} | {item.hora}</Text>
              <Text style={styles.agendaPatient}>{item.nombrePaciente || 'Paciente Anónimo'}</Text>
              <Text style={styles.agendaType}>{item.tipo || 'Consulta General'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderSintomas = () => (
    <View style={styles.tabContent}>
      {/* Buscador y Filtros */}
      <View style={styles.searchContainer}>
        <View style={styles.tabHeaderRow}>
            <TextInput 
            style={styles.searchInput}
            placeholder="Buscar paciente..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            />
            <TouchableOpacity onPress={() => cargarSintomas(doctorData?.cedula)} style={[styles.refreshBtn, {marginLeft: 10}]}>
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
        <ActivityIndicator size="large" color="#007AFF" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={filteredReportes}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No hay reportes que coincidan con tu búsqueda.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.row, item.revisado && styles.rowRevisado]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.pacienteNombre}</Text>
                <Text style={styles.rowDoc}>Cédula Paciente: {item.pacienteDoc}</Text>
                <Text style={styles.rowSymptom} numberOfLines={2}>{item.sintomas}</Text>
              </View>
              <TouchableOpacity style={[styles.actionBtn, item.revisado ? styles.btnRevisado : styles.btnPendiente]} onPress={() => toggleStatus(item.id, item.revisado)}>
                <Text style={styles.btnText}>{item.revisado ? "✓" : "!"}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel del Especialista</Text>
        <Text style={styles.doctorName}>Dr. {doctorData?.nombre || 'Cargando...'}</Text>
      </View>

      <View style={styles.tabSelector}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'agenda' && styles.tabButtonActive]} onPress={() => setActiveTab('agenda')}>
          <Text style={[styles.tabText, activeTab === 'agenda' && styles.tabTextActive]}>📅 Calendario</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'sintomas' && styles.tabButtonActive]} onPress={() => setActiveTab('sintomas')}>
          <Text style={[styles.tabText, activeTab === 'sintomas' && styles.tabTextActive]}>🏥 Síntomas</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'agenda' ? renderAgenda() : renderSintomas()}
    </SafeAreaView>
  );
}

export default function App() {
  const [profile, setProfileState] = useState<PatientProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const theme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: '#f7f7f7',
      },
    }),
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
        if (stored) {
          const parsed = JSON.parse(stored) as PatientProfile;
          if (parsed?.docNumber && parsed.docNumber.trim().length >= 5) {
            setProfileState(parsed);
          }
        }
      } catch {
        // si falla la carga, seguimos con perfil nulo
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (profile) {
          await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY_PROFILE);
        }
      } catch {
        // errores de almacenamiento se ignoran en piloto
      }
    })();
  }, [profile]);

  if (!isHydrated) {
    return (
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </GestureHandlerRootView>
    );
  }

  return (
    <PatientContext.Provider
      value={{
        profile,
        setProfile: (p) => setProfileState(p),
        clearProfile: () => setProfileState(null),
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer theme={theme}>
          <StatusBar style="dark" />
          <Stack.Navigator initialRouteName="Login">

            {/* PANTALLA DE ACCESO PRINCIPAL (La que filtra Rol y Cédula) */}
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />

            {/* --- SECCIÓN DOCTORES --- */}
            <Stack.Screen name="DoctorDashboard" component={DoctorDashboardScreen} options={{ title: 'Panel Médico' }} />
            {/* Aquí irán más pantallas de doctor después: Gestionar disponibilidad, ver pacientes, etc. */}

            {/* --- SECCIÓN PACIENTES (Tu flujo actual) --- */}
            <Stack.Screen name="OnboardingDocument" component={OnboardingDocumentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="HomeServices" component={HomeServicesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GeneralAppointment" component={GeneralAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SymptomReport" component={SymptomReportScreen} options={{ title: "Mis sintomas"}}/>
            <Stack.Screen name="GeneralAppointmentConfirm" component={GeneralAppointmentConfirmScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SpecialistList" component={SpecialistListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SpecialistAppointment" component={SpecialistAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SpecialistAppointmentConfirm" component={SpecialistAppointmentConfirmScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ExamsList" component={ExamsListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ExamDetail" component={ExamDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ExamResultViewer" component={ExamResultViewerScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MedicalHistoryDetail" component={MedicalHistoryDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EmergencyFlow" component={EmergencyFlowScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </PatientContext.Provider>
  );
}

function setLoading(arg0: boolean) {}
function setIsVerified(arg0: boolean) {}

const styles = StyleSheet.create({
  doctorName: { color: '#059669', fontSize: 16, fontWeight: '500', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 50, color: '#94a3b8', fontStyle: 'italic' },
  tabHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  refreshBtn: { backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  refreshText: { color: '#0284c7', fontWeight: 'bold', fontSize: 12 },
  agendaCard: { backgroundColor: '#fff', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 10, borderLeftWidth: 5, borderLeftColor: '#0ea5e9', elevation: 1 },
  agendaTime: { color: '#0ea5e9', fontWeight: 'bold', marginBottom: 5 },
  agendaPatient: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  agendaType: { color: '#64748b', fontSize: 14, marginTop: 5 },
  searchContainer: { padding: 15, backgroundColor: '#fff', marginBottom: 5 },
  searchInput: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#3b82f6' },
  chipText: { color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  row: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, marginHorizontal: 10, marginBottom: 8, borderRadius: 12, alignItems: 'center', elevation: 1 },
  rowRevisado: { opacity: 0.6, backgroundColor: '#f1f5f9' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  rowDoc: { fontSize: 12, color: '#64748b' },
  rowSymptom: { fontSize: 14, color: '#475569', marginTop: 4 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  btnPendiente: { backgroundColor: '#fee2e2' },
  btnRevisado: { backgroundColor: '#dcfce7' },
  tabSelector: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 10, paddingBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 16, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#007AFF', fontWeight: 'bold' },

  // Contenedor principal de cada pestaña
  tabContent: { flex: 1, padding: 20 },
  calendarInfoBox: { backgroundColor: '#e0f2fe', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#bae6fd' },
  calendarInfoText: { color: '#0369a1', fontSize: 14, lineHeight: 20 },
  syncButton: { backgroundColor: '#4285F4', padding: 15, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  syncButtonDisabled: { backgroundColor: '#9ca3af' },
  syncButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  upcomingAppointmentsBox: { flex: 1, backgroundColor: 'white', marginTop: 20, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  sessionInfo: { 
    fontSize: 14, 
    color: '#059669', 
    marginBottom: 15, 
    fontWeight: '500' 
  },
  statusBox: { padding: 12, borderRadius: 8, marginBottom: 15 },
  statusSuccess: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0' },
  statusError: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
  statusText: { fontWeight: '600', textAlign: 'center' },
  statusTextSuccess: { color: '#166534' },
  statusTextError: { color: '#991b1b' },
  characterCount: { textAlign: 'right', color: '#9ca3af', fontSize: 12, marginTop: 5, marginRight: 5 },
  characterCountLimit: { color: '#dc2626', fontWeight: 'bold' }, // Se pone rojo si llega al límite
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  buttonLoading: { backgroundColor: '#93c5fd' },
  inputDisabled: { backgroundColor: '#f3f4f6', color: '#9ca3af' },
  reportCard: { backgroundColor: '#fef3c7', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#fde68a' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  weekBadge: { backgroundColor: '#f59e0b', color: 'white', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  symptomsText: { color: '#78350f', fontSize: 15, fontStyle: 'italic', marginBottom: 12 },
  
  // Botón de revisar
  checkButton: { backgroundColor: '#059669', padding: 10, borderRadius: 6, alignItems: 'center' },
  checkButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  statsCard: { 
    padding: 20, 
    backgroundColor: '#fff', 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 10 },
  doctorContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  idText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#374151',
  },
  appointmentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeText: {
    color: '#6b7280',
  },
  actionButton: {
    marginTop: 20,
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  safe: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  screen: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 120,
    paddingTop: 10,
  },
  idContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    paddingTop: 18,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0b1b33',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 18,
    color: '#1f2937',
    lineHeight: 24,
  },
  sectionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0b1b33',
  },
  normalText: {
    fontSize: 18,
    color: '#111827',
    lineHeight: 24,
    marginTop: 10,
  },
  bigText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0b1b33',
    marginTop: 6,
  },
  bold: { fontWeight: '800' },
  disclaimer: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#b91c1c',
    fontWeight: '700',
  },
  btnBase: {
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  btnPrimary: { backgroundColor: '#0b74ff' },
  btnDanger: { backgroundColor: '#dc2626' },
  btnMuted: { backgroundColor: '#e5e7eb' },
  btnDisabled: { opacity: 0.6 },
  btnPressed: { transform: [{ scale: 0.99 }] },
  btnText: { color: '#0b1b33' },
  btnDangerText: { color: '#ffffff' },
  btnLabel: {
    fontSize: 20,
    fontWeight: '800',
  },
  docGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  docOption: {
    flexBasis: '46%',
    height: 66,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docOptionSelected: {
    borderColor: '#0b74ff',
    backgroundColor: '#e0f2fe',
  },
  docOptionText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0b1b33',
  },
  docOptionTextSelected: {
    color: '#0b74ff',
  },
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    fontSize: 20,
    color: '#0b1b33',
  },
  serviceCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  serviceCardInner: {
    minHeight: 92,
    justifyContent: 'center',
  },
  serviceTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0b1b33',
  },
  serviceSubtitle: {
    marginTop: 6,
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
  },
  cardPressed: { opacity: 0.9 },
  sectionDivider: {
    height: 22,
  },
  rowCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginTop: 12,
  },
  rowCardPressed: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  rowTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0b1b33',
  },
  rowSubtitle: {
    marginTop: 6,
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 22,
  },
  badgeOk: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '900',
    fontSize: 14,
  },
  badgeMuted: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '900',
    fontSize: 14,
  },
  emergencyFab: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  emergencyFabPressed: { opacity: 0.9 },
  emergencyFabText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  hospitalCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginTop: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 10,
  },
  bulletDot: {
    fontSize: 18,
    lineHeight: 24,
    color: '#0b74ff',
  },
  documentMock: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    minHeight: 260,
    justifyContent: 'center',
  },
  documentTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0b1b33',
  },
  documentText: {
    marginTop: 10,
    fontSize: 18,
    color: '#111827',
    lineHeight: 24,
  },
  homeHeader: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  homeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeHeaderIcon: {
    fontSize: 28,
    color: '#0b74ff',
  },
  homeHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b1b33',
  },
  homeHeaderProfile: {
    backgroundColor: '#e0ecff',
    padding: 8,
    borderRadius: 999,
  },
  homeHeaderProfileIcon: {
    fontSize: 20,
  },
  homeContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
    paddingTop: 12,
    gap: 16,
  },
  homeWelcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0b1b33',
    marginBottom: 2,
  },
  homeWelcomeSubtitle: {
    fontSize: 18,
    color: '#4b5563',
  },
  homeCardsGrid: {
    marginTop: 12,
    gap: 14,
  },
  homeServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  homeServiceIconBox: {
    backgroundColor: '#e0ecff',
    padding: 14,
    borderRadius: 18,
    marginRight: 14,
  },
  homeServiceIcon: {
    fontSize: 26,
  },
  homeServiceTextBox: {
    flex: 1,
  },
  homeServiceTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0b1b33',
  },
  homeServiceSubtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#4b5563',
  },
  homeInfoBox: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
  },
  homeInfoIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  homeInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
  },
  pickHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBackBtnPressed: { backgroundColor: '#f3f4f6' },
  pickBackIcon: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0b1b33',
    marginTop: -2,
  },
  pickHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0b1b33',
  },
  pickContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 14,
  },
  pickInfoBox: {
    borderRadius: 18,
    backgroundColor: '#e0ecff',
    borderWidth: 1,
    borderColor: '#cfe2ff',
    padding: 14,
  },
  pickInfoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0b74ff',
  },
  pickInfoText: {
    marginTop: 6,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickCardPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  pickIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickIcon: {
    fontSize: 28,
  },
  pickCardText: {
    flex: 1,
  },
  pickCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0b1b33',
  },
  pickCardSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#4b5563',
  },
  pickChevron: {
    fontSize: 28,
    fontWeight: '900',
    color: '#cbd5e1',
    marginLeft: 6,
    marginTop: -2,
  },
  appointmentContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 180,
    gap: 16,
  },
  appointmentDoctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    padding: 14,
  },
  appointmentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#0b74ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentAvatarText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  appointmentDoctorName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0b1b33',
  },
  appointmentDoctorMeta: {
    marginTop: 4,
    fontSize: 14,
    color: '#4b5563',
  },
  appointmentStepTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0b1b33',
    marginTop: 4,
  },
  appointmentCalendarCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  appointmentMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  appointmentMonthBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentMonthBtnText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0b1b33',
    marginTop: -2,
  },
  appointmentMonthTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0b1b33',
  },
  appointmentCalendarHint: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  appointmentSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  appointmentSlotBtn: {
    width: '48%',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentSlotBtnSelected: {
    borderColor: '#0b74ff',
    backgroundColor: '#e0ecff',
  },
  appointmentSlotText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0b1b33',
  },
  appointmentSlotTextSelected: {
    color: '#0b74ff',
  },
  appointmentSlotSubtext: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
  },
  appointmentSlotSubtextSelected: {
    color: '#0b74ff',
  },
  appointmentInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
    padding: 12,
  },
  appointmentInfoIcon: {
    fontSize: 18,
  },
  appointmentInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
    fontWeight: '600',
  },
  appointmentFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  appointmentConfirmBtn: {
    height: 72,
    borderRadius: 18,
    backgroundColor: '#0b74ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#0b74ff',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  appointmentConfirmText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  appointmentConfirmIcon: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultsHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsHeaderBtnText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0b1b33',
    marginTop: -2,
  },
  resultsHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0b1b33',
  },
  resultsHeaderBell: {
    fontSize: 18,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
    gap: 16,
  },
  resultsFeaturedCard: {
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 16,
  },
  resultsFeaturedTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  resultsStatusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  resultsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  resultsStatusText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultsFeaturedTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '900',
    color: '#0b1b33',
  },
  resultsFeaturedDate: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  resultsFeaturedIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsFeaturedIcon: {
    fontSize: 22,
  },
  resultsAssistCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 12,
  },
  resultsAssistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resultsAssistIcon: {
    fontSize: 16,
    color: '#0b74ff',
  },
  resultsAssistLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0b74ff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  resultsAssistText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  resultsFeaturedActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  resultsPrimaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0b74ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsPrimaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  resultsIconAction: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsIconActionText: {
    fontSize: 18,
  },
  resultsSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0b1b33',
    marginTop: 8,
  },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  resultsRowIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsRowIcon: {
    fontSize: 22,
  },
  resultsRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  resultsRowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#0b1b33',
  },
  resultsRowDate: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  resultsBadgeReady: {
    fontSize: 10,
    fontWeight: '900',
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultsBadgePending: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultsDownloadBox: {
    borderRadius: 18,
    backgroundColor: '#111827',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultsDownloadIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsDownloadIcon: {
    fontSize: 18,
  },
  resultsDownloadTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  resultsDownloadSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
  },
  resultsDownloadBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0b74ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsDownloadBtnText: {
    fontSize: 18,
    color: '#ffffff',
  },
  resultsDetailContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 16,
  },
  resultsDetailCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  resultsDetailTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0b1b33',
  },
  resultsDetailDate: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
  },
  resultsDetailStatus: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultsDetailSummary: {
    marginTop: 12,
    fontSize: 16,
    color: '#111827',
    lineHeight: 22,
  },
  resultsDetailButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  resultsViewerContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 16,
  },
  idEmergencyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 18,
  },
  idEmergencyIcon: {
    fontSize: 24,
    fontWeight: '900',
    color: '#b91c1c',
    marginRight: 10,
  },
  idEmergencyText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#b91c1c',
  },
  idWelcomeTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0b1b33',
    marginBottom: 6,
  },
  idWelcomeSubtitle: {
    fontSize: 18,
    color: '#4b5563',
    lineHeight: 26,
    marginBottom: 24,
  },
  idFieldGroup: {
    marginBottom: 22,
  },
  idFieldLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b1b33',
    marginBottom: 10,
  },
  idNumberInput: {
    height: 64,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#0b1b33',
  },
  idHint: {
    marginTop: 6,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  idHelpButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  idHelpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b74ff',
  },
  idSecurityRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idSecurityIcon: {
    fontSize: 14,
  },
  idSecurityText: {
    fontSize: 14,
    color: '#6b7280',
  },
  warningBox: {
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
    padding: 14,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400e',
  },
  warningText: {
    marginTop: 6,
    fontSize: 16,
    color: '#92400e',
    lineHeight: 22,
  },
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20, 
    backgroundColor: '#f5f5f5' 
  },
  buttonContainer: {
    width: '100%' 
  },
  roleButton: { 
    padding: 20, 
    borderRadius: 12, 
    marginBottom: 15, 
    alignItems: 'center' 
  },
  inputContainer: { 
    width: '100%' 
  },
  mainButton: { 
    backgroundColor: '#333', 
    padding: 18, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  backText: {
    color: '#2196F3', 
    textAlign: 'center', 
    marginTop: 20, 
    fontSize: 16 
  },
});