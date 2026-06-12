import prisma from '../db';
import { logger } from '../utils/logger';
import { eventService, EVENTS } from './eventService';
import { invalidateUserCache } from '../middleware/auth';
import { handleError } from '../utils/errors';

const DEFAULT_ROLE_UPGRADE_PERMISSIONS = ['sponsor_badge', 'priority_support', 'early_access'];

const LISTING_PLAN_CANONICAL: Record<string, 'basic-monthly' | 'pro-quarterly' | 'vip-yearly'> = {
  'basic-monthly': 'basic-monthly',
  'pro-quarterly': 'pro-quarterly',
  'vip-yearly': 'vip-yearly',
  'listing-basic-monthly': 'basic-monthly',
  'listing-pro-quarterly': 'pro-quarterly',
  'listing-vip-yearly': 'vip-yearly',
};


/**
 * Handle payment success side effects
 * This decouples core payment processing from business logic (roles, notifications, etc.)
 */
eventService.on(EVENTS.PAYMENT_SUCCESS, async (payment: any) => {
  const { id: paymentId, user_id: userId, plan_id: planId, amount } = payment;
  
  try {
    logger.info(`[PaymentHandler] Processing side effects for payment ${paymentId} (Plan: ${planId})`);

    // Process plan-specific role upgrades
    if (planId && planId !== 'custom' && planId !== 'server_slot') {
      const listingPlan = LISTING_PLAN_CANONICAL[planId];
      if (listingPlan) {
        await prisma.notification.create({
          data: {
            user_id: userId,
            title: 'Wallet Recharge Received',
            content: `Your ${listingPlan} recharge order has been completed. Funds are now available in your wallet for server publishing.`,
            type: 'SUCCESS',
          }
        });
        logger.info(`[PaymentHandler] Listing recharge order ${listingPlan} completed for user ${userId}`);
        return;
      }

      let planName = 'Premium Plan';
      
      // Upgrade user role if it's a sponsor plan
      if (planId.includes('premium') || planId.includes('vip') || planId.includes('pro')) {
        const isVip = planId.includes('vip');
        const newRole = isVip ? 'VIP' : 'SPONSOR';
        planName = isVip ? 'VIP Plan' : 'SPONSOR Plan';
        
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { permissions: true }
        });
        const existingPermissions = currentUser?.permissions ? JSON.parse(currentUser.permissions) : [];
        const upgradePermissions = DEFAULT_ROLE_UPGRADE_PERMISSIONS;
        const mergedPermissions = [...new Set([...existingPermissions, ...upgradePermissions])];

        await prisma.user.update({
          where: { id: userId },
          data: {
            role: newRole,
            permissions: JSON.stringify(mergedPermissions)
          }
        });
        await invalidateUserCache(String(userId));

        await prisma.auditLog.create({
          data: {
            user_id: userId,
            action: 'ROLE_UPGRADE',
            target: 'user',
            details: JSON.stringify({ old_role: 'NORMAL', new_role: newRole, plan_id: planId })
          }
        });
        
        logger.info(`[PaymentHandler] User ${userId} upgraded to ${newRole} via plan ${planId}`);
      }

      await prisma.notification.create({
        data: {
          user_id: userId,
          title: 'Sponsorship Activated',
          content: `Thank you for your support! Your ${planName} has been activated. Amount: ${amount} CNY.`,
          type: 'SUCCESS'
        }
      });
    } else if (planId === 'server_slot') {
      await prisma.notification.create({
        data: {
          user_id: userId,
          title: 'Benefits Received',
          content: `Your server slot has been increased. Thank you for your support!`,
          type: 'SUCCESS'
        }
      });
    } else {
      await prisma.notification.create({
        data: {
          user_id: userId,
          title: 'Payment Successful',
          content: `Your account has been successfully topped up with ${amount} CNY.`,
          type: 'SUCCESS'
        }
      });
    }

    logger.info(`[PaymentHandler] Side effects completed for payment ${paymentId}`);
  } catch (error) {
    logger.error(`[PaymentHandler] Error processing side effects for ${paymentId}:`, handleError(error));
  }
});

// To ensure the listener is registered, we export an initialization function
export const initPaymentHandlers = () => {
  logger.info('[PaymentHandler] Initialized listeners');
};
