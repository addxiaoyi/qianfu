export declare const CHECKIN_REWARD_POLICY: Readonly<{
    baseMinYuan: 0.2;
    baseMaxYuan: 0.5;
    streakBonusMinYuan: 1;
    streakBonusMaxYuan: 3;
}>;
export declare const getCheckinBaseReward: (randomValue?: number) => number;
export declare const getCheckinStreakBonus: (streakDays: number, randomValue?: number) => number;
//# sourceMappingURL=checkinRewardPolicy.d.ts.map