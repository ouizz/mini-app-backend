// ฟังก์ชันขอ Access Token จาก OAuth 2.0 ของ LINE อัตโนมัติ
async function getAccessToken() {
  // หากมีการตั้งค่า CHANNEL_ACCESS_TOKEN โดยตรงให้ใช้ค่านั้นก่อน
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return process.env.LINE_CHANNEL_ACCESS_TOKEN;
  }

  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  const res = await fetch('https://api.line.me/v2/oauth/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || 'OAuth Failed');
  }

  return data.access_token;
}

export default async function handler(req, res) {
  // จัดการ Preflight Request (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId, notificationToken, newDate, shopName } = req.body;

  // ใช้ notificationToken ก่อน หากไม่มีค่อยใช้ userId
  const targetToken = notificationToken || userId;

  if (!targetToken || !newDate) {
    return res.status(400).json({ error: 'Missing target token or newDate' });
  }

  try {
    const token = await getAccessToken();

    const lineResponse = await fetch('https://api.line.me/message/v3/notifier/send?target=service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        templateName: 'accepted_reminder_d_th',
        params: {
          date_time: newDate,
          shop_name: shopName || 'สาขาหลัก',
          btn1_url: 'https://miniapp.line.me/2011612068-jTYoURfr',
          btn2_url: 'https://line.me',
        },
        notificationToken: targetToken,
      }),
    });

    const result = await lineResponse.json();

    if (!lineResponse.ok) {
      console.error('LINE Service Message Error:', result);
      return res.status(lineResponse.status).json({ success: false, details: result });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}