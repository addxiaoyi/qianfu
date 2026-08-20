import prisma from '../db.js';
import { promoClaimSchema, promoIdempotencyKeySchema } from '../schemas/promoSchemas.js';
import { createPendingPromoClaim } from '../services/promoClaimService.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendCreatedResponse, sendSuccess } from '../utils/response.js';
export const submitPromoClaim = async (req, res, next) => {
    try {
        if (!req.user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const body = promoClaimSchema.safeParse(req.body);
        const key = promoIdempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
        if (!body.success || !key.success) {
            throw new AppError('Invalid promotion claim', 400, ErrorCode.VALIDATION_ERROR);
        }
        const outcome = await createPendingPromoClaim(prisma, {
            userId: req.user.id,
            taskId: body.data.taskId,
            idempotencyKey: key.data,
            proof: body.data.proofData,
        });
        if (!outcome.created) {
            return sendSuccess(res, outcome.claim, 'Promotion claim replayed');
        }
        return sendCreatedResponse(res, outcome.claim, { resource: 'PromoClaimRecord' });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=promoClaimController.js.map