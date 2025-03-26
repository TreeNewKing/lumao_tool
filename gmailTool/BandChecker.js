const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const path = require('path');
const fs = require('fs'); // 引入文件系统模块

// 读取提现列表文件并解析
function readgmailList() {
  const filePath = path.resolve(__dirname, './gmailList.txt'); // 上一级目录的 withdrawList.txt
  const fileContent = fs.readFileSync(filePath, 'utf-8'); // 读取文件内容
  const lines = fileContent.split('\r\n',).filter((line) => line.trim() !== ''); // 按行分割并过滤空行
// console.log(lines)
  // 解析每一行数据
//   const withdrawParams = lines.map((line) => {
//     const [coin, network, address, amount] = line.split(':').map((item) => item.trim());
//     return { coin, network, address, amount: parseFloat(amount) }; // 转换为对象
//   });
// console.log('withdrawList',withdrawParams)
  return lines;
}



// 配置发件人信息（需开启两步验证并使用应用专用密码）
const config = {
  service: 'gmail',
  auth: {
    user: 'treenewking@gmail.com',
    pass: '' // 使用生成的16位应用密码
  }
};

// 创建 SMTP 传输对象
const transporter = nodemailer.createTransport(config);

// 主函数：检查邮箱状态
async function checkEmailStatus(receiverEmail) {
  try {
    // 发送测试邮件
    const info = await transporter.sendMail({
      from: `"Test Sender" <${config.auth.user}>`,
      to: receiverEmail,
      subject: `邮箱状态检测 - ${receiverEmail}`,
      text: '这是一封自动发送的状态检测邮件'
    });

    // 等待 3 秒后检查退信
    await new Promise(resolve => setTimeout(resolve, 3000));
    const isBounced = await checkForBounce(config.auth.user, config.auth.pass, receiverEmail);

    // 根据退信结果输出
    if (isBounced) {
      console.log(`${receiverEmail}: 邮箱无效或不存在`);
    } else {
      console.log(`${receiverEmail}: 未发现风控`);
    }
  } catch (error) {
    handleSmtpError(error, receiverEmail);
  }
}

// SMTP 错误处理函数
function handleSmtpError(error, email) {
  if (error.responseCode === 550) {
    console.log(`${email} 已被风控`);
  } else if (error.responseCode >= 500) {
    // console.error(`[服务器错误] 发送到 ${email} 失败: ${error.response}`);
  } else {
    // console.log(`${email} 未显示风控`);
  }
}

// IMAP 检查退信函数
async function checkForBounce(user, password, targetEmail) {
  return new Promise((resolve, reject) => {
    const imapConfig = {
      user,
      password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    };

    const imapClient = new Imap(imapConfig);
    let foundBounce = false;

    imapClient.once('ready', () => {
      imapClient.openBox('INBOX', true, (err) => {
        if (err) {
          console.error('无法打开收件箱:', err);
          return reject(err);
        }

        // 搜索未读邮件，来自 Google 的退信
        imapClient.search(['UNSEEN', ['FROM', 'mailer-daemon@googlemail.com']], (err, results) => {
          if (err) {
            console.error('搜索邮件失败:', err);
            return reject(err);
          }

          if (!results || results.length === 0) {
            imapClient.end();
            return resolve(false); // 没有退信
          }

          const fetch = imapClient.fetch(results, { bodies: '' });
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => (buffer += chunk.toString('utf8')));
              stream.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  const bounceText = parsed.text || '';

                  // 检查退信是否与目标邮箱相关
                  if (bounceText.includes(targetEmail) && bounceText.includes('550')) {
                    foundBounce = true; // 发现退信
                    console.log(`${receiverEmail}: 邮箱无效或不存在`);
                  }
                } catch (parseError) {
                //   console.error('解析退信失败:', parseError);
                }
              });
            });
          });

          fetch.once('end', () => {
            imapClient.end();
            resolve(foundBounce); // 返回是否发现退信
          });
        });
      });
    });

    imapClient.once('error', (err) => {
    //   console.error('IMAP 连接错误:', err);
      reject(err);
    });

    imapClient.once('end', () => {
    //   console.log('IMAP 连接已关闭');
    });

    imapClient.connect();
  });
}
var emailList=readgmailList()
// 执行检测
for(var i=0 ;i<emailList.length;i++){
    checkEmailStatus(emailList[i]).catch(console.error);
}
