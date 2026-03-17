package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"muxmill/db"
	"muxmill/models"
)

// LibrarySummary is a lightweight per-library totals used for the library list
type LibrarySummary struct {
	LibraryID      uint  `json:"library_id"`
	FilesProcessed int64 `json:"files_processed"`
	OriginalSize   int64 `json:"original_size"`
	NewSize        int64 `json:"new_size"`
}

// ProfileStats holds per-profile aggregated totals
type ProfileStats struct {
	ProfileID      *uint  `json:"profile_id"`
	Name           string `json:"name"`
	FilesProcessed int64  `json:"files_processed"`
	OriginalSize   int64  `json:"original_size"`
	NewSize        int64  `json:"new_size"`
}

// LibraryStatsResponse is the full per-library stats with profile breakdown
type LibraryStatsResponse struct {
	LibraryID      uint           `json:"library_id"`
	LibraryName    string         `json:"library_name"`
	FilesProcessed int64          `json:"files_processed"`
	OriginalSize   int64          `json:"original_size"`
	NewSize        int64          `json:"new_size"`
	Profiles       []ProfileStats `json:"profiles"`
}

// GetAllLibrariesStats returns a lightweight totals summary for every library,
// used to populate the Saved column on the library list page.
func GetAllLibrariesStats(c *gin.Context) {
	type row struct {
		LibraryID uint
		Files     int64
		SumOrig   sql.NullInt64
		SumNew    sql.NullInt64
	}
	var rows []row
	if err := db.DB.Table("completed_tasks").
		Select("library_id, COUNT(*) as files, SUM(original_size) as sum_orig, SUM(new_size) as sum_new").
		Where("task_success = ? AND new_size > 0 AND library_id IS NOT NULL", true).
		Group("library_id").
		Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch library stats"})
		return
	}

	summaries := make([]LibrarySummary, 0, len(rows))
	for _, r := range rows {
		summaries = append(summaries, LibrarySummary{
			LibraryID:      r.LibraryID,
			FilesProcessed: r.Files,
			OriginalSize:   r.SumOrig.Int64,
			NewSize:        r.SumNew.Int64,
		})
	}
	c.JSON(http.StatusOK, summaries)
}

// GetLibraryStats returns full stats with per-profile breakdown for a single library.
func GetLibraryStats(c *gin.Context) {
	idStr := c.Param("id")
	libID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	// Load the library name
	var lib models.Library
	if err := db.DB.First(&lib, libID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "library not found"})
		return
	}

	// Overall totals for this library
	type totalsRow struct {
		Files   int64
		SumOrig sql.NullInt64
		SumNew  sql.NullInt64
	}
	var totals totalsRow
	if err := db.DB.Table("completed_tasks").
		Select("COUNT(*) as files, SUM(original_size) as sum_orig, SUM(new_size) as sum_new").
		Where("library_id = ? AND task_success = ? AND new_size > 0", libID, true).
		Scan(&totals).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch library totals"})
		return
	}

	// Per-profile breakdown
	type profileRow struct {
		ProfileID sql.NullInt64
		Name      sql.NullString
		Files     int64
		SumOrig   int64
		SumNew    int64
	}
	var profRows []profileRow
	if err := db.DB.Table("completed_tasks").
		Select("completed_tasks.profile_id, COALESCE(profiles.name, 'Unknown') as name, COUNT(*) as files, SUM(completed_tasks.original_size) as sum_orig, SUM(completed_tasks.new_size) as sum_new").
		Joins("LEFT JOIN profiles ON profiles.id = completed_tasks.profile_id AND profiles.deleted_at IS NULL").
		Where("completed_tasks.library_id = ? AND completed_tasks.task_success = ? AND completed_tasks.new_size > 0", libID, true).
		Group("completed_tasks.profile_id, profiles.name").
		Scan(&profRows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch profile stats"})
		return
	}

	profiles := make([]ProfileStats, 0, len(profRows))
	for _, p := range profRows {
		var pid *uint
		if p.ProfileID.Valid {
			v := uint(p.ProfileID.Int64)
			pid = &v
		}
		name := "Unknown"
		if p.Name.Valid && p.Name.String != "" {
			name = p.Name.String
		}
		profiles = append(profiles, ProfileStats{
			ProfileID:      pid,
			Name:           name,
			FilesProcessed: p.Files,
			OriginalSize:   p.SumOrig,
			NewSize:        p.SumNew,
		})
	}

	c.JSON(http.StatusOK, LibraryStatsResponse{
		LibraryID:      uint(libID),
		LibraryName:    lib.Name,
		FilesProcessed: totals.Files,
		OriginalSize:   totals.SumOrig.Int64,
		NewSize:        totals.SumNew.Int64,
		Profiles:       profiles,
	})
}

// BackfillLibraryStats attempts to populate library_id and profile_id for historical
// completed_tasks rows that predate the schema addition.
func BackfillLibraryStats(c *gin.Context) {
	// Load all libraries with their pipelines and profiles
	var libraries []models.Library
	if err := db.DB.Preload("Pipeline.Profiles").Find(&libraries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load libraries"})
		return
	}

	// Load all completed tasks that are missing a library_id
	var tasks []models.CompletedTask
	if err := db.DB.Where("library_id IS NULL").Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load tasks"})
		return
	}

	libUpdated := 0
	profUpdated := 0

	for _, task := range tasks {
		var matchedLib *models.Library
		for i := range libraries {
			if libraries[i].Path != "" && len(task.Abspath) >= len(libraries[i].Path) &&
				task.Abspath[:len(libraries[i].Path)] == libraries[i].Path {
				matchedLib = &libraries[i]
				break
			}
		}
		if matchedLib == nil {
			continue
		}

		libID := matchedLib.ID
		updates := map[string]interface{}{"library_id": libID}

		// Best-effort profile assignment
		if matchedLib.Pipeline != nil && len(matchedLib.Pipeline.Profiles) > 0 {
			var cache models.FileMetadataCache
			if err := db.DB.Where("abspath = ?", task.Abspath).First(&cache).Error; err == nil {
				if profile := models.GetMatchingProfile(cache.Metadata, *matchedLib.Pipeline); profile != nil {
					updates["profile_id"] = profile.ID
					profUpdated++
				}
			}
		}

		if err := db.DB.Model(&models.CompletedTask{}).
			Where("id = ?", task.ID).
			Updates(updates).Error; err == nil {
			libUpdated++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"library_updated": libUpdated,
		"profile_updated": profUpdated,
	})
}
