#!/bin/bash
echo "=== Recherche profils El Mouhssinine ==="
for f in ~/Library/MobileDevice/Provisioning\ Profiles/*.mobileprovision; do
  content=$(security cms -D -i "$f" 2>/dev/null)
  if echo "$content" | grep -q "elmouhssinine\|mosquee"; then
    name=$(echo "$content" | grep -A1 "<key>Name</key>" | tail -1 | sed 's/.*<string>//;s/<\/string>.*//')
    aps=$(echo "$content" | grep -A1 "aps-environment" | tail -1 | sed 's/.*<string>//;s/<\/string>.*//')
    echo "📱 Profil: $name"
    echo "   APNs: $aps"
    echo ""
  fi
done
