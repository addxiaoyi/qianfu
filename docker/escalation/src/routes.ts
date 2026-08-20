/**
 * Alert Escalation Service - API Routes
 */

import { Router, Request, Response } from 'express';
import { EscalationEngine, AlertStateStore } from './escalationService';

export const routes = Router();

let engine: EscalationEngine;
let alertStore: AlertStateStore;

// Initialize with engine instance
export const initializeRoutes = (escalationEngine: EscalationEngine, stateStore: AlertStateStore) => {
  engine = escalationEngine;
  alertStore = stateStore;
};

// ============================================
// Alert Management
// ============================================

// Get all active alerts
routes.get('/alerts', (req: Request, res: Response) => {
  const status = engine.getStatus();
  res.json({
    success: true,
    data: {
      totalAlerts: status.totalAlerts,
      silencedAlerts: status.silencedAlerts,
      escalationTimelines: status.escalationTimelines,
      severityEscalation: status.severityEscalation,
    },
  });
});

// Get escalation history for an alert
routes.get('/alerts/:alertId/history', (req: Request, res: Response) => {
  const { alertId } = req.params;
  const history = alertStore.getEscalationHistory(alertId);

  res.json({
    success: true,
    data: {
      alertId,
      history,
    },
  });
});

// Manual escalation
routes.post('/alerts/:alertId/escalate', async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { level, reason } = req.body;

  if (!level || typeof level !== 'number') {
    res.status(400).json({
      success: false,
      error: 'Invalid level parameter',
    });
    return;
  }

  try {
    const result = await engine.escalateManually(alertId, level);
    res.json({
      success: result,
      data: {
        alertId,
        level,
        reason: reason || 'Manual escalation',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// Silence Management
// ============================================

// Create silence
routes.post('/silences', async (req: Request, res: Response) => {
  const { matchers, duration, createdBy, comment } = req.body;

  if (!matchers || !Array.isArray(matchers)) {
    res.status(400).json({
      success: false,
      error: 'Invalid matchers',
    });
    return;
  }

  try {
    // This would call Alertmanager API
    res.json({
      success: true,
      data: {
        silenceId: `silence_${Date.now()}`,
        matchers,
        duration: duration || 60,
        createdBy: createdBy || 'api',
        comment: comment || '',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + (duration || 60) * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Get active silences
routes.get('/silences', async (req: Request, res: Response) => {
  try {
    // This would call Alertmanager API
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Delete silence
routes.delete('/silences/:silenceId', async (req: Request, res: Response) => {
  const { silenceId } = req.params;

  try {
    res.json({
      success: true,
      data: {
        silenceId,
        deleted: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// Service Status
// ============================================

// Get service status
routes.get('/status', (req: Request, res: Response) => {
  const status = engine.getStatus();

  res.json({
    success: true,
    data: {
      ...status,
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
  });
});

// Get escalation statistics
routes.get('/stats', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      totalEscalations: 0,
      averageResolutionTime: 0,
      alertsBySeverity: {
        critical: 0,
        warning: 0,
        info: 0,
      },
      alertsByLevel: {
        l1: 0,
        l2: 0,
        l3: 0,
        l4: 0,
        l5: 0,
      },
    },
  });
});

// ============================================
// Configuration
// ============================================

// Get current configuration
routes.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      checkInterval: 30000,
      escalationTimelines: [
        { minutes: 5, level: 1, action: 'notify_oncall' },
        { minutes: 15, level: 2, action: 'notify_lead' },
        { minutes: 30, level: 3, action: 'notify_manager' },
        { minutes: 60, level: 4, action: 'notify_duty_head' },
        { minutes: 120, level: 5, action: 'notify_emergency' },
      ],
      severityEscalation: {
        critical: { enabled: true, startLevel: 1, maxLevel: 5 },
        warning: { enabled: true, startLevel: 2, maxLevel: 3 },
        info: { enabled: false, startLevel: 3, maxLevel: 2 },
      },
    },
  });
});

// Update configuration (runtime)
routes.put('/config', (req: Request, res: Response) => {
  const { checkInterval, escalationTimelines, severityEscalation } = req.body;

  // This would update the engine configuration at runtime
  res.json({
    success: true,
    message: 'Configuration updated (note: full runtime update requires service restart)',
    data: {
      checkInterval,
      escalationTimelines,
      severityEscalation,
    },
  });
});
