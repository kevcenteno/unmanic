package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"muxmill/db"
	"muxmill/models"
	"muxmill/services"
)

// GetLibraries returns all Library records as JSON
func GetLibraries(c *gin.Context) {
	var libs []models.Library
	if err := db.DB.Preload("Pipeline").Find(&libs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch libraries"})
		return
	}
	c.JSON(http.StatusOK, libs)
}

// CreateLibrary creates a new Library from JSON
func CreateLibrary(c *gin.Context) {
	var lib models.Library
	if err := c.ShouldBindJSON(&lib); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := db.DB.Create(&lib).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create library"})
		return
	}

	c.JSON(http.StatusCreated, lib)
}

// UpdateLibrary updates an existing Library based on ID
func UpdateLibrary(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var lib models.Library
	if err := db.DB.First(&lib, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "library not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch library"})
		return
	}

	if err := c.ShouldBindJSON(&lib); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := db.DB.Save(&lib).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update library"})
		return
	}

	c.JSON(http.StatusOK, lib)
}

// TriggerLibraryScan triggers a rescan of all enabled libraries
func TriggerLibraryScan(c *gin.Context) {
	services.GetScanner().Trigger()
	c.JSON(http.StatusOK, gin.H{"message": "library rescan triggered successfully"})
}

// GetScannerStatus returns the current status of the library scanner
func GetScannerStatus(c *gin.Context) {
	status := services.GetScanner().GetStatus()
	c.JSON(http.StatusOK, status)
}

// DeleteLibrary removes a library by :id
func DeleteLibrary(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var lib models.Library
	if err := db.DB.First(&lib, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "library not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch library"})
		return
	}

	// Remove associated tasks first
	if err := db.DB.Unscoped().Where("library_id = ?", id).Delete(&models.Task{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete associated tasks"})
		return
	}

	// Remove associated history first (CompletedTask)
	// We use the library path to find history records since they don't have a direct LibraryID foreign key.
	if err := db.DB.Unscoped().Where("abspath LIKE ?", lib.Path+"%").Delete(&models.CompletedTask{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete associated history"})
		return
	}

	// Perform a hard delete of the library
	if err := db.DB.Unscoped().Delete(&lib).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete library"})
		return
	}

	c.Status(http.StatusOK)
}
