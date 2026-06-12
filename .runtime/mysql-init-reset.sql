UPDATE mysql.user SET authentication_string=PASSWORD('admin'), plugin='mysql_native_password' WHERE User='root';
FLUSH PRIVILEGES;