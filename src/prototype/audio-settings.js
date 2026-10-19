export const AUDIO_STORAGE_KEY = 'magnet-sort.audio.v1';
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({ musicEnabled: true, sfxEnabled: true, musicVolume: .35, sfxVolume: .70 });

export function normalizeAudioSettings(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_AUDIO_SETTINGS).map(([key, fallback]) => [key,
    typeof fallback === 'boolean'
      ? typeof input[key] === 'boolean' ? input[key] : fallback
      : typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0 && input[key] <= 1 ? input[key] : fallback]));
}

export function createAudioSettings(getStorage = () => globalThis.localStorage) {
  let value;
  try { value = normalizeAudioSettings(JSON.parse(getStorage()?.getItem(AUDIO_STORAGE_KEY) ?? 'null')); }
  catch { value = { ...DEFAULT_AUDIO_SETTINGS }; }
  return {
    get: () => ({ ...value }),
    update(patch) {
      value = normalizeAudioSettings({ ...value, ...patch });
      try { getStorage()?.setItem(AUDIO_STORAGE_KEY, JSON.stringify(value)); } catch { /* In-memory preferences remain usable. */ }
      return { ...value };
    },
  };
}
