package services

import (
	"muxmill/db"
	"muxmill/models"
	"time"
)

type FullStatus struct {
	Scanner   ScannerStatus          `json:"scanner"`
	Workers   WorkerStatus           `json:"workers"`
	Pending   []models.Task          `json:"pending"`
	History   []models.CompletedTask `json:"history"`
	Timestamp time.Time              `json:"timestamp"`
}

type ActiveWorkerStat struct {
	WorkerName      string    `json:"worker_name"`
	TaskID          uint      `json:"task_id"`
	Abspath         string    `json:"abspath"`
	StartTime       time.Time `json:"start_time"`
	FFmpegCommand   string    `json:"ffmpeg_command"`
	Percentage      float64   `json:"percentage"`
	Elapsed         float64   `json:"elapsed"`           // seconds
	TotalPausedTime float64   `json:"total_paused_time"` // seconds
	ETA             float64   `json:"eta"`               // seconds
	CPUUsage        float64   `json:"cpu_usage"`
	MemUsage        float64   `json:"mem_usage"` // MB
	CurrentLog      string    `json:"current_log"`
	IsPaused        bool      `json:"is_paused"`
}

type WorkerStatus struct {
	Active        int64                       `json:"active"`
	Idle          int64                       `json:"idle"`
	TotalCapacity int64                       `json:"total_capacity"`
	IsPaused      bool                        `json:"is_paused"`
	ActiveStats   map[string]ActiveWorkerStat `json:"active_stats"`
	PausedWorkers map[string]bool             `json:"paused_workers"`
}

func GetFullStatus() FullStatus {
	// 1. Scanner Status
	scannerStatus := GetScanner().GetStatus()

	// 2. Worker Status
	var total int64
	var result struct {
		Sum int64
	}
	db.DB.Model(&models.WorkerGroup{}).Select("COALESCE(sum(count), 0) as sum").Scan(&result)
	total = result.Sum

	var active int64
	db.DB.Model(&models.Task{}).Where("status = ?", "in_progress").Count(&active)

	idle := total - active
	if idle < 0 {
		idle = 0
	}

	return FullStatus{
		Scanner: scannerStatus,
		Workers: WorkerStatus{
			Active:        active,
			Idle:          idle,
			TotalCapacity: total,
			IsPaused:      GetForeman().IsPaused(),
			ActiveStats:   GetForeman().GetWorkerStats(),
			PausedWorkers: GetForeman().GetPausedWorkers(),
		},
		Pending:   getPending(),
		History:   getHistory(),
		Timestamp: time.Now(),
	}
}

func getPending() []models.Task {
	var pending []models.Task
	db.DB.Model(&models.Task{}).Where("status != ?", "processed").
		Preload("Library").
		Preload("Library.Pipeline").
		Preload("Profile").
		Order("priority desc, id asc").Limit(10).Find(&pending)
	return pending
}

func getHistory() []models.CompletedTask {
	var history []models.CompletedTask
	db.DB.Model(&models.CompletedTask{}).Order("finish_time desc").Limit(10).Find(&history)
	return history
}
