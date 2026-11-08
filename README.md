# YellaCar — Phase 1

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL

## Démarrage

```bash
npm install
cp .env.example .env        # puis renseignez DATABASE_URL et AUTH_SECRET
npx prisma db push          # crée / met à jour les tables (à relancer après chaque mise à jour)
npm run db:seed             # société de démo + admin
npm run dev
```

Connexion de démo : `admin@yellacar.test` / `ChangeMe123!` (à changer).

## Contenu de la phase 1

- Connexion (cookie JWT httpOnly) et protection des pages par middleware
- Tableau de bord (compteurs)
- Flotte : liste + ajout de véhicule
- Clients : liste + ajout de client
- Journal d'audit (connexion, créations)
- Tarifs : base par catégorie (jour, semaine, mois), saisons, options, protections
- Réservations : recherche de disponibilités, prix calculé automatiquement, détection des conflits (avec 60 min de préparation), devis, statuts (confirmer, départ, retour, annuler)
- Planning hebdomadaire par véhicule
- Contrat de location imprimable (Imprimer → Enregistrer en PDF)

- Finance : paiements et remboursements (avec reçus), caisse avec clôture et écart, cautions, factures, dépenses, fournisseurs, vue d’ensemble mensuelle

## Premier usage

1. Page **Tarifs** : cliquez sur « Créer options et protections par défaut ».
2. Ajoutez un véhicule et un client.
3. **Réservations → Nouvelle réservation** : choisissez les dates, un véhicule, un client.

## Prochaines étapes

Phase 3 : états des lieux, dommages, maintenance, rapports, rôles et permissions, API.
