export type Zone = 'cool' | 'working' | 'hot' | 'redline';
export type Weight = 'light' | 'normal' | 'heavy';
export type Size = 'S' | 'M' | 'L';
export type Status = 'open' | 'heads_down' | 'running_hot' | 'away';
export type Visibility = 'hidden' | 'lead' | 'everyone';
export type Role = 'lead' | 'member';
export type Source = 'google' | 'manual' | 'team' | 'ics' | 'github';

export interface LoadItem {
  id: string;
  kind: 'event' | 'task';
  source: Source;
  title: string;
  start?: string; end?: string;   // ISO, events
  due?: string;                   // ISO, tasks
  doneAt?: string | null;
  size?: Size;
  weight?: Weight;                // resolved tag
  seriesKey?: string;
  attendees?: number;
  isOrganizer?: boolean;
  isRecurring?: boolean;
  release?: boolean;              // focus time, OOO
}

export interface Contribution { itemId: string; title: string; points: number; reason: string; }
export interface Counts { meetings: number; meetingHours: number; tasksDue: number; overdue: number; }
export interface ForecastDay { date: string; score: number; zone: Zone; }

export interface PressureResult {
  score: number; raw: number; zone: Zone;
  contributions: Contribution[]; counts: Counts; forecast: ForecastDay[];
}

export interface BoilerCard {          // what a team member sees
  userId: string; name: string; avatarUrl?: string;
  score: number; zone: Zone; status: Status; statusNote?: string;
  counts: Counts; updatedAt: string;
}

export interface EngineRoom {
  team: { id: string; name: string; type: 'class' | 'work' };
  myRole: Role;
  boilers: BoilerCard[];
  hiddenCount: number;
}

export interface AssignmentPreview {
  members: { userId: string; name: string; before: number; after: number; zoneBefore: Zone; zoneAfter: Zone }[];
  hidden: { count: number; intoRedline: number };
}
