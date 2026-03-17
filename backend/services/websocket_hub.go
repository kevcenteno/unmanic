package services

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

var (
	wsHub  *Hub
	wsOnce sync.Once
)

func GetHub() *Hub {
	wsOnce.Do(func() {
		wsHub = &Hub{
			clients:    make(map[*websocket.Conn]bool),
			register:   make(chan *websocket.Conn),
			unregister: make(chan *websocket.Conn),
		}
	})
	return wsHub
}

func (h *Hub) Run() {
	// Periodic status broadcaster
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				status := GetFullStatus()
				h.Publish("WORKER_UPDATE", status.Workers)
				h.Publish("TASKS_UPDATE", map[string]interface{}{
					"pending": status.Pending,
					"history": status.History,
				})
			}
		}
	}()

	for {
		select {
		case conn := <-h.register:
			h.mu.Lock()
			h.clients[conn] = true
			h.mu.Unlock()

			// Send initial full state on connection
			status := GetFullStatus()
			msg, _ := json.Marshal(Event{Type: "FULL_STATUS", Data: status})
			conn.WriteMessage(websocket.TextMessage, msg)

		case conn := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) Publish(eventType string, data interface{}) {
	event := Event{
		Type: eventType,
		Data: data,
	}
	msg, err := json.Marshal(event)
	if err != nil {
		log.Printf("Event marshal error: %v", err)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	for client := range h.clients {
		err := client.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			client.Close()
			delete(h.clients, client)
		}
	}
}

func (h *Hub) Register(conn *websocket.Conn) {
	h.register <- conn
}

func (h *Hub) Unregister(conn *websocket.Conn) {
	h.unregister <- conn
}
