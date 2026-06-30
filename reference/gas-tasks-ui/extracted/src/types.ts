export type OrgId = 'ngo' | 'hotel' | 'agency' | 'restaurant';

export interface Organization {
  id: OrgId;
  name: string;
  tagline: string;
  industry: string;
  location: string;
  avatar: string; // Tailwind bg-gradient or single letter
}

export interface KpiItem {
  id: string;
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  color: 'indigo' | 'amber' | 'emerald' | 'slate';
  description: string;
}

export interface ActivityItem {
  id: string;
  user: string;
  avatar: string;
  action: string;
  target: string;
  timestamp: string;
  location?: string;
}

export interface PendingAction {
  id: string;
  title: string;
  requester: string;
  date: string;
  type: string;
  details: string;
}

export type MemoryType = 'decision' | 'commitment' | 'pattern';

export interface MemoryItem {
  id: string;
  type: MemoryType;
  title: string;
  description: string;
  date: string;
  strength: number; // 1 to 5 dots
  category: string;
  tags: string[];
}

export type DocType = 'document' | 'rapport' | 'reunion' | 'audio';

export interface DocItem {
  id: string;
  title: string;
  type: DocType;
  date: string;
  summary: string;
  size: string;
  gpsLocation?: string;
  author: string;
}

export interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  confidence?: 'Haute' | 'Moyenne' | 'Faible';
  sources?: string[];
}
