package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"muxmill/db"
	"muxmill/models"
)

// GetSettings returns all key/value settings
func GetSettings(c *gin.Context) {
	var settings []models.Setting
	if err := db.DB.Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch settings"})
		return
	}
	// return as-is
	c.JSON(http.StatusOK, settings)
}

// UpdateSetting accepts an array of settings and updates them
func UpdateSetting(c *gin.Context) {
	var settings []models.Setting
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// perform updates inside a transaction
	err := db.DB.Transaction(func(tx *gorm.DB) error {
		for _, s := range settings {
			res := tx.Model(&models.Setting{}).Where("key = ?", s.Key).Update("value", s.Value)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				// if any setting is not found, rollback with NotFound
				return gorm.ErrRecordNotFound
			}
		}
		return nil
	})

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "one or more settings not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update settings"})
		return
	}

	c.Status(http.StatusOK)
}

// GetWorkerStatus returns a mock worker status
func GetWorkerStatus(c *gin.Context) {
	// Calculate total threads from worker_groups (sum of count)
	var total int64
	// Use a struct to handle nullable sum result from SQLite
	var result struct {
		Sum int64
	}
	if err := db.DB.Model(&models.WorkerGroup{}).Select("COALESCE(sum(count), 0) as sum").Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch worker groups"})
		return
	}
	total = result.Sum

	// Count active tasks (status = 'in_progress')
	var active int64
	if err := db.DB.Model(&models.Task{}).Where("status = ?", "in_progress").Count(&active).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count active tasks"})
		return
	}

	idle := total - active
	if idle < 0 {
		idle = 0
	}

	status := gin.H{"active": active, "idle": idle}
	c.JSON(http.StatusOK, status)
}

// GetWorkerGroups returns all WorkerGroup records
func GetWorkerGroups(c *gin.Context) {
	var groups []models.WorkerGroup
	if err := db.DB.Find(&groups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch worker groups"})
		return
	}
	c.JSON(http.StatusOK, groups)
}

// CreateWorkerGroup creates a new WorkerGroup
func CreateWorkerGroup(c *gin.Context) {
	var input struct {
		Name  string `json:"name" binding:"required"`
		Count int    `json:"count" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	group := models.WorkerGroup{
		Name:  input.Name,
		Count: input.Count,
	}

	if err := db.DB.Create(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create worker group"})
		return
	}

	c.JSON(http.StatusCreated, group)
}

// UpdateWorkerGroup updates a WorkerGroup by :id
func UpdateWorkerGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var group models.WorkerGroup
	if err := db.DB.First(&group, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "worker group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch worker group"})
		return
	}

	var input struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// update allowed fields
	if input.Name != "" {
		group.Name = input.Name
	}
	if input.Count != 0 {
		group.Count = input.Count
	}

	if err := db.DB.Save(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update worker group"})
		return
	}

	c.JSON(http.StatusOK, group)
}

// DeleteWorkerGroup removes a WorkerGroup by :id
func DeleteWorkerGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var group models.WorkerGroup
	if err := db.DB.First(&group, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "worker group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch worker group"})
		return
	}

	if err := db.DB.Delete(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete worker group"})
		return
	}

	c.Status(http.StatusOK)
}
