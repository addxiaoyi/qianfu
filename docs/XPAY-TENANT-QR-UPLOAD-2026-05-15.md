# XPay 租户二维码上传说明

## 已完成
- 后台控制台已支持给租户支付方式直接上传二维码图片
- 当前支持:
  - `alipay`
  - `wechat`
  - 代码层已预留 `qqpay`
  - 代码层已预留 `unipay`

## 后台入口
- 登录页: `http://127.0.0.1:8888/admin/login`
- 后台页: `http://127.0.0.1:8888/admin/dashboard`

## 使用方式
1. 进入后台
2. 打开某个租户卡片
3. 在支付方式区域选择图片文件
4. 点击“上传二维码”
5. 上传成功后会自动回填 `qrImagePath`
6. 再点“保存配置”即可完成该租户支付方式配置

## 上传接口
- `POST /admin/tenants/{tenantId}/payment-methods/{payType}/qr`
- 表单字段:
  - `file`

## 支持格式
- `png`
- `jpg`
- `jpeg`
- `webp`

## 存储位置
- 本地源码目录:
  - `src/main/resources/static/assets/qr/tenants/{tenantKey}/{payType}/`
- 对外访问路径:
  - `/assets/qr/tenants/{tenantKey}/{payType}/{filename}`

## 当前行为
- 上传成功后会自动把对应租户支付方式的 `qrImagePath` 更新为新路径
- 若该支付方式记录不存在，会自动创建
- 默认会启用该支付方式

## 注意
- 这是当前本地/源码目录存储方案，适合现阶段独立部署
- 如果后续要做更正规生产化，建议迁移到:
  - 对象存储
  - 独立文件盘
  - CDN + 持久化挂载
