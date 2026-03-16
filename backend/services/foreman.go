package services

import (
	"context"
	"log"
	"muxmill/db"
	"muxmill/models"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Foreman struct {
	workChan      chan models.Task
	mu            sync.Mutex
	triggerChan   chan bool
	isPaused      bool
	pausedWorkers map[string]bool
	cancelFuncs   map[string]context.CancelFunc
	activeStats   map[string]ActiveWorkerStat
	workerSignals map[string]chan string
}

var (
	foremanInstance *Foreman
	foremanOnce     sync.Once
)

func GetForeman() *Foreman {
	foremanOnce.Do(func() {
		foremanInstance = &Foreman{
			workChan:      make(chan models.Task),
			triggerChan:   make(chan bool, 1),
			pausedWorkers: make(map[string]bool),
			cancelFuncs:   make(map[string]context.CancelFunc),
			activeStats:   make(map[string]ActiveWorkerStat),
			workerSignals: make(map[string]chan string),
		}
	})
	return foremanInstance
}

func (f *Foreman) GetWorkerSignalChan(name string) chan string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if ch, ok := f.workerSignals[name]; ok {
		return ch
	}
	ch := make(chan string, 10)
	f.workerSignals[name] = ch
	return ch
}

func (f *Foreman) SetWorkerPaused(name string, paused bool) {
	f.mu.Lock()
	f.pausedWorkers[name] = paused
	f.mu.Unlock()
	log.Printf("Worker %s paused status set to: %v", name, paused)

	// Notify the worker if it's currently running via its signal channel
	sigChan := f.GetWorkerSignalChan(name)
	if paused {
		select {
		case sigChan <- "PAUSE":
		default:
		}
		GetHub().Publish("WORKER_PAUSE_SIGNAL", name)
	} else {
		select {
		case sigChan <- "RESUME":
		default:
		}
		GetHub().Publish("WORKER_RESUME_SIGNAL", name)
	}

	GetHub().Publish("WORKER_UPDATE", GetFullStatus().Workers)
}

func (f *Foreman) IsWorkerPaused(name string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.pausedWorkers[name]
}

func (f *Foreman) GetPausedWorkers() map[string]bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	pausedCopy := make(map[string]bool)
	for k, v := range f.pausedWorkers {
		pausedCopy[k] = v
	}
	return pausedCopy
}

func (f *Foreman) KillWorker(name string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if cancel, ok := f.cancelFuncs[name]; ok {
		log.Printf("Killing specific worker: %s", name)
		cancel()
	}
}

func (f *Foreman) UpdateWorkerStat(workerName string, stat ActiveWorkerStat) {
	f.mu.Lock()
	f.activeStats[workerName] = stat
	f.mu.Unlock()
}

func (f *Foreman) ClearWorkerStat(workerName string) {
	f.mu.Lock()
	delete(f.activeStats, workerName)
	f.mu.Unlock()
}

func (f *Foreman) GetWorkerStats() map[string]ActiveWorkerStat {
	f.mu.Lock()
	defer f.mu.Unlock()
	// Return a copy to avoid race conditions
	statsCopy := make(map[string]ActiveWorkerStat)
	for k, v := range f.activeStats {
		statsCopy[k] = v
	}
	return statsCopy
}

func (f *Foreman) Start() {
	log.Println("Starting Foreman service...")

	// 0. Task and Cache Cleanup on Startup
	f.cleanupTasks()
	f.cleanupCache()

	// 1. Determine capacity from settings
	var wg models.WorkerGroup
	db.DB.First(&wg) // Just take the first for now
	capacity := wg.Count
	if capacity <= 0 {
		capacity = 1
	}

	// 2. Start Workers
	for i := 0; i < capacity; i++ {
		go startWorker(i+1, f.workChan)
	}

	// 3. Dispatch Loop
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				f.dispatch()
			case <-f.triggerChan:
				f.dispatch()
			}
		}
	}()
}

func (f *Foreman) cleanupCache() {
	// 1. Get all unique cache paths from pipelines
	var paths []string
	db.DB.Model(&models.Pipeline{}).Pluck("cache_path", &paths)

	// 2. Add global cache path
	var globalSetting models.Setting
	db.DB.Where("key = ?", "cache_path").First(&globalSetting)
	if globalSetting.Value != "" {
		paths = append(paths, globalSetting.Value)
	}

	// 3. De-duplicate paths
	uniquePaths := make(map[string]bool)
	for _, p := range paths {
		if p != "" {
			uniquePaths[p] = true
		}
	}

	// 4. Scan each path for muxmill_task_* files
	for path := range uniquePaths {
		files, err := os.ReadDir(path)
		if err != nil {
			continue
		}

		count := 0
		for _, file := range files {
			if !file.IsDir() && strings.HasPrefix(file.Name(), "muxmill_task_") {
				err := os.Remove(filepath.Join(path, file.Name()))
				if err == nil {
					count++
				}
			}
		}
		if count > 0 {
			log.Printf("Cleaned up %d stale temp files from %s", count, path)
		}
	}
}

func (f *Foreman) cleanupTasks() {
	// Mark all 'in_progress' tasks as 'pending' because the app just restarted
	res := db.DB.Model(&models.Task{}).Where("status = ?", "in_progress").Update("status", "pending")
	if res.RowsAffected > 0 {
		log.Printf("Reset %d 'in_progress' tasks to 'pending' on startup", res.RowsAffected)
	}

	// Check if we should clear all pending tasks on restart
	var clearSetting models.Setting
	db.DB.Where("key = ?", "clear_pending_tasks_on_restart").First(&clearSetting)
	if clearSetting.Value == "true" {
		res := db.DB.Unscoped().Where("status = ?", "pending").Delete(&models.Task{})
		if res.RowsAffected > 0 {
			log.Printf("Cleared %d pending tasks on startup as per setting", res.RowsAffected)
		}
	}
}

func (f *Foreman) Trigger() {
	select {
	case f.triggerChan <- true:
	default:
	}
}

func (f *Foreman) SetPaused(paused bool) {
	f.mu.Lock()
	f.isPaused = paused
	f.mu.Unlock()
	log.Printf("Foreman paused status set to: %v", paused)
	GetHub().Publish("WORKER_UPDATE", GetFullStatus().Workers)
}

func (f *Foreman) IsPaused() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.isPaused
}

func (f *Foreman) RegisterCancelFunc(workerName string, cancel context.CancelFunc) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.cancelFuncs[workerName] = cancel
}

func (f *Foreman) UnregisterCancelFunc(workerName string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.cancelFuncs, workerName)
}

func (f *Foreman) KillAll() {
	f.mu.Lock()
	defer f.mu.Unlock()
	log.Printf("Killing all %d active workers", len(f.cancelFuncs))
	for name, cancel := range f.cancelFuncs {
		log.Printf("Killing worker: %s", name)
		cancel()
	}
}

func (f *Foreman) dispatch() {
	f.mu.Lock()
	if f.isPaused {
		f.mu.Unlock()
		return
	}
	f.mu.Unlock()

	// Find how many tasks are already in progress
	var activeCount int64
	db.DB.Model(&models.Task{}).Where("status = ?", "in_progress").Count(&activeCount)

	// Determine capacity
	var wg models.WorkerGroup
	db.DB.First(&wg)
	capacity := int64(wg.Count)

	if activeCount >= capacity {
		return
	}

	// Pull next batch of pending tasks
	var tasks []models.Task
	needed := capacity - activeCount
	db.DB.Where("status = ?", "pending").Order("priority desc, id asc").Limit(int(needed)).Find(&tasks)

	for _, task := range tasks {
		// Send to work channel
		// This will block if all workers are currently busy with previous tasks
		// but since we checked activeCount, it should be fine.
		f.workChan <- task
	}
}
