export type LegalSection = { title: string; paragraphs: string[] };

export type LegalPage = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

/** Replace with official values when TeamBrain SARL is registered. */
export const LEGAL_COMPANY = {
  name: "TeamBrain SARL",
  city: "Dakar",
  country: "Sénégal",
  ninea: "[YOUR_NINEA]",
  rccm: "[YOUR_RCCM]",
  email: "contact@teambrain.app",
  privacyEmail: "privacy@teambrain.app",
  phone: "+221 XX XXX XX XX",
} as const;

export const LEGAL_FOOTER_LINE = `© ${new Date().getFullYear()} ${LEGAL_COMPANY.name}. NINEA : ${LEGAL_COMPANY.ninea}. RCCM : ${LEGAL_COMPANY.rccm}`;

export const LEGAL_PAGES: Record<string, LegalPage> = {
  cgu: {
    title: "Conditions générales d'utilisation",
    updated: "22 juin 2026",
    sections: [
      {
        title: "1. Objet et définition du Service",
        paragraphs: [
          `Les présentes Conditions générales d'utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de la plateforme TeamBrain (ci-après « le Service »), éditée par ${LEGAL_COMPANY.name}, société de droit sénégalais dont le siège est à ${LEGAL_COMPANY.city}, ${LEGAL_COMPANY.country}.`,
          "TeamBrain est une solution SaaS (logiciel en tant que service) destinée aux organisations pour centraliser la mémoire collective, la coordination d'équipe, les rapports terrain et l'assistance intelligente.",
          "En créant un compte ou en utilisant le Service, vous acceptez sans réserve les présentes CGU ainsi que la Politique de confidentialité.",
        ],
      },
      {
        title: "2. Compte et responsabilités",
        paragraphs: [
          "L'inscription est réservée aux personnes majeures agissant pour le compte d'une organisation. L'administrateur de l'organisation est responsable de la gestion des accès, des rôles, des invitations et de la conformité des utilisateurs aux présentes CGU.",
          "Vous vous engagez à fournir des informations exactes et à maintenir la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte est réputée effectuée par vous ou votre organisation.",
        ],
      },
      {
        title: "3. Conditions d'utilisation",
        paragraphs: [
          "Le Service comprend notamment : gestion de projets et tâches, documents et rapports terrain, mémoire organisationnelle, messagerie interne, assistant IA (suggestions soumises à approbation humaine), et intégrations optionnelles (WhatsApp, calendrier, etc.).",
          "Le Service est fourni en l'état, avec un objectif de disponibilité raisonnable. Des maintenances programmées ou d'urgence peuvent entraîner des interruptions temporaires, notifiées lorsque cela est possible.",
        ],
      },
      {
        title: "4. Activités interdites",
        paragraphs: [
          "Il est interdit d'utiliser le Service à des fins illicites, de porter atteinte aux droits de tiers, de tenter d'accéder sans autorisation aux systèmes ou données d'autres organisations, de surcharger intentionnellement l'infrastructure, ou de diffuser des contenus contraires à la législation sénégalaise.",
          "L'assistant IA produit des suggestions soumises à validation humaine ; l'organisation reste seule responsable des décisions prises sur la base de ces suggestions.",
        ],
      },
      {
        title: "5. Essai gratuit, abonnement et paiement",
        paragraphs: [
          "Une période d'essai gratuit de trente (30) jours peut être offerte sans carte bancaire. À l'issue de l'essai, l'accès en écriture peut être limité jusqu'au paiement d'un abonnement via PayDunya (Orange Money, Wave, carte, etc.).",
          "Les tarifs sont indiqués en francs CFA (FCFA) sur la page Tarifs. Les factures sont émises au nom de l'organisation cliente.",
        ],
      },
      {
        title: "6. Conservation et propriété des données",
        paragraphs: [
          "Votre organisation conserve la propriété de l'ensemble des contenus qu'elle dépose sur le Service. TeamBrain dispose d'une licence limitée, non exclusive et révocable pour héberger, traiter et afficher ces contenus uniquement afin de fournir le Service.",
          "Les données de compte sont conservées pendant la durée de la relation contractuelle, puis archivées selon les obligations légales. Les contenus organisationnels sont conservés tant que l'abonnement est actif, sauf demande de suppression conforme à la Politique de confidentialité.",
        ],
      },
      {
        title: "7. Résiliation",
        paragraphs: [
          `Vous pouvez résilier votre abonnement à tout moment depuis les paramètres ou par demande écrite à ${LEGAL_COMPANY.email}. TeamBrain peut suspendre ou résilier un compte en cas de violation des CGU, après notification lorsque cela est possible.`,
          "En cas de résiliation, vous pouvez demander l'export de vos données dans un délai de trente (30) jours.",
        ],
      },
      {
        title: "8. Limitation de responsabilité",
        paragraphs: [
          "Dans les limites autorisées par le droit sénégalais, la responsabilité de TeamBrain est limitée au montant des sommes versées par l'organisation au cours des douze (12) mois précédant le fait générateur.",
          "TeamBrain ne saurait être tenu responsable des dommages indirects, pertes de profits ou pertes de données résultant d'un cas de force majeure ou d'une mauvaise utilisation du Service.",
        ],
      },
      {
        title: "9. Droit applicable et litiges",
        paragraphs: [
          "Les présentes CGU sont régies par le droit de la République du Sénégal. En cas de litige, les parties s'efforceront de trouver une solution amiable. À défaut, les tribunaux compétents de Dakar seront seuls compétents.",
        ],
      },
      {
        title: "10. Contact",
        paragraphs: [
          `Pour toute question : ${LEGAL_COMPANY.email}`,
          LEGAL_FOOTER_LINE,
        ],
      },
    ],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    updated: "22 juin 2026",
    sections: [
      {
        title: "1. Responsable du traitement",
        paragraphs: [
          `${LEGAL_COMPANY.name}, ${LEGAL_COMPANY.city}, ${LEGAL_COMPANY.country}, est responsable du traitement des données personnelles collectées via le Service.`,
          `Contact délégué à la protection des données : ${LEGAL_COMPANY.privacyEmail}`,
        ],
      },
      {
        title: "2. Données collectées et finalités",
        paragraphs: [
          "Nous collectons : identité et coordonnées (nom, e-mail, rôle), données d'organisation (nom, secteur, taille d'équipe), contenus métier déposés par les utilisateurs, journaux techniques (adresse IP tronquée, horodatage, type d'appareil), et métadonnées d'utilisation.",
          "Les numéros de téléphone sont stockés sous forme d'empreinte cryptographique (hachage SHA-256) et ne sont jamais journalisés en clair.",
          "Les données sont traitées pour fournir et sécuriser le Service, gérer les comptes et abonnements, améliorer l'assistance IA dans le cadre de la mémoire organisationnelle, et respecter nos obligations légales.",
        ],
      },
      {
        title: "3. Conformité RGPD et réglementation sénégalaise",
        paragraphs: [
          "TeamBrain applique les principes du Règlement général sur la protection des données (RGPD) pour les utilisateurs concernés, ainsi que la loi n° 2008-12 relative à la protection des données à caractère personnel au Sénégal (CDP).",
          "Dans le cadre de la lutte contre le blanchiment de capitaux et le financement du terrorisme (LBC/FT), nous pouvons être amenés à conserver certaines informations de facturation et d'identification conformément aux obligations AML en vigueur au Sénégal et dans l'UEMOA.",
        ],
      },
      {
        title: "4. Sécurité, chiffrement et isolation (RLS)",
        paragraphs: [
          "Nous mettons en œuvre le chiffrement en transit (TLS), l'isolation des données par organisation via Row Level Security (RLS) sur PostgreSQL, l'authentification JWT sécurisée, et des contrôles d'accès par rôle (admin, membre, agent terrain).",
          "Seuls les utilisateurs autorisés de votre organisation et le personnel technique TeamBrain (accès restreint et journalisé) peuvent accéder aux données, dans la stricte limite nécessaire au support et à la maintenance.",
          "Aucune donnée organisationnelle n'est vendue à des tiers.",
        ],
      },
      {
        title: "5. Durée de conservation",
        paragraphs: [
          "Les données de compte sont conservées pendant la durée de la relation contractuelle puis archivées selon les obligations légales. Les contenus organisationnels sont conservés tant que l'organisation maintient son abonnement, sauf demande de suppression.",
          "Les journaux techniques sont conservés au maximum douze (12) mois.",
        ],
      },
      {
        title: "6. Vos droits",
        paragraphs: [
          "Conformément à la loi sénégalaise et aux recommandations de la Commission de Protection des Données Personnelles (CDP), vous disposez des droits d'accès, de rectification, d'opposition, de limitation, de suppression et d'export de vos données personnelles.",
          `Pour exercer vos droits : ${LEGAL_COMPANY.privacyEmail}. Vous pouvez également introduire une réclamation auprès de la CDP du Sénégal.`,
        ],
      },
      {
        title: "7. Cookies",
        paragraphs: [
          "Le Service utilise des cookies strictement nécessaires à l'authentification et au fonctionnement de la session. Aucun cookie publicitaire tiers n'est déposé sans consentement.",
        ],
      },
      {
        title: "8. Contact",
        paragraphs: [
          `Questions confidentialité : ${LEGAL_COMPANY.privacyEmail}`,
          LEGAL_FOOTER_LINE,
        ],
      },
    ],
  },
  "mentions-legales": {
    title: "Mentions légales",
    updated: "22 juin 2026",
    sections: [
      {
        title: "Éditeur",
        paragraphs: [
          `${LEGAL_COMPANY.name}`,
          `Siège social : ${LEGAL_COMPANY.city}, ${LEGAL_COMPANY.country}`,
          `NINEA : ${LEGAL_COMPANY.ninea}`,
          `RCCM : ${LEGAL_COMPANY.rccm}`,
          `E-mail : ${LEGAL_COMPANY.email}`,
          `Téléphone : ${LEGAL_COMPANY.phone}`,
        ],
      },
      {
        title: "Directeur de la publication",
        paragraphs: ["À compléter lors de l'immatriculation commerciale définitive."],
      },
      {
        title: "Hébergement et infrastructure",
        paragraphs: [
          "Frontend : Vercel (déploiement de l'application web Next.js)",
          "Backend API : Railway (hébergement FastAPI)",
          "Base de données : Supabase (PostgreSQL managé avec RLS)",
          "Stockage fichiers : S3-compatible (selon configuration organisation)",
        ],
      },
      {
        title: "Stack technique",
        paragraphs: [
          "Application web : Next.js 14, TypeScript, Tailwind CSS, PWA",
          "API : FastAPI, SQLAlchemy 2.0, Alembic",
          "Base de données : PostgreSQL avec pgvector et Row Level Security (RLS)",
          "Paiements : PayDunya (intégration en cours)",
        ],
      },
      {
        title: "Propriété intellectuelle",
        paragraphs: [
          "L'ensemble des éléments du site et de l'application TeamBrain (textes, graphismes, logiciels, marques) est protégé par le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite.",
        ],
      },
      {
        title: "Limitation de responsabilité",
        paragraphs: [
          "TeamBrain s'efforce d'assurer l'exactitude des informations publiées. Toutefois, TeamBrain ne pourra être tenu responsable des omissions ou inexactitudes.",
        ],
      },
      {
        title: "Droit applicable",
        paragraphs: [
          "Les présentes mentions légales sont régies par le droit sénégalais. Tribunal compétent : Dakar, Sénégal.",
          LEGAL_FOOTER_LINE,
        ],
      },
    ],
  },
};

export const LEGAL_INDEX = [
  { slug: "cgu", title: "Conditions générales d'utilisation", desc: "CGU du Service TeamBrain" },
  { slug: "confidentialite", title: "Politique de confidentialité", desc: "Données personnelles, RGPD et CDP Sénégal" },
  { slug: "mentions-legales", title: "Mentions légales", desc: "Éditeur, hébergement et stack technique" },
] as const;
