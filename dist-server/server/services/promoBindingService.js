import { AppError, ErrorCode } from '../utils/errors.js';
const isUniqueConflict = (error) => (typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002');
export const bindPromoPlatformAccount = async (db, userId, input) => {
    const owner = await db.promoPlatformBinding.findUnique({
        where: {
            platform_platform_user_id: {
                platform: input.platform,
                platform_user_id: input.platformUserId,
            },
        },
        select: { id: true, user_id: true },
    });
    if (owner && owner.user_id !== userId) {
        throw new AppError('Platform identity is already bound', 409, ErrorCode.CONFLICT);
    }
    try {
        return await db.promoPlatformBinding.upsert({
            where: {
                user_id_platform: {
                    user_id: userId,
                    platform: input.platform,
                },
            },
            update: {
                platform_user_id: input.platformUserId,
                platform_username: input.platformUsername ?? null,
                binding_status: 'PENDING',
                bind_source: 'MANUAL',
                verified_at: null,
                last_verify_at: null,
            },
            create: {
                user_id: userId,
                platform: input.platform,
                platform_user_id: input.platformUserId,
                platform_username: input.platformUsername ?? null,
                binding_status: 'PENDING',
                bind_source: 'MANUAL',
            },
        });
    }
    catch (error) {
        if (isUniqueConflict(error)) {
            throw new AppError('Platform identity is already bound', 409, ErrorCode.CONFLICT);
        }
        throw error;
    }
};
//# sourceMappingURL=promoBindingService.js.map