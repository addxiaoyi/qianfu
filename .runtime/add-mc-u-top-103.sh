set -euo pipefail
cat > /www/server/panel/vhost/nginx/mc-u.top.conf <<'CONF'
upstream qianfu_api_mc_u {
    server 127.0.0.1:3001;
    keepalive 64;
}

upstream qianfu_xpay_mc_u {
    server 127.0.0.1:8889;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name mc-u.top www.mc-u.top;
    root /www/wwwroot/qianfu-app/qianfu-liandeng/dist;
    index index.html;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://qianfu_api_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /auth/ {
        proxy_pass http://qianfu_api_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /api-docs {
        proxy_pass http://qianfu_api_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /xpay/ {
        rewrite ^/xpay/?(.*)$ /$1 break;
        proxy_pass http://qianfu_xpay_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /admin/ {
        proxy_pass http://qianfu_xpay_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /open/ {
        proxy_pass http://qianfu_xpay_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /assets/css/ {
        proxy_pass http://qianfu_xpay_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /assets/images/ {
        proxy_pass http://qianfu_xpay_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /assets/js/ {
        proxy_pass http://qianfu_xpay_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /assets/qr/ {
        proxy_pass http://qianfu_xpay_mc_u;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location = /health {
        proxy_pass http://qianfu_api_mc_u/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
CONF
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
curl -I -sS -H 'Host: mc-u.top' http://127.0.0.1/
curl -I -sS -H 'Host: mc-u.top' http://127.0.0.1/api/health