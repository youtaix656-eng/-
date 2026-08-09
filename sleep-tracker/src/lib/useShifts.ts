import { useCallback, useEffect, useState } from 'react';
import { shiftRepository } from './storage';
import type { ShiftLog } from '../types/work';

export function useShifts() {
  const [shifts, setShifts] = useState<ShiftLog[]>([]);

  const refresh = useCallback(async () => {
    setShifts(await shiftRepository.list());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveShift = useCallback(
    async (shift: ShiftLog) => {
      await shiftRepository.upsert(shift);
      await refresh();
    },
    [refresh]
  );

  return { shifts, saveShift, refresh };
}
