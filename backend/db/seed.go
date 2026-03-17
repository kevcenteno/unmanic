package db

import (
	"muxmill/models"
)

// SeedDefaults populates the database with default settings if they don't exist
func SeedDefaults() {
	// Default Settings
	defaultSettings := []models.Setting{
		{Key: "ui_port", Value: "8888"},
		{Key: "ui_address", Value: ""},
		{Key: "ssl_enabled", Value: "false"},
		{Key: "debugging", Value: "false"},
		{Key: "log_buffer_retention", Value: "0"},
		{Key: "enable_library_scanner", Value: "false"},
		{Key: "schedule_full_scan_minutes", Value: "1440"},
		{Key: "follow_symlinks", Value: "true"},
		{Key: "concurrent_file_testers", Value: "2"},
		{Key: "run_full_scan_on_start", Value: "false"},
		{Key: "clear_pending_tasks_on_restart", Value: "true"},
		{Key: "auto_manage_completed_tasks", Value: "false"},
		{Key: "compress_completed_tasks_logs", Value: "false"},
		{Key: "max_age_of_completed_tasks", Value: "91"},
		{Key: "always_keep_failed_tasks", Value: "true"},
		{Key: "cache_path", Value: "/tmp/muxmill/cache"},
		{Key: "installation_name", Value: ""},
		{Key: "installation_public_address", Value: ""},
		{Key: "distributed_worker_count_target", Value: "0"},
	}

	for _, s := range defaultSettings {
		var count int64
		DB.Model(&models.Setting{}).Where("key = ?", s.Key).Count(&count)
		if count == 0 {
			DB.Create(&s)
		}
	}

	// Default Worker Group
	var wgCount int64
	DB.Model(&models.WorkerGroup{}).Count(&wgCount)
	if wgCount == 0 {
		DB.Create(&models.WorkerGroup{
			Name:  "Default",
			Count: 4,
		})
	}
}
