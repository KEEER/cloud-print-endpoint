Cloud Print项目文档
==================
Nov 17, 2019

## 技术文档

Cloud Print 作为基于 Web 的应用，共分为 2 部分：远端（Remote）服务器与终端（Endpoint）服务器。远端采用 Python 3 基于 Flask 框架编写，以 Postgre SQL 作为数据库；终端采用 Javascript 基于 Node.js 框架编写；账户系统通过内部 API 接入 KEEER 账号服务（KEEER Account Service, KAS）。

远端主要负责了用户身份验证、价格计算与扣费、维护终端在局域网下可用的IP地址等。终端则主要负责打印机的管理与控制、打印文件的解析等。
​
用户界面采用质感设计（Material Design）。

### 后端业务
#### 综述

后端业务按用户体验操作可分为如下几个功能块：

| 名称               | 涉及到的服务器    | 描述                                                                                 |
|--------------------|-------------------|--------------------------------------------------------------------------------------|
| 注册或登录         | KAS（后端）、远端 | 用户通过 KAS 对远端服务器登录，或注册一个 KAS 账号。                                 |
| 上传文件           | 远端、终端        | 用户向终端服务器上传文件。                                                           |
| 更改打印配置       | 远端、终端        | 用户通过远端修改打印配置（份数、双面打印选项、彩色打印选项），一个打印码对应一个文件 |
| 输入打印码打印     | 终端、远端        | 用户在终端输入打印码打印                                                             |
| 打印机异常状态提醒 | 远端、终端        | 同步打印机异常状态到远端，短信提醒运维人员进行维护                                   |
| 打印机选择与连接   | 远端、终端        | 用户可以根据不同打印机的位置情况选择不同的打印机                                     |

#### 复杂过程流程图

- 登录（或注册）

```sequence
User->Cloud Print: Request Login Page
Cloud Print-->User: 302 redirect: KAS
KAS->User: Responds customized login page
User->KAS: Login (or register)
KAS->User: write Cookie: kas-account-token, \n redirect to cloud rint
User->Cloud Print: Request Printer Discovery page
```

- 定位局域网内打印服务器

```sequence
User->Cloud Print: Request printers' IPs
Cloud Print->User: Printers' IPs
User->Printer1: Get Status
Printer1->User: Status
User->Printer2: Get Status
Printer2->User: Status
User->Printer3: Get Status
Printer3->User: Status
```

#### API

##### 远端（Remote）

| API               | 描述                                                 |
| ----------------- | ---------------------------------------------------- |
| Login             | 登录（或注册）Cloud Print打印服务                    |
| DeleteJobToken    | 删除打印任务                                         |
| RequestJobCodes   | 列举用户下的所有打印任务的打印码                     |
| RequestJobToken   | 每一次文件上传或需求更改时索求用以标明身份的打印口令 |
| RequestPrinterIPs | 索求打印机群的最新内网IP地址                         |
| UpdatePrinterIP   | 更新打印机IP地址                                     |
| CalculatePrice    | 基于打印配置计算价格                                 |
| Print             | 支付并打印一项打印任务                               |
| StatusReport      | （通过用户）报告打印机状态                           |
| ErrorReport       | 打印机报告错误                                       |

###### Login 登录（或注册）

  `GET /`

  该接口将反馈一个重定向至KAS的自定义登录页进行继续操作；完成后一个名为 `kas-account-token` 会跳转至主页。

  

###### RequestJobCodes

  `GET /_api/codes`

  列举用户下的所有打印任务的打印码



返回参数

| 参数名    | 参数类型      | 是否一定存在 | 解释                                            |
| --------- | ------------- | ------------ | ----------------------------------------------- |
| codes     | Array<string> | 是           | 所有打印码的列表                                |
| timestamp | int           | 是           | 时间戳                                          |
| sign      | String<32>    | 是           | 对于打印码以`','`连接后与时间戳直接拼接后的签名 |

###### RequestJobToken（索求打印口令）

  `GET /_api/job-token`

  该接口将通过用户的KAS口令（存储于cookie）换取一个可以表明让终端服务器信任的身份的打印口令。

请求参数

| 参数名 | 参数类型 | 是否一定存在 | 解释                                                     |
|--------|----------|--------------|----------------------------------------------------------|
| code   | string   | 否           | 用于在终端服务器输入开始打印任务的唯一打印码；新任务留空 |

  返回参数

| 参数名    | 参数类型   | 是否一定存在 | 解释                                                         |
| --------- | ---------- | ------------ | ------------------------------------------------------------ |
| code      | string     | 是           | 用于在终端服务器输入开始打印任务的唯一打印码                 |
| timestamp | int        | 是           | 时间戳                                                       |
| sign      | String(32) | 是           | 使用RSA加密过的包含之前两项以字符串形式拼接的SHA256哈希签名，解密方式为使用终端服务器的公钥进行解密。 |

###### DeleteJobToken（删除打印任务）

  `GET /_api/delete-job-token`

  该接口将通过用户的KAS口令（存储于cookie）删除一个打印任务。如果存在签名项，则通过签名确认发起调用者身份，确认后将任务删除


请求参数

| 参数名 | 参数类型 | 是否一定存在 | 解释                                                     |
|--------|----------|--------------|----------------------------------------------------------|
| code   | string   | 是           | 用于标明即将删除的打印任务。 |
| sign   | string   | 否           |  终端服务器调用时存在。使用RSA加密过的包含`code`的SHA256哈希签名，解密方式为使用终端服务器的公钥进行解密。 |

###### RequestPrinterIPs（索求打印机地址）

  `GET /_api/printer-ips`

  该接口将通过用户的打印服务会话口令换取全部打印机的IP地址（以供测试是否可访问）

  请求参数：无

  返回参数

| 参数名 | 参数类型     | 是否一定存在 | 解释               |
|--------|--------------|--------------|--------------------|
|        | List<String> | 是           | 全部打印机的IP地址 |

- 对于 `printer-ips` 参数的进一步解释：

```json
[
  "172.17.136.183",
  "172.17.134.178",
  "172.17.58.96",
  "172.17.147.32"
]
```

  

###### UpdatePrinterIP（更新打印机IP地址）

  `POST /_api/printer-ip`

  终端在IP地址变更时异步请求该接口更新打印机IP地址。

  请求参数

| 参数名 | 参数类型   | 是否必须 | 解释         |
|--------|------------|----------|--------------|
| id     | String     | 是       | 打印机编码   |
| ip     | String     | 是       | 当前打印机IP |
| sign   | String(32) | 是       | 对于签名     |

  返回参数

  此API成功调用后无返回值（返回为头状态码200的空字符串）

###### CalculatePrice（计算价格）

  `GET /_api/calculate-price`

  该接口允许用户通过打印配置计算价格。

  请求参数

| 参数名 | 参数类型     | 是否必须 | 解释     |
| ------ | ------------ | -------- | -------- |
| id     | string       | 是       | 打印机ID |
| config | Object(Json) | 是       | 打印配置 |

  返回参数

| 参数名 | 参数类型 | 是否一定存在 | 解释           |
|--------|----------|--------------|----------------|
| price  | int      | 是           | 价格，单位为分 |

###### Print（打印并支付）

  `GET /_api/print`

  请求参数

| 参数名 | 参数类型   | 是否必须 | 解释                       |
| ------ | ---------- | -------- | -------------------------- |
| code   | string     | 是       | 打印码                     |
| config | String     | 是       | 打印参数，JSON编码         |
|        | string     | 是       | 打印机ID                   |
| sign   | String<32> | 是       | 对于前两项字符串拼接的签名 |

   - 对于 `configs` 的进一步解释如下：

```json
{
   "page-count": 1,
   "colored": true,
   "double-sided": false
}
```

  返回参数

| 参数名  | 参数类型 | 是否一定存在 | 解释                           |
|---------|----------|--------------|--------------------------------|
| status  | int      | 是           | 支付结果状态                   |
| message | string   | 是           | 来自服务器对支付结果状态的解释 |

###### StatusReport

`POST /_api/status-report`

报告打印机异常状态

请求参数 打印机 `GET /status` 的消息，或连接错误信息

示例：

```json
{
  "status": 0,
  "response": {
    "name": "Test Printer",
    "geolocation": null,
    "status": {
      "bw": "idle",
      "colored": "idle"
    },
    "message": "黑白打印机待命，彩色打印机待命"
  }
}
```

或：

```json
{
  "status": 1,
  "message": "NetworkError when attempting to fetch resource."
}
```

返回参数 无

###### ErrorReport

  `GET /_api/error-report`

  请求参数

| 参数名 | 参数类型   | 是否必须 | 解释                       |
| ------ | ---------- | -------- | -------------------------- |
| status | String     | 是       | 错误信息，JSON编码         |
| id     | string     | 是       | 打印机ID                   |
| sign   | String<32> | 是       | 对于前两项字符串拼接的签名 |

   - 对于 `status` 的进一步解释如下：

```json
{
  "status": {
    "bw": "out-of-paper",
    "colored": "paper-jam"
  }
}
```

  返回参数

| 参数名  | 参数类型 | 是否一定存在 | 解释                           |
|---------|----------|--------------|--------------------------------|
| status  | int      | 是           | 支付结果状态                   |
| message | string   | 是           | 来自服务器对支付结果状态的解释 |

##### 终端（Endpoint）

| API                      | 描述                         |
|--------------------------|------------------------------|
| UploadFile               | 处理用户上传文件的事件       |
| RequestJobConfigurations | 请求打印配置                 |
| ModifyFileConfiguration  | 更改打印配置                 |
| RemoveFile               | 取消打印文件                 |
| RequestStatus            | 获取打印机状态（测试可用性） |

###### UploadFile（上传文件）

  `POST /job`

  该接口允许用户换取打印服务会话口令。

  请求参数

| 参数名    | 参数类型     | 是否必须 | 解释             |
|-----------|--------------|----------|------------------|
| token     | Object(Json) | 是       | 打印口令         |
| file      | file         | 是       | 要打印的文件本体 |

  - 对于 `token` 的进一步解释：

```json
{
  "code": "1234",
  "nonce": "b86767e9-31de-49be-bd42-a93c49720be9",
  "sign": "796fa5cd22d952595e7780698d70d5f93adf7d87262f3ac12ec77ed75b26c201e79830d9fabcad3489d321154a1a552cdf677df8b1a877e17ffb30215117dae96b42eda88713946834dc64945f8d2199e4a584502d91d811bdb0f7ce80d398dc9040653320c52c8f6d06771a2347e49fe4ce0c4ab91514cf8ff6cbe889e0e6000e827e4d9c37893a77b7a09eed6c4866ae1b6e2b71f3987eee59c41ed670ea629c4de33fec9559c099c1c18a2bb7b97e09f05aa4c727aed816ec257019c381e46f081333c474136ef51380eeae16caa87b97606bad77cec9f8a611b27bb9f6205b4a9b49fd0cd6c6a7e7705b4b356560dd841963e7f6e75dfa045390a5b8a6ca"
}
```

返回参数

| 参数名              | 参数类型     | 是否一定存在                                      | 解释                               |
|---------------------|--------------|---------------------------------------------------|------------------------------------|
| status              | int          | 是                                                | 文件状态                           |
| message             | string       | 当且仅当 `status` 不为0（即失败）时存在           | 服务器对错误的描述                 |
| response.id         | string       | 当且仅当 `status` 为0（即上传并且解析成功）时存在 | 文件ID，用于更改与删除该文件时使用 |
| response.config     | Object(JSON) | 当且仅当 `status` 为0（即上传并且解析成功）时存在 | 打印配置                           |
| response.page-count | int          | 当且仅当 `status` 为0（即上传并且解析成功）时存在 | 文件页数                           |
| response.time       | int          | 当且仅当 `status` 为0（即上传并且解析成功）时存在 | 上传时间                           |

- 对于 `config` 的进一步解释如下：

```json
{
  "copies": 1,
  "colored": true,
  "double-sided": false
}
```

###### RequestConfigurations

  `POST /get-configs`

  该接口允许用户获取打印配置。

  请求参数

| 参数名 | 参数类型      | 是否必须 | 解释       |
|--------|---------------|----------|------------|
| codes  | Array<string> | 是       | 打印码     |
| sign   | String<32>    | 是       | 服务器签名 |

  返回参数

| 参数名        | 参数类型              | 是否必须 | 解释     |
|---------------|-----------------------|----------|----------|
| status        | int                   | 是       | ok === 0 |
| response      | Array<Configurations> | 是       | 打印配置 |

###### ModifyFileConfiguration（更改打印配置）
  该接口允许用户更改打印文件的配置

  `POST /set-config`

  请求参数

| 参数名        | 参数类型     | 是否必须 | 解释                     |
|---------------|--------------|----------|--------------------------|
| token         | Object(Json) | 是       | 打印口令                 |
| id            | string       | 是       | 文件ID，用于更改文件配置 |
| config        | Object(Json) | 是       | 新的配置                 |

  - 对于 `token` 的解释参见上条请求参数
  - 对于 `config` 的解释参见上条返回参数

  返回参数
    此API成功调用后无返回值（返回为头状态码 200 的 `{"status":0}`）

###### RemoveFile（删除文件）

  `POST /delete-job`

  该接口允许用户删除所上传的文件。

  请求参数

| 参数名    | 参数类型     | 是否必须 | 解释                     |
|-----------|--------------|----------|--------------------------|
| token     | Object(Json) | 是       | 打印口令                 |
| id        | string       | 是       | 文件ID，用于删除文件配置 |

  - 对于 `token` 的解释参见上条请求参数

  返回参数
    此API成功调用后无返回值（返回为头状态码200的空字符串）

###### RequestStatus（获取打印机状态）

  `GET /status`

  该接口用来获得终端服务器状态

  请求参数

    该API不需要请求参数

  返回参数

| 参数名   | 参数类型     | 是否必须 | 解释       |
|----------|--------------|----------|------------|
| status   | int          | 是       | 0 表示正常 |
| response | object       | 是       | 打印机状态 |

  - 对于 `response` 的进一步解释如下：

```json
{
  "name": "ICC 四楼东侧",
  "geolocation": null,
  "message": null,
  "status": "待命"
}
```

或：

```json
{
  "name": "ICC 四楼东侧",
  "geolocation": null,
  "message": "黑白打印机缺纸",
  "status": "正在打印中"
}
```

### 前端业务
前端共分为两部分：远端前端（主要）与终端前端。前端使用质感设计。自定义空间被允许，但是最终视觉效果要**保证易懂、简洁、好看**。

#### 远端前端

远端前端包括以下（主要）页面：

| 页面名           | 来源                       | 描述                                                                                                   |
|------------------|----------------------------|--------------------------------------------------------------------------------------------------------|
| PrinterDiscovery | KAS登录成功后的重定向      | 该页面允许用户查看并选择当前局域网内的所有打印机                                                       |
| Index            | PrinterDiscovery；直接访问 | 该页面允许用户添加与删除（要打印的）文件、修改成功添加文件的打印配置、告知用户打印费用、Kredit余额等。 |

### 分工

对于Cloud Print的开发，开发者们被分为三部分：

- 前端：梁亚伦、陈驭祺、霍岱宣、李知非
- 远端：霍岱宣、吴习哲、李知非
- 终端：梁亚伦、李知非

#### 前端

陈驭祺负责用户界面的设计，由梁亚伦与霍岱宣进行审核与指导；并由樊天怡提供指导与改进意见。

梁亚伦与霍岱宣共同带领陈驭祺、李知非完成 PrinterDiscovery 页面的开发作为教学培训，之后的页面主要由陈驭祺、霍岱宣、李知非完成开发。

#### 远端

霍岱宣负责远端代码的最终审核，开发由霍岱宣、吴习哲、李知非共同完成。

霍岱宣带领吴习哲、李知非完成API列表中前三个的开发，其余分工如下：

- 第4、5个API：李知非
- 第6、7个API：吴习哲

#### 终端

梁亚伦负责终端的开发，李知非学习开发过程。

梁亚伦带领李知非完成终端尚未实现的 API。

## 非技术文档

对于非技术部分，要点包括但不限于如下内容：

- 公关
- 宣传
- 运维
- 条款
  - Kredit 的细则条款
  - Cloud Print 服务条款

### 公关

内容待完成。

### 宣传

内容待完成。

### 运维

内容待完成。

### 条款

内容待完成。
