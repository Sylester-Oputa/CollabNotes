-- CreateEnum
CREATE TYPE "public"."WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WorkflowStepType" AS ENUM ('TASK_CREATION', 'APPROVAL', 'NOTIFICATION', 'ASSIGNMENT', 'CONDITION', 'DELAY', 'EMAIL', 'WEBHOOK', 'DATA_UPDATE', 'SUBPROCESS');

-- CreateEnum
CREATE TYPE "public"."WorkflowTriggerType" AS ENUM ('MANUAL', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'USER_ASSIGNED', 'DEADLINE_APPROACHING', 'TIME_BASED', 'CONDITION_MET', 'EMAIL_RECEIVED', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WorkflowInstanceStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'OPENED', 'CLICKED');

-- CreateEnum
CREATE TYPE "public"."EmailTemplateType" AS ENUM ('TRANSACTIONAL', 'MARKETING', 'NOTIFICATION', 'WORKFLOW', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."EmailPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."CallStatus" AS ENUM ('INITIATED', 'RINGING', 'CONNECTED', 'DISCONNECTED', 'FAILED', 'MISSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."CallType" AS ENUM ('AUDIO', 'VIDEO', 'SCREEN_SHARE');

-- CreateEnum
CREATE TYPE "public"."ScreenShareStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('TEXT', 'SPREADSHEET', 'PRESENTATION', 'DIAGRAM', 'WHITEBOARD');

-- CreateEnum
CREATE TYPE "public"."CollaborationPermission" AS ENUM ('VIEW', 'COMMENT', 'EDIT', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."FileCategory" AS ENUM ('DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO', 'ARCHIVE', 'OTHER');

-- CreateTable
CREATE TABLE "public"."two_factor_auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT,
    "tempSecret" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "method" TEXT NOT NULL DEFAULT 'AUTHENTICATOR',
    "backupCodes" TEXT,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."login_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sso_configurations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "domain" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sso_user_mappings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_steps" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stepType" "public"."WorkflowStepType" NOT NULL,
    "order" INTEGER NOT NULL,
    "configuration" JSONB NOT NULL,
    "conditions" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_step_dependencies" (
    "id" TEXT NOT NULL,
    "dependentStepId" TEXT NOT NULL,
    "requiredStepId" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL DEFAULT 'COMPLETION',
    "conditionValue" JSONB,

    CONSTRAINT "workflow_step_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_triggers" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "public"."WorkflowTriggerType" NOT NULL,
    "configuration" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_instances" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "public"."WorkflowInstanceStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT,
    "contextData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_executions" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "public"."WorkflowInstanceStatus" NOT NULL DEFAULT 'RUNNING',
    "assignedTo" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "output" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."approval_requests" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approverIds" TEXT[],
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "response" TEXT,
    "attachments" JSONB,
    "metadata" JSONB,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assignment_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "assignmentLogic" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_template_library" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "template" JSONB NOT NULL,
    "tags" TEXT[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_template_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_logs" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT,
    "executionId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "context" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "type" "public"."EmailTemplateType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "variables" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_logs" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "companyId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "status" "public"."EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" "public"."EmailPriority" NOT NULL DEFAULT 'NORMAL',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "trackingId" TEXT,
    "metadata" JSONB,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_calls" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "participantIds" TEXT[],
    "roomId" TEXT NOT NULL,
    "type" "public"."CallType" NOT NULL DEFAULT 'VIDEO',
    "status" "public"."CallStatus" NOT NULL DEFAULT 'INITIATED',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "recordingUrl" TEXT,
    "metadata" JSONB,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."call_recordings" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "duration" INTEGER,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "recordedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voice_messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "groupId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/mp3',
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'SENT',
    "transcription" TEXT,
    "isListened" BOOLEAN NOT NULL DEFAULT false,
    "listenedAt" TIMESTAMP(3),
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."screen_share_sessions" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "participantIds" TEXT[],
    "sessionId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" "public"."ScreenShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "recordingUrl" TEXT,
    "isRecording" BOOLEAN NOT NULL DEFAULT false,
    "maxParticipants" INTEGER NOT NULL DEFAULT 50,
    "companyId" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "screen_share_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."screen_share_interactions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_share_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaborative_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."DocumentType" NOT NULL DEFAULT 'TEXT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lastEditedBy" TEXT,
    "lastEditedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborative_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_permissions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "permission" "public"."CollaborationPermission" NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changes" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_collaborations" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_collaborations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shared_files" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" "public"."FileCategory" NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."file_accesses" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL DEFAULT 'download',

    CONSTRAINT "file_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_auth_userId_key" ON "public"."two_factor_auth"("userId");

-- CreateIndex
CREATE INDEX "security_logs_userId_timestamp_idx" ON "public"."security_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "security_logs_companyId_timestamp_idx" ON "public"."security_logs"("companyId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "login_sessions_sessionToken_key" ON "public"."login_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "login_sessions_userId_isActive_idx" ON "public"."login_sessions"("userId", "isActive");

-- CreateIndex
CREATE INDEX "login_sessions_sessionToken_idx" ON "public"."login_sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_userId_key" ON "public"."email_verifications"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_timestamp_idx" ON "public"."audit_logs"("companyId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "public"."audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "public"."audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "password_history_userId_createdAt_idx" ON "public"."password_history"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "public"."api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "public"."api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_companyId_idx" ON "public"."api_keys"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "sso_configurations_companyId_provider_key" ON "public"."sso_configurations"("companyId", "provider");

-- CreateIndex
CREATE INDEX "sso_user_mappings_providerId_provider_idx" ON "public"."sso_user_mappings"("providerId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "sso_user_mappings_userId_provider_key" ON "public"."sso_user_mappings"("userId", "provider");

-- CreateIndex
CREATE INDEX "workflow_templates_companyId_idx" ON "public"."workflow_templates"("companyId");

-- CreateIndex
CREATE INDEX "workflow_templates_category_idx" ON "public"."workflow_templates"("category");

-- CreateIndex
CREATE INDEX "workflow_steps_templateId_idx" ON "public"."workflow_steps"("templateId");

-- CreateIndex
CREATE INDEX "workflow_steps_order_idx" ON "public"."workflow_steps"("order");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_step_dependencies_dependentStepId_requiredStepId_key" ON "public"."workflow_step_dependencies"("dependentStepId", "requiredStepId");

-- CreateIndex
CREATE INDEX "workflow_triggers_templateId_idx" ON "public"."workflow_triggers"("templateId");

-- CreateIndex
CREATE INDEX "workflow_triggers_triggerType_idx" ON "public"."workflow_triggers"("triggerType");

-- CreateIndex
CREATE INDEX "workflow_instances_templateId_idx" ON "public"."workflow_instances"("templateId");

-- CreateIndex
CREATE INDEX "workflow_instances_status_idx" ON "public"."workflow_instances"("status");

-- CreateIndex
CREATE INDEX "workflow_instances_startedAt_idx" ON "public"."workflow_instances"("startedAt");

-- CreateIndex
CREATE INDEX "workflow_executions_instanceId_idx" ON "public"."workflow_executions"("instanceId");

-- CreateIndex
CREATE INDEX "workflow_executions_stepId_idx" ON "public"."workflow_executions"("stepId");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "public"."workflow_executions"("status");

-- CreateIndex
CREATE INDEX "approval_requests_executionId_idx" ON "public"."approval_requests"("executionId");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "public"."approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_dueDate_idx" ON "public"."approval_requests"("dueDate");

-- CreateIndex
CREATE INDEX "assignment_rules_companyId_idx" ON "public"."assignment_rules"("companyId");

-- CreateIndex
CREATE INDEX "assignment_rules_priority_idx" ON "public"."assignment_rules"("priority");

-- CreateIndex
CREATE INDEX "workflow_template_library_category_idx" ON "public"."workflow_template_library"("category");

-- CreateIndex
CREATE INDEX "workflow_template_library_industry_idx" ON "public"."workflow_template_library"("industry");

-- CreateIndex
CREATE INDEX "workflow_template_library_popularity_idx" ON "public"."workflow_template_library"("popularity");

-- CreateIndex
CREATE INDEX "workflow_logs_instanceId_idx" ON "public"."workflow_logs"("instanceId");

-- CreateIndex
CREATE INDEX "workflow_logs_executionId_idx" ON "public"."workflow_logs"("executionId");

-- CreateIndex
CREATE INDEX "workflow_logs_level_idx" ON "public"."workflow_logs"("level");

-- CreateIndex
CREATE INDEX "workflow_logs_timestamp_idx" ON "public"."workflow_logs"("timestamp");

-- CreateIndex
CREATE INDEX "email_templates_companyId_idx" ON "public"."email_templates"("companyId");

-- CreateIndex
CREATE INDEX "email_templates_type_idx" ON "public"."email_templates"("type");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_trackingId_key" ON "public"."email_logs"("trackingId");

-- CreateIndex
CREATE INDEX "email_logs_companyId_idx" ON "public"."email_logs"("companyId");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "public"."email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_scheduledAt_idx" ON "public"."email_logs"("scheduledAt");

-- CreateIndex
CREATE INDEX "email_logs_recipientEmail_idx" ON "public"."email_logs"("recipientEmail");

-- CreateIndex
CREATE INDEX "email_logs_trackingId_idx" ON "public"."email_logs"("trackingId");

-- CreateIndex
CREATE UNIQUE INDEX "video_calls_roomId_key" ON "public"."video_calls"("roomId");

-- CreateIndex
CREATE INDEX "video_calls_companyId_idx" ON "public"."video_calls"("companyId");

-- CreateIndex
CREATE INDEX "video_calls_initiatorId_idx" ON "public"."video_calls"("initiatorId");

-- CreateIndex
CREATE INDEX "video_calls_status_idx" ON "public"."video_calls"("status");

-- CreateIndex
CREATE INDEX "video_calls_scheduledAt_idx" ON "public"."video_calls"("scheduledAt");

-- CreateIndex
CREATE INDEX "call_recordings_callId_idx" ON "public"."call_recordings"("callId");

-- CreateIndex
CREATE INDEX "voice_messages_companyId_idx" ON "public"."voice_messages"("companyId");

-- CreateIndex
CREATE INDEX "voice_messages_senderId_idx" ON "public"."voice_messages"("senderId");

-- CreateIndex
CREATE INDEX "voice_messages_recipientId_idx" ON "public"."voice_messages"("recipientId");

-- CreateIndex
CREATE INDEX "voice_messages_groupId_idx" ON "public"."voice_messages"("groupId");

-- CreateIndex
CREATE INDEX "voice_messages_createdAt_idx" ON "public"."voice_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "screen_share_sessions_sessionId_key" ON "public"."screen_share_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "screen_share_sessions_companyId_idx" ON "public"."screen_share_sessions"("companyId");

-- CreateIndex
CREATE INDEX "screen_share_sessions_hostId_idx" ON "public"."screen_share_sessions"("hostId");

-- CreateIndex
CREATE INDEX "screen_share_sessions_status_idx" ON "public"."screen_share_sessions"("status");

-- CreateIndex
CREATE INDEX "screen_share_sessions_startedAt_idx" ON "public"."screen_share_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "screen_share_interactions_sessionId_idx" ON "public"."screen_share_interactions"("sessionId");

-- CreateIndex
CREATE INDEX "screen_share_interactions_userId_idx" ON "public"."screen_share_interactions"("userId");

-- CreateIndex
CREATE INDEX "screen_share_interactions_timestamp_idx" ON "public"."screen_share_interactions"("timestamp");

-- CreateIndex
CREATE INDEX "collaborative_documents_companyId_idx" ON "public"."collaborative_documents"("companyId");

-- CreateIndex
CREATE INDEX "collaborative_documents_createdBy_idx" ON "public"."collaborative_documents"("createdBy");

-- CreateIndex
CREATE INDEX "collaborative_documents_type_idx" ON "public"."collaborative_documents"("type");

-- CreateIndex
CREATE INDEX "collaborative_documents_updatedAt_idx" ON "public"."collaborative_documents"("updatedAt");

-- CreateIndex
CREATE INDEX "document_permissions_documentId_idx" ON "public"."document_permissions"("documentId");

-- CreateIndex
CREATE INDEX "document_permissions_userId_idx" ON "public"."document_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "document_permissions_documentId_userId_key" ON "public"."document_permissions"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "document_permissions_documentId_groupId_key" ON "public"."document_permissions"("documentId", "groupId");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "public"."document_versions"("documentId");

-- CreateIndex
CREATE INDEX "document_versions_createdAt_idx" ON "public"."document_versions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "public"."document_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "document_collaborations_documentId_idx" ON "public"."document_collaborations"("documentId");

-- CreateIndex
CREATE INDEX "document_collaborations_userId_idx" ON "public"."document_collaborations"("userId");

-- CreateIndex
CREATE INDEX "document_collaborations_timestamp_idx" ON "public"."document_collaborations"("timestamp");

-- CreateIndex
CREATE INDEX "shared_files_companyId_idx" ON "public"."shared_files"("companyId");

-- CreateIndex
CREATE INDEX "shared_files_uploadedBy_idx" ON "public"."shared_files"("uploadedBy");

-- CreateIndex
CREATE INDEX "shared_files_category_idx" ON "public"."shared_files"("category");

-- CreateIndex
CREATE INDEX "shared_files_createdAt_idx" ON "public"."shared_files"("createdAt");

-- CreateIndex
CREATE INDEX "file_accesses_fileId_idx" ON "public"."file_accesses"("fileId");

-- CreateIndex
CREATE INDEX "file_accesses_userId_idx" ON "public"."file_accesses"("userId");

-- CreateIndex
CREATE INDEX "file_accesses_accessedAt_idx" ON "public"."file_accesses"("accessedAt");

-- AddForeignKey
ALTER TABLE "public"."two_factor_auth" ADD CONSTRAINT "two_factor_auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_logs" ADD CONSTRAINT "security_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_logs" ADD CONSTRAINT "security_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."login_sessions" ADD CONSTRAINT "login_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_verifications" ADD CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_history" ADD CONSTRAINT "password_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sso_configurations" ADD CONSTRAINT "sso_configurations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sso_user_mappings" ADD CONSTRAINT "sso_user_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_templates" ADD CONSTRAINT "workflow_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_templates" ADD CONSTRAINT "workflow_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_steps" ADD CONSTRAINT "workflow_steps_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_step_dependencies" ADD CONSTRAINT "workflow_step_dependencies_dependentStepId_fkey" FOREIGN KEY ("dependentStepId") REFERENCES "public"."workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_step_dependencies" ADD CONSTRAINT "workflow_step_dependencies_requiredStepId_fkey" FOREIGN KEY ("requiredStepId") REFERENCES "public"."workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_triggers" ADD CONSTRAINT "workflow_triggers_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_instances" ADD CONSTRAINT "workflow_instances_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."workflow_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_instances" ADD CONSTRAINT "workflow_instances_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_executions" ADD CONSTRAINT "workflow_executions_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_executions" ADD CONSTRAINT "workflow_executions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."workflow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_executions" ADD CONSTRAINT "workflow_executions_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approval_requests" ADD CONSTRAINT "approval_requests_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "public"."workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approval_requests" ADD CONSTRAINT "approval_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approval_requests" ADD CONSTRAINT "approval_requests_respondedBy_fkey" FOREIGN KEY ("respondedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignment_rules" ADD CONSTRAINT "assignment_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignment_rules" ADD CONSTRAINT "assignment_rules_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_template_library" ADD CONSTRAINT "workflow_template_library_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_logs" ADD CONSTRAINT "email_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_logs" ADD CONSTRAINT "email_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_logs" ADD CONSTRAINT "email_logs_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_calls" ADD CONSTRAINT "video_calls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_calls" ADD CONSTRAINT "video_calls_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."call_recordings" ADD CONSTRAINT "call_recordings_callId_fkey" FOREIGN KEY ("callId") REFERENCES "public"."video_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."call_recordings" ADD CONSTRAINT "call_recordings_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_messages" ADD CONSTRAINT "voice_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_messages" ADD CONSTRAINT "voice_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_messages" ADD CONSTRAINT "voice_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_messages" ADD CONSTRAINT "voice_messages_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."message_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."screen_share_sessions" ADD CONSTRAINT "screen_share_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."screen_share_sessions" ADD CONSTRAINT "screen_share_sessions_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."screen_share_interactions" ADD CONSTRAINT "screen_share_interactions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."screen_share_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."screen_share_interactions" ADD CONSTRAINT "screen_share_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaborative_documents" ADD CONSTRAINT "collaborative_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaborative_documents" ADD CONSTRAINT "collaborative_documents_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaborative_documents" ADD CONSTRAINT "collaborative_documents_lastEditedBy_fkey" FOREIGN KEY ("lastEditedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaborative_documents" ADD CONSTRAINT "collaborative_documents_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."message_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_collaborations" ADD CONSTRAINT "document_collaborations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_collaborations" ADD CONSTRAINT "document_collaborations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shared_files" ADD CONSTRAINT "shared_files_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shared_files" ADD CONSTRAINT "shared_files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."file_accesses" ADD CONSTRAINT "file_accesses_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."shared_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."file_accesses" ADD CONSTRAINT "file_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
