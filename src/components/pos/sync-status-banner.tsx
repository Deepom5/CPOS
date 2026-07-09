import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { useSyncStore } from '@/state/sync-store';

interface BannerTone {
  bg: string;
  fg: string;
  dot: string;
}

function deriveBanner(args: {
  t: ReturnType<typeof usePosTheme>;
  connection: 'online' | 'offline' | 'degraded';
  syncing: boolean;
  pending: number;
  failed: number;
}): { tone: BannerTone; label: string } {
  const { t, connection, syncing, pending, failed } = args;
  if (connection !== 'online') {
    return {
      tone: { bg: t.warningSoft, fg: t.warning, dot: t.warning },
      label: pending > 0 ? `Offline — ${pending} pending` : 'Offline',
    };
  }
  if (failed > 0) {
    return {
      tone: { bg: t.dangerSoft, fg: t.danger, dot: t.danger },
      label: `${failed} failed to sync`,
    };
  }
  if (syncing || pending > 0) {
    return {
      tone: { bg: t.brandSoft, fg: t.brand, dot: t.brand },
      label: syncing ? 'Syncing…' : `${pending} queued`,
    };
  }
  return {
    tone: { bg: t.successSoft, fg: t.success, dot: t.success },
    label: 'Online · all synced',
  };
}

export function SyncStatusBanner() {
  const t = usePosTheme();
  const connection = useSyncStore((s) => s.connection);
  const pending = useSyncStore((s) => s.pendingCount);
  const failed = useSyncStore((s) => s.failedCount);
  const syncing = useSyncStore((s) => s.isSyncing);

  const { tone, label } = deriveBanner({ t, connection, syncing, pending, failed });

  const dotPulse = useSharedValue(1);
  useEffect(() => {
    if (syncing) {
      dotPulse.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 500, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(dotPulse);
      dotPulse.value = withTiming(1, { duration: 200 });
    }
  }, [syncing, dotPulse]);

  const bgProgress = useDerivedValue(
    () => withTiming(1, { duration: 220 }),
    [tone.bg]
  );

  const barAnim = useAnimatedStyle(() => ({
    backgroundColor: tone.bg,
    opacity: bgProgress.value,
  }));

  const dotAnim = useAnimatedStyle(() => ({
    transform: [{ scale: dotPulse.value }],
    backgroundColor: tone.dot,
  }));

  return (
    <Animated.View style={[styles.bar, barAnim]}>
      <Animated.View style={[styles.dot, dotAnim]} />
      <Animated.Text style={{ color: tone.fg, fontWeight: '600', fontSize: 13 }}>
        {label}
      </Animated.Text>
      {syncing ? <SpinningPip color={tone.fg} /> : null}
    </Animated.View>
  );
}

function SpinningPip({ color }: Readonly<{ color: string }>) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = 0;
    rot.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rot);
  }, [rot]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <Animated.View style={[styles.pip, { borderColor: color }, anim]}>
      <View style={[styles.pipDot, { backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 1,
  },
  pipDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
