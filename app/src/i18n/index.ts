// The page's texts in the interface language (strings.ts). Components use useStrings(), so
// they follow a language change at once; code outside React reads strings().
import { usePreferencesStore } from '@/stores/preferencesStore';
import { STRINGS, type Strings } from './strings';

export type { Strings };

export function strings(): Strings {
  return STRINGS[usePreferencesStore.getState().language];
}

export function useStrings(): Strings {
  return STRINGS[usePreferencesStore(s => s.language)];
}
