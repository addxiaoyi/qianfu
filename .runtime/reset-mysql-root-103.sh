set -euo pipefail
systemctl stop mysqld
pkill -f '/www/server/mysql/bin/mysqld' || true
sleep 3
nohup /www/server/mysql/bin/mysqld_safe --defaults-file=/etc/my.cnf --skip-grant-tables --skip-networking >/tmp/mysql-reset.log 2>&1 &
sleep 8
mysql --socket=/tmp/mysql.sock -uroot -e "FLUSH PRIVILEGES;" || true
mysql --socket=/tmp/mysql.sock -uroot -N -e "SELECT User,Host,plugin FROM mysql.user;"
mysql --socket=/tmp/mysql.sock -uroot -e "UPDATE mysql.user SET authentication_string=PASSWORD('admin'), plugin='mysql_native_password' WHERE User='root'; FLUSH PRIVILEGES;"
pkill -f '/www/server/mysql/bin/mysqld' || true
sleep 3
systemctl start mysqld
sleep 8
mysql -uroot -padmin -e 'select 1 as ok;'