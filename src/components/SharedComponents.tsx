import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../theme/globalStyles';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  const nav = useNavigation<any>();
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
    <SafeAreaView style={[styles.safe, { flex: 1 }]}>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }]}>
          {canGoBack && (
            <Pressable onPress={() => nav.goBack()} style={{ paddingRight: 15, paddingVertical: 5 }}>
              <Text style={{ fontSize: 36, color: '#007AFF', lineHeight: 36 }}>‹</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {children}
        {showEmergency ? <EmergencyFAB /> : null}
      </View>
    </SafeAreaView>
  );
}
