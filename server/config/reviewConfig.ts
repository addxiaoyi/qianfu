// Server content review configuration
import type { UserRole, Permission } from '../types/roles';

export const REVIEW_CONFIG = {
  // Review process settings
  PROCESS: {
    ENABLED: true,
    REQUIRED_FOR_EDIT: true,
    REQUIRED_FOR_PUBLISH: true,
    AUTO_APPROVE_AFTER_DAYS: 7, // Auto-approve after 7 days
    MAX_PENDING_REVIEWS: 10, // Max pending reviews
  },

  // Review permissions settings
  PERMISSIONS: {
    // User roles allowed to review
    ALLOWED_REVIEWER_ROLES: ['ADMIN', 'OPERATOR', 'REVIEWER'] as UserRole[],
    
    // Review permission requirements
    REQUIRED_PERMISSIONS: ['review_servers', 'manage_content'] as unknown as Permission[],
    
    // Review limits for different roles
    REVIEW_LIMITS: {
      ADMIN: {
        DAILY_LIMIT: 100,
        CONCURRENT_REVIEWS: 20
      },
      OPERATOR: {
        DAILY_LIMIT: 50,
        CONCURRENT_REVIEWS: 10
      },
      REVIEWER: {
        DAILY_LIMIT: 30,
        CONCURRENT_REVIEWS: 5
      }
    }
  },

  // Review standards settings
  STANDARDS: {
    // Content quality standards
    CONTENT_QUALITY: {
      MIN_DESCRIPTION_LENGTH: 50,
      MAX_DESCRIPTION_LENGTH: 2000,
      REQUIRED_FIELDS: ['name', 'summary', 'content_html'],
      PROHIBITED_CONTENT: ['violence', 'pornography', 'illegal information', 'spam']
    },

    // Server info standards
    SERVER_INFO: {
      MIN_ACTIVITY_SCORE: 0,
      MAX_TAGS_COUNT: 10,
      VALID_IP_FORMATS: ['IPv4', 'IPv6', 'domain'],
      REQUIRED_SERVER_STATUS: true
    },

    // Review scoring standards
    SCORING: {
      CONTENT_QUALITY_WEIGHT: 0.4,
      SERVER_INFO_WEIGHT: 0.3,
      USER_REPUTATION_WEIGHT: 0.2,
      ACTIVITY_WEIGHT: 0.1,
      PASS_THRESHOLD: 0.7
    }
  },

  // Notification settings
  NOTIFICATIONS: {
    // Review result notifications
    REVIEW_RESULT: {
      ENABLED: true,
      EMAIL_TEMPLATES: {
        APPROVED: 'Your server content has been approved',
        REJECTED: 'Your server content needs modification',
        PENDING: 'Your server content is under review'
      }
    },

    // Review reminders
    REMINDERS: {
      ENABLED: true,
      PENDING_REMINDER_DAYS: 3,
      EXPIRY_WARNING_DAYS: 1
    }
  },

  // Review workflow settings
  WORKFLOW: {
    // Review steps
    STEPS: [
      {
        name: 'Content integrity check',
        required: true,
        auto_check: true
      },
      {
        name: 'Content quality evaluation',
        required: true,
        auto_check: false
      },
      {
        name: 'Server information verification',
        required: true,
        auto_check: true
      },
      {
        name: 'Final review',
        required: true,
        auto_check: false
      }
    ],

    // Review time limits
    TIME_LIMITS: {
      MAX_REVIEW_TIME_HOURS: 72,
      AUTO_ESCALATION_HOURS: 24,
      REMINDER_INTERVAL_HOURS: 12
    }
  }
};

// Review status enum
export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVISION = 'NEEDS_REVISION'
}

// Review result type
export interface ReviewResult {
  status: ReviewStatus;
  score?: number;
  feedback?: string;
  reviewerId: number;
  reviewedAt: Date;
  nextReviewDate?: Date;
}

// Review history record
export interface ReviewHistory {
  id: number;
  serverId: number;
  reviewerId: number;
  status: ReviewStatus;
  score: number;
  feedback: string;
  createdAt: Date;
}