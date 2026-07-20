# Rapport d'observabilité — E-Shop Monitor

> Compléter ce rapport après avoir exécuté `scripts/demo-traffic` (ou navigué manuellement) contre la stack lancée via `docker compose up`.

## 1. Tunnel d'achat (Umami)

**Capture d'écran :** dashboard Umami → onglet du site "Eco-Hardware Shop" → section Rapports → Funnel (ou, à défaut sur les versions sans ce rapport, l'onglet Événements), montrant les quatre étapes `view_product`, `add_to_cart`, `checkout_start`, `checkout_success` avec leurs volumes respectifs.

`[Insérer capture d'écran ici]`

**Analyse du taux de conversion :**
- Visites totales (période testée) : `___`
- `checkout_success` : `___`
- Taux de conversion global = checkout_success / visites totales = `___ %`

**Analyse de l'abandon par étape :**

| Étape | Nombre d'événements | Taux de passage vs étape précédente |
| --- | --- | --- |
| Visites | `___` | — |
| `view_product` | `___` | `___ %` |
| `add_to_cart` | `___` | `___ %` |
| `checkout_start` | `___` | `___ %` |
| `checkout_success` | `___` | `___ %` |

Étape avec le plus fort abandon observé : `___` (commenter la cause probable : friction du formulaire, hésitation sur le prix, échec de paiement simulé, etc.)

## 2. Métriques standards (Umami)

**Capture d'écran :** dashboard Umami → vue d'ensemble du site, montrant sessions uniques, pages vues, durée moyenne de session, et taux de rebond de la page d'accueil.

`[Insérer capture d'écran ici]`

- Sessions uniques : `___`
- Pages vues : `___`
- Durée moyenne de session : `___`
- Taux de rebond (page d'accueil) : `___ %` — commenter si ce taux est cohérent avec le scénario de démonstration simulé.

## 3. Panier moyen et origine du trafic

- Montant moyen des `checkout_success` (propriété `value`) : `___ €`
- Répartition des `checkout_success` par `utm_source` : `___`

## 4. Erreur de paiement simulée (GlitchTip)

**Capture d'écran :** GlitchTip → Issues → l'erreur du bouton de paiement défaillant, montrant la stack trace complète, le navigateur et l'OS du client.

`[Insérer capture d'écran ici]`

**Explication technique :** décrire, à partir de la stack trace visible dans GlitchTip (fichier, ligne, message d'erreur `TypeError` ou rejet de promesse), comment un développeur identifierait la cause racine et la corrigerait — par exemple : le message et la ligne pointent vers `simulatePayment()` dans `web/app/utils/payment.ts`, ce qui indique une réponse du gateway de paiement non gérée ; un correctif réaliste consisterait à ajouter une validation de la réponse avant d'en lire les propriétés, ou une politique de nouvelle tentative (retry) côté client.

## 5. Suivi de performance (GlitchTip)

**Capture d'écran :** GlitchTip → Performance → transactions des pages `/checkout` et `/checkout/success`, montrant le temps de chargement mesuré.

`[Insérer capture d'écran ici]`

- Temps de chargement médian observé pour `/checkout` : `___ ms`
- Temps de chargement médian observé pour `/checkout/success` (page de validation de commande) : `___ ms`
