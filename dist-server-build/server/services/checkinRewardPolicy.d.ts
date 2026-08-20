export declare const CHECKIN_REWARD_POLICY: Readonly<{
    baseMinYuan: 0.01;
    baseMaxYuan: 0.1;
    streakBonusMinYuan: 0.05;
    streakBonusMaxYuan: 0.5;
}>;
export declare const getCheckinBaseReward: (randomValue?: number) => number;
export declare const getCheckinStreakBonus: (streakDays: number, randomValue?: number) => number;
//# sourceMappingURL=checkinRewardPolicy.d.ts.map