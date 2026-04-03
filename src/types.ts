export interface RadioStation {
  id: string;
  name: string;
  frequency?: string;
  streamUrl: string;
  logoUrl?: string;
  category: 'Manila' | 'Provincial' | 'News' | 'Religious' | 'Music';
  description?: string;
  location: string;
}

export interface PlayerState {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  favorites: string[];
  recentlyPlayed: string[];
}
