# Shopbook POS Mobile Application

Shopbook POS is a high-performance Point-of-Sale mobile application built with **React Native**, **Expo SDK 54**, **Expo Router**, and **TypeScript**.

---

## 📦 Package Management & Dependency Rules

To prevent dependency version mismatches, build breakages, and runtime incompatibilities across devices, strictly follow these dependency management guidelines:

### 1. Adding & Updating Dependencies

> [!IMPORTANT]
> **NEVER** use `npm install <package>` or `pnpm add <package>` directly for Expo/React Native packages.
> **ALWAYS** use `npx expo install` inside the `mobile/` directory:

```bash
cd mobile
npx expo install <package-name>
```

`npx expo install` automatically checks the Expo SDK 54 compatibility matrix and installs the exact, tested package version guaranteed to work with your current Expo version.

### 2. Auto-Fixing Mismatched Dependencies

If dependencies ever become out of sync or version mismatches occur, run the auto-fix command:

```bash
cd mobile
npx expo install --fix
```

### 3. Running Project Health Checks

To run the official Expo health suite (verifying 17+ checks including package versions, native plugins, and environment config):

```bash
cd mobile
npx -y expo-doctor
```

---

## ⚙️ Automated Quality Enforcement (Husky Pre-Commit Hooks)

The repository uses **Husky** (`.husky/pre-commit`) to automatically enforce code quality and dependency compatibility before any code can be committed:

Every `git commit` automatically triggers the following checks:

1. **Prettier Formatting**: Auto-formats staged code files via `lint-staged`.
2. **TypeScript Typechecking**: Ensures zero type compilation errors.
3. **Web Build Verification**: Validates web application production bundle compilation.
4. **Expo Mobile Dependency Verification**: Runs `cd mobile && npx expo-doctor`. If any mismatched package version is detected, the commit fails with a prompt to run `npx expo install --fix`.

---

## 🚀 Development Quickstart

### Prerequisites

- Node.js (v18+)
- pnpm package manager
- Expo Go app or Xcode / Android Studio for development builds

### Running Locally

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Start Expo Metro Development Server
cd mobile
pnpm dev

# 3. Launch on Emulators
# Press 'i' for iOS Simulator
# Press 'a' for Android Emulator
```

### Useful Scripts

| Command                  | Description                                              |
| :----------------------- | :------------------------------------------------------- |
| `pnpm dev`               | Start Expo Metro bundler                                 |
| `npx expo run:ios`       | Prebuild & launch local iOS native development build     |
| `npx expo run:android`   | Prebuild & launch local Android native development build |
| `npx -y expo-doctor`     | Validate dependency and project environment health       |
| `npx expo install --fix` | Automatically fix out-of-sync Expo dependencies          |
