import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { styles } from '../theme/globalStyles';
import { usePatient } from '../context/PatientContext';
import { EmergencyFAB, AppHeader } from '../components/SharedComponents';
import { Nav } from '../config/types';
import { generateMedicalHistoryPDF } from '../utils/pdfGenerator';

export function HomeServicesScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [nextCita, setNextCita] = useState<any>(null);
  const [pacienteInfo, setPacienteInfo] = useState<any>(null);

  useEffect(() => {
    if (!profile?.docNumber) return;

    const qCita = query(
      collection(db, 'citas'),
      where('pacienteDoc', '==', String(profile.docNumber)),
      where('estado', 'in', ['Confirmada', 'En Espera'])
    );

    const unsubscribeCitas = onSnapshot(qCita, (snapshot) => {
      const citas = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
      
      citas.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.hora.localeCompare(b.hora);
      });

      setNextCita(citas.length > 0 ? citas[0] : null);
    });

    const qPaciente = query(collection(db, 'pacientes'), where('cedula', '==', String(profile.docNumber)));
    const unsubscribePaciente = onSnapshot(qPaciente, (snap) => {
      if (!snap.empty) {
        setPacienteInfo(snap.docs[0].data());
      }
    });

    return () => {
      unsubscribeCitas();
      unsubscribePaciente();
    };
  }, [profile]);
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AppHeader
        title="Salud Digital"
        onProfilePress={() => nav.navigate('PatientProfile')}
      />

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#10b981', marginRight: 10, fontSize: 16 }}>📶</Text>
          <Text style={{ color: '#f8fafc', fontWeight: '700', fontSize: 11, letterSpacing: 1 }}>SISTEMA EN LÍNEA - CONEXIÓN ESTABLE</Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 40 }}>👨‍⚕️</Text>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#fff' }} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 4 }}>Atención Inmediata</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981', marginBottom: 8 }}>• Médico en línea</Text>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>Estamos listos para atenderte ahora mismo.</Text>
        </View>

        {pacienteInfo && (!pacienteInfo.alergias || !pacienteInfo.contactoEmergencia || !pacienteInfo.telefono) && (
          <Pressable 
            onPress={() => nav.navigate('PatientProfile')}
            style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#991b1b', fontWeight: 'bold', fontSize: 14 }}>Acción Requerida</Text>
              <Text style={{ color: '#b91c1c', fontSize: 12, marginTop: 4 }}>Para emergencias y contacto oportuno, es vital que completes todos tus datos, incluyendo tu teléfono, en tu perfil.</Text>
            </View>
          </Pressable>
        )}

        <Pressable onPress={() => nav.navigate('GeneralAppointment')} style={{ backgroundColor: '#0256d3', borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginBottom: 20, shadowColor: '#0256d3', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
          <Text style={{ fontSize: 28, color: '#fff', marginBottom: 8 }}>📞</Text>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Llamar a médico general</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20 }}>
          <Pressable onPress={() => nav.navigate('SpecialistList')} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ backgroundColor: '#e0e7ff', width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, color: '#4338ca' }}>💬</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>Agendar Cita</Text>
          </Pressable>

          <Pressable onPress={() => nav.navigate('ExamsList')} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ backgroundColor: '#e0e7ff', width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, color: '#4338ca' }}>🩺</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>Mis Recetas</Text>
          </Pressable>
        </View>

        {nextCita ? (
          <View style={{ backgroundColor: '#dbeafe', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: '#1e293b', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14 }}>📅</Text>
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e40af' }}>Próxima Consulta</Text>
              <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{nextCita.fecha} a las {nextCita.hora}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e293b', marginTop: 4 }}>
                {nextCita.doctorNombre ? `DR(A). ${nextCita.doctorNombre.toUpperCase()}` : 'MÉDICO GENERAL'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: '#94a3b8', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14 }}>ℹ️</Text>
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>Sin próximas consultas</Text>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>No tienes citas agendadas.</Text>
            </View>
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

export function PatientProfileScreen() {
  const nav = useNavigation<Nav>();
  const { profile, clearProfile } = usePatient();
  
  const [pacienteDocId, setPacienteDocId] = useState<string | null>(null);
  const [alergias, setAlergias] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);

  useEffect(() => {
    if (!profile?.docNumber) return;
    const q = query(collection(db, 'pacientes'), where('cedula', '==', String(profile.docNumber)));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setPacienteDocId(snap.docs[0].id);
        const data = snap.docs[0].data();
        setPatientData(data);
        if (!isEditing) {
          setAlergias(data.alergias || '');
          setContacto(data.contactoEmergencia || '');
          setTelefono(data.telefono || '');
        }
      }
    });
    return () => unsub();
  }, [profile?.docNumber, isEditing]);

  const saveProfileData = async () => {
    if (!pacienteDocId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'pacientes', pacienteDocId), {
        alergias: alergias.trim(),
        contactoEmergencia: contacto.trim(),
        telefono: telefono.trim()
      }, { merge: true });
      setIsEditing(false);
      Alert.alert('Éxito', 'Información médica actualizada');
    } catch(e) {
      Alert.alert('Error', 'No se pudo guardar la información');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userSession');
    clearProfile();
    nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, {justifyContent: 'center', alignItems: 'center'}]}>
         <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title="Mi Perfil"
        showBack={true}
        onBack={() => nav.goBack()}
      />

      <ScrollView contentContainerStyle={styles.pickContent}>
        <View style={{alignItems: 'center', marginVertical: 20}}>
          <View style={{width: 80, height: 80, borderRadius: 40, backgroundColor: '#0b74ff', alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{fontSize: 40, color: '#fff'}}>👤</Text>
          </View>
          <Text style={{fontSize: 24, fontWeight: 'bold', marginTop: 10, color: '#0b1b33'}}>{profile.name}</Text>
          <Text style={{fontSize: 16, color: '#4b5563', marginTop: 4}}>{profile.docType}: {profile.docNumber}</Text>
          <Text style={{fontSize: 14, color: '#0b74ff', marginTop: 4, fontWeight: 'bold'}}>PACIENTE SALUD DIGITAL</Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>Datos de Emergencia</Text>
            {isEditing ? (
              <Pressable onPress={saveProfileData} disabled={saving} style={{ backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Guardar</Text>}
              </Pressable>
            ) : (
              <Pressable onPress={() => setIsEditing(true)} style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#475569', fontWeight: 'bold', fontSize: 12 }}>Editar</Text>
              </Pressable>
            )}
          </View>

          <View style={{ marginBottom: 15 }}>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 'bold' }}>ALERGIAS</Text>
            {isEditing ? (
              <TextInput 
                value={alergias} 
                onChangeText={setAlergias} 
                placeholder="Ej. Penicilina, Ninguna"
                style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, color: '#1e293b' }} 
              />
            ) : (
              <Text style={{ fontSize: 15, color: alergias ? '#1e293b' : '#94a3b8' }}>
                {alergias || 'No registradas'}
              </Text>
            )}
          </View>

          <View>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 'bold' }}>CONTACTO DE EMERGENCIA</Text>
            {isEditing ? (
              <TextInput 
                value={contacto} 
                onChangeText={setContacto} 
                placeholder="Ej. Esposo: 555-1234"
                style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, color: '#1e293b' }} 
              />
            ) : (
              <Text style={{ fontSize: 15, color: contacto ? '#1e293b' : '#94a3b8' }}>
                {contacto || 'No registrado'}
              </Text>
            )}
          </View>

          <View style={{ marginTop: 15 }}>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 'bold' }}>TELÉFONO PERSONAL</Text>
            {isEditing ? (
              <TextInput 
                value={telefono} 
                onChangeText={setTelefono} 
                placeholder="Ej. 300 123 4567"
                keyboardType="phone-pad"
                style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, color: '#1e293b' }} 
              />
            ) : (
              <Text style={{ fontSize: 15, color: telefono ? '#1e293b' : '#94a3b8' }}>
                {telefono || 'No registrado'}
              </Text>
            )}
          </View>
        </View>

        {patientData?.biometrics && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 }}>Biometría (Última Medición)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ width: '48%' }}><Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>PESO</Text><Text style={{ fontSize: 15, color: '#1e293b' }}>{patientData.biometrics.peso_kg} kg</Text></View>
              <View style={{ width: '48%' }}><Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>IMC</Text><Text style={{ fontSize: 15, color: '#1e293b' }}>{patientData.biometrics.imc}</Text></View>
              <View style={{ width: '48%' }}><Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>SPO2</Text><Text style={{ fontSize: 15, color: '#1e293b' }}>{patientData.biometrics.spo2}</Text></View>
              <View style={{ width: '48%' }}><Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>FREC. CARDIACA</Text><Text style={{ fontSize: 15, color: '#1e293b' }}>{patientData.biometrics.frecuencia_cardiaca}</Text></View>
            </View>
          </View>
        )}

        {patientData?.clinical_profile && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 }}>Perfil Clínico</Text>
            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>VEREDICTO</Text>
            <Text style={{ fontSize: 15, color: '#0b764a', fontWeight: 'bold', marginBottom: 12 }}>{patientData.clinical_profile.veredicto}</Text>
            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>CONCLUSIÓN</Text>
            <Text style={{ fontSize: 14, color: '#1e293b' }}>{patientData.clinical_profile.conclusion}</Text>
          </View>
        )}

        {patientData?.flags && (
          <View style={{ backgroundColor: '#fef2f2', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#991b1b', marginBottom: 15 }}>Alertas y Riesgos</Text>
            <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: 'bold', marginBottom: 4 }}>CRÍTICO</Text>
            <Text style={{ fontSize: 14, color: '#b91c1c', marginBottom: 12 }}>{patientData.flags.critico}</Text>
            <Text style={{ fontSize: 12, color: '#c2410c', fontWeight: 'bold', marginBottom: 4 }}>MODERADO</Text>
            <Text style={{ fontSize: 14, color: '#c2410c' }}>{patientData.flags.moderado}</Text>
          </View>
        )}

        <Text style={styles.resultsSectionTitle}>Opciones Médicas</Text>
        
        <Pressable
          style={({ pressed }) => [styles.resultsRow, pressed ? styles.rowCardPressed : null]}
          onPress={() => nav.navigate('MedicalHistory')}
        >
          <View style={styles.resultsRowIconBox}>
            <Text style={styles.resultsRowIcon}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.resultsRowTop}>
              <Text style={styles.resultsRowTitle}>Historial de Consultas</Text>
            </View>
            <Text style={styles.resultsRowDate}>Ver todas mis visitas anteriores</Text>
          </View>
          <Text style={styles.pickChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.resultsRow, pressed ? styles.rowCardPressed : null]}
          onPress={() => nav.navigate('MisCitas')}
        >
          <View style={styles.resultsRowIconBox}>
            <Text style={styles.resultsRowIcon}>📅</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.resultsRowTop}>
              <Text style={styles.resultsRowTitle}>Mis Citas Agendadas</Text>
            </View>
            <Text style={styles.resultsRowDate}>Ver citas médicas reservadas</Text>
          </View>
          <Text style={styles.pickChevron}>›</Text>
        </Pressable>

        <View style={{ height: 10 }} />
        <View style={styles.resultsDownloadBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={styles.resultsDownloadIconBox}>
              <Text style={styles.resultsDownloadIcon}>📄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsDownloadTitle}>Carpeta Médica Completa</Text>
              <Text style={styles.resultsDownloadSubtitle}>Todos los resultados e historial en PDF</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => generateMedicalHistoryPDF(profile)} style={styles.resultsDownloadBtn}>
            <Text style={styles.resultsDownloadBtnText}>⬇️</Text>
          </Pressable>
        </View>

        <Pressable
          style={({pressed}) => [{ marginTop: 40, alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: pressed ? '#fee2e2' : '#fef2f2' }]}
          onPress={handleLogout}
        >
          <Text style={{color: '#dc2626', fontWeight: 'bold', fontSize: 16}}>Cerrar Sesión Segura</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
