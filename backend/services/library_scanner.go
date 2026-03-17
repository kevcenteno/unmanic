package services

import (
	"encoding/json"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"muxmill/db"
	"muxmill/models"

	"gorm.io/gorm/clause"
)

const metadataBatchSize = 50

var (
	scannerInstance *LibraryScanner
	once            sync.Once
)

type LibraryScanner struct {
	triggerChan    chan bool
	isScanning     bool
	mu             sync.Mutex
	TotalFiles     int    `json:"total_files"`
	FilesProbed    int    `json:"files_probed"`
	TasksCreated   int    `json:"tasks_created"`
	CurrentLibrary string `json:"current_library"`
}

type ScannerStatus struct {
	IsScanning     bool   `json:"is_scanning"`
	TotalFiles     int    `json:"total_files"`
	FilesProbed    int    `json:"files_probed"`
	TasksCreated   int    `json:"tasks_created"`
	CurrentLibrary string `json:"current_library"`
}

func GetScanner() *LibraryScanner {
	once.Do(func() {
		scannerInstance = &LibraryScanner{
			triggerChan: make(chan bool, 1),
		}
	})
	return scannerInstance
}

func (s *LibraryScanner) Start() {
	log.Println("Starting Library Scanner service...")
	go func() {
		for range s.triggerChan {
			s.runScan()
		}
	}()

	// Also run a scan on startup
	s.Trigger()
}

func (s *LibraryScanner) Trigger() {
	select {
	case s.triggerChan <- true:
	default:
		// Scan already triggered/pending
	}
}

// IsScanning returns the current state of the scanner
func (s *LibraryScanner) IsScanning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.isScanning
}

// GetStatus returns the current status of the scanner
func (s *LibraryScanner) GetStatus() ScannerStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	return ScannerStatus{
		IsScanning:     s.isScanning,
		TotalFiles:     s.TotalFiles,
		FilesProbed:    s.FilesProbed,
		TasksCreated:   s.TasksCreated,
		CurrentLibrary: s.CurrentLibrary,
	}
}

type ffprobeOutput struct {
	Streams []struct {
		CodecName string `json:"codec_name"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
		BitRate   string `json:"bit_rate"`
	} `json:"streams"`
	Format struct {
		BitRate  string `json:"bit_rate"`
		Duration string `json:"duration"`
	} `json:"format"`
}

// getMetadata uses ffprobe to get metadata for a file
func getMetadata(path string) models.VideoMetadata {
	metadata := models.VideoMetadata{}

	args := []string{
		"-loglevel", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		path,
	}

	cmd := exec.Command("ffprobe", args...)
	out, err := cmd.Output()
	if err != nil {
		log.Printf("Scanner: ffprobe failed for %s: %v\n", path, err)
		return metadata
	}

	var probe ffprobeOutput
	if err := json.Unmarshal(out, &probe); err != nil {
		log.Printf("Scanner: failed to parse ffprobe output for %s: %v\n", path, err)
		return metadata
	}

	// Extract video stream info
	for _, stream := range probe.Streams {
		if stream.Width > 0 {
			metadata.Width = stream.Width
			metadata.Height = stream.Height
			metadata.Resolution = strconv.Itoa(stream.Width) + "x" + strconv.Itoa(stream.Height)
			metadata.Codec = stream.CodecName
			if stream.BitRate != "" {
				br, _ := strconv.Atoi(stream.BitRate)
				metadata.Bitrate = br / 1000 // Convert to kbps
			}
			break
		}
	}

	// If stream bitrate is missing, use format bitrate
	if metadata.Bitrate == 0 && probe.Format.BitRate != "" {
		br, _ := strconv.Atoi(probe.Format.BitRate)
		metadata.Bitrate = br / 1000
	}

	if probe.Format.Duration != "" {
		dur, _ := strconv.ParseFloat(probe.Format.Duration, 64)
		metadata.Duration = dur
	}

	return metadata
}

type scanWorkItem struct {
	abspath string
	lib     models.Library
	task    *models.Task // If re-evaluating existing task
}

func (s *LibraryScanner) runScan() {
	s.mu.Lock()
	if s.isScanning {
		s.mu.Unlock()
		return
	}
	s.isScanning = true
	s.TotalFiles = 0
	s.FilesProbed = 0
	s.TasksCreated = 0
	s.CurrentLibrary = ""
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isScanning = false
		s.CurrentLibrary = ""
		s.mu.Unlock()
	}()

	startTime := time.Now()
	log.Println("Library scan started...")

	var libraries []models.Library
	if err := db.DB.Preload("Pipeline.Profiles").Where("enable_scanner = ?", true).Find(&libraries).Error; err != nil {
		log.Printf("Scanner: failed to fetch libraries: %v\n", err)
		return
	}

	videoExtensions := map[string]bool{
		".mp4": true, ".mkv": true, ".avi": true, ".mov": true,
		".m4v": true, ".flv": true, ".wmv": true, ".webm": true,
	}

	var allWork []scanWorkItem

	// Phase 1: Discovery & Counting
	for _, lib := range libraries {
		s.mu.Lock()
		s.CurrentLibrary = lib.Name
		s.mu.Unlock()

		if lib.Pipeline == nil {
			db.DB.Where("library_id = ? AND status = ?", lib.ID, "pending").Unscoped().Delete(&models.Task{})
			continue
		}

		// STEP 1: RE-EVALUATE PENDING TASKS
		var pendingTasks []models.Task
		db.DB.Where("library_id = ? AND status = ?", lib.ID, "pending").Order("priority desc").Find(&pendingTasks)
		for _, task := range pendingTasks {
			t := task
			allWork = append(allWork, scanWorkItem{
				abspath: task.Abspath,
				lib:     lib,
				task:    &t,
			})
		}

		// Discover new
		knownPaths := make(map[string]struct{})

		// Helper to normalize and add to knownPaths
		addPath := func(p string) {
			if p == "" {
				return
			}
			abs, err := filepath.Abs(filepath.Clean(p))
			if err == nil {
				knownPaths[abs] = struct{}{}
			} else {
				knownPaths[p] = struct{}{}
			}
		}

		var pendingPaths []string
		db.DB.Model(&models.Task{}).Where("library_id = ?", lib.ID).Pluck("abspath", &pendingPaths)
		for _, p := range pendingPaths {
			addPath(p)
		}

		// Load ALL completed tasks (both successful and failed)
		var completedTasks []models.CompletedTask
		db.DB.Select("abspath", "original_path").Find(&completedTasks)
		for _, ct := range completedTasks {
			addPath(ct.Abspath)
			addPath(ct.OriginalPath)
		}

		filepath.WalkDir(lib.Path, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}

			absPath, _ := filepath.Abs(filepath.Clean(path))

			ext := strings.ToLower(filepath.Ext(absPath))
			if !videoExtensions[ext] {
				return nil
			}
			if _, exists := knownPaths[absPath]; exists {
				return nil
			}
			allWork = append(allWork, scanWorkItem{
				abspath: absPath,
				lib:     lib,
			})
			return nil
		})
	}

	s.mu.Lock()
	s.TotalFiles = len(allWork)
	s.CurrentLibrary = ""
	s.mu.Unlock()

	if s.TotalFiles == 0 {
		log.Println("Scanner: no work found")
		return
	}

	// Phase 2: Probing
	workChan := make(chan scanWorkItem, 100)
	cacheChan := make(chan models.FileMetadataCache, 100)
	var wg sync.WaitGroup
	var cacheWg sync.WaitGroup

	// Start Throttled Event Publisher
	doneChan := make(chan bool)
	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()
		hub := GetHub()
		for {
			select {
			case <-ticker.C:
				hub.Publish("SCAN_PROGRESS", s.GetStatus())
			case <-doneChan:
				hub.Publish("SCAN_PROGRESS", s.GetStatus())
				return
			}
		}
	}()

	// Start Cache Writer Worker (Single thread to prevent SQLite locking)
	cacheWg.Add(1)
	go func() {
		defer cacheWg.Done()
		var batch []models.FileMetadataCache
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		flush := func() {
			if len(batch) > 0 {
				if err := db.DB.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "abspath"}},
					DoUpdates: clause.AssignmentColumns([]string{"mtime", "size", "metadata", "updated_at"}),
				}).Create(&batch).Error; err != nil {
					log.Printf("Scanner Cache: failed to flush batch of %d: %v\n", len(batch), err)
				}
				batch = nil
			}
		}

		for {
			select {
			case item, ok := <-cacheChan:
				if !ok {
					flush()
					return
				}
				batch = append(batch, item)
				if len(batch) >= metadataBatchSize {
					flush()
				}
			case <-ticker.C:
				flush()
			}
		}
	}()

	// Determine number of concurrent probing workers from settings
	numWorkers := getConcurrentFileTesters()

	// Start Probing Workers
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range workChan {
				s.mu.Lock()
				s.CurrentLibrary = item.lib.Name
				s.mu.Unlock()

				// Check Cache first
				info, err := os.Stat(item.abspath)
				if err != nil {
					s.mu.Lock()
					s.FilesProbed++
					s.mu.Unlock()
					continue
				}

				var caches []models.FileMetadataCache
				db.DB.Where("abspath = ?", item.abspath).Limit(1).Find(&caches)

				var metadata models.VideoMetadata
				cacheFound := false
				if len(caches) > 0 {
					cache := caches[0]
					if cache.Mtime == info.ModTime().Unix() && cache.Size == info.Size() {
						metadata = cache.Metadata
						cacheFound = true
					}
				}

				if !cacheFound {
					metadata = getMetadata(item.abspath)
					if metadata.Codec != "" {
						cacheChan <- models.FileMetadataCache{
							Abspath:  item.abspath,
							Mtime:    info.ModTime().Unix(),
							Size:     info.Size(),
							Metadata: metadata,
						}
					}
				}

				s.mu.Lock()
				s.FilesProbed++
				s.mu.Unlock()

				if metadata.Codec == "" {
					if item.task != nil {
						log.Printf("Scanner: could not probe file %s, removing task\n", item.abspath)
						db.DB.Unscoped().Delete(item.task)
					}
					continue
				}

				if item.lib.Pipeline == nil {
					if item.task != nil {
						log.Printf("Scanner: task %s no longer has a pipeline, removing\n", item.abspath)
						db.DB.Unscoped().Delete(item.task)
					}
					continue
				}

				matchingProfile := models.GetMatchingProfile(metadata, *item.lib.Pipeline)
				if matchingProfile == nil {
					if item.task != nil {
						log.Printf("Scanner: task %s no longer matches any profile, removing\n", item.abspath)
						db.DB.Unscoped().Delete(item.task)
					}
					continue
				}

				if item.task != nil {
					// Only update if something changed
					newPriority := item.lib.PriorityScore + matchingProfile.Priority
					changed := item.task.Priority != newPriority ||
						item.task.ProfileID != matchingProfile.ID ||
						item.task.FFmpegSettings.VideoFlags != matchingProfile.FFmpegSettings.VideoFlags ||
						item.task.FFmpegSettings.Container != matchingProfile.FFmpegSettings.Container

					if changed {
						item.task.Priority = newPriority
						item.task.ProfileID = matchingProfile.ID
						item.task.FFmpegSettings = matchingProfile.FFmpegSettings
						db.DB.Save(item.task)
					}
				} else {
					// Create new task
					newTask := models.Task{
						Abspath:        item.abspath,
						OriginalSize:   info.Size(),
						Priority:       item.lib.PriorityScore + matchingProfile.Priority,
						Type:           "file",
						LibraryID:      item.lib.ID,
						Status:         "pending",
						ProfileID:      matchingProfile.ID,
						FFmpegSettings: matchingProfile.FFmpegSettings,
					}
					if err := db.DB.Create(&newTask).Error; err != nil {
						// Concurrent creation might happen
					} else {
						s.mu.Lock()
						s.TasksCreated++
						s.mu.Unlock()
						log.Printf("Scanner: added new task: %s\n", item.abspath)
					}
				}
			}
		}()
	}

	// Feed workers
	for _, work := range allWork {
		workChan <- work
	}

	close(workChan)
	wg.Wait()
	close(cacheChan)
	cacheWg.Wait()
	close(doneChan)

	log.Printf("Library scan completed in %v\n", time.Since(startTime))
	GetForeman().Trigger()
}
