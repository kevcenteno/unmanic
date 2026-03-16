package handlers

import (
	"muxmill/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// PauseWorkers pauses the foreman dispatch
func PauseWorkers(c *gin.Context) {
	services.GetForeman().SetPaused(true)
	c.JSON(http.StatusOK, gin.H{"message": "workers paused"})
}

// ResumeWorkers resumes the foreman dispatch
func ResumeWorkers(c *gin.Context) {
	services.GetForeman().SetPaused(false)
	c.JSON(http.StatusOK, gin.H{"message": "workers resumed"})
}

// KillWorkers kills all active worker processes
func KillWorkers(c *gin.Context) {
	services.GetForeman().KillAll()
	c.JSON(http.StatusOK, gin.H{"message": "kill command sent to all workers"})
}

// PauseWorker pauses a specific worker
func PauseWorker(c *gin.Context) {
	name := c.Param("name")
	services.GetForeman().SetWorkerPaused(name, true)
	c.JSON(http.StatusOK, gin.H{"message": "worker paused"})
}

// ResumeWorker resumes a specific worker
func ResumeWorker(c *gin.Context) {
	name := c.Param("name")
	services.GetForeman().SetWorkerPaused(name, false)
	c.JSON(http.StatusOK, gin.H{"message": "worker resumed"})
}

// KillWorker kills a specific worker
func KillWorker(c *gin.Context) {
	name := c.Param("name")
	services.GetForeman().KillWorker(name)
	c.JSON(http.StatusOK, gin.H{"message": "kill command sent to worker"})
}
