export const CHECKIN_REWARD_POLICY = Object.freeze({
  baseMinYuan: 0.20,
  baseMaxYuan: 0.50,
  streakBonusMinYuan: 1.00,
  streakBonusMaxYuan: 3.00,
});

const weightedRandomAmount = (min: number, max: number, randomValue: number, skew = 2.2): number => {
  const boundedRandom = Math.min(1, Math.max(0, randomValue));
  const amount = min + (max - min) * Math.pow(boundedRandom, skew);
  return Math.round(amount * 100) / 100;
};

export const getCheckinBaseReward = (randomValue = Math.random()): number => weightedRandomAmount(
  CHECKIN_REWARD_POLICY.baseMinYuan,
  CHECKIN_REWARD_POLICY.baseMaxYuan,
  randomValue,
);

export const getCheckinStreakBonus = (streakDays: number, randomValue = Math.random()): number => {
  if (streakDays <= 0 || streakDays % 7 !== 0) return 0;
  return weightedRandomAmount(
    CHECKIN_REWARD_POLICY.streakBonusMinYuan,
    CHECKIN_REWARD_POLICY.streakBonusMaxYuan,
    randomValue,
    1.9,
  );
};
