package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"muxmill/db"
	"muxmill/models"
)

type PaginatedResponse struct {
	RecordsTotal    int64       `json:"recordsTotal"`
	RecordsFiltered int64       `json:"recordsFiltered"`
	Results         interface{} `json:"results"`
}

// GetPendingTasks returns tasks whose Status is not 'processed' with pagination and filtering
func GetPendingTasks(c *gin.Context) {
	startStr := c.DefaultQuery("start", "0")
	lengthStr := c.DefaultQuery("length", "10")
	search := c.Query("search")
	libraryIDs := c.QueryArray("library_id")

	start, _ := strconv.Atoi(startStr)
	length, _ := strconv.Atoi(lengthStr)

	var tasks []models.Task
	query := db.DB.Model(&models.Task{}).Where("status != ?", "processed").
		Preload("Library").
		Preload("Library.Pipeline").
		Preload("Profile")

	var total int64
	db.DB.Model(&models.Task{}).Where("status != ?", "processed").Count(&total)

	if search != "" {
		query = query.Where("abspath LIKE ?", "%"+search+"%")
	}

	if len(libraryIDs) > 0 {
		query = query.Where("library_id IN ?", libraryIDs)
	}

	var filtered int64
	query.Count(&filtered)

	if err := query.Order("priority desc, id asc").Offset(start).Limit(length).Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pending tasks"})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		RecordsTotal:    total,
		RecordsFiltered: filtered,
		Results:         tasks,
	})
}

// GetHistoryTasks returns all completed tasks with pagination and filtering
func GetHistoryTasks(c *gin.Context) {
	startStr := c.DefaultQuery("start", "0")
	lengthStr := c.DefaultQuery("length", "10")
	search := c.Query("search")
	status := c.Query("status") // success or fail

	start, _ := strconv.Atoi(startStr)
	length, _ := strconv.Atoi(lengthStr)

	var tasks []models.CompletedTask
	query := db.DB.Model(&models.CompletedTask{})

	var total int64
	db.DB.Model(&models.CompletedTask{}).Count(&total)

	if search != "" {
		query = query.Where("abspath LIKE ? OR task_label LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	if status == "success" {
		query = query.Where("task_success = ?", true)
	} else if status == "fail" {
		query = query.Where("task_success = ?", false)
	}

	var filtered int64
	query.Count(&filtered)

	if err := query.Order("finish_time desc").Offset(start).Limit(length).Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch history tasks"})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		RecordsTotal:    total,
		RecordsFiltered: filtered,
		Results:         tasks,
	})
}

// RemovePendingTask deletes a pending task by :id
func RemovePendingTask(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	res := db.DB.Unscoped().Delete(&models.Task{}, id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete task"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	c.Status(http.StatusOK)
}

// ClearHistory truncates the completed tasks table
func ClearHistory(c *gin.Context) {
	if err := db.DB.Exec("DELETE FROM completed_tasks").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear history"})
		return
	}
	c.Status(http.StatusOK)
}

type BulkActionRequest struct {
	Action  string   `json:"action" binding:"required"`
	TaskIDs []uint64 `json:"task_ids" binding:"required"`
}

// BulkActionPendingTasks performs operations on multiple tasks at once
func BulkActionPendingTasks(c *gin.Context) {
	var req BulkActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.TaskIDs) == 0 {
		c.Status(http.StatusOK)
		return
	}

	tx := db.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}

	switch req.Action {
	case "move_top":
		var maxPriority int
		tx.Model(&models.Task{}).Where("status != ?", "processed").Select("COALESCE(MAX(priority), 0)").Scan(&maxPriority)
		newPriority := maxPriority + 1
		if err := tx.Model(&models.Task{}).Where("id IN ?", req.TaskIDs).Update("priority", newPriority).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to move tasks to top"})
			return
		}
	case "move_bottom":
		// Set to 0 priority so it goes to bottom (or lower depending on current queue).
		if err := tx.Model(&models.Task{}).Where("id IN ?", req.TaskIDs).Update("priority", 0).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to move tasks to bottom"})
			return
		}
	case "remove":
		// Find tasks to copy them to history
		var tasks []models.Task
		if err := tx.Where("id IN ?", req.TaskIDs).Find(&tasks).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tasks for removal"})
			return
		}

		// Insert into completed_tasks
		var completed []models.CompletedTask
		for _, t := range tasks {
			completed = append(completed, models.CompletedTask{
				TaskLabel:    "Cancelled",
				Abspath:      t.Abspath,
				OriginalSize: t.OriginalSize,
				TaskSuccess:  false,
				Log:          "Task cancelled by user via bulk action to prevent rescanning.",
			})
		}
		if len(completed) > 0 {
			if err := tx.Create(&completed).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record cancelled tasks"})
				return
			}
		}

		// Delete from tasks
		if err := tx.Where("id IN ?", req.TaskIDs).Unscoped().Delete(&models.Task{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete tasks"})
			return
		}
	default:
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid action"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}

	c.Status(http.StatusOK)
}

// BulkActionHistoryTasks performs operations on multiple history tasks at once
func BulkActionHistoryTasks(c *gin.Context) {
	var req BulkActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.TaskIDs) == 0 {
		c.Status(http.StatusOK)
		return
	}

	tx := db.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}

	switch req.Action {
	case "remove":
		if err := tx.Where("id IN ?", req.TaskIDs).Unscoped().Delete(&models.CompletedTask{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete tasks"})
			return
		}
	case "requeue":
		var completedTasks []models.CompletedTask
		if err := tx.Where("id IN ?", req.TaskIDs).Find(&completedTasks).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tasks for requeue"})
			return
		}

		var libraries []models.Library
		if err := tx.Preload("Pipeline.Profiles").Find(&libraries).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch libraries"})
			return
		}

		var maxPriority int
		tx.Model(&models.Task{}).Where("status != ?", "processed").Select("COALESCE(MAX(priority), 0)").Scan(&maxPriority)

		for _, ct := range completedTasks {
			// Find matching library
			var matchedLib *models.Library
			for _, lib := range libraries {
				if strings.HasPrefix(ct.Abspath, lib.Path) {
					// Need a pointer, taking address of iterator var is tricky in Go <1.22, but we can index
					matchedLib = new(models.Library)
					*matchedLib = lib
					break
				}
			}

			if matchedLib == nil || matchedLib.Pipeline == nil {
				continue // Skip if no longer in a managed library with a pipeline
			}

			// Get metadata
			var cache models.FileMetadataCache
			if err := tx.Where("abspath = ?", ct.Abspath).First(&cache).Error; err != nil {
				continue // Could probe here, but keeping it simple/safe within a web request transaction.
			}

			// Find profile
			matchingProfile := models.GetMatchingProfile(cache.Metadata, *matchedLib.Pipeline)
			if matchingProfile == nil {
				continue
			}

			maxPriority++

			newTask := models.Task{
				Abspath:        ct.Abspath,
				OriginalSize:   ct.OriginalSize,
				Priority:       maxPriority,
				Type:           "file",
				LibraryID:      matchedLib.ID,
				Status:         "pending",
				ProfileID:      matchingProfile.ID,
				FFmpegSettings: matchingProfile.FFmpegSettings,
			}

			if err := tx.Create(&newTask).Error; err != nil {
				// Ignore constraint errors (e.g., already pending)
				continue
			}
		}

		// Delete from completed_tasks
		if err := tx.Where("id IN ?", req.TaskIDs).Unscoped().Delete(&models.CompletedTask{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove from history"})
			return
		}

	default:
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid action"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}

	c.Status(http.StatusOK)
}