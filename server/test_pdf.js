const axios = require('axios');

async function testFormat(payload, name) {
    console.log(`\nTesting format: ${name}`);
    try {
        const res = await axios.post('http://localhost:8083/message/sendMedia/gym-69998321026d47aed367b6be', payload, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'mySecretGlobalApiKey123'
            }
        });
        console.log("✅ Success:", res.data);
    } catch (err) {
        console.log("❌ Error:", JSON.stringify(err.response?.data || err.message, null, 2));
    }
}

async function run() {
    const validBase64 = 'SGVsbG8gV29ybGQ='; // Valid short base64

    await testFormat({
        number: "917358546188",
        mediatype: "document",
        mimetype: "text/plain",
        media: validBase64,
        fileName: "test.txt"
    }, "Short base64 without prefix");

    await testFormat({
        number: "917358546188",
        mediatype: "document",
        mimetype: "text/plain",
        media: `data:text/plain;base64,${validBase64}`,
        fileName: "test.txt"
    }, "Short base64 with data URI prefix");
}

run();
