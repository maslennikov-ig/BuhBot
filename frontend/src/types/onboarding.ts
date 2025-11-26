export interface OnboardingState {
  step: number;
  botToken: string;
  botUsername?: string;
  workingHours: WorkingHours;
  slaThreshold: number;
  isComplete: boolean;
}

export interface WorkingHours {
  days: number[]; // 1=Monday, 7=Sunday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone: string;
}

export interface BotValidationResult {
  isValid: boolean;
  username?: string;
  id?: number;
  error?: string;
}
