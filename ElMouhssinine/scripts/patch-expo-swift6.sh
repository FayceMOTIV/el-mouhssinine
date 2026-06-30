#!/bin/bash
# Patch expo-modules-core for Xcode 16.4 (Swift 6.1.2) compatibility
# Swift 6 strict concurrency + @MainActor on conformances is broken
# This patches swift_version to 5.9 and removes @MainActor from conformance declarations

EXPO_CORE="node_modules/expo-modules-core"

if [ ! -d "$EXPO_CORE" ]; then
  echo "[patch-expo-swift6] expo-modules-core not found, skipping"
  exit 0
fi

echo "[patch-expo-swift6] Patching expo-modules-core for Xcode 16.4 compatibility..."

# 1. Set swift_version to 5.9 in podspec
sed -i '' "s/s.swift_version  = '6.0'/s.swift_version  = '5.9'/" "$EXPO_CORE/ExpoModulesCore.podspec"

# 2. Remove @MainActor from protocol conformance declarations
sed -i '' 's/@MainActor AnyExpoSwiftUIHostingView/AnyExpoSwiftUIHostingView/' "$EXPO_CORE/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift"
sed -i '' 's/@MainActor ExpoSwiftUI.ViewWrapper/ExpoSwiftUI.ViewWrapper/' "$EXPO_CORE/ios/Core/Views/SwiftUI/SwiftUIVirtualView.swift"
sed -i '' 's/@MainActor AnyArgument/AnyArgument/' "$EXPO_CORE/ios/Core/Views/ViewDefinition.swift"

echo "[patch-expo-swift6] Done. Run 'cd ios && pod install' to apply."
