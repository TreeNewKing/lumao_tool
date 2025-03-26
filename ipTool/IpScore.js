import axios from "axios";
import fs from "fs";
var ip123Limit = 0;
var scamLimit = 0;
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import readline from 'readline'
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
// 将 rl.question 包装成 Promise
function askQuestion() {
    return new Promise((resolve) => {
      rl.question('\n是否需要解析动态IP【yes/no】\n', (answer) => {
        resolve(answer); // 用户输入完成后解析 Promise
      });
    });
  }

// 配置浏览器隐身模式
puppeteer.use(StealthPlugin());

async function findIp(proxyString) {
    console.log('开始解析动态IP ',proxyString)
  const browser = await puppeteer.launch({
    headless: true, // 生产环境建议设为true
    args: [
    //   `--proxy-server=http://${proxyString}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // 设置浏览器指纹
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // 访问目标页面
    await page.goto('https://iplau.com/category/ip-detection-tool.html', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 填写表单
    await page.type('input[id="proxyIp"]', proxyString.split(':')[0]);
    await page.type('input[id="proxyPort"]', proxyString.split(':')[1]);
    await page.type('input[id="proxyUsername"]', proxyString.split(':')[2]);
    await page.type('input[id="proxyPassword"]', proxyString.split(':')[3]);


    // 提交表单
    await Promise.all([
    //   page.waitFor(2000),
      page.click('input[id="submitButton"]'),
      await page.waitForResponse('https://tool.iplau.com/proxy-handler.php')
    ]);
    // 提取结果
    const ip = await page.evaluate(() => {
        const rows = document.querySelectorAll('#result .result-table tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells[0].textContent === 'ip') {
            return cells[1].textContent;
          }
        }
        return null;
      });
      return ip
  } finally {
    await browser.close();
  }
}
// ip123
async function detectIpByIp123 (ip) {
    try{
        // console.log('ip',ip)
        var url='http://ip234.in/fraud_check?ip='+ip
        var rs=await axios.get(url)
        return rs.data.data.score
    }catch(e){
        console.log('ip123检测失败')
    }

}
// scam
async function detectIpByscamalytics(ip) {
    try{
    // console.log('ip',ip)
    var url='https://scamalytics.com/ip/'+ip
    var rs=await axios.get(url)
    // console.log(rs.data)
    const regex = /<div class="score">Fraud Score: (.*?)<\/div>/;
    const match = rs.data.match(regex);
    const extractedContent = match[1];
    return extractedContent;
    }catch(e){
        console.log('scam检测失败')
    }
}

// 逐行读取文本文件的内容
const readLinesFromFile = (filename) => {
    try {
        const data = fs.readFileSync(filename, 'utf-8');
        const lines = data.split('\n');
        return lines;
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
};
async function  main() {
    var batchProxyString=readLinesFromFile('./ipTool/ip.txt')
let paraseIsNeeded;
paraseIsNeeded = await askQuestion(); // 等待用户输入
if(paraseIsNeeded=='yes'){
    for (const proxyString of batchProxyString) {
        var tmpIp=await findIp(proxyString.trim())
        console.log('动态IP被解析为 '+tmpIp)
        var ip123Score= await detectIpByIp123(tmpIp)
        var scamScore= await detectIpByscamalytics(tmpIp)
        // 输出满足风控制的代理
        console.log('ip123风控值为=>',ip123Score)
        console.log('sca风控值为=>',scamScore+'\n')
    }
}else{
    for (const proxyString of batchProxyString) {
        console.log('检测的ip为', proxyString)
        var ip123Score= await detectIpByIp123(proxyString)
        var scamScore= await detectIpByscamalytics(proxyString)
        // 输出满足风控制的代理
        console.log('ip123风控值为=>',ip123Score)
        console.log('sca风控值为=>',scamScore+'\n')
    }
}
}
main()


