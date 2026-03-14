-- File Management Enhancements
-- 版本：1.1.0
-- 创建时间：2026-03-13

-- ============================================
-- 更新文件表 (files) - 添加更多字段
-- ============================================
ALTER TABLE files ADD COLUMN uploaded_by TEXT;
ALTER TABLE files ADD COLUMN folder TEXT DEFAULT 'uploads';
ALTER TABLE files ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);

-- ============================================
-- 文件变换表 (file_transforms) - 新增
-- 用于存储缩略图、裁剪、优化等变换后的文件
-- ============================================
CREATE TABLE IF NOT EXISTS file_transforms (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_file_id TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    operations TEXT,
    format TEXT,
    quality INTEGER,
    width INTEGER,
    height INTEGER,
    size INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_file_transforms_tenant ON file_transforms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_transforms_source ON file_transforms(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_transforms_created ON file_transforms(created_at);

-- ============================================
-- 更新触发器 - 自动更新 updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_files_timestamp 
AFTER UPDATE ON files
BEGIN
    UPDATE files SET updated_at = datetime('now') WHERE id = NEW.id;
END;
