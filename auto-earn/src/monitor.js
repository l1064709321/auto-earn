/**
 * 加密货币价格监控 + 自动报警
 * 运行在 GitHub Actions (免费)
 */

const https = require('https');

// === 配置 ===
const CONFIG = {
    // 监控的交易对
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
    // 报警阈值 (百分比)
    alertPercent: 3,  // 涨跌幅超过3%报警
    // Telegram Bot (需要你提供)
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
    }
};

// === 价格获取 ===
async function fetchPrice(symbol) {
    return new Promise((resolve, reject) => {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.replace('/', '')}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        symbol: json.symbol,
                        price: parseFloat(json.lastPrice),
                        change: parseFloat(json.priceChangePercent),
                        high: parseFloat(json.highPrice),
                        low: parseFloat(json.lowPrice),
                        volume: parseFloat(json.volume),
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// === Telegram 推送 ===
async function sendAlert(message) {
    if (!CONFIG.telegram.botToken || !CONFIG.telegram.chatId) {
        console.log('📢 Telegram 未配置，输出到日志');
        console.log(message);
        return;
    }
    
    const url = `https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`;
    const data = JSON.stringify({
        chat_id: CONFIG.telegram.chatId,
        text: message,
        parse_mode: 'HTML'
    });
    
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        });
        req.write(data);
        req.on('error', reject);
    });
}

// === 主逻辑 ===
async function main() {
    console.log(`\n🕐 ${new Date().toISOString()}`);
    console.log('='.repeat(40));
    
    let alerts = [];
    
    for (const pair of CONFIG.pairs) {
        try {
            const price = await fetchPrice(pair);
            const emoji = price.change > 0 ? '📈' : '📉';
            const color = price.change > 0 ? '🟢' : '🔴';
            
            console.log(`${emoji} ${pair}: $${price.price.toFixed(2)} (${price.change > 0 ? '+' : ''}${price.change.toFixed(2)}%)`);
            
            // 检查是否触发报警
            if (Math.abs(price.change) >= CONFIG.alertPercent) {
                alerts.push(`${color} <b>${pair}</b>\n💰 $${price.price.toFixed(2)}\n📊 ${price.change > 0 ? '+' : ''}${price.change.toFixed(2)}%\n🔝 高: $${price.high.toFixed(2)}\n🔻 低: $${price.low.toFixed(2)}`);
            }
        } catch (e) {
            console.log(`❌ ${pair}: ${e.message}`);
        }
    }
    
    // 发送报警
    if (alerts.length > 0) {
        const message = `🚨 <b>价格报警</b>\n\n${alerts.join('\n\n')}\n\n<i>来自 Auto Earn Bot</i>`;
        await sendAlert(message);
        console.log('\n✅ 报警已发送');
    } else {
        console.log('\n⏭️ 无报警');
    }
}

main().catch(console.error);