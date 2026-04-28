import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../firebaseConfig';
import { query, collection, where, getDocs } from 'firebase/firestore';

import { styles } from '../theme/globalStyles';
import { usePatient, DocType } from '../context/PatientContext';
import { ScreenChrome, LargePrimaryButton } from '../components/SharedComponents';
import { RootStackParamList, Nav } from '../config/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const LoginScreen = ({ navigation }: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>
}) => {
  useEffect(() => {
    navigation.replace('OnboardingDocument');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f7f7' }} />
  );
};

export function OnboardingDocumentScreen() {
  const nav = useNavigation<any>();
  const { setProfile } = usePatient();
  const [docNumber, setDocNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAuth = async () => {
    if (docNumber.length < 5) {
      Alert.alert("Aviso", "La cédula debe ser válida.");
      return;
    }

    setLoading(true);
    setErrorMessage(null); // Limpiamos errores previos al intentar de nuevo

    try {
      const cleanDoc = docNumber.trim();
      let foundUser = null;
      let userRole: 'pacientes' | 'especialistas' | null = null;
      let userDocId = null;

      // Buscar en pacientes primero
      let q = query(collection(db, 'pacientes'), where('cedula', '==', cleanDoc));
      let querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        foundUser = querySnapshot.docs[0].data();
        userDocId = querySnapshot.docs[0].id;
        userRole = 'pacientes';
      } else {
        // Si no está en pacientes, buscar en especialistas
        q = query(collection(db, 'especialistas'), where('cedula', '==', cleanDoc));
        querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          foundUser = querySnapshot.docs[0].data();
          userDocId = querySnapshot.docs[0].id;
          userRole = 'especialistas';
        }
      }

      if (foundUser && userRole) {
        setIsVerified(true);
        setErrorMessage(null);

        await AsyncStorage.setItem('userSession', JSON.stringify({
          ...foundUser,
          role: userRole,
          id: userDocId
        }));

        if (userRole === 'pacientes') {
          setProfile({
            name: foundUser.nombre || 'Paciente',
            docType: 'CC',
            docNumber: cleanDoc,
            role: 'pacientes'
          });
        }

        Alert.alert("Éxito", `Bienvenido ${foundUser.nombre || 'Usuario'}`);

        setTimeout(() => {
          if (userRole === 'pacientes') {
            nav.replace('HomeServices');
          } else {
            nav.replace('DoctorDashboard');
          }
        }, 500);

      } else {
        setIsVerified(false);
        setErrorMessage('Documento no encontrado o no válido');
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
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenChrome title="Identificación" subtitle="">
        <ScrollView contentContainerStyle={styles.idContent}>

          <View style={styles.idEmergencyBox}>
            <Text style={styles.idEmergencyIcon}>!</Text>
            <Text style={styles.idEmergencyText}>¿Es una emergencia? Llame al 123.</Text>
          </View>

          <Text style={styles.idWelcomeTitle}>Acceso al sistema</Text>
          <Text style={styles.idWelcomeSubtitle}>Ingrese su documento para continuar.</Text>


          <View style={styles.idFieldGroup}>
            <Text style={styles.idFieldLabel}>Número de documento</Text>
            <TextInput
              value={docNumber}
              onChangeText={(t) => {
                setDocNumber(t.replace(/[^\d]/g, ''));
                setIsVerified(false);
                setErrorMessage(null);
              }}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="Ej: 1234567890"
              placeholderTextColor="#9ca3af"
              style={[
                styles.idNumberInput,
                isVerified && { borderColor: '#0b764a', borderWidth: 2 },
                errorMessage ? { borderColor: '#dc2626', borderWidth: 2 } : null
              ]}
            />

            {errorMessage ? (
              <Text style={{ color: '#dc2626', fontSize: 14, marginTop: 6, fontWeight: '500' }}>
                {errorMessage}
              </Text>
            ) : null}

          </View>

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
