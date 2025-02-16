const axios = require('axios');
const path = require('path');
const fs = require('fs'); // 引入文件系统模块
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const crypto = require('crypto');
const { SocksProxyAgent } = require('socks-proxy-agent');
const proxyConnector = require('./ProxyConnector');
const readline = require('readline'); // 用于从控制台读取用户输入
let intervalMs//
// 创建 readline 接口操作失败
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 从环境变量中读取 API_KEY 和 SECRET_KEY
let API_KEY = process.env.BINANCE_API_KEY;
let SECRET_KEY = process.env.BINANCE_SECRET_KEY;
let LOCAL_PORT=process.env.LocalProxyPort
// 检查 API_KEY 和 SECRET_KEY 是否为空，并提示用户输入
async function checkAndPromptForKeys() {
  if(!intervalMs){
    intervalMs=await promptUser('请输入提币时间间隔\n')
    if (isNaN(intervalMs) || intervalMs < 0) {
      throw new Error('输入的间隔时间无效，请输入一个正整数。\n');
      intervalMs = null; // Reset to null to make the loop continue
    }
    
  }
  if (!API_KEY) {
    API_KEY = await promptUser('请输入您的 Binance API_KEY: ');
  }
  if (!SECRET_KEY) {
    SECRET_KEY = await promptUser('请输入您的 Binance SECRET_KEY: ');
  }

}

// 提示用户输入
function promptUser(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim()); // 返回用户输入并去除前后空格
    });
    
  });
}

// 签名函数
function signature(params) {
  const queryString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  // console.log('queryString', queryString);
  return crypto
    .createHmac('sha256', SECRET_KEY) // 使用用户输入的 SECRET_KEY
    .update(queryString)
    .digest('hex');
}

// 提现请求函数
async function withdraw(coin, network, address, amount) {
  const socksAgent = new SocksProxyAgent(`socks5://localhost:${LOCAL_PORT}`);

  const BASE_URL = 'https://api1.binance.com';
  try {
    const timestamp = Date.now();
    const params = {
      address: address,
      amount: amount,
      coin: coin,
      network: network,
      recvWindow: 5000,
      timestamp: timestamp,
    };

    params.signature = signature(params);
    console.log('正在发送提现请求...');

    const response = await axios.post(`${BASE_URL}/sapi/v1/capital/withdraw/apply`, null, {
      headers: { 'X-MBX-APIKEY': API_KEY }, // 使用用户输入的 API_KEY
      params,
      httpsAgent: socksAgent,
      timeout: 300000,
    });

    console.log(`【${address}】提现成功 ${intervalMs}ms 后进行下一次提现`);
    return response.data;
  } catch (error) {
    console.error('操作失败:', error.response?.data || error.message);
    throw error;
  }
}

// 读取提现列表文件并解析
function readWithdrawList() {
  const filePath = path.resolve(__dirname, '../withdrawList.txt'); // 上一级目录的 withdrawList.txt
  const fileContent = fs.readFileSync(filePath, 'utf-8'); // 读取文件内容
  const lines = fileContent.split('\n').filter((line) => line.trim() !== ''); // 按行分割并过滤空行

  // 解析每一行数据
  const withdrawParams = lines.map((line) => {
    const [coin, network, address, amount] = line.split(':').map((item) => item.trim());
    return { coin, network, address, amount: parseFloat(amount) }; // 转换为对象
  });
// console.log('withdrawList',withdrawParams)
  return withdrawParams;
}

// 延时函数
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 主函数
async function main() {
  try {
    
    // 检查并提示用户输入 API_KEY 和 SECRET_KEY
    await checkAndPromptForKeys();
    await proxyConnector.main(); // 确保连接成功
    // 打印用户输入的 API_KEY 和 SECRET_KEY（仅用于调试，生产环境不要打印密钥）
    // console.log('API_KEY:', API_KEY);
    // console.log('SECRET_KEY:', SECRET_KEY);

    // 提示用户输入提现间隔时间（单位为毫秒）


    // 读取提现列表
    const withdrawParamsList = readWithdrawList();
    console.log('提现列表:', withdrawParamsList);

    // 循环调用提现函数，每次提现之间间隔用户指定的时间
    for (const params of withdrawParamsList) {
      try {
        await withdraw(params.coin, params.network, params.address, params.amount);
      } catch (error) {
        console.error(`提现失败: ${params.coin} ${params.address}`, error.message);
      } finally {
        await delay(intervalMs); // 每次提现后等待用户指定的时间
      }
    }
  } catch (error) {
    console.error('程序运行失败:', error);
  } finally {
    rl.close(); // 关闭 readline 接口
  }
}

// 启动程序
main();