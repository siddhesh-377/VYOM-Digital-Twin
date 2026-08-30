/**
 * Session Audio Preference Manager for VYOM Cinematics
 */
const STORAGE_KEY = 'vyom_cinematic_audio_enabled';

export function getAudioPreference(): boolean {
  try {
    const val = sessionStorage.getItem(STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export function setAudioPreference(enabled: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage restrictions
  }
}
