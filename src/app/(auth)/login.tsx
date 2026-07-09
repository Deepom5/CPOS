import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppButton } from '@/components/ui/app-button';
import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { DEMO_CREDENTIALS } from '@/lib/auth/api';
import { landingFor } from '@/lib/auth/landing';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { tapLight } from '@/lib/haptics';
import { useAuthStore } from '@/state/auth-store';

export default function LoginScreen() {
  const t = usePosTheme();
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const signingIn = useAuthStore((s) => s.signingIn);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0 && !signingIn;

  async function onSubmit() {
    if (!canSubmit) return;
    try {
      await signIn(email, password);
      const next = useAuthStore.getState().session;
      router.replace(next ? landingFor(next.user.role) : '/dashboard');
    } catch {
      // error already surfaced via store state
    }
  }

  function fillDemo(demoEmail: string, demoPassword: string) {
    tapLight();
    setEmail(demoEmail);
    setPassword(demoPassword);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
          <View style={[styles.brandMark, { backgroundColor: t.brand }]}>
            <Text style={[styles.brandMarkText, { color: t.brandText }]}>C</Text>
          </View>
          <Text style={[styles.title, { color: t.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>
            Sign in to manage your restaurant
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="owner@demo"
              placeholderTextColor={t.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={[
                styles.input,
                { backgroundColor: t.surfaceMuted, borderColor: t.border, color: t.text },
              ]}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSecondary }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={t.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                { backgroundColor: t.surfaceMuted, borderColor: t.border, color: t.text },
              ]}
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
              <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
            </View>
          ) : null}

          <AppButton
            title="Sign in"
            onPress={onSubmit}
            loading={signingIn}
            disabled={!canSubmit}
            fullWidth
            size="lg"
          />

          <View style={[styles.hintDivider, { backgroundColor: t.border }]} />

          <Text style={[styles.hintTitle, { color: t.textSecondary }]}>Demo accounts</Text>
          <View style={styles.demoList}>
            {DEMO_CREDENTIALS.map((cred) => (
              <Pressable
                key={cred.email}
                onPress={() => fillDemo(cred.email, cred.password)}
                style={({ pressed }) => [
                  styles.demoRow,
                  {
                    backgroundColor: pressed ? t.backgroundSelected : t.surfaceMuted,
                    borderColor: t.border,
                  },
                ]}
              >
                <View style={styles.demoLeft}>
                  <Text style={[styles.demoRole, { color: t.text }]}>
                    {ROLE_LABELS[cred.role]}
                  </Text>
                  <Text style={[styles.demoEmail, { color: t.textSecondary }]}>
                    {cred.email} · {cred.password}
                  </Text>
                </View>
                <Text style={[styles.demoFill, { color: t.brand }]}>Fill</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  brandMarkText: {
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    marginTop: -Spacing.two,
  },
  field: { gap: Spacing.one },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  errorBox: {
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hintDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoList: { gap: Spacing.two },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  demoLeft: { flex: 1, gap: 2 },
  demoRole: { fontSize: 15, fontWeight: '700' },
  demoEmail: { fontSize: 13 },
  demoFill: { fontSize: 14, fontWeight: '700' },
});
