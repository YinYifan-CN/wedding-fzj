# 婚宴二维码查座签到网页

这是一个可部署到 Vercel 的独立项目。部署成功后，把 Vercel 的网页地址生成二维码，宾客用微信扫码即可打开网页查座和签到。

## 项目文件

- `index.html`：网页入口
- `styles.css`：页面样式
- `guests.js`：宾客名单和桌位坐标
- `app.js`：查座、座位图、签到、后台逻辑
- `api/sign.js`：Vercel 云端签到接口
- `assets/seat-list-1.jpg`、`assets/seat-list-2.jpg`：座次图

## 部署到 Vercel

1. 把本文件夹 `wedding-qr-vercel` 上传到 GitHub。
2. 打开 <https://vercel.com/>，点击 `Add New Project`。
3. 导入这个 GitHub 仓库。
4. 如果仓库里只有这个项目，Root Directory 保持默认即可。
5. 如果仓库里还有其他代码，Root Directory 选择 `wedding-qr-vercel`。
6. Framework Preset 选择 `Other`。
7. Build Command 留空。
8. Output Directory 留空。
9. 点击 `Deploy`。

部署完成后，Vercel 会给你一个网址，例如：

```text
https://your-project.vercel.app
```

把这个网址复制出来生成二维码，宾客扫码就能进入网页。

## 生成二维码

最简单的方法：

1. 打开任意二维码生成网站。
2. 粘贴 Vercel 部署后的网址。
3. 下载二维码图片。
4. 打印出来放在签到台。

也可以直接在微信里把网址发给自己，长按链接复制，生成二维码。

## 签到数据汇总

如果只部署网页，不配置数据库：

- 查座、座位图都能正常使用。
- 签到会保存在当前手机浏览器本地。
- 后台只能看到当前设备上的签到记录。

如果要所有宾客手机的签到统一汇总到后台，需要在 Vercel 项目里配置 KV 存储。

### 配置 Vercel KV

1. 进入 Vercel 项目。
2. 打开 `Storage`。
3. 创建或绑定一个 KV 数据库。
4. 确认项目环境变量里有：

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

5. 重新部署项目。

配置完成后，所有宾客提交的签到都会进入云端，后台可以统一查看。

## 后台入口

网页底部点击 `后台`。

默认密码：

```text
5201314
```

如需修改，编辑 `app.js` 顶部的 `ADMIN_PASSWORD`。
