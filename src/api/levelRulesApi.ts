import { api } from './request';
import type { LevelRulesResponse } from '@/types/api';

export const fetchLevelRules = () =>
  api.get<LevelRulesResponse>('/api/v1/user/level/rules', undefined, { useAuth: true });
