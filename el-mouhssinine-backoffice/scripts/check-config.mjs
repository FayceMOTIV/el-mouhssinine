#!/usr/bin/env node
/**
 * Refuse de construire le backoffice sans sa configuration Firebase.
 *
 * Pourquoi : le 2026-09-02, un build lancé depuis une copie du dépôt SANS le
 * fichier de configuration (il est volontairement non versionné) a produit un
 * site parfaitement valide en apparence... mais sans aucune clé Firebase.
 * Résultat en ligne : « Impossible de se connecter à Firebase », backoffice
 * inutilisable, et rien dans la sortie du build ne le signalait.
 *
 * Un build sans configuration doit ÉCHOUER bruyamment, pas livrer une coquille.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const root = path.resolve(import.meta.dirname, '..')
const values = { ...process.env }

// Vite lit .env puis .env.production ; on regarde les mêmes fichiers.
for (const file of ['.env', '.env.production', '.env.local']) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) continue
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !line.trimStart().startsWith('#')) {
      values[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const missing = REQUIRED.filter((k) => !values[k])

if (missing.length > 0) {
  console.error('\n\x1b[31m✖ BUILD REFUSÉ — configuration Firebase incomplète\x1b[0m')
  console.error('  Variables manquantes : ' + missing.join(', '))
  console.error('\n  Sans elles, le site se construit sans erreur mais affiche')
  console.error('  « Impossible de se connecter à Firebase » une fois en ligne.')
  console.error('\n  Pour corriger : copie .env.example vers .env et remplis-le,')
  console.error('  ou récupère les valeurs avec :')
  console.error('    firebase apps:sdkconfig WEB --project el-mouhssinine\n')
  process.exit(1)
}

console.log('✓ Configuration Firebase complète (' + REQUIRED.length + ' variables)')
