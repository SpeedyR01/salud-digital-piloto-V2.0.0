import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

import { styles } from '../theme/globalStyles';
import { usePatient } from '../context/PatientContext';
import { Nav } from '../config/types';
import { LargePrimaryButton, ScreenChrome, EmergencyFAB } from '../components/SharedComponents';
import { exams } from '../utils/mockData';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  if (!d) return iso;
  return `${d}/${m}/${y}`;
}

export function ExamsListScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [realExams, setRealExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
      return;
    }
    const fetchExams = async () => {
      try {
        const q = query(
          collection(db, 'resultados_examenes'),
          where('pacienteId', '==', profile.docNumber)
        );
        const snapshot = await getDocs(q);

        const examsData: any[] = [];
        const treintaDiasMs = 30 * 24 * 60 * 60 * 1000;
        const ahora = new Date().getTime();

        snapshot.forEach(document => {
          const data = document.data();
          const fechaStr = data.fechaCreacion || new Date().toISOString();
          const fechaMs = new Date(fechaStr).getTime();

          if (ahora - fechaMs <= treintaDiasMs) {
            examsData.push({ id: document.id, ...data, requestedAt: fechaStr });
          }
        });

        examsData.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        setRealExams(examsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, [profile, nav]);

  const latest = useMemo(() => realExams[0] ?? null, [realExams]);

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
        <View style={styles.resultsHeaderBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.resultsContent}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : realExams.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 50, color: '#666' }}>No tienes resultados médicos recientes (últimos 30 días).</Text>
        ) : (
          <>
            {latest ? (
              <View style={styles.resultsFeaturedCard}>
                <View style={styles.resultsFeaturedTopRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.resultsStatusBadge}>
                      <View style={styles.resultsStatusDot} />
                      <Text style={styles.resultsStatusText}>Listo</Text>
                    </View>
                    <Text style={styles.resultsFeaturedTitle}>{latest.name}</Text>
                    <Text style={styles.resultsFeaturedDate}>{formatDate(latest.requestedAt)}</Text>
                  </View>
                  <View style={styles.resultsFeaturedIconBox}>
                    <Text style={styles.resultsFeaturedIcon}>🧪</Text>
                  </View>
                </View>

                <View style={styles.resultsAssistCard}>
                  <View style={styles.resultsAssistHeader}>
                    <Text style={styles.resultsAssistIcon}>🩺</Text>
                    <Text style={styles.resultsAssistLabel}>Nota del Médico: {latest.doctorName || 'Dr. M. General'}</Text>
                  </View>
                  <Text style={styles.resultsAssistText} numberOfLines={3}>
                    {latest.detalleText}
                  </Text>
                </View>

                <View style={styles.resultsFeaturedActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ver detalle"
                    onPress={() => nav.navigate('ExamDetail', { examId: latest.id })}
                    style={({ pressed }) => [styles.resultsPrimaryAction, pressed ? styles.btnPressed : null]}
                  >
                    <Text style={styles.resultsPrimaryActionText}>Ver Detalle Completo</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text style={styles.resultsSectionTitle}>Historial Reciente (30 días)</Text>

            {realExams.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => nav.navigate('ExamDetail', { examId: e.id })}
                style={({ pressed }) => [styles.resultsRow, pressed ? styles.rowCardPressed : null]}
              >
                <View style={styles.resultsRowIconBox}>
                  <Text style={styles.resultsRowIcon}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.resultsRowTop}>
                    <Text style={styles.resultsRowTitle}>{e.name}</Text>
                    <Text style={styles.resultsBadgeReady}>
                      Listo
                    </Text>
                  </View>
                  <Text style={styles.resultsRowDate}>{formatDate(e.requestedAt)}</Text>
                </View>
                <Text style={styles.pickChevron}>›</Text>
              </Pressable>
            ))}
          </>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

export function ExamDetailScreen({ route }: { route: { params: { examId: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
      return;
    }
    const fetchDoc = async () => {
      const mockE = exams.find(e => e.id === route.params.examId);
      if (mockE) {
        setExam(mockE);
        setLoading(false);
        return;
      }
      try {
        const docSnap = await getDoc(doc(db, 'resultados_examenes', route.params.examId));
        if (docSnap.exists()) {
          const d = docSnap.data();
          setExam({
            id: docSnap.id,
            name: d.name,
            status: d.status,
            requestedAt: d.fechaCreacion,
            summary: "Examen completado exitosamente",
            mockContentLabel: d.detalleText,
            doctorName: d.doctorName
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [profile, nav, route.params.examId]);

  if (loading) {
    return <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#007AFF" /></SafeAreaView>
  }

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
          {exam.doctorName && <Text style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>Por: {exam.doctorName}</Text>}
          <Text style={styles.resultsDetailStatus}>Listo para revisar</Text>
          <Text style={styles.resultsDetailSummary}>{exam.summary}</Text>
        </View>

        <View style={styles.resultsDetailButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver resultado"
            onPress={() => nav.navigate('ExamResultViewer', { examId: exam.id })}
            style={({ pressed }) => [styles.resultsPrimaryAction, pressed ? styles.btnPressed : null]}
          >
            <Text style={styles.resultsPrimaryActionText}>Ver Documento del Médico</Text>
          </Pressable>
        </View>

        <LargePrimaryButton label="Volver a exámenes" tone="muted" onPress={() => nav.navigate('ExamsList')} />
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}

export function ExamResultViewerScreen({ route }: { route: { params: { examId: string } } }) {
  const nav = useNavigation<Nav>();
  const { profile } = usePatient();
  const [exam, setExam] = useState<any>(null);

  useEffect(() => {
    if (!profile) {
      nav.reset({ index: 0, routes: [{ name: 'OnboardingDocument' }] });
      return;
    }
    const fetchDoc = async () => {
      const mockE = exams.find(e => e.id === route.params.examId);
      if (mockE) {
        setExam(mockE);
        return;
      }
      try {
        const docSnap = await getDoc(doc(db, 'resultados_examenes', route.params.examId));
        if (docSnap.exists()) {
          const d = docSnap.data();
          setExam({ name: d.name, mockContentLabel: d.detalleText });
        }
      } catch (e) { }
    };
    fetchDoc();
  }, [profile, nav, route.params.examId]);

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
          <Text style={styles.documentTitle}>{exam ? exam.name : 'Cargando...'}</Text>
          <Text style={styles.documentText}>{exam ? exam.mockContentLabel : 'Buscando datos del doctor...'}</Text>
          <Text style={styles.disclaimer}>
            Este documento representa la nota subida en vivo por el doctor a su paciente.
          </Text>
        </View>
        <View style={{ height: 16 }} />
        <LargePrimaryButton label="Volver a exámenes" onPress={() => nav.navigate('ExamsList')} />
      </ScrollView>

      <EmergencyFAB />
    </SafeAreaView>
  );
}
