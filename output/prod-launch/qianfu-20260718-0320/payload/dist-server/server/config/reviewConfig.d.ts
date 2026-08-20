import type { UserRole, Permission } from '../types/roles';
export declare const REVIEW_CONFIG: {
    PROCESS: {
        ENABLED: boolean;
        REQUIRED_FOR_EDIT: boolean;
        REQUIRED_FOR_PUBLISH: boolean;
        AUTO_APPROVE_AFTER_DAYS: number;
        MAX_PENDING_REVIEWS: number;
    };
    PERMISSIONS: {
        ALLOWED_REVIEWER_ROLES: UserRole[];
        REQUIRED_PERMISSIONS: Permission[];
        REVIEW_LIMITS: {
            ADMIN: {
                DAILY_LIMIT: number;
                CONCURRENT_REVIEWS: number;
            };
            OPERATOR: {
                DAILY_LIMIT: number;
                CONCURRENT_REVIEWS: number;
            };
            REVIEWER: {
                DAILY_LIMIT: number;
                CONCURRENT_REVIEWS: number;
            };
        };
    };
    STANDARDS: {
        CONTENT_QUALITY: {
            MIN_DESCRIPTION_LENGTH: number;
            MAX_DESCRIPTION_LENGTH: number;
            REQUIRED_FIELDS: string[];
            PROHIBITED_CONTENT: string[];
        };
        SERVER_INFO: {
            MIN_ACTIVITY_SCORE: number;
            MAX_TAGS_COUNT: number;
            VALID_IP_FORMATS: string[];
            REQUIRED_SERVER_STATUS: boolean;
        };
        SCORING: {
            CONTENT_QUALITY_WEIGHT: number;
            SERVER_INFO_WEIGHT: number;
            USER_REPUTATION_WEIGHT: number;
            ACTIVITY_WEIGHT: number;
            PASS_THRESHOLD: number;
        };
    };
    NOTIFICATIONS: {
        REVIEW_RESULT: {
            ENABLED: boolean;
            EMAIL_TEMPLATES: {
                APPROVED: string;
                REJECTED: string;
                PENDING: string;
            };
        };
        REMINDERS: {
            ENABLED: boolean;
            PENDING_REMINDER_DAYS: number;
            EXPIRY_WARNING_DAYS: number;
        };
    };
    WORKFLOW: {
        STEPS: {
            name: string;
            required: boolean;
            auto_check: boolean;
        }[];
        TIME_LIMITS: {
            MAX_REVIEW_TIME_HOURS: number;
            AUTO_ESCALATION_HOURS: number;
            REMINDER_INTERVAL_HOURS: number;
        };
    };
};
export declare enum ReviewStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    NEEDS_REVISION = "NEEDS_REVISION"
}
export interface ReviewResult {
    status: ReviewStatus;
    score?: number;
    feedback?: string;
    reviewerId: number;
    reviewedAt: Date;
    nextReviewDate?: Date;
}
export interface ReviewHistory {
    id: number;
    serverId: number;
    reviewerId: number;
    status: ReviewStatus;
    score: number;
    feedback: string;
    createdAt: Date;
}
//# sourceMappingURL=reviewConfig.d.ts.map