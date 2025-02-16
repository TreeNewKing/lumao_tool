const { ethers } = require("ethers");
const readline = require('readline');

// 初始化 args 数组
let args = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 等待用户输入密码
rl.question('请输入加密的密码: ', async (answer) => {
    args[0] = answer; // 将输入的密码存储到 args 数组中
    console.log(`使用如下密码对助记词进行加密: 【${answer}】`);
    
    // 关闭接口
    rl.close();
    
    // 现在可以调用 main 函数，因为我们有了密码
    await main();
});

async function main() {
    if (!args[0]) {
        console.error('请输入加密密码');
        return;
    }

    // 生成助记词
    const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(32));
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    const pwd = args[0];
    
    try {
        const json = await wallet.encrypt(pwd);
        console.log("请保存如下助记词密文,如需获取私钥/助记词请将密文放入key.json文件中\n");
        console.log(json);
    } catch (error) {
        console.error('加密过程中出错:', error.message);
    }
}