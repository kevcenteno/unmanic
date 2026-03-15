package db

import (
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// DB is the global GORM database connection.
var DB *gorm.DB

// InitDB opens a SQLite database at the provided filepath and assigns it
// to the package-level DB variable. The function will log.Fatal on error
// so callers do not need to handle the fatal error case.
func InitDB(filepath string) {
	// Add dsn parameters for better performance and concurrency in SQLite
	// _busy_timeout=5000: wait up to 5 seconds if DB is locked
	// _journal_mode=WAL: enable Write-Ahead Logging for better concurrent read/write
	// _synchronous=NORMAL: reduce fsync calls for better performance
	dsn := filepath + "?_busy_timeout=5000&_journal_mode=WAL&_synchronous=NORMAL"

	d, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database: ", err)
	}
	DB = d
}