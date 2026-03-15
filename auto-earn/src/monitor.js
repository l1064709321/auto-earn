/**
 * 价格监控 - 飞书推送版本
 */

const axios = require('axios');
const fs = require('fs');

const CONFIG = {
    appId: 'cli_a93fbecfa9f85cbd',
    appSecret: 'ke6OculCUgu4Ce5aSvg2Nc7dbcChYSyV',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'DOGE/USDT'],
    alertPercent: 5,
};

// 飞书 API
let feishuToken = '';

async function getFeishuToken() {
    const res = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: CONFIG.appId,
        app_secret: CONFIG.appSecret
    });
    feishuToken = res.data.tenant_access_token;
    return feishuToken;
}

async function sendMessage(text) {
    if (!feishuToken) await getFeishuToken();
    
    // 使用应用消息发给自己 (需要user_id)
    // 简化：先记录到文件
    const data = { time: new Date().toISOString(), alert: text };
    fs.appendFileSync('./data/alerts.jsonl', JSON.stringify(data) + '\n');
    console.log('📝 已记录报警:', text);
}

// 获取价格
async function getPrice(symbol) {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.replace('/', '')}`;
    const res = await axios.get(url);
    return {
        symbol: res.data.symbol,
        price: parseFloat(res.data.lastPrice),
        change: parseFloat(res.data.priceChangePercent),
    };
}

// 主逻辑
async function main() {
    console.log(`\n🕐 ${new Date().toISOString()}`);
    
    let alerts = [];
    
    for (const pair of CONFIG.pairs) {
        try {
            const price = await getPrice(pair);
            const emoji = price.change > 0 ? '📈' : '📉';
            console.log(`${emoji} ${pair}: $${price.price.toFixed(2)} (${price.change > 0 ? '+' : ''}${price.change.toFixed(2)}%)`);
            
            if (Math.abs(price.change) >= CONFIG.alertPercent) {
                alerts.push(`${pair} ${price.change > 0 ? '+' : ''}${price.change.toFixed(2)}% at $${price.price.toFixed(2)}`);
            }
        } catch (e) {
            console.log(`❌ ${pair}: ${e.message}`);
        }
    }
    
    if (alerts.length > 0) {
        await sendMessage(alerts.join('\n'));
    }
    
    // 记录价格数据
    const dataFile = './data/prices.json';
    let prices = {};
    if (fs.existsSync(dataFile)) {
        prices = JSON.parse(fs.readFileSync(dataFile));
    }
    
    for (const pair of CONFIG.pairs) {
        try {
            const price = await getPrice(pair);
            prices[pair] = { price: price.price, change: price.change, time: Date.now() };
        } catch (e) {}
    }
    
    fs.writeFileSync(dataFile, JSON.stringify(prices, null, 2));
    console.log('✅ 价格数据已保存');
}

main().catch(console.error);