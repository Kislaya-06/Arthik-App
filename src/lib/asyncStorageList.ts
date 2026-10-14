import AsyncStorage from '@react-native-async-storage/async-storage';

export const getStoredList = async <T>(key: string): Promise<T[]> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const setStoredList = async <T>(key: string, list: T[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {}
};
