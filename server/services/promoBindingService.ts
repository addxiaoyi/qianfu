import { AppError, ErrorCode } from '../utils/errors';

export interface PromoBindingInput {
  platform: string;
  platformUserId: string;
  platformUsername?: string | null;
}

interface PromoBindingDb {
  promoPlatformBinding: {
    findUnique(args: unknown): Promise<{ id: number; user_id: number } | null>;
    upsert(args: unknown): Promise<unknown>;
  };
}

const isUniqueConflict = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === 'P2002'
);

export const bindPromoPlatformAccount = async (
  db: PromoBindingDb,
  userId: number,
  input: PromoBindingInput,
): Promise<unknown> => {
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
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AppError('Platform identity is already bound', 409, ErrorCode.CONFLICT);
    }
    throw error;
  }
};
