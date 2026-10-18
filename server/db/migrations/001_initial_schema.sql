-- Schema PostgreSQL para o Delivale Follow-up
-- Executado em instalações com PostgreSQL e Docker Compose

CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) UNIQUE NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    instance_name VARCHAR(128) NOT NULL,
    server_url VARCHAR(512) NOT NULL,
    api_key_encrypted TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'disconnected',
    qr_code TEXT,
    connected_phone VARCHAR(32),
    connected_name VARCHAR(255),
    last_event_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_up_steps (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    duration_days INT NOT NULL DEFAULT 0,
    duration_hours INT NOT NULL DEFAULT 0,
    duration_minutes INT NOT NULL DEFAULT 1,
    total_duration_minutes INT NOT NULL DEFAULT 1,
    message_content TEXT NOT NULL,
    media_url TEXT,
    media_original_name VARCHAR(255),
    media_mime_type VARCHAR(64),
    media_type VARCHAR(32) NOT NULL DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    normalized_phone VARCHAR(32) NOT NULL,
    opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    converted BOOLEAN NOT NULL DEFAULT FALSE,
    human_paused_until TIMESTAMP WITH TIME ZONE,
    last_relevant_interaction_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, normalized_phone)
);

CREATE TABLE IF NOT EXISTS enrollments (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id VARCHAR(64) NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    step_index INT NOT NULL DEFAULT 0,
    current_step_id VARCHAR(64) REFERENCES follow_up_steps(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'in_funnel',
    entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_message_sent_at TIMESTAMP WITH TIME ZONE,
    exit_reason VARCHAR(128)
);

CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id VARCHAR(64) REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    service_id VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    appt_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    confirmation_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_due ON enrollments(status, due_at);
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(organization_id, normalized_phone);
