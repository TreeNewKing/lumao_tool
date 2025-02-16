const socks = require('socksv5');
const { Client } = require('ssh2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const readline = require('readline'); // 用于从控制台读取用户输入

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


const sshConfig = {
  host: process.env.SSH_HOST,
  port: process.env.SSH_PORT,
  username: process.env.SSH_USERNAME,
  password: process.env.SSH_PASSWORD
};
var LocalProxyPort=process.env.LocalProxyPort
// 提示用户输入
function promptUser(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim()); // 返回用户输入并去除前后空格
      });
    });
  }

// 检查 API_KEY 和 SECRET_KEY 是否为空，并提示用户输入
async function checkAndPromptForKeys() {
    if (!sshConfig.host) {
        sshConfig.host= await promptUser('请输入你的代理服务器IP\n');
    }
    if (!sshConfig.port) {
      sshConfig.port = await promptUser('请输入你的代理服务器端口\n');
    }
    if(!sshConfig.username){
        sshConfig.username=await promptUser('请输入你的代理服务器用户\n');
    }
    if(!sshConfig.password){
        sshConfig.password=await promptUser('请输入你的代理服务器密码\n');
    }
    
  }

async function main() {
    await checkAndPromptForKeys()
  return new Promise((resolve, reject) => {
    // 创建 SOCKS5 服务器
    const socksServer = socks.createServer((info, accept, deny) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.forwardOut(info.srcAddr, info.srcPort, info.dstAddr, info.dstPort, (err, stream) => {
          if (err) {
            conn.end();
            return deny();
          }

          const clientSocket = accept(true);
          if (clientSocket) {
            stream.pipe(clientSocket).pipe(stream).on('close', () => {
              conn.end();
            });
          } else {
            conn.end();
          }
        });
      }).on('error', (err) => {
        console.error('SSH connection error:', err);
        deny();
        reject(err); // 如果 SSH 连接失败，拒绝 Promise
      }).connect(sshConfig);
    });

    // 启动 SOCKS5 服务器
    socksServer.listen(LocalProxyPort, 'localhost', () => {
      console.log(`SOCKSv5 proxy server started on port ${LocalProxyPort}`);
      resolve(true); // 服务器启动成功，返回 true
    }).useAuth(socks.auth.None());

    // 处理 SOCKS5 服务器的错误
    socksServer.on('error', (err) => {
      console.error('SOCKS5 server error:', err);
      reject(err); // 如果 SOCKS5 服务器启动失败，拒绝 Promise
    });
  });
}
// main()
// 导出 main 方法
module.exports = {main};
// 如果是直接运行该脚本，则调用 main 方法
if (require.main === module) {
    main().catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
}