# Quick Deployment Steps

Everything runs on one UCT host, `string-1.cs.uct.ac.za` (137.158.61.235):
Nginx serves the built frontend and proxies `/api` to Gunicorn/Flask on the
same origin. Because it is same-origin, the browser never issues a CORS
preflight in normal operation.

## Step 1: Prepare Local Code
- ✅ Frontend API client falls back to same-origin relative paths when
  `VITE_API_BASE_URL` is unset — which is what this deployment wants
- ✅ Backend CORS lists the host (and its IP) for the case where the frontend
  is ever built against a different API origin
- ✅ WSGI entry point created for production deployment

## Step 2: Deploy Backend to Remote Server

### Copy backend code to server:
```bash
cd c:\Users\Student\string-conundrum
scp -r backend/ mtmluv001@string-1.cs.uct.ac.za:~/string-conundrum-api/
```

### SSH into server and set up:
```bash
ssh mtmluv001@string-1.cs.uct.ac.za

# Install Python and virtual environment
sudo apt update && sudo apt install -y python3 python3-pip python3-venv
cd ~/string-conundrum-api
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
pip install gunicorn
```

### Test Flask locally:
```bash
cd ~/string-conundrum-api
source venv/bin/activate
python backend/run.py
# Should see "Running on http://127.0.0.1:5000"
```

### Test Gunicorn:
```bash
source venv/bin/activate
gunicorn --workers 4 --bind 127.0.0.1:8000 backend.wsgi:app
# Should see "Listening at: http://127.0.0.1:8000"
```

## Step 3: Set Up Systemd Service
Create `/etc/systemd/system/string-api.service`:
```bash
sudo nano /etc/systemd/system/string-api.service
```

Paste this content:
```ini
[Unit]
Description=String Conundrum API
After=network.target

[Service]
User=mtmluv001
WorkingDirectory=/home/mtmluv001/string-conundrum-api
Environment="PATH=/home/mtmluv001/string-conundrum-api/venv/bin"
ExecStart=/home/mtmluv001/string-conundrum-api/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:8000 backend.wsgi:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable string-api
sudo systemctl start string-api
sudo systemctl status string-api
```

## Step 4: Set Up Nginx Reverse Proxy

### Install nginx:
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Create nginx config:
```bash
sudo nano /etc/nginx/sites-available/string-conundrum
```

Serve the built frontend and proxy the API from the same origin, so the
browser treats both as one site:
```nginx
server {
    listen 80;
    server_name string-1.cs.uct.ac.za;

    # Built React app (see Step 7)
    root /var/www/string-conundrum;
    index index.html;

    # SPA fallback: unknown paths return the app shell, not a 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_redirect off;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/string-conundrum /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Set Up HTTPS (Let's Encrypt) — optional

The site currently serves over plain HTTP, which is why browsers show a
"Not secure" warning. To fix that:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d string-1.cs.uct.ac.za

# Choose to redirect HTTP to HTTPS when prompted
sudo systemctl reload nginx
```

## Step 6: Verify Deployment

### Test backend endpoint:
```bash
curl http://string-1.cs.uct.ac.za/health
# Should return: {"status":"ok"}
```

### Check services:
```bash
sudo systemctl status string-api
sudo systemctl status nginx
```

### View logs:
```bash
sudo journalctl -u string-api -f
sudo tail -f /var/log/nginx/error.log
```

## Step 7: Build and Publish the Frontend

Build locally, leaving `VITE_API_BASE_URL` unset so the app calls `/api/...`
on its own origin:
```bash
cd frontend
npm ci
npm run build          # emits frontend/dist
```

Copy the build to the location Nginx serves (Step 4's `root`):
```bash
scp -r frontend/dist/* mtmluv001@string-1.cs.uct.ac.za:/tmp/sc-dist/
ssh mtmluv001@string-1.cs.uct.ac.za \
  'sudo mkdir -p /var/www/string-conundrum && sudo rm -rf /var/www/string-conundrum/* \
   && sudo cp -r /tmp/sc-dist/* /var/www/string-conundrum/ && rm -rf /tmp/sc-dist'
```

> Do **not** set `VITE_API_BASE_URL` to the bare IP. The app would then be
> loaded from the hostname but call the IP, making every request cross-origin
> and subject to the CORS list in `backend/app/__init__.py`.

## Testing

1. Open http://string-1.cs.uct.ac.za in browser
2. Try submitting exercises — requests should go to `/api/...` on the same host
3. Check the network tab in DevTools to see API calls

## Troubleshooting

### 502 Bad Gateway
- Check if Gunicorn is running: `sudo systemctl status string-api`
- Check if port 8000 is listening: `netstat -tulpn | grep 8000`
- View logs: `sudo journalctl -u string-api -f`

### CORS errors in browser console
- Verify frontend domain is in backend CORS list
- Check browser console network tab for failed requests
- Verify nginx reverse proxy headers are correct

### SSL certificate errors
- Verify the host resolves to this server: `nslookup string-1.cs.uct.ac.za`
  (expect 137.158.61.235)
- Renew certificate: `sudo certbot renew`
