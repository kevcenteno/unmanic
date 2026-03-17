package services

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"muxmill/db"
	"muxmill/models"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

func startWorker(id int, workChan <-chan models.Task) {
	workerName := fmt.Sprintf("worker-%d", id)
	log.Printf("Worker %s started", workerName)

	for {
		// Check if this specific worker is paused
		if GetForeman().IsWorkerPaused(workerName) {
			time.Sleep(2 * time.Second)
			continue
		}

		select {
		case task, ok := <-workChan:
			if !ok {
				return // Channel closed
			}
			processTask(workerName, task)
		case <-time.After(time.Second):
			// Just a timeout to loop back and re-check pause state
			continue
		}
	}
}

func processTask(workerName string, task models.Task) {
	// Create a cancelable context for this worker
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	GetForeman().RegisterCancelFunc(workerName, cancel)
	defer GetForeman().UnregisterCancelFunc(workerName)

	// 1. Mark task as in_progress
	task.Status = "in_progress"
	task.ProcessedByWorker = workerName
	task.StartTime = time.Now()
	db.DB.Save(&task)
	GetHub().Publish("TASKS_UPDATE", nil) // Trigger UI refresh

	log.Printf("[%s] Processing task: %s", workerName, task.Abspath)

	// 2. Prepare paths
	var lib models.Library
	db.DB.Preload("Pipeline").First(&lib, task.LibraryID)

	cacheDir := lib.Pipeline.CachePath
	if cacheDir == "" {
		var setting models.Setting
		db.DB.Where("key = ?", "cache_path").First(&setting)
		cacheDir = setting.Value
	}
	os.MkdirAll(cacheDir, 0755)

	ext := task.FFmpegSettings.Container
	if ext == "original" || ext == "" {
		ext = strings.TrimPrefix(filepath.Ext(task.Abspath), ".")
	}
	tempOutput := filepath.Join(cacheDir, fmt.Sprintf("muxmill_task_%d.%s", task.ID, ext))
	defer os.Remove(tempOutput)

	// 3. Construct FFmpeg command
	var args []string

	if task.FFmpegSettings.CustomMainOptions != "" {
		args = append(args, strings.Fields(task.FFmpegSettings.CustomMainOptions)...)
	}

	args = append(args, "-y", "-i", task.Abspath)

	if task.FFmpegSettings.CustomAdvancedOptions != "" {
		args = append(args, strings.Fields(task.FFmpegSettings.CustomAdvancedOptions)...)
	}

	args = append(args, "-map", "0", "-c", "copy")

	videoFlags := strings.Fields(task.FFmpegSettings.VideoFlags)
	args = append(args, videoFlags...)
	args = append(args, tempOutput)

	ffmpegCommand := "ffmpeg " + strings.Join(args, " ")
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		handleTaskFailure(task, fmt.Sprintf("Failed to start FFmpeg: %v", err), ffmpegCommand)
		return
	}

	// 4. Monitoring & Signal Handling
	var cache models.FileMetadataCache
	db.DB.Where("abspath = ?", task.Abspath).First(&cache)
	totalDuration := cache.Metadata.Duration

	stat := ActiveWorkerStat{
		WorkerName:    workerName,
		TaskID:        task.ID,
		Abspath:       task.Abspath,
		StartTime:     task.StartTime,
		FFmpegCommand: ffmpegCommand,
	}

	// Register stat immediately so UI sees the worker as active
	GetForeman().UpdateWorkerStat(workerName, stat)
	GetHub().Publish("WORKER_UPDATE", GetFullStatus().Workers)

	timeRe := regexp.MustCompile(`time=(\d{2}):(\d{2}):(\d{2}\.\d+)`)
	speedRe := regexp.MustCompile(`speed=\s*(\d+\.\d+)x`)

	logBuffer := ""
	scanner := bufio.NewScanner(stderr)
	scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := bytes.IndexAny(data, "\r\n"); i >= 0 {
			return i + 1, data[0:i], nil
		}
		if atEOF {
			return len(data), data, nil
		}
		return 0, nil, nil
	})

	lineChan := make(chan string)
	go func() {
		for scanner.Scan() {
			lineChan <- scanner.Text()
		}
		close(lineChan)
	}()

	sigChan := GetForeman().GetWorkerSignalChan(workerName)
	logDone := make(chan bool)

	go func() {
		defer close(logDone)
		var proc *process.Process
		if cmd.Process != nil {
			proc, _ = process.NewProcess(int32(cmd.Process.Pid))
		}

		lastUpdate := time.Now()
		var pauseStartTime time.Time
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		for {
			select {
			case sig := <-sigChan:
				if sig == "PAUSE" && !stat.IsPaused {
					stat.IsPaused = true
					pauseStartTime = time.Now()
					if proc != nil {
						suspendRecursive(proc)
					}
					GetForeman().UpdateWorkerStat(workerName, stat)
					GetHub().Publish("WORKER_UPDATE", GetFullStatus().Workers)
				} else if sig == "RESUME" && stat.IsPaused {
					stat.IsPaused = false
					stat.TotalPausedTime += time.Since(pauseStartTime).Seconds()
					if proc != nil {
						resumeRecursive(proc)
					}
					GetForeman().UpdateWorkerStat(workerName, stat)
					GetHub().Publish("WORKER_UPDATE", GetFullStatus().Workers)
				}
			case line, ok := <-lineChan:
				if !ok {
					return
				}
				logBuffer += line + "\n"
				stat.CurrentLog = line

				if matches := timeRe.FindStringSubmatch(line); len(matches) == 4 {
					h, _ := strconv.ParseFloat(matches[1], 64)
					m, _ := strconv.ParseFloat(matches[2], 64)
					s, _ := strconv.ParseFloat(matches[3], 64)
					currentTime := (h * 3600) + (m * 60) + s

					if totalDuration > 0 {
						stat.Percentage = (currentTime / totalDuration) * 100
						if stat.Percentage > 100 {
							stat.Percentage = 100
						}
						if speedMatches := speedRe.FindStringSubmatch(line); len(speedMatches) == 2 {
							speed, _ := strconv.ParseFloat(speedMatches[1], 64)
							if speed > 0 {
								stat.ETA = (totalDuration - currentTime) / speed
							}
						}
					}
				}

				// Throttle WebSocket updates from logs
				if time.Since(lastUpdate) >= time.Second {
					stat.Elapsed = time.Since(task.StartTime).Seconds() - stat.TotalPausedTime
					GetForeman().UpdateWorkerStat(workerName, stat)
					GetHub().Publish("WORKER_UPDATE", GetFullStatus().Workers)
					lastUpdate = time.Now()
				}
			case <-ticker.C:
				if stat.IsPaused {
					continue
				}
				stat.Elapsed = time.Since(task.StartTime).Seconds() - stat.TotalPausedTime

				// Get CPU/Mem if possible
				if proc != nil {
					if cpu, err := proc.CPUPercent(); err == nil {
						stat.CPUUsage = cpu
					}
					if memInfo, err := proc.MemoryInfo(); err == nil {
						stat.MemUsage = float64(memInfo.RSS) / (1024 * 1024) // MB
					}
				}

				GetForeman().UpdateWorkerStat(workerName, stat)
				GetHub().Publish("WORKER_UPDATE", GetFullStatus().Workers)
				lastUpdate = time.Now()
			}
		}
	}()

	err := cmd.Wait()
	<-logDone

	if err != nil {
		GetForeman().ClearWorkerStat(workerName)
		handleTaskFailure(task, fmt.Sprintf("FFmpeg error: %v\n\nLog:\n%s", err, logBuffer), ffmpegCommand)
		return
	}

	// 5. Success Checks (Size rejection)
	newInfo, err := os.Stat(tempOutput)
	if err != nil {
		handleTaskFailure(task, "Output file not found after processing", ffmpegCommand)
		return
	}

	if lib.Pipeline.RejectLargerFiles && newInfo.Size() > task.OriginalSize {
		handleTaskFailure(task, fmt.Sprintf("Rejected: Output file (%d bytes) is larger than input (%d bytes)", newInfo.Size(), task.OriginalSize), ffmpegCommand)
		return
	}

	// 6. Move/Finalize
	destPath := task.Abspath
	if lib.Pipeline.RelocatePath != "" {
		os.MkdirAll(lib.Pipeline.RelocatePath, 0755)
		destPath = filepath.Join(lib.Pipeline.RelocatePath, filepath.Base(task.Abspath))
	}
	if destPath == task.Abspath {
		os.Remove(task.Abspath)
	}

	if err := moveFile(tempOutput, destPath); err != nil {
		handleTaskFailure(task, fmt.Sprintf("Failed to move output file: %v", err), ffmpegCommand)
		return
	}

	// 7. Complete Task
	completed := models.CompletedTask{
		TaskLabel:         filepath.Base(task.Abspath),
		Abspath:           destPath,
		OriginalPath:      task.Abspath,
		OriginalSize:      task.OriginalSize,
		NewSize:           newInfo.Size(),
		TaskSuccess:       true,
		StartTime:         task.StartTime,
		FinishTime:        time.Now(),
		ProcessedByWorker: workerName,
		FFmpegCommand:     ffmpegCommand,
		Log:               logBuffer,
		LibraryID:         &lib.ID,
	}
	if task.ProfileID != 0 {
		profileID := task.ProfileID
		completed.ProfileID = &profileID
	}
	db.DB.Create(&completed)
	db.DB.Unscoped().Delete(&task)
	GetForeman().ClearWorkerStat(workerName)
	GetHub().Publish("TASKS_UPDATE", nil)
}

func suspendRecursive(p *process.Process) {
	p.Suspend()
	children, _ := p.Children()
	for _, child := range children {
		suspendRecursive(child)
	}
}

func resumeRecursive(p *process.Process) {
	p.Resume()
	children, _ := p.Children()
	for _, child := range children {
		resumeRecursive(child)
	}
}

func moveFile(sourcePath, destPath string) error {
	err := os.Rename(sourcePath, destPath)
	if err == nil {
		return nil
	}
	input, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer output.Close()
	_, err = io.Copy(output, input)
	if err != nil {
		return err
	}
	input.Close()
	output.Close()
	return os.Remove(sourcePath)
}

func handleTaskFailure(task models.Task, errorMsg string, ffmpegCommand string) {
	summary := strings.Split(errorMsg, "\n")[0]
	log.Printf("Task failed: %s - %s", task.Abspath, summary)

	// Suppress history creation if this task's library is being deleted
	if !GetForeman().IsLibraryDeleting(task.LibraryID) {
		completed := models.CompletedTask{
			TaskLabel:         filepath.Base(task.Abspath),
			Abspath:           task.Abspath,
			OriginalPath:      task.Abspath,
			OriginalSize:      task.OriginalSize,
			TaskSuccess:       false,
			StartTime:         task.StartTime,
			FinishTime:        time.Now(),
			ProcessedByWorker: task.ProcessedByWorker,
			FFmpegCommand:     ffmpegCommand,
			Log:               errorMsg,
			LibraryID:         nil,
		}
		libID := task.LibraryID
		completed.LibraryID = &libID
		if task.ProfileID != 0 {
			profileID := task.ProfileID
			completed.ProfileID = &profileID
		}
		db.DB.Create(&completed)
	}
	db.DB.Unscoped().Delete(&task)
	GetForeman().ClearWorkerStat(task.ProcessedByWorker)
	GetHub().Publish("TASKS_UPDATE", nil)
}
