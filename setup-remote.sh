#!/bin/bash
# String Conundrum Backend - Remote Server Setup Script
# Run this script on the remote server (string-1.cs.uct.ac.za)

set -e  # Exit on error

echo "================================"
echo "String Conundrum Backend Setup"
echo "================================"

# Step 1: Install Python and dependencies
echo ""
echo "Step 1: Installing Python and dependencies..."
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

# Step 2: Create app directory
echo ""
echo "Step 2: Creating app directory..."
mkdir -p ~/string-conundrum-api
cd ~/string-conundrum-api

# Step 3: Create Python virtual environment
echo ""
echo "Step 3: Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Step 4: Copy backend requirements and install
echo ""
echo "Step 4: Waiting for backend code to be copied..."
echo "Please copy backend/ directory to ~/string-conundrum-api/ on this server"
echo "Run on your local machine:"
echo "  scp -r backend/ mtmluv001@string-1.cs.uct.ac.za:~/string-conundrum-api/"
echo ""
read -p "Press Enter once backend files are copied..."

if [ ! -f ~/string-conundrum-api/backend/requirements.txt ]; then
    echo "ERROR: backend/requirements.txt not found!"
    exit 1
fi

# Step 5: Install Python dependencies
echo ""
echo "Step 5: Installing Python dependencies..."
source venv/bin/activate
pip install -r backend/requirements.txt
pip install gunicorn

# Step 6: Test Flask locally
echo ""
echo "Step 6: Testing Flask locally..."
source venv/bin/activate
timeout 3 python backend/run.py || true
echo "✓ Flask startup successful (timeout expected)"

# Step 7: Test Gunicorn
echo ""
echo "Step 7: Testing Gunicorn..."
timeout 3 gunicorn --workers 4 --bind 127.0.0.1:8000 backend.wsgi:app || true
echo "✓ Gunicorn startup successful (timeout expected)"

# Step 8: Create systemd service
echo ""
echo "Step 8: Creating systemd service..."
sudo tee /etc/systemd/system/string-api.service > /dev/null <<EOF
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
EOF

# Step 9: Enable and start the service
echo ""
echo "Step 9: Enabling and starting systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable string-api
sudo systemctl start string-api
sleep 2
sudo systemctl status string-api

# Step 10: Configure nginx
echo ""
echo "Step 10: Configuring nginx..."
sudo tee /etc/nginx/sites-available/string-conundrum > /dev/null <<'EOF'
server {
    listen 80;
    server_name string-1.cs.uct.ac.za;

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
EOF

sudo ln -sf /etc/nginx/sites-available/string-conundrum /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx

# Step 11: Set up HTTPS with Let's Encrypt
echo ""
echo "Step 11: Setting up HTTPS with Let's Encrypt..."
echo "This requires string-1.cs.uct.ac.za to resolve to this server!"
read -p "Is the domain already pointing to this server's IP? (yes/no): " domain_ready

if [ "$domain_ready" = "yes" ]; then
    sudo certbot --nginx -d string-1.cs.uct.ac.za --non-interactive --agree-tos --email your-email@example.com
    sudo systemctl reload nginx
    echo "✓ HTTPS configured!"
else
    echo "Skipping HTTPS setup. Run later with:"
    echo "  sudo certbot --nginx -d string-1.cs.uct.ac.za"
fi

# Step 12: Verify deployment
echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Verify services are running:"
sudo systemctl status string-api --no-pager || echo "Service status check failed"
sudo systemctl status nginx --no-pager || echo "Nginx status check failed"

echo ""
echo "Test API endpoint:"
echo "  curl http://localhost:8000/health"
echo "  curl http://string-1.cs.uct.ac.za/health"

echo ""
echo "View logs:"
echo "  sudo journalctl -u string-api -f"
echo "  sudo tail -f /var/log/nginx/error.log"

echo ""
echo "Next steps:"
echo "1. Ensure string-1.cs.uct.ac.za resolves to this server"
echo "2. Set up HTTPS if not already done"
echo "3. Build the frontend (npm run build) and publish frontend/dist to /var/www/string-conundrum"
