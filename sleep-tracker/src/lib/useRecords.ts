import { useCallback, useEffect, useState } from 'react';
import { sleepRepository } from './storage';
import type { SleepRecord } from '../types/sleep';

export function useRecords() {
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const list = await sleepRepository.list();
    setRecords(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveRecord = useCallback(
    async (record: SleepRecord) => {
      await sleepRepository.upsert(record);
      await refresh();
    },
    [refresh]
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      await sleepRepository.remove(id);
      await refresh();
    },
    [refresh]
  );

  return { records, loaded, refresh, saveRecord, deleteRecord };
}
