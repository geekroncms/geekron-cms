-- PostgreSQL 触发器方案
-- 用于实现实时数据同步到外部系统
-- 版本：1.0.0

-- ============================================
-- 同步队列表
-- ============================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    synced BOOLEAN DEFAULT FALSE,
    sync_attempts INTEGER DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同步队列索引
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);

-- ============================================
-- 通用触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION track_changes_for_sync()
RETURNS TRIGGER AS $$
DECLARE
    old_json JSONB;
    new_json JSONB;
BEGIN
    -- 确定操作类型和数据
    IF TG_OP = 'DELETE' THEN
        old_json = to_jsonb(OLD);
        new_json = NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        old_json = to_jsonb(OLD);
        new_json = to_jsonb(NEW);
    ELSE
        old_json = NULL;
        new_json = to_jsonb(NEW);
    END IF;

    -- 插入同步队列
    INSERT INTO sync_queue (
        table_name,
        operation,
        record_id,
        old_data,
        new_data
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        old_json,
        new_json
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 为各表添加触发器
-- ============================================

-- 租户表触发器
DROP TRIGGER IF EXISTS trg_tenants_sync ON tenants;
CREATE TRIGGER trg_tenants_sync
    AFTER INSERT OR UPDATE OR DELETE ON tenants
    FOR EACH ROW EXECUTE FUNCTION track_changes_for_sync();

-- 用户表触发器
DROP TRIGGER IF EXISTS trg_users_sync ON users;
CREATE TRIGGER trg_users_sync
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION track_changes_for_sync();

-- 集合表触发器
DROP TRIGGER IF EXISTS trg_collections_sync ON collections;
CREATE TRIGGER trg_collections_sync
    AFTER INSERT OR UPDATE OR DELETE ON collections
    FOR EACH ROW EXECUTE FUNCTION track_changes_for_sync();

-- 集合字段表触发器
DROP TRIGGER IF EXISTS trg_collection_fields_sync ON collection_fields;
CREATE TRIGGER trg_collection_fields_sync
    AFTER INSERT OR UPDATE OR DELETE ON collection_fields
    FOR EACH ROW EXECUTE FUNCTION track_changes_for_sync();

-- 动态数据表触发器
DROP TRIGGER IF EXISTS trg_collection_data_sync ON collection_data;
CREATE TRIGGER trg_collection_data_sync
    AFTER INSERT OR UPDATE OR DELETE ON collection_data
    FOR EACH ROW EXECUTE FUNCTION track_changes_for_sync();

-- API Keys 表触发器
DROP TRIGGER IF EXISTS trg_api_keys_sync ON api_keys;
CREATE TRIGGER trg_api_keys_sync
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION track_changes_for_sync();

-- 文件表触发器
DROP TRIGGER IF EXISTS trg_files_sync ON files;
CREATE TRIGGER trg_files_sync
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION track_changes_for_sync();

-- ============================================
-- 同步处理函数（从队列读取并同步到 D1）
-- ============================================
CREATE OR REPLACE FUNCTION process_sync_queue()
RETURNS void AS $$
DECLARE
    queue_record RECORD;
    sync_result BOOLEAN;
BEGIN
    -- 获取未同步的记录
    FOR queue_record IN 
        SELECT * FROM sync_queue 
        WHERE synced = FALSE 
        AND sync_attempts < 3
        ORDER BY created_at ASC
        LIMIT 100
    LOOP
        BEGIN
            -- 这里应该调用外部 API 或执行 D1 写入
            -- 示例：调用 HTTP API
            -- SELECT http_post('http://d1-sync-endpoint/sync', queue_record);
            
            -- 标记为已同步
            UPDATE sync_queue 
            SET synced = TRUE,
                sync_attempts = sync_attempts + 1,
                last_sync_at = NOW(),
                error_message = NULL
            WHERE id = queue_record.id;

        EXCEPTION WHEN OTHERS THEN
            -- 记录错误
            UPDATE sync_queue 
            SET sync_attempts = sync_attempts + 1,
                error_message = SQLERRM
            WHERE id = queue_record.id;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 清理旧同步记录函数
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_sync_queue(retention_days INTEGER DEFAULT 7)
RETURNS void AS $$
BEGIN
    DELETE FROM sync_queue 
    WHERE synced = TRUE 
    AND last_sync_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    RAISE NOTICE 'Cleaned up sync queue records older than % days', retention_days;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 物化视图：同步统计
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS sync_stats AS
SELECT 
    table_name,
    operation,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE synced = TRUE) as synced_count,
    COUNT(*) FILTER (WHERE synced = FALSE) as pending_count,
    MAX(created_at) as last_change_at
FROM sync_queue
GROUP BY table_name, operation;

-- 刷新统计视图
CREATE OR REPLACE FUNCTION refresh_sync_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW sync_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 通知函数（使用 PostgreSQL LISTEN/NOTIFY）
-- ============================================
CREATE OR REPLACE FUNCTION notify_sync_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('sync_channel', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'record_id', COALESCE(NEW.id, OLD.id)
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 为关键表添加通知触发器
DROP TRIGGER IF EXISTS trg_tenants_notify ON tenants;
CREATE TRIGGER trg_tenants_notify
    AFTER INSERT OR UPDATE OR DELETE ON tenants
    FOR EACH ROW EXECUTE FUNCTION notify_sync_change();

DROP TRIGGER IF EXISTS trg_users_notify ON users;
CREATE TRIGGER trg_users_notify
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION notify_sync_change();

COMMENT ON TABLE sync_queue IS '数据同步队列表';
COMMENT ON MATERIALIZED VIEW sync_stats IS '同步统计视图';
