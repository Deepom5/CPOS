# 06 — Design System & Component Library

## 6.1 Brand & personality

- **Tone**: friendly, modern, calm. No corporate jargon, no scary alerts.
- **Voice**: short, declarative ("Saved offline", "3 orders waiting to sync"). Never use "Error".
- **Density**: low. One primary action per screen. Big tap targets.
- **Motion**: 150–250ms ease-out for most transitions. Reanimated worklets for cart interactions.
- **Personality cues**: subtle haptics on add-to-cart, soft confetti on first order of the day, friendly empty-state illustrations.

## 6.2 Color tokens

Defined as Tailwind/NativeWind theme tokens so they work in light and dark mode and stay consistent across the app.

```ts
// packages/design-system/src/tokens/colors.ts
export const palette = {
  // Brand
  brand: {
    50:  '#EEF6FF',
    100: '#D9EBFF',
    200: '#B4D6FF',
    300: '#85BAFF',
    400: '#4F97FF',
    500: '#208AEF', // primary (matches existing splash background)
    600: '#1A6FC2',
    700: '#155793',
    800: '#103F69',
    900: '#0A2945',
  },
  // Semantic
  success: { 500: '#16A34A', 100: '#DCFCE7' },
  warning: { 500: '#F59E0B', 100: '#FEF3C7' },
  danger:  { 500: '#DC2626', 100: '#FEE2E2' },
  info:    { 500: '#2563EB', 100: '#DBEAFE' },
  // Surface
  surface: {
    bg:      '#F8FAFC',  // app background
    card:    '#FFFFFF',
    sunken:  '#F1F5F9',
    border:  '#E2E8F0',
    overlay: 'rgba(15, 23, 42, 0.5)',
  },
  text: {
    primary:   '#0F172A',
    secondary: '#475569',
    muted:     '#94A3B8',
    inverse:   '#FFFFFF',
  },
};

export const paletteDark = {
  brand: palette.brand, // accents stay the same
  surface: {
    bg:     '#0B1220',
    card:   '#111827',
    sunken: '#0F172A',
    border: '#1F2937',
    overlay:'rgba(0,0,0,0.6)',
  },
  text: {
    primary:   '#F8FAFC',
    secondary: '#CBD5E1',
    muted:     '#64748B',
    inverse:   '#0F172A',
  },
  success: palette.success,
  warning: palette.warning,
  danger:  palette.danger,
  info:    palette.info,
};
```

Category cards use a **bright but professional** secondary accent set (`teal`, `amber`, `pink`, `lime`, `violet`) assigned to categories so the grid looks lively without overwhelming.

## 6.3 Typography

Two weights, one family. Use the system font on each platform for speed and familiarity (San Francisco on iOS, Roboto on Android), with **Inter** as a custom override on tablets where bigger text needs tighter rendering.

```ts
export const typography = {
  display: { size: 32, weight: '700', lineHeight: 40 },
  h1:      { size: 24, weight: '700', lineHeight: 32 },
  h2:      { size: 20, weight: '600', lineHeight: 28 },
  h3:      { size: 18, weight: '600', lineHeight: 26 },
  body:    { size: 16, weight: '400', lineHeight: 24 },
  bodyMd:  { size: 16, weight: '500', lineHeight: 24 },
  bodySm:  { size: 14, weight: '400', lineHeight: 20 },
  label:   { size: 13, weight: '600', lineHeight: 16, letterSpacing: 0.4 },
  mono:    { size: 14, weight: '500', lineHeight: 20, fontFamily: 'JetBrainsMono' },
};
```

Money on the POS screen always uses `bodyMd`+ tabular figures to avoid jitter on quantity changes.

## 6.4 Spacing, radii, elevation

```ts
export const spacing = { px: 1, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 };
export const radius  = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const shadow  = {
  sm:  { shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md:  { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  lg:  { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};
```

All cards use `radius.lg` (16). Buttons use `radius.md` (12). Pills use `radius.pill`.

## 6.5 Tap targets

Minimum tap target: **48×48** on phones, **56×56** on tablets. Product cards on tablet are at least **140×140** in the grid.

## 6.6 Theming

Light/dark mode driven by the OS via `useColorScheme` (already in repo: [src/hooks/use-color-scheme.ts](../src/hooks/use-color-scheme.ts)). A `useTheme()` hook returns the resolved palette + typography. No theme provider component; the hook reads from a Zustand `uiStore` so manual override works.

## 6.7 Responsive breakpoints

POS-specific breakpoints, not web defaults:

| Name | Width | Layout |
|---|---|---|
| `phone`         | < 600  | Cart in a bottom sheet; categories as a top scroll rail. |
| `tabletPortrait`| 600–899 | Two columns: products (60%) + cart drawer (40%, slide-in). |
| `tabletLandscape` | ≥ 900 | Three columns: categories (160px) + products (flex) + cart (360–420px). |
| `desktop`       | ≥ 1280 | Same as tablet landscape with wider gutters and 5-column product grid. |

Use a custom `useLayout()` hook returning `{ size: 'phone' | 'tabletPortrait' | 'tabletLandscape' | 'desktop', isTablet, orientation }`.

## 6.8 Component library

The package `@cpos/design-system` exports primitives and POS-specific composites. All components accept a `testID` and forward refs.

### 6.8.1 Primitives

| Component | Purpose | Key props |
|---|---|---|
| `AppButton` | Primary action button | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md \| lg`, `loading`, `leftIcon`, `rightIcon`, `fullWidth`, `haptic` |
| `IconButton` | Square icon-only button | `icon`, `label` (a11y), `size`, `variant` |
| `Input` | Single-line text input | `label`, `error`, `prefix`, `suffix`, `rhfControl?` |
| `NumberPad` | On-screen numeric pad for payments/PIN | `value`, `onChange`, `maxLength`, `mode: amount \| pin` |
| `Pill` | Status/filter chip | `tone: neutral \| brand \| success \| warning \| danger \| info`, `selected` |
| `Card` | Surface container | `padding`, `tone`, `pressable`, `onPress` |
| `Avatar` | Customer / employee picture | `name`, `imageUrl?`, `size` |
| `Toggle` / `Switch` | Boolean | `value`, `onChange` |
| `Stepper` | +/- numeric stepper | `value`, `min`, `max`, `step`, `onChange` |
| `Tabs` | Horizontal tab bar | `items`, `value`, `onChange` |
| `BottomSheet` | Modal sheet from bottom | `snapPoints`, `onClose`, gesture-driven |
| `Modal` | Centered dialog | `title`, `actions`, `dismissible` |
| `Toast` | Transient feedback | imperative `toast.show({ tone, message })` |
| `EmptyState` | Empty list illustration | `icon`, `title`, `description`, `action?` |
| `Skeleton` | Loading shimmer | `width`, `height`, `radius` |
| `Divider` | Hairline | `inset?` |
| `Spinner` | Indeterminate progress | `size`, `tone` |

### 6.8.2 POS composites

| Component | Used in |
|---|---|
| `ProductCard` | Billing grid. Image + name + price + variant chevron + low-stock dot. |
| `CategoryPill` | Top/left category rail. Selected state animates with Reanimated layout. |
| `CartItemRow` | Cart panel. Swipe-left to remove, tap to edit modifiers, long-press for notes. |
| `QuantityStepper` | Inside `CartItemRow` and `ModifierSheet`. |
| `ModifierSheet` | Bottom sheet for variant + add-on selection. |
| `PaymentMethodCard` | Big colorful tiles on the payment screen. |
| `CashTenderPad` | Big tender amount input with quick-amounts (5, 10, 20, exact). |
| `TableStatusCard` | Floor-plan tile, color-coded, draggable on admin. |
| `OrderTicketCard` | KDS card with elapsed timer (color shifts as it ages). |
| `KDSColumn` | Vertical column on KDS: New / Preparing / Ready / Served. |
| `InventoryItemRow` | Inventory list row with current stock + low-stock warning. |
| `SyncStatusBanner` | Top-anchored banner; see [02-offline-first-architecture.md](02-offline-first-architecture.md#213-visible-sync-ui). |
| `OfflineBadge` | Small pill rendered in screen headers when offline. |
| `PinPad` | 4–8 digit numeric pad with masked display + haptics. |
| `ReceiptPreview` | Vertical scroll preview of the printed receipt. |
| `OrderNumberDisplay` | Big "Order #042" badge after submit. |
| `ManagerOverrideSheet` | "A manager PIN is needed" sheet for restricted actions. |

### 6.8.3 Cart interaction details

- **Add to cart**: tap → product card pulses (scale 0.96→1, 120ms) → cart icon does a number-bump animation → soft haptic.
- **Edit quantity**: stepper buttons have a long-press repeat after 400ms (RN-Gesture-Handler `LongPressGesture`).
- **Remove item**: swipe left on `CartItemRow` reveals a red action; tap confirms with a `Toast` "Removed, undo" for 4s. Undo restores the row from a Zustand `lastRemoved` slot.
- **Hold order**: a "Hold" button at the top of cart slides the entire cart into a stack, then animates back to empty.

### 6.8.4 Empty states

Each empty state is a friendly illustration + a single sentence + at most one action.

| Screen | Title | Action |
|---|---|---|
| Cart empty | "Tap a product to start an order" | — |
| Orders empty | "No orders yet today" | "Open POS" |
| KDS empty | "Quiet kitchen" | — |
| Customers empty | "No customers saved yet" | "Add customer" |
| Inventory empty | "Add your first ingredient" | "New item" |
| Sync queue empty | "Everything is up to date" | — |
| Offline + first launch | "Connect to set up your menu" | "Try again" |

### 6.8.5 Loading & error states

- Lists use `Skeleton` rows during first load only; subsequent loads use a thin top progress bar (`Spinner` is reserved for blocking actions).
- Errors are inline; a `Toast` with tone `danger` plus a retry action. No full-screen error screens except the unrecoverable "Device revoked" page.

## 6.9 Accessibility

- All interactive components set `accessibilityRole`, `accessibilityLabel`, and `accessibilityState` when applicable.
- Color is never the only signal — every status uses an icon + text.
- Minimum contrast 4.5:1 for text against background, verified in both light and dark palettes.
- Dynamic Type respected via the system font scale, capped at 1.3× on POS screens to avoid layout breakage.

## 6.10 Haptics

- Primary tap: `Haptics.selectionAsync()` (iOS) / equivalent on Android.
- Order submitted: `Haptics.notificationAsync(Success)`.
- Manager override required: `Haptics.notificationAsync(Warning)`.
- Add to cart: light selection.
- PIN wrong: error vibration.

A central `useHaptics()` hook lets us disable haptics globally for noise-sensitive environments.

## 6.11 Component API conventions

- Components accept `style` as the **last** prop and merge it after their own.
- Components forward `testID`; defaults are derived (`testID="AppButton-${variant}"`) so e2e tests need no boilerplate.
- No boolean props for state that has more than two values — use string unions (`tone="success"` not `success`).
- Imperative APIs (toast, modal) go through a single `useImperativeUI()` hook backed by a Zustand store.
