export interface ChessComPlayer {
  player_id: number;
  username: string;
  name?: string;
  avatar?: string;
  location?: string;
  country?: string;
}

export interface ChessComStats {
  chess_rapid?: {
    last: {
      rating: number;
      date: number;
    };
  };
  chess_blitz?: {
    last: {
      rating: number;
      date: number;
    };
  };
  chess_bullet?: {
    last: {
      rating: number;
      date: number;
    };
  };
}

export interface CountryInfo {
  "@id": string;
  name: string;
  code: string;
}

export interface UserProfile {
  username: string;
  name: string | null;
  avatar: string | null;
  country: {
    name: string | null;
    code: string | null;
  };
  ratings: {
    rapid: number | null;
    blitz: number | null;
    bullet: number | null;
  };
}

export interface RatingHistory {
  date: string;
  rating: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PlayerStats {
  totalGames: {
    rapid: number;
    blitz: number;
    bullet: number;
    total: number;
  };
  currentRatings: {
    rapid: number | null;
    blitz: number | null;
    bullet: number | null;
  };
  yearlyProgress: {
    rapid: number;
    blitz: number;
    bullet: number;
  };
}

export interface GameArchive {
  games: Array<{
    end_time: number;
    time_class: string;
    white: {
      username: string;
      rating: number;
    };
    black: {
      username: string;
      rating: number;
    };
  }>;
}
