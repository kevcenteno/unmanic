package handlers

import (
	"net/http"
	"strconv"

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
	query := db.DB.Model(&models.Task{}).Where("status != ?", "processed")

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

	res := db.DB.Delete(&models.Task{}, id)
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