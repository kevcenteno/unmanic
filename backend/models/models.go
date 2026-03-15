package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents an application user
type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Username     string `gorm:"unique;not null" json:"username"`
	PasswordHash string `gorm:"not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// Library represents a media/library root
type Library struct {
	ID               uint   `gorm:"primaryKey" json:"id"`
	Name             string `gorm:"unique;not null" json:"name"`
	Path             string `gorm:"not null" json:"path"`
	Locked           bool   `gorm:"not null;default:false" json:"locked"`
	EnableRemoteOnly bool   `gorm:"not null;default:false" json:"enable_remote_only"`
	EnableScanner    bool   `gorm:"not null;default:true" json:"enable_scanner"`
	EnableInotify    bool   `gorm:"not null;default:false" json:"enable_inotify"`
	PriorityScore    int    `gorm:"not null;default:0" json:"priority_score"`
	PipelineID       *uint  `gorm:"index" json:"pipeline_id"`
	Pipeline         *Pipeline `gorm:"foreignKey:PipelineID" json:"pipeline"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// Task represents a queued or processed task
type Task struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Abspath           string         `gorm:"unique;not null" json:"abspath"`
	CachePath         string         `json:"cache_path"`
	Priority          int            `gorm:"index:idx_lib_status_priority,priority:desc;not null;default:0" json:"priority"`
	Type              string         `gorm:"not null" json:"type"`
	LibraryID         uint           `gorm:"index:idx_lib_status_priority" json:"library_id"`
	Status            string         `gorm:"index:idx_lib_status_priority;not null" json:"status"`
	Success           bool           `gorm:"not null;default:false" json:"success"`
	StartTime         time.Time      `json:"start_time"`
	FinishTime        time.Time      `json:"finish_time"`
	ProcessedByWorker string         `json:"processed_by_worker"`
	Log               string         `gorm:"type:text" json:"log"`
	ProfileID         uint           `gorm:"index" json:"profile_id"`
	FFmpegSettings    FFmpegSettings `gorm:"serializer:json" json:"ffmpeg_settings"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// CompletedTask stores a record of completed work
type CompletedTask struct {
	ID                uint   `gorm:"primaryKey" json:"id"`
	TaskLabel         string `gorm:"not null" json:"task_label"`
	Abspath           string `gorm:"not null" json:"abspath"`
	TaskSuccess       bool   `gorm:"not null" json:"task_success"`
	StartTime         time.Time `json:"start_time"`
	FinishTime        time.Time `json:"finish_time"`
	ProcessedByWorker string `json:"processed_by_worker"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// Setting represents an application setting
type Setting struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Key       string `gorm:"unique;not null" json:"key"`
	Value     string `gorm:"not null" json:"value"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// WorkerGroup defines a group of workers
type WorkerGroup struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"unique;not null" json:"name"`
	Count     int    `gorm:"not null;default:1" json:"count"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type MatchRule struct {
	LogicalOp string      `json:"logical_op"` // "AND", "OR", or "" for leaf
	Rules     []MatchRule `json:"rules"`      // Child rules if LogicalOp is set
	Property  string      `json:"property"`   // if leaf: "bitrate", "width", etc.
	Operator  string      `json:"operator"`   // if leaf: ">", "<", "==", etc.
	Value     string      `json:"value"`      // if leaf
}

type FFmpegSettings struct {
	VideoFlags string `json:"video_flags"`
	Container  string `json:"container"`
}

type Profile struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	PipelineID     uint           `gorm:"index" json:"pipeline_id"`
	Priority       int            `json:"priority"` // 0 = Highest Priority
	Name           string         `json:"name"`
	MatchRule      MatchRule      `gorm:"serializer:json" json:"match_rule"`
	FFmpegSettings FFmpegSettings `gorm:"serializer:json" json:"ffmpeg_settings"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type Pipeline struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"unique;not null" json:"name"`
	Profiles  []Profile `gorm:"foreignKey:PipelineID" json:"profiles"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type FileMetadataCache struct {
	ID        uint          `gorm:"primaryKey" json:"id"`
	Abspath   string        `gorm:"uniqueIndex;not null" json:"abspath"`
	Mtime     int64         `json:"mtime"`
	Size      int64         `json:"size"`
	Metadata  VideoMetadata `gorm:"serializer:json" json:"metadata"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}
