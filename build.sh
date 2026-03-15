#!/bin/bash
cd frontend && npm run build && cd ../backend && rm -rf frontend_dist && cp -r ../frontend/dist ./frontend_dist && go build -o muxmill