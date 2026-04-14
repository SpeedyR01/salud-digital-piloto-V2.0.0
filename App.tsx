import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PatientProfile, PatientContext } from './src/context/PatientContext';
import { RootStackParamList } from './src/config/types';

// Screens - Auth & Home
import { LoginScreen, OnboardingDocumentScreen } from './src/screens/AuthScreens';
import { HomeServicesScreen, PatientProfileScreen } from './src/screens/PatientScreens';

// Screens - Appointments
import { 
  GeneralAppointmentScreen, 
  GeneralAppointmentConfirmScreen, 
  SpecialistListScreen, 
  SpecialistAppointmentScreen, 
  SpecialistAppointmentConfirmScreen 
} from './src/screens/AppointmentScreens';

// Screens - Exams
import { ExamsListScreen, ExamDetailScreen, ExamResultViewerScreen } from './src/screens/ExamScreens';

// Screens - Medical features & Doctor
import { 
  MedicalHistoryScreen, 
  MedicalHistoryDetailScreen, 
  EmergencyFlowScreen, 
  SymptomReportScreen, 
  DoctorDashboardScreen 
} from './src/screens/MedicalFeatures';

const Stack = createNativeStackNavigator<RootStackParamList>();
const STORAGE_KEY_PROFILE = '@salud_digital_patient_profile_v1';

export default function App() {
  const [profile, setProfileState] = useState<PatientProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  
  const theme = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#f7f7f7',
    },
  }), []);

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
        // Fallo la carga
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
        // Ignorado en piloto
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
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DoctorDashboard" component={DoctorDashboardScreen} options={{ title: 'Panel Médico' }} />
            
            <Stack.Screen name="OnboardingDocument" component={OnboardingDocumentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="HomeServices" component={HomeServicesScreen} options={{ headerShown: false }} />
            
            <Stack.Screen name="GeneralAppointment" component={GeneralAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GeneralAppointmentConfirm" component={GeneralAppointmentConfirmScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SpecialistList" component={SpecialistListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SpecialistAppointment" component={SpecialistAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SpecialistAppointmentConfirm" component={SpecialistAppointmentConfirmScreen} options={{ headerShown: false }} />
            
            <Stack.Screen name="ExamsList" component={ExamsListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ExamDetail" component={ExamDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ExamResultViewer" component={ExamResultViewerScreen} options={{ headerShown: false }} />
            
            <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MedicalHistoryDetail" component={MedicalHistoryDetailScreen} options={{ headerShown: false }} />
            
            <Stack.Screen name="SymptomReport" component={SymptomReportScreen} options={{ title: "Mis sintomas" }} />
            <Stack.Screen name="EmergencyFlow" component={EmergencyFlowScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PatientProfile" component={PatientProfileScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </PatientContext.Provider>
  );
}
