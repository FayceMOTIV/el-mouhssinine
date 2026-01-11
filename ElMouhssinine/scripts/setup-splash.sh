#!/bin/bash

# Script pour configurer la splash screen
# Usage: ./scripts/setup-splash.sh <chemin_vers_image_splash.png>

SPLASH_IMAGE=$1
ASSETS_PATH="ios/ElMouhssinine/Images.xcassets/SplashImage.imageset"

if [ -z "$SPLASH_IMAGE" ]; then
    echo "Usage: ./scripts/setup-splash.sh <chemin_vers_image_splash.png>"
    echo ""
    echo "Exemple: ./scripts/setup-splash.sh ~/Downloads/splash.png"
    exit 1
fi

if [ ! -f "$SPLASH_IMAGE" ]; then
    echo "Erreur: Le fichier '$SPLASH_IMAGE' n'existe pas"
    exit 1
fi

# Créer le dossier si nécessaire
mkdir -p "$ASSETS_PATH"

# Copier l'image pour les 3 résolutions
echo "Copie de l'image splash..."
cp "$SPLASH_IMAGE" "$ASSETS_PATH/splash.png"
cp "$SPLASH_IMAGE" "$ASSETS_PATH/splash@2x.png"
cp "$SPLASH_IMAGE" "$ASSETS_PATH/splash@3x.png"

echo "Configuration terminée!"
echo ""
echo "L'image a été copiée dans: $ASSETS_PATH"
echo ""
echo "Prochaines étapes:"
echo "1. Ouvrir Xcode: open ios/ElMouhssinine.xcworkspace"
echo "2. Clean build: Product > Clean Build Folder"
echo "3. Rebuild l'app: npx react-native run-ios"
