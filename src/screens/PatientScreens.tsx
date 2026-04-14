import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from '../theme/globalStyles';
import { usePatient } from '../context/PatientContext';
import { EmergencyFAB } from '../components/SharedComponents';
import { Nav } from '../config/types';
import { generateMedicalHistoryPDF } from '../utils/pdfGenerator';

export function HomeServicesScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderLeft}>
          <Pressable
            onPress={() => nav.navigate('SymptomReport')}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
            <Text style={styles.homeHeaderIcon}>＋</Text>
          </Pressable>
          <Text style={styles.homeHeaderTitle}>Salud Principal</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver perfil"
          style={styles.homeHeaderProfile}
          onPress={() => nav.navigate('PatientProfile')}
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

export function PatientProfileScreen() {
  const nav = useNavigation<Nav>();
  const { profile, clearProfile } = usePatient();

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
      <View style={styles.resultsHeader}>
        <Pressable onPress={() => nav.goBack()} style={styles.resultsHeaderBtn}>
          <Text style={styles.resultsHeaderBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.resultsHeaderTitle}>Mi Perfil</Text>
        <View style={styles.resultsHeaderBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.pickContent}>
        <View style={{alignItems: 'center', marginVertical: 20}}>
          <View style={{width: 80, height: 80, borderRadius: 40, backgroundColor: '#0b74ff', alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{fontSize: 40, color: '#fff'}}>👤</Text>
          </View>
          <Text style={{fontSize: 24, fontWeight: 'bold', marginTop: 10, color: '#0b1b33'}}>{profile.name}</Text>
          <Text style={{fontSize: 16, color: '#4b5563', marginTop: 4}}>{profile.docType}: {profile.docNumber}</Text>
          <Text style={{fontSize: 14, color: '#0b74ff', marginTop: 4, fontWeight: 'bold'}}>PACIENTE SALUD DIGITAL</Text>
        </View>

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
