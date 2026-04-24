import React, { useEffect } from 'react';
import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { WebView } from 'react-native-webview';
import { styles } from '../theme/globalStyles';
import { AppHeader } from '../components/SharedComponents';

export function TelemedicineCallScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { citaId, pacienteNombre, role } = route.params;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (role === 'doctor') {
        Alert.alert("Tiempo completado", "La consulta ha llegado a su límite de tiempo.");
      }
    }, 15 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [role]);

  const endCall = async () => {
    if (role !== 'doctor') {
      Alert.alert("Aviso", "Solo el médico puede marcar la consulta como completada en el sistema.");
      return;
    }
    
    try {
      await setDoc(doc(db, 'citas', citaId) as any, { estado: 'Completada' }, { merge: true });
      nav.replace('DoctorPostCall', { citaId, pacienteNombre });
    } catch (e) {
      if (Platform.OS === 'web') window.alert("Error: No se pudo finalizar la cita.");
      else Alert.alert("Error", "No se pudo finalizar la cita.");
      
      nav.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.tmContainer}>
      {/* Barra superior de control del sistema (Por encima de Jitsi) */}
      <AppHeader
        title="Sala Virtual"
        showBack={true}
        onBack={() => nav.goBack()}
        rightComponent={
          role === 'doctor' ? (
            <Pressable onPress={endCall} style={[styles.tmEndCallBtn, { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }]}>
               <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Terminar</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => nav.goBack()} style={[styles.tmEndCallBtn, { backgroundColor: '#475569', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }]}>
               <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Salir</Text>
            </Pressable>
          )
        }
      />

      {/* WebView: Condicional para soportar tanto Web como Móvil */}
      {Platform.OS === 'web' ? (
        <iframe 
          src={`https://meet.jit.si/SaludDigitalPiloto_${citaId}`}
          style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
        />
      ) : (
        <WebView 
          source={{ uri: `https://meet.jit.si/SaludDigitalPiloto_${citaId}` }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        />
      )}
    </SafeAreaView>
  );
}
