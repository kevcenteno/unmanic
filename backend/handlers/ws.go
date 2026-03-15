package handlers

import (
	"log"
	"muxmill/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // In production, refine this
	},
}

// WebSocketHandler upgrades HTTP to WS and handles client registration
func WebSocketHandler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	hub := services.GetHub()
	hub.Register(conn)

	// Listen for close from client
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				hub.Unregister(conn)
				break
			}
		}
	}()
}
