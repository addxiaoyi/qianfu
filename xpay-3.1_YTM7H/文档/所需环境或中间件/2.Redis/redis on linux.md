1. [官方下载地址](https://redis.io/)
2. Redis的安装

Redis是c语言开发的，安装需要c语言的编译环境,如果没有gcc需要在线安装: yum install gcc\-c\+\+

安装步骤：

第一步：Redis的源码包上传到Linux

第二步：解压缩: tar \-xvf redis\-版本号\.tar\.gz \-C /usr/local

第三步：编译 进入redis源码目录: make

第四步：安装: make install PREFIX=/usr/local/redis

PREFIX参数指定redis的安装目录,一般软件安装到/usr目录下

1. Redis的启动：

前端启动：在redis的安装目录下直接启动redis\-server \[root@localhost bin\]\# \./redis\-server

后台启动：

把 /root/redis\-3\.0\.0/redis\.conf 复制到 /usr/local/redis/bin 目录下 cp redis\.conf /usr/local/redis/bin/

修改 redis\.conf 文件 设置 daemonize yes

启动时添加配置文件 \./redis\-server redis\.conf

关闭：\[root@localhost bin\]\# \./redis\-cli shutdown

1. Redis\-cli连接

默认连接localhost运行在6379端口的redis服务 \[root@localhost bin\]\# \./redis\-cli

自定义连接端口 \[root@localhost bin\]\# \./redis\-cli \-h 192\.168\.25\.153 \-p 6379

\-h：连接的服务器的地址 \-p：服务的端口号

远程连接：注释掉 redis\.conf 中 bind 127\.0\.0\.1 设置 protected\-mode no 重启redis

设置密码：配置文件中添加 requirepass 你的密码 重启redis

详见 [https://github\.com/Exrick/xmall/blob/master/study/Redis\.md](https://github.com/Exrick/xmall/blob/master/study/Redis.md) 

