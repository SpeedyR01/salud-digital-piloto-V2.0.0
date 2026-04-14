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
  const [userRole, setUserRole] = useState<'especialistas' | 'pacientes' | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // NUEVO ESTADO: Para controlar el mensaje de error visual
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    if (docNumber.length < 5) {
      Alert.alert("Aviso", "La cédula debe ser válida.");
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
        setErrorMessage(null);

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        await AsyncStorage.setItem('userSession', JSON.stringify({
          ...userData,
          role: userRole,
          id: userDoc.id
        }));

        if (userRole === 'pacientes') {
          setProfile({
            name: userData.nombre || 'Paciente',
            docType: docType,
            docNumber: cleanDoc,
            role: 'pacientes'
          });
        }

        Alert.alert("Éxito", `Bienvenido ${userData.nombre || 'Usuario'}`);

        setTimeout(() => {
          if (userRole === 'pacientes') {
            nav.replace('HomeServices');
          } else {
            nav.replace('DoctorDashboard');
          }
        }, 500);

      } else {
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
      style={styles.screen}
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
                      setErrorMessage(null);
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
