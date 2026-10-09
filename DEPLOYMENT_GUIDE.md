# 🚀 SafeRide Full-Stack Deployment Guide

This guide walks you through deploying the **SafeRide Intelligent Vehicle Safety Platform** to the cloud:
- **Frontend (Web Dashboard)**: Deployed to [Vercel](https://vercel.com) (Free, Global CDN, Automatic SSL)
- **Backend (FastAPI & WebSockets)**: Deployed to [Render](https://render.com) or [Railway](https://railway.app) (Free/Low cost Python runtime)
- **Database (PostgreSQL)**: Hosted on [Supabase](https://supabase.com) (Cloud managed PostgreSQL)

---

## 📋 Architecture Overview

```
[ ESP32 Hardware ] ----(HTTP Telemetry)----\
                                            +---> [ Render / Railway ] <---> [ Supabase PostgreSQL ]
[ React Dashboard (Vercel) ] -(HTTPS & WSS)-/        (FastAPI Backend)
```

---

## 🛠️ Prerequisites

1. Your repository pushed to GitHub (`github.com/your-username/SafeRide`).
   > ⚠️ **Important Security Rule**: Ensure `.env` and `firmware/SafeRide/SafeRide.ino` are not committed to git (both are protected in `.gitignore`).
2. Your Supabase PostgreSQL connection string from `backend/.env`.

---

## Part 1: Deploy Backend to Render (Recommended)

1. Go to [render.com](https://render.com) and sign in with GitHub.
2. Click **New +** and select **Web Service**.
3. Connect your **SafeRide** GitHub repository.
4. Fill in the deployment settings:
   - **Name**: `saferide-backend`
   - **Region**: Choose the region closest to you (e.g., *Singapore* or *Frankfurt* or *Oregon*)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
5. In **Environment Variables**, click **Add Environment Variable**:
   - **Key**: `DATABASE_URL`
   - **Value**: *(Paste your Supabase connection string from `backend/.env`)*
   - **Key**: `PYTHON_VERSION`
   - **Value**: `3.11.9`
6. Click **Create Web Service**.
7. Wait 2–3 minutes for the build to finish. Once live, Render will provide your public backend URL:
   ```
   https://saferide-backend.onrender.com
   ```
8. **Verify Backend**: Open `https://saferide-backend.onrender.com` in your browser. You should see:
   ```json
   {
     "status": "online",
     "service": "SafeRide Telemetry & Safety API",
     "version": "1.0.0",
     "docs": "/docs"
   }
   ```

*(Alternative for Railway: Create project -> Deploy from GitHub -> Root Directory `backend` -> Add variable `DATABASE_URL`)*

---

## Part 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Select your **SafeRide** repository.
4. Configure the project:
   - **Framework Preset**: `Vite` (automatically detected)
   - **Root Directory**: Click *Edit* and select **`frontend`**
   - **Build and Output Settings**: Leave default (`npm run build` and `dist`)
5. Open **Environment Variables** and add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: Your Render backend URL (e.g. `https://saferide-backend.onrender.com` without trailing slash)
6. Click **Deploy**.
7. In ~45 seconds, your website will be live at:
   ```
   https://saferide-yourname.vercel.app
   ```

> 💡 **Routing is Pre-Configured**: The included [`frontend/vercel.json`](./frontend/vercel.json) automatically handles single-page routing (e.g., direct navigation to `/map` or refreshing without 404 errors).

---

## Part 3: Connecting ESP32 Hardware to Cloud

Once your backend is live on the cloud, you can point the ESP32 to it so that vehicle telemetry streams globally from anywhere over cellular/Wi-Fi hotspot:

1. Open `firmware/SafeRide/SafeRide.ino`.
2. Locate line 27:
   ```cpp
   // Local network (for home Wi-Fi):
   // const char* API_BASE_URL = "http://10.160.183.135:8000";

   // Cloud production URL:
   const char* API_BASE_URL = "https://saferide-backend.onrender.com";
   ```
3. Upload the sketch to your ESP32.
4. The ESP32 will now push live GPS and sensor telemetry directly to your cloud server!

---

## Part 4: Alternative Local / VPS Docker Deployment

If you prefer deploying the entire stack in Docker containers on a VPS or local server:

```bash
# 1. From repository root, set your Supabase database URL
export DATABASE_URL="your-supabase-connection-string"

# 2. Build and launch with Docker Compose
docker compose up -d --build

# 3. Access
# Frontend: http://your-ip:5173
# Backend:  http://your-ip:8000
```
