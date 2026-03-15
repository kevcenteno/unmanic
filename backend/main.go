package main

import (
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"muxmill/db"
	"muxmill/handlers"
	"muxmill/middleware"
	"muxmill/models"
	"muxmill/services"
)

//go:embed all:frontend_dist
var frontendFS embed.FS

func main() {
	// Initialize DB (creates or opens the SQLite file)
	db.InitDB("muxmill.db")

	// Auto-migrate models to ensure schema exists
	if err := db.DB.AutoMigrate(
		&models.User{},
		&models.Library{},
		&models.Task{},
		&models.CompletedTask{},
		&models.Setting{},
		&models.WorkerGroup{},
		&models.Pipeline{},
		&models.Profile{},
		&models.FileMetadataCache{},
	); err != nil {
		log.Fatalf("failed to auto-migrate database: %v", err)
	}

	// Seed default settings and worker groups
	db.SeedDefaults()

	// Start Library Scanner service
	services.GetScanner().Start()

	// Start WebSocket Hub
	go services.GetHub().Run()

	r := gin.Default()

	// Allow all CORS in development and permit Authorization header for JWT
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	// DefaultConfig already includes Origin, Content-Length, Content-Type
	// so append Authorization to allow the frontend to send JWTs in headers
	config.AllowHeaders = append(config.AllowHeaders, "Authorization")
	r.Use(cors.New(config))

	// Unauthenticated routes
	r.POST("/api/login", handlers.Login)
	r.POST("/api/register", handlers.Register)
	r.GET("/api/system/status", handlers.GetSystemStatus)

	// Protected API group
	api := r.Group("/api/v1")
	api.Use(middleware.JWTMiddleware())

	// WebSocket
	api.GET("/ws", handlers.WebSocketHandler)

	// Library routes
	api.GET("/libraries", handlers.GetLibraries)
	api.GET("/libraries/scan-status", handlers.GetScannerStatus)
	api.POST("/libraries", handlers.CreateLibrary)
	api.POST("/libraries/rescan", handlers.TriggerLibraryScan)
	api.PUT("/libraries/:id", handlers.UpdateLibrary)
	api.DELETE("/libraries/:id", handlers.DeleteLibrary)

	// Pipeline routes
	api.GET("/pipelines", handlers.GetPipelines)
	api.GET("/pipelines/:id", handlers.GetPipeline)
	api.POST("/pipelines", handlers.CreatePipeline)
	api.PUT("/pipelines/:id", handlers.UpdatePipeline)
	api.DELETE("/pipelines/:id", handlers.DeletePipeline)

	// Task routes
	api.GET("/tasks/pending", handlers.GetPendingTasks)
	api.GET("/tasks/history", handlers.GetHistoryTasks)
	api.DELETE("/tasks/pending/:id", handlers.RemovePendingTask)
	api.DELETE("/tasks/history", handlers.ClearHistory)

	// Settings & workers
	api.GET("/settings", handlers.GetSettings)
	api.PUT("/settings", handlers.UpdateSetting)
	api.GET("/workers/status", handlers.GetWorkerStatus)
	api.GET("/workers/groups", handlers.GetWorkerGroups)
	api.POST("/workers/groups", handlers.CreateWorkerGroup)
	api.PUT("/workers/groups/:id", handlers.UpdateWorkerGroup)
	api.DELETE("/workers/groups/:id", handlers.DeleteWorkerGroup)

	// File browser
	api.POST("/filebrowser/list", handlers.GetDirectoryListing)

	// Serve Frontend (Embedded) unless in DEV mode
	isDev := os.Getenv("DEV_MODE") == "true"
	if !isDev {
		subFS, err := fs.Sub(frontendFS, "frontend_dist")
		if err != nil {
			log.Printf("Warning: Failed to load embedded frontend (Did you build it?): %v", err)
		} else {
			// Serve static assets natively under /assets
			r.StaticFS("/assets", http.FS(subFS))

			// Catch-all route to serve index.html for React Router
			r.NoRoute(func(c *gin.Context) {
				if strings.HasPrefix(c.Request.URL.Path, "/api/") {
					c.JSON(http.StatusNotFound, gin.H{"error": "api endpoint not found"})
					return
				}
				
				// Serve index.html for SPA routing or the actual file if it exists at root
				// First check if the exact path exists in the embedded fs (e.g. /vite.svg)
				if path := strings.TrimPrefix(c.Request.URL.Path, "/"); path != "" {
					if file, err := subFS.Open(path); err == nil {
						defer file.Close()
						stat, err := file.Stat()
						if err == nil && !stat.IsDir() {
							http.ServeContent(c.Writer, c.Request, stat.Name(), stat.ModTime(), file.(io.ReadSeeker))
							return
						}
					}
				}

				// Fallback to index.html
				indexFile, err := subFS.Open("index.html")
				if err != nil {
					c.String(http.StatusInternalServerError, "index.html not found in embedded fs")
					return
				}
				defer indexFile.Close()

				stat, err := indexFile.Stat()
				if err != nil {
					c.String(http.StatusInternalServerError, "failed to stat index.html")
					return
				}

				http.ServeContent(c.Writer, c.Request, "index.html", stat.ModTime(), indexFile.(io.ReadSeeker))
			})
		}
	} else {
		log.Println("Running in DEV_MODE. API only. Use Vite to serve frontend.")
	}

	// Start server
	log.Println("Starting MuxMill API on port :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
