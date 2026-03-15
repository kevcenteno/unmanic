package services

import (
	"muxmill/db"
	"muxmill/models"
	"time"
)

type FullStatus struct {
	Scanner   ScannerStatus   `json:"scanner"`
	Workers   WorkerStatus    `json:"workers"`
	Pending   []models.Task   `json:"pending"`
	History   []models.CompletedTask `json:"history"`
	Timestamp time.Time       `json:"timestamp"`
}

type WorkerStatus struct {
	Active int64 `json:"active"`
	Idle   int64 `json:"idle"`
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

	// 3. Pending Tasks (Top 10)
	var pending []models.Task
	db.DB.Model(&models.Task{}).Where("status != ?", "processed").Order("priority desc, id asc").Limit(10).Find(&pending)

	// 4. History (Top 10)
	var history []models.CompletedTask
	db.DB.Model(&models.CompletedTask{}).Order("finish_time desc").Limit(10).Find(&history)

	return FullStatus{
		Scanner:   scannerStatus,
		Workers:   WorkerStatus{Active: active, Idle: idle},
		Pending:   pending,
		History:   history,
		Timestamp: time.Now(),
	}
}
