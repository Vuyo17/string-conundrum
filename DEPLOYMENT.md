# Deployment Guide - Backend on Remote Server

## Remote Server Setup (string-1.cs.uct.ac.za)

### 1. Install Python and Dependencies
```bash
# SSH into the server
ssh mtmluv001@string-1.cs.uct.ac.za

# Update package manager
sudo apt update
sudo apt upgrade -y

# Install Python and pip
sudo apt install -y python3 python3-pip python3-venv

# Verify installation
python3 --version
```

### 2. Set Up Backend Directory
```bash
# Create app directory
mkdir -p ~/string-conundrum-api
cd ~/string-conundrum-api

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip
```

### 3. Copy Backend Code
```bash
# From your local machine, run:
scp -r backend/ mtmluv001@string-1.cs.uct.ac.za:~/string-conundrum-api/

# SSH back and install dependencies
ssh mtmluv001@string-1.cs.uct.ac.za
cd ~/string-conundrum-api
source venv/bin/activate
pip install -r backend/requirements.txt
pip install gunicorn
```

### 4. Configure Gunicorn
Create `/home/mtmluv001/string-conundrum-api/backend/wsgi.py`:
```python
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run()
```

Test Gunicorn:
```bash
cd ~/string-conundrum-api
source venv/bin/activate
gunicorn --workers 4 --bind 127.0.0.1:8000 backend.wsgi:app
```

### 5. Create Systemd Service
Create `/etc/systemd/system/string-api.service`:
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

Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable string-api
sudo systemctl start string-api
sudo systemctl status string-api
```

### 6. Install and Configure Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Create `/etc/nginx/sites-available/api.stringscon`:
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
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/api.stringscon /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Set Up HTTPS with Let's Encrypt (Certbot)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.stringscon.netlify.app
sudo systemctl reload nginx
```

### 8. Update CORS in Flask Backend
Update `backend/app/__init__.py` to allow the frontend domain:
```python
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    
    # Configure CORS
    CORS(app, resources={
        r"/*": {
            "origins": [
                "https://stringscon.netlify.app",
                "http://localhost:3000",
                "http://localhost:5173"
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    })
    
    # ... rest of app creation
    return app
```

### 9. Verify Deployment
```bash
# Check service status
sudo systemctl status string-api

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Test API endpoint
curl https://api.stringscon.netlify.app/
```

## Useful Commands

```bash
# View logs
sudo journalctl -u string-api -f

# Restart service
sudo systemctl restart string-api

# Reload nginx
sudo systemctl reload nginx

# Check if port 8000 is listening
netstat -tulpn | grep 8000
```
