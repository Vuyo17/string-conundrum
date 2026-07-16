# Quick Deployment Steps

## Step 1: Prepare Local Code
Your code is already updated to support remote deployment:
- ✅ Frontend API client automatically uses `https://api.stringscon.netlify.app` in production
- ✅ Backend CORS configured to accept requests from `https://stringscon.netlify.app`
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
sudo nano /etc/nginx/sites-available/api.stringscon
```

Paste this content:
```nginx
server {
    listen 80;
    server_name api.stringscon.netlify.app;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_redirect off;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/api.stringscon /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Set Up HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.stringscon.netlify.app

# Choose to redirect HTTP to HTTPS when prompted
sudo systemctl reload nginx
```

## Step 6: Verify Deployment

### Test backend endpoint:
```bash
curl https://api.stringscon.netlify.app/health
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

## Step 7: Deploy Frontend to Netlify

1. Push code to GitHub
2. Connect repo to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Environment variables: (none needed, it's baked into the code)

## Testing

1. Open https://stringscon.netlify.app in browser
2. Try submitting exercises - should send requests to https://api.stringscon.netlify.app
3. Check network tab in DevTools to see API calls

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
- Wait 24-48 hours for DNS propagation if just set up
- Verify domain is pointing to server: `nslookup api.stringscon.netlify.app`
- Renew certificate: `sudo certbot renew`
