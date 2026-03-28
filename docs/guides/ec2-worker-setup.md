# EC2 Worker Setup Guide

Hướng dẫn tạo EC2 free tier và deploy Shopee Worker.

## Step 1: Tạo EC2 Instance (AWS Console)

1. Vào **AWS Console** → **EC2** → **Launch Instance**
2. Cấu hình:
   - **Name:** `shopee-worker`
   - **AMI:** Ubuntu 22.04 LTS (Free tier eligible)
   - **Instance type:** `t2.micro` (hoặc `t3.micro` nếu có trong region)
   - **Key pair:** Tạo mới hoặc chọn existing key pair (download `.pem` file)
   - **Network:** Default VPC
   - **Security Group:** Tạo mới:
     - SSH (port 22) — từ IP của bạn
     - Custom TCP (port 3456) — từ IP của bạn (health check, optional)
   - **Storage:** 20GB gp3 (free tier cho 30GB)
3. Click **Launch Instance**

## Step 2: Gắn Elastic IP

1. **EC2 Console** → **Elastic IPs** → **Allocate Elastic IP address**
2. Chọn Elastic IP vừa tạo → **Actions** → **Associate Elastic IP address**
3. Chọn instance `shopee-worker` → **Associate**
4. **Ghi lại IP này** — cần thêm vào Shopee partner app whitelist

## Step 3: Thêm IP vào Shopee

Vào **Shopee Partner Console** → **App Settings** → **IP Whitelist**
Thêm Elastic IP của EC2 vào whitelist.

## Step 4: SSH vào EC2 và cài đặt

```bash
# SSH vào EC2 (thay your-key.pem và IP)
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # v20.x.x
npm -v    # 10.x.x

# Install PM2
sudo npm install -g pm2

# Setup PM2 startup (auto-start on reboot)
pm2 startup systemd
# Copy and run the command it outputs (sudo env PATH=...)

# Create log directory
sudo mkdir -p /var/log/shopee-worker
sudo chown ubuntu:ubuntu /var/log/shopee-worker

# Install pnpm (optional, npm also works)
sudo npm install -g pnpm
```

## Step 5: Clone repo và setup Worker

```bash
# Clone repo (hoặc copy worker/ folder)
cd /opt
sudo mkdir shopee-worker && sudo chown ubuntu:ubuntu shopee-worker
cd shopee-worker

# Option A: Clone full repo
git clone https://github.com/YOUR_REPO/BetacomShopeeAPI.git .
cd worker

# Option B: Copy chỉ worker/ folder
# scp -r -i your-key.pem ./worker ubuntu@YOUR_IP:/opt/shopee-worker/

# Install dependencies
pnpm install   # hoặc npm install

# Create .env file
cp .env.example .env
nano .env
# Fill in:
# SUPABASE_URL=https://ohlwhhxhgpotlwfgqhhu.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>
# SHOPEE_BASE_URL=https://partner.shopeemobile.com
# FLASH_SALE_ALERT_WEBHOOK=<your webhook URL, optional>

# Build TypeScript
pnpm build   # hoặc npm run build
```

## Step 6: Test trước khi chạy

```bash
# Test Supabase + Shopee API connectivity
npx ts-node src/test-api.ts

# Expected output:
# 1. Testing Supabase connection... OK
# 2. Testing signature generation... OK
# 3. Testing Shopee API call... OK
```

Nếu test 3 fail với timeout/connection error → check:
- Elastic IP đã thêm vào Shopee whitelist chưa?
- Security Group có cho outbound HTTPS (port 443) không? (default: Yes)

## Step 7: Start Worker với PM2

```bash
# Start worker
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs realtime
pm2 logs shopee-worker

# Save PM2 process list (auto-restore on reboot)
pm2 save

# Test health check
curl http://localhost:3456/health
```

## Step 8: Verify Worker hoạt động

```bash
# Watch logs for cron triggers (wait 2 minutes)
pm2 logs shopee-worker --lines 50

# Check Supabase: api_call_logs should show entries from 'worker-*'
# Check Supabase: apishopee_flash_sale_auto_history should show processing
```

## Quản lý hàng ngày

```bash
# View status
pm2 status

# View logs
pm2 logs shopee-worker
pm2 logs shopee-worker --lines 100

# Restart
pm2 restart shopee-worker

# Update code
cd /opt/shopee-worker/worker   # hoặc path tương ứng
git pull
pnpm build
pm2 restart shopee-worker

# Monitor resources
pm2 monit

# Check health
curl http://localhost:3456/health
```

## Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| Worker crash liên tục | `pm2 logs shopee-worker --err` xem error |
| Shopee API timeout | Check Security Group outbound rules |
| "Token not found" | Shop chưa authorize, hoặc token expired |
| OOM (out of memory) | Check `free -h`; PM2 tự restart nếu >250MB |
| PM2 không start sau reboot | Chạy lại `pm2 startup systemd` + `pm2 save` |
