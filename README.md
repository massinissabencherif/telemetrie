# E-Shop Monitor — Eco-Hardware

Démo e-commerce auto-hébergée instrumentée avec GlitchTip (erreurs + performance) et Umami (analytique produit + tunnel de conversion), orchestrée entièrement via Docker Compose.

## Démarrage rapide

Prérequis : Docker + Docker Compose v2, un port 80 libre en local.

```bash
cp .env.example .env
# éditer .env : définir des mots de passe/secrets pour GLITCHTIP_POSTGRES_PASSWORD,
# GLITCHTIP_SECRET_KEY, UMAMI_POSTGRES_PASSWORD, UMAMI_APP_SECRET
docker compose up -d --build
```

**Attention :** Ne lancez pas deux instances de ce projet simultanément sur la même machine Docker : le réseau `proxy` est fixé à un nom fixe (non préfixé par le projet) pour fiabiliser le routage Traefik.

Trois domaines locaux (résolus automatiquement, aucune modification de `/etc/hosts` requise) :

| Service | URL |
| --- | --- |
| Boutique | http://shop.localhost |
| GlitchTip | http://glitchtip.localhost |
| Umami | http://umami.localhost |

## Configuration post-démarrage (obligatoire)

`NUXT_PUBLIC_GLITCHTIP_DSN` et `NUXT_PUBLIC_UMAMI_WEBSITE_ID` ne peuvent être connus qu'après la création d'un projet GlitchTip et d'un site Umami via leurs interfaces web respectives. Suivre la procédure détaillée dans `docs/superpowers/plans/2026-07-20-e-shop-monitor.md` (Tâche 17), en résumé :

1. Créer un compte + une organisation + un projet sur GlitchTip → copier le DSN affiché dans `.env` (`NUXT_PUBLIC_GLITCHTIP_DSN`).
2. Se connecter à Umami (`admin` / `umami`, à changer immédiatement) → ajouter un site `shop.localhost` → copier son Website ID dans `.env` (`NUXT_PUBLIC_UMAMI_WEBSITE_ID`).
3. Relancer le service web : `docker compose up -d --build web`.

## Générer du trafic de démonstration

```bash
cd scripts/demo-traffic
npm install
npx playwright install --with-deps chromium
npm start 30   # simule 30 parcours utilisateurs avec abandons réalistes à chaque étape
```

## Architecture

```
Traefik (:80, routage par Host header *.localhost)
 ├─ shop.localhost      → web (Nuxt 4, réseau "proxy")
 ├─ glitchtip.localhost → glitchtip (réseau "proxy" + "glitchtip-internal")
 │                          ├─ glitchtip-postgres (réseau "glitchtip-internal" uniquement)
 │                          └─ glitchtip-redis    (réseau "glitchtip-internal" uniquement)
 └─ umami.localhost     → umami (réseau "proxy" + "analytics-internal")
                             └─ umami-postgres    (réseau "analytics-internal" uniquement)
```

Les bases de données ne sont jamais exposées sur le réseau `proxy` ni sur l'hôte : elles ne sont joignables que par le service applicatif auquel elles appartiennent.

## Plan de marquage (Umami)

| Événement | Déclencheur | Propriétés |
| --- | --- | --- |
| `view_product` | Affichage d'une fiche produit | `product_id`, `name`, `price` |
| `add_to_cart` | Clic sur "Ajouter au panier" | `product_id`, `name`, `price` |
| `checkout_start` | Arrivée sur `/checkout` | `items`, `value` |
| `checkout_success` | Arrivée sur `/checkout/success` | `value`, `items`, `utm_source`, `ref` |

## RGPD

- Umami ne dépose aucun cookie et n'enregistre aucune donnée personnelle par conception.
- Le SDK GlitchTip est initialisé avec `sendDefaultPii: false` et un hook `beforeSend` qui supprime `event.user`, les cookies et les en-têtes de requête avant envoi.
- Le formulaire de livraison (adresse) reste strictement local au navigateur : il n'est jamais transmis à GlitchTip ni à Umami.

## Tests

```bash
cd web
npm install
npm run test    # Vitest — composables cart/analytics, utilitaires payment/utm, catalogue produits
npm run build   # build de production Nuxt
```
