/* eslint-disable camelcase */
'use strict';

const got = require('got');
const got1 = require('got');
require('dotenv').config();
const QRCode = require('qrcode');
// 新增  , addWSCKEnv, delWSCKEnv, getWSCKEnvs, getWSCKEnvsCount, updateWSCKEnv enableEnv
const { addEnv, delEnv, getEnvs, getEnvsCount, updateEnv , enableEnv , addWSCKEnv, delWSCKEnv, getWSCKEnvs, getWSCKEnvsCount, updateWSCKEnv } = require('./ql');
const path = require('path');
const qlDir = process.env.QL_DIR || '/ql';
const notifyFile = path.join(qlDir, 'shell/notify.sh');
const { exec } = require('child_process');
const { GET_RANDOM_TIME_UA } = require('./utils/USER_AGENT');

const api = got.extend({
  retry: { limit: 0 },
  responseType: 'json',
});

module.exports = class User {
  ua;
  pt_key;
  pt_pin;
  pin;// 新增变量
  wskey;// 新增变量
  jdwsck;// 新增变量
  code;// 新增变量
  msg;// 新增变量
  cookie;
  eid;
  timestamp;
  nickName;
  token;
  okl_token;
  cookies;
  QRCode;
  remark;
  #s_token;
  // 新增wskey构造入参
  constructor({ token, okl_token, cookies, pt_key, pt_pin, cookie, eid, remarks, remark, ua, pin, wskey, jdwsck}) {
    this.token = token;
    this.okl_token = okl_token;
    this.cookies = cookies;
    this.pt_key = pt_key;
    this.pt_pin = pt_pin;
    this.cookie = cookie;
    this.eid = eid;
    this.remark = remark;
    if (ua) {
      this.ua = ua;
    }

    if (pt_key && pt_pin) {
      this.cookie = 'pt_key=' + this.pt_key + ';pt_pin=' + this.pt_pin + ';';
    }

    if (cookie) {
      this.pt_pin = cookie.match(/pt_pin=(.*?);/)[1];
      this.pt_key = cookie.match(/pt_key=(.*?);/)[1];
    }

    if (remarks) {
      this.remark = remarks.match(/remark=(.*?);/) && remarks.match(/remark=(.*?);/)[1];
    }
/////////////////////////////////////////////////
    // 新增pin
    this.pin = pin;
    // 新增wskey
    this.wskey = wskey;
    // 新增 jdwsck
    this.jdwsck = jdwsck;
    // 新增如果wskey和pin不是空则产生jdwsck
    if (pin && wskey) {
      this.jdwsck = 'pin=' + this.pin + ';wskey=' + this.wskey + ';';
    }

    // 新增如果备注是空则默认取pt_pin作为备注
    if (this.jdwsck && this.remark === null || this.remark === '') {
      this.remark = this.pin;
    }

    // 新增如果nickName是空默认取pt_pin作为备注
    if (this.jdwsck && this.nickName === null || this.nickName === '') {
      this.nickName = this.pin;
    }
/////////////////////////////////////////////////
  }

  async getQRConfig() {
    this.ua = this.ua || process.env.NINJA_UA || GET_RANDOM_TIME_UA();
    const taskUrl = `https://plogin.m.jd.com/cgi-bin/mm/new_login_entrance?lang=chs&appid=300&returnurl=https://wq.jd.com/passport/LoginRedirect?state=${Date.now()}&returnurl=https://home.m.jd.com/myJd/newhome.action?sceneval=2&ufc=&/myJd/home.action&source=wq_passport`;
    const response = await api({
      url: taskUrl,
      headers: {
        Connection: 'Keep-Alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-cn',
        Referer: taskUrl,
        'User-Agent': this.ua,
        Host: 'plogin.m.jd.com',
      },
    });
    const headers = response.headers;
    const data = response.body;
    await this.#formatSetCookies(headers, data);

    if (!this.#s_token) {
      throw new Error('二维码创建失败！');
    }

    const nowTime = Date.now();
    // eslint-disable-next-line prettier/prettier
    const taskPostUrl = `https://plogin.m.jd.com/cgi-bin/m/tmauthreflogurl?s_token=${
      this.#s_token
    }&v=${nowTime}&remember=true`;

    const configRes = await api({
      method: 'post',
      url: taskPostUrl,
      body: `lang=chs&appid=300&source=wq_passport&returnurl=https://wqlogin2.jd.com/passport/LoginRedirect?state=${nowTime}&returnurl=//home.m.jd.com/myJd/newhome.action?sceneval=2&ufc=&/myJd/home.action`,
      headers: {
        Connection: 'Keep-Alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-cn',
        Referer: taskUrl,
        'User-Agent': this.ua,
        Host: 'plogin.m.jd.com',
        Cookie: this.cookies,
      },
    });
    const configHeaders = configRes.headers;
    const configData = configRes.body;

    this.token = configData.token;
    if (this.token)
      this.QRCode = await QRCode.toDataURL(
        `https://plogin.m.jd.com/cgi-bin/m/tmauth?appid=300&client_type=m&token=${this.token}`
      );
    const cookies = configHeaders['set-cookie'][0];
    this.okl_token = cookies.substring(cookies.indexOf('=') + 1, cookies.indexOf(';'));
  }

  async checkQRLogin() {
    await this.#getCloudUA();
    if (!this.token || !this.okl_token || !this.cookies) {
      throw new Error('初始化登录请求失败！');
    }
    const nowTime = Date.now();
    const loginUrl = `https://plogin.m.jd.com/login/login?appid=300&returnurl=https://wqlogin2.jd.com/passport/LoginRedirect?state=${nowTime}&returnurl=//home.m.jd.com/myJd/newhome.action?sceneval=2&ufc=&/myJd/home.action&source=wq_passport`;
    const getUserCookieUrl = `https://plogin.m.jd.com/cgi-bin/m/tmauthchecktoken?&token=${this.token}&ou_state=0&okl_token=${this.okl_token}`;
    const response = await api({
      method: 'POST',
      url: getUserCookieUrl,
      body: `lang=chs&appid=300&source=wq_passport&returnurl=https://wqlogin2.jd.com/passport/LoginRedirect?state=${nowTime}&returnurl=//home.m.jd.com/myJd/newhome.action?sceneval=2&ufc=&/myJd/home.action`,
      headers: {
        Connection: 'Keep-Alive',
        'Content-Type': 'application/x-www-form-urlencoded; Charset=UTF-8',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-cn',
        Referer: loginUrl,
        'User-Agent': this.ua,
        Cookie: this.cookies,
      },
    });
    const data = response.body;
    const headers = response.headers;
    if (data.errcode === 0) {
      const pt_key = headers['set-cookie'][1];
      this.pt_key = pt_key.substring(pt_key.indexOf('=') + 1, pt_key.indexOf(';'));
      const pt_pin = headers['set-cookie'][2];
      this.pt_pin = pt_pin.substring(pt_pin.indexOf('=') + 1, pt_pin.indexOf(';'));
      this.cookie = 'pt_key=' + this.pt_key + ';pt_pin=' + this.pt_pin + ';';

      const result = await this.CKLogin();
      result.errcode = 0;
      return result;
    }

    return {
      errcode: data.errcode,
      message: data.message,
    };
  }

  async CKLogin() {
    let message;
    await this.#getNickname();
    const envs = await getEnvs();
    const poolInfo = await User.getPoolInfo();
    const env = await envs.find((item) => item.value.match(/pt_pin=(.*?);/)[1] === this.pt_pin);
    if (!env) {
      // 新用户
      if (!poolInfo.allowAdd) {
        throw new UserError('管理员已关闭注册，去其他地方看看吧', 210, 200);
      } else if (poolInfo.marginCount === 0) {
        throw new UserError('本站已到达注册上限，你来晚啦', 211, 200);
      } else {
        const remarks = `remark=${this.nickName};`;
        const body = await addEnv(this.cookie, remarks);
        if (body.code !== 200) {
          throw new UserError(body.message || '添加账户错误，请重试', 220, body.code || 200);
        }
        this.eid = body.data._id;
        this.timestamp = body.data.timestamp;
        message = `注册成功，${this.nickName}`;
        this.#sendNotify('工具人 运行通知', `用户 ${this.nickName}(${decodeURIComponent(this.pt_pin)}) 已上线`);
      }
    } else {
      this.eid = env._id;
      const body = await updateEnv(this.cookie, this.eid);
      if (body.code !== 200) {
        throw new UserError(body.message || '更新账户错误，请重试', 221, body.code || 200);
      } else if (body.code === 200) {
        // 启用变量
        const re = await enableEnv(this.eid);
        if (re.code !== 200) {
          throw new UserError(body.message || '启用账户错误，请重试', 221, body.code || 200);
        }
      }
      this.timestamp = body.data.timestamp;
      message = `欢迎回来，${this.nickName}`;
      this.#sendNotify('工具人 运行通知', `用户 ${this.nickName}(${decodeURIComponent(this.pt_pin)}) 已更新 CK`);
    }
    return {
      nickName: this.nickName,
      eid: this.eid,
      timestamp: this.timestamp,
      message,
    };
  }

  async getUserInfoByEid() {
    const envs = await getEnvs();
    const env = await envs.find((item) => item._id === this.eid);
    if (!env) {
      throw new UserError('没有找到这个账户，重新登录试试看哦', 230, 200);
    }
    this.cookie = env.value;
    this.timestamp = env.timestamp;
    const remarks = env.remarks;
    if (remarks) {
      this.remark = remarks.match(/remark=(.*?);/) && remarks.match(/remark=(.*?);/)[1];
    }
    await this.#getNickname();
    return {
      nickName: this.nickName,
      eid: this.eid,
      timestamp: this.timestamp,
      remark: this.remark,
    };
  }

  async updateRemark() {
    if (!this.eid || !this.remark || this.remark.replace(/(^\s*)|(\s*$)/g, '') === '') {
      throw new UserError('参数错误', 240, 200);
    }

    const envs = await getEnvs();
    const env = await envs.find((item) => item._id === this.eid);
    if (!env) {
      throw new UserError('没有找到这个账户，重新登录试试看哦', 230, 200);
    }
    this.cookie = env.value;

    const remarks = `remark=${this.remark};`;

    const updateEnvBody = await updateEnv(this.cookie, this.eid, remarks);
    if (updateEnvBody.code !== 200) {
      throw new UserError('更新/上传备注出错，请重试', 241, 200);
    }

    return {
      message: '更新/上传备注成功',
    };
  }

  async delUserByEid() {
    await this.getUserInfoByEid();
    const body = await delEnv(this.eid);
    if (body.code !== 200) {
      throw new UserError(body.message || '删除账户错误，请重试', 240, body.code || 200);
    }
    this.#sendNotify('工具人 运行通知', `用户 ${this.nickName}(${decodeURIComponent(this.pt_pin)}) 删号跑路了`);
    return {
      message: '账户已移除',
    };
  }

/////////////////////////////////////////////////
  // 新增同步方法
  async WSCKLogin() {
    let message;
    await this.#getCloudUA();
    await this.#getWSCKCheck();
    const envs = await getWSCKEnvs();// 1
    const poolInfo = await User.getPoolInfo();
    const env = await envs.find((item) => item.value.match(/pin=(.*?);/)[1] === this.pin);
    if (!env) {
      // 新用户
      if (!poolInfo.allowWSCKAdd) {
        throw new UserError('管理员已关闭注册，去其他地方看看吧', 210, 200);
      } else if (poolInfo.marginWSCKCount === 0) {
        throw new UserError('本站已到达注册上限，你来晚啦', 211, 200);
      } else {
        const remarks = `remark=${this.nickName};`;
        const body = await addWSCKEnv(this.jdwsck, remarks);
        if (body.code !== 200) {
          throw new UserError(body.message || '添加账户错误，请重试', 220, body.code || 200);
        }
        this.eid = body.data._id;
        this.timestamp = body.data.timestamp;
        message = `录入成功，${this.pin}`;
        this.#sendNotify('工具人 运行通知', `用户 ${this.pin} WSCK 添加成功`);
      }
    } else {
      this.eid = env._id;
      const body = await updateWSCKEnv(this.jdwsck, this.eid);

      if (body.code !== 200) {
        throw new UserError(body.message || '更新WSKEY错误，请重试', 221, body.code || 200);
      } else if (body.code === 200) {
        // 启用变量
        const re = await enableEnv(this.eid);
        if (re.code !== 200) {
          throw new UserError(body.message || '启用WSKEY错误，请重试', 221, body.code || 200);
        }
      }
      this.timestamp = body.data.timestamp;
      message = `欢迎回来，${this.nickName}`;
      this.#sendNotify('工具人 运行通知', `用户 ${this.pin} 已更新 WSCK`);
    }


    return {
      nickName: this.nickName,
      eid: this.eid,
      timestamp: this.timestamp,
      message,
    };
  }

  async getWSCKUserInfoByEid() {
    const envs = await getWSCKEnvs();
    const env = await envs.find((item) => item._id === this.eid);
    if (!env) {
      throw new UserError('没有找到这个账户，重新登录试试看哦', 230, 200);
    }
    this.jdwsck = env.value;
    this.timestamp = env.timestamp;
    const remarks = env.remarks;
    if (remarks) {
      this.remark = remarks.match(/remark=(.*?);/) && remarks.match(/remark=(.*?);/)[1];
    }
    await this.#getNickname();
    return {
      nickName: this.nickName,
      eid: this.eid,
      timestamp: this.timestamp,
      remark: this.remark,
    };
  }

  async updateWSCKRemark() {
    if (!this.eid || !this.remark || this.remark.replace(/(^\s*)|(\s*$)/g, '') === '') {
      throw new UserError('参数错误', 240, 200);
    }

    const envs = await getWSCKEnvs();
    const env = await envs.find((item) => item._id === this.eid);
    if (!env) {
      throw new UserError('没有找到这个wskey账户，重新登录试试看哦', 230, 200);
    }
    this.jdwsck = env.value;

    const remarks = `remark=${this.remark};`;

    const updateEnvBody = await updateWSCKEnv(this.jdwsck, this.eid, remarks);
    if (updateEnvBody.code !== 200) {
      throw new UserError('更新/上传备注出错，请重试', 241, 200);
    }

    return {
      message: '更新/上传备注成功',
    };
  }

  async delWSCKUserByEid() {
    await this.getWSCKUserInfoByEid();
    const body = await delWSCKEnv(this.eid);
    if (body.code !== 200) {
      throw new UserError(body.message || '删除账户错误，请重试', 240, body.code || 200);
    }
    this.#sendNotify('工具人 运行通知', `用户 ${this.nickName}(${decodeURIComponent(this.pt_pin)}) 删号跑路了,CK将无法自动更新并会在不知道那天内自动失效`);
    return {
      message: 'wskey账户已移除',
    };
  }

/////////////////////////////////////////////////

  static async getPoolInfo() {
    const count = await getEnvsCount();
    const countWSCK = await getWSCKEnvsCount();
    const allowCount = (process.env.ALLOW_NUM || 40) - count;
    const allowWSCKCount = (process.env.ALLOW_WSCK_NUM || 40) - countWSCK;
    return {
      marginCount: allowCount >= 0 ? allowCount : 0,
      marginWSCKCount: allowWSCKCount >= 0 ? allowWSCKCount : 0,
      allowAdd: Boolean(process.env.ALLOW_ADD) || false,
      allowWSCKAdd: Boolean(process.env.ALLOW_WSCK_ADD) || false,
      showQR: Boolean(process.env.SHOW_QR) || false,
      showWSCK: Boolean(process.env.SHOW_WSCK) || false,
      showCK: Boolean(process.env.SHOW_CK) || false,
    };
  }

  static async getUsers() {
    const envs = await getEnvs();
    const result = envs.map(async (env) => {
      const user = new User({ cookie: env.value, remarks: env.remarks });
      await user.#getNickname(true);
      return {
        pt_pin: user.pt_pin,
        nickName: user.nickName,
        remark: user.remark || user.nickName,
      };
    });
    return Promise.all(result);
  }

  async #getNickname(nocheck) {
    const body = await api({
      url: `https://me-api.jd.com/user_new/info/GetJDUserInfoUnion?orgFlag=JD_PinGou_New&callSource=mainorder&channel=4&isHomewhite=0&sceneval=2&_=${Date.now()}&sceneval=2&g_login_type=1&g_ty=ls`,
      headers: {
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-cn',
        Connection: 'keep-alive',
        Cookie: this.cookie,
        Referer: 'https://home.m.jd.com/myJd/newhome.action',
        'User-Agent':this.ua,
          /*'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',*/
        Host: 'me-api.jd.com',
      },
    }).json();
    if (!body.data?.userInfo && this.jdwsck) {
      throw new UserError('获取用户信息失败，请检查您的 wskey ！', 201, 200);
    } else if (!body.data?.userInfo && !nocheck) {
      throw new UserError('获取用户信息失败，请检查您的 cookie ！', 201, 200);
    }
    this.nickName = body.data?.userInfo.baseInfo.nickname || decodeURIComponent(this.pt_pin);
  }

  #formatSetCookies(headers, body) {
    return new Promise((resolve) => {
      let guid, lsid, ls_token;
      this.#s_token = body.s_token;
      guid = headers['set-cookie'][0];
      guid = guid.substring(guid.indexOf('=') + 1, guid.indexOf(';'));
      lsid = headers['set-cookie'][2];
      lsid = lsid.substring(lsid.indexOf('=') + 1, lsid.indexOf(';'));
      ls_token = headers['set-cookie'][3];
      ls_token = ls_token.substring(ls_token.indexOf('=') + 1, ls_token.indexOf(';'));
      this.cookies = `guid=${guid};lang=chs;lsid=${lsid};ls_token=${ls_token};`;
      resolve();
    });
  }

  #sendNotify(title, content) {
    const notify = process.env.NINJA_NOTIFY || true;
    if (!notify) {
      console.log('工具人 通知已关闭\n' + title + '\n' + content + '\n' + '已跳过发送');
      return;
    }
    exec(`${notifyFile} "${title}" "${content}"`, (error, stdout, stderr) => {
      if (error) {
        console.log(stderr);
      } else {
        console.log(stdout);
      }
    });
  }
//////////////////////////////////////////////
  /**
   * 新增ZY143L大佬的获取云UA方法
   * @date 20211107
   */
  async #getCloudUA() {
    const cloud_arg = await api({
      url: new Buffer('aHR0cDovLzE1MC4xNTguMTUzLjUzOjg0NDMvY2hlY2tfYXBp','base64').toString(),
      method: 'GET',
      headers:{
        'authorization':new Buffer('QmVhcmVyIFNoaXp1a3U=','base64').toString(),
        'Connection':'close'
      }
    }).json();
    this.ua = cloud_arg['User-Agent'];
  }

  /**
   * 采用ZY143L大佬的签名接口
   * @date 20211107
   * @returns {Promise<{eid: *, nickName: *, message: string, timestamp: *}>}
   */
  async #getWSCKCheck() {
    const s = await api({
        url: new Buffer('aHR0cDovLzE1MC4xNTguMTUzLjUzOjg0NDMvd3NrZXk=','base64').toString(),
        method: 'GET',
        headers:{
          'User-Agent':this.ua,
          'Connection':'close'
        }
      }).json();
    const clientVersion = s['clientVersion']
    const client = s['client']
    const sv = s['sv']
    const st = s['st']
    const uuid = s['uuid']
    const sign = s['sign']
    if (!sv||!st||!uuid||!sign) {
      throw new UserError('获取签名失败，请等待工具人修理 ！', 200, 200);
    }
    const body = await api({
      method: 'POST',
      url: `https://api.m.jd.com/client.action?functionId=genToken&clientVersion=${clientVersion}&client=${client}&uuid=${uuid}&st=${st}&sign=${sign}&sv=${sv}`,
      body: 'body=%7B%22action%22%3A%22to%22%2C%22to%22%3A%22https%253A%252F%252Fplogin.m.jd.com%252Fcgi-bin%252Fm%252Fthirdapp_auth_page%253Ftoken%253DAAEAIEijIw6wxF2s3bNKF0bmGsI8xfw6hkQT6Ui2QVP7z1Xg%2526client_type%253Dandroid%2526appid%253D879%2526appup_type%253D1%22%7D&',
      headers: {
        Cookie: this.jdwsck,
        'User-Agent': this.ua,
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept-Charset': 'UTF-8',
        'Accept-Encoding': 'br,gzip,deflate'
      },
    }).json();
    const response = await got1({
      followRedirect:false,
      url: `https://un.m.jd.com/cgi-bin/app/appjmp?tokenKey=${body['tokenKey']}&to=https://plogin.m.jd.com/cgi-bin/m/thirdapp_auth_page?token=AAEAIEijIw6wxF2s3bNKF0bmGsI8xfw6hkQT6Ui2QVP7z1Xg&client_type=android&appid=879&appup_type=1`,
      headers: {
        'User-Agent': this.ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
        'Accept-Charset': 'UTF-8',
        'Accept-Encoding': 'br,gzip,deflate'
      },
    });
    const headers = response.headers;
    if (headers['set-cookie']) {
      const pt_key = headers['set-cookie'][2];
      this.pt_key = pt_key.substring(pt_key.indexOf('=') + 1, pt_key.indexOf(';'));
      const pt_pin = headers['set-cookie'][3];
      this.pt_pin = pt_pin.substring(pt_pin.indexOf('=') + 1, pt_pin.indexOf(';'));
    }
    if (this.pt_key&&this.pt_pin) {
      this.cookie = 'pt_key=' + this.pt_key + ';pt_pin=' + this.pt_pin + ';';
      const result = await this.CKLogin();
      result.errcode = 0;
      return result;
    }
  }
  ////////////////////////////////////////////////
};

class UserError extends Error {
  constructor(message, status, statusCode) {
    super(message);
    this.name = 'UserError';
    this.status = status;
    this.statusCode = statusCode || 200;
  }
}
