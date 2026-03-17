package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"muxmill/db"
	"muxmill/middleware"
	"muxmill/models"
)

// AuthInput represents the expected JSON body for auth endpoints.
type AuthInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// TokenResponse is returned on successful login.
type TokenResponse struct {
	Token string `json:"token"`
}

// Register handles user registration at POST /api/register
func Register(c *gin.Context) {
	var in AuthInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Hash the password
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user := models.User{
		Username:     in.Username,
		PasswordHash: string(hash),
	}

	if err := db.DB.Create(&user).Error; err != nil {
		// try to detect duplicate username - GORM/SQLite error text may include "UNIQUE" or "constraint"
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "constraint") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	c.Status(http.StatusCreated)
}

// Login handles user login at POST /api/login
func Login(c *gin.Context) {
	var in AuthInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var user models.User
	if err := db.DB.Where("username = ?", in.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Create JWT token
	now := time.Now()
	claims := middleware.Claims{
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(middleware.JwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, TokenResponse{Token: tokenStr})
}

// GetSystemStatus returns the initialization status of the application.
func GetSystemStatus(c *gin.Context) {
	var count int64
	db.DB.Model(&models.User{}).Count(&count)

	c.JSON(http.StatusOK, gin.H{
		"initialized": count > 0,
	})
}
