# ARIA VO Agent - Guide de Deploiement

## Architecture

```
aria-proxy-worker.js   → Cloudflare Worker (proxy API + aggregation)
aria-vo-agent.html     → SaaS standalone (ouvrable directement ou via iframe)
garage-os.html         → Integration iframe via modal ARIA VO
```

## 1. Deployer le Cloudflare Worker

### Pre-requis
- Compte Cloudflare avec Workers active
- `wrangler` CLI installe (`npm i -g wrangler`)

### Variables d'environnement (Secrets)

```bash
wrangler secret put LEPARKING_TOKEN
wrangler secret put PILOTERR_TOKEN
wrangler secret put AYCP_TOKEN
wrangler secret put UBIFLOW_TOKEN
```

### wrangler.toml

```toml
name = "aria-vo-proxy"
main = "aria-proxy-worker.js"
compatibility_date = "2024-12-01"

[vars]
ENVIRONMENT = "production"
```

### Deploiement

```bash
wrangler deploy
```

Le Worker sera accessible sur `https://aria-vo-proxy.<votre-subdomain>.workers.dev`

### Routes disponibles

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/search` | Recherche vehicules multi-sources |
| GET | `/search/platforms` | Liste des plateformes disponibles |
| POST | `/aycp/publish` | Publier annonce AllYouCanPost |
| GET | `/aycp/status/:id` | Statut publication AYCP |
| GET | `/aycp/leads` | Recuperer leads AYCP |
| DELETE | `/aycp/ad/:id` | Supprimer annonce AYCP |
| POST | `/ubiflow/publish` | Generer XML Ubiflow |
| GET | `/ubiflow/portals` | Liste portails Ubiflow |
| GET | `/health` | Health check |

## 2. Configurer ARIA VO Agent

### Ouvrir le SaaS

**Option A - Standalone :**
Ouvrir `aria-vo-agent.html` directement dans le navigateur.

**Option B - Via GarageOS :**
Dans GarageOS, aller dans la section ARIA et cliquer sur le chip orange "ARIA VO".

### Parametres requis (icone engrenage)

| Parametre | Source | Obligatoire |
|-----------|--------|-------------|
| Cle API Claude | console.anthropic.com | Oui |
| Modele Claude | claude-sonnet-4-20250514 (defaut) | Oui |
| URL Worker | URL du Worker deploye | Oui |
| Token Le Parking Data | leparkingdata.com | Non* |
| Token Piloterr | piloterr.com | Non* |
| Token AYCP | allyoucanpost.fr | Non |
| Token Ubiflow | ubiflow.net | Non |
| Token SIV | api.siv.fr | Non |
| Token Argus | argus.co | Non |
| Nom garage | - | Oui |
| Tel garage | - | Oui |
| Email garage | - | Oui |

*Au moins un token de recherche (Le Parking ou Piloterr) est necessaire pour le sourcing.

### Obtenir les tokens API

#### Claude API
1. Aller sur https://console.anthropic.com
2. Creer une cle API
3. Budget recommande : $20/mois pour usage normal

#### Le Parking Data
1. Contacter leparkingdata.com pour un acces API
2. API de recherche vehicules occasion europeens

#### Piloterr
1. S'inscrire sur piloterr.com
2. Donne acces a LeBonCoin + AutoScout24 via scraping

#### AllYouCanPost (AYCP)
1. S'inscrire sur allyoucanpost.fr
2. Multi-diffusion annonces VO sur 20+ portails
3. API REST pour publication/gestion

#### Ubiflow
1. Contacter ubiflow.net
2. Import XML pour 80+ portails automobile
3. Format standard du secteur

## 3. Utilisation

### Modes

- **Sourcing** : Recherche de vehicules, scoring opportunites, comparaison prix
- **Diffusion** : Generation d'annonces, publication multi-portails
- **Leads** : Suivi des contacts entrants, relance

### Exemples de commandes ARIA VO

```
"Cherche des Peugeot 3008 de 2020 a 2023 moins de 60000 km"
"Decode la plaque AB-123-CD"
"Quelle est la cote Argus de ce vehicule ?"
"Score cette opportunite"
"Genere une annonce pour ce vehicule a 18900 EUR"
"Publie sur LeBonCoin et La Centrale"
"Montre moi les leads de la semaine"
```

### Quick actions

Les boutons d'action rapide en bas du chat permettent de lancer des recherches predefinies sans taper de texte.

## 4. Limites et notes

- L'API Claude est appelee directement depuis le navigateur (`anthropic-dangerous-direct-browser-access: true`). Cela est adapte pour un usage interne/mono-utilisateur. Pour un deploiement multi-utilisateurs, il faudrait router via le Worker.
- Les donnees (historique, parametres) sont stockees dans `localStorage` du navigateur. Elles ne sont pas synchronisees entre appareils.
- Le Worker utilise un cache en memoire (TTL 5 min) pour les recherches. Le cache est perdu a chaque redemarrage du Worker.
- La deduplication des vehicules est basee sur : marque + modele + annee + km (+-5000) + prix (+-500).
- Le scoring 0-100 prend en compte : prix vs cote, kilometrage, age, tendances carburant 2025.

## 5. Structure des fichiers

```
aria-proxy-worker.js    885 lignes   Worker Cloudflare ES modules
aria-vo-agent.html     2169 lignes   SaaS single-file HTML/CSS/JS
garage-os.html          ~12350 lignes  Integration modal iframe
```

## 6. Troubleshooting

| Probleme | Solution |
|----------|----------|
| "Cle API requise" | Ouvrir les parametres et entrer la cle Claude |
| Recherche sans resultats | Verifier tokens Le Parking / Piloterr + URL Worker |
| CORS error | Verifier que le Worker est bien deploye et que l'URL est correcte |
| Publication echoue | Verifier token AYCP / Ubiflow dans les parametres |
| iframe vide dans GarageOS | Verifier que aria-vo-agent.html est dans le meme dossier |
