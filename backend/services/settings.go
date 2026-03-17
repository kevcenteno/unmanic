package services

import (
	"strconv"

	"muxmill/db"
	"muxmill/models"
)

// getConcurrentFileTesters reads the 'concurrent_file_testers' setting from the database
// and returns it as an int. If not set or invalid, returns a sensible default of 2.
func getConcurrentFileTesters() int {
	var s models.Setting
	if err := db.DB.Where("key = ?", "concurrent_file_testers").First(&s).Error; err != nil {
		return 2
	}
	if v, err := strconv.Atoi(s.Value); err == nil && v > 0 {
		return v
	}
	return 2
}
