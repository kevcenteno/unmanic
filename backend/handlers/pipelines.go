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

// GetPipelines returns all Pipeline records with their Profiles
func GetPipelines(c *gin.Context) {
	var pipelines []models.Pipeline
	if err := db.DB.Preload("Profiles").Find(&pipelines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pipelines"})
		return
	}
	c.JSON(http.StatusOK, pipelines)
}

// GetPipeline returns a single Pipeline by ID
func GetPipeline(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var pipeline models.Pipeline
	if err := db.DB.Preload("Profiles").First(&pipeline, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "pipeline not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pipeline"})
		return
	}
	c.JSON(http.StatusOK, pipeline)
}

// CreatePipeline creates a new Pipeline with its Profiles
func CreatePipeline(c *gin.Context) {
	var pipeline models.Pipeline
	if err := c.ShouldBindJSON(&pipeline); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	if err := db.DB.Create(&pipeline).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create pipeline"})
		return
	}

	c.JSON(http.StatusCreated, pipeline)
}

// UpdatePipeline updates an existing Pipeline and its Profiles
func UpdatePipeline(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var existingPipeline models.Pipeline
	if err := db.DB.First(&existingPipeline, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "pipeline not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pipeline"})
		return
	}

	var input models.Pipeline
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Update pipeline fields
	existingPipeline.Name = input.Name
	existingPipeline.RejectLargerFiles = input.RejectLargerFiles
	existingPipeline.CachePath = input.CachePath
	existingPipeline.RelocatePath = input.RelocatePath

	err = db.DB.Transaction(func(tx *gorm.DB) error {
		// Save pipeline
		if err := tx.Save(&existingPipeline).Error; err != nil {
			return err
		}

		// Delete existing profiles and replace with new ones (simplest approach for amnesiac specialists)
		if err := tx.Where("pipeline_id = ?", id).Delete(&models.Profile{}).Error; err != nil {
			return err
		}

		for i := range input.Profiles {
			input.Profiles[i].PipelineID = uint(id)
			input.Profiles[i].ID = 0 // Ensure new record
			if err := tx.Create(&input.Profiles[i]).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update pipeline"})
		return
	}

	// Fetch updated pipeline with profiles to return
	db.DB.Preload("Profiles").First(&existingPipeline, id)

	// Trigger re-evaluation of pending tasks to apply updated rules immediately
	services.GetScanner().Trigger()

	c.JSON(http.StatusOK, existingPipeline)
}

// DeletePipeline removes a Pipeline and its associated Profiles
func DeletePipeline(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	err = db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("pipeline_id = ?", id).Delete(&models.Profile{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.Pipeline{}, id).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete pipeline"})
		return
	}

	// Trigger re-evaluation so tasks attached to the deleted pipeline are purged
	services.GetScanner().Trigger()

	c.Status(http.StatusOK)
}
