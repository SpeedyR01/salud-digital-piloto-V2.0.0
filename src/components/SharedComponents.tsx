import React from 'react';
import { Pressable, Text, View, Alert, Linking, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../theme/globalStyles';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePatient } from '../context/PatientContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { db } from '../../firebaseConfig';
import { doc, setDoc, GeoPoint } from 'firebase/firestore';
export const EMERGENCY_NUMBER = '3022969995'; // Operador (Asistente)

export async function callEmergency() {
  let pacienteId = 'unknown';
  let ubicacion = { lat: 0, lng: 0 };
  
  try {
    const sessionString = await AsyncStorage.getItem('userSession');
    if (sessionString) {
      const session = JSON.parse(sessionString);
      pacienteId = session.cedula || session.docNumber || 'unknown';
    }
  } catch (e) {
    console.warn('Error leyendo sesión para emergencia', e);
  }

  // Activar ubicación en segundo plano de forma automática
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      ubicacion = { lat: location.coords.latitude, lng: location.coords.longitude };
      console.log('📍 Ubicación activada para rastreo de emergencias:', ubicacion);
    }
  } catch (error) {
    console.warn('No se pudo obtener la ubicación para la emergencia', error);
  }
  
  // Registrar emergencia directamente en Firestore
  try {
    const emergenciaRef = doc(db, 'emergencias', String(pacienteId));
    await setDoc(emergenciaRef, {
      pacienteId: String(pacienteId),
      ubicacion: new GeoPoint(Number(ubicacion.lat || 0), Number(ubicacion.lng || 0)),
      estado: 'activa',
      timestamp: new Date().toISOString()
    });
    console.log('Emergencia registrada en Firestore directamente');
  } catch (error) {
    console.warn('Error registrando emergencia en Firestore:', error);
  }

  if (Platform.OS === 'web') {
    alert('🚨 EMERGENCIA\n\nLlamando al operador...\n(Su ubicación está siendo rastreada y el operador coordinará la ayuda)');
  } else {
    // Llamar directamente sin confirmación extra
    Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
  }
}

export function AppHeader({
  title = 'Salud Digital',
  showBack = false,
  onBack,
  onProfilePress,
  isDoctor = false,
  doctorInitials,
  rightComponent,
}: {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onProfilePress?: () => void;
  isDoctor?: boolean;
  doctorInitials?: string;
  rightComponent?: React.ReactNode;
}) {
  const nav = useNavigation();
  const handleBack = onBack || (() => nav.goBack());

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: '#f8fafc' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
        {showBack ? (
          <Pressable onPress={handleBack} hitSlop={15}>
            <Text style={{ fontSize: 32, color: '#2563eb', lineHeight: 32 }}>‹</Text>
          </Pressable>
        ) : null}
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#1d4ed8' }}>{title}</Text>
      </View>
      {rightComponent ? rightComponent : onProfilePress ? (
        <Pressable onPress={onProfilePress}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDoctor ? '#93c5fd' : '#1e293b', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Text style={{ fontWeight: '700', color: isDoctor ? '#1e3a8a' : '#fff', fontSize: isDoctor ? 12 : 20 }}>
              {isDoctor ? (doctorInitials || 'DR') : '🧑‍💻'}
            </Text>
          </View>
        </Pressable>
      ) : (
         <View style={{ width: 36, height: 36 }} />
      )}
    </View>
  );
}

export function LargePrimaryButton({
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

export function ServiceCard({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
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

export function EmergencyFAB() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="EMERGENCIA"
      onPress={callEmergency}
      style={({ pressed }) => [styles.emergencyFab, pressed ? styles.emergencyFabPressed : null]}
    >
      <Text style={styles.emergencyFabText}>EMERGENCIA</Text>
    </Pressable>
  );
}

export function ScreenChrome({
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
  const nav = useNavigation();
  const canGoBack = nav.canGoBack();

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: '#f8fafc' }]}>
      <AppHeader title={title} showBack={canGoBack} onBack={() => nav.goBack()} />
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {subtitle ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <Text style={{ fontSize: 14, color: '#64748b' }}>{subtitle}</Text>
          </View>
        ) : null}
        {children}
        {showEmergency ? <EmergencyFAB /> : null}
      </View>
    </SafeAreaView>
  );
}
