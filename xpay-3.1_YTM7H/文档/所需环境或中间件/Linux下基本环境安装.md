Linux系统版本：Cenos7\.x 其他系统版本请百度

1. 更新yum：yum update
2. JDK1\.8安装

查看可安装JDK版本： yum list java\*

安装指定1\.8版本： yum \-y install java\-1\.8\.0\-openjdk\*

查看是否安装成功：java –version

1. MariaDB\(MySQL\)数据库安装

注：默认CentOS7已没有MySQL源, MySQL隶属的sun公司被甲骨文收购，担心闭源的社区人员维护的一个新的分支

安装：yum install mariadb\-server

配置初始化 启动服务 service mariadb start

初始化命令 mysql\_secure\_installation

回车

Set root password? \[Y/n\] <– 是否设置root用户密码，建议y

New password: <– 设置root用户的密码

Re\-enter new password: <– 确认你设置的密码

其他配置

Remove anonymous users? \[Y/n\] <– 是否删除匿名用户，建议y

Disallow root login remotely? \[Y/n\] <–是否禁止root远程登录，建议y

Remove test database and access to it? \[Y/n\] <– 是否删除test数据库，建议y

Reload privilege tables now? \[Y/n\] <– 是否重新加载权限表，建议y

新增远程管理用户 登录数据库：mysql \-u root \-p 输入密码，回车

使用mysql数据库：use mysql

新增用户，name用户名，pwd密码，%代表任何客户端机器上能以该用户登录到MySQL服务器：CREATE USER 'name'@'%' IDENTIFIED BY 'pwd';

授权

//grant 普通 DBA 管理某个 MySQL 数据库的权限

grant all privileges on 你的某个db名 to 用户名;

//grant 高级 DBA 管理 MySQL 中所有数据库的权限 建议

grant all on \*\.\* to 用户名;

//刷新权限

flush privileges;­

输入exit或Ctrl\+c退出，重启MySQL：service mariadb restart

设置开机启动：systemctl enable mariadb

1. 文件上传安装

yum \-y install lrzsz

1. 创建swap空间

通常创建物理内存2~2\.5倍大小的文件作为交换区，创建2G的swap交换区空白文件名为swapfile dd if=/dev/zero of=/root/swapfile bs=1M count=2048

格式化文件为swap文件系统 mkswap swapfile

启用：swapon swapfile

设置开机自动启用swap文件交换区，修改/etc/fstab，增加一行 /root/swapfile swap swap defaults 0 0

关闭swap：swapoff swapfile

具体其他Linux命令详见[https://github\.com/Exrick/xmall/blob/master/study/Linux\.md](https://github.com/Exrick/xmall/blob/master/study/Linux.md) 

