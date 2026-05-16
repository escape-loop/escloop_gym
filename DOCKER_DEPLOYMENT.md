# Gym Management Software - Docker Deployment Guide

## 🚀 Quick Start (One Command!)

```bash
docker-compose up -d
```

That's it! The entire application stack will start automatically.

---

## 📋 Prerequisites

- **Docker Desktop** installed on your machine
  - Windows: [Download Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
  - Mac: [Download Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
  - Linux: [Install Docker Engine](https://docs.docker.com/engine/install/)

---

## 🎯 What Gets Deployed

When you run `docker-compose up`, the following services start automatically:

| Service | Description | Port |
|---------|-------------|------|
| **Client** | React frontend (Nginx) | http://localhost |
| **Server** | Express API | Internal (3000) |
| **MongoDB** | Database | Internal (27017) |
| **PostgreSQL** | n8n & Evolution DB | Internal (5432) |
| **Redis** | Cache | Internal (6379) |
| **n8n** | Automation Engine | http://localhost:5679 |
| **Evolution API** | WhatsApp Integration | http://localhost:8083 |

---

## 📂 Data Persistence

All your data is automatically saved in Docker volumes:

- **Member/Staff Photos** → `gym_server_uploads`
- **Invoice PDFs** → `gym_server_public`
- **Database** → `gym_mongodb_data`
- **n8n Workflows** → `gym_n8n_data`

> **Important:** Even if you stop or remove containers, your data remains safe in these volumes.

---

## 🛠️ Common Commands

### Start the Application
```bash
docker-compose up -d
```

### Stop the Application
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f client
```

### Restart After Code Changes
```bash
docker-compose down
docker-compose up --build -d
```

### Check Container Status
```bash
docker ps
```

---

## 🌐 Access Points

After starting the application:

- **Main Application:** http://localhost
- **n8n Automation:** http://localhost:5679
- **Evolution API:** http://localhost:8083

---

## 🔧 Troubleshooting

### Port Already in Use

If you see "port is already allocated":

**Windows:**
```powershell
# Find process using port 80
netstat -ano | findstr :80
# Kill the process (replace PID)
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
# Find and kill process using port 80
sudo lsof -ti:80 | xargs kill -9
```

### Container Won't Start

```bash
# View detailed logs
docker-compose logs <service-name>

# Example:
docker-compose logs server
```

### Reset Everything (Fresh Start)

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (⚠️ THIS DELETES ALL DATA)
docker volume rm gym_mongodb_data gym_server_uploads gym_server_public

# Start fresh
docker-compose up -d
```

---

## 🔄 Updating the Application

When you receive updated code:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

---

## 📊 Monitoring

### Check if all containers are healthy:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected output:
```
NAMES               STATUS
gym_client          Up X minutes (healthy)
gym_server          Up X minutes (healthy)
gym_mongodb         Up X minutes (healthy)
gym_postgres        Up X minutes (healthy)
gym_redis           Up X minutes (healthy)
gym_n8n             Up X minutes
gym_evolution_api   Up X minutes
```

---

## 🌍 Cross-Platform Compatibility

This Docker setup works identically on:
- ✅ Windows 10/11
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (Ubuntu, Debian, Fedora, etc.)

No code changes needed between platforms!

---

## 🆘 Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify all containers are running: `docker ps`
3. Ensure no port conflicts (80, 5679, 8083)
4. Try a fresh restart: `docker-compose down && docker-compose up -d`

---

## 📝 Technical Details

### Network Architecture
- All services communicate via internal Docker network (`gym_network`)
- Nginx reverse proxy routes external requests to internal services
- No `localhost` or `host.docker.internal` dependencies

### Volume Mounts
- `server/uploads/` → Docker volume (persistent)
- `server/public/invoices/` → Docker volume (persistent)
- MongoDB data → Docker volume (persistent)

### Environment Variables
All configuration is handled in `docker-compose.yml`. No manual `.env` file needed for basic deployment.
