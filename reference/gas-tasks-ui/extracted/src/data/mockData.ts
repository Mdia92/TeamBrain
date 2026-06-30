import { Organization, KpiItem, ActivityItem, PendingAction, MemoryItem, DocItem, OrgId } from '../types';

export const ORGANIZATIONS: Organization[] = [
  {
    id: 'ngo',
    name: 'Vision Sahel',
    tagline: 'ONG de développement rural',
    industry: 'Humanitaire & Sante',
    location: 'Bamako, Mali',
    avatar: 'bg-gradient-to-br from-emerald-500 to-teal-700'
  },
  {
    id: 'hotel',
    name: 'Hôtel Azalaï',
    tagline: 'Hôtellerie & Événements',
    industry: 'Tourisme & Service',
    location: 'Cotonou, Bénin',
    avatar: 'bg-gradient-to-br from-indigo-500 to-purple-700'
  },
  {
    id: 'agency',
    name: 'Agence Delta',
    tagline: 'Agence créative de communication',
    industry: 'Marketing & Digital',
    location: 'Abidjan, Côte d\'Ivoire',
    avatar: 'bg-gradient-to-br from-amber-500 to-orange-700'
  },
  {
    id: 'restaurant',
    name: 'Le Bistro Dakar',
    tagline: 'Restauration & Approvisionnement',
    industry: 'Gastronomie',
    location: 'Dakar, Sénégal',
    avatar: 'bg-gradient-to-br from-rose-500 to-red-700'
  }
];

export const SUGGESTIONS: Record<OrgId, string[]> = {
  ngo: [
    "Résumé de la campagne de vaccination à Mopti",
    "Quelles décisions ont été prises pour le forage à Kayes ?",
    "Où en est le rapport logistique d'Ousmane ?",
    "Extraire les points clés du mémo d'impact nutritionnel"
  ],
  hotel: [
    "Quels sont les retours sur le séminaire de l'UEMOA ?",
    "Rapport d'inventaire de la cuisine pour ce matin",
    "Quelles décisions d'achat ont été validées ?",
    "Plan de maintenance de la suite présidentielle"
  ],
  agency: [
    "Compte-rendu du pitch client pour Orange Côte d'Ivoire",
    "Quelles sont les priorités de la campagne d'été ?",
    "Retrouver le brief créatif de la marque Djigui",
    "Quelles alertes de retard de livrables ont été détectées ?"
  ],
  restaurant: [
    "Où en est l'approvisionnement en mérou pour ce week-end ?",
    "Résumé de la réunion d'équipe sur le menu de la Tabaski",
    "Quels sont les retours sur la livraison de la poissonnerie ?",
    "Décisions concernant l'ajustement des prix des menus"
  ]
};

export const MOCK_DATA: Record<OrgId, {
  kpis: KpiItem[];
  activities: ActivityItem[];
  pendingActions: PendingAction[];
  memories: MemoryItem[];
  documents: DocItem[];
}> = {
  ngo: {
    kpis: [
      { id: 'ngo-1', title: 'Tâches de Campagne', value: '84%', trend: '+5.2%', isPositive: true, color: 'indigo', description: 'Activités terrain réalisées' },
      { id: 'ngo-2', title: 'Décisions Actées', value: '18', trend: 'Ce mois', isPositive: true, color: 'amber', description: 'Consensus communautaires' },
      { id: 'ngo-3', title: 'Rapports Terrain', value: '34', trend: '+12%', isPositive: true, color: 'emerald', description: 'Enregistrés avec coordonnées GPS' },
      { id: 'ngo-4', title: 'Temps d\'Approbation', value: '1.4h', trend: '-22%', isPositive: true, color: 'slate', description: 'Délai moyen de signature' }
    ],
    activities: [
      { id: 'ngo-act-1', user: 'Fatoumata Traoré', avatar: 'FT', action: 'a soumis un rapport GPS depuis', target: 'Forage Kayes (Mali)', timestamp: 'Il y a 12 min', location: 'Kayes, ML' },
      { id: 'ngo-act-2', user: 'Ousmane Diallo', avatar: 'OD', action: 'a archivé une note vocale sur', target: 'Distribution nutritionnelle', timestamp: 'Il y a 45 min', location: 'Mopti, ML' },
      { id: 'ngo-act-3', user: 'Amadou Sidibé', avatar: 'AS', action: 'a marqué comme décidée', target: 'Ajustement du budget d\'urgence', timestamp: 'Il y a 2 heures' },
      { id: 'ngo-act-4', user: 'Kadidia Dembélé', avatar: 'KD', action: 'a importé le procès-verbal', target: 'Réunion du comité sanitaire', timestamp: 'Il y a 4 heures' }
    ],
    pendingActions: [
      { id: 'ngo-p-1', title: 'Valider frais logistiques Mopti', requester: 'Ousmane Diallo', date: 'Aujourd\'hui', type: 'Finances', details: 'Frais d\'essence pour le camion de ravitaillement médical (180 000 FCFA).' },
      { id: 'ngo-p-2', title: 'Signer compte-rendu de concertation', requester: 'Chef de village de San', date: 'Hier', type: 'Gouvernance', details: 'Accord verbal pour l\'attribution du terrain d\'extension du dispensaire.' },
      { id: 'ngo-p-3', title: 'Approuver plan d\'achat de kits d\'hygiène', requester: 'Mariam Koné', date: 'Il y a 2 jours', type: 'Logistique', details: 'Achat urgent de 500 kits pour les familles déplacées (2 500 000 FCFA).' }
    ],
    memories: [
      {
        id: 'ngo-m-1',
        type: 'decision',
        title: 'Forage prioritaire à Kayes Nord',
        description: 'Suite aux relevés hydrogéologiques et à la baisse des nappes phréatiques, l\'équipe a décidé d\'allouer 60% du budget d\'infrastructure sur le forage profond de Kayes Nord plutôt que de disperser les fonds sur trois puits de surface.',
        date: '18 Juin 2026',
        strength: 5,
        category: 'Infrastructure',
        tags: ['Forage', 'Eau', 'Kayes']
      },
      {
        id: 'ngo-m-2',
        type: 'commitment',
        title: 'Engagement de sensibilisation communautaire',
        description: 'Les relais communautaires de Mopti se sont engagés à assurer au moins deux séances hebdomadaires de sensibilisation au lavage des mains et au traitement de l\'eau dans chaque marché hebdomadaire.',
        date: '10 Juin 2026',
        strength: 4,
        category: 'Sensibilisation',
        tags: ['Santé', 'Communauté', 'Mopti']
      },
      {
        id: 'ngo-m-3',
        type: 'pattern',
        title: 'Alerte : Ralentissement logistique récurrent pendant l\'hivernage',
        description: 'Analyse IA : Les temps de transit pour l\'acheminement du matériel médical vers Tombouctou augmentent en moyenne de 140% entre juillet et septembre en raison des inondations de pistes. Recommandation : prépositionner les stocks dès juin.',
        date: '05 Juin 2026',
        strength: 5,
        category: 'Logistique',
        tags: ['Hivernage', 'Climat', 'Alerte']
      },
      {
        id: 'ngo-m-4',
        type: 'decision',
        title: 'Partenariat avec la clinique mobile de Ségou',
        description: 'Signature de la convention de partenariat technique avec l\'association Santé-Mali pour la mise à disposition d\'une sage-femme deux jours par semaine.',
        date: '28 Mai 2026',
        strength: 3,
        category: 'Partenariats',
        tags: ['Santé', 'Partenariat', 'Ségou']
      }
    ],
    documents: [
      {
        id: 'ngo-doc-1',
        title: 'Rapport technique Forage Kayes Nord',
        type: 'rapport',
        date: '22 Juin 2026',
        summary: 'Rapport hydrogéologique validant la viabilité de la nappe à 85m. Plan de travaux et devis final inclus.',
        size: '4.2 MB',
        gpsLocation: '14.4414° N, 11.4394° W',
        author: 'Fatoumata Traoré'
      },
      {
        id: 'ngo-doc-2',
        title: 'Note Vocale : Réunion de crise nutritionnelle Mopti',
        type: 'audio',
        date: '18 Juin 2026',
        summary: 'Enregistrement de l\'accord verbal avec le comité local concernant les priorités de rationnement alimentaire pour le trimestre.',
        size: '12.4 MB',
        author: 'Ousmane Diallo'
      },
      {
        id: 'ngo-doc-3',
        title: 'Plan d\'action Hivernage et Prépositionnement',
        type: 'document',
        date: '12 Juin 2026',
        summary: 'Document stratégique détaillant les volumes de médicaments à stocker dans les hubs régionaux de Gao et Mopti avant les pluies.',
        size: '1.8 MB',
        author: 'Mariam Koné'
      },
      {
        id: 'ngo-doc-4',
        title: 'Procès-Verbal Assemblée Générale Communautaire San',
        type: 'reunion',
        date: '02 Juin 2026',
        summary: 'Validation par les notables du village de la charte de gestion partagée de la pompe à motricité solaire.',
        size: '850 KB',
        author: 'Amadou Sidibé'
      }
    ]
  },
  hotel: {
    kpis: [
      { id: 'hotel-1', title: 'Taux d\'Occupation', value: '78%', trend: '+8.4%', isPositive: true, color: 'indigo', description: 'Chambres réservées ce mois' },
      { id: 'hotel-2', title: 'Décisions de Service', value: '12', trend: 'Cette semaine', isPositive: true, color: 'amber', description: 'Ajustements de standing' },
      { id: 'hotel-3', title: 'Incidents Résolus', value: '98.2%', trend: '+1.5%', isPositive: true, color: 'emerald', description: 'Dans la charte de qualité <2h' },
      { id: 'hotel-4', title: 'Coût Approvisionnement', value: '-6.4%', trend: 'Optimisé', isPositive: true, color: 'slate', description: 'Négociation maraîchère locale' }
    ],
    activities: [
      { id: 'hotel-act-1', user: 'Ablaye Sène', avatar: 'AS', action: 'a validé l\'inventaire de la cave et', target: 'Commande de vins d\'Afrique du Sud', timestamp: 'Il y a 5 min' },
      { id: 'hotel-act-2', user: 'Chantal Agon', avatar: 'CA', action: 'a signalé un rapport d\'inspection à la', target: 'Chambre Executive 204', timestamp: 'Il y a 18 min', location: 'Cotonou, BJ' },
      { id: 'hotel-act-3', user: 'Ephrem Codjia', avatar: 'EC', action: 'a ajouté une note de réunion sur le', target: 'Dîner de Gala de la CEDEAO', timestamp: 'Il y a 1 heure' },
      { id: 'hotel-act-4', user: 'Awa Diop', avatar: 'AD', action: 'a mis à jour le planning', target: 'Équipe de nuit (Gouvernantes)', timestamp: 'Il y a 3 heures' }
    ],
    pendingActions: [
      { id: 'hotel-p-1', title: 'Approuver devis sonorisation Gala', requester: 'Ephrem Codjia', date: 'Aujourd\'hui', type: 'Événements', details: 'Prestation pour la soirée de clôture ministérielle. Devis de 750 000 FCFA avec prestataire agréé.' },
      { id: 'hotel-p-2', title: 'Valider remplacement climatisation suite 105', requester: 'Chantal Agon', date: 'Hier', type: 'Maintenance', details: 'Achat d\'un compresseur de remplacement suite à une surtension sur le réseau urbain.' },
      { id: 'hotel-p-3', title: 'Ajustement menu buffet petits-déjeuners', requester: 'Chef Koffi', date: 'Il y a 2 jours', type: 'Cuisine', details: 'Intégration de jus locaux (Bissap, Pain de singe) et réduction des viennoiseries importées.' }
    ],
    memories: [
      {
        id: 'hotel-m-1',
        type: 'decision',
        title: 'Sourcing 100% local pour les fruits et légumes',
        description: 'Pour pallier les irrégularités de livraison douanière et soutenir l\'économie locale, la direction des achats a entériné la décision de s\'approvisionner exclusivement auprès de la coopérative maraîchère du Plateau d\'Allada.',
        date: '20 Juin 2026',
        strength: 5,
        category: 'Achats',
        tags: ['Cuisine', 'Local', 'Allada']
      },
      {
        id: 'hotel-m-2',
        type: 'commitment',
        title: 'Protocole d\'accueil VIP personnalisé',
        description: 'L\'équipe de la réception s\'engage formellement à appliquer la règle de l\'accueil personnalisé en langue locale béninoise (Fon/Nago) en plus du français pour toutes les délégations régionales ouest-africaines.',
        date: '14 Juin 2026',
        strength: 4,
        category: 'Service Client',
        tags: ['Réception', 'VIP', 'Afrique']
      },
      {
        id: 'hotel-m-3',
        type: 'pattern',
        title: 'Alerte : Surcharges électriques récurrentes en après-midi',
        description: 'Analyse IA : Entre 14h et 16h, l\'utilisation intensive de la climatisation dans la salle de conférence combinée aux compresseurs de cuisine génère des micro-coupures. Recommandation : délester l\'alimentation des chauffe-eau de piscine à ces heures.',
        date: '08 Juin 2026',
        strength: 4,
        category: 'Maintenance',
        tags: ['Énergie', 'Alerte', 'Sécurité']
      },
      {
        id: 'hotel-m-4',
        type: 'decision',
        title: 'Rénovation de la terrasse panoramique',
        description: 'Validation de l\'architecte d\'intérieur pour le réaménagement avec mobilier en teck de Ouidah et éclairage LED basse consommation.',
        date: '01 Juin 2026',
        strength: 4,
        category: 'Infrastructures',
        tags: ['Travaux', 'Terrasse']
      }
    ],
    documents: [
      {
        id: 'hotel-doc-1',
        title: 'Fiche d\'inspection Maintenance Chambres',
        type: 'rapport',
        date: '23 Juin 2026',
        summary: 'Rapport complet d\'état technique des chambres de l\'aile Est. Recommandation d\'entretien de l\'étanchéité avant la saison des pluies.',
        size: '1.2 MB',
        gpsLocation: '6.3532° N, 2.4411° E',
        author: 'Chantal Agon'
      },
      {
        id: 'hotel-doc-2',
        title: 'Audio : Briefing d\'accueil Délégation CEDEAO',
        type: 'audio',
        date: '21 Juin 2026',
        summary: 'Instructions vocales de la directrice générale détaillant les exigences protocolaires, d\'accréditation, de sécurité et d\'attribution des suites.',
        size: '8.4 MB',
        author: 'Ephrem Codjia'
      },
      {
        id: 'hotel-doc-3',
        title: 'Convention de partenariat coopérative maraîchère Allada',
        type: 'document',
        date: '19 Juin 2026',
        summary: 'Accord-cadre fixant les prix, les volumes et la fréquence de livraison directe des légumes biologiques pour la restauration de l\'hôtel.',
        size: '2.4 MB',
        author: 'Chef Koffi'
      },
      {
        id: 'hotel-doc-4',
        title: 'Compte-rendu Comité de Direction Qualité Q2',
        type: 'reunion',
        date: '10 Juin 2026',
        summary: 'Analyse des avis clients en ligne, point sur les formations du personnel et redéfinition des KPI d\'accueil.',
        size: '1.1 MB',
        author: 'Awa Diop'
      }
    ]
  },
  agency: {
    kpis: [
      { id: 'agency-1', title: 'Livrables à Temps', value: '92%', trend: '+4.1%', isPositive: true, color: 'indigo', description: 'Campagnes livrées dans les délais' },
      { id: 'agency-2', title: 'Retours Créatifs', value: '3.1', trend: '-15%', isPositive: true, color: 'amber', description: 'Nombre moyen d\'itérations client' },
      { id: 'agency-3', title: 'Brainstorms Indexés', value: '14', trend: 'Ce mois', isPositive: true, color: 'emerald', description: 'Notes d\'idées structurées par l\'IA' },
      { id: 'agency-4', title: 'Projets Actifs', value: '8', trend: 'En cours', isPositive: true, color: 'slate', description: 'Comptes clients grand public' }
    ],
    activities: [
      { id: 'agency-act-1', user: 'Yasmine Sylla', avatar: 'YS', action: 'a partagé le brief graphique pour la', target: 'Nouvelle identité de Djigui Boissons', timestamp: 'Il y a 10 min' },
      { id: 'agency-act-2', user: 'Marc Kouadio', avatar: 'MK', action: 'a ajouté une note de réunion avec l\'équipe', target: 'Orange Money Côte d\'Ivoire', timestamp: 'Il y a 30 min', location: 'Abidjan, CI' },
      { id: 'agency-act-3', user: 'Aminata Bamba', avatar: 'AB', action: 'a validé la décision stratégique', target: 'Axe de campagne Afro-optimiste', timestamp: 'Il y a 2 heures' },
      { id: 'agency-act-4', user: 'Koffi Mensah', avatar: 'KM', action: 'a téléversé l\'audio de la voix off pour', target: 'Spot Radio Djigui (60s)', timestamp: 'Il y a 5 heures' }
    ],
    pendingActions: [
      { id: 'agency-p-1', title: 'Approuver storyboard spot TV Djigui', requester: 'Yasmine Sylla', date: 'Aujourd\'hui', type: 'Création', details: 'Validation du scénario visuel dessiné avant envoi au client pour validation finale.' },
      { id: 'agency-p-2', title: 'Valider budget prestataires vidéo', requester: 'Marc Kouadio', date: 'Hier', type: 'Production', details: 'Frais de tournage pour l\'agence de production vidéo à Cocody (3 200 000 FCFA).' },
      { id: 'agency-p-3', title: 'Ajuster planning lancement d\'été', requester: 'Aminata Bamba', date: 'Il y a 2 jours', type: 'Gestion de projet', details: 'Décalage de 4 jours de la date de mise en ligne suite à un retard de livraison de l\'application cliente.' }
    ],
    memories: [
      {
        id: 'agency-m-1',
        type: 'decision',
        title: 'Axe publicitaire "Djigui" axé sur l\'entrepreneuriat jeune',
        description: 'Suite aux retours des focus groupes d\'Abidjan et Bouaké, l\'agence a choisi de délaisser le message familial traditionnel pour cibler l\'énergie de l\'entrepreneuriat informel des jeunes d\'Afrique de l\'Ouest, un axe beaucoup plus engageant.',
        date: '21 Juin 2026',
        strength: 5,
        category: 'Stratégie',
        tags: ['Campagne', 'Djigui', 'Jeunesse']
      },
      {
        id: 'agency-m-2',
        type: 'commitment',
        title: 'Validation de charte de propriété intellectuelle interne',
        description: 'Tous les créatifs se sont engagés à indexer et tagguer systématiquement leurs concepts originaux non retenus par les clients dans la base TeamBrain afin de créer un "cimetière d\'idées" réutilisable pour de futurs appels d\'offres.',
        date: '15 Juin 2026',
        strength: 4,
        category: 'Processus',
        tags: ['Créativité', 'Légal', 'Intellect']
      },
      {
        id: 'agency-m-3',
        type: 'pattern',
        title: 'Alerte : Goulot d\'étranglement sur la validation créative',
        description: 'Analyse IA : Les retours clients pour les projets d\'Orange Côte d\'Ivoire subissent une attente moyenne de 6 jours au niveau du directeur de création. Recommandation : déléguer la validation intermédiaire au lead designer.',
        date: '11 Juin 2026',
        strength: 5,
        category: 'Alerte Opérationnelle',
        tags: ['Goulot', 'Alerte', 'Management']
      },
      {
        id: 'agency-m-4',
        type: 'decision',
        title: 'Transition vers Figma Enterprise',
        description: 'Décision d\'unifier tous les outils collaboratifs d\'interface utilisateur et d\'identité de marque sous un unique compte d\'équipe Figma pour fluidifier les validations distantes avec la succursale de Lomé.',
        date: '02 Juin 2026',
        strength: 4,
        category: 'Outils',
        tags: ['Design', 'Figma', 'Logiciel']
      }
    ],
    documents: [
      {
        id: 'agency-doc-1',
        title: 'Brief Stratégique Lancement Orange Money',
        type: 'document',
        date: '24 Juin 2026',
        summary: 'Objectifs de positionnement de la nouvelle offre de micro-crédit. Analyse concurrentielle et personae détaillés.',
        size: '3.1 MB',
        author: 'Marc Kouadio'
      },
      {
        id: 'agency-doc-2',
        title: 'Audio : Voix Off Spot Radio Djigui (Mossi & Bambara)',
        type: 'audio',
        date: '22 Juin 2026',
        summary: 'Maquette vocale pour le spot de sensibilisation à l\'entrepreneuriat de rue. Validé par le directeur artistique.',
        size: '15.6 MB',
        author: 'Koffi Mensah'
      },
      {
        id: 'agency-doc-3',
        title: 'Rapport d\'impact de Focus Group Abidjan',
        type: 'rapport',
        date: '18 Juin 2026',
        summary: 'Étude comportementale menée auprès de 50 jeunes de 18-30 ans concernant la perception de l\'identité visuelle de la marque Djigui.',
        size: '4.8 MB',
        gpsLocation: '5.3241° N, 3.9822° W',
        author: 'Yasmine Sylla'
      },
      {
        id: 'agency-doc-4',
        title: 'Compte-rendu du brainstorming d\'équipe Logo Djigui',
        type: 'reunion',
        date: '12 Juin 2026',
        summary: 'Sélection de trois concepts de logos symbolisant la résilience, la force et le dynamisme de la jeunesse active.',
        size: '1.4 MB',
        author: 'Aminata Bamba'
      }
    ]
  },
  restaurant: {
    kpis: [
      { id: 'rest-1', title: 'Plats Servis / Jour', value: '245', trend: '+14%', isPositive: true, color: 'indigo', description: 'Moyenne de couverts servis' },
      { id: 'rest-2', title: 'Commandes Validées', value: '38', trend: 'Ce jour', isPositive: true, color: 'amber', description: 'Livraisons d\'ingrédients' },
      { id: 'rest-3', title: 'Pertes Cuisine', value: '2.8%', trend: '-1.5%', isPositive: true, color: 'emerald', description: 'Déchets organiques minimisés' },
      { id: 'rest-4', title: 'Marge Brute moyenne', value: '68%', trend: 'Stable', isPositive: true, color: 'slate', description: 'Indice de rentabilité de la carte' }
    ],
    activities: [
      { id: 'rest-act-1', user: 'Chef Moussa', avatar: 'CM', action: 'a validé la recette finale du', target: 'Thiéboudienne Royal au mérou noir', timestamp: 'Il y a 15 min' },
      { id: 'rest-act-2', user: 'Ibrahima Ndiaye', avatar: 'IN', action: 'a téléversé une note de livraison de', target: 'Pêcheurs artisanaux Soumbédioune', timestamp: 'Il y a 40 min', location: 'Dakar, SN' },
      { id: 'rest-act-3', user: 'Khadija Sow', avatar: 'KS', action: 'a enregistré un engagement sur', target: 'Approvisionnement sans plastique', timestamp: 'Il y a 3 heures' },
      { id: 'rest-act-4', user: 'Babacar Fall', avatar: 'BF', action: 'a mis à jour la liste des', target: 'Fournisseurs de légumes bio de Sangalkam', timestamp: 'Il y a 6 heures' }
    ],
    pendingActions: [
      { id: 'rest-p-1', title: 'Approuver facture poissonnerie Soumbédioune', requester: 'Ibrahima Ndiaye', date: 'Aujourd\'hui', type: 'Approvisionnement', details: 'Livraison de 45kg de thiof (mérou blanc) frais pour les banquets de fin de semaine (380 000 FCFA).' },
      { id: 'rest-p-2', title: 'Valider ajustement prix menu déjeuner', requester: 'Chef Moussa', date: 'Hier', type: 'Gestion', details: 'Proposition d\'augmentation du menu midi de 6 500 FCFA à 7 000 FCFA pour amortir l\'inflation du prix de l\'huile.' },
      { id: 'rest-p-3', title: 'Autoriser achat congélateur coffre d\'urgence', requester: 'Babacar Fall', date: 'Il y a 2 jours', type: 'Matériel', details: 'Achat d\'un congélateur de 400 litres d\'occasion pour sécuriser le stockage des poissons en cas de coupure (450 000 FCFA).' }
    ],
    memories: [
      {
        id: 'rest-m-1',
        type: 'decision',
        title: 'Substitution du thiof importé par le mérou local ou la lotte',
        description: 'En réponse à la raréfaction et à l\'explosion du prix du Thiof (mérou blanc de haute mer), le Bistro Dakar décide officiellement de proposer la Lotte du Sénégal ou le Mérou Noir de Soumbédioune comme substituts de saison dans le Thiéboudienne de prestige.',
        date: '22 Juin 2026',
        strength: 5,
        category: 'Menu & Recettes',
        tags: ['Thiéboudienne', 'Poisson', 'Sourcing']
      },
      {
        id: 'rest-m-2',
        type: 'commitment',
        title: 'Zéro déchet plastique en cuisine',
        description: 'La brigade de cuisine et l\'équipe de salle s\'engagent à éliminer définitivement l\'usage de film étirable plastique non-biodégradable au profit de boîtes hermétiques réutilisables en inox et de cire d\'abeille locale.',
        date: '17 Juin 2026',
        strength: 4,
        category: 'Éco-responsabilité',
        tags: ['Plastique', 'Cuisine', 'Charte']
      },
      {
        id: 'rest-m-3',
        type: 'pattern',
        title: 'Alerte : Rupture récurrente d\'oignons en fin de mois',
        description: 'Analyse IA : En raison de retards d\'approvisionnement au marché d\'intérêt national de Diamniadio, les stocks d\'oignons locaux tombent sous le seuil critique tous les 28 du mois, perturbant la préparation du Yassa. Recommandation : passer les commandes le 22.',
        date: '12 Juin 2026',
        strength: 5,
        category: 'Approvisionnement',
        tags: ['Oignon', 'Alerte', 'Logistique']
      },
      {
        id: 'rest-m-4',
        type: 'decision',
        title: 'Partenariat direct avec les maraîchers de Sangalkam',
        description: 'Signature d\'un contrat de livraison hebdomadaire en circuit court de tomates, piments et gombos biologiques, garantissant un prix stable sur 6 mois.',
        date: '03 Juin 2026',
        strength: 4,
        category: 'Sourcing',
        tags: ['Légumes', 'Contrat', 'Direct']
      }
    ],
    documents: [
      {
        id: 'rest-doc-1',
        title: 'Recette officielle & Fiche technique Thiéboudienne de Prestige',
        type: 'document',
        date: '23 Juin 2026',
        summary: 'Grammages exacts, épices de Saint-Louis, temps de cuisson et dressage signature du Chef Moussa.',
        size: '1.4 MB',
        author: 'Chef Moussa'
      },
      {
        id: 'rest-doc-2',
        title: 'Audio : Enregistrement réclamation poissonnerie Soumbédioune',
        type: 'audio',
        date: '22 Juin 2026',
        summary: 'Rapport oral du contrôle qualité du poisson reçu mardi matin (température de la glace, calibrage défaillant de 3 poissons).',
        size: '6.2 MB',
        author: 'Ibrahima Ndiaye'
      },
      {
        id: 'rest-doc-3',
        title: 'Bon de livraison et Facture Maraîchers Sangalkam',
        type: 'rapport',
        date: '20 Juin 2026',
        summary: 'Livraison hebdomadaire de légumes de Sangalkam. Validation de l\'état de fraîcheur par le second de cuisine.',
        size: '940 KB',
        gpsLocation: '14.7711° N, 17.2289° W',
        author: 'Babacar Fall'
      },
      {
        id: 'rest-doc-4',
        title: 'Compte-rendu Réunion d\'équipe "Planification Tabaski"',
        type: 'reunion',
        date: '15 Juin 2026',
        summary: 'Organisation des congés, ajustement des horaires d\'ouverture et définition du menu spécial agneau grillé.',
        size: '1.1 MB',
        author: 'Khadija Sow'
      }
    ]
  }
};
