package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/gin-gonic/gin"
)

type FileBrowserRequest struct {
	CurrentPath string `json:"current_path"`
}

type FileBrowserItem struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type FileBrowserResponse struct {
	CurrentPath string            `json:"current_path"`
	ParentPath  string            `json:"parent_path"`
	Directories []FileBrowserItem `json:"directories"`
}

// GetDirectoryListing returns a list of subdirectories in a given path
func GetDirectoryListing(c *gin.Context) {
	var in FileBrowserRequest
	if err := c.ShouldBindJSON(&in); err != nil {
		in.CurrentPath = "/"
	}

	// Default to root if empty
	if in.CurrentPath == "" {
		in.CurrentPath = "/"
	}

	// Get absolute path
	absPath, err := filepath.Abs(in.CurrentPath)
	if err != nil {
		absPath = in.CurrentPath
	}

	files, err := os.ReadDir(absPath)
	if err != nil {
		// Return empty list if directory is inaccessible
		c.JSON(http.StatusOK, FileBrowserResponse{
			CurrentPath: absPath,
			ParentPath:  filepath.Dir(absPath),
			Directories: []FileBrowserItem{},
		})
		return
	}

	var directories []FileBrowserItem
	for _, f := range files {
		if f.IsDir() {
			directories = append(directories, FileBrowserItem{
				Name: f.Name(),
				Path: filepath.Join(absPath, f.Name()),
			})
		}
	}

	// Sort directories alphabetically
	sort.Slice(directories, func(i, j int) bool {
		return directories[i].Name < directories[j].Name
	})

	parentPath := filepath.Dir(absPath)
	if parentPath == absPath {
		parentPath = ""
	}

	c.JSON(http.StatusOK, FileBrowserResponse{
		CurrentPath: absPath,
		ParentPath:  parentPath,
		Directories: directories,
	})
}
