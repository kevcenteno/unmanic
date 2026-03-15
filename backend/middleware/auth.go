package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JwtSecret is the HMAC secret used to sign tokens. It is loaded from the
// environment variable JWT_SECRET. A development fallback is used when the
// variable is not set.
var JwtSecret = []byte(getEnv("JWT_SECRET", "dev-secret-key"))

// getEnv returns the value of the environment variable named by the key.
// If the variable is not present, it returns the provided fallback value.
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// Claims represents the JWT claims we expect.
type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// JWTMiddleware returns a gin middleware that validates JWT tokens from the
// Authorization header in the form "Bearer <token>". If the token is valid
// the username from the claims will be set into the gin context under the
// key "username".
func JWTMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		tokenStr := ""

		if auth != "" {
			parts := strings.SplitN(auth, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				tokenStr = parts[1]
			}
		}

		// Fallback to query parameter for WebSockets
		if tokenStr == "" {
			tokenStr = c.Query("token")
		}

		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}

		var claims Claims
		token, err := jwt.ParseWithClaims(tokenStr, &claims, func(t *jwt.Token) (any, error) {
			// Ensure the signing method is HMAC
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrTokenUnverifiable
			}
			return JwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// Put the username into the context for downstream handlers
		c.Set("username", claims.Username)
		c.Next()
	}
}
