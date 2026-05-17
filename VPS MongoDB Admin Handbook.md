# **VPS Administrator's Handbook: Secure MongoDB Deployment & Maintenance**

This document serves as the master blueprint for configuring, securing, and maintaining a production-ready MongoDB environment on a raw Virtual Private Server (VPS).

As the application relies on a containerized MERN stack, this guide specifically addresses the intricacies of running MongoDB securely (whether native or via Docker) on a public-facing server, ensuring the gym management platform's data remains isolated, backed up, and highly available.

## **Phase 1: Foundational Server Hardening**

*These are critical steps that must be performed immediately after provisioning the VPS, before MongoDB is even installed.*

### **1\. SSH Key Authentication & Port Shifting**

Leaving SSH on the default port 22 with password authentication is the fastest way to get breached by brute-force bots.

* **Action:** Generate an SSH key pair locally and add the public key to the VPS \~/.ssh/authorized\_keys.  
* **Action:** Edit /etc/ssh/sshd\_config to:  
  * PasswordAuthentication no  
  * PermitRootLogin no  
  * (Optional) Port 2222 (or another non-standard port).  
* **Action:** Restart the SSH service: sudo systemctl restart ssh

### **2\. Implement Fail2Ban**

Fail2Ban monitors log files and automatically bans IPs that show malicious signs (e.g., too many password failures).

* **Action:** sudo apt install fail2ban  
* **Action:** Create a jail.local configuration to monitor SSH and temporarily ban repeat offenders.

## **Phase 2: MongoDB Network Isolation**

By default, MongoDB only listens to 127.0.0.1 (localhost). To allow the Node.js backend to connect remotely (if hosted on a separate server), you must expose it, but do so carefully.

### **1\. Editing mongod.conf**

Locate the configuration file (usually /etc/mongod.conf for native installs).

net:  
  port: 27017  
  bindIp: 0.0.0.0 \# Binds to all IPv4 addresses

*Note: If the backend and database are on the SAME VPS, keep bindIp: 127.0.0.1. Never expose it to 0.0.0.0 unless absolutely necessary.*

## **Phase 3: Security & Role-Based Access Control (RBAC)**

Fresh MongoDB installations have zero authentication. You must enable it immediately.

### **1\. Create the Root Administrator**

Connect to the MongoDB shell locally (mongosh) and execute:

use admin  
db.createUser({  
  user: "superadmin",  
  pwd: "YourComplexAdminPassword",  
  roles: \[ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" \]  
})

### **2\. Create the Application User**

Never use the root admin for the Node.js backend. Create a scoped user specifically for the gym software:

use gym\_software  
db.createUser({  
  user: "gym\_app\_user",  
  pwd: "AppSpecificPassword",  
  roles: \[ { role: "readWrite", db: "gym\_software" } \]  
})

### **3\. Enable Authorization**

Edit mongod.conf to enforce RBAC, then restart the service (systemctl restart mongod):

security:  
  authorization: "enabled"

## **Phase 4: Firewall Configuration (The Docker Trap)**

### **standard UFW Setup**

Enable the Uncomplicated Firewall (UFW) to block all incoming traffic by default, except for SSH and specific IP addresses needing database access.

sudo ufw default deny incoming  
sudo ufw default allow outgoing  
sudo ufw allow 2222/tcp \# Your custom SSH port  
sudo ufw allow from \<YOUR\_BACKEND\_SERVER\_IP\> to any port 27017  
sudo ufw enable

### **⚠️ CRITICAL DOCKER WARNING**

If you are deploying MongoDB using Docker (via docker-compose), **Docker bypasses UFW by default**. Docker directly modifies iptables. If you map ports like \- "27017:27017" in Docker, the database will be fully exposed to the public internet, regardless of UFW rules.

* **The Fix:** Bind the Docker port strictly to localhost if on the same machine: \- "127.0.0.1:27017:27017" OR use the DOCKER-USER iptables chain to enforce IP restrictions before Docker processes the traffic.

## **Phase 5: SSL/TLS Encryption (Data in Transit)**

Without SSL, queries (including passwords and client data) are sent in plain text.

### **1\. Generate Certificates**

Use Let's Encrypt (Certbot) to generate free SSL certificates for your VPS domain (e.g., db.yourdomain.com).

sudo certbot certonly \--standalone \-d db.yourdomain.com

### **2\. Create the .pem File**

MongoDB requires the private key and certificate to be bundled in a single .pem file.

cat /etc/letsencrypt/live/\[db.yourdomain.com/fullchain.pem\](https://db.yourdomain.com/fullchain.pem) /etc/letsencrypt/live/\[db.yourdomain.com/privkey.pem\](https://db.yourdomain.com/privkey.pem) \> /etc/ssl/mongodb.pem  
sudo chown mongodb:mongodb /etc/ssl/mongodb.pem  
sudo chmod 600 /etc/ssl/mongodb.pem

### **3\. Configure MongoDB for TLS**

Update mongod.conf:

net:  
  tls:  
    mode: requireTLS  
    certificateKeyFile: /etc/ssl/mongodb.pem

*(Your connection URI will now require ?tls=true)*

## **Phase 6: Automated Backups & Automation Pipeline**

Manual backups are a liability. Set up an automated pipeline that dumps the database, compresses it, and sends it to off-site storage (like AWS S3 or Cloudflare R2).

### **1\. The Backup Script (/opt/backups/mongo\_backup.sh)**

\#\!/bin/bash  
TIMESTAMP=$(date \+"%F")  
BACKUP\_DIR="/tmp/mongo\_backup"  
S3\_BUCKET="s3://your-gym-app-backups"

\# Dump the database  
mongodump \--uri="mongodb://superadmin:password@localhost:27017/?authSource=admin" \--out=$BACKUP\_DIR

\# Compress  
tar \-czvf /tmp/gym\_db\_$TIMESTAMP.tar.gz $BACKUP\_DIR

\# Upload via AWS CLI  
aws s3 cp /tmp/gym\_db\_$TIMESTAMP.tar.gz $S3\_BUCKET

\# Cleanup  
rm \-rf $BACKUP\_DIR /tmp/gym\_db\_$TIMESTAMP.tar.gz

\# (Optional) Trigger a POST webhook to an automation tool to confirm success  
curl \-X POST \-H "Content-Type: application/json" \-d '{"status":"Backup Successful", "date":"'$TIMESTAMP'"}' \[https://your-webhook-url.com/backup-alert\](https://your-webhook-url.com/backup-alert)

### **2\. Cron Job Scheduling**

Run the script daily at 3:00 AM.

crontab \-e

0 3 \* \* \* /bin/bash /opt/backups/mongo\_backup.sh \>\> /var/log/mongo\_backup.log 2\>&1

## **Phase 7: Ongoing Maintenance & Monitoring (Often Missed)**

### **1\. Log Rotation**

MongoDB logs grow aggressively. If the disk hits 100% capacity, the database crashes and corrupts. Ensure /etc/logrotate.d/mongodb is configured to compress and delete logs older than 14 days.

### **2\. Resource Limits (OOM Killer Prevention)**

MongoDB is memory-hungry. On a VPS, if it consumes too much RAM, the Linux Out-Of-Memory (OOM) killer will forcefully terminate the process.

* Configure the WiredTiger cache size in mongod.conf to not exceed 50% of the server's available RAM.

### **3\. System Monitoring**

Install a lightweight monitoring agent (like Prometheus Node Exporter or Netdata) to visualize CPU, RAM, and Disk I/O. Set up alerts (via Slack/Email/Webhook) if disk space drops below 20%.

### **4\. Routine OS & Certificate Updates**

* **Certificates:** Let's Encrypt certs expire every 90 days. Ensure a cron job runs certbot renew and then gracefully restarts the MongoDB service to load the new .pem file.  
* **Security Patches:** Schedule a monthly maintenance window to run sudo apt update && sudo apt upgrade and reboot the server.