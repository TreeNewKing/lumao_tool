const { ethers } = require("ethers");
const fs = require("fs");
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


async function getJson() {
    return await fs.promises.readFile('./key.json', 'utf-8');
}

async function main(pwd, index) {
    let json = await getJson();
    const wallet = await ethers.Wallet.fromEncryptedJson(json, pwd);
    if(index<1){
        console.log("从加密json读取助记词：\n");
        console.log(wallet.mnemonic.phrase);
    }else{
 // 直接从助记词派生路径
 const basePath = `m/44'/60'/0'/0/${index}`;
 const derivedWallet = ethers.HDNodeWallet.fromPhrase(wallet.mnemonic.phrase, basePath);
 
 console.log(`第${index}个钱包地址： ${derivedWallet.address} 私钥：${derivedWallet.privateKey}`);
    }

   
}

function askForPasswordAndIndex() {
    return new Promise((resolve) => {
        rl.question('请输入密文密码: ', (password) => {
            rl.question('请输入助记词路径上的索引 (从1开始): ', (index) => {
                resolve({
                    password: password,
                    index: index ? parseInt(index, 10) : 0
                });
                rl.close();
            });
        });
    });
}

// 直接询问用户，而不管命令行参数
async function run() {
    const { password, index } = await askForPasswordAndIndex();
    await main(password, index);
}

run();